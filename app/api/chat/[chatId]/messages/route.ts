// ─────────────────────────────────────────────────────────────────────────────
// GET /api/chat/[chatId]/messages
//
// Returns all messages in a specific chat session.
// Used when loading an existing chat conversation.
//
// TENANT ISOLATION: Verifies chat.userId === authenticated user
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import type { ApiResponse } from "@/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> },
) {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Authentication required" },
      { status: 401 },
    );
  }

  const { chatId } = await params;

  try {
    // Verify chat belongs to user first
    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        userId, // tenant isolation
      },
      include: {
        document: {
          select: {
            id: true,
            filename: true,
            status: true,
            pageCount: true,
          },
        },
      },
    });

    if (!chat) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Chat not found" },
        { status: 404 },
      );
    }

    // Fetch messages in chronological order
    const messages = await prisma.message.findMany({
      where: {
        chatId,
        userId, // belt-and-suspenders tenant check
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        role: true,
        content: true,
        citations: true,
        inputTokens: true,
        outputTokens: true,
        createdAt: true,
      },
    });

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: {
          chat: {
            id: chat.id,
            title: chat.title,
            documentId: chat.documentId,
            document: chat.document,
            createdAt: chat.createdAt,
          },
          messages,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[Chat/Messages] Error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Failed to fetch messages" },
      { status: 500 },
    );
  }
}
