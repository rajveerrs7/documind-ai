// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Home Page
//
// Shows:
//   - Welcome message
//   - Quick stats (documents, chats, token usage)
//   - Recent documents
//   - Quick action buttons
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useDocumentStore } from "@/lib/stores/document-store";
import { DocumentStatus } from "@prisma/client";

export default function DashboardPage() {
  const { user, usage } = useAuthStore();
  const { documents, fetchDocuments } = useDocumentStore();

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const readyDocs = documents.filter((d) => d.status === DocumentStatus.READY);
  const tokenLimit = usage?.limit ?? 50000;
  const tokensUsed = usage?.totalTokens ?? 0;
  const tokensRemaining = usage?.remainingTokens ?? tokenLimit;

  const stats = [
    {
      label: "Documents",
      value: documents.length,
      sublabel: `${readyDocs.length} ready`,
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
      color: "bg-blue-500",
      lightColor: "bg-blue-50 dark:bg-blue-900/20",
      textColor: "text-blue-600 dark:text-blue-400",
    },
    {
      label: "Tokens Used",
      value: tokensUsed.toLocaleString(),
      sublabel: `of ${tokenLimit.toLocaleString()} limit`,
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
      color: "bg-purple-500",
      lightColor: "bg-purple-50 dark:bg-purple-900/20",
      textColor: "text-purple-600 dark:text-purple-400",
    },
    {
      label: "Tokens Remaining",
      value: tokensRemaining.toLocaleString(),
      sublabel: `${Math.round(usage?.percentUsed ?? 0)}% used`,
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
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      ),
      color: "bg-green-500",
      lightColor: "bg-green-50 dark:bg-green-900/20",
      textColor: "text-green-600 dark:text-green-400",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Welcome back,{" "}
          {user?.name?.split(" ")[0] || user?.email?.split("@")[0]} 👋
        </h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          Here&apos;s an overview of your DocuMind workspace
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div
                className={`w-12 h-12 rounded-xl ${stat.lightColor} flex items-center justify-center ${stat.textColor}`}
              >
                {stat.icon}
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stat.value}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {stat.label}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {stat.sublabel}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Link
          href="/documents"
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl p-6 shadow-sm transition-colors group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center group-hover:bg-blue-400 transition-colors">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-lg">Upload Document</p>
              <p className="text-blue-100 text-sm">
                Upload a new PDF to analyze
              </p>
            </div>
          </div>
        </Link>

        <Link
          href="/chat"
          className={`rounded-xl p-6 shadow-sm border transition-colors group ${
            readyDocs.length > 0
              ? "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600"
              : "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-60 cursor-not-allowed pointer-events-none"
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
              <svg
                className="w-6 h-6 text-indigo-600 dark:text-indigo-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white text-lg">
                Chat with Document
              </p>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {readyDocs.length > 0
                  ? `${readyDocs.length} document${readyDocs.length > 1 ? "s" : ""} ready`
                  : "Upload a document first"}
              </p>
            </div>
          </div>
        </Link>
      </div>

      {/* Recent Documents */}
      {documents.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Recent Documents
            </h2>
            <Link
              href="/documents"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
            {documents.slice(0, 5).map((doc, index) => (
              <div
                key={doc.id}
                className={`flex items-center gap-4 p-4 ${
                  index < Math.min(documents.slice(0, 5).length - 1, 4)
                    ? "border-b border-gray-100 dark:border-gray-700"
                    : ""
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-4 h-4 text-red-600 dark:text-red-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {doc.filename}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {doc.pageCount ? `${doc.pageCount} pages` : "Processing..."}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium ${
                    doc.status === "READY"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : doc.status === "PROCESSING"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        : doc.status === "FAILED"
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400"
                  }`}
                >
                  {doc.status}
                </span>
                {doc.status === "READY" && (
                  <Link
                    href={`/chat?documentId=${doc.id}`}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium ml-2"
                  >
                    Chat →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
