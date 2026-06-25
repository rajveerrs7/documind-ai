// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me
//
// Returns the currently authenticated user's profile.
// Used by the frontend to:
//   - Verify authentication state on load
//   - Get user details (name, role, usage stats)
//   - Refresh user data after profile updates
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { requireAuth } from "@/lib/auth";
import type { ApiResponse } from "@/types";

export async function GET(request: NextRequest) {
  try {
    // ── Require authentication ─────────────────────────────────
    const authUser = await requireAuth(request);

    // ── Fetch full user profile from DB ────────────────────────
    // JWT only contains userId, email, role
    // We fetch name, usage stats, document count from DB
    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        // Count documents
        _count: {
          select: {
            documents: true,
            chats: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

    // ── Get current month's token usage ────────────────────────
    const currentMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"

    const monthlyUsage = await prisma.usage.aggregate({
      where: {
        userId: authUser.id,
        month: currentMonth,
      },
      _sum: {
        totalTokens: true,
        inputTokens: true,
        outputTokens: true,
      },
    });

    const tokenLimit = parseInt(
      process.env.FREE_TIER_MONTHLY_TOKEN_LIMIT || "50000",
    );
    const totalUsed = monthlyUsage._sum.totalTokens || 0;

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            createdAt: user.createdAt,
            documentCount: user._count.documents,
            chatCount: user._count.chats,
          },
          usage: {
            month: currentMonth,
            inputTokens: monthlyUsage._sum.inputTokens || 0,
            outputTokens: monthlyUsage._sum.outputTokens || 0,
            totalTokens: totalUsed,
            limit: tokenLimit,
            percentUsed: Math.min(100, (totalUsed / tokenLimit) * 100),
            remainingTokens: Math.max(0, tokenLimit - totalUsed),
          },
        },
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("Authentication")) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: error.message },
        { status: 401 },
      );
    }

    console.error("[Auth/Me] Error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Failed to fetch user profile" },
      { status: 500 },
    );
  }
}
