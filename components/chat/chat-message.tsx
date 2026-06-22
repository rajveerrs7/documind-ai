// ─────────────────────────────────────────────────────────────────────────────
// Chat Message Component
//
// Renders a single chat message bubble with:
//   - User vs assistant styling
//   - Markdown-like formatting for assistant messages
//   - Citations display (collapsible)
//   - Token count badge
//   - Streaming cursor for in-progress messages
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { CitationsList } from "./citation-card";
import type { ChatMessage as ChatMessageType } from "@/types";
import { MessageRole } from "@prisma/client";

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
}

// Simple markdown-like formatter for assistant messages
// Handles: **bold**, `code`, and newlines
function formatContent(content: string): string {
  return content
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(
      /`([^`]+)`/g,
      '<code class="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-sm font-mono">$1</code>',
    )
    .replace(/\n\n/g, '</p><p class="mt-3">')
    .replace(/\n/g, "<br />");
}

export function ChatMessageBubble({
  message,
  isStreaming = false,
}: ChatMessageProps) {
  const isUser = message.role === MessageRole.USER;
  const isAssistant = message.role === MessageRole.ASSISTANT;

  const formattedTime = new Date(message.createdAt).toLocaleTimeString(
    "en-US",
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  );

  return (
    <div
      className={`flex gap-3 animate-fade-in ${
        isUser ? "flex-row-reverse" : "flex-row"
      }`}
    >
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-gradient-to-br from-indigo-500 to-purple-600 text-white"
        }`}
      >
        {isUser ? (
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
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        ) : (
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
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        )}
      </div>

      {/* Message bubble */}
      <div
        className={`max-w-[75%] ${isUser ? "items-end" : "items-start"} flex flex-col`}
      >
        {/* Role label */}
        <span
          className={`text-xs text-gray-400 dark:text-gray-500 mb-1 ${isUser ? "text-right" : ""}`}
        >
          {isUser ? "You" : "DocuMind AI"} · {formattedTime}
        </span>

        {/* Content bubble */}
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? "bg-blue-600 text-white rounded-tr-sm"
              : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-tl-sm shadow-sm"
          }`}
        >
          {isUser ? (
            // User messages: plain text
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {message.content}
            </p>
          ) : (
            // Assistant messages: formatted with streaming cursor
            <div className="text-sm leading-relaxed">
              <p
                dangerouslySetInnerHTML={{
                  __html: formatContent(message.content),
                }}
                className="prose-sm"
              />
              {/* Streaming cursor */}
              {isStreaming && (
                <span className="inline-block w-0.5 h-4 bg-gray-500 dark:bg-gray-400 ml-0.5 animate-pulse align-middle" />
              )}
            </div>
          )}
        </div>

        {/* Token count (for assistant messages) */}
        {isAssistant && !isStreaming && message.outputTokens > 0 && (
          <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
            {message.inputTokens + message.outputTokens} tokens
          </span>
        )}

        {/* Citations (for assistant messages) */}
        {isAssistant && !isStreaming && message.citations && (
          <div className="w-full mt-1">
            <CitationsList citations={message.citations} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Streaming Message (in-progress) ──────────────────────────────────────────

interface StreamingMessageProps {
  content: string;
  citations: import("@/types").Citation[];
}

export function StreamingMessage({
  content,
  citations,
}: StreamingMessageProps) {
  void citations;

  // Create a fake message object for the streaming bubble
  const streamingMessage: ChatMessageType = {
    id: "streaming",
    chatId: "",
    userId: "",
    documentId: "",
    role: MessageRole.ASSISTANT,
    content: content || " ", // Space ensures cursor shows even on empty content
    citations: null,
    inputTokens: 0,
    outputTokens: 0,
    createdAt: new Date(),
  };

  return <ChatMessageBubble message={streamingMessage} isStreaming={true} />;
}
