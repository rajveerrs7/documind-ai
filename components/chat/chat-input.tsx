// ─────────────────────────────────────────────────────────────────────────────
// Chat Input Component
//
// The message input area at the bottom of the chat window.
// Features:
//   - Auto-growing textarea
//   - Send on Enter (Shift+Enter for newline)
//   - Disabled state during streaming
//   - Character count indicator
//   - Send button with loading state
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface ChatInputProps {
  onSend: (message: string) => void;
  isStreaming: boolean;
  disabled?: boolean;
  placeholder?: string;
}

const MAX_MESSAGE_LENGTH = 2000;

export function ChatInput({
  onSend,
  isStreaming,
  disabled = false,
  placeholder = "Ask a question about your document...",
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea as content grows
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [message, adjustHeight]);

  // Focus input when not streaming
  useEffect(() => {
    if (!isStreaming && !disabled) {
      textareaRef.current?.focus();
    }
  }, [isStreaming, disabled]);

  const handleSubmit = () => {
    const trimmed = message.trim();
    if (!trimmed || isStreaming || disabled) return;
    if (trimmed.length > MAX_MESSAGE_LENGTH) return;

    onSend(trimmed);
    setMessage("");

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isOverLimit = message.length > MAX_MESSAGE_LENGTH;
  const canSend =
    message.trim().length > 0 && !isStreaming && !disabled && !isOverLimit;

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div
        className={`flex gap-3 items-end rounded-xl border transition-colors ${
          isOverLimit
            ? "border-red-400 dark:border-red-600"
            : isStreaming || disabled
              ? "border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50"
              : "border-gray-300 dark:border-gray-600 focus-within:border-blue-400 dark:focus-within:border-blue-500 bg-white dark:bg-gray-800"
        } px-4 py-3`}
      >
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isStreaming ? "Waiting for response..." : placeholder}
          disabled={isStreaming || disabled}
          rows={1}
          className={`flex-1 resize-none bg-transparent text-sm text-gray-900 dark:text-white
            placeholder:text-gray-400 dark:placeholder:text-gray-500
            focus:outline-none leading-relaxed min-h-[24px] max-h-[200px]
            disabled:cursor-not-allowed`}
        />

        {/* Send button */}
        <button
          onClick={handleSubmit}
          disabled={!canSend}
          className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
            canSend
              ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
              : "bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
          }`}
          title={
            isStreaming ? "Waiting for response..." : "Send message (Enter)"
          }
        >
          {isStreaming ? (
            <svg
              className="w-4 h-4 animate-spin"
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
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Footer info row */}
      <div className="flex items-center justify-between mt-2 px-1">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {isStreaming ? (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              AI is thinking...
            </span>
          ) : (
            "Press Enter to send, Shift+Enter for new line"
          )}
        </p>

        {/* Character count */}
        {message.length > 0 && (
          <span
            className={`text-xs ${
              isOverLimit
                ? "text-red-500"
                : message.length > MAX_MESSAGE_LENGTH * 0.8
                  ? "text-yellow-500"
                  : "text-gray-400"
            }`}
          >
            {message.length}/{MAX_MESSAGE_LENGTH}
          </span>
        )}
      </div>
    </div>
  );
}
