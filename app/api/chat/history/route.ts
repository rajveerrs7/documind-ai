// ─────────────────────────────────────────────────────────────────────────────
// GET /api/chat/history
//
// Returns chat sessions for the authenticated user.
// Supports filtering by documentId.
//
// Query params:
//   - documentId: filter chats for a specific document
//   - page, limit: pagination
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import type { ApiResponse } from "@/types";

export async function GET(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Authentication required" },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get("documentId");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(50, parseInt(searchParams.get("limit") || "20"));
  const skip = (page - 1) * limit;

  try {
    // Build where clause — always filter by userId
    const where = {
      userId,
      ...(documentId ? { documentId } : {}),
    };

    const [chats, total] = await Promise.all([
      prisma.chat.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
        include: {
          document: {
            select: {
              id: true,
              filename: true,
              status: true,
            },
          },
          // Include last message for preview
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              content: true,
              role: true,
              createdAt: true,
            },
          },
          _count: {
            select: { messages: true },
          },
        },
      }),
      prisma.chat.count({ where }),
    ]);

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: {
          chats,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[Chat/History] Error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Failed to fetch chat history" },
      { status: 500 },
    );
  }
}
