// ─────────────────────────────────────────────────────────────────────────────
// Chat Sidebar Component
//
// Left panel showing:
//   - Document selector
//   - Chat history for selected document
//   - New chat button
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useEffect, useState } from "react";
import { useChatStore } from "@/lib/stores/chat-store";
import { useDocumentStore } from "@/lib/stores/document-store";
import { DocumentStatus } from "@prisma/client";

interface ChatSidebarProps {
  selectedDocumentId: string | null;
  selectedChatId: string | null;
  onSelectDocument: (documentId: string) => void;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
}

function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString();
}

export function ChatSidebar({
  selectedDocumentId,
  selectedChatId,
  onSelectDocument,
  onSelectChat,
  onNewChat,
}: ChatSidebarProps) {
  const { documents, fetchDocuments } = useDocumentStore();
  const { chatHistory, loadChatHistory, isLoadingHistory } = useChatStore();
  const [showDocumentPicker, setShowDocumentPicker] = useState(false);

  const readyDocuments = documents.filter(
    (d) => d.status === DocumentStatus.READY,
  );

  const selectedDocument = documents.find((d) => d.id === selectedDocumentId);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    if (selectedDocumentId) {
      loadChatHistory(selectedDocumentId);
    }
  }, [selectedDocumentId, loadChatHistory]);

  return (
    <div className="w-72 flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="font-semibold text-gray-900 dark:text-white text-sm mb-3">
          Chat with Documents
        </h2>

        {/* Document selector */}
        <div className="relative">
          <button
            onClick={() => setShowDocumentPicker(!showDocumentPicker)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm"
          >
            <div className="flex items-center gap-2 min-w-0">
              <svg
                className="w-4 h-4 text-red-500 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <span className="text-gray-700 dark:text-gray-300 truncate">
                {selectedDocument?.filename || "Select a document"}
              </span>
            </div>
            <svg
              className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${showDocumentPicker ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {/* Document dropdown */}
          {showDocumentPicker && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 overflow-hidden max-h-48 overflow-y-auto">
              {readyDocuments.length === 0 ? (
                <div className="p-3 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    No documents ready yet
                  </p>
                </div>
              ) : (
                readyDocuments.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => {
                      onSelectDocument(doc.id);
                      setShowDocumentPicker(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                      doc.id === selectedDocumentId
                        ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                        : "text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    <svg
                      className="w-3.5 h-3.5 text-red-400 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <span className="truncate">{doc.filename}</span>
                    {doc.id === selectedDocumentId && (
                      <svg
                        className="w-3.5 h-3.5 ml-auto flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                      </svg>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* New chat button */}
        {selectedDocumentId && (
          <button
            onClick={onNewChat}
            className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
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
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Chat
          </button>
        )}
      </div>

      {/* Chat history */}
      <div className="flex-1 overflow-y-auto">
        {!selectedDocumentId ? (
          <div className="p-4 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Select a document to see chat history
            </p>
          </div>
        ) : isLoadingHistory ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-14 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : chatHistory.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              No chats yet. Start a conversation!
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide px-2 py-1">
              Recent Chats
            </p>
            {chatHistory.map((chat) => (
              <button
                key={chat.id}
                onClick={() => onSelectChat(chat.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                  chat.id === selectedChatId
                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                <p className="text-sm font-medium truncate">{chat.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {formatRelativeTime(chat.updatedAt)}
                  </p>
                  {chat._count && (
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      · {chat._count.messages} messages
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
