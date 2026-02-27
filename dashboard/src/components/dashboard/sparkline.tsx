"use client";

import { cn } from "@/lib/utils";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
  showDot?: boolean;
}

export function Sparkline({
  data,
  width = 60,
  height = 20,
  color = "currentColor",
  className,
  showDot = true,
}: SparklineProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;

  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - 2 * pad);
    const y = height - pad - ((v - min) / range) * (height - 2 * pad);
    return { x, y };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  const last = points[points.length - 1];
  const trend = data[data.length - 1] >= data[0] ? "up" : "down";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("inline-block", className)}
    >
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showDot && last && (
        <circle
          cx={last.x}
          cy={last.y}
          r={2}
          fill={trend === "up" ? "#10b981" : "#ef4444"}
        />
      )}
    </svg>
  );
}

export function TrendBadge({ data, className }: { data: number[]; className?: string }) {
  if (data.length < 2) return null;
  const last7 = data.slice(-7);
  const first = last7[0];
  const latest = last7[last7.length - 1];
  const pctChange = first > 0 ? ((latest - first) / first) * 100 : 0;

  const trend =
    pctChange > 3 ? "up" : pctChange < -3 ? "down" : "flat";

  const icon = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";
  const color =
    trend === "up"
      ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20"
      : trend === "down"
      ? "text-red-600 bg-red-50 dark:bg-red-900/20"
      : "text-gray-500 bg-gray-50 dark:bg-gray-800/30";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[9px] font-semibold px-1 py-0.5 rounded",
        color,
        className
      )}
      title={`7-day trend: ${pctChange > 0 ? "+" : ""}${pctChange.toFixed(1)}%`}
    >
      {icon} {Math.abs(pctChange).toFixed(0)}%
    </span>
  );
}

export function generateDailyData(
  mtd: number,
  daysElapsed: number = 23,
  volatility: number = 0.08
): number[] {
  const daily: number[] = [];
  const avgPerDay = mtd / daysElapsed;
  let cumulative = 0;

  for (let d = 1; d <= daysElapsed; d++) {
    const noise = 1 + (Math.random() - 0.5) * 2 * volatility;
    const growth = 0.98 + (d / daysElapsed) * 0.04;
    const dayCount = avgPerDay * noise * growth;
    cumulative += dayCount;
    daily.push(Math.round(cumulative));
  }

  const scale = mtd / (cumulative || 1);
  return daily.map((v) => Math.round(v * scale));
}

export function generateDailyConvPct(
  basePct: number,
  daysElapsed: number = 23,
  trendDir: number = 0,
  volatility: number = 0.03
): number[] {
  const daily: number[] = [];
  for (let d = 1; d <= daysElapsed; d++) {
    const noise = (Math.random() - 0.5) * 2 * volatility * 100;
    const trend = trendDir * (d / daysElapsed) * 2;
    daily.push(parseFloat(Math.max(0, Math.min(100, basePct + trend + noise)).toFixed(2)));
  }
  return daily;
}
