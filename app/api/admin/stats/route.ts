// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/stats
//
// Returns aggregated platform statistics for the admin dashboard.
//
// Security: Requires ADMIN role (enforced in middleware + route handler)
//
// Data returned:
//   - Total users, documents, chats, messages
//   - Total tokens used (all time + by month)
//   - Total embeddings in pgvector
//   - Monthly usage breakdown (last 6 months) for charts
//   - Recent documents with user info
//   - Per-user breakdown
//
// Caching: Results cached in Redis for 5 minutes to avoid
// expensive aggregation queries on every page load.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { requireAdmin } from "@/lib/auth";
import { AuthError } from "@/lib/auth";
import { getTotalEmbeddingCount } from "@/lib/langchain";
import {
  getCachedAdminStats,
  cacheAdminStats,
  invalidateAdminStatsCache,
} from "@/lib/redis";
import type { ApiResponse, AdminStats } from "@/types";

// ── Helper: Generate last N months ────────────────────────────────────────────

function getLastNMonths(n: number): string[] {
  const months: string[] = [];
  const now = new Date();

  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toISOString().slice(0, 7)); // "YYYY-MM"
  }

  return months;
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // ── Require admin role ─────────────────────────────────────
  try {
    await requireAdmin(request);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: error.message },
        { status: error.statusCode },
      );
    }
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  // ── Check cache first ──────────────────────────────────────
  const forceRefresh =
    new URL(request.url).searchParams.get("refresh") === "true";

  if (!forceRefresh) {
    const cached = await getCachedAdminStats<AdminStats>();
    if (cached) {
      return NextResponse.json<ApiResponse>(
        {
          success: true,
          data: cached,
          message: "Cached response",
        },
        {
          status: 200,
          headers: { "X-Cache": "HIT" },
        },
      );
    }
  }

  try {
    const last6Months = getLastNMonths(6);

    // ── Run all aggregation queries in parallel ────────────────
    const [
      totalUsers,
      totalDocuments,
      totalChats,
      totalMessages,
      documentsByStatus,
      totalTokensResult,
      monthlyUsageRaw,
      recentDocuments,
      topUsers,
      totalEmbeddings,
    ] = await Promise.all([
      // Total user count
      prisma.user.count(),

      // Total document count
      prisma.document.count(),

      // Total chat count
      prisma.chat.count(),

      // Total message count
      prisma.message.count(),

      // Documents grouped by status
      prisma.document.groupBy({
        by: ["status"],
        _count: { id: true },
      }),

      // All-time token usage
      prisma.usage.aggregate({
        _sum: {
          totalTokens: true,
          inputTokens: true,
          outputTokens: true,
        },
      }),

      // Monthly usage for last 6 months
      prisma.usage.groupBy({
        by: ["month"],
        where: {
          month: { in: last6Months },
        },
        _sum: {
          totalTokens: true,
          inputTokens: true,
          outputTokens: true,
        },
        _count: { id: true },
        orderBy: { month: "asc" },
      }),

      // Recent documents with user info
      prisma.document.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
            },
          },
        },
      }),

      // Top users by token usage this month
      prisma.usage.groupBy({
        by: ["userId"],
        where: {
          month: new Date().toISOString().slice(0, 7),
        },
        _sum: { totalTokens: true },
        orderBy: {
          _sum: { totalTokens: "desc" },
        },
        take: 10,
      }),

      // Total embeddings in pgvector
      getTotalEmbeddingCount(),
    ]);

    // ── Fetch user details for top users ──────────────────────
    const topUserIds = topUsers.map((u) => u.userId);
    const topUserDetails = await prisma.user.findMany({
      where: { id: { in: topUserIds } },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            documents: true,
            chats: true,
          },
        },
      },
    });

    // ── Monthly usage with new user count ─────────────────────
    const monthlyNewUsers = await Promise.all(
      last6Months.map(async (month) => {
        const [year, m] = month.split("-").map(Number);
        const startDate = new Date(year, m - 1, 1);
        const endDate = new Date(year, m, 1);

        const count = await prisma.user.count({
          where: {
            createdAt: {
              gte: startDate,
              lt: endDate,
            },
          },
        });

        return { month, newUsers: count };
      }),
    );

    // ── Build monthly usage chart data ─────────────────────────
    const monthlyUsageMap = new Map(monthlyUsageRaw.map((m) => [m.month, m]));

    const newUsersMap = new Map(
      monthlyNewUsers.map((m) => [m.month, m.newUsers]),
    );

    const monthlyUsage = last6Months.map((month) => {
      const usage = monthlyUsageMap.get(month);
      return {
        month,
        // Human-readable month label
        label: new Date(month + "-01").toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        }),
        tokens: usage?._sum.totalTokens || 0,
        inputTokens: usage?._sum.inputTokens || 0,
        outputTokens: usage?._sum.outputTokens || 0,
        requests: usage?._count.id || 0,
        // 'users' required by AdminStats type — keep 'newUsers' for clarity
        users: newUsersMap.get(month) || 0,
        newUsers: newUsersMap.get(month) || 0,
      };
    });

    // ── Build documents by status breakdown ────────────────────
    const docStatusBreakdown = documentsByStatus.reduce(
      (acc, item) => {
        acc[item.status] = item._count.id;
        return acc;
      },
      {} as Record<string, number>,
    );

    // ── Build top users with token data ────────────────────────
    const topUsersEnriched = topUsers.map((usage) => {
      const userDetail = topUserDetails.find((u) => u.id === usage.userId);
      return {
        userId: usage.userId,
        email: userDetail?.email || "Unknown",
        name: userDetail?.name || null,
        totalTokens: usage._sum.totalTokens || 0,
        documentCount: userDetail?._count.documents || 0,
        chatCount: userDetail?._count.chats || 0,
      };
    });

    // ── Assemble final stats object ────────────────────────────
    const stats: AdminStats = {
      totalUsers,
      totalDocuments,
      totalChats,
      totalMessages,
      totalTokensUsed: totalTokensResult._sum.totalTokens || 0,
      totalEmbeddings,
      // Document status breakdown
      documentStatus: docStatusBreakdown,
      // Token breakdown
      tokenBreakdown: {
        input: totalTokensResult._sum.inputTokens || 0,
        output: totalTokensResult._sum.outputTokens || 0,
        total: totalTokensResult._sum.totalTokens || 0,
      },
      // Chart data
      monthlyUsage,
      // Recent activity
      recentDocuments: recentDocuments.map((doc) => ({
        ...doc,
        user: doc.user as unknown as import("@/types").AuthUser,
      })),
      // Top users this month
      topUsers: topUsersEnriched,
      // Summary for current month
      currentMonth: {
        month: new Date().toISOString().slice(0, 7),
        tokens: monthlyUsage[monthlyUsage.length - 1]?.tokens || 0,
        requests: monthlyUsage[monthlyUsage.length - 1]?.requests || 0,
        newUsers: monthlyUsage[monthlyUsage.length - 1]?.newUsers || 0,
      },
    };

    // ── Cache the result ───────────────────────────────────────
    await cacheAdminStats(stats);

    return NextResponse.json<ApiResponse>(
      { success: true, data: stats },
      {
        status: 200,
        headers: { "X-Cache": "MISS" },
      },
    );
  } catch (error) {
    console.error("[Admin/Stats] Error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Failed to fetch admin statistics" },
      { status: 500 },
    );
  }
}

// ── DELETE: Cache invalidation ────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: error.message },
        { status: error.statusCode },
      );
    }
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  await invalidateAdminStatsCache();

  return NextResponse.json<ApiResponse>(
    { success: true, message: "Admin stats cache cleared" },
    { status: 200 },
  );
}
