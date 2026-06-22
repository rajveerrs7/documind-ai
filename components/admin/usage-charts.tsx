// ─────────────────────────────────────────────────────────────────────────────
// Admin Usage Charts
//
// Uses Recharts to visualize:
//   1. Monthly token usage (bar chart)
//   2. Monthly new users (line chart)
//   3. Token breakdown: input vs output (stacked bar)
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import type { AdminStats } from "@/types";

interface UsageChartsProps {
  stats: AdminStats;
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────────

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-900 dark:text-white mb-2">
        {label}
      </p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-600 dark:text-gray-400">
            {entry.name}:
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {entry.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Chart Wrapper ─────────────────────────────────────────────────────────────

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

function ChartCard({ title, subtitle, children }: ChartCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
      <div className="mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
        {subtitle && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function UsageCharts({ stats }: UsageChartsProps) {
  const { monthlyUsage } = stats;

  // Format large numbers for Y axis
  const formatNumber = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value.toString();
  };

  return (
    <div className="space-y-6">
      {/* Token Usage Over Time — Area Chart */}
      <ChartCard
        title="Monthly Token Usage"
        subtitle="Total tokens consumed per month (last 6 months)"
      >
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart
            data={monthlyUsage}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="tokenGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#e5e7eb"
              className="dark:stroke-gray-700"
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatNumber}
              tick={{ fontSize: 12, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="tokens"
              name="Total Tokens"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#tokenGradient)"
              dot={{ fill: "#3b82f6", r: 4 }}
              activeDot={{ r: 6 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Input vs Output Tokens — Stacked Bar Chart */}
      <ChartCard
        title="Input vs Output Tokens"
        subtitle="Token breakdown by type per month"
      >
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={monthlyUsage}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#e5e7eb"
              className="dark:stroke-gray-700"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatNumber}
              tick={{ fontSize: 12, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              iconType="square"
              wrapperStyle={{ fontSize: 12, paddingTop: 16 }}
            />
            <Bar
              dataKey="inputTokens"
              name="Input Tokens"
              fill="#6366f1"
              radius={[0, 0, 0, 0]}
              stackId="tokens"
            />
            <Bar
              dataKey="outputTokens"
              name="Output Tokens"
              fill="#8b5cf6"
              radius={[4, 4, 0, 0]}
              stackId="tokens"
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* New Users + Requests — Dual Line Chart */}
      <ChartCard
        title="Growth & Activity"
        subtitle="New user registrations and chat requests per month"
      >
        <ResponsiveContainer width="100%" height={280}>
          <LineChart
            data={monthlyUsage}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#e5e7eb"
              className="dark:stroke-gray-700"
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              iconType="circle"
              wrapperStyle={{ fontSize: 12, paddingTop: 16 }}
            />
            <Line
              type="monotone"
              dataKey="newUsers"
              name="New Users"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ fill: "#10b981", r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="requests"
              name="Chat Requests"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={{ fill: "#f59e0b", r: 4 }}
              activeDot={{ r: 6 }}
              strokeDasharray="5 5"
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
