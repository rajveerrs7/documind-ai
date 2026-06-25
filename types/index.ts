// ─────────────────────────────────────────────────────────────────────────────
// DocuMind AI — Global TypeScript Types
//
// Shared types used across frontend and backend.
// Keeps things consistent and avoids duplication.
// ─────────────────────────────────────────────────────────────────────────────

import type { Role, DocumentStatus, MessageRole } from "@prisma/client";

// ── Re-export Prisma enums for convenience ───────────────────
export type { Role, DocumentStatus, MessageRole };

// ── API Response Wrapper ─────────────────────────────────────
// All API routes return this shape for consistency
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ── JWT Payload ──────────────────────────────────────────────
// What we store inside the JWT token
export interface JWTPayload {
  userId: string;
  email: string;
  role: Role;
  iat?: number;
  exp?: number;
}

// ── Authenticated User (from JWT) ────────────────────────────
export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
}

// ── Document ─────────────────────────────────────────────────
export interface DocumentMeta {
  id: string;
  userId: string;
  filename: string;
  storagePath: string;
  fileSize: number;
  mimeType: string;
  status: DocumentStatus;
  pageCount: number | null;
  chunkCount: number | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ── Chat ─────────────────────────────────────────────────────
export interface ChatSession {
  id: string;
  userId: string;
  documentId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  document?: DocumentMeta;
  messages?: ChatMessage[];
}

// ── Message ──────────────────────────────────────────────────
export interface ChatMessage {
  id: string;
  chatId: string;
  userId: string;
  documentId: string;
  role: MessageRole;
  content: string;
  citations: Citation[] | null;
  inputTokens: number;
  outputTokens: number;
  createdAt: Date;
}

// ── Citation ─────────────────────────────────────────────────
// Returned with assistant messages to show source context
export interface Citation {
  // Page number in the original PDF (1-indexed for display)
  page: number;
  // Excerpt of the chunk used as context
  text: string;
  // Cosine similarity score (0-1, higher = more relevant)
  score: number;
  // Original filename
  filename: string;
  // Chunk position for reference
  chunkIndex: number;
}

// ── Usage ────────────────────────────────────────────────────
export interface UsageStats {
  userId: string;
  month: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  // Percentage of free tier limit consumed
  percentUsed: number;
  remainingTokens: number;
}

// ── Upload Response ──────────────────────────────────────────
export interface UploadResponse {
  documentId: string;
  filename: string;
  status: DocumentStatus;
  pageCount: number;
  chunkCount: number;
}

// ── Chat Request ─────────────────────────────────────────────
export interface ChatRequest {
  chatId?: string; // Omit to create new chat
  documentId: string;
  message: string;
}

// ── Streaming Chat Chunk ─────────────────────────────────────
// Each chunk sent over the stream
export interface StreamChunk {
  type: "token" | "citations" | "error" | "done";
  content?: string;
  citations?: Citation[];
  error?: string;
  messageId?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

// ── Admin Stats ──────────────────────────────────────────────
// ── Add to existing types/index.ts ───────────────────────────────────────────
// (Add these interfaces to the file created in Step 1)

// ── Extended Admin Stats ──────────────────────────────────────────────────────
export interface AdminStats {
  totalUsers: number;
  totalDocuments: number;
  totalChats: number;
  totalMessages: number;
  totalTokensUsed: number;
  totalEmbeddings: number;
  documentStatus?: Record<string, number>;
  tokenBreakdown?: {
    input: number;
    output: number;
    total: number;
  };
  monthlyUsage: Array<{
    month: string;
    label: string;
    tokens: number;
    inputTokens: number;
    outputTokens: number;
    requests: number;
    newUsers: number;
  }>;
  recentDocuments: Array<DocumentMeta & { user: AuthUser }>;
  topUsers?: Array<{
    userId: string;
    email: string;
    name: string | null;
    totalTokens: number;
    documentCount: number;
    chatCount: number;
  }>;
  currentMonth?: {
    month: string;
    tokens: number;
    requests: number;
    newUsers: number;
  };
}

// ── Rate Limit Info ──────────────────────────────────────────
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
}

// ── Vector Store Document ────────────────────────────────────
// Metadata stored alongside each embedding in PGVector
export interface VectorMetadata {
  userId: string;
  documentId: string;
  filename: string;
  page: number;
  chunkIndex: number;
  totalChunks: number;
}
