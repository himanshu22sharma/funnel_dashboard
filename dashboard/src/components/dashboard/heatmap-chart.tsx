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

function getHeatBg(value: number): string {
  if (value >= 85) return "bg-emerald-600/90 text-white";
  if (value >= 70) return "bg-emerald-500/80 text-white";
  if (value >= 55) return "bg-emerald-400/70 text-white";
  if (value >= 40) return "bg-amber-400/70 text-gray-900";
  if (value >= 25) return "bg-orange-400/80 text-white";
  if (value >= 10) return "bg-red-400/80 text-white";
  return "bg-red-600/90 text-white";
}

function getDeltaColor(delta: number | null | undefined): string {
  if (delta == null) return "";
  if (delta >= 3) return "text-emerald-300";
  if (delta > 0) return "text-emerald-200/80";
  if (delta <= -3) return "text-red-200 font-bold";
  if (delta < 0) return "text-red-200/80";
  return "text-white/60";
}

function abbreviateStage(stage: string): string {
  return stage
    .replace(/_/g, " ")
    .replace(/completed?/i, "")
    .replace(/created?/i, "")
    .trim();
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
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
          <span className="text-[8px] font-medium mr-1">Conv%:</span>
          <span className="flex items-center gap-0.5"><span className="w-3 h-2.5 rounded-sm bg-red-600/90" /> &lt;10</span>
          <span className="flex items-center gap-0.5"><span className="w-3 h-2.5 rounded-sm bg-red-400/80" /> 10-25</span>
          <span className="flex items-center gap-0.5"><span className="w-3 h-2.5 rounded-sm bg-orange-400/80" /> 25-40</span>
          <span className="flex items-center gap-0.5"><span className="w-3 h-2.5 rounded-sm bg-amber-400/70" /> 40-55</span>
          <span className="flex items-center gap-0.5"><span className="w-3 h-2.5 rounded-sm bg-emerald-400/70" /> 55-70</span>
          <span className="flex items-center gap-0.5"><span className="w-3 h-2.5 rounded-sm bg-emerald-500/80" /> 70-85</span>
          <span className="flex items-center gap-0.5"><span className="w-3 h-2.5 rounded-sm bg-emerald-600/90" /> &gt;85</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse min-w-[700px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-muted/80 backdrop-blur-sm text-[10px] font-semibold text-muted-foreground text-left px-3 py-2.5 border-b border-r w-28">
                Lender
              </th>
              {stages.map((stage) => (
                <th
                  key={stage}
                  className={cn(
                    "text-[9px] font-semibold text-muted-foreground text-center px-1 py-2 border-b min-w-[72px] transition-colors",
                    hoveredCol === stage && "bg-primary/5"
                  )}
                  title={stage.replace(/_/g, " ")}
                >
                  <div className="leading-tight">{abbreviateStage(stage)}</div>
                  <div className="text-[8px] font-normal text-muted-foreground/60 mt-0.5">
                    avg {stageAvgs[stage]?.toFixed(0) ?? 0}%
                  </div>
                </th>
              ))}
              <th className="text-[9px] font-semibold text-muted-foreground text-center px-2 py-2 border-b border-l bg-muted/40 min-w-[52px]">
                Avg
              </th>
            </tr>
          </thead>
          <tbody>
            {lenders.map((lender, lIdx) => {
              const isRowHovered = hoveredRow === lender;
              return (
                <tr
                  key={lender}
                  onMouseEnter={() => setHoveredRow(lender)}
                  onMouseLeave={() => setHoveredRow(null)}
                  className={cn(
                    "transition-colors",
                    isRowHovered && "bg-muted/20",
                    lIdx % 2 === 0 ? "bg-background" : "bg-muted/5"
                  )}
                >
                  <td className={cn(
                    "sticky left-0 z-10 text-[11px] font-semibold text-foreground px-3 py-2 border-r whitespace-nowrap",
                    isRowHovered ? "bg-muted/60 backdrop-blur-sm" : lIdx % 2 === 0 ? "bg-background" : "bg-muted/5"
                  )}>
                    <div className="truncate max-w-[100px]" title={lender}>{lender}</div>
                  </td>
                  {stages.map((stage) => {
                    const cell = cellMap[`${lender}|${stage}`];
                    const value = cell?.value ?? 0;
                    const delta = cell?.delta;
                    const isColHovered = hoveredCol === stage;
                    const isCrossHover = isRowHovered && isColHovered;

                    return (
                      <td
                        key={stage}
                        className="px-0.5 py-0.5 text-center"
                        onMouseEnter={() => setHoveredCol(stage)}
                        onMouseLeave={() => setHoveredCol(null)}
                      >
                        <div
                          className={cn(
                            "rounded px-1.5 py-1.5 transition-all relative group",
                            getHeatBg(value),
                            isCrossHover && "ring-2 ring-primary ring-offset-1 scale-105 z-10 shadow-md",
                            !isCrossHover && (isRowHovered || isColHovered) && "brightness-110",
                            onCellClick && "cursor-pointer"
                          )}
                          onClick={() => onCellClick?.(lender, stage)}
                        >
                          <div className="text-[11px] font-bold tabular-nums leading-none">
                            {value.toFixed(0)}%
                          </div>
                          {delta != null && (
                            <div className={cn("text-[8px] font-semibold tabular-nums leading-none mt-0.5", getDeltaColor(delta))}>
                              {delta > 0 ? "+" : ""}{delta.toFixed(1)}pp
                            </div>
                          )}
                          {isCrossHover && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-popover text-popover-foreground text-[11px] px-3 py-2 rounded-lg shadow-xl border whitespace-nowrap z-30 pointer-events-none">
                              <div className="font-bold mb-0.5">{lender}</div>
                              <div className="text-muted-foreground text-[10px] mb-1">{stage.replace(/_/g, " ")}</div>
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
                  <td className="px-1 py-0.5 text-center border-l bg-muted/20">
                    <div className="text-[10px] font-bold tabular-nums text-muted-foreground">
                      {(lenderAvgs[lender] ?? 0).toFixed(0)}%
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 bg-muted/30">
              <td className="sticky left-0 z-10 bg-muted/60 backdrop-blur-sm text-[10px] font-bold text-muted-foreground px-3 py-2 border-r">
                Avg
              </td>
              {stages.map((stage) => (
                <td key={stage} className="text-center px-0.5 py-1.5">
                  <div className="text-[10px] font-bold tabular-nums text-muted-foreground">
                    {(stageAvgs[stage] ?? 0).toFixed(0)}%
                  </div>
                </td>
              ))}
              <td className="border-l" />
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-[9px] text-muted-foreground text-center">
        Hover over cells to see details. Delta shown as pp change vs {compareLabel}.
      </p>
    </div>
  );
}
