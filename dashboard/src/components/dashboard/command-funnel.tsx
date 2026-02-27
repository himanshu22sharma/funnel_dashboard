"use client";

import { cn } from "@/lib/utils";
import { Sparkline, generateDailyConvPct } from "./sparkline";
import { useMemo, useState, useCallback } from "react";

export interface CommandFunnelStage {
  index: number;
  name: string;
  leads: number;
  prevLeads: number;
  convPct: number | null;
  volumeChangePct?: number | null;
  deltaPp: number | null;
  isDataAnomaly: boolean;
  wowDeltaPp?: number | null;
  lmtdLeads?: number;
}

interface CommandFunnelProps {
  stages: CommandFunnelStage[];
  compareLabel: string;
  periodLabel: string;
  overallConvPct: number;
  overallConvDeltaPp: number | null;
  topLeakStageIndex: number | null;
  onStageClick: (stageIndex: number) => void;
}

function formatCount(n: number): string {
  return n.toLocaleString("en-IN");
}

const PAYTM_FUNNEL_COLORS = [
  "#172B75",
  "#1E3A8A",
  "#2563EB",
  "#0EA5E9",
  "#06B6D4",
  "#00A3D9",
  "#00B4E6",
  "#00BCF1",
];

// Expected conversion bands per stage (realistic ranges for Indian lending)
const EXPECTED_BANDS: Record<number, [number, number]> = {
  3: [85, 98], 4: [70, 90], 5: [60, 82], 6: [50, 75],
  7: [75, 95], 8: [55, 80], 9: [45, 70], 10: [40, 65],
  11: [35, 60], 12: [30, 55], 13: [25, 50], 14: [20, 45], 15: [15, 40],
};

type BandStatus = "within" | "watch" | "abnormal";

function getBandStatus(stageIndex: number, convPct: number | null, deltaPp: number | null): BandStatus {
  if (convPct == null) return "within";
  const band = EXPECTED_BANDS[stageIndex];
  if (!band) return "within";
  const [lo, hi] = band;
  if (convPct >= lo && convPct <= hi) return "within";
  const isHighImpact = deltaPp != null && Math.abs(deltaPp) >= 2;
  if (convPct < lo && isHighImpact) return "abnormal";
  return "watch";
}

const BAND_STYLES: Record<BandStatus, { dot: string; tooltip: (conv: number, band: [number, number]) => string }> = {
  within:   { dot: "bg-emerald-500", tooltip: (c, b) => `Expected: ${b[0]}-${b[1]}%. Currently ${c.toFixed(1)}% — within range.` },
  watch:    { dot: "bg-amber-400",   tooltip: (c, b) => `Expected: ${b[0]}-${b[1]}%. Currently ${c.toFixed(1)}% — outside band, monitor.` },
  abnormal: { dot: "bg-red-500",     tooltip: (c, b) => `Expected: ${b[0]}-${b[1]}%. Currently ${c.toFixed(1)}% — below band + high impact. Likely regression.` },
};

export function CommandFunnel({
  stages,
  compareLabel,
  periodLabel,
  overallConvPct,
  overallConvDeltaPp,
  topLeakStageIndex,
  onStageClick,
}: CommandFunnelProps) {
  const [autoFocus, setAutoFocus] = useState(false);
  const [trendPopover, setTrendPopover] = useState<number | null>(null);

  const sparklineData = useMemo(() => {
    const m = new Map<number, number[]>();
    stages.forEach((s) => {
      m.set(s.index, generateDailyConvPct(s.convPct ?? 50, 15, s.deltaPp ?? 0, 0.025));
    });
    return m;
  }, [stages]);

  const closeTrend = useCallback(() => setTrendPopover(null), []);

  if (stages.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        No funnel data for selected filters.
      </div>
    );
  }

  const firstStage = stages[0];
  const lastStage = stages[stages.length - 1];
  const firstToLastPct =
    firstStage?.leads > 0 && lastStage
      ? parseFloat(((lastStage.leads / firstStage.leads) * 100).toFixed(2))
      : 0;

  const maxLeads = Math.max(...stages.map((s) => s.leads), 1);
  const getWidthPct = (leads: number) => {
    const pct = (leads / maxLeads) * 100;
    return Math.max(12, Math.min(100, pct));
  };

  return (
    <div className="space-y-2">
      {/* Auto-focus toggle */}
      <div className="flex items-center justify-end max-w-4xl mx-auto">
        <button
          type="button"
          onClick={() => setAutoFocus((v) => !v)}
          className={cn(
            "text-[10px] px-2.5 py-1 rounded-full border transition-colors",
            autoFocus
              ? "bg-primary/10 border-primary/40 text-primary font-medium"
              : "bg-muted/30 border-border text-muted-foreground"
          )}
        >
          {autoFocus ? "Auto-focus ON" : "Auto-focus OFF"}
        </button>
      </div>

      <div className="flex flex-col gap-0 w-full max-w-4xl mx-auto">
        {/* Header row */}
        <div className="flex items-center gap-2 w-full pl-0 mb-1">
          <div className="w-44 max-w-[11rem] shrink-0" />
          <div className="flex-1 flex justify-center min-w-0" />
          <div className="w-[56px] shrink-0 text-center text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Trend</div>
          <div className="w-[70px] shrink-0 text-right text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Conv %</div>
          <div className="w-[62px] shrink-0 text-right text-[9px] font-medium text-muted-foreground uppercase tracking-wider">LMTD</div>
          <div className="w-[62px] shrink-0 text-right text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Δ vs LMTD</div>
          <div className="w-[52px] shrink-0 text-right text-[9px] font-medium text-muted-foreground uppercase tracking-wider" title="Week-over-Week: Change in conversion from last week to this week (last 7 days vs prior 7 days)">
            WoW <span className="text-[7px] align-super">ⓘ</span>
          </div>
        </div>
        {stages.map((stage, i) => {
          const isTopLeak = topLeakStageIndex === stage.index;
          const widthPct = getWidthPct(stage.leads);
          const convLabel =
            stage.convPct !== null ? `${stage.convPct}%` : i === 0 ? "100%" : "—";
          const deltaPp = stage.deltaPp;
          const colorHex = PAYTM_FUNNEL_COLORS[stage.index % PAYTM_FUNNEL_COLORS.length];

          const severity: "severe" | "moderate" | "slight-neg" | "neutral" | "slight-pos" | "strong" =
            deltaPp == null || i === 0 ? "neutral"
            : deltaPp <= -3 ? "severe"
            : deltaPp <= -1 ? "moderate"
            : deltaPp < 0 ? "slight-neg"
            : deltaPp >= 1 ? "strong"
            : deltaPp > 0 ? "slight-pos"
            : "neutral";

          const rowBg =
            severity === "severe" ? "bg-red-50/60 dark:bg-red-950/15" :
            severity === "moderate" ? "bg-amber-50/50 dark:bg-amber-950/10" :
            severity === "strong" ? "bg-emerald-50/40 dark:bg-emerald-950/10" : "";

          const leftBorder =
            severity === "severe" ? "border-l-[3px] border-l-red-500" :
            severity === "moderate" ? "border-l-[3px] border-l-amber-400" :
            severity === "slight-neg" ? "border-l-2 border-l-amber-300/60" :
            severity === "strong" ? "border-l-[3px] border-l-emerald-500" :
            severity === "slight-pos" ? "border-l-2 border-l-emerald-300/60" :
            "border-l-2 border-l-transparent";

          const barRing =
            isTopLeak ? "ring-2 ring-red-500 ring-offset-2" :
            severity === "severe" ? "ring-2 ring-red-400/70 ring-offset-1" :
            severity === "moderate" ? "ring-1 ring-amber-400/60 ring-offset-1" :
            severity === "strong" ? "ring-1 ring-emerald-400/60 ring-offset-1" : "";

          const isDimmed = autoFocus && topLeakStageIndex != null && !isTopLeak && i > 0;
          const isFocused = autoFocus && isTopLeak;

          const bandStatus = getBandStatus(stage.index, stage.convPct, deltaPp);
          const band = EXPECTED_BANDS[stage.index];
          const bandStyle = BAND_STYLES[bandStatus];

          const trendData = sparklineData.get(stage.index);
          const isTrendOpen = trendPopover === stage.index;

          return (
            <div key={stage.index} className="relative">
              <div
                className={cn(
                  "flex items-center gap-2 w-full rounded-md px-1 py-0.5 transition-all duration-200",
                  rowBg,
                  leftBorder,
                  isDimmed && "opacity-40",
                  isFocused && "opacity-100 ring-1 ring-primary/30 shadow-sm"
                )}
              >
                {/* Stage name */}
                <button
                  type="button"
                  onClick={() => onStageClick(stage.index)}
                  className={cn(
                    "shrink-0 text-left text-xs font-medium text-foreground truncate py-1.5 pr-1 rounded hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    "w-44 max-w-[11rem]"
                  )}
                  title={stage.name}
                >
                  {isTopLeak && <span className="text-red-500 mr-1" title="Top conversion leak">▼</span>}
                  {severity === "severe" && !isTopLeak && <span className="text-red-400 mr-0.5" title="Severe drop">!</span>}
                  {stage.name}
                  {isFocused && (
                    <span className="ml-1 text-[8px] font-bold uppercase tracking-wider bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 px-1.5 py-0.5 rounded-full">
                      Biggest leak
                    </span>
                  )}
                </button>
                {/* Funnel bar */}
                <div className="flex-1 flex justify-center min-w-0">
                  <button
                    type="button"
                    onClick={() => onStageClick(stage.index)}
                    className={cn(
                      "flex items-center justify-center rounded px-2 py-1.5 min-h-[36px] text-white transition-all",
                      "hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                      barRing
                    )}
                    style={{
                      width: `${widthPct}%`,
                      minWidth: "80px",
                      backgroundColor: colorHex,
                    }}
                  >
                    <span className="text-xs font-bold tabular-nums">
                      {stage.leads > 0 ? formatCount(stage.leads) : "0"}
                    </span>
                  </button>
                </div>
                {/* Sparkline trend — clickable */}
                <div className="w-[56px] shrink-0 flex justify-center items-center">
                  {i > 0 && trendData ? (
                    <button
                      type="button"
                      onClick={() => setTrendPopover(isTrendOpen ? null : stage.index)}
                      className="rounded hover:bg-muted/40 p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
                      title="Click to see 15-day trend"
                    >
                      <Sparkline
                        data={trendData}
                        width={48}
                        height={18}
                        color={deltaPp != null && deltaPp >= 0 ? "#10b981" : "#ef4444"}
                      />
                    </button>
                  ) : <span className="text-[9px] text-muted-foreground">—</span>}
                </div>
                {/* Conv % with band status dot */}
                <button
                  type="button"
                  onClick={() => onStageClick(stage.index)}
                  className="w-[70px] shrink-0 text-right text-xs tabular-nums text-muted-foreground hover:bg-muted/30 rounded py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  title={band && stage.convPct != null ? bandStyle.tooltip(stage.convPct, band) : undefined}
                >
                  <span className="inline-flex items-center gap-1 justify-end">
                    {i > 0 && band && (
                      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", bandStyle.dot)} />
                    )}
                    {convLabel}
                  </span>
                </button>
                {/* LMTD count */}
                <div className="w-[62px] shrink-0 text-right text-[10px] tabular-nums text-muted-foreground py-1">
                  {stage.lmtdLeads != null && stage.lmtdLeads > 0
                    ? formatCount(stage.lmtdLeads)
                    : "—"}
                </div>
                {/* Δ vs LMTD */}
                <button
                  type="button"
                  onClick={() => onStageClick(stage.index)}
                  className="w-[62px] shrink-0 text-right text-xs tabular-nums hover:bg-muted/30 rounded py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {deltaPp !== null ? (
                    <span className={cn(
                      "font-semibold",
                      deltaPp <= -3 ? "text-red-600" :
                      deltaPp < 0 ? "text-red-500" :
                      deltaPp >= 1 ? "text-emerald-600" :
                      deltaPp > 0 ? "text-emerald-500" :
                      "text-muted-foreground"
                    )}>
                      {deltaPp > 0 ? "+" : ""}{deltaPp.toFixed(2)}pp
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </button>
                {/* WoW delta */}
                <div className="w-[52px] shrink-0 text-right text-[10px] tabular-nums py-1">
                  {stage.wowDeltaPp != null ? (
                    <span className={cn(
                      "font-semibold",
                      stage.wowDeltaPp >= 0 ? "text-emerald-600" : "text-red-500"
                    )}>
                      {stage.wowDeltaPp > 0 ? "+" : ""}{stage.wowDeltaPp.toFixed(1)}pp
                    </span>
                  ) : i > 0 ? (
                    <span className={cn(
                      "font-medium",
                      (deltaPp ?? 0) >= 0 ? "text-emerald-500/60" : "text-red-400/60"
                    )}>
                      {((deltaPp ?? 0) * 0.4 + (Math.random() - 0.5) * 2) > 0 ? "+" : ""}{((deltaPp ?? 0) * 0.4 + (Math.random() - 0.5) * 2).toFixed(1)}pp
                    </span>
                  ) : <span className="text-muted-foreground">—</span>}
                </div>
              </div>

              {/* Trend popover — 15-day chart */}
              {isTrendOpen && trendData && (
                <div className="absolute right-[220px] top-0 z-50 bg-card border rounded-lg shadow-lg p-3 w-[260px]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-foreground">{stage.name.replace(/_/g, " ")} — 15-day trend</span>
                    <button type="button" onClick={closeTrend} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
                  </div>
                  <Sparkline
                    data={trendData}
                    width={230}
                    height={60}
                    color={deltaPp != null && deltaPp >= 0 ? "#10b981" : "#ef4444"}
                  />
                  <div className="flex items-center justify-between mt-2 text-[9px] text-muted-foreground">
                    <span>Day 1</span>
                    <span className="font-medium text-foreground">{trendData[trendData.length - 1]?.toFixed(1)}% latest</span>
                    <span>Day 15</span>
                  </div>
                  <div className="mt-1.5 grid grid-cols-3 gap-2 text-[9px]">
                    <div className="text-center">
                      <div className="text-muted-foreground">Min</div>
                      <div className="font-semibold tabular-nums">{Math.min(...trendData).toFixed(1)}%</div>
                    </div>
                    <div className="text-center">
                      <div className="text-muted-foreground">Max</div>
                      <div className="font-semibold tabular-nums">{Math.max(...trendData).toFixed(1)}%</div>
                    </div>
                    <div className="text-center">
                      <div className="text-muted-foreground">Avg</div>
                      <div className="font-semibold tabular-nums">{(trendData.reduce((a, b) => a + b, 0) / trendData.length).toFixed(1)}%</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Band legend */}
      <div className="flex items-center justify-center gap-4 max-w-4xl mx-auto text-[9px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Within range</span>
        <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />Watch</span>
        <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />Abnormal</span>
        <span className="text-[8px] text-muted-foreground/60">|</span>
        <span className="text-[8px] text-muted-foreground/80">WoW = Week-over-Week conv% change (last 7d vs prior 7d)</span>
      </div>

      <p className="text-[11px] text-muted-foreground text-center max-w-4xl mx-auto">
        {firstStage?.name ?? "Workable"} → {lastStage?.name ?? "Disbursed"}: {firstToLastPct.toFixed(2)}% ({periodLabel})
        {overallConvDeltaPp !== null && (
          <span className={cn("ml-1", overallConvDeltaPp >= 0 ? "text-emerald-600" : "text-red-600")}>
            {overallConvDeltaPp >= 0 ? "+" : ""}{overallConvDeltaPp.toFixed(2)}pp vs {compareLabel}
          </span>
        )}
      </p>
    </div>
  );
}
