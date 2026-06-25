// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/users
//
// Returns paginated list of all users with their usage stats.
// Admin only.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { requireAdmin, AuthError } from "@/lib/auth";
import { PaginationSchema } from "@/lib/validators";
import type { ApiResponse } from "@/types";

export async function GET(request: NextRequest) {
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

  const { searchParams } = new URL(request.url);
  const paginationResult = PaginationSchema.safeParse({
    page: searchParams.get("page"),
    limit: searchParams.get("limit"),
  });

  const { page, limit } = paginationResult.success
    ? paginationResult.data
    : { page: 1, limit: 20 };

  const skip = (page - 1) * limit;
  const currentMonth = new Date().toISOString().slice(0, 7);

  try {
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
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
              usages: true,
            },
          },
        },
      }),
      prisma.user.count(),
    ]);

    // Get monthly token usage for each user
    const userIds = users.map((u) => u.id);
    const monthlyUsages = await prisma.usage.groupBy({
      by: ["userId"],
      where: {
        userId: { in: userIds },
        month: currentMonth,
      },
      _sum: { totalTokens: true },
    });

    const usageMap = new Map(
      monthlyUsages.map((u) => [u.userId, u._sum.totalTokens || 0]),
    );

    const enrichedUsers = users.map((user) => ({
      ...user,
      monthlyTokens: usageMap.get(user.id) || 0,
    }));

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: {
          users: enrichedUsers,
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
    console.error("[Admin/Users] Error:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Failed to fetch users" },
      { status: 500 },
    );
  }
}
