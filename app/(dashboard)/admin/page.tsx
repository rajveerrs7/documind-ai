// ─────────────────────────────────────────────────────────────────────────────
// Admin Dashboard Page
//
// Full platform overview for admin users.
// Fetches stats from /api/admin/stats and displays:
//   - Stats cards
//   - Usage charts (Recharts)
//   - Recent documents table
//   - Top users table
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth-store";
import { StatsCards } from "@/components/admin/stats-cards";
import { UsageCharts } from "@/components/admin/usage-charts";
import { RecentDocumentsTable } from "@/components/admin/recent-documents-table";
import { TopUsersTable } from "@/components/admin/top-users-table";
import type { AdminStats } from "@/types";

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // ── Auth guard for admin ───────────────────────────────────
  useEffect(() => {
    if (user && user.role !== "ADMIN") {
      router.push("/dashboard");
    }
  }, [user, router]);

  // ── Fetch stats ────────────────────────────────────────────
  const fetchStats = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);

    try {
      const url = forceRefresh
        ? "/api/admin/stats?refresh=true"
        : "/api/admin/stats";

      const response = await fetch(url, { credentials: "include" });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || "Failed to load admin stats");
        return;
      }

      setStats(data.data);
      setLastUpdated(new Date());
    } catch {
      setError("Network error while loading stats");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // ── Guard: Not admin ───────────────────────────────────────
  if (user?.role !== "ADMIN") {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Admin Dashboard
          </h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Platform-wide metrics and activity overview
          </p>
          {lastUpdated && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>

        <button
          onClick={() => fetchStats(true)}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700
            bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300
            hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg
            className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-red-500 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            <button
              onClick={() => fetchStats()}
              className="ml-auto text-sm text-red-600 dark:text-red-400 hover:underline"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && !stats && (
        <div className="space-y-6">
          {/* Stats cards skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 animate-pulse"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-3" />
                    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-2" />
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32" />
                  </div>
                  <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-xl" />
                </div>
              </div>
            ))}
          </div>

          {/* Charts skeleton */}
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 animate-pulse"
            >
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-2" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-64 mb-6" />
              <div className="h-64 bg-gray-100 dark:bg-gray-700 rounded-lg" />
            </div>
          ))}
        </div>
      )}

      {/* Actual Content */}
      {stats && (
        <div className="space-y-8">
          {/* Stats Cards */}
          <StatsCards stats={stats} />

          {/* Charts */}
          <UsageCharts stats={stats} />

          {/* Bottom Grid: Recent Docs + Top Users */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <RecentDocumentsTable documents={stats.recentDocuments} />
            <TopUsersTable users={stats.topUsers || []} />
          </div>
        </div>
      )}
    </div>
  );
}
