// ─────────────────────────────────────────────────────────────────────────────
// Document Store — Zustand
//
// Manages client-side document list state.
// Provides actions for uploading, deleting, and refreshing documents.
// ─────────────────────────────────────────────────────────────────────────────

import { create } from "zustand";
import type { DocumentMeta, UploadResponse } from "@/types";
import { DocumentStatus } from "@prisma/client";

interface UploadProgress {
  documentId: string | null;
  filename: string;
  // Upload phase: "uploading" | "processing" | "done" | "error"
  phase: "idle" | "uploading" | "processing" | "done" | "error";
  progress: number; // 0–100
  error: string | null;
}

interface DocumentState {
  documents: DocumentMeta[];
  isLoading: boolean;
  error: string | null;
  uploadProgress: UploadProgress;
  selectedDocumentId: string | null;

  // Actions
  setDocuments: (documents: DocumentMeta[]) => void;
  addDocument: (document: DocumentMeta) => void;
  removeDocument: (id: string) => void;
  updateDocument: (id: string, updates: Partial<DocumentMeta>) => void;
  setSelectedDocument: (id: string | null) => void;
  setError: (error: string | null) => void;

  // Async actions
  fetchDocuments: () => Promise<void>;
  uploadDocument: (file: File) => Promise<UploadResponse | null>;
  deleteDocument: (id: string) => Promise<boolean>;
  pollDocumentStatus: (documentId: string) => Promise<void>;
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  documents: [],
  isLoading: false,
  error: null,
  selectedDocumentId: null,
  uploadProgress: {
    documentId: null,
    filename: "",
    phase: "idle",
    progress: 0,
    error: null,
  },

  setDocuments: (documents) => set({ documents }),
  addDocument: (document) =>
    set((state) => ({ documents: [document, ...state.documents] })),
  removeDocument: (id) =>
    set((state) => ({
      documents: state.documents.filter((d) => d.id !== id),
    })),
  updateDocument: (id, updates) =>
    set((state) => ({
      documents: state.documents.map((d) =>
        d.id === id ? { ...d, ...updates } : d,
      ),
    })),
  setSelectedDocument: (id) => set({ selectedDocumentId: id }),
  setError: (error) => set({ error }),

  // ── Fetch Documents ─────────────────────────────────────────

  fetchDocuments: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch("/api/documents?limit=50", {
        credentials: "include",
      });
      const data = await response.json();

      if (data.success) {
        set({ documents: data.data.documents, isLoading: false });
      } else {
        set({ error: data.error, isLoading: false });
      }
    } catch {
      set({
        error: "Failed to load documents",
        isLoading: false,
      });
    }
  },

  // ── Upload Document ─────────────────────────────────────────

  uploadDocument: async (file: File): Promise<UploadResponse | null> => {
    set({
      uploadProgress: {
        documentId: null,
        filename: file.name,
        phase: "uploading",
        progress: 10,
        error: null,
      },
    });

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Simulate upload progress
      set((state) => ({
        uploadProgress: { ...state.uploadProgress, progress: 30 },
      }));

      const response = await fetch("/api/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        set({
          uploadProgress: {
            documentId: null,
            filename: file.name,
            phase: "error",
            progress: 0,
            error: data.error || "Upload failed",
          },
        });
        return null;
      }

      const uploadResult: UploadResponse = data.data;

      // Update progress to show processing phase
      set({
        uploadProgress: {
          documentId: uploadResult.documentId,
          filename: file.name,
          phase: "processing",
          progress: 60,
          error: null,
        },
      });

      // Poll for processing completion
      await get().pollDocumentStatus(uploadResult.documentId);

      return uploadResult;
    } catch {
      set({
        uploadProgress: {
          documentId: null,
          filename: file.name,
          phase: "error",
          progress: 0,
          error: "Network error during upload",
        },
      });
      return null;
    }
  },

  // ── Poll Document Status ────────────────────────────────────

  pollDocumentStatus: async (documentId: string): Promise<void> => {
    const maxAttempts = 30; // Poll for up to 2.5 minutes
    const pollInterval = 5000; // Every 5 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      try {
        const response = await fetch(`/api/documents/${documentId}/status`, {
          credentials: "include",
        });
        const data = await response.json();

        if (!data.success) break;

        const { status } = data.data;

        if (status === DocumentStatus.READY) {
          // Refresh document list
          await get().fetchDocuments();

          set({
            uploadProgress: {
              documentId,
              filename: get().uploadProgress.filename,
              phase: "done",
              progress: 100,
              error: null,
            },
          });
          return;
        }

        if (status === DocumentStatus.FAILED) {
          set({
            uploadProgress: {
              documentId,
              filename: get().uploadProgress.filename,
              phase: "error",
              progress: 0,
              error: data.data.errorMessage || "Processing failed",
            },
          });
          return;
        }

        // Still processing — update progress
        const progress = Math.min(90, 60 + attempt * 2);
        set((state) => ({
          uploadProgress: {
            ...state.uploadProgress,
            progress,
          },
        }));
      } catch {
        // Polling error — continue trying
      }
    }

    // Timeout
    set((state) => ({
      uploadProgress: {
        ...state.uploadProgress,
        phase: "error",
        error: "Processing timed out. Please refresh the page.",
      },
    }));
  },

  // ── Delete Document ─────────────────────────────────────────

  deleteDocument: async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json();

      if (data.success) {
        get().removeDocument(id);
        // If deleted doc was selected, clear selection
        if (get().selectedDocumentId === id) {
          set({ selectedDocumentId: null });
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },
}));
