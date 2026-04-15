"use client";

import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";

export interface HeatmapCell {
  lender: string;
  stage: string;
  value: number;
  delta?: number | null;
}

interface HeatmapChartProps {
  lenders: string[];
  stages: string[];
  cells: HeatmapCell[];
  title?: string;
  valueLabel?: string;
  compareLabel?: string;
  onCellClick?: (lender: string, stage: string) => void;
}

/** Mid / light bands need dark foreground; saturated reds & deep greens use light text */
function heatTone(value: number): "dark" | "light" {
  if (value >= 85) return "light";
  if (value >= 40 && value < 85) return "dark";
  return "light";
}

function getHeatBgOnly(value: number): string {
  if (value >= 85) return "bg-emerald-600";
  if (value >= 70) return "bg-emerald-500";
  if (value >= 55) return "bg-emerald-400";
  if (value >= 40) return "bg-amber-400";
  if (value >= 25) return "bg-orange-500";
  if (value >= 10) return "bg-red-500";
  return "bg-red-600";
}

function getMainPctClass(tone: "dark" | "light"): string {
  return tone === "dark"
    ? "text-zinc-950 font-extrabold [text-shadow:none]"
    : "text-white font-extrabold [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]";
}

function getDeltaClass(delta: number | null | undefined, tone: "dark" | "light"): string {
  const base = "text-xs font-bold tabular-nums leading-tight mt-1";
  if (delta == null) {
    return cn(base, tone === "dark" ? "text-zinc-600" : "text-white/80");
  }
  if (tone === "dark") {
    if (delta >= 3) return cn(base, "text-emerald-900");
    if (delta > 0) return cn(base, "text-emerald-800");
    if (delta <= -3) return cn(base, "text-red-900");
    if (delta < 0) return cn(base, "text-red-800");
    return cn(base, "text-zinc-700");
  }
  if (delta >= 3) return cn(base, "text-emerald-100");
  if (delta > 0) return cn(base, "text-emerald-50");
  if (delta <= -3) return cn(base, "text-red-100");
  if (delta < 0) return cn(base, "text-red-50");
  return cn(base, "text-white/85");
}

/** Show ClickHouse `major_stage` verbatim (only trim); no abbreviations that alter wording */
function stageLabelAsInSource(stage: string): string {
  return stage.trim();
}

export function HeatmapChart({
  lenders,
  stages,
  cells,
  title = "Lender × Stage Conversion Heatmap",
  compareLabel = "LMTD",
  onCellClick,
}: HeatmapChartProps) {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [hoveredCol, setHoveredCol] = useState<string | null>(null);

  const cellMap = useMemo(() => {
    const m: Record<string, HeatmapCell> = {};
    cells.forEach((c) => { m[`${c.lender}|${c.stage}`] = c; });
    return m;
  }, [cells]);

  const lenderAvgs = useMemo(() => {
    const m: Record<string, { sum: number; count: number }> = {};
    cells.forEach((c) => {
      if (!m[c.lender]) m[c.lender] = { sum: 0, count: 0 };
      m[c.lender].sum += c.value;
      m[c.lender].count += 1;
    });
    const result: Record<string, number> = {};
    Object.entries(m).forEach(([k, v]) => { result[k] = v.count > 0 ? v.sum / v.count : 0; });
    return result;
  }, [cells]);

  const stageAvgs = useMemo(() => {
    const m: Record<string, { sum: number; count: number }> = {};
    cells.forEach((c) => {
      if (!m[c.stage]) m[c.stage] = { sum: 0, count: 0 };
      m[c.stage].sum += c.value;
      m[c.stage].count += 1;
    });
    const result: Record<string, number> = {};
    Object.entries(m).forEach(([k, v]) => { result[k] = v.count > 0 ? v.sum / v.count : 0; });
    return result;
  }, [cells]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-foreground/80 font-medium">
          <span className="mr-0.5 text-foreground">Conv%:</span>
          <span className="flex items-center gap-1"><span className="w-3.5 h-3 rounded-sm bg-red-600 ring-1 ring-black/10" /> &lt;10</span>
          <span className="flex items-center gap-1"><span className="w-3.5 h-3 rounded-sm bg-red-500 ring-1 ring-black/10" /> 10-25</span>
          <span className="flex items-center gap-1"><span className="w-3.5 h-3 rounded-sm bg-orange-500 ring-1 ring-black/10" /> 25-40</span>
          <span className="flex items-center gap-1"><span className="w-3.5 h-3 rounded-sm bg-amber-400 ring-1 ring-black/10" /> 40-55</span>
          <span className="flex items-center gap-1"><span className="w-3.5 h-3 rounded-sm bg-emerald-400 ring-1 ring-black/10" /> 55-70</span>
          <span className="flex items-center gap-1"><span className="w-3.5 h-3 rounded-sm bg-emerald-500 ring-1 ring-black/10" /> 70-85</span>
          <span className="flex items-center gap-1"><span className="w-3.5 h-3 rounded-sm bg-emerald-600 ring-1 ring-black/10" /> &gt;85</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border/80 bg-card shadow-sm">
        <table className="w-full border-collapse min-w-[820px]">
          <thead>
            <tr className="bg-muted/90">
              <th className="sticky left-0 z-10 bg-muted/95 backdrop-blur-sm text-xs font-bold text-foreground text-left px-3 py-3 border-b border-r w-[min(15rem,32vw)] max-w-[15rem] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                Stage
              </th>
              {lenders.map((lender) => (
                <th
                  key={lender}
                  className={cn(
                    "text-[10px] font-bold text-foreground text-center px-1.5 py-3 border-b border-border/60 min-w-[80px] max-w-[100px] align-bottom transition-colors",
                    hoveredCol === lender && "bg-primary/10"
                  )}
                  title={lender}
                >
                  <div className="leading-snug break-words hyphens-auto whitespace-normal">{stageLabelAsInSource(lender)}</div>
                </th>
              ))}
              <th className="text-xs font-bold text-foreground text-center px-2 py-3 border-b border-l bg-muted/70 min-w-[56px]">
                Avg
              </th>
            </tr>
          </thead>
          <tbody>
            {stages.map((stage, sIdx) => {
              const isRowHovered = hoveredRow === stage;
              return (
                <tr
                  key={stage}
                  onMouseEnter={() => setHoveredRow(stage)}
                  onMouseLeave={() => setHoveredRow(null)}
                  className={cn(
                    "transition-colors",
                    isRowHovered && "bg-muted/20",
                    sIdx % 2 === 0 ? "bg-background" : "bg-muted/5"
                  )}
                >
                  <td className={cn(
                    "sticky left-0 z-10 text-xs font-semibold text-foreground px-3 py-2.5 border-r align-top shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]",
                    isRowHovered ? "bg-muted/80 backdrop-blur-sm" : sIdx % 2 === 0 ? "bg-background" : "bg-muted/20"
                  )}>
                    <div
                      className="whitespace-normal break-words leading-snug max-w-[min(15rem,32vw)]"
                      title={stageLabelAsInSource(stage)}
                    >
                      {stageLabelAsInSource(stage)}
                    </div>
                  </td>
                  {lenders.map((lender) => {
                    const cell = cellMap[`${lender}|${stage}`];
                    const value = cell?.value ?? 0;
                    const delta = cell?.delta;
                    const isColHovered = hoveredCol === lender;
                    const isCrossHover = isRowHovered && isColHovered;
                    const tone = heatTone(value);

                    return (
                      <td
                        key={lender}
                        className="p-1 text-center align-middle"
                        onMouseEnter={() => setHoveredCol(lender)}
                        onMouseLeave={() => setHoveredCol(null)}
                      >
                        <div
                          className={cn(
                            "rounded-md px-2 py-2 min-h-[52px] flex flex-col items-center justify-center transition-all relative group ring-1 ring-black/10",
                            getHeatBgOnly(value),
                            isCrossHover && "ring-2 ring-primary ring-offset-2 z-10 shadow-lg scale-[1.02]",
                            !isCrossHover && (isRowHovered || isColHovered) && "brightness-[1.03] ring-black/15",
                            onCellClick && "cursor-pointer"
                          )}
                          onClick={() => onCellClick?.(lender, stage)}
                        >
                          <div className={cn("text-sm tabular-nums leading-none", getMainPctClass(tone))}>
                            {value.toFixed(0)}%
                          </div>
                          {delta != null && (
                            <div className={getDeltaClass(delta, tone)}>
                              {delta > 0 ? "+" : ""}{delta.toFixed(1)}pp
                            </div>
                          )}
                          {isCrossHover && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-popover text-popover-foreground text-[11px] px-3 py-2 rounded-lg shadow-xl border whitespace-nowrap z-30 pointer-events-none">
                              <div className="font-bold mb-0.5">{lender}</div>
                              <div className="text-muted-foreground text-[10px] mb-1 max-w-[240px] whitespace-normal break-words">{stageLabelAsInSource(stage)}</div>
                              <div className="flex items-center gap-3">
                                <span>Conv: <strong>{value.toFixed(1)}%</strong></span>
                                {delta != null && (
                                  <span className={cn("font-semibold", delta >= 0 ? "text-emerald-600" : "text-red-600")}>
                                    {delta > 0 ? "+" : ""}{delta.toFixed(1)}pp vs {compareLabel}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-2 py-1 text-center border-l bg-muted/30">
                    <div className="text-xs font-extrabold tabular-nums text-foreground">
                      {(stageAvgs[stage] ?? 0).toFixed(0)}%
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border/80 bg-muted/50">
              <td className="sticky left-0 z-10 bg-muted/80 backdrop-blur-sm text-xs font-extrabold text-foreground px-3 py-2.5 border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                Avg
              </td>
              {lenders.map((lender) => (
                <td key={lender} className="text-center px-1 py-2">
                  <div className="text-xs font-extrabold tabular-nums text-foreground">
                    {(lenderAvgs[lender] ?? 0).toFixed(0)}%
                  </div>
                </td>
              ))}
              <td className="border-l" />
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-xs text-foreground/75 text-center font-medium">
        Hover over cells to see details. Delta shown as pp change vs {compareLabel}.
      </p>
    </div>
  );
}
