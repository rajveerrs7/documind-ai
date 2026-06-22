// ─────────────────────────────────────────────────────────────────────────────
// Document Card Component
//
// Displays a single document's metadata with:
//   - Status badge (PENDING, PROCESSING, READY, FAILED)
//   - File size, page count, chunk count
//   - "Chat with document" button
//   - Delete button with confirmation
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDocumentStore } from "@/lib/stores/document-store";
import { DocumentStatus } from "@prisma/client";
import type { DocumentMeta } from "@/types";

interface DocumentCardProps {
  document: DocumentMeta & { _count?: { chats: number } };
}

// Status badge config
const STATUS_CONFIG: Record<
  DocumentStatus,
  { label: string; className: string; dotClass: string }
> = {
  PENDING: {
    label: "Pending",
    className:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    dotClass: "bg-yellow-500",
  },
  PROCESSING: {
    label: "Processing",
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    dotClass: "bg-blue-500 animate-pulse",
  },
  READY: {
    label: "Ready",
    className:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    dotClass: "bg-green-500",
  },
  FAILED: {
    label: "Failed",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    dotClass: "bg-red-500",
  },
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function DocumentCard({ document }: DocumentCardProps) {
  const router = useRouter();
  const { deleteDocument } = useDocumentStore();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const statusConfig = STATUS_CONFIG[document.status];
  const isReady = document.status === DocumentStatus.READY;

  const handleChat = () => {
    router.push(`/chat?documentId=${document.id}`);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    const success = await deleteDocument(document.id);
    if (!success) {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm hover:shadow-md transition-all duration-200 group">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        {/* File Icon + Name */}
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-red-600 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <h3
              className="font-semibold text-gray-900 dark:text-white text-sm leading-tight truncate"
              title={document.filename}
            >
              {document.filename}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {formatDate(document.createdAt)}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <span
          className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.className}`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotClass}`}
          />
          {statusConfig.label}
        </span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <p className="text-xs text-gray-500 dark:text-gray-400">Size</p>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mt-0.5">
            {formatFileSize(document.fileSize)}
          </p>
        </div>
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <p className="text-xs text-gray-500 dark:text-gray-400">Pages</p>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mt-0.5">
            {document.pageCount ?? "—"}
          </p>
        </div>
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <p className="text-xs text-gray-500 dark:text-gray-400">Chunks</p>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mt-0.5">
            {document.chunkCount ?? "—"}
          </p>
        </div>
      </div>

      {/* Error Message */}
      {document.errorMessage && (
        <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <p className="text-xs text-red-600 dark:text-red-400 truncate">
            Error: {document.errorMessage}
          </p>
        </div>
      )}

      {/* Actions */}
      {!showDeleteConfirm ? (
        <div className="flex gap-2">
          <button
            onClick={handleChat}
            disabled={!isReady}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5
              ${
                isReady
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
              }`}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            {isReady ? "Chat" : "Processing..."}
          </button>

          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            title="Delete document"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      ) : (
        /* Delete Confirmation */
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
          <p className="text-xs text-red-700 dark:text-red-400 mb-2 font-medium">
            Delete this document and all its chat history?
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex-1 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
            >
              {isDeleting ? (
                <>
                  <svg
                    className="animate-spin w-3 h-3"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Deleting...
                </>
              ) : (
                "Yes, delete"
              )}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isDeleting}
              className="flex-1 py-1.5 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 text-xs font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
