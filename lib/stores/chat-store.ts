// ─────────────────────────────────────────────────────────────────────────────
// Chat Store — Zustand
//
// Manages all client-side chat state:
//   - Current chat session
//   - Messages list
//   - Streaming state
//   - Citations display
//   - Chat history list
//
// The streaming flow:
//   1. User sends message → store adds optimistic user message
//   2. fetch() to /api/chat starts
//   3. Response body is a ReadableStream of JSON lines
//   4. We read chunks and:
//      - "token" → append to currentStreamingContent
//      - "citations" → store citations
//      - "done" → finalize assistant message
//      - "error" → show error state
// ─────────────────────────────────────────────────────────────────────────────

import { create } from "zustand";
import type { ChatMessage, ChatSession, Citation, StreamChunk } from "@/types";
import { MessageRole } from "@prisma/client";
import { useAuthStore } from "@/lib/stores/auth-store";

// ── Types ─────────────────────────────────────────────────────────────────────

interface StreamingState {
  isStreaming: boolean;
  currentContent: string;
  currentCitations: Citation[];
}

interface ChatState {
  // Active chat session
  activeChatId: string | null;
  activeDocumentId: string | null;

  // Messages for the active chat
  messages: ChatMessage[];

  // Streaming state for the current response
  streaming: StreamingState;

  // All chat sessions (for sidebar)
  chatHistory: Array<
    ChatSession & {
      document?: { id: string; filename: string; status: string };
      messages?: Array<{ content: string; role: string; createdAt: Date }>;
      _count?: { messages: number };
    }
  >;

  // UI state
  isLoadingMessages: boolean;
  isLoadingHistory: boolean;
  error: string | null;
  tokenWarning: string | null;

  // Actions
  setActiveChat: (chatId: string | null, documentId: string | null) => void;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  setError: (error: string | null) => void;
  clearChat: () => void;

  // Async actions
  loadChatMessages: (chatId: string) => Promise<void>;
  loadChatHistory: (documentId?: string) => Promise<void>;
  sendMessage: (message: string, documentId: string) => Promise<void>;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useChatStore = create<ChatState>((set, get) => ({
  activeChatId: null,
  activeDocumentId: null,
  messages: [],
  streaming: {
    isStreaming: false,
    currentContent: "",
    currentCitations: [],
  },
  chatHistory: [],
  isLoadingMessages: false,
  isLoadingHistory: false,
  error: null,
  tokenWarning: null,

  setActiveChat: (chatId, documentId) =>
    set({ activeChatId: chatId, activeDocumentId: documentId }),

  setMessages: (messages) => set({ messages }),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  setError: (error) => set({ error }),

  clearChat: () =>
    set({
      activeChatId: null,
      messages: [],
      streaming: {
        isStreaming: false,
        currentContent: "",
        currentCitations: [],
      },
      error: null,
    }),

  // ── Load Chat Messages ──────────────────────────────────────

  loadChatMessages: async (chatId: string) => {
    set({ isLoadingMessages: true, error: null });

    try {
      const response = await fetch(`/api/chat/${chatId}/messages`, {
        credentials: "include",
      });
      const data = await response.json();

      if (data.success) {
        set({
          messages: data.data.messages,
          activeChatId: chatId,
          activeDocumentId: data.data.chat.documentId,
          isLoadingMessages: false,
        });
      } else {
        set({ error: data.error, isLoadingMessages: false });
      }
    } catch {
      set({
        error: "Failed to load chat messages",
        isLoadingMessages: false,
      });
    }
  },

  // ── Load Chat History ───────────────────────────────────────

  loadChatHistory: async (documentId?: string) => {
    set({ isLoadingHistory: true });

    try {
      const url = documentId
        ? `/api/chat/history?documentId=${documentId}&limit=30`
        : "/api/chat/history?limit=30";

      const response = await fetch(url, { credentials: "include" });
      const data = await response.json();

      if (data.success) {
        set({ chatHistory: data.data.chats, isLoadingHistory: false });
      } else {
        set({ isLoadingHistory: false });
      }
    } catch {
      set({ isLoadingHistory: false });
    }
  },

  // ── Send Message (Main streaming function) ──────────────────

  sendMessage: async (message: string, documentId: string) => {
    const { activeChatId } = get();

    // Clear previous errors
    set({ error: null, tokenWarning: null });

    // Add optimistic user message immediately for better UX
    const optimisticUserMessage: ChatMessage = {
      id: `optimistic-${Date.now()}`,
      chatId: activeChatId || "",
      userId: "",
      documentId,
      role: MessageRole.USER,
      content: message,
      citations: null,
      inputTokens: 0,
      outputTokens: 0,
      createdAt: new Date(),
    };

    set((state) => ({
      messages: [...state.messages, optimisticUserMessage],
      streaming: {
        isStreaming: true,
        currentContent: "",
        currentCitations: [],
      },
    }));

    try {
      // ── Send request to chat API ────────────────────────────
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          documentId,
          message,
          chatId: activeChatId || undefined,
        }),
      });

      // Check for non-streaming error responses (4xx, 5xx)
      if (!response.ok) {
        const errorData = await response.json();

        // Handle rate limit specifically
        if (response.status === 429) {
          set({
            streaming: {
              isStreaming: false,
              currentContent: "",
              currentCitations: [],
            },
            error: errorData.error || "Rate limit exceeded",
            tokenWarning: errorData.usage
              ? `You've used ${errorData.usage.used.toLocaleString()} of ${errorData.usage.limit.toLocaleString()} tokens`
              : null,
          });
          // Remove optimistic message on error
          set((state) => ({
            messages: state.messages.filter(
              (m) => m.id !== optimisticUserMessage.id,
            ),
          }));
          return;
        }

        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      // ── Extract chat ID from response headers ───────────────
      const newChatId = response.headers.get("X-Chat-Id");
      const tokensRemaining = response.headers.get("X-Tokens-Remaining");

      if (newChatId && newChatId !== activeChatId) {
        set({ activeChatId: newChatId });
        // Update URL without page reload
        window.history.replaceState(
          {},
          "",
          `/chat?chatId=${newChatId}&documentId=${documentId}`,
        );
      }

      // Warn if tokens are running low
      if (tokensRemaining && parseInt(tokensRemaining) < 5000) {
        set({
          tokenWarning: `Low token balance: ${parseInt(tokensRemaining).toLocaleString()} tokens remaining`,
        });
      }

      // ── Read the stream ─────────────────────────────────────
      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // Variables to accumulate the full assistant response
      let assistantContent = "";
      let assistantCitations: Citation[] = [];
      let finalMessageId = "";
      let finalInputTokens = 0;
      let finalOutputTokens = 0;

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete lines (each JSON object is on its own line)
        const lines = buffer.split("\n");
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const chunk: StreamChunk = JSON.parse(trimmed);

            switch (chunk.type) {
              case "token":
                // Append token to streaming content
                if (chunk.content) {
                  assistantContent += chunk.content;
                  set((state) => ({
                    streaming: {
                      ...state.streaming,
                      currentContent: assistantContent,
                    },
                  }));
                }
                break;

              case "citations":
                // Store citations (displayed after stream completes)
                if (chunk.citations) {
                  assistantCitations = chunk.citations;
                  set((state) => ({
                    streaming: {
                      ...state.streaming,
                      currentCitations: chunk.citations!,
                    },
                  }));
                }
                break;

              case "done":
                // Stream complete — finalize state
                finalMessageId = chunk.messageId || "";
                finalInputTokens = chunk.usage?.inputTokens || 0;
                finalOutputTokens = chunk.usage?.outputTokens || 0;
                break;

              case "error":
                throw new Error(chunk.error || "Stream error");
            }
          } catch {
            // Skip malformed JSON lines
            console.warn("[Chat] Failed to parse stream chunk:", trimmed);
          }
        }
      }

      // ── Finalize: Add assistant message to messages array ───
      const assistantMessage: ChatMessage = {
        id: finalMessageId || `assistant-${Date.now()}`,
        chatId: get().activeChatId || "",
        userId: "",
        documentId,
        role: MessageRole.ASSISTANT,
        content: assistantContent,
        citations: assistantCitations.length > 0 ? assistantCitations : null,
        inputTokens: finalInputTokens,
        outputTokens: finalOutputTokens,
        createdAt: new Date(),
      };

      set((state) => ({
        messages: [...state.messages, assistantMessage],
        streaming: {
          isStreaming: false,
          currentContent: "",
          currentCitations: [],
        },
      }));

      // ── Refresh chat history sidebar ────────────────────────
      get().loadChatHistory(documentId);

      // Pull fresh usage totals from the server so the dashboard/sidebar stay in sync.
      await useAuthStore.getState().checkAuth();
    } catch (error) {
      console.error("[ChatStore] sendMessage error:", error);

      // Remove optimistic user message
      set((state) => ({
        messages: state.messages.filter(
          (m) => m.id !== optimisticUserMessage.id,
        ),
        streaming: {
          isStreaming: false,
          currentContent: "",
          currentCitations: [],
        },
        error:
          error instanceof Error
            ? error.message
            : "Failed to send message. Please try again.",
      }));
    }
  },
}));
