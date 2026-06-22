// ─────────────────────────────────────────────────────────────────────────────
// Chat Window Component
//
// The main chat interface showing:
//   - Message history
//   - Streaming message (in real-time)
//   - Chat input
//   - Empty state with suggested questions
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useEffect, useRef } from "react";
import { useChatStore } from "@/lib/stores/chat-store";
import { ChatMessageBubble, StreamingMessage } from "./chat-message";
import { ChatInput } from "./chat-input";

interface ChatWindowProps {
  documentId: string;
  documentName?: string;
}

const SUGGESTED_QUESTIONS = [
  "What is the main topic of this document?",
  "Summarize the key points in 3 bullet points",
  "What are the most important conclusions?",
  "Are there any specific dates or numbers mentioned?",
];

export function ChatWindow({ documentId, documentName }: ChatWindowProps) {
  const { messages, streaming, error, tokenWarning, sendMessage, setError } =
    useChatStore();

  // Ref for auto-scrolling to bottom
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive or streaming updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming.currentContent]);

  const handleSend = async (message: string) => {
    setError(null);
    await sendMessage(message, documentId);
  };

  const handleSuggestedQuestion = (question: string) => {
    handleSend(question);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Chat Header */}
      {documentName && (
        <div className="flex-shrink-0 px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-3.5 h-3.5 text-red-600 dark:text-red-400"
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
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {documentName}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Powered by Groq llama3-8b
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-6 chat-scroll"
      >
        {/* Empty state with suggested questions */}
        {messages.length === 0 && !streaming.isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-blue-600 dark:text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Ready to answer your questions
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-8 max-w-sm">
              Ask anything about your document. I&apos;ll provide accurate
              answers with citations.
            </p>

            {/* Suggested questions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {SUGGESTED_QUESTIONS.map((question) => (
                <button
                  key={question}
                  onClick={() => handleSuggestedQuestion(question)}
                  disabled={streaming.isStreaming}
                  className="text-left px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700
                    bg-white dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-600
                    hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors
                    text-sm text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {messages.map((message) => (
          <ChatMessageBubble
            key={message.id}
            message={message}
            isStreaming={false}
          />
        ))}

        {/* Streaming message (in-progress) */}
        {streaming.isStreaming && (
          <StreamingMessage
            content={streaming.currentContent}
            citations={streaming.currentCitations}
          />
        )}

        {/* Error message */}
        {error && (
          <div className="flex justify-center">
            <div className="max-w-sm w-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"
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
                <div>
                  <p className="text-sm font-medium text-red-700 dark:text-red-400">
                    Error
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-300 mt-0.5">
                    {error}
                  </p>
                  <button
                    onClick={() => setError(null)}
                    className="text-xs text-red-500 hover:text-red-700 mt-1 underline"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Token warning */}
        {tokenWarning && (
          <div className="flex justify-center">
            <div className="max-w-sm w-full bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-3">
              <p className="text-xs text-yellow-700 dark:text-yellow-400 text-center">
                ⚠️ {tokenWarning}
              </p>
            </div>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <div className="flex-shrink-0">
        <ChatInput
          onSend={handleSend}
          isStreaming={streaming.isStreaming}
          disabled={false}
        />
      </div>
    </div>
  );
}
