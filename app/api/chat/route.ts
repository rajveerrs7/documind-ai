// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chat
//
// Core chat endpoint that runs the RAG pipeline and streams the response.
//
// Flow:
//   1. Authenticate user (from middleware headers)
//   2. Validate input (documentId, message, optional chatId)
//   3. Check token usage limit (free tier: 50K tokens/month)
//   4. Rate limit (5 requests/minute per user)
//   5. Verify document belongs to user + is READY
//   6. Create or retrieve chat session
//   7. Save user message to DB
//   8. Run RAG pipeline (retrieve → prompt → Groq stream)
//   9. Stream tokens to frontend via ReadableStream
//  10. After stream: save assistant message + update usage
//
// Streaming Protocol:
//   We use Server-Sent Events (SSE) format over a ReadableStream.
//   Each chunk is a JSON object on its own line:
//     {"type":"token","content":"Hello"}
//     {"type":"citations","citations":[...]}
//     {"type":"done","usage":{...},"messageId":"..."}
//     {"type":"error","error":"Something went wrong"}
//
// This is consumed by the frontend using fetch + ReadableStream API.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { DocumentStatus, MessageRole } from "@prisma/client";
import { runRagPipeline } from "@/lib/langchain/chains";
import { checkRateLimit } from "@/lib/redis";
import { ChatMessageSchema, formatZodError } from "@/lib/validators";
import type { StreamChunk, Citation } from "@/types";

// ── Token limit configuration ─────────────────────────────────────────────────
const FREE_TIER_TOKEN_LIMIT = parseInt(
  process.env.FREE_TIER_MONTHLY_TOKEN_LIMIT || "50000",
);

// ── Helper: Get current month string ──────────────────────────────────────────
function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7); // "YYYY-MM"
}

// ── Helper: Check monthly token usage ─────────────────────────────────────────
async function getMonthlyTokenUsage(userId: string): Promise<number> {
  const month = getCurrentMonth();
  const result = await prisma.usage.aggregate({
    where: { userId, month },
    _sum: { totalTokens: true },
  });
  return result._sum.totalTokens || 0;
}

// ── Helper: Record token usage ────────────────────────────────────────────────
async function recordTokenUsage(
  userId: string,
  inputTokens: number,
  outputTokens: number,
): Promise<void> {
  const month = getCurrentMonth();
  const totalTokens = inputTokens + outputTokens;

  // We create one record per request for granular tracking
  // The admin dashboard aggregates these
  await prisma.usage.create({
    data: {
      userId,
      month,
      inputTokens,
      outputTokens,
      totalTokens,
      action: "chat",
    },
  });
}

// ── Main Route Handler ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // ── Extract authenticated user ─────────────────────────────
  const userId = request.headers.get("x-user-id");
  const userEmail = request.headers.get("x-user-email");

  if (!userId || !userEmail) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 },
    );
  }

  // ── Parse and validate request body ───────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON in request body" },
      { status: 400 },
    );
  }

  const validationResult = ChatMessageSchema.safeParse(body);
  if (!validationResult.success) {
    return NextResponse.json(
      { success: false, error: formatZodError(validationResult.error) },
      { status: 400 },
    );
  }

  const { documentId, message, chatId } = validationResult.data;

  // ── Rate limiting: 5 requests per minute ──────────────────
  const rateLimit = await checkRateLimit(userId, "chat", 5, 60);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: `Rate limit exceeded. Please wait before sending another message.`,
        retryAfter: rateLimit.resetAt - Math.floor(Date.now() / 1000),
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            rateLimit.resetAt - Math.floor(Date.now() / 1000),
          ),
          "X-RateLimit-Remaining": String(rateLimit.remaining),
          "X-RateLimit-Reset": String(rateLimit.resetAt),
        },
      },
    );
  }

  // ── Check monthly token limit ──────────────────────────────
  const monthlyUsage = await getMonthlyTokenUsage(userId);
  if (monthlyUsage >= FREE_TIER_TOKEN_LIMIT) {
    return NextResponse.json(
      {
        success: false,
        error: `Monthly token limit reached (${FREE_TIER_TOKEN_LIMIT.toLocaleString()} tokens). Your limit resets at the start of next month.`,
        usage: {
          used: monthlyUsage,
          limit: FREE_TIER_TOKEN_LIMIT,
        },
      },
      { status: 429 },
    );
  }

  // ── Verify document exists and belongs to user ─────────────
  // TENANT ISOLATION: documentId + userId must both match
  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      userId, // ← critical: ensures user can only chat with their docs
    },
    select: {
      id: true,
      filename: true,
      status: true,
    },
  });

  if (!document) {
    return NextResponse.json(
      { success: false, error: "Document not found" },
      { status: 404 },
    );
  }

  if (document.status !== DocumentStatus.READY) {
    return NextResponse.json(
      {
        success: false,
        error: `Document is not ready for chat. Current status: ${document.status}. Please wait for processing to complete.`,
      },
      { status: 422 },
    );
  }

  // ── Get or create chat session ─────────────────────────────
  let chat;

  if (chatId) {
    // Retrieve existing chat — verify it belongs to user and document
    chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        userId, // tenant isolation
        documentId, // must match the document in the request
      },
    });

    if (!chat) {
      return NextResponse.json(
        { success: false, error: "Chat session not found" },
        { status: 404 },
      );
    }
  } else {
    // Create new chat session
    // Title is auto-generated from the first message (truncated)
    const autoTitle =
      message.length > 50 ? `${message.slice(0, 47)}...` : message;

    chat = await prisma.chat.create({
      data: {
        userId,
        documentId,
        title: autoTitle,
      },
    });
  }

  // ── Save user message to DB ────────────────────────────────
  const userMessage = await prisma.message.create({
    data: {
      chatId: chat.id,
      userId,
      documentId,
      role: MessageRole.USER,
      content: message,
      citations: undefined,
      inputTokens: 0,
      outputTokens: 0,
    },
  });

  // ── Create streaming response ──────────────────────────────
  // We use a ReadableStream to push chunks to the client as they arrive
  const encoder = new TextEncoder();

  // These will be populated as the stream runs
  let fullResponseText = "";
  let finalCitations: Citation[] = [];
  let finalInputTokens = 0;
  let finalOutputTokens = 0;
  let assistantMessageId = "";

  const stream = new ReadableStream({
    async start(controller) {
      // Helper to send a chunk to the client
      const sendChunk = (chunk: StreamChunk) => {
        try {
          const line = JSON.stringify(chunk) + "\n";
          controller.enqueue(encoder.encode(line));
        } catch {
          // Controller may be closed if client disconnected
        }
      };

      try {
        // ── Run RAG Pipeline ──────────────────────────────────
        console.log(
          `[Chat] Starting RAG for user ${userId}, doc ${documentId}, chat ${chat.id}`,
        );

        const ragResult = await runRagPipeline(message, userId, documentId);

        // ── Stream tokens ─────────────────────────────────────
        for await (const chunk of ragResult.stream) {
          switch (chunk.type) {
            case "token":
              // Accumulate full response for DB storage
              if (chunk.content) {
                fullResponseText += chunk.content;
              }
              // Forward token to client
              sendChunk(chunk);
              break;

            case "citations":
              // Store citations for DB and send to client
              if (chunk.citations) {
                finalCitations = chunk.citations;
              }
              sendChunk(chunk);
              break;

            case "done":
              // Extract final token counts
              if (chunk.usage) {
                finalInputTokens = chunk.usage.inputTokens;
                finalOutputTokens = chunk.usage.outputTokens;
              }
              break;

            case "error":
              // Forward error to client
              sendChunk(chunk);
              console.error(`[Chat] RAG stream error: ${chunk.error}`);
              break;
          }
        }

        // ── Save assistant message to DB ──────────────────────
        const assistantMessage = await prisma.message.create({
          data: {
            chatId: chat.id,
            userId,
            documentId,
            role: MessageRole.ASSISTANT,
            content: fullResponseText,
            // Store citations as JSON
            citations:
              finalCitations.length > 0
                ? (finalCitations as unknown as import("@prisma/client").Prisma.JsonArray)
                : undefined,
            inputTokens: finalInputTokens,
            outputTokens: finalOutputTokens,
          },
        });

        assistantMessageId = assistantMessage.id;

        // ── Update user message token counts ──────────────────
        // Now that we know the actual input tokens, update user message
        await prisma.message.update({
          where: { id: userMessage.id },
          data: { inputTokens: finalInputTokens },
        });

        // ── Record usage ──────────────────────────────────────
        if (finalInputTokens > 0 || finalOutputTokens > 0) {
          await recordTokenUsage(userId, finalInputTokens, finalOutputTokens);
        }

        // ── Send completion signal ────────────────────────────
        sendChunk({
          type: "done",
          messageId: assistantMessageId,
          usage: {
            inputTokens: finalInputTokens,
            outputTokens: finalOutputTokens,
          },
        });

        console.log(
          `[Chat] Complete. Chat: ${chat.id}, ` +
            `Tokens: ${finalInputTokens} in / ${finalOutputTokens} out, ` +
            `Response: ${fullResponseText.length} chars`,
        );
      } catch (error) {
        console.error("[Chat] Stream handler error:", error);

        const errorMessage =
          error instanceof Error
            ? error.message
            : "An unexpected error occurred";

        sendChunk({
          type: "error",
          error: errorMessage,
        });

        // Try to save error state to DB
        try {
          if (fullResponseText.length > 0) {
            // Save partial response if we got some tokens
            await prisma.message.create({
              data: {
                chatId: chat.id,
                userId,
                documentId,
                role: MessageRole.ASSISTANT,
                content: fullResponseText + "\n\n[Response interrupted]",
                citations: undefined,
                inputTokens: finalInputTokens,
                outputTokens: finalOutputTokens,
              },
            });
          }
        } catch (dbError) {
          console.error("[Chat] Failed to save error state:", dbError);
        }
      } finally {
        // Always close the stream
        try {
          controller.close();
        } catch {
          // Already closed
        }
      }
    },
  });

  // Return streaming response with appropriate headers
  return new NextResponse(stream, {
    status: 200,
    headers: {
      // Tell the browser this is a stream of JSON lines
      "Content-Type": "application/x-ndjson",
      // Prevent buffering by proxies/CDNs
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no", // Disable nginx buffering
      // Include chat ID in headers for new chats
      "X-Chat-Id": chat.id,
      // Remaining token budget
      "X-Tokens-Remaining": String(
        Math.max(0, FREE_TIER_TOKEN_LIMIT - monthlyUsage),
      ),
    },
  });
}
