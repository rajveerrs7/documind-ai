// ─────────────────────────────────────────────────────────────────────────────
// Chat Page
//
// Main chat interface combining:
//   - ChatSidebar (document selector + history)
//   - ChatWindow (messages + input)
//
// URL params:
//   - documentId: pre-select a document
//   - chatId: load an existing chat
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useChatStore } from "../../../lib/stores/chat-store";
import { useDocumentStore } from "../../../lib/stores/document-store";
import { ChatSidebar } from "../../../components/chat/chat-sidebar";
import { ChatWindow } from "../../../components/chat/chat-window";

function ChatPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const documentIdParam = searchParams.get("documentId");
  const chatIdParam = searchParams.get("chatId");

  const {
    activeChatId,
    activeDocumentId,
    setActiveChat,
    loadChatMessages,
    clearChat,
  } = useChatStore();

  const { documents, fetchDocuments } = useDocumentStore();

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Initialize from URL params
  useEffect(() => {
    if (documentIdParam && documentIdParam !== activeDocumentId) {
      setActiveChat(chatIdParam || null, documentIdParam);
    }
    if (chatIdParam && chatIdParam !== activeChatId) {
      loadChatMessages(chatIdParam);
    }
  }, [
    documentIdParam,
    chatIdParam,
    activeChatId,
    activeDocumentId,
    loadChatMessages,
    setActiveChat,
  ]);

  const selectedDocument = documents.find((d) => d.id === activeDocumentId);

  const handleSelectDocument = (documentId: string) => {
    clearChat();
    setActiveChat(null, documentId);
    router.push(`/chat?documentId=${documentId}`);
  };

  const handleSelectChat = (chatId: string) => {
    loadChatMessages(chatId);
    router.push(`/chat?chatId=${chatId}&documentId=${activeDocumentId}`);
  };

  const handleNewChat = () => {
    clearChat();
    setActiveChat(null, activeDocumentId);
    if (activeDocumentId) {
      router.push(`/chat?documentId=${activeDocumentId}`);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <ChatSidebar
        selectedDocumentId={activeDocumentId}
        selectedChatId={activeChatId}
        onSelectDocument={handleSelectDocument}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeDocumentId ? (
          <ChatWindow
            documentId={activeDocumentId}
            documentName={selectedDocument?.filename}
          />
        ) : (
          /* No document selected state */
          <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
            <div className="text-center max-w-sm">
              <div className="w-20 h-20 mx-auto mb-6 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-blue-600 dark:text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Select a Document
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Choose a document from the sidebar to start chatting with it
                using AI
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
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
      }
    >
      <ChatPageContent />
    </Suspense>
  );
}
