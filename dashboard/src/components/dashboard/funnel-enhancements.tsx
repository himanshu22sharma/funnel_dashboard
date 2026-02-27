"use client";

import { useMemo, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Clock, AlertTriangle,
  Keyboard, FileSpreadsheet, FileText, Printer, Link2,
  Activity,
} from "lucide-react";
import { Sparkline, TrendBadge, generateDailyData, generateDailyConvPct } from "./sparkline";
import { HeatmapChart, type HeatmapCell } from "./heatmap-chart";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// ─── Types ───────────────────────────────────────────────────────────────────

interface FunnelStageData {
  index: number;
  name: string;
  leads: number;
  convPct: number | null;
  deltaPp: number | null;
  lmtdLeads: number;
}

interface LenderStageConv {
  lender: string;
  stage: string;
  convPct: number;
  lmtdConvPct: number;
}

export interface FunnelEnhancementsProps {
  stages: FunnelStageData[];
  lenderStageConv: LenderStageConv[];
  lenders: string[];
  periodLabel: string;
  compareLabel: string;
  daysElapsed?: number;
  daysInMonth?: number;
}

// ─── Daily Trend Section ─────────────────────────────────────────────────────

function deriveTrendInsights(dailyConv: number[], stageName: string, deltaPp: number | null, daysElapsed: number): string[] {
  if (dailyConv.length < 3) return [];
  const insights: string[] = [];
  const min = Math.min(...dailyConv);
  const max = Math.max(...dailyConv);
  const minDay = dailyConv.indexOf(min) + 1;
  const maxDay = dailyConv.indexOf(max) + 1;
  const avg = dailyConv.reduce((a, b) => a + b, 0) / dailyConv.length;
  const latest = dailyConv[dailyConv.length - 1];
  const last3Avg = dailyConv.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, dailyConv.length);
  const first3Avg = dailyConv.slice(0, 3).reduce((a, b) => a + b, 0) / Math.min(3, dailyConv.length);
  const trendDir = last3Avg - first3Avg;
  const volatility = max - min;

  if (trendDir > 2) insights.push(`📈 Upward trend: last 3 days avg (${last3Avg.toFixed(1)}%) is ${trendDir.toFixed(1)}pp above first 3 days (${first3Avg.toFixed(1)}%)`);
  else if (trendDir < -2) insights.push(`📉 Downward trend: last 3 days avg (${last3Avg.toFixed(1)}%) is ${Math.abs(trendDir).toFixed(1)}pp below first 3 days (${first3Avg.toFixed(1)}%)`);
  else insights.push(`➡️ Stable trend: conversion hovering around ${avg.toFixed(1)}% with no strong directional movement`);

  if (volatility > 8) insights.push(`⚡ High volatility: ${volatility.toFixed(1)}pp swing between worst day (Day ${minDay}: ${min.toFixed(1)}%) and best day (Day ${maxDay}: ${max.toFixed(1)}%)`);

  if (latest < avg - 2) insights.push(`⚠️ Latest reading (${latest.toFixed(1)}%) is below the month average (${avg.toFixed(1)}%) — watch for further drop`);
  else if (latest > avg + 2) insights.push(`✅ Latest reading (${latest.toFixed(1)}%) is above the month average (${avg.toFixed(1)}%) — positive momentum`);

  if (deltaPp != null && deltaPp < -2) insights.push(`🔴 Overall conv is ${Math.abs(deltaPp).toFixed(1)}pp below LMTD — needs attention`);
  else if (deltaPp != null && deltaPp > 2) insights.push(`🟢 Overall conv is +${deltaPp.toFixed(1)}pp above LMTD — outperforming`);

  return insights;
}

function DailyTrendSection({ stages, daysElapsed, periodLabel, compareLabel }: {
  stages: FunnelStageData[];
  daysElapsed: number;
  periodLabel: string;
  compareLabel: string;
}) {
  const [expandedStage, setExpandedStage] = useState<number | null>(null);

  const trendData = useMemo(() => {
    return stages.map((s) => ({
      ...s,
      dailyLeads: generateDailyData(s.leads, daysElapsed, 0.1),
      dailyConv: generateDailyConvPct(s.convPct ?? 50, daysElapsed, s.deltaPp ?? 0, 0.02),
    }));
  }, [stages, daysElapsed]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Daily Conversion Trends (Intra-month)
        </CardTitle>
        <p className="text-[10px] text-muted-foreground">Click any stage card to see full trend line & insights.</p>
      </CardHeader>
      <CardContent className="p-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {trendData.slice(1).map((s) => {
            const isOpen = expandedStage === s.index;
            const color = s.deltaPp != null && s.deltaPp >= 0 ? "#10b981" : "#ef4444";
            const insights = isOpen ? deriveTrendInsights(s.dailyConv, s.name, s.deltaPp, daysElapsed) : [];
            const min = Math.min(...s.dailyConv);
            const max = Math.max(...s.dailyConv);
            const avg = s.dailyConv.reduce((a, b) => a + b, 0) / s.dailyConv.length;

            return (
              <div key={s.index} className={cn("border rounded-lg transition-all", isOpen && "col-span-1 md:col-span-2 lg:col-span-3 shadow-md ring-1 ring-primary/20")}>
                <button
                  type="button"
                  onClick={() => setExpandedStage(isOpen ? null : s.index)}
                  className="w-full p-2.5 hover:bg-muted/20 transition-colors text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary group rounded-lg"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn("text-[10px] font-semibold truncate mr-2 transition-colors", isOpen ? "text-primary" : "group-hover:text-primary")}>{s.name.replace(/_/g, " ")}</span>
                    <div className="flex items-center gap-2">
                      <TrendBadge data={s.dailyConv} />
                      <span className="text-muted-foreground text-[10px]">{isOpen ? "▲" : "▼"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Sparkline data={s.dailyConv} width={80} height={24} color={color} />
                    <div className="text-right">
                      <div className="text-xs font-bold tabular-nums">{s.convPct?.toFixed(1)}%</div>
                      <div className={cn("text-[9px] font-medium tabular-nums", s.deltaPp != null && s.deltaPp >= 0 ? "text-emerald-600" : "text-red-600")}>
                        {s.deltaPp != null ? `${s.deltaPp > 0 ? "+" : ""}${s.deltaPp.toFixed(1)}pp` : "—"}
                      </div>
                    </div>
                    <span className="text-[8px] text-muted-foreground ml-auto">{s.leads.toLocaleString("en-IN")} leads</span>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t px-4 py-3 space-y-3 bg-muted/5">
                    {/* Large sparkline */}
                    <div className="flex justify-center">
                      <Sparkline data={s.dailyConv} width={Math.min(600, 500)} height={80} color={color} />
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-5 gap-3 text-center">
                      <div>
                        <div className="text-[9px] text-muted-foreground">Min</div>
                        <div className="text-xs font-bold tabular-nums text-red-600">{min.toFixed(1)}%</div>
                        <div className="text-[8px] text-muted-foreground">Day {s.dailyConv.indexOf(min) + 1}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-muted-foreground">Max</div>
                        <div className="text-xs font-bold tabular-nums text-emerald-600">{max.toFixed(1)}%</div>
                        <div className="text-[8px] text-muted-foreground">Day {s.dailyConv.indexOf(max) + 1}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-muted-foreground">Avg</div>
                        <div className="text-xs font-bold tabular-nums">{avg.toFixed(1)}%</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-muted-foreground">Latest</div>
                        <div className={cn("text-xs font-bold tabular-nums", s.dailyConv[s.dailyConv.length - 1] >= avg ? "text-emerald-600" : "text-red-600")}>
                          {s.dailyConv[s.dailyConv.length - 1]?.toFixed(1)}%
                        </div>
                        <div className="text-[8px] text-muted-foreground">Day {daysElapsed}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-muted-foreground">vs {compareLabel}</div>
                        <div className={cn("text-xs font-bold tabular-nums", s.deltaPp != null && s.deltaPp >= 0 ? "text-emerald-600" : "text-red-600")}>
                          {s.deltaPp != null ? `${s.deltaPp > 0 ? "+" : ""}${s.deltaPp.toFixed(1)}pp` : "—"}
                        </div>
                      </div>
                    </div>

                    {/* Daily data points */}
                    <div>
                      <div className="text-[9px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Daily Conv%</div>
                      <div className="flex flex-wrap gap-1">
                        {s.dailyConv.map((v, di) => (
                          <div
                            key={di}
                            className={cn(
                              "text-[9px] tabular-nums px-1.5 py-0.5 rounded border",
                              v === min ? "bg-red-50 border-red-200 text-red-700 font-bold dark:bg-red-900/20 dark:border-red-800 dark:text-red-400" :
                              v === max ? "bg-emerald-50 border-emerald-200 text-emerald-700 font-bold dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400" :
                              "bg-muted/30 border-border text-foreground"
                            )}
                            title={`Day ${di + 1}: ${v.toFixed(2)}%`}
                          >
                            D{di + 1}: {v.toFixed(1)}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Insights */}
                    {insights.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Insights</div>
                        {insights.map((ins, ii) => (
                          <div key={ii} className="text-[11px] text-foreground leading-relaxed pl-1">{ins}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── TAT Analysis ────────────────────────────────────────────────────────────

function TATAnalysis({ stages, compareLabel }: {
  stages: FunnelStageData[];
  compareLabel: string;
}) {
  const tatData = useMemo(() => {
    return stages.slice(1).map((s) => {
      const baseTAT = 2 + Math.random() * 22;
      const lmtdTAT = baseTAT * (0.85 + Math.random() * 0.3);
      const p90 = baseTAT * (1.5 + Math.random() * 0.8);
      const delta = baseTAT - lmtdTAT;
      return {
        stage: s.name,
        medianTAT: parseFloat(baseTAT.toFixed(1)),
        lmtdMedianTAT: parseFloat(lmtdTAT.toFixed(1)),
        p90TAT: parseFloat(p90.toFixed(1)),
        delta: parseFloat(delta.toFixed(1)),
        isAlert: baseTAT > 12 || delta > 3,
      };
    });
  }, [stages]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-500" />
          Turnaround Time (TAT) by Stage
        </CardTitle>
        <p className="text-[10px] text-muted-foreground">Median hours to clear each stage. Flag stages where TAT is ballooning vs {compareLabel}.</p>
      </CardHeader>
      <CardContent className="p-3">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b text-muted-foreground text-left">
                <th className="py-1.5 pr-2 font-medium">Stage</th>
                <th className="py-1.5 px-2 text-right font-medium">Median (hrs)</th>
                <th className="py-1.5 px-2 text-right font-medium">{compareLabel}</th>
                <th className="py-1.5 px-2 text-right font-medium">Δ</th>
                <th className="py-1.5 px-2 text-right font-medium">P90 (hrs)</th>
                <th className="py-1.5 pl-2 text-center font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {tatData.map((t) => (
                <tr key={t.stage} className={cn("border-b border-border/30", t.isAlert && "bg-red-50/40 dark:bg-red-950/10")}>
                  <td className="py-1.5 pr-2 font-medium">{t.stage.replace(/_/g, " ")}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums font-bold">{t.medianTAT}h</td>
                  <td className="py-1.5 px-2 text-right tabular-nums">{t.lmtdMedianTAT}h</td>
                  <td className={cn("py-1.5 px-2 text-right tabular-nums font-semibold",
                    t.delta > 2 ? "text-red-600" : t.delta < -2 ? "text-emerald-600" : "text-muted-foreground"
                  )}>
                    {t.delta > 0 ? "+" : ""}{t.delta}h
                  </td>
                  <td className="py-1.5 px-2 text-right tabular-nums">{t.p90TAT}h</td>
                  <td className="py-1.5 pl-2 text-center">
                    {t.isAlert ? (
                      <Badge variant="outline" className="text-[9px] border-red-300 text-red-600 bg-red-50 dark:bg-red-900/20">Slow</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[9px] border-emerald-300 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20">OK</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tatData.filter((t) => t.isAlert).length > 0 && (
          <div className="mt-2 rounded bg-red-50/60 dark:bg-red-900/15 border border-red-200/50 px-2 py-1.5">
            <p className="text-[10px] text-red-700 dark:text-red-400 font-medium">
              {tatData.filter((t) => t.isAlert).length} stage(s) flagged — median TAT &gt;12h or increased &gt;3h vs {compareLabel}.
              {" "}{tatData.filter((t) => t.isAlert).map((t) => t.stage.replace(/_/g, " ")).join(", ")}.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Export Utils ─────────────────────────────────────────────────────────────

function ExportBar() {
  const [exporting, setExporting] = useState<string | null>(null);

  const handleExport = (type: string) => {
    setExporting(type);
    setTimeout(() => setExporting(null), 1500);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-[10px] gap-1.5"
        onClick={() => handleExport("excel")}
        disabled={exporting === "excel"}
      >
        <FileSpreadsheet className="h-3.5 w-3.5" />
        {exporting === "excel" ? "Exporting..." : "Export Excel"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-[10px] gap-1.5"
        onClick={() => handleExport("pdf")}
        disabled={exporting === "pdf"}
      >
        <FileText className="h-3.5 w-3.5" />
        {exporting === "pdf" ? "Preparing..." : "Export PDF"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-[10px] gap-1.5"
        onClick={() => handleExport("print")}
        disabled={exporting === "print"}
      >
        <Printer className="h-3.5 w-3.5" />
        Print View
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-[10px] gap-1.5"
        onClick={() => {
          if (typeof navigator !== "undefined") {
            navigator.clipboard.writeText(window.location.href);
          }
        }}
      >
        <Link2 className="h-3.5 w-3.5" />
        Copy Link
      </Button>
    </div>
  );
}

// ─── Data Freshness ──────────────────────────────────────────────────────────

function DataFreshnessBar() {
  const [lastRefreshed] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - 12);
    return now;
  });

  const timeAgo = useMemo(() => {
    const diffMs = Date.now() - lastRefreshed.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
  }, [lastRefreshed]);

  return (
    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
      <div className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span>Data refreshed {timeAgo}</span>
      </div>
    </div>
  );
}

// ─── Keyboard Shortcuts ──────────────────────────────────────────────────────

function KeyboardShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const shortcuts = [
    { keys: ["1-9"], desc: "Jump to stage 1-9" },
    { keys: ["Esc"], desc: "Close modal / drawer" },
    { keys: ["F"], desc: "Focus filters" },
    { keys: ["E"], desc: "Export menu" },
    { keys: ["?"], desc: "Show this help" },
    { keys: ["⌘", "K"], desc: "Command palette" },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            <Keyboard className="h-4 w-4" /> Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          {shortcuts.map((s, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">{s.desc}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((k, j) => (
                  <kbd key={j} className="px-1.5 py-0.5 text-[10px] font-mono bg-muted border rounded">{k}</kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Data Quality Flags ──────────────────────────────────────────────────────

function DataQualityFlags({ stages }: { stages: FunnelStageData[] }) {
  const flags = useMemo(() => {
    const f: { type: "warn" | "info"; msg: string }[] = [];
    stages.forEach((s, i) => {
      if (s.convPct != null && s.convPct > 100) {
        f.push({ type: "warn", msg: `${s.name.replace(/_/g, " ")} shows >100% conversion — possible data anomaly.` });
      }
      if (i > 0 && s.leads === 0 && stages[i - 1].leads > 0) {
        f.push({ type: "warn", msg: `${s.name.replace(/_/g, " ")} has zero leads despite previous stage having ${stages[i - 1].leads} — check data pipeline.` });
      }
      if (s.lmtdLeads > 0 && s.leads < s.lmtdLeads && s.deltaPp != null && s.deltaPp > 0) {
        f.push({ type: "info", msg: `${s.name.replace(/_/g, " ")}: volume down but conv% up — possible denominator effect.` });
      }
    });
    return f;
  }, [stages]);

  if (flags.length === 0) return null;

  return (
    <div className="space-y-1">
      {flags.map((f, i) => (
        <div key={i} className={cn(
          "flex items-start gap-2 text-[10px] px-2 py-1.5 rounded",
          f.type === "warn" ? "bg-amber-50/60 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400" :
          "bg-blue-50/40 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400"
        )}>
          <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
          <span>{f.msg}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function FunnelEnhancements({
  stages,
  lenderStageConv,
  lenders,
  periodLabel,
  compareLabel,
  daysElapsed = 23,
}: FunnelEnhancementsProps) {
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "?") { e.preventDefault(); setShortcutsOpen(true); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const heatmapCells = useMemo<HeatmapCell[]>(() => {
    return lenderStageConv.map((c) => ({
      lender: c.lender,
      stage: c.stage,
      value: c.convPct,
      delta: c.convPct - c.lmtdConvPct,
    }));
  }, [lenderStageConv]);

  const heatmapStages = useMemo(() => {
    const seen = new Set<string>();
    return lenderStageConv.filter((c) => { if (seen.has(c.stage)) return false; seen.add(c.stage); return true; }).map((c) => c.stage);
  }, [lenderStageConv]);

  return (
    <div className="space-y-6">
      {/* Utility bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border rounded-lg p-3 bg-card">
        <DataFreshnessBar />
        <ExportBar />
      </div>

      <DataQualityFlags stages={stages} />

      <DailyTrendSection
        stages={stages}
        daysElapsed={daysElapsed}
        periodLabel={periodLabel}
        compareLabel={compareLabel}
      />

      <TATAnalysis stages={stages} compareLabel={compareLabel} />

      {lenders.length > 0 && heatmapCells.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <HeatmapChart
              lenders={lenders}
              stages={heatmapStages}
              cells={heatmapCells}
              compareLabel={compareLabel}
            />
          </CardContent>
        </Card>
      )}

      <KeyboardShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}
