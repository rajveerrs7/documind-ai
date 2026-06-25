// ─────────────────────────────────────────────────────────────────────────────
// Documents Management Page
//
// Shows:
//   - Upload dropzone at the top
//   - Grid of document cards
//   - Empty state when no documents
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useEffect } from "react";
import { useDocumentStore } from "@/lib/stores/document-store";
import { UploadDropzone } from "@/components/documents/upload-dropzone";
import { DocumentCard } from "@/components/documents/document-card";
import { DocumentMeta } from "@/types";

export default function DocumentsPage() {
  const { documents, isLoading, fetchDocuments } = useDocumentStore();

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          My Documents
        </h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          Upload PDFs and chat with them using AI
        </p>
      </div>

      {/* Upload Section */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
          Upload New Document
        </h2>
        <UploadDropzone />
      </div>

      {/* Documents Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            Your Documents
            {documents.length > 0 && (
              <span className="ml-2 text-gray-400 font-normal normal-case">
                ({documents.length})
              </span>
            )}
          </h2>
          {documents.length > 0 && (
            <button
              onClick={fetchDocuments}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Refresh
            </button>
          )}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 animate-pulse"
              >
                <div className="flex gap-3 mb-4">
                  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[1, 2, 3].map((j) => (
                    <div
                      key={j}
                      className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg"
                    />
                  ))}
                </div>
                <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded-lg" />
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && documents.length === 0 && (
          <div className="text-center py-16 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-gray-400"
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
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
              No documents yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
              Upload your first PDF document above to start chatting with it
              using AI
            </p>
          </div>
        )}

        {/* Document Cards Grid */}
        {!isLoading && documents.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map((doc) => (
              <DocumentCard
                key={doc.id}
                document={doc as DocumentMeta & { _count?: { chats: number } }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
