// ─────────────────────────────────────────────────────────────────────────────
// GET    /api/documents/[id] — Get a specific document
// DELETE /api/documents/[id] — Delete a document + its embeddings
//
// TENANT SAFETY: All queries verify document.userId === authenticated userId
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { deleteDocumentEmbeddings } from "@/lib/langchain";
import { cacheDelete } from "@/lib/redis";
import type { ApiResponse } from "@/types";
import { unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

// ── GET /api/documents/[id] ───────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Authentication required" },
      { status: 401 },
    );
  }

  const { id } = await params;

  try {
    const document = await prisma.document.findFirst({
      where: {
        id,
        userId, // ← tenant isolation: must match authenticated user
      },
      include: {
        _count: {
          select: { chats: true, messages: true },
        },
      },
    });

    if (!document) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Document not found" },
        { status: 404 },
      );
    }

    return NextResponse.json<ApiResponse>(
      { success: true, data: { document } },
      { status: 200 },
    );
  } catch (error) {
    console.error("[Documents/GET/:id] Error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Failed to fetch document" },
      { status: 500 },
    );
  }
}

// ── DELETE /api/documents/[id] ────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Authentication required" },
      { status: 401 },
    );
  }

  const { id } = await params;

  try {
    // Verify document belongs to this user BEFORE deletion
    const document = await prisma.document.findFirst({
      where: {
        id,
        userId, // ← tenant isolation
      },
    });

    if (!document) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Document not found" },
        { status: 404 },
      );
    }

    // ── Delete in correct order ───────────────────────────
    // 1. Delete vector embeddings from pgvector
    //    (must happen before Prisma cascades delete document record)
    try {
      await deleteDocumentEmbeddings(id, userId);
    } catch (embeddingError) {
      // Log but don't fail — continue with DB deletion
      console.error(
        "[Documents/DELETE] Failed to delete embeddings:",
        embeddingError,
      );
    }

    // 2. Delete from Prisma (cascades to chats, messages)
    await prisma.document.delete({
      where: { id },
    });

    // 3. Delete physical file from disk
    const absolutePath = path.join(
      process.cwd(),
      "public",
      document.storagePath,
    );

    if (existsSync(absolutePath)) {
      try {
        await unlink(absolutePath);
        console.log(`[Documents/DELETE] File deleted: ${document.storagePath}`);
      } catch (fileError) {
        // Log but don't fail the request
        console.error("[Documents/DELETE] Failed to delete file:", fileError);
      }
    }

    // 4. Clear any cached status
    await cacheDelete(`doc:status:${id}`);

    console.log(`[Documents/DELETE] Document ${id} deleted by user ${userId}`);

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        message: "Document deleted successfully",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[Documents/DELETE] Error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Failed to delete document" },
      { status: 500 },
    );
  }
}
