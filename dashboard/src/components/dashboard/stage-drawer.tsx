"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { PulseHint } from "@/components/dashboard/guided-tour";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

// ─── C1: Why-type heuristic per stage ─────────────────────────────────────────
type WhyType = "Business" | "Product" | "Tech" | "Risk";
type UrgencyLevel = "Immediate" | "Monitor" | "Defer";

const STAGE_WHY_MAP: Record<number, WhyType> = {
  2: "Business", 3: "Business", 4: "Product",
  5: "Product", 6: "Product",
  7: "Tech", 8: "Tech",
  9: "Risk", 10: "Risk",
  11: "Business", 12: "Tech",
  13: "Business", 14: "Tech", 15: "Business",
};

const WHY_STYLE: Record<WhyType, { cls: string; icon: string }> = {
  Business: { cls: "bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:text-slate-300", icon: "📊" },
  Product:  { cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 font-bold ring-1 ring-red-300 dark:ring-red-700", icon: "🔴" },
  Tech:     { cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 font-bold ring-1 ring-orange-300 dark:ring-orange-700", icon: "⚙️" },
  Risk:     { cls: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300", icon: "🛡️" },
};

function deriveWhyType(stageIndex: number): WhyType {
  return STAGE_WHY_MAP[stageIndex] ?? "Business";
}

function deriveUrgency(deltaPp: number | null, leads: number): UrgencyLevel {
  if (deltaPp == null) return "Defer";
  if (deltaPp <= -3 || (deltaPp <= -1 && leads > 1000)) return "Immediate";
  if (deltaPp < 0) return "Monitor";
  return "Defer";
}

const URGENCY_STYLE: Record<UrgencyLevel, { cls: string; icon: string; label: string }> = {
  Immediate: { cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: "🔥", label: "Immediate — will worsen today" },
  Monitor:   { cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: "⏳", label: "Monitor — slow bleed" },
  Defer:     { cls: "bg-slate-100 text-slate-600 dark:bg-slate-800/30 dark:text-slate-400", icon: "💤", label: "Defer — contained" },
};

export interface StageDrawerStage {
  index: number;
  name: string;
  leads: number;
  prevLeads: number;
  prevStageName: string;
  convPct: number | null;
  lmtdLeads: number;
  lmtdPrevLeads: number;
  lmtdConvPct: number | null;
  deltaPp: number | null;
  isDataAnomaly: boolean;
}

export interface StructuralRow {
  stage: string;
  index: number;
  mtdConv: number | null;
  lmtdConv: number | null;
  delta: number | null;
  diagnosis: "structural" | "temporary_drop" | "temporary_gain" | "healthy";
}

export interface GlobalVsSpecificRow {
  stage: string;
  index: number;
  isGlobal: boolean;
  droppedCount: number;
  totalCount: number;
  worstLender: string | null;
  worstProduct: string | null;
}

export interface LenderProgramRow {
  lender: string;
  program: string;
  entryLeads: number;
  mtdLeads: number;
  lmtdLeads: number;
  mtdConv: number | null;
  deltaPp: number | null;
  impact: number;
}

export interface SubStageLenderFlow {
  lender: string;
  flow: string;
  leads: number;
  lmtd_leads: number;
  countDiffPct: number | null;
}

export interface SubStageRow {
  sub_stage: string;
  mtd_leads: number;
  lmtd_leads: number;
  delta_pp: number | null;
  stuck_pct: number | null;
  is_terminal: boolean;
  lender_flow_detail: SubStageLenderFlow[];
}

export interface LenderRow {
  lender: string;
  mtdLeads: number;
  lmtdLeads: number;
  mtdConv: number | null;
  lmtdConv: number | null;
  countDiffPct: number | null;
  deltaPp: number | null;
}

export interface FlowRow {
  flow: string;
  entryLeads: number;
  mtdLeads: number;
  lmtdLeads: number;
  mtdConv: number | null;
  lmtdConv: number | null;
  deltaPp: number | null;
  countDiffPct: number | null;
}

export interface LenderL2Row {
  lender: string;
  l2Stage: string;
  mtdLeads: number;
  lmtdLeads: number;
  countDiffPct: number | null;
}

/** Flow × lender row for business insights: Issue / Good narrative */
export interface FlowLenderInsightRow {
  lender: string;
  flow: string;
  mtdLeads: number;
  lmtdLeads: number;
  mtdConv: number | null;
  lmtdConv: number | null;
  countDiffPct: number | null;
  deltaPp: number | null;
}

export interface StageDetailContentProps {
  stage: StageDrawerStage;
  isTopLeak?: boolean;
  /** Stages before Child_Lead_Created (index < 6) have no lender allocation */
  hasLenderAllocation: boolean;
  structuralRow: StructuralRow | undefined;
  globalVsSpecificRow: GlobalVsSpecificRow | undefined;
  compareLabel: string;
  periodLabel: string;
  lenderProgramRows: LenderProgramRow[];
  lenderRows: LenderRow[];
  flowRows: FlowRow[];
  lenderL2Rows: LenderL2Row[];
  flowLenderInsightRows: FlowLenderInsightRow[];
  subStages: SubStageRow[];
  /** Name of the next funnel stage (to explain "stuck leads preventing progression to X") */
  prevStageName?: string;
  failureReasons: Record<string, { reason: string; pct: number }[]>;
  onLenderProgramClick?: (lender: string, program: string) => void;
  onLenderClick?: (lender: string) => void;
  onFlowClick?: (flow: string) => void;
  onL2Click?: (l2Stage: string) => void;
  /** Deep-dive: lender×flow combo (post-allocation) or flow-only (pre-allocation) */
  onInsightClick?: (lender: string, flow: string) => void;
  onViewFullTable?: () => void;
}

type SeverityBucket = "p0" | "p1" | "good" | "better" | "top";

function classifyCountDiff(pct: number | null): SeverityBucket | null {
  if (pct == null) return null;
  if (pct <= -20) return "p0";
  if (pct < -1) return "p1";
  if (pct >= 1 && pct <= 15) return "good";
  if (pct > 15 && pct <= 30) return "better";
  if (pct > 30) return "top";
  return null;
}

function classifyStuckCountDiff(pct: number | null): SeverityBucket | null {
  if (pct == null) return null;
  if (pct >= 20) return "p0";
  if (pct > 1) return "p1";
  if (pct <= -30) return "top";
  if (pct <= -15) return "better";
  if (pct < -1) return "good";
  return null;
}

const SEVERITY_RANK: Record<SeverityBucket, number> = { p0: 0, p1: 1, good: 2, better: 3, top: 4 };
function worstBucket(a: SeverityBucket | null, b: SeverityBucket | null): SeverityBucket | null {
  if (a == null) return b;
  if (b == null) return a;
  return SEVERITY_RANK[a] <= SEVERITY_RANK[b] ? a : b;
}

const BUCKET_META: Record<SeverityBucket, { title: string; dot: string; border: string; bg: string; hover: string; text: string }> = {
  p0:     { title: "P0 — Needs attention (≥20% drop)", dot: "bg-red-600", border: "border-red-300 dark:border-red-700/50", bg: "bg-red-50/70 dark:bg-red-900/20", hover: "hover:bg-red-100 dark:hover:bg-red-900/30", text: "text-red-700 dark:text-red-400" },
  p1:     { title: "P1 — Watch (1–20% drop)",          dot: "bg-amber-500", border: "border-amber-200 dark:border-amber-700/50", bg: "bg-amber-50/60 dark:bg-amber-900/15", hover: "hover:bg-amber-100 dark:hover:bg-amber-900/25", text: "text-amber-700 dark:text-amber-400" },
  good:   { title: "Good (1–15% improvement)",          dot: "bg-emerald-400", border: "border-emerald-200 dark:border-emerald-700/50", bg: "bg-emerald-50/50 dark:bg-emerald-900/10", hover: "hover:bg-emerald-100 dark:hover:bg-emerald-900/20", text: "text-emerald-600 dark:text-emerald-400" },
  better: { title: "Better (15–30% improvement)",       dot: "bg-emerald-500", border: "border-emerald-300 dark:border-emerald-700/50", bg: "bg-emerald-50/70 dark:bg-emerald-900/15", hover: "hover:bg-emerald-100 dark:hover:bg-emerald-900/25", text: "text-emerald-700 dark:text-emerald-300" },
  top:    { title: "Top performer (>30% improvement)",  dot: "bg-emerald-600", border: "border-emerald-400 dark:border-emerald-600/50", bg: "bg-emerald-100/70 dark:bg-emerald-900/25", hover: "hover:bg-emerald-200 dark:hover:bg-emerald-900/35", text: "text-emerald-800 dark:text-emerald-300" },
};

const BUCKET_ORDER: SeverityBucket[] = ["p0", "p1", "good", "better", "top"];

type L2FlatRow = { sub_stage: string; lender: string; flow: string; rawFlow: string; leads: number; lmtd_leads: number; countDiffPct: number | null; is_terminal: boolean };

function L2Table({ rows, visibleCount, compareLabel }: { rows: L2FlatRow[]; visibleCount: number; compareLabel: string }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, visibleCount);
  const hasMore = rows.length > visibleCount;

  return (
    <div>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b text-muted-foreground text-left">
            <th className="py-1.5 pr-1 font-medium">L2 Stage</th>
            <th className="py-1.5 pr-1 font-medium">Lender</th>
            <th className="py-1.5 pr-1 font-medium">Flow</th>
            <th className="py-1.5 pr-1 text-right font-medium">MTD</th>
            <th className="py-1.5 pr-1 text-right font-medium">{compareLabel}</th>
            <th className="py-1.5 text-right font-medium">Vol Δ%</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((r, i) => (
            <tr key={`${r.sub_stage}-${r.lender}-${r.flow}-${i}`} className={cn(
              "border-b border-border/40",
              r.countDiffPct != null && r.countDiffPct > 10 ? "bg-red-50/40 dark:bg-red-900/10" :
              r.countDiffPct != null && r.countDiffPct < -10 ? "bg-emerald-50/30 dark:bg-emerald-900/10" : ""
            )}>
              <td className="py-1.5 pr-1 font-medium text-foreground max-w-[130px]" title={r.sub_stage}>
                <span className="truncate block text-[11px]">
                  {r.is_terminal && <span className="text-red-500 mr-0.5">●</span>}
                  {r.sub_stage}
                </span>
              </td>
              <td className="py-1.5 pr-1 text-[11px] font-medium">{r.lender}</td>
              <td className="py-1.5 pr-1 text-[11px] text-muted-foreground">{r.flow}</td>
              <td className="py-1.5 pr-1 text-right tabular-nums">{r.leads.toLocaleString("en-IN")}</td>
              <td className="py-1.5 pr-1 text-right tabular-nums text-muted-foreground">{r.lmtd_leads > 0 ? r.lmtd_leads.toLocaleString("en-IN") : "—"}</td>
              <td className={cn(
                "py-1.5 text-right tabular-nums font-semibold",
                r.countDiffPct != null && r.countDiffPct > 10 ? "text-red-600" :
                r.countDiffPct != null && r.countDiffPct > 0 ? "text-red-500" :
                r.countDiffPct != null && r.countDiffPct < -10 ? "text-emerald-600" :
                r.countDiffPct != null && r.countDiffPct < 0 ? "text-emerald-500" :
                "text-muted-foreground"
              )}>
                {r.countDiffPct != null ? `${r.countDiffPct >= 0 ? "+" : ""}${r.countDiffPct.toFixed(1)}%` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-2 w-full text-center text-[11px] font-medium text-primary hover:text-primary/80 transition-colors py-1.5 rounded-md border border-dashed border-primary/30 hover:bg-primary/5"
        >
          {expanded ? `Show less ↑` : `Show all ${rows.length} combinations ↓`}
        </button>
      )}
    </div>
  );
}

export function StageDetailContent({
  stage,
  isTopLeak = false,
  hasLenderAllocation,
  structuralRow,
  globalVsSpecificRow,
  compareLabel,
  periodLabel,
  lenderProgramRows,
  lenderRows,
  flowRows,
  lenderL2Rows,
  flowLenderInsightRows,
  subStages,
  prevStageName,
  failureReasons,
  onLenderProgramClick,
  onLenderClick,
  onFlowClick,
  onL2Click,
  onInsightClick,
  onViewFullTable,
}: StageDetailContentProps) {
  const [activeTab, setActiveTab] = useState<"insights" | "lender" | "l2">("insights");
  const [tabHint, setTabHint] = useState(false);
  const [insightHint, setInsightHint] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [expandedBuckets, setExpandedBuckets] = useState<Set<SeverityBucket>>(new Set());
  const [lenderGuideOpen, setLenderGuideOpen] = useState(false);
  const [expandedLenderCats, setExpandedLenderCats] = useState<Set<string>>(new Set(["hero", "concern"]));
  const [l2GuideOpen, setL2GuideOpen] = useState(false);
  const [expandedL2Cats, setExpandedL2Cats] = useState<Set<string>>(new Set(["worsened"]));

  const toggleBucket = useCallback((b: SeverityBucket) => {
    setExpandedBuckets((prev) => {
      const next = new Set(prev);
      if (next.has(b)) next.delete(b); else next.add(b);
      return next;
    });
  }, []);

  const toggleLenderCat = useCallback((cat: string) => {
    setExpandedLenderCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }, []);

  const toggleL2Cat = useCallback((cat: string) => {
    setExpandedL2Cats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = localStorage.getItem("funnel_hint_stage_tabs");
    if (!seen) setTabHint(true);
    const seenInsight = localStorage.getItem("funnel_hint_insight_click");
    if (!seenInsight) setInsightHint(true);
  }, []);

  const dismissTabHint = () => {
    setTabHint(false);
    if (typeof window !== "undefined") localStorage.setItem("funnel_hint_stage_tabs", "1");
  };
  const dismissInsightHint = () => {
    setInsightHint(false);
    if (typeof window !== "undefined") localStorage.setItem("funnel_hint_insight_click", "1");
  };

  const volumeChangePct =
    stage.lmtdLeads > 0
      ? parseFloat((((stage.leads - stage.lmtdLeads) / stage.lmtdLeads) * 100).toFixed(2))
      : null;

  // ── Classify every row into exactly one severity bucket ───────────
  // Bucket is determined by EITHER stage throughput drop OR stuck count increase — whichever is worse.
  type InsightItem = { label: string; lender: string; flow: string; mtdLeads: number; lmtdLeads: number; countDiffPct: number | null; stuckDiffPct: number | null; bucket: SeverityBucket; classifiedBy: "throughput" | "stuck" | "both" };
  const buckets: Record<SeverityBucket, InsightItem[]> = { p0: [], p1: [], good: [], better: [], top: [] };

  const sourceRows = hasLenderAllocation
    ? flowLenderInsightRows.map((r) => ({ label: `${r.lender} × ${r.flow}`, lender: r.lender, flow: r.flow, mtdLeads: r.mtdLeads, lmtdLeads: r.lmtdLeads, countDiffPct: r.countDiffPct }))
    : flowRows.map((r) => ({ label: r.flow, lender: "", flow: r.flow, mtdLeads: r.mtdLeads, lmtdLeads: r.lmtdLeads, countDiffPct: r.countDiffPct }));

  sourceRows.forEach((r) => {
    const l2ForItem = subStages.flatMap((ss) =>
      ss.lender_flow_detail
        .filter((d) => {
          if (hasLenderAllocation) return d.lender === r.lender && (d.flow.includes(r.flow) || r.flow.includes(d.flow.replace("Flow1(Auto)", "Auto").replace("Flow2(Manual)", "Manual")));
          return true;
        })
        .map((d) => ({ leads: d.leads, lmtd_leads: d.lmtd_leads }))
    );
    const totalStuckMTD = l2ForItem.reduce((s, x) => s + x.leads, 0);
    const totalStuckLMTD = l2ForItem.reduce((s, x) => s + x.lmtd_leads, 0);
    const stuckDiffPct = totalStuckLMTD > 0 ? parseFloat((((totalStuckMTD - totalStuckLMTD) / totalStuckLMTD) * 100).toFixed(1)) : null;

    const throughputBucket = classifyCountDiff(r.countDiffPct);
    const stuckBucket = classifyStuckCountDiff(stuckDiffPct);
    const bucket = worstBucket(throughputBucket, stuckBucket);

    const classifiedBy: "throughput" | "stuck" | "both" =
      throughputBucket && stuckBucket && throughputBucket === stuckBucket ? "both"
      : bucket === throughputBucket ? "throughput" : "stuck";

    if (bucket) buckets[bucket].push({ ...r, stuckDiffPct, bucket, classifiedBy });
  });
  const severitySort = (a: InsightItem, b: InsightItem) => {
    const aWorst = Math.min(a.countDiffPct ?? 0, -(a.stuckDiffPct ?? 0));
    const bWorst = Math.min(b.countDiffPct ?? 0, -(b.stuckDiffPct ?? 0));
    return aWorst - bWorst;
  };
  buckets.p0.sort(severitySort);
  buckets.p1.sort(severitySort);
  buckets.good.sort((a, b) => -severitySort(a, b));
  buckets.better.sort((a, b) => -severitySort(a, b));
  buckets.top.sort((a, b) => -severitySort(a, b));

  const insightLabel = hasLenderAllocation ? "flow × lender" : "flow";
  const anyInsightItems = BUCKET_ORDER.some((b) => buckets[b].length > 0);

  // ── Lender funnel: group flowLenderInsightRows by lender ───────────
  const lenderFunnelData = hasLenderAllocation
    ? (() => {
        const byLender: Record<string, FlowLenderInsightRow[]> = {};
        flowLenderInsightRows.forEach((r) => {
          if (!byLender[r.lender]) byLender[r.lender] = [];
          byLender[r.lender].push(r);
        });
        Object.values(byLender).forEach((arr) => arr.sort((a, b) => (b.mtdConv ?? 0) - (a.mtdConv ?? 0)));
        const sortedLenders = lenderRows
          .slice()
          .sort((a, b) => (b.mtdConv ?? 0) - (a.mtdConv ?? 0));
        let heroLender = "";
        let heroFlow = "";
        let heroConv = -1;
        flowLenderInsightRows.forEach((r) => {
          if (r.mtdConv !== null && r.mtdConv > heroConv) {
            heroConv = r.mtdConv;
            heroLender = r.lender;
            heroFlow = r.flow;
          }
        });
        return { byLender, sortedLenders, heroLender, heroFlow, heroConv };
      })()
    : null;

  // ── C1/C2: Decision header derivations ──────────────────────
  const whyType = useMemo(() => deriveWhyType(stage.index), [stage.index]);
  const urgency = useMemo(() => deriveUrgency(stage.deltaPp, stage.leads), [stage.deltaPp, stage.leads]);
  const whyStyle = WHY_STYLE[whyType];
  const urgStyle = URGENCY_STYLE[urgency];
  const isRegression = whyType === "Product" || whyType === "Tech";
  const [narrativesOpen, setNarrativesOpen] = useState(true);

  // ── C3: Narrative section content derivations ──────────────
  const leadDrop = stage.lmtdLeads > 0 ? stage.lmtdLeads - stage.leads : 0;
  const avgTicket = 85000;
  const lossCrEom = ((Math.abs(leadDrop) * avgTicket) / 1e7) * (28 / 23);
  const lossCrEod = lossCrEom / 28;
  const scopeLabel = (() => {
    const lenderCount = flowLenderInsightRows.length > 0
      ? new Set(flowLenderInsightRows.map((r) => r.lender)).size
      : 0;
    if (lenderCount <= 1 && flowRows.length <= 1) return "Specific";
    return "Global";
  })();

  // Top worsening flow/lender for "what is happening" narrative
  const topWorseningCombo = useMemo(() => {
    const sorted = [...flowLenderInsightRows].sort((a, b) => (a.countDiffPct ?? 0) - (b.countDiffPct ?? 0));
    return sorted[0] ?? null;
  }, [flowLenderInsightRows]);

  // Merchant cohort narrative (mock heuristic based on stage)
  const cohortNarrative = useMemo(() => {
    const idx = stage.index;
    if (idx <= 5) return "Drop is concentrated in new merchants (0-6M vintage) with ticket < ₹1L.";
    if (idx <= 8) return "Impact is highest among Tier-2+ city merchants with MCRS decile 3-4.";
    if (idx <= 12) return "BRE-stage drop affects high-ticket (>₹2L) merchants in Retail & Shopping.";
    return "Late-stage drop distributed across all cohorts — likely systemic.";
  }, [stage.index]);

  // Pattern match (mock: link to recurring patterns)
  const patternMatch = useMemo(() => {
    const idx = stage.index;
    if (idx === 12) return { seen: true, lastDate: "Feb 14", fix: "Ops batch schedule adjustment resolved it in 4hrs." };
    if (idx === 8) return { seen: true, lastDate: "Jan 22", fix: "KYC vendor SLA escalation restored normal rate." };
    if (idx === 9 || idx === 10) return { seen: true, lastDate: "Jan 3", fix: "Quarter-start BRE tightening — Risk team confirmed expected." };
    return { seen: false, lastDate: null, fix: null };
  }, [stage.index]);

  return (
    <div className="space-y-4 px-1">
      {/* ── C1/C2: Decision Header Badges ─────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn("text-[10px] px-2 py-1 rounded-full inline-flex items-center gap-1", whyStyle.cls)}>
          <span>{whyStyle.icon}</span>
          <span>{whyType}</span>
        </span>
        <span className={cn("text-[10px] px-2 py-1 rounded-full inline-flex items-center gap-1", urgStyle.cls)}>
          <span>{urgStyle.icon}</span>
          <span>{urgStyle.label}</span>
        </span>
        <span className="text-[10px] px-2 py-1 rounded-full bg-muted text-muted-foreground">
          {scopeLabel}
        </span>
        {leadDrop > 0 && (
          <span className="text-[10px] px-2 py-1 rounded-full bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 tabular-nums">
            ~₹{lossCrEom.toFixed(1)} Cr at risk
          </span>
        )}
      </div>

      {/* ── Overall KPIs (top) ───────────────────────────────────── */}
      <div data-tour="stage-kpis">
        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Overall
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-muted/20 p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">MTD count</p>
            <p className="text-lg font-bold tabular-nums">{stage.leads.toLocaleString("en-IN")}</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">{compareLabel} count</p>
            <p className="text-lg font-bold tabular-nums">{stage.lmtdLeads.toLocaleString("en-IN")}</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">Count diff %</p>
            <p className={cn(
              "text-lg font-bold tabular-nums",
              volumeChangePct != null && volumeChangePct < 0 ? "text-red-600" : volumeChangePct != null && volumeChangePct > 0 ? "text-emerald-600" : "text-foreground"
            )}>
              {volumeChangePct != null ? `${volumeChangePct >= 0 ? "+" : ""}${volumeChangePct}%` : "—"}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">Conv diff (pp)</p>
            <p className={cn(
              "text-lg font-bold tabular-nums",
              stage.deltaPp != null && stage.deltaPp < 0 ? "text-red-600" : stage.deltaPp != null && stage.deltaPp > 0 ? "text-emerald-600" : "text-foreground"
            )}>
              {stage.deltaPp != null ? `${stage.deltaPp >= 0 ? "+" : ""}${stage.deltaPp.toFixed(2)}pp` : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* ── C3: Narrative Sections (Stage diagnosis — expanded by default) ────────────────────────────── */}
      <button
        type="button"
        onClick={() => setNarrativesOpen((v) => !v)}
        className={cn(
          "w-full rounded-lg border px-3 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          isRegression
            ? "bg-red-50/50 border-red-200 dark:bg-red-900/15 dark:border-red-800/40 hover:bg-red-100/40"
            : "bg-muted/30 border-border hover:bg-muted/50"
        )}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-foreground">
            {isRegression ? "⚠ Likely regression — see details" : "Stage diagnosis"}
          </span>
          <span className="text-muted-foreground text-xs">{narrativesOpen ? "▲" : "▼"}</span>
        </div>
      </button>
      {narrativesOpen && (
        <div className={cn(
          "rounded-lg border px-3 py-2.5 space-y-3 -mt-2 border-t-0 rounded-t-none text-[11px]",
          isRegression ? "bg-red-50/30 border-red-200 dark:bg-red-900/10 dark:border-red-800/40" : "bg-muted/20 border-border"
        )}>
          {/* What is happening? */}
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">What is happening?</p>
            <p className="text-foreground leading-relaxed">
              {stage.name.replace(/_/g, " ")} conversion {stage.deltaPp != null && stage.deltaPp < 0 ? "dropped" : "changed"}{" "}
              {stage.deltaPp != null ? `${Math.abs(stage.deltaPp).toFixed(1)}pp` : ""} vs {compareLabel}
              {topWorseningCombo && hasLenderAllocation && (
                <>, driven by <span className="font-semibold">{topWorseningCombo.lender}</span> in {topWorseningCombo.flow}</>
              )}.
            </p>
          </div>
          {/* Who is getting impacted? */}
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Who is getting impacted?</p>
            <p className="text-foreground leading-relaxed">{cohortNarrative}</p>
          </div>
          {/* Is this expected or a regression? */}
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Is this expected or a regression?</p>
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-[10px] px-2 py-0.5 rounded-full font-semibold",
                whyType === "Business" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                patternMatch.seen ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              )}>
                {whyType === "Business" ? "Expected business behaviour" : patternMatch.seen ? "Known recurring pattern" : "Abnormal — likely regression"}
              </span>
            </div>
          </div>
          {/* If we do nothing... */}
          {leadDrop > 0 && (
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">If we do nothing...</p>
              <p className="text-foreground leading-relaxed">
                At current pace, <span className="font-bold text-red-600 dark:text-red-400">~₹{lossCrEom.toFixed(1)} Cr</span> additional loss by month-end
                {lossCrEod > 0.1 && (<> (<span className="font-semibold">~₹{lossCrEod.toFixed(1)} Cr by EOD</span>)</>)}.
              </p>
            </div>
          )}
          {/* Have we seen this before? */}
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Have we seen this before?</p>
            {patternMatch.seen ? (
              <p className="text-foreground leading-relaxed">
                <span className="font-semibold text-amber-600 dark:text-amber-400">Yes</span> — last seen {patternMatch.lastDate}. {patternMatch.fix}
              </p>
            ) : (
              <p className="text-foreground leading-relaxed">
                <span className="font-semibold text-red-600 dark:text-red-400">No</span> — first occurrence this month. Needs fresh investigation.
              </p>
            )}
          </div>
          {/* Recommended action */}
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Recommended action</p>
            <p className="text-foreground leading-relaxed">
              {whyType === "Risk" && "Review BRE rule changes with Risk team. Check if policy tightening is intentional."}
              {whyType === "Tech" && "Escalate to Eng — check vendor SLA, SDK errors, or infra degradation."}
              {whyType === "Product" && "Review routing/pricing logic changes deployed this week. Loop in Eng + Product."}
              {whyType === "Business" && "No immediate action needed — monitor and revisit if trend persists past 3 days."}
            </p>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div data-tour="stage-tabs" className="flex gap-1 bg-muted/30 rounded-lg p-1">
        <button
          data-tour="tab-insights"
          type="button"
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
            activeTab === "insights" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => { setActiveTab("insights"); dismissTabHint(); }}
        >
          Business Insights
        </button>
        {hasLenderAllocation && (
          <button
            data-tour="tab-lender"
            type="button"
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
              activeTab === "lender" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => { setActiveTab("lender"); dismissTabHint(); }}
          >
            Lender Funnel
          </button>
        )}
        <button
          data-tour="tab-l2"
          type="button"
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
            activeTab === "l2" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => { setActiveTab("l2"); dismissTabHint(); }}
        >
          L2 Breakdown
        </button>
      </div>
      <PulseHint
        text="Switch tabs to see Lender Funnel & L2 sub-stage breakdown"
        visible={tabHint}
        onDismiss={dismissTabHint}
      />

      {/* ── TAB: Business Insights ────────────────────────────────── */}
      {activeTab === "insights" && (
        <>
          <PulseHint
            text="Click any row below to open a lender × flow deep-dive with L2 sub-stages"
            visible={insightHint}
            onDismiss={dismissInsightHint}
          />

          {/* Collapsible guide */}
          <button
            type="button"
            onClick={() => setGuideOpen((v) => !v)}
            className="w-full rounded-lg border bg-blue-50/60 dark:bg-blue-900/15 border-blue-200 dark:border-blue-800/40 px-3.5 py-2 text-left transition-colors hover:bg-blue-100/50 dark:hover:bg-blue-900/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-foreground">
                <span className="font-semibold">ℹ How to read this:</span>{" "}
                {!guideOpen && (
                  <span className="text-muted-foreground">Classified by throughput or stuck rate — <span className="text-red-600 font-medium">P0</span> needs action, <span className="text-emerald-600 font-medium">Good/Better</span> performing well.</span>
                )}
              </p>
              <span className="text-muted-foreground text-xs ml-2 shrink-0">{guideOpen ? "▲" : "▼"}</span>
            </div>
          </button>
          {guideOpen && (
            <div className="rounded-lg border bg-blue-50/60 dark:bg-blue-900/15 border-blue-200 dark:border-blue-800/40 px-3.5 py-2.5 space-y-2 -mt-1 border-t-0 rounded-t-none">
              <p className="text-[11px] text-foreground leading-relaxed">
                Every {insightLabel} combination is classified by <span className="font-medium">either</span> its stage throughput change <span className="font-medium">or</span> stuck lead count change vs {compareLabel} — whichever is worse.
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-600 shrink-0" /><span><span className="font-semibold">P0</span> — ≥20% drop / stuck increase. <span className="font-semibold text-red-600">Immediate action</span>.</span></div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" /><span><span className="font-semibold">P1</span> — 1-20% drop / stuck increase. <span className="font-semibold text-amber-600">Monitor</span>.</span></div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" /><span><span className="font-semibold">Good</span> — 1-15% gain / stuck reduction. <span className="font-semibold text-emerald-600">Maintain</span>.</span></div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" /><span><span className="font-semibold">Better / Top</span> — 15%+ gain / stuck reduction. <span className="font-semibold text-emerald-600">Scale</span>.</span></div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                <span className="font-medium">Next step:</span> Click any row to open a deep-dive with stuck count, stuck rate and L2 sub-stage breakdown.
              </p>
            </div>
          )}

          {BUCKET_ORDER.map((bKey) => {
            const items = buckets[bKey];
            if (items.length === 0) return null;
            const meta = BUCKET_META[bKey];
            const isExpanded = expandedBuckets.has(bKey);

            const narrativeCount = Math.min(3, items.length);
            const stuckBetween = prevStageName ? `between ${prevStageName} → ${stage.name}` : `at ${stage.name}`;
            const narrativeItems = items.slice(0, narrativeCount).map((item) => {
              const l2ForCombo = subStages.flatMap((ss) =>
                ss.lender_flow_detail
                  .filter((d) => {
                    if (hasLenderAllocation) return d.lender === item.lender && (d.flow.includes(item.flow) || item.flow.includes(d.flow.replace("Flow1(Auto)", "Auto").replace("Flow2(Manual)", "Manual")));
                    return true;
                  })
                  .map((d) => ({ sub_stage: ss.sub_stage, leads: d.leads, lmtd_leads: d.lmtd_leads, countDiffPct: d.countDiffPct, is_terminal: ss.is_terminal }))
              ).sort((a, b) => b.leads - a.leads);

              const totalStuckMTD = l2ForCombo.reduce((s, r) => s + r.leads, 0);
              const totalStuckLMTD = l2ForCombo.reduce((s, r) => s + r.lmtd_leads, 0);
              const topBlocker = l2ForCombo[0];

              // C4: Cause → Effect → Action narrative format
              const itemLossCr = ((Math.abs(item.lmtdLeads - item.mtdLeads) * 85000) / 1e7);
              let narrative = "";
              if (bKey === "p0" || bKey === "p1") {
                const cause = item.classifiedBy === "stuck" || item.classifiedBy === "both"
                  ? `${item.label} stuck leads ${stuckBetween} increased ${item.stuckDiffPct != null ? `${item.stuckDiffPct.toFixed(1)}%` : ""}`
                  : `${item.label} throughput fell ${item.countDiffPct?.toFixed(1)}%`;
                const effect = itemLossCr >= 0.1
                  ? `, costing ~₹${itemLossCr.toFixed(1)} Cr`
                  : ` (${item.mtdLeads.toLocaleString("en-IN")} vs ${item.lmtdLeads.toLocaleString("en-IN")})`;
                const blocker = topBlocker ? ` via ${topBlocker.sub_stage.replace(/_/g, " ")}` : "";
                const action = whyType === "Risk" ? "Review with Risk."
                  : whyType === "Tech" ? "Escalate to Eng."
                  : whyType === "Product" ? "Review with Eng + Product."
                  : "Monitor trend.";
                narrative = `${cause}${blocker}${effect}. ${action}`;
              } else {
                const cause = item.classifiedBy === "stuck" || item.classifiedBy === "both"
                  ? `${item.label} stuck leads ${stuckBetween} reduced ${item.stuckDiffPct?.toFixed(1)}%`
                  : `${item.label} throughput up ${item.countDiffPct != null ? `+${item.countDiffPct.toFixed(1)}%` : ""}`;
                const effect = topBlocker ? `. Top L2: ${topBlocker.sub_stage.replace(/_/g, " ")} (${topBlocker.leads.toLocaleString("en-IN")})` : "";
                narrative = `${cause}${effect}. Replicate config.`;
              }
              return { ...item, narrative };
            });
            const narrativeLabels = new Set(narrativeItems.map((ni) => ni.label));
            const remainingItems = items.filter((item) => !narrativeLabels.has(item.label));

            return (
              <div key={bKey}>
                {/* Collapsible bucket header */}
                <button
                  type="button"
                  onClick={() => toggleBucket(bKey)}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors",
                    isExpanded ? "rounded-b-none border-b-0" : "",
                    meta.border, meta.bg, meta.hover,
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", meta.dot)} />
                    <span className={cn("text-xs font-semibold", meta.text)}>{meta.title}</span>
                    <span className={cn(
                      "text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center tabular-nums",
                      bKey === "p0" ? "bg-red-600 text-white" :
                      bKey === "p1" ? "bg-amber-500 text-white" :
                      bKey === "good" ? "bg-emerald-500 text-white" :
                      "bg-emerald-600 text-white"
                    )}>
                      {items.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isExpanded && (
                      <span className="text-[10px] text-muted-foreground hidden sm:inline">
                        {items.length} combination{items.length > 1 ? "s" : ""}
                      </span>
                    )}
                    <span className="text-muted-foreground text-xs">{isExpanded ? "▲" : "▼"}</span>
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className={cn("rounded-lg rounded-t-none border border-t-0 px-3 py-2.5 space-y-2", meta.border, meta.bg)}>
                    {/* Narrative highlights — top 3, clickable to deep-dive */}
                    <div className="space-y-1">
                      {narrativeItems.map((ni, idx) => (
                        <button
                          key={`nar-${bKey}-${idx}`}
                          type="button"
                          onClick={() => { dismissInsightHint(); onInsightClick?.(ni.lender, ni.flow); }}
                          className="w-full text-left group"
                        >
                          <p className="text-[11px] text-foreground leading-relaxed">
                            <span className={cn("font-semibold", bKey === "p0" || bKey === "p1" ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400")}>→</span>{" "}
                            {ni.narrative}
                            {" "}<span className="text-[9px] text-muted-foreground/70 ml-0.5">[{ni.classifiedBy === "both" ? "throughput + stuck" : ni.classifiedBy === "stuck" ? "stuck rate" : "throughput"}]</span>
                            <span className="text-[10px] text-muted-foreground ml-1 group-hover:text-primary transition-colors">View →</span>
                          </p>
                        </button>
                      ))}
                    </div>

                    {/* Remaining items */}
                    {remainingItems.length > 0 && (
                      <ul className="space-y-1.5 pt-1 border-t border-border/30">
                        {remainingItems.map((item, i) => (
                          <li key={`${bKey}-rem-${i}`}>
                            <button
                              type="button"
                              onClick={() => { dismissInsightHint(); onInsightClick?.(item.lender, item.flow); }}
                              className={cn(
                                "w-full rounded-lg border p-2.5 text-left transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                                meta.border, "bg-background/50", meta.hover
                              )}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold text-foreground">{item.label}</span>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[9px] text-muted-foreground/70">[{item.classifiedBy === "both" ? "throughput + stuck" : item.classifiedBy === "stuck" ? "stuck rate" : "throughput"}]</span>
                                  <span className="text-[10px] text-muted-foreground">Deep-dive →</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-[11px] tabular-nums flex-wrap">
                                <span className="text-muted-foreground">Throughput <span className={cn("font-semibold", (item.countDiffPct ?? 0) < 0 ? "text-red-600" : (item.countDiffPct ?? 0) > 0 ? "text-emerald-600" : "text-foreground")}>{item.countDiffPct != null ? `${item.countDiffPct >= 0 ? "+" : ""}${item.countDiffPct.toFixed(1)}%` : "—"}</span></span>
                                <span className="text-muted-foreground">Stuck <span className={cn("font-semibold", (item.stuckDiffPct ?? 0) > 0 ? "text-red-600" : (item.stuckDiffPct ?? 0) < 0 ? "text-emerald-600" : "text-foreground")}>{item.stuckDiffPct != null ? `${item.stuckDiffPct >= 0 ? "+" : ""}${item.stuckDiffPct.toFixed(1)}%` : "—"}</span></span>
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {!anyInsightItems && (flowRows.length > 0 || flowLenderInsightRows.length > 0) && (
            <p className="text-xs text-muted-foreground">No significant volume changes vs {compareLabel} at {insightLabel} level.</p>
          )}
        </>
      )}

      {/* ── TAB: Lender Funnel (post-allocation stages only) ──────── */}
      {activeTab === "lender" && lenderFunnelData && (() => {
        type TaggedLender = typeof lenderFunnelData.sortedLenders[number] & { tag: string };
        const taggedLenders: TaggedLender[] = lenderFunnelData.sortedLenders.map((lr) => {
          const pp = lr.deltaPp ?? 0;
          let tag = "stable";
          if (lr.lender === lenderFunnelData.heroLender) tag = "hero";
          else if (pp <= -3) tag = "concern";
          else if (pp < -0.1) tag = "declining";
          else if (pp >= 3) tag = "strong";
          else if (pp > 0.1) tag = "improving";
          return { ...lr, tag };
        });

        const LENDER_CAT_ORDER = [
          { key: "hero", title: "Best funnel", dot: "bg-amber-500", badge: "bg-amber-500 text-white", border: "border-amber-200 dark:border-amber-700/50", bg: "bg-amber-50/50 dark:bg-amber-900/10", hover: "hover:bg-amber-100/50 dark:hover:bg-amber-900/20" },
          { key: "concern", title: "Concern (≥3pp drop)", dot: "bg-red-600", badge: "bg-red-600 text-white", border: "border-red-300 dark:border-red-700/50", bg: "bg-red-50/60 dark:bg-red-900/15", hover: "hover:bg-red-100/50 dark:hover:bg-red-900/25" },
          { key: "declining", title: "Declining (0.1–3pp drop)", dot: "bg-amber-500", badge: "bg-amber-500 text-white", border: "border-amber-200 dark:border-amber-700/50", bg: "bg-amber-50/50 dark:bg-amber-900/10", hover: "hover:bg-amber-100/50 dark:hover:bg-amber-900/20" },
          { key: "stable", title: "Stable", dot: "bg-slate-400", badge: "bg-slate-500 text-white", border: "border-border", bg: "bg-muted/30", hover: "hover:bg-muted/50" },
          { key: "improving", title: "Improving (0.1–3pp gain)", dot: "bg-emerald-400", badge: "bg-emerald-500 text-white", border: "border-emerald-200 dark:border-emerald-700/50", bg: "bg-emerald-50/50 dark:bg-emerald-900/10", hover: "hover:bg-emerald-100/50 dark:hover:bg-emerald-900/20" },
          { key: "strong", title: "Strong (≥3pp gain)", dot: "bg-emerald-600", badge: "bg-emerald-600 text-white", border: "border-emerald-300 dark:border-emerald-700/50", bg: "bg-emerald-50/60 dark:bg-emerald-900/15", hover: "hover:bg-emerald-100/50 dark:hover:bg-emerald-900/25" },
        ];

        const renderLenderCard = (lr: TaggedLender) => {
          const flowsForLender = lenderFunnelData.byLender[lr.lender] || [];
          return (
            <div key={lr.lender} className="rounded-lg border overflow-hidden bg-background/50">
              <div className="px-3 py-2 bg-muted/20">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground flex-1">{lr.lender}</span>
                  <span className={cn("font-semibold text-[11px] tabular-nums",
                    lr.deltaPp != null && lr.deltaPp < 0 ? "text-red-600" : lr.deltaPp != null && lr.deltaPp > 0 ? "text-emerald-600" : "text-muted-foreground"
                  )}>
                    {lr.deltaPp != null ? `${lr.deltaPp >= 0 ? "+" : ""}${lr.deltaPp.toFixed(2)}pp` : "—"}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1 text-[11px] tabular-nums">
                  <span className="text-muted-foreground">MTD <span className="text-foreground font-semibold">{lr.mtdLeads.toLocaleString("en-IN")}</span></span>
                  <span className="text-muted-foreground">{compareLabel} <span className="text-foreground font-semibold">{lr.lmtdLeads.toLocaleString("en-IN")}</span></span>
                  <span className="text-muted-foreground">Conv <span className="text-foreground font-semibold">{lr.mtdConv !== null ? `${lr.mtdConv.toFixed(1)}%` : "—"}</span></span>
                </div>
              </div>
              {flowsForLender.length > 0 && (
                <div className="divide-y divide-border/40">
                  {flowsForLender.map((fr) => (
                    <div key={`${fr.lender}-${fr.flow}`} className="px-3 py-1.5 text-[11px]">
                      <div className="flex items-center gap-3">
                        <span className="flex-1 pl-3 text-muted-foreground">{fr.flow}</span>
                        <span className="tabular-nums w-14 text-right font-medium">{fr.mtdConv !== null ? `${fr.mtdConv.toFixed(1)}%` : "—"}</span>
                        <span className={cn("tabular-nums w-16 text-right font-medium",
                          fr.deltaPp != null && fr.deltaPp < 0 ? "text-red-600" : fr.deltaPp != null && fr.deltaPp > 0 ? "text-emerald-600" : "text-muted-foreground"
                        )}>
                          {fr.deltaPp != null ? `${fr.deltaPp >= 0 ? "+" : ""}${fr.deltaPp.toFixed(2)}pp` : "—"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 pl-3 mt-0.5">
                        <span className="text-[10px] text-muted-foreground tabular-nums">MTD <span className="text-foreground font-medium">{fr.mtdLeads.toLocaleString("en-IN")}</span></span>
                        <span className="text-[10px] text-muted-foreground tabular-nums">{compareLabel} <span className="text-foreground font-medium">{fr.lmtdLeads.toLocaleString("en-IN")}</span></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        };

        return (
          <div className="space-y-2">
            {/* Collapsible guide */}
            <button
              type="button"
              onClick={() => setLenderGuideOpen((v) => !v)}
              className="w-full rounded-lg border bg-blue-50/60 dark:bg-blue-900/15 border-blue-200 dark:border-blue-800/40 px-3.5 py-2 text-left transition-colors hover:bg-blue-100/50 dark:hover:bg-blue-900/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-foreground">
                  <span className="font-semibold">ℹ How to read this:</span>{" "}
                  {!lenderGuideOpen && <span className="text-muted-foreground">Lender × flow conv grouped by performance — <span className="text-red-600 font-medium">Concern</span> first.</span>}
                </p>
                <span className="text-muted-foreground text-xs ml-2 shrink-0">{lenderGuideOpen ? "▲" : "▼"}</span>
              </div>
            </button>
            {lenderGuideOpen && (
              <div className="rounded-lg border bg-blue-50/60 dark:bg-blue-900/15 border-blue-200 dark:border-blue-800/40 px-3.5 py-2.5 space-y-1.5 -mt-1 border-t-0 rounded-t-none text-[10px]">
                <p className="text-foreground">Lenders grouped by conversion change vs {compareLabel}. <span className="text-red-600 font-medium">Concern</span> = ≥3pp drop. <span className="text-amber-600 font-medium">Declining</span> = slight drop. <span className="text-emerald-600 font-medium">Improving/Strong</span> = gaining.</p>
                <p className="text-muted-foreground"><span className="font-medium">Next step:</span> For concern lenders, check L2 sub-stages via Business Insights. For strong combos, replicate config.</p>
              </div>
            )}

            {/* Category accordion sections */}
            {LENDER_CAT_ORDER.map((cat) => {
              const lendersInCat = taggedLenders.filter((lr) => lr.tag === cat.key);
              if (lendersInCat.length === 0) return null;
              const isCatExpanded = expandedLenderCats.has(cat.key);

              return (
                <div key={cat.key}>
                  <button
                    type="button"
                    onClick={() => toggleLenderCat(cat.key)}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors",
                      isCatExpanded ? "rounded-b-none border-b-0" : "",
                      cat.border, cat.bg, cat.hover,
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", cat.dot)} />
                      <span className="text-xs font-semibold text-foreground">{cat.title}</span>
                      <span className={cn("text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center tabular-nums", cat.badge)}>
                        {lendersInCat.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isCatExpanded && (
                        <span className="text-[10px] text-muted-foreground hidden sm:inline">
                          {lendersInCat.length} lender{lendersInCat.length > 1 ? "s" : ""}
                        </span>
                      )}
                      <span className="text-muted-foreground text-xs">{isCatExpanded ? "▲" : "▼"}</span>
                    </div>
                  </button>
                  {isCatExpanded && (
                    <div className={cn("rounded-lg rounded-t-none border border-t-0 px-2 py-2 space-y-2", cat.border, cat.bg)}>
                      {lendersInCat.map((lr) => renderLenderCard(lr))}
                    </div>
                  )}
                </div>
              );
            })}

            {lenderFunnelData.sortedLenders.length === 0 && (
              <p className="text-xs text-muted-foreground">No lender-level data available for this stage.</p>
            )}
          </div>
        );
      })()}

      {/* ── TAB: L2 Breakdown ─────────────────────────────────────── */}
      {activeTab === "l2" && (() => {
        const flatRows = subStages
          .flatMap((ss) =>
            ss.lender_flow_detail.map((d) => ({
              sub_stage: ss.sub_stage,
              lender: d.lender,
              flow: d.flow === "Flow1(Auto)" ? "Auto" : d.flow === "Flow2(Manual)" ? "Manual" : d.flow,
              rawFlow: d.flow,
              leads: d.leads,
              lmtd_leads: d.lmtd_leads,
              countDiffPct: d.countDiffPct,
              is_terminal: ss.is_terminal,
            }))
          )
          .sort((a, b) => (b.countDiffPct ?? 0) - (a.countDiffPct ?? 0));
        const totalStuck = flatRows.reduce((s, r) => s + r.leads, 0);
        const totalLmtdStuck = flatRows.reduce((s, r) => s + r.lmtd_leads, 0);
        const overallCountDiff = totalLmtdStuck > 0 ? ((totalStuck - totalLmtdStuck) / totalLmtdStuck) * 100 : 0;

        const worsenedRows = flatRows.filter((r) => r.countDiffPct != null && r.countDiffPct > 1);
        const improvedRows = flatRows.filter((r) => r.countDiffPct != null && r.countDiffPct < -1);
        const stableRows = flatRows.filter((r) => r.countDiffPct == null || (r.countDiffPct >= -1 && r.countDiffPct <= 1));

        const L2_CAT_ORDER = [
          { key: "worsened", title: "Worsened (more stuck)", dot: "bg-red-600", badge: "bg-red-600 text-white", border: "border-red-300 dark:border-red-700/50", bg: "bg-red-50/60 dark:bg-red-900/15", hover: "hover:bg-red-100/50 dark:hover:bg-red-900/25", rows: worsenedRows },
          { key: "stable", title: "Stable", dot: "bg-slate-400", badge: "bg-slate-500 text-white", border: "border-border", bg: "bg-muted/30", hover: "hover:bg-muted/50", rows: stableRows },
          { key: "improved", title: "Improved (fewer stuck)", dot: "bg-emerald-500", badge: "bg-emerald-500 text-white", border: "border-emerald-200 dark:border-emerald-700/50", bg: "bg-emerald-50/50 dark:bg-emerald-900/10", hover: "hover:bg-emerald-100/50 dark:hover:bg-emerald-900/20", rows: improvedRows },
        ];

        return (
          <div className="space-y-2">
            {flatRows.length > 0 ? (
              <>
                {/* Collapsible summary */}
                <button
                  type="button"
                  onClick={() => setL2GuideOpen((v) => !v)}
                  className="w-full rounded-lg border bg-blue-50/60 dark:bg-blue-900/15 border-blue-200 dark:border-blue-800/40 px-3.5 py-2 text-left transition-colors hover:bg-blue-100/50 dark:hover:bg-blue-900/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-foreground">
                      <span className="font-semibold">ℹ Summary:</span>{" "}
                      <span className="font-semibold">{totalStuck.toLocaleString("en-IN")}</span> stuck
                      {prevStageName && <> between {prevStageName} → {stage.name}</>}
                      {" "}(<span className={cn("font-semibold", overallCountDiff > 0 ? "text-red-600" : "text-emerald-600")}>{overallCountDiff >= 0 ? "+" : ""}{overallCountDiff.toFixed(1)}%</span> vs {compareLabel})
                    </p>
                    <span className="text-muted-foreground text-xs ml-2 shrink-0">{l2GuideOpen ? "▲" : "▼"}</span>
                  </div>
                </button>
                {l2GuideOpen && (
                  <div className="rounded-lg border bg-blue-50/60 dark:bg-blue-900/15 border-blue-200 dark:border-blue-800/40 px-3.5 py-2.5 space-y-1.5 -mt-1 border-t-0 rounded-t-none text-[10px]">
                    <p className="text-foreground">
                      {overallCountDiff < 0 ? "Fewer stuck leads → funnel improved." : overallCountDiff > 0 ? "More stuck leads → needs attention." : "Stuck count flat."}
                      {" "}L2 sub-stages represent leads stuck between the previous major stage and this one. <span className="text-red-500">●</span> = terminal / rejected.
                    </p>
                    <p className="text-muted-foreground"><span className="font-medium">Next step:</span> <span className="text-red-600">+Δ% (red)</span> = more stuck = worse. <span className="text-emerald-600">-Δ% (green)</span> = fewer stuck = improved. Click any concern to deep-dive.</p>
                  </div>
                )}

                {/* Category accordion sections */}
                {L2_CAT_ORDER.map((cat) => {
                  if (cat.rows.length === 0) return null;
                  const isCatExpanded = expandedL2Cats.has(cat.key);

                  return (
                    <div key={cat.key}>
                      <button
                        type="button"
                        onClick={() => toggleL2Cat(cat.key)}
                        className={cn(
                          "w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors",
                          isCatExpanded ? "rounded-b-none border-b-0" : "",
                          cat.border, cat.bg, cat.hover,
                          "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", cat.dot)} />
                          <span className="text-xs font-semibold text-foreground">{cat.title}</span>
                          <span className={cn("text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center tabular-nums", cat.badge)}>
                            {cat.rows.length}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {!isCatExpanded && (
                            <span className="text-[10px] text-muted-foreground hidden sm:inline">
                              {cat.rows.length} combination{cat.rows.length > 1 ? "s" : ""}
                            </span>
                          )}
                          <span className="text-muted-foreground text-xs">{isCatExpanded ? "▲" : "▼"}</span>
                        </div>
                      </button>
                      {isCatExpanded && (
                        <div className={cn("rounded-lg rounded-t-none border border-t-0 px-2 py-2", cat.border, cat.bg)}>
                          <L2Table rows={cat.rows} visibleCount={5} compareLabel={compareLabel} />
                        </div>
                      )}
                    </div>
                  );
                })}

                <p className="text-[10px] text-muted-foreground">
                  {flatRows.length} total · MTD stuck: <span className="font-semibold text-foreground">{totalStuck.toLocaleString("en-IN")}</span>
                  {totalLmtdStuck > 0 && (<> · {compareLabel}: <span className="font-semibold text-foreground">{totalLmtdStuck.toLocaleString("en-IN")}</span></>)}
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">No L2 sub-stage data available for this stage.</p>
            )}
          </div>
        );
      })()}
    </div>
  );
}

interface StageDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stage: StageDrawerStage | null;
  isTopLeak?: boolean;
  hasLenderAllocation?: boolean;
  structuralRow: StructuralRow | undefined;
  globalVsSpecificRow: GlobalVsSpecificRow | undefined;
  compareLabel: string;
  periodLabel: string;
  lenderProgramRows: LenderProgramRow[];
  lenderRows: LenderRow[];
  flowRows: FlowRow[];
  lenderL2Rows: LenderL2Row[];
  flowLenderInsightRows: FlowLenderInsightRow[];
  subStages: SubStageRow[];
  prevStageName?: string;
  failureReasons: Record<string, { reason: string; pct: number }[]>;
  onLenderProgramClick?: (lender: string, program: string) => void;
  onLenderClick?: (lender: string) => void;
  onFlowClick?: (flow: string) => void;
  onL2Click?: (l2Stage: string) => void;
  onViewFullTable?: () => void;
}

export function StageDrawer({
  open,
  onOpenChange,
  stage,
  isTopLeak = false,
  hasLenderAllocation = false,
  structuralRow,
  globalVsSpecificRow,
  compareLabel,
  periodLabel,
  lenderProgramRows,
  lenderRows,
  flowRows,
  lenderL2Rows,
  flowLenderInsightRows,
  subStages,
  prevStageName,
  failureReasons,
  onLenderProgramClick,
  onLenderClick,
  onFlowClick,
  onL2Click,
  onViewFullTable,
}: StageDrawerProps) {
  if (!stage) return null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[35vw] max-w-[480px] min-w-[320px] overflow-y-auto"
        showCloseButton
      >
        <SheetHeader>
          <SheetTitle className="text-base">{stage.name}</SheetTitle>
        </SheetHeader>
        <StageDetailContent
          stage={stage}
          isTopLeak={isTopLeak}
          hasLenderAllocation={hasLenderAllocation}
          structuralRow={structuralRow}
          globalVsSpecificRow={globalVsSpecificRow}
          compareLabel={compareLabel}
          periodLabel={periodLabel}
          lenderProgramRows={lenderProgramRows}
          lenderRows={lenderRows}
          flowRows={flowRows}
          lenderL2Rows={lenderL2Rows}
          flowLenderInsightRows={flowLenderInsightRows}
          subStages={subStages}
          prevStageName={prevStageName}
          failureReasons={failureReasons}
          onLenderProgramClick={onLenderProgramClick}
          onLenderClick={onLenderClick}
          onFlowClick={onFlowClick}
          onL2Click={onL2Click}
          onViewFullTable={onViewFullTable}
        />
      </SheetContent>
    </Sheet>
  );
}

export interface StageDetailPanelProps {
  stage: StageDrawerStage;
  hasLenderAllocation?: boolean;
  structuralRow: StructuralRow | undefined;
  globalVsSpecificRow: GlobalVsSpecificRow | undefined;
  compareLabel: string;
  periodLabel: string;
  lenderProgramRows: LenderProgramRow[];
  lenderRows: LenderRow[];
  flowRows: FlowRow[];
  lenderL2Rows: LenderL2Row[];
  flowLenderInsightRows: FlowLenderInsightRow[];
  subStages: SubStageRow[];
  prevStageName?: string;
  failureReasons: Record<string, { reason: string; pct: number }[]>;
  onLenderProgramClick?: (lender: string, program: string) => void;
  onClose: () => void;
}

export function StageDetailPanel({
  stage,
  hasLenderAllocation = false,
  structuralRow,
  globalVsSpecificRow,
  compareLabel,
  periodLabel,
  lenderProgramRows,
  lenderRows,
  flowRows,
  lenderL2Rows,
  flowLenderInsightRows,
  subStages,
  prevStageName,
  failureReasons,
  onLenderProgramClick,
  onClose,
}: StageDetailPanelProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b bg-muted/30 py-3">
        <CardTitle className="text-base font-semibold">{stage.name}</CardTitle>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Close">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="pt-4">
        <StageDetailContent
          stage={stage}
          hasLenderAllocation={hasLenderAllocation}
          structuralRow={structuralRow}
          globalVsSpecificRow={globalVsSpecificRow}
          compareLabel={compareLabel}
          periodLabel={periodLabel}
          lenderProgramRows={lenderProgramRows}
          lenderRows={lenderRows}
          flowRows={flowRows}
          lenderL2Rows={lenderL2Rows}
          flowLenderInsightRows={flowLenderInsightRows}
          subStages={subStages}
          prevStageName={prevStageName}
          failureReasons={failureReasons}
          onLenderProgramClick={onLenderProgramClick}
        />
      </CardContent>
    </Card>
  );
}
