// ─────────────────────────────────────────────────────────────────────────────
// Admin Stats Cards
//
// Displays top-level platform metrics in a grid of cards.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import type { AdminStats } from "@/types";

interface StatsCardsProps {
  stats: AdminStats;
}

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    label: string;
    positive: boolean;
  };
  colorClass: string;
  bgClass: string;
}

function StatCard({
  label,
  value,
  subValue,
  icon,
  trend,
  colorClass,
  bgClass,
}: StatCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
            {label}
          </p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {subValue && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {subValue}
            </p>
          )}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <svg
                className={`w-4 h-4 ${trend.positive ? "text-green-500" : "text-red-500"}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={
                    trend.positive
                      ? "M5 10l7-7m0 0l7 7m-7-7v18"
                      : "M19 14l-7 7m0 0l-7-7m7 7V3"
                  }
                />
              </svg>
              <span
                className={`text-sm font-medium ${
                  trend.positive ? "text-green-600" : "text-red-600"
                }`}
              >
                {trend.value}
              </span>
              <span className="text-sm text-gray-400">{trend.label}</span>
            </div>
          )}
        </div>
        <div
          className={`w-12 h-12 rounded-xl ${bgClass} flex items-center justify-center flex-shrink-0`}
        >
          <div className={colorClass}>{icon}</div>
        </div>
      </div>
    </div>
  );
}

export function StatsCards({ stats }: StatsCardsProps) {
  const currentMonthTokens = stats.currentMonth?.tokens || 0;
  const currentMonthUsers = stats.currentMonth?.newUsers || 0;
  const currentMonthRequests = stats.currentMonth?.requests || 0;

  const cards: StatCardProps[] = [
    {
      label: "Total Users",
      value: stats.totalUsers,
      subValue: `+${currentMonthUsers} this month`,
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      ),
      colorClass: "text-blue-600 dark:text-blue-400",
      bgClass: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      label: "Total Documents",
      value: stats.totalDocuments,
      subValue: `${stats.documentStatus?.["READY"] || 0} ready, ${stats.documentStatus?.["FAILED"] || 0} failed`,
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
      colorClass: "text-indigo-600 dark:text-indigo-400",
      bgClass: "bg-indigo-50 dark:bg-indigo-900/20",
    },
    {
      label: "Total Embeddings",
      value: stats.totalEmbeddings,
      subValue: "Vectors in pgvector",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
          />
        </svg>
      ),
      colorClass: "text-purple-600 dark:text-purple-400",
      bgClass: "bg-purple-50 dark:bg-purple-900/20",
    },
    {
      label: "Total Tokens Used",
      value: stats.totalTokensUsed.toLocaleString(),
      subValue: `${currentMonthTokens.toLocaleString()} this month`,
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      ),
      colorClass: "text-yellow-600 dark:text-yellow-400",
      bgClass: "bg-yellow-50 dark:bg-yellow-900/20",
    },
    {
      label: "Total Chats",
      value: stats.totalChats,
      subValue: `${currentMonthRequests} requests this month`,
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      ),
      colorClass: "text-green-600 dark:text-green-400",
      bgClass: "bg-green-50 dark:bg-green-900/20",
    },
    {
      label: "Total Messages",
      value: stats.totalMessages,
      subValue: `Input: ${(stats.tokenBreakdown?.input || 0).toLocaleString()} · Output: ${(stats.tokenBreakdown?.output || 0).toLocaleString()}`,
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
          />
        </svg>
      ),
      colorClass: "text-pink-600 dark:text-pink-400",
      bgClass: "bg-pink-50 dark:bg-pink-900/20",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((card) => (
        <StatCard key={card.label} {...card} />
      ))}
    </div>
  );
}
