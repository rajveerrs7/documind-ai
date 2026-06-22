// ─────────────────────────────────────────────────────────────────────────────
// Top Users Table — Admin View
//
// Shows top users by token consumption this month.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import type { AdminStats } from "@/types";

interface TopUsersTableProps {
  users: NonNullable<AdminStats["topUsers"]>;
}

const TOKEN_LIMIT = parseInt(
  process.env.NEXT_PUBLIC_FREE_TIER_TOKEN_LIMIT || "50000",
);

export function TopUsersTable({ users }: TopUsersTableProps) {
  if (!users || users.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
          Top Users (This Month)
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No usage data yet
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          Top Users by Token Usage
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Current month rankings
        </p>
      </div>

      <div className="divide-y divide-gray-50 dark:divide-gray-700">
        {users.map((user, index) => {
          const usagePercent = Math.min(
            100,
            Math.round((user.totalTokens / TOKEN_LIMIT) * 100),
          );

          const progressColor =
            usagePercent > 80
              ? "bg-red-500"
              : usagePercent > 60
                ? "bg-yellow-500"
                : "bg-blue-500";

          return (
            <div
              key={user.userId}
              className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              {/* Rank badge */}
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  index === 0
                    ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                    : index === 1
                      ? "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                      : index === 2
                        ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                        : "bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-500"
                }`}
              >
                {index + 1}
              </div>

              {/* User info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {user.name || user.email.split("@")[0]}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                      {user.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-4 text-right">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {user.totalTokens.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-400">tokens</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                        {user.documentCount}
                      </p>
                      <p className="text-xs text-gray-400">docs</p>
                    </div>
                  </div>
                </div>

                {/* Usage progress bar */}
                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${progressColor}`}
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {usagePercent}% of monthly limit
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
