// ─────────────────────────────────────────────────────────────────────────────
// Recent Documents Table — Admin View
//
// Shows the most recently uploaded documents across all users.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import type { AdminStats } from "@/types";
import { DocumentStatus } from "@prisma/client";

interface RecentDocumentsTableProps {
  documents: AdminStats["recentDocuments"];
}

const STATUS_BADGES: Record<
  DocumentStatus,
  { label: string; className: string }
> = {
  PENDING: {
    label: "Pending",
    className:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  PROCESSING: {
    label: "Processing",
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  READY: {
    label: "Ready",
    className:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  FAILED: {
    label: "Failed",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export function RecentDocumentsTable({ documents }: RecentDocumentsTableProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          Recent Documents
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Latest uploads across all users
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Document
              </th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                User
              </th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Size
              </th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Pages
              </th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Status
              </th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Date
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
            {documents.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-8 text-center text-gray-400 dark:text-gray-500"
                >
                  No documents yet
                </td>
              </tr>
            ) : (
              documents.map((doc) => {
                const statusBadge = STATUS_BADGES[doc.status];
                return (
                  <tr
                    key={doc.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    {/* Document name */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                          <svg
                            className="w-3.5 h-3.5 text-red-500"
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
                        <span
                          className="text-gray-900 dark:text-white font-medium truncate max-w-[180px]"
                          title={doc.filename}
                        >
                          {doc.filename}
                        </span>
                      </div>
                    </td>

                    {/* User */}
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-gray-900 dark:text-white font-medium">
                          {doc.user?.name || "—"}
                        </p>
                        <p className="text-gray-400 dark:text-gray-500 text-xs truncate max-w-[150px]">
                          {doc.user?.email}
                        </p>
                      </div>
                    </td>

                    {/* Size */}
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                      {formatBytes(doc.fileSize)}
                    </td>

                    {/* Pages */}
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                      {doc.pageCount ?? "—"}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge.className}`}
                      >
                        {statusBadge.label}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">
                      {new Date(doc.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
