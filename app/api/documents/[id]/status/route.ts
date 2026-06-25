// ─────────────────────────────────────────────────────────────────────────────
// GET /api/documents/[id]/status
//
// Returns the current processing status of a document.
// Frontend polls this during upload to show a progress indicator.
//
// Checks Redis cache first (fast), falls back to DB.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { getDocumentProcessingStatus } from "@/lib/redis";
import type { ApiResponse } from "@/types";

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
    // Check Redis cache first
    const cachedStatus = await getDocumentProcessingStatus(id);

    if (cachedStatus) {
      return NextResponse.json<ApiResponse>(
        {
          success: true,
          data: {
            documentId: id,
            status: cachedStatus,
            source: "cache",
          },
        },
        {
          status: 200,
          headers: {
            // Allow short caching since this is polled
            "Cache-Control": "no-cache",
          },
        },
      );
    }

    // Fallback to database
    const document = await prisma.document.findFirst({
      where: {
        id,
        userId, // tenant isolation
      },
      select: {
        id: true,
        status: true,
        pageCount: true,
        chunkCount: true,
        errorMessage: true,
        updatedAt: true,
      },
    });

    if (!document) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Document not found" },
        { status: 404 },
      );
    }

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: {
          documentId: document.id,
          status: document.status,
          pageCount: document.pageCount,
          chunkCount: document.chunkCount,
          errorMessage: document.errorMessage,
          updatedAt: document.updatedAt,
          source: "database",
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[Documents/Status] Error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Failed to get document status" },
      { status: 500 },
    );
  }
}
