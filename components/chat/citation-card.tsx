// ─────────────────────────────────────────────────────────────────────────────
// Citation Card Component
//
// Displays a single citation from the RAG pipeline.
// Shows: page number, relevance score, text excerpt, filename
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useState } from "react";
import type { Citation } from "@/types";

interface CitationCardProps {
  citation: Citation;
  index: number;
}

export function CitationCard({ citation, index }: CitationCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Convert score to percentage and color
  const scorePercent = Math.round(citation.score * 100);
  const scoreColor =
    scorePercent >= 80
      ? "text-green-600 dark:text-green-400"
      : scorePercent >= 60
        ? "text-yellow-600 dark:text-yellow-400"
        : "text-gray-500 dark:text-gray-400";

  const scoreBg =
    scorePercent >= 80
      ? "bg-green-100 dark:bg-green-900/30"
      : scorePercent >= 60
        ? "bg-yellow-100 dark:bg-yellow-900/30"
        : "bg-gray-100 dark:bg-gray-700";

  return (
    <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden text-xs">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          {/* Citation number */}
          <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
            {index + 1}
          </span>
          {/* Page number */}
          <span className="font-medium text-gray-700 dark:text-gray-300">
            Page {citation.page}
          </span>
          {/* Filename (truncated) */}
          <span className="text-gray-400 dark:text-gray-500 truncate max-w-[120px]">
            {citation.filename}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Relevance score */}
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${scoreBg} ${scoreColor}`}
          >
            {scorePercent}% match
          </span>
          {/* Expand/collapse arrow */}
          <svg
            className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {/* Expanded text */}
      {isExpanded && (
        <div className="p-2.5 border-t border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            &ldquo;{citation.text}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}

// ── Citations List Component ──────────────────────────────────────────────────

interface CitationsListProps {
  citations: Citation[];
}

export function CitationsList({ citations }: CitationsListProps) {
  const [isVisible, setIsVisible] = useState(false);

  if (!citations || citations.length === 0) return null;

  return (
    <div className="mt-3">
      {/* Toggle button */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors font-medium"
      >
        <svg
          className="w-3.5 h-3.5"
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
        {isVisible ? "Hide" : "Show"} {citations.length} source
        {citations.length !== 1 ? "s" : ""}
        <svg
          className={`w-3 h-3 transition-transform ${isVisible ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Citations list */}
      {isVisible && (
        <div className="mt-2 space-y-1.5 animate-fade-in">
          {citations.map((citation, index) => (
            <CitationCard key={index} citation={citation} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}
