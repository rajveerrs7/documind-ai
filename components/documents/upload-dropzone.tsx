// ─────────────────────────────────────────────────────────────────────────────
// Upload Dropzone Component
//
// Drag-and-drop file upload area with:
//   - Drag over visual feedback
//   - Click to browse
//   - File validation (type, size)
//   - Upload progress display
//   - Processing status polling
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useState, useCallback, useRef } from "react";
import { useDocumentStore } from "@/lib/stores/document-store";

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export function UploadDropzone() {
  const { uploadDocument, uploadProgress } = useDocumentStore();
  const [isDragOver, setIsDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isUploading =
    uploadProgress.phase === "uploading" ||
    uploadProgress.phase === "processing";

  // ── Validation ──────────────────────────────────────────────

  const validateFile = (file: File): string | null => {
    if (file.type !== "application/pdf") {
      return `Invalid file type: ${file.type}. Please upload a PDF file.`;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum size is ${MAX_FILE_SIZE_MB}MB.`;
    }
    if (file.size === 0) {
      return "File is empty. Please select a valid PDF.";
    }
    return null;
  };

  // ── Upload Handler ──────────────────────────────────────────

  const handleUpload = useCallback(
    async (file: File) => {
      setLocalError(null);

      const validationError = validateFile(file);
      if (validationError) {
        setLocalError(validationError);
        return;
      }

      await uploadDocument(file);
    },
    [uploadDocument],
  );

  // ── Drag Events ─────────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;
      if (files.length > 1) {
        setLocalError("Please upload one file at a time.");
        return;
      }
      handleUpload(files[0]);
    },
    [handleUpload],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      handleUpload(files[0]);
      // Reset input so the same file can be uploaded again
      e.target.value = "";
    },
    [handleUpload],
  );

  // ── Progress UI ─────────────────────────────────────────────

  const getPhaseLabel = () => {
    switch (uploadProgress.phase) {
      case "uploading":
        return "Uploading file...";
      case "processing":
        return "Processing PDF & generating embeddings...";
      case "done":
        return "Document ready!";
      case "error":
        return "Upload failed";
      default:
        return "";
    }
  };

  return (
    <div className="w-full">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200
          ${isUploading ? "cursor-not-allowed" : "cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10"}
          ${
            isDragOver
              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-[1.01]"
              : uploadProgress.phase === "done"
                ? "border-green-400 bg-green-50/50 dark:bg-green-900/10"
                : uploadProgress.phase === "error"
                  ? "border-red-400 bg-red-50/50 dark:bg-red-900/10"
                  : "border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50"
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileInput}
          className="hidden"
          disabled={isUploading}
        />

        {/* Icon */}
        <div className="flex justify-center mb-4">
          {isUploading ? (
            <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <svg
                className="animate-spin w-8 h-8 text-blue-600"
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
            </div>
          ) : uploadProgress.phase === "done" ? (
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          ) : (
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center ${
                isDragOver
                  ? "bg-blue-100 dark:bg-blue-900/30"
                  : "bg-gray-100 dark:bg-gray-700"
              }`}
            >
              <svg
                className={`w-8 h-8 ${isDragOver ? "text-blue-600" : "text-gray-400"}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
          )}
        </div>

        {/* Text */}
        {isUploading ? (
          <div>
            <p className="text-base font-medium text-gray-700 dark:text-gray-300 mb-1">
              {getPhaseLabel()}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {uploadProgress.filename}
            </p>
            {/* Progress Bar */}
            <div className="w-full max-w-xs mx-auto bg-gray-200 dark:bg-gray-600 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${uploadProgress.progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {uploadProgress.progress}% complete
            </p>
          </div>
        ) : uploadProgress.phase === "done" ? (
          <div>
            <p className="text-base font-semibold text-green-700 dark:text-green-400">
              Upload complete!
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Your document is ready to chat with
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                useDocumentStore.setState({
                  uploadProgress: {
                    documentId: null,
                    filename: "",
                    phase: "idle",
                    progress: 0,
                    error: null,
                  },
                });
              }}
              className="mt-3 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 underline"
            >
              Upload another document
            </button>
          </div>
        ) : (
          <div>
            <p className="text-base font-medium text-gray-700 dark:text-gray-300">
              {isDragOver ? "Drop your PDF here" : "Drag & drop your PDF here"}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              or{" "}
              <span className="text-blue-600 dark:text-blue-400 font-medium">
                click to browse
              </span>
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
              PDF files only · Maximum {MAX_FILE_SIZE_MB}MB
            </p>
          </div>
        )}
      </div>

      {/* Error Messages */}
      {(localError || uploadProgress.error) && (
        <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
          <svg
            className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm text-red-600 dark:text-red-400">
            {localError || uploadProgress.error}
          </p>
        </div>
      )}
    </div>
  );
}
