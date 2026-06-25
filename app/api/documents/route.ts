// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/documents   — List user's documents
// DELETE /api/documents — Delete a document
//
// Multi-tenant: All queries filtered by userId from JWT
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { PaginationSchema } from "@/lib/validators";
import type { ApiResponse } from "@/types";

// ── GET /api/documents ────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const userId = request.headers.get("x-user-id");

  if (!userId) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Authentication required" },
      { status: 401 },
    );
  }

  // Parse pagination params
  const { searchParams } = new URL(request.url);
  const paginationResult = PaginationSchema.safeParse({
    page: searchParams.get("page"),
    limit: searchParams.get("limit"),
  });

  const { page, limit } = paginationResult.success
    ? paginationResult.data
    : { page: 1, limit: 10 };

  const skip = (page - 1) * limit;

  try {
    // Fetch documents with total count
    // TENANT ISOLATION: where.userId = userId
    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where: { userId }, // ← critical multi-tenant filter
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          filename: true,
          fileSize: true,
          status: true,
          pageCount: true,
          chunkCount: true,
          errorMessage: true,
          createdAt: true,
          updatedAt: true,
          // Include chat count for this document
          _count: {
            select: { chats: true },
          },
        },
      }),
      prisma.document.count({
        where: { userId },
      }),
    ]);

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: {
          documents,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasNextPage: skip + limit < total,
            hasPrevPage: page > 1,
          },
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[Documents/GET] Error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Failed to fetch documents" },
      { status: 500 },
    );
  }
}
