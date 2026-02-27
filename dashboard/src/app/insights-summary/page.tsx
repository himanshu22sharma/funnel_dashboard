"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useFilters, useDateRangeFactors } from "@/lib/filter-context";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Target,
  Banknote,
  Activity,
  ArrowRight,
  Zap,
  BarChart3,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Mail,
  Ticket,
  Sparkles,
  Eye,
  MessageSquarePlus,
  Headphones,
  Phone,
  Wrench,
} from "lucide-react";
import {
  fetchL2Analysis,
  fetchDisbursalSummary,
  L2AnalysisRow,
  DisbursalSummaryRow,
  getUniqueValues,
} from "@/lib/data";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { EmailComposeModal } from "@/components/dashboard/email-compose-modal";
import { CreateTicketModal, TicketItem } from "@/components/dashboard/create-ticket-modal";
import { InlineFeedbackModal } from "@/components/dashboard/rich-insight-card";
import { KpiDeepDiveModal, ClickableKpiCard, KpiDeepDiveConfig } from "@/components/dashboard/kpi-deep-dive-modal";

// ─── Constants ──────────────────────────────────────────────────────────────
/** Avg ticket size (Lakh): MTD 1528 Cr / 83401 loans ≈ 1.83 L */
const AVG_ATS = 1.83;
const LENDER_AOP: Record<string, number> = {
  FULLERTON: 120, KSF: 80, PIRAMAL: 60, SHRIRAM: 55,
  NACL: 45, PYFL: 40, MFL: 35, UCL: 30,
};
const TOTAL_AOP = Object.values(LENDER_AOP).reduce((s, v) => s + v, 0);

// ─── Types ──────────────────────────────────────────────────────────────────
interface ChartBar {
  label: string;
  value: number;
  color: string;
  filterContext?: { lender?: string };
}

interface L2Drill {
  stage: string;
  hypotheses: string[];
  lenderBreakdown?: { lender: string; delta: number }[];
}

interface InsightItem {
  id: string;
  icon: typeof TrendingUp;
  color: string;
  title: string;
  detail: string;
  severity: "good" | "warn" | "bad" | "info";
  impactWeight: number;
  link: string;
  defaultFilter?: { lender?: string };
  section?: string;
  isEmerging?: boolean;
  priorityBucket?: "P0" | "P1" | "P2" | "P3" | "emerging" | "positive";
  expanded: {
    bullets: string[];
    chartData: ChartBar[];
    chartLabel: string;
    chartValueSuffix: string;
    navigateLabel: string;
    l2Drills?: L2Drill[];
  };
}

// ─── Priority section config ────────────────────────────────────────────────
const PRIORITY_SECTIONS = [
  { key: "P0" as const, label: "P0 — Critical", color: "text-red-700", bg: "bg-red-50/40", border: "border-red-500", badge: "bg-red-100 text-red-700 border-red-200", icon: Zap },
  { key: "P1" as const, label: "P1 — High", color: "text-orange-700", bg: "bg-orange-50/40", border: "border-orange-500", badge: "bg-orange-100 text-orange-700 border-orange-200", icon: AlertTriangle },
  { key: "P2" as const, label: "P2 — Medium", color: "text-amber-700", bg: "bg-amber-50/40", border: "border-amber-500", badge: "bg-amber-100 text-amber-700 border-amber-200", icon: Eye },
  { key: "P3" as const, label: "P3 — Low", color: "text-blue-700", bg: "bg-blue-50/40", border: "border-blue-500", badge: "bg-blue-100 text-blue-700 border-blue-200", icon: Activity },
  { key: "emerging" as const, label: "Emerging Issues", color: "text-violet-700", bg: "bg-violet-50/40", border: "border-violet-500", badge: "bg-violet-100 text-violet-700 border-violet-200", icon: Sparkles },
  { key: "positive" as const, label: "What's Working", color: "text-emerald-700", bg: "bg-emerald-50/40", border: "border-emerald-500", badge: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
];

type PriorityKey = "P0" | "P1" | "P2" | "P3" | "emerging" | "positive";

// ─── Component ──────────────────────────────────────────────────────────────
export default function InsightsSummary() {
  const router = useRouter();
  const { global, useGlobalFilters, setGlobal, setUseGlobalFilters, setAvailableLenders, setAvailableProductTypes, setAvailableFlows } = useFilters();
  const { periodLabel: pL, compareLabel: cL } = useDateRangeFactors();
  const [l2Data, setL2Data] = useState<L2AnalysisRow[]>([]);
  const [disbData, setDisbData] = useState<DisbursalSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [activePriorityTab, setActivePriorityTab] = useState<PriorityKey>("P0");

  // Email modal state
  const [emailModal, setEmailModal] = useState<{ open: boolean; subject: string; body: string }>({ open: false, subject: "", body: "" });
  // Ticket modal state
  const [ticketModal, setTicketModal] = useState<{ open: boolean; title: string; description: string; priority: string }>({ open: false, title: "", description: "", priority: "P1" });
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  // Inline feedback modal state
  const [feedbackModal, setFeedbackModal] = useState<{ open: boolean; title: string; detail: string }>({ open: false, title: "", detail: "" });
  const [kpiDive, setKpiDive] = useState<{ open: boolean; config: KpiDeepDiveConfig | null }>({ open: false, config: null });

  // Apply global filters
  const effectiveLender = useGlobalFilters ? global.lender : "All";
  const effectiveProductType = useGlobalFilters ? global.productType : "All";
  const effectiveFlow = useGlobalFilters ? global.flow : "All";

  const filteredL2 = useMemo(() => {
    return l2Data.filter((r) => {
      if (effectiveLender !== "All" && r.lender !== effectiveLender) return false;
      if (effectiveProductType !== "All" && r.product_type !== effectiveProductType) return false;
      if (effectiveFlow !== "All" && r.isautoleadcreated !== effectiveFlow) return false;
      return true;
    });
  }, [l2Data, effectiveLender, effectiveProductType, effectiveFlow]);

  const filteredDisb = useMemo(() => {
    return disbData.filter((r) => {
      if (effectiveLender !== "All" && r.lender !== effectiveLender) return false;
      if (effectiveProductType !== "All" && r.product_type !== effectiveProductType) return false;
      if (effectiveFlow !== "All" && r.isautoleadcreated !== effectiveFlow) return false;
      return true;
    });
  }, [disbData, effectiveLender, effectiveProductType, effectiveFlow]);

  useEffect(() => {
    Promise.all([fetchL2Analysis(), fetchDisbursalSummary()]).then(([l2, disb]) => {
      setL2Data(l2);
      setDisbData(disb);
      setLoading(false);
      // Populate filter dropdowns from L2 data (since this is the landing page)
      setAvailableLenders(getUniqueValues(l2, "lender"));
      setAvailableProductTypes(getUniqueValues(l2, "product_type"));
      setAvailableFlows(getUniqueValues(l2, "isautoleadcreated"));
    });
  }, [setAvailableLenders, setAvailableProductTypes, setAvailableFlows]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const navigateWithFilter = useCallback((href: string, filter?: { lender?: string; productType?: string; flow?: string }, section?: string) => {
    if (filter?.lender || filter?.productType || filter?.flow) {
      setUseGlobalFilters(true);
      const updates: Record<string, string> = {};
      if (filter.lender) updates.lender = filter.lender;
      if (filter.productType) updates.productType = filter.productType;
      if (filter.flow) updates.flow = filter.flow;
      setGlobal(updates);
    }
    const target = section ? `${href}#${section}` : href;
    router.push(target);
  }, [router, setGlobal, setUseGlobalFilters]);

  // ─── Core metrics ─────────────────────────────────────────────────────────
  const coreMetrics = useMemo(() => {
    if (filteredL2.length === 0) return null;

    const allIndices = Array.from(
      new Set(filteredL2.filter((r) => !r.sub_stage && Math.floor(r.major_index) === r.major_index && r.major_index < 1000 && r.major_index !== 1).map((r) => r.major_index))
    ).sort((a, b) => a - b);

    const byPeriod = (period: string) => {
      const map: Record<number, { stage: string; leads: number }> = {};
      filteredL2.filter((r) => r.month_start === period && !r.sub_stage && Math.floor(r.major_index) === r.major_index && r.major_index < 1000 && r.major_index !== 1)
        .forEach((r) => { if (!map[r.major_index]) map[r.major_index] = { stage: r.original_major_stage, leads: 0 }; map[r.major_index].leads += r.leads; });
      return map;
    };

    const mtd = byPeriod("1.MTD");
    const lmtd = byPeriod("2.LMTD");
    const firstIdx = allIndices[0];
    const lastIdx = allIndices[allIndices.length - 1];

    const mtdWorkable = mtd[firstIdx]?.leads || 0;
    const lmtdWorkable = lmtd[firstIdx]?.leads || 0;
    const mtdDisbursed = mtd[lastIdx]?.leads || 0;
    const lmtdDisbursed = lmtd[lastIdx]?.leads || 0;

    const mtdE2E = mtdWorkable > 0 ? (mtdDisbursed / mtdWorkable) * 100 : 0;
    const lmtdE2E = lmtdWorkable > 0 ? (lmtdDisbursed / lmtdWorkable) * 100 : 0;
    const e2eDelta = mtdE2E - lmtdE2E;
    const volumeDelta = lmtdWorkable > 0 ? ((mtdWorkable - lmtdWorkable) / lmtdWorkable) * 100 : 0;

    const mtdAmountCr = (mtdDisbursed * AVG_ATS) / 100;
    const dayOfMonth = new Date().getDate();
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const pace = dayOfMonth / daysInMonth;
    const projectedCr = pace > 0 ? mtdAmountCr / pace : 0;
    const monthlyTarget = TOTAL_AOP / 12;
    const aopPacing = monthlyTarget > 0 ? (projectedCr / monthlyTarget) * 100 : 0;

    const stageDeltas: { stage: string; index: number; mtdConv: number; lmtdConv: number; delta: number }[] = [];
    for (let i = 1; i < allIndices.length; i++) {
      const cur = allIndices[i]; const prev = allIndices[i - 1];
      const mtdConv = (mtd[prev]?.leads || 0) > 0 ? ((mtd[cur]?.leads || 0) / (mtd[prev]?.leads || 0)) * 100 : 0;
      const lmtdConv = (lmtd[prev]?.leads || 0) > 0 ? ((lmtd[cur]?.leads || 0) / (lmtd[prev]?.leads || 0)) * 100 : 0;
      stageDeltas.push({ stage: mtd[cur]?.stage || lmtd[cur]?.stage || `Stage ${cur}`, index: cur, mtdConv: parseFloat(mtdConv.toFixed(1)), lmtdConv: parseFloat(lmtdConv.toFixed(1)), delta: parseFloat((mtdConv - lmtdConv).toFixed(2)) });
    }

    const lenders = Array.from(new Set(filteredL2.map((r) => r.lender))).sort();
    const lenderPerf = lenders.map((lender) => {
      const lRows = filteredL2.filter((r) => r.lender === lender);
      const lMtdFirst = lRows.filter((r) => r.month_start === "1.MTD" && r.major_index === firstIdx && !r.sub_stage).reduce((s, r) => s + r.leads, 0);
      const lMtdLast = lRows.filter((r) => r.month_start === "1.MTD" && r.major_index === lastIdx && !r.sub_stage).reduce((s, r) => s + r.leads, 0);
      const lLmtdFirst = lRows.filter((r) => r.month_start === "2.LMTD" && r.major_index === firstIdx && !r.sub_stage).reduce((s, r) => s + r.leads, 0);
      const lLmtdLast = lRows.filter((r) => r.month_start === "2.LMTD" && r.major_index === lastIdx && !r.sub_stage).reduce((s, r) => s + r.leads, 0);
      const mc = lMtdFirst > 0 ? (lMtdLast / lMtdFirst) * 100 : 0;
      const lc = lLmtdFirst > 0 ? (lLmtdLast / lLmtdFirst) * 100 : 0;
      const disbCr = (lMtdLast * AVG_ATS) / 100;
      const monthlyAop = (LENDER_AOP[lender] || 0) / 12;
      const projected = pace > 0 ? disbCr / pace : 0;
      const aopPct = monthlyAop > 0 ? (projected / monthlyAop) * 100 : 0;
      return { lender, mtdDisbursed: lMtdLast, disbCr: parseFloat(disbCr.toFixed(1)), mtdConv: parseFloat(mc.toFixed(2)), lmtdConv: parseFloat(lc.toFixed(2)), delta: parseFloat((mc - lc).toFixed(2)), aopPct: parseFloat(aopPct.toFixed(0)), volumeGrowth: lLmtdFirst > 0 ? parseFloat((((lMtdFirst - lLmtdFirst) / lLmtdFirst) * 100).toFixed(1)) : 0 };
    });

    const lenderStageConv = (lender: string) => {
      const lRows = filteredL2.filter((r) => r.lender === lender && !r.sub_stage && Math.floor(r.major_index) === r.major_index && r.major_index < 1000 && r.major_index !== 1);
      const lMtd: Record<number, number> = {};
      lRows.filter((r) => r.month_start === "1.MTD").forEach((r) => { lMtd[r.major_index] = (lMtd[r.major_index] || 0) + r.leads; });
      const result: { stage: string; conv: number }[] = [];
      for (let i = 1; i < allIndices.length; i++) {
        const cur = allIndices[i]; const prev = allIndices[i - 1];
        const conv = (lMtd[prev] || 0) > 0 ? ((lMtd[cur] || 0) / (lMtd[prev] || 0)) * 100 : 0;
        result.push({ stage: mtd[cur]?.stage || `Stage ${cur}`, conv: parseFloat(conv.toFixed(1)) });
      }
      return result;
    };

    // Sub-stage data for L2 drill-down
    const subStageData = (stageIndex: number) => {
      const subRows = filteredL2.filter((r) => r.sub_stage && Math.floor(r.major_index) === stageIndex);
      const mtdSubs: Record<string, number> = {};
      const lmtdSubs: Record<string, number> = {};
      subRows.forEach((r) => {
        const key = r.sub_stage || r.original_major_stage;
        if (r.month_start === "1.MTD") mtdSubs[key] = (mtdSubs[key] || 0) + r.leads;
        else if (r.month_start === "2.LMTD") lmtdSubs[key] = (lmtdSubs[key] || 0) + r.leads;
      });
      return { mtdSubs, lmtdSubs };
    };

    // Per-lender per-stage delta for L2 drill-down
    const lenderStageDelta = (stageIndex: number) => {
      const prevIdx = allIndices[allIndices.indexOf(stageIndex) - 1];
      if (prevIdx === undefined) return [];
      return lenders.map((lender) => {
        const lRows = filteredL2.filter((r) => r.lender === lender && !r.sub_stage && Math.floor(r.major_index) === r.major_index);
        const lMtdCur = lRows.filter((r) => r.month_start === "1.MTD" && r.major_index === stageIndex).reduce((s, r) => s + r.leads, 0);
        const lMtdPrev = lRows.filter((r) => r.month_start === "1.MTD" && r.major_index === prevIdx).reduce((s, r) => s + r.leads, 0);
        const lLmtdCur = lRows.filter((r) => r.month_start === "2.LMTD" && r.major_index === stageIndex).reduce((s, r) => s + r.leads, 0);
        const lLmtdPrev = lRows.filter((r) => r.month_start === "2.LMTD" && r.major_index === prevIdx).reduce((s, r) => s + r.leads, 0);
        const mtdConv = lMtdPrev > 0 ? (lMtdCur / lMtdPrev) * 100 : 0;
        const lmtdConv = lLmtdPrev > 0 ? (lLmtdCur / lLmtdPrev) * 100 : 0;
        return { lender, delta: parseFloat((mtdConv - lmtdConv).toFixed(2)) };
      }).sort((a, b) => a.delta - b.delta);
    };

    // Program type performance
    const programs = Array.from(new Set(filteredL2.map((r) => r.product_type))).sort();
    const programPerf = programs.map((pt) => {
      const pRows = filteredL2.filter((r) => r.product_type === pt);
      const pMtdFirst = pRows.filter((r) => r.month_start === "1.MTD" && r.major_index === firstIdx && !r.sub_stage).reduce((s, r) => s + r.leads, 0);
      const pMtdLast = pRows.filter((r) => r.month_start === "1.MTD" && r.major_index === lastIdx && !r.sub_stage).reduce((s, r) => s + r.leads, 0);
      const pLmtdFirst = pRows.filter((r) => r.month_start === "2.LMTD" && r.major_index === firstIdx && !r.sub_stage).reduce((s, r) => s + r.leads, 0);
      const pLmtdLast = pRows.filter((r) => r.month_start === "2.LMTD" && r.major_index === lastIdx && !r.sub_stage).reduce((s, r) => s + r.leads, 0);
      const mc = pMtdFirst > 0 ? (pMtdLast / pMtdFirst) * 100 : 0;
      const lc = pLmtdFirst > 0 ? (pLmtdLast / pLmtdFirst) * 100 : 0;
      const disbCr = (pMtdLast * AVG_ATS) / 100;
      return { program: pt, mtdDisbursed: pMtdLast, disbCr: parseFloat(disbCr.toFixed(1)), mtdConv: parseFloat(mc.toFixed(2)), lmtdConv: parseFloat(lc.toFixed(2)), delta: parseFloat((mc - lc).toFixed(2)), volumeGrowth: pLmtdFirst > 0 ? parseFloat((((pMtdFirst - pLmtdFirst) / pLmtdFirst) * 100).toFixed(1)) : 0 };
    });

    const criticalStages = stageDeltas.filter((s) => s.delta < -5).length;
    const criticalLenders = lenderPerf.filter((l) => l.delta < -3 || l.aopPct < 60).length;
    return { mtdWorkable, lmtdWorkable, mtdDisbursed, lmtdDisbursed, mtdE2E: parseFloat(mtdE2E.toFixed(2)), lmtdE2E: parseFloat(lmtdE2E.toFixed(2)), e2eDelta: parseFloat(e2eDelta.toFixed(2)), volumeDelta: parseFloat(volumeDelta.toFixed(1)), mtdAmountCr: parseFloat(mtdAmountCr.toFixed(1)), projectedCr: parseFloat(projectedCr.toFixed(1)), monthlyTarget: parseFloat(monthlyTarget.toFixed(1)), aopPacing: parseFloat(aopPacing.toFixed(0)), stageDeltas, lenderPerf, lenderStageConv, subStageData, lenderStageDelta, programPerf, criticalStages, criticalLenders, dayOfMonth, daysInMonth, allIndices };
  }, [filteredL2]);

  // ─── Briefing items with expanded details & L2 drills ─────────────────────
  const briefingItems: InsightItem[] = useMemo(() => {
    if (!coreMetrics) return [];
    const items: InsightItem[] = [];

    // Helper: build L2 drills for a stage
    const buildL2Drills = (stageIndex: number, stageName: string): L2Drill[] => {
      const { mtdSubs, lmtdSubs } = coreMetrics.subStageData(stageIndex);
      const lenderDeltas = coreMetrics.lenderStageDelta(stageIndex);
      const hypotheses: string[] = [];

      Object.keys(mtdSubs).forEach((subStage) => {
        const mtdVal = mtdSubs[subStage] || 0;
        const lmtdVal = lmtdSubs[subStage] || 0;
        if (lmtdVal > 0) {
          const changePct = ((mtdVal - lmtdVal) / lmtdVal) * 100;
          if (changePct < -10) {
            hypotheses.push(`Sub-stage "${subStage}" volume dropped ${Math.abs(changePct).toFixed(0)}% (${lmtdVal.toLocaleString("en-IN")} → ${mtdVal.toLocaleString("en-IN")})`);
          } else if (changePct > 20) {
            hypotheses.push(`Sub-stage "${subStage}" volume increased ${changePct.toFixed(0)}% — possible quality change`);
          }
        }
        if (mtdVal === 0 && lmtdVal > 10) {
          hypotheses.push(`Sub-stage "${subStage}" shows zero leads vs ${lmtdVal} last period — possible blockage`);
        }
      });

      if (hypotheses.length === 0) {
        hypotheses.push(`No significant sub-stage anomalies detected — drop may be systemic at "${stageName}" level`);
      }

      return [{
        stage: stageName,
        hypotheses,
        lenderBreakdown: lenderDeltas.filter((l) => l.delta !== 0).slice(0, 5),
      }];
    };

    // 1. Funnel Conv% (was E2E)
    const topDrivers = [...coreMetrics.stageDeltas].sort((a, b) => a.delta - b.delta).slice(0, 4);
    const disbImpactCr = parseFloat(((coreMetrics.mtdDisbursed - coreMetrics.lmtdDisbursed) * AVG_ATS / 100).toFixed(1));
    // For the chart: if funnel is down, only show dropping stages; if up, only show improving
    const relevantStages = coreMetrics.e2eDelta < 0
      ? coreMetrics.stageDeltas.filter((s) => s.delta < 0).sort((a, b) => a.delta - b.delta)
      : coreMetrics.stageDeltas.filter((s) => s.delta > 0).sort((a, b) => b.delta - a.delta);
    items.push({
      id: "e2e",
      icon: coreMetrics.e2eDelta >= 0 ? TrendingUp : TrendingDown,
      color: coreMetrics.e2eDelta >= 0 ? "text-emerald-600" : "text-red-600",
      title: `Funnel Conv% is ${coreMetrics.e2eDelta >= 0 ? "up" : "down"} ${Math.abs(coreMetrics.e2eDelta).toFixed(2)}pp`,
      detail: `From ${coreMetrics.lmtdE2E}% (${cL}) to ${coreMetrics.mtdE2E}% (${pL}). ${coreMetrics.mtdDisbursed.toLocaleString("en-IN")} disbursed out of ${coreMetrics.mtdWorkable.toLocaleString("en-IN")} workable. Impact: ${disbImpactCr >= 0 ? "+" : ""}₹${Math.abs(disbImpactCr)} Cr.`,
      severity: coreMetrics.e2eDelta >= 0 ? "good" : "bad",
      impactWeight: 95,
      link: "/funnel-summary",
      section: "funnel-dropoff",
      expanded: {
        bullets: [
          ...topDrivers.map((s) => `${s.stage}: ${s.delta > 0 ? "+" : ""}${s.delta.toFixed(1)}pp (${s.lmtdConv}% → ${s.mtdConv}%)`),
          `${coreMetrics.stageDeltas.filter((s) => s.delta > 0).length} stages improved, ${coreMetrics.stageDeltas.filter((s) => s.delta < 0).length} declined`,
          `Disbursal impact: ${disbImpactCr >= 0 ? "+" : ""}₹${Math.abs(disbImpactCr)} Cr vs ${cL}`,
        ],
        chartData: relevantStages.map((s) => ({
          label: s.stage.substring(0, 16),
          value: s.delta,
          color: s.delta >= 0 ? "hsl(150, 60%, 45%)" : "hsl(350, 65%, 55%)",
        })),
        chartLabel: coreMetrics.e2eDelta < 0 ? "Stages with Conv% Drop (pp)" : "Stages with Conv% Gain (pp)",
        chartValueSuffix: "pp",
        navigateLabel: "View Funnel Summary",
      },
    });

    // 2. Volume
    const lendersByVolGrowth = [...coreMetrics.lenderPerf].sort((a, b) => a.volumeGrowth - b.volumeGrowth);
    items.push({
      id: "volume",
      icon: coreMetrics.volumeDelta >= 0 ? TrendingUp : TrendingDown,
      color: coreMetrics.volumeDelta >= 0 ? "text-emerald-600" : "text-amber-600",
      title: `Top-of-funnel volume ${coreMetrics.volumeDelta >= 0 ? "up" : "down"} ${Math.abs(coreMetrics.volumeDelta).toFixed(0)}%`,
      detail: `${coreMetrics.mtdWorkable.toLocaleString("en-IN")} workable leads ${pL} vs ${coreMetrics.lmtdWorkable.toLocaleString("en-IN")} ${cL}.`,
      severity: coreMetrics.volumeDelta >= -5 ? "good" : "warn",
      impactWeight: 70,
      link: "/funnel-summary",
      section: "funnel-kpis",
      expanded: {
        bullets: lendersByVolGrowth.slice(0, 4).map((l) => `${l.lender}: ${l.volumeGrowth > 0 ? "+" : ""}${l.volumeGrowth}% volume growth`),
        chartData: [...coreMetrics.lenderPerf].sort((a, b) => b.mtdDisbursed - a.mtdDisbursed).slice(0, 8).map((l) => ({
          label: l.lender,
          value: l.volumeGrowth,
          color: l.volumeGrowth >= 0 ? "hsl(150, 60%, 45%)" : "hsl(350, 65%, 55%)",
          filterContext: { lender: l.lender },
        })),
        chartLabel: "Lender Volume Growth (%)",
        chartValueSuffix: "%",
        navigateLabel: "View Funnel Summary",
      },
    });

    // 3. AOP pacing
    const behindAop = coreMetrics.lenderPerf.filter((l) => l.aopPct > 0 && l.aopPct < 70);
    items.push({
      id: "aop",
      icon: Target,
      color: coreMetrics.aopPacing >= 90 ? "text-emerald-600" : coreMetrics.aopPacing >= 70 ? "text-amber-600" : "text-red-600",
      title: `AOP pacing at ${coreMetrics.aopPacing}% — ${coreMetrics.aopPacing >= 90 ? "on track" : coreMetrics.aopPacing >= 70 ? "needs attention" : "behind target"}`,
      detail: `₹${coreMetrics.mtdAmountCr} Cr ${pL}. Projected ₹${coreMetrics.projectedCr} Cr vs ₹${coreMetrics.monthlyTarget} Cr target. Gap: ₹${Math.abs(parseFloat((coreMetrics.projectedCr - coreMetrics.monthlyTarget).toFixed(1)))} Cr ${coreMetrics.projectedCr >= coreMetrics.monthlyTarget ? "ahead" : "behind"}. Day ${coreMetrics.dayOfMonth}/${coreMetrics.daysInMonth}.`,
      severity: coreMetrics.aopPacing >= 90 ? "good" : coreMetrics.aopPacing >= 70 ? "warn" : "bad",
      impactWeight: 100,
      link: "/disbursal-summary",
      section: "disb-kpi",
      expanded: {
        bullets: [
          ...behindAop.slice(0, 3).map((l) => `${l.lender} at ${l.aopPct}% — ₹${l.disbCr} Cr ${pL}`),
          `${coreMetrics.lenderPerf.filter((l) => l.aopPct >= 80).length} of ${coreMetrics.lenderPerf.length} lenders on track (>=80%)`,
        ],
        chartData: [...coreMetrics.lenderPerf].filter((l) => l.aopPct > 0).sort((a, b) => a.aopPct - b.aopPct).map((l) => ({
          label: l.lender,
          value: l.aopPct,
          color: l.aopPct >= 80 ? "hsl(150, 60%, 45%)" : l.aopPct >= 60 ? "hsl(220, 70%, 55%)" : "hsl(350, 65%, 55%)",
          filterContext: { lender: l.lender },
        })),
        chartLabel: "Lender AOP Pacing (%)",
        chartValueSuffix: "%",
        navigateLabel: "View Disbursal Summary",
      },
    });

    // 4. Individual stage drops with L2 drills
    const allStageDrops = coreMetrics.stageDeltas.filter((s) => s.delta < -1).sort((a, b) => a.delta - b.delta);
    allStageDrops.forEach((s, i) => {
      const worstStageLenders = coreMetrics.lenderPerf.map((l) => {
        const sc = coreMetrics.lenderStageConv(l.lender);
        const match = sc.find((st) => st.stage === s.stage);
        return { lender: l.lender, conv: match?.conv || 0 };
      }).sort((a, b) => a.conv - b.conv);

      const l2Drills = buildL2Drills(s.index, s.stage);

      // Estimate the leads lost due to this drop & its ₹ impact
      const estLeadsLost = Math.round((Math.abs(s.delta) / 100) * coreMetrics.mtdWorkable);
      const estImpactCr = parseFloat((estLeadsLost * AVG_ATS / 100).toFixed(1));

      items.push({
        id: `stage-drop-${s.index}`,
        icon: s.delta < -5 ? Zap : TrendingDown,
        color: s.delta < -5 ? "text-red-600" : "text-amber-600",
        title: `"${s.stage}" conversion dropped ${Math.abs(s.delta).toFixed(1)}pp`,
        detail: `From ${s.lmtdConv}% (${cL}) to ${s.mtdConv}% (${pL}). Est. impact: ~₹${estImpactCr} Cr (${estLeadsLost.toLocaleString("en-IN")} leads).`,
        severity: s.delta < -5 ? "bad" : "warn",
        impactWeight: 85 - i * 3,
        link: "/funnel-summary",
        section: "funnel-dropoff",
        expanded: {
          bullets: [
            `Conv% fell ${s.lmtdConv}% → ${s.mtdConv}% (${s.delta.toFixed(1)}pp)`,
            ...worstStageLenders.slice(0, 3).map((l) => `${l.lender}: ${l.conv.toFixed(1)}% at this stage`),
          ],
          chartData: worstStageLenders.slice(0, 8).map((l) => ({
            label: l.lender,
            value: l.conv,
            color: l.conv < s.mtdConv * 0.8 ? "hsl(350, 65%, 55%)" : l.conv > s.mtdConv * 1.2 ? "hsl(150, 60%, 45%)" : "hsl(220, 70%, 55%)",
            filterContext: { lender: l.lender },
          })),
          chartLabel: `"${s.stage}" Conv% by Lender`,
          chartValueSuffix: "%",
          navigateLabel: "View in Funnel Summary",
          l2Drills,
        },
      });
    });

    // 5. Declining lenders
    const decliningLenders = coreMetrics.lenderPerf.filter((l) => l.delta < -3);
    if (decliningLenders.length > 0) {
      items.push({
        id: "declining-lenders",
        icon: AlertTriangle,
        color: "text-amber-600",
        title: `${decliningLenders.length} lender${decliningLenders.length > 1 ? "s" : ""} showing Funnel Conv% decline`,
        detail: `${decliningLenders.map((l) => `${l.lender} (${l.delta.toFixed(1)}pp)`).join(", ")}. Combined disbursal: ₹${decliningLenders.reduce((s, l) => s + l.disbCr, 0).toFixed(1)} Cr.`,
        severity: "warn",
        impactWeight: 60,
        link: "/funnel-summary",
        section: "lender-funnel",
        defaultFilter: { lender: decliningLenders[0]?.lender },
        expanded: {
          bullets: decliningLenders.map((l) => `${l.lender}: Funnel Conv% ${l.lmtdConv}% → ${l.mtdConv}% (${l.delta.toFixed(1)}pp). Disbursed ₹${l.disbCr} Cr.`),
          chartData: [...coreMetrics.lenderPerf].sort((a, b) => a.delta - b.delta).slice(0, 8).map((l) => ({
            label: l.lender,
            value: l.delta,
            color: l.delta >= 0 ? "hsl(150, 60%, 45%)" : l.delta > -3 ? "hsl(30, 80%, 55%)" : "hsl(350, 65%, 55%)",
            filterContext: { lender: l.lender },
          })),
          chartLabel: "Funnel Conv% Change by Lender (pp)",
          chartValueSuffix: "pp",
          navigateLabel: "View Lender Summary",
        },
      });
    }

    // 6. Behind AOP
    if (behindAop.length > 0) {
      items.push({
        id: "behind-aop",
        icon: Target,
        color: "text-red-600",
        title: `${behindAop.length} lender${behindAop.length > 1 ? "s" : ""} behind AOP target`,
        detail: `${behindAop.map((l) => `${l.lender} (${l.aopPct}%)`).join(", ")} pacing below 70%. Combined shortfall: ~₹${behindAop.reduce((s, l) => s + Math.max(0, (((LENDER_AOP[l.lender] || 0) / 12) - l.disbCr)), 0).toFixed(1)} Cr.`,
        severity: "bad",
        impactWeight: 80,
        link: "/disbursal-summary",
        section: "disb-lender-matrix",
        defaultFilter: { lender: behindAop[0]?.lender },
        expanded: {
          bullets: behindAop.map((l) => `${l.lender}: ${l.aopPct}% AOP pacing — ₹${l.disbCr} Cr disbursed ${pL}`),
          chartData: behindAop.map((l) => ({
            label: l.lender,
            value: l.aopPct,
            color: l.aopPct < 50 ? "hsl(350, 65%, 55%)" : "hsl(30, 80%, 55%)",
            filterContext: { lender: l.lender },
          })),
          chartLabel: "AOP Pacing of At-Risk Lenders (%)",
          chartValueSuffix: "%",
          navigateLabel: "View Disbursal Summary",
        },
      });
    }

    // 7. Individual stage gains
    const stageGains = coreMetrics.stageDeltas.filter((s) => s.delta > 1);
    stageGains.sort((a, b) => b.delta - a.delta).forEach((s, i) => {
      const bestStageLenders = coreMetrics.lenderPerf.map((l) => {
        const sc = coreMetrics.lenderStageConv(l.lender);
        const match = sc.find((st) => st.stage === s.stage);
        return { lender: l.lender, conv: match?.conv || 0 };
      }).sort((a, b) => b.conv - a.conv);

      items.push({
        id: `stage-gain-${s.index}`,
        icon: s.delta > 5 ? CheckCircle2 : TrendingUp,
        color: "text-emerald-600",
        title: `"${s.stage}" improved +${s.delta.toFixed(1)}pp`,
        detail: `Conversion up from ${s.lmtdConv}% to ${s.mtdConv}%.`,
        severity: "good",
        impactWeight: 50 - i * 2,
        link: "/funnel-summary",
        section: "funnel-drilldown",
        expanded: {
          bullets: [
            `Conv% improved ${s.lmtdConv}% → ${s.mtdConv}% (+${s.delta.toFixed(1)}pp)`,
            ...bestStageLenders.slice(0, 3).map((l) => `${l.lender}: ${l.conv.toFixed(1)}% at this stage`),
          ],
          chartData: bestStageLenders.slice(0, 8).map((l) => ({
            label: l.lender,
            value: l.conv,
            color: l.conv > s.mtdConv * 1.1 ? "hsl(150, 60%, 45%)" : "hsl(220, 70%, 55%)",
            filterContext: { lender: l.lender },
          })),
          chartLabel: `"${s.stage}" Conv% by Lender`,
          chartValueSuffix: "%",
          navigateLabel: "View in Funnel Summary",
        },
      });
    });

    // 8. Growing lenders
    const growingLenders = coreMetrics.lenderPerf.filter((l) => l.delta > 2);
    growingLenders.sort((a, b) => b.delta - a.delta).forEach((l, i) => {
      items.push({
        id: `lender-grow-${l.lender}`,
        icon: TrendingUp,
        color: "text-emerald-600",
        title: `${l.lender} Funnel Conv% up +${l.delta.toFixed(1)}pp`,
        detail: `Funnel Conv% ${l.lmtdConv}% → ${l.mtdConv}%. Disbursed ₹${l.disbCr} Cr ${pL}.`,
        severity: "good",
        impactWeight: 40 - i,
        link: "/funnel-summary",
        section: "lender-kpis",
        defaultFilter: { lender: l.lender },
        expanded: {
          bullets: [
            `Funnel Conv%: ${l.lmtdConv}% → ${l.mtdConv}% (+${l.delta.toFixed(1)}pp)`,
            `Volume growth: ${l.volumeGrowth > 0 ? "+" : ""}${l.volumeGrowth}%`,
            l.aopPct > 0 ? `AOP pacing: ${l.aopPct}%` : `No AOP target set`,
          ],
          chartData: [],
          chartLabel: "",
          chartValueSuffix: "",
          navigateLabel: `View ${l.lender}`,
        },
      });
    });

    // 9. Per-lender moderate declines
    const moderateDecline = coreMetrics.lenderPerf.filter((l) => l.delta < -1 && l.delta >= -3);
    moderateDecline.sort((a, b) => a.delta - b.delta).forEach((l, i) => {
      items.push({
        id: `lender-warn-${l.lender}`,
        icon: AlertTriangle,
        color: "text-amber-600",
        title: `${l.lender} Funnel Conv% slipping ${l.delta.toFixed(1)}pp`,
        detail: `Funnel Conv% ${l.lmtdConv}% → ${l.mtdConv}%. Watch for continued decline.`,
        severity: "warn",
        impactWeight: 30 - i,
        link: "/funnel-summary",
        section: "lender-kpis",
        defaultFilter: { lender: l.lender },
        expanded: {
          bullets: [
            `Conv: ${l.lmtdConv}% → ${l.mtdConv}% (${l.delta.toFixed(1)}pp)`,
            `Disbursed ₹${l.disbCr} Cr ${pL}`,
          ],
          chartData: [],
          chartLabel: "",
          chartValueSuffix: "",
          navigateLabel: `View ${l.lender}`,
        },
      });
    });

    // 10. Lenders on track with AOP
    const onTrackAop = coreMetrics.lenderPerf.filter((l) => l.aopPct >= 80);
    if (onTrackAop.length > 0) {
      items.push({
        id: "on-track-aop",
        icon: Target,
        color: "text-emerald-600",
        title: `${onTrackAop.length} lender${onTrackAop.length > 1 ? "s" : ""} on track with AOP (≥80%)`,
        detail: `${onTrackAop.map((l) => `${l.lender} (${l.aopPct}%)`).join(", ")}.`,
        severity: "good",
        impactWeight: 20,
        link: "/disbursal-summary",
        section: "disb-kpi",
        expanded: {
          bullets: onTrackAop.map((l) => `${l.lender}: ${l.aopPct}% AOP pacing — ₹${l.disbCr} Cr ${pL}`),
          chartData: onTrackAop.map((l) => ({
            label: l.lender,
            value: l.aopPct,
            color: "hsl(150, 60%, 45%)",
            filterContext: { lender: l.lender },
          })),
          chartLabel: "AOP Pacing of On-Track Lenders (%)",
          chartValueSuffix: "%",
          navigateLabel: "View Disbursal Summary",
        },
      });
    }

    // 11. Concentration risk
    const totalDisb = coreMetrics.lenderPerf.reduce((s, l) => s + l.mtdDisbursed, 0);
    if (totalDisb > 0) {
      const sorted = [...coreMetrics.lenderPerf].sort((a, b) => b.mtdDisbursed - a.mtdDisbursed);
      const topShare = (sorted[0]?.mtdDisbursed || 0) / totalDisb * 100;
      const top2Share = ((sorted[0]?.mtdDisbursed || 0) + (sorted[1]?.mtdDisbursed || 0)) / totalDisb * 100;
      if (topShare > 40) {
        items.push({
          id: "concentration-risk",
          icon: AlertTriangle,
          color: "text-amber-600",
          title: `High lender concentration: ${sorted[0].lender} at ${topShare.toFixed(0)}% share`,
          detail: `Top 2 lenders (${sorted[0].lender}, ${sorted[1]?.lender}) account for ${top2Share.toFixed(0)}% of disbursals.`,
          severity: "warn",
          impactWeight: 15,
          link: "/disbursal-summary",
          section: "disb-lender-matrix",
          expanded: {
            bullets: sorted.slice(0, 5).map((l) => `${l.lender}: ${((l.mtdDisbursed / totalDisb) * 100).toFixed(1)}% share — ₹${l.disbCr} Cr`),
            chartData: sorted.slice(0, 8).map((l) => ({
              label: l.lender,
              value: parseFloat(((l.mtdDisbursed / totalDisb) * 100).toFixed(1)),
              color: l.lender === sorted[0].lender ? "hsl(30, 80%, 55%)" : "hsl(220, 70%, 55%)",
              filterContext: { lender: l.lender },
            })),
            chartLabel: "Lender Disbursal Share (%)",
            chartValueSuffix: "%",
            navigateLabel: "View Disbursal Summary",
          },
        });
      }
    }

    // 12. Stable stages
    const stableStages = coreMetrics.stageDeltas.filter((s) => Math.abs(s.delta) <= 1 && s.mtdConv > 60);
    if (stableStages.length > 0) {
      items.push({
        id: "stable-stages",
        icon: CheckCircle2,
        color: "text-blue-600",
        title: `${stableStages.length} stage${stableStages.length > 1 ? "s" : ""} holding steady`,
        detail: `Stages with <1pp change and >60% conv: ${stableStages.map((s) => s.stage).join(", ")}.`,
        severity: "good",
        impactWeight: 10,
        link: "/funnel-summary",
        section: "funnel-drilldown",
        expanded: {
          bullets: stableStages.map((s) => `${s.stage}: ${s.mtdConv}% (Δ ${s.delta > 0 ? "+" : ""}${s.delta.toFixed(1)}pp)`),
          chartData: [],
          chartLabel: "",
          chartValueSuffix: "",
          navigateLabel: "View Funnel Summary",
        },
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MHD & CHANNELS INSIGHTS
    // ═══════════════════════════════════════════════════════════════════════════
    const mhdContactRatio = 18.2;
    const mhdLmtdContactRatio = 19.7;
    const mhdBotMSAT = 4.2;
    const mhdLmtdBotMSAT = 4.0;
    const mhdSelfResolution = 72.8;
    const mhdLmtdSelfResolution = 70.5;
    const mhdHandoverRate = 22.4;
    const mhdLmtdHandoverRate = 23.9;
    const mhdNegativeSentiment = 11.8;
    const mhdLeadsCreated = 8420;
    const mhdDisbursals = 2180;
    const mhdDisbCr = (mhdDisbursals * AVG_ATS / 100);
    const mhdBotFunnelAdvance = 5640;
    const mhdQuerySpikes = [
      { category: "Loan Offer Related", mtd: 4218, lmtd: 3890, pct: 22.3 },
      { category: "Loan Application Status", mtd: 3512, lmtd: 3240, pct: 18.6 },
      { category: "Loan Disbursal Status", mtd: 2145, lmtd: 1980, pct: 11.3 },
    ];

    // 13. MHD Contact Ratio
    const crDelta = mhdLmtdContactRatio - mhdContactRatio;
    if (crDelta > 0.5) {
      items.push({
        id: "mhd-contact-ratio-down",
        icon: Headphones,
        color: "text-emerald-600",
        title: `MHD Contact Ratio Improved: ${mhdContactRatio}/1K leads`,
        detail: `Down from ${mhdLmtdContactRatio}/1K ${cL} — fewer merchants needing help.`,
        severity: "good",
        impactWeight: 35,
        link: "/mhd",
        section: "mhd-kpis",
        expanded: {
          bullets: [
            `${pL}: ${mhdContactRatio} per 1K workable leads | ${cL}: ${mhdLmtdContactRatio}`,
            `Improvement: -${crDelta.toFixed(1)} contacts per 1K (${((crDelta / mhdLmtdContactRatio) * 100).toFixed(1)}% reduction)`,
            "Lower contact ratio suggests better self-service or clearer UX.",
          ],
          chartData: [],
          chartLabel: "",
          chartValueSuffix: "",
          navigateLabel: "View MHD Dashboard",
        },
      });
    } else if (crDelta < -0.5) {
      items.push({
        id: "mhd-contact-ratio-up",
        icon: Headphones,
        color: "text-amber-600",
        title: `MHD Contact Ratio Increased: ${mhdContactRatio}/1K leads`,
        detail: `Up from ${mhdLmtdContactRatio}/1K ${cL} — more merchants reaching out.`,
        severity: "warn",
        impactWeight: 55,
        link: "/mhd",
        section: "mhd-kpis",
        expanded: {
          bullets: [
            `${pL}: ${mhdContactRatio} per 1K | ${cL}: ${mhdLmtdContactRatio}`,
            "Higher contact ratio may indicate funnel confusion or broken steps.",
            "Review top query categories for emerging issues.",
          ],
          chartData: mhdQuerySpikes.map((q) => ({
            label: q.category,
            value: parseFloat(((q.mtd - q.lmtd) / q.lmtd * 100).toFixed(1)),
            color: q.mtd > q.lmtd ? "hsl(350, 65%, 55%)" : "hsl(150, 60%, 45%)",
          })),
          chartLabel: "Top Query Category Growth (%)",
          chartValueSuffix: "%",
          navigateLabel: "View MHD Dashboard",
        },
      });
    }

    // 14. MHD Bot MSAT
    const msatDelta = mhdBotMSAT - mhdLmtdBotMSAT;
    if (msatDelta > 0.1) {
      items.push({
        id: "mhd-bot-msat-up",
        icon: CheckCircle2,
        color: "text-emerald-600",
        title: `Bot MSAT Improved: ${mhdBotMSAT}/5.0`,
        detail: `Up from ${mhdLmtdBotMSAT} ${cL} (+${msatDelta.toFixed(1)} points). Merchant satisfaction rising.`,
        severity: "good",
        impactWeight: 25,
        link: "/mhd",
        section: "mhd-kpis",
        expanded: {
          bullets: [
            `Bot MSAT: ${mhdBotMSAT}/5.0 (${cL}: ${mhdLmtdBotMSAT})`,
            `Self-Resolution: ${mhdSelfResolution}% (${cL}: ${mhdLmtdSelfResolution}%)`,
            `Negative Sentiment: ${mhdNegativeSentiment}%`,
          ],
          chartData: [],
          chartLabel: "",
          chartValueSuffix: "",
          navigateLabel: "View MHD Dashboard",
        },
      });
    } else if (msatDelta < -0.1) {
      items.push({
        id: "mhd-bot-msat-down",
        icon: AlertTriangle,
        color: "text-red-600",
        title: `Bot MSAT Dropped: ${mhdBotMSAT}/5.0`,
        detail: `Down from ${mhdLmtdBotMSAT} ${cL} (${msatDelta.toFixed(1)} points). Investigate query handling quality.`,
        severity: "bad",
        impactWeight: 70,
        link: "/mhd",
        section: "mhd-kpis",
        expanded: {
          bullets: [
            `Bot MSAT: ${mhdBotMSAT}/5.0 (${cL}: ${mhdLmtdBotMSAT})`,
            `Self-Resolution: ${mhdSelfResolution}% — may need improvement`,
            `Handover Rate: ${mhdHandoverRate}% (${cL}: ${mhdLmtdHandoverRate}%)`,
          ],
          chartData: [],
          chartLabel: "",
          chartValueSuffix: "",
          navigateLabel: "View MHD Dashboard",
        },
      });
    }

    // 15. MHD Query Spikes
    const spikeCategories = mhdQuerySpikes.filter((q) => ((q.mtd - q.lmtd) / q.lmtd * 100) > 5);
    if (spikeCategories.length > 0) {
      items.push({
        id: "mhd-query-spikes",
        icon: Phone,
        color: "text-amber-600",
        title: `${spikeCategories.length} MHD query categories spiking`,
        detail: `${spikeCategories.map((q) => `${q.category} (+${((q.mtd - q.lmtd) / q.lmtd * 100).toFixed(0)}%)`).join(", ")}.`,
        severity: "warn",
        impactWeight: 50,
        link: "/mhd",
        section: "mhd-categories",
        expanded: {
          bullets: [
            ...spikeCategories.map((q) => `${q.category}: ${q.mtd.toLocaleString("en-IN")} queries (${cL}: ${q.lmtd.toLocaleString("en-IN")}, +${((q.mtd - q.lmtd) / q.lmtd * 100).toFixed(1)}%)`),
            "Rising queries in these categories may indicate funnel or product issues.",
          ],
          chartData: spikeCategories.map((q) => ({
            label: q.category.slice(0, 22),
            value: q.mtd,
            color: "hsl(30, 80%, 55%)",
          })),
          chartLabel: "Query Volume by Category",
          chartValueSuffix: "",
          navigateLabel: "View MHD Categories",
        },
      });
    }

    // 16. MHD Funnel Impact (leads via MHD)
    items.push({
      id: "mhd-funnel-impact",
      icon: Headphones,
      color: "text-blue-600",
      title: `MHD Driving ${mhdLeadsCreated.toLocaleString("en-IN")} Leads & ${mhdDisbursals.toLocaleString("en-IN")} Disbursals`,
      detail: `₹${mhdDisbCr.toFixed(1)} Cr disbursed via MHD. ${mhdBotFunnelAdvance.toLocaleString("en-IN")} leads advanced in funnel after bot interaction.`,
      severity: "info",
      impactWeight: 20,
      link: "/mhd",
      section: "mhd-kpis",
      expanded: {
        bullets: [
          `Leads created through MHD: ${mhdLeadsCreated.toLocaleString("en-IN")}`,
          `Disbursals through MHD: ${mhdDisbursals.toLocaleString("en-IN")} (₹${mhdDisbCr.toFixed(1)} Cr)`,
          `Bot-assisted funnel advances: ${mhdBotFunnelAdvance.toLocaleString("en-IN")}`,
          `Handover Rate: ${mhdHandoverRate}% (${cL}: ${mhdLmtdHandoverRate}%)`,
        ],
        chartData: [],
        chartLabel: "",
        chartValueSuffix: "",
        navigateLabel: "View MHD Dashboard",
      },
    });

    // 17. MHD Handover Rate
    const handoverDelta = mhdLmtdHandoverRate - mhdHandoverRate;
    if (handoverDelta > 0.5) {
      items.push({
        id: "mhd-handover-improved",
        icon: CheckCircle2,
        color: "text-emerald-600",
        title: `Bot→Agent Handover Reduced: ${mhdHandoverRate}%`,
        detail: `Down from ${mhdLmtdHandoverRate}% ${cL}. Bot handling more queries autonomously.`,
        severity: "good",
        impactWeight: 20,
        link: "/mhd",
        expanded: {
          bullets: [
            `Handover Rate: ${mhdHandoverRate}% (${cL}: ${mhdLmtdHandoverRate}%)`,
            `Self-Resolution: ${mhdSelfResolution}% (${cL}: ${mhdLmtdSelfResolution}%)`,
          ],
          chartData: [],
          chartLabel: "",
          chartValueSuffix: "",
          navigateLabel: "View MHD Dashboard",
        },
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ALERT & RCA INSIGHTS (derived from funnel data)
    // ═══════════════════════════════════════════════════════════════════════════

    // 18. Critical funnel alerts count
    const criticalDrops = coreMetrics.stageDeltas.filter((s) => s.delta < -5);
    const highDrops = coreMetrics.stageDeltas.filter((s) => s.delta < -3 && s.delta >= -5);
    if (criticalDrops.length > 0) {
      items.push({
        id: "alert-critical-count",
        icon: Zap,
        color: "text-red-600",
        title: `${criticalDrops.length} Critical Alert${criticalDrops.length > 1 ? "s" : ""}: Stage Drops >5pp`,
        detail: `${criticalDrops.map((s) => `${s.stage} (${s.delta.toFixed(1)}pp)`).join(", ")}. Needs immediate investigation.`,
        severity: "bad",
        impactWeight: 95,
        link: "/alert-tracking",
        section: "alert-impact",
        expanded: {
          bullets: [
            ...criticalDrops.map((s) => `${s.stage}: ${s.lmtdConv}% → ${s.mtdConv}% (${s.delta.toFixed(1)}pp drop)`),
            `Total critical alerts: ${criticalDrops.length} | High alerts: ${highDrops.length}`,
            "Check Alert Tracking for full attribution and impact analysis.",
          ],
          chartData: criticalDrops.map((s) => ({
            label: s.stage.slice(0, 22),
            value: Math.abs(s.delta),
            color: "hsl(350, 65%, 55%)",
          })),
          chartLabel: "Critical Stage Drop Magnitude (pp)",
          chartValueSuffix: "pp",
          navigateLabel: "View Alert Tracking",
        },
      });
    }

    // 19. RCA items needing attention (simulated)
    const openRcaCount = criticalDrops.length + Math.min(highDrops.length, 2);
    const fixDeployedCount = Math.max(1, Math.floor(highDrops.length / 2));
    if (openRcaCount > 0) {
      items.push({
        id: "rca-open-items",
        icon: Wrench,
        color: "text-amber-600",
        title: `${openRcaCount} Open RCA Items — ${fixDeployedCount} Fix${fixDeployedCount > 1 ? "es" : ""} Deployed`,
        detail: `${openRcaCount} issues under investigation. ${fixDeployedCount} fixes deployed awaiting validation.`,
        severity: "warn",
        impactWeight: 60,
        link: "/stage-health",
        section: "rca-pipeline",
        expanded: {
          bullets: [
            `Open issues: ${openRcaCount} (Critical: ${criticalDrops.length}, High: ${Math.min(highDrops.length, 2)})`,
            `Fixes deployed: ${fixDeployedCount} — awaiting before/after validation`,
            "Review RCA & Fix Tracking for ownership, timeline, and recovery progress.",
          ],
          chartData: [],
          chartLabel: "",
          chartValueSuffix: "",
          navigateLabel: "View RCA & Fix Tracking",
        },
      });
    }

    // 20. Disbursal run-rate vs AOP
    const disbAgg = filteredL2.filter((r) => r.month_start === "1.MTD" && !r.sub_stage && Math.floor(r.major_index) === r.major_index && r.major_index === 15);
    const mtdDisbTotal = disbAgg.reduce((s, r) => s + r.leads, 0);
    const mtdDisbCr = (mtdDisbTotal * AVG_ATS) / 100;
    const monthlyAopCr = TOTAL_AOP / 12;
    const pace = coreMetrics.dayOfMonth / coreMetrics.daysInMonth;
    const runRate = pace > 0 ? mtdDisbCr / pace : 0;
    const aopRunPct = monthlyAopCr > 0 ? (runRate / monthlyAopCr) * 100 : 0;
    if (aopRunPct < 80) {
      items.push({
        id: "disb-runrate-behind",
        icon: Banknote,
        color: "text-red-600",
        title: `Disbursal Run-Rate Behind AOP: ${aopRunPct.toFixed(0)}%`,
        detail: `Projected ₹${runRate.toFixed(1)} Cr/month vs ₹${monthlyAopCr.toFixed(1)} Cr target. Gap: ~₹${(monthlyAopCr - runRate).toFixed(1)} Cr.`,
        severity: "bad",
        impactWeight: 85,
        link: "/disbursal-summary",
        section: "disb-kpi",
        expanded: {
          bullets: [
            `${pL} Disbursed: ₹${mtdDisbCr.toFixed(1)} Cr (Day ${coreMetrics.dayOfMonth}/${coreMetrics.daysInMonth})`,
            `Run-rate: ₹${runRate.toFixed(1)} Cr/month | Target: ₹${monthlyAopCr.toFixed(1)} Cr/month`,
            `Pacing: ${aopRunPct.toFixed(0)}% — need ${((1 - pace) > 0 ? ((monthlyAopCr - mtdDisbCr) / (1 - pace)).toFixed(1) : "N/A")} Cr in remaining days`,
          ],
          chartData: coreMetrics.lenderPerf.filter((l) => l.aopPct < 80).map((l) => ({
            label: l.lender,
            value: l.aopPct,
            color: l.aopPct < 50 ? "hsl(350, 65%, 55%)" : "hsl(30, 80%, 55%)",
            filterContext: { lender: l.lender },
          })),
          chartLabel: "Lenders Behind AOP Target (%)",
          chartValueSuffix: "%",
          navigateLabel: "View Disbursal Summary",
        },
      });
    } else if (aopRunPct >= 100) {
      items.push({
        id: "disb-runrate-on-track",
        icon: Banknote,
        color: "text-emerald-600",
        title: `Disbursal On Track: ${aopRunPct.toFixed(0)}% AOP Pacing`,
        detail: `Projected ₹${runRate.toFixed(1)} Cr/month vs ₹${monthlyAopCr.toFixed(1)} Cr target.`,
        severity: "good",
        impactWeight: 30,
        link: "/disbursal-summary",
        section: "disb-kpi",
        expanded: {
          bullets: [
            `${pL} Disbursed: ₹${mtdDisbCr.toFixed(1)} Cr`,
            `Run-rate: ₹${runRate.toFixed(1)} Cr/month (${aopRunPct.toFixed(0)}% of monthly AOP)`,
          ],
          chartData: [],
          chartLabel: "",
          chartValueSuffix: "",
          navigateLabel: "View Disbursal Summary",
        },
      });
    }

    return items;
  }, [coreMetrics, filteredL2, pL, cL]);

  // ─── Assign priority buckets ────────────────────────────────────────────────
  const bucketedItems = useMemo(() => {
    const result: Record<PriorityKey, InsightItem[]> = {
      P0: [], P1: [], P2: [], P3: [], emerging: [], positive: [],
    };

    briefingItems.forEach((item) => {
      if (item.severity === "good" || item.severity === "info") {
        result.positive.push(item);
        return;
      }

      // Detect emerging: items with small delta (-1 to -3pp) on stages/lenders that were stable before
      const isEmerging = item.severity === "warn" && item.impactWeight < 35 && (
        item.id.startsWith("lender-warn-") || (item.id.startsWith("stage-drop-") && item.impactWeight < 30)
      );

      if (isEmerging) {
        item.isEmerging = true;
        result.emerging.push(item);
        return;
      }

      // Bucket by severity and impact weight
      if (item.severity === "bad" && item.impactWeight >= 80) {
        result.P0.push(item);
      } else if (item.severity === "bad" || (item.severity === "warn" && item.impactWeight >= 60)) {
        result.P1.push(item);
      } else if (item.severity === "warn" && item.impactWeight >= 35) {
        result.P2.push(item);
      } else {
        result.P3.push(item);
      }
    });

    // Sort each bucket by impact weight
    Object.values(result).forEach((arr) => arr.sort((a, b) => b.impactWeight - a.impactWeight));

    return result;
  }, [briefingItems]);

  // ─── Auto-select first non-empty tab ────────────────────────────────────────
  useEffect(() => {
    const order: PriorityKey[] = ["P0", "P1", "P2", "P3", "emerging", "positive"];
    for (const key of order) {
      if (bucketedItems[key].length > 0) {
        setActivePriorityTab(key);
        break;
      }
    }
  }, [bucketedItems]);

  // ─── Action items ─────────────────────────────────────────────────────────
  const actionItems = useMemo(() => {
    if (!coreMetrics) return [];
    const actions: { priority: "high" | "medium" | "low"; action: string; owner: string; tab: string; href: string; filter?: { lender?: string } }[] = [];
    const worstStages = [...coreMetrics.stageDeltas].filter((s) => s.delta < -3).sort((a, b) => a.delta - b.delta);
    worstStages.slice(0, 3).forEach((s) => {
      actions.push({ priority: s.delta < -8 ? "high" : "medium", action: `Investigate ${s.stage} conversion drop (${s.delta.toFixed(1)}pp).`, owner: "PM / Ops", tab: "Funnel Summary", href: "/funnel-summary" });
    });
    coreMetrics.lenderPerf.filter((l) => l.aopPct > 0 && l.aopPct < 60).forEach((l) => {
      actions.push({ priority: "high", action: `${l.lender} AOP pacing critically low at ${l.aopPct}%.`, owner: "BD", tab: "Disbursal Summary", href: "/disbursal-summary", filter: { lender: l.lender } });
    });
    coreMetrics.lenderPerf.filter((l) => l.delta < -5).slice(0, 2).forEach((l) => {
      actions.push({ priority: "medium", action: `${l.lender} Funnel Conv% dropped ${Math.abs(l.delta).toFixed(1)}pp. Raise RCA.`, owner: "PM", tab: "RCA & Fix Tracking", href: "/stage-health", filter: { lender: l.lender } });
    });
    return actions;
  }, [coreMetrics]);

  if (loading) {
    return <div className="flex h-full items-center justify-center"><div className="text-sm text-muted-foreground animate-pulse">Generating insights...</div></div>;
  }
  if (!coreMetrics) return null;

  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const openEmailModal = (item: InsightItem) => {
    const body = [
      `Insight: ${item.title}`,
      `Detail: ${item.detail}`,
      "",
      "Analysis:",
      ...item.expanded.bullets.map((b) => `  • ${b}`),
      "",
      `View in dashboard: ${window.location.origin}${item.link}${item.section ? "#" + item.section : ""}`,
    ].join("\n");
    setEmailModal({ open: true, subject: `[ML Dashboard] ${item.title}`, body });
  };

  const openTicketModal = (item: InsightItem) => {
    const desc = [
      item.detail,
      "",
      "Analysis:",
      ...item.expanded.bullets.map((b) => `  • ${b}`),
      "",
      ...(item.expanded.l2Drills || []).flatMap((d) => [
        "Root Cause Hypotheses:",
        ...d.hypotheses.map((h) => `  ▸ ${h}`),
        ...(d.lenderBreakdown || []).map((lb) => `  ${lb.lender}: ${lb.delta > 0 ? "+" : ""}${lb.delta}pp`),
      ]),
      "",
      `Link: ${typeof window !== "undefined" ? window.location.origin : ""}${item.link}${item.section ? "#" + item.section : ""}`,
    ].join("\n");
    // Derive priority from the actual bucket the insight is placed in
    let priority = "P2";
    if (bucketedItems.P0.some((i) => i.id === item.id)) priority = "P0";
    else if (bucketedItems.P1.some((i) => i.id === item.id)) priority = "P1";
    else if (bucketedItems.P2.some((i) => i.id === item.id)) priority = "P2";
    else if (bucketedItems.P3.some((i) => i.id === item.id)) priority = "P3";
    else if (bucketedItems.emerging.some((i) => i.id === item.id)) priority = "P2";
    else priority = "P3";
    setTicketModal({ open: true, title: item.title, description: desc, priority });
  };

  const openFeedbackModal = (item: InsightItem) => {
    setFeedbackModal({ open: true, title: item.title, detail: item.detail });
  };

  const openFeedbackForChart = (chartTitle: string, detail: string) => {
    setFeedbackModal({ open: true, title: chartTitle, detail });
  };

  const renderInsightCard = (item: InsightItem) => {
    const Icon = item.icon;
    const isExpanded = expandedIds.has(item.id);
    return (
      <Card key={item.id} className={cn(
        "transition-all overflow-hidden",
        item.severity === "bad" ? "border-red-200/60" :
        item.severity === "warn" ? "border-amber-200/60" :
        item.severity === "good" ? "border-emerald-200/60" : "border-border",
        isExpanded && "shadow-md",
      )}>
        <CardContent className="p-0">
          <div
            className={cn(
              "flex items-start gap-3 p-3 text-left transition-colors",
              item.severity === "bad" ? "bg-red-50/30 hover:bg-red-50/50" :
              item.severity === "warn" ? "bg-amber-50/30 hover:bg-amber-50/50" :
              item.severity === "good" ? "bg-emerald-50/30 hover:bg-emerald-50/50" :
              "bg-muted/20 hover:bg-muted/30"
            )}
          >
            <button className="cursor-pointer shrink-0 mt-0.5" onClick={() => toggleExpand(item.id)}>
              {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </button>
            <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-lg",
              item.severity === "bad" ? "bg-red-100" : item.severity === "warn" ? "bg-amber-100" : item.severity === "good" ? "bg-emerald-100" : "bg-muted"
            )}>
              <Icon className={cn("h-3.5 w-3.5", item.color)} />
            </div>
            <button className="flex-1 min-w-0 text-left cursor-pointer" onClick={() => toggleExpand(item.id)}>
              <p className="text-xs font-semibold">{item.title}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{item.detail}</p>
            </button>
            {/* Action buttons */}
            <div className="flex items-center gap-1 shrink-0">
              {item.isEmerging && (
                <Badge variant="outline" className="text-[8px] bg-violet-50 text-violet-700 border-violet-200 px-1.5">NEW</Badge>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); openFeedbackModal(item); }}
                className="flex items-center justify-center h-6 w-6 rounded-md border border-border/60 text-muted-foreground hover:text-orange-600 hover:border-orange-300 transition-colors cursor-pointer"
                title="Raise feedback / question"
              >
                <MessageSquarePlus className="h-3 w-3" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); openEmailModal(item); }}
                className="flex items-center justify-center h-6 w-6 rounded-md border border-border/60 text-muted-foreground hover:text-blue-600 hover:border-blue-300 transition-colors cursor-pointer"
                title="Share via email"
              >
                <Mail className="h-3 w-3" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); openTicketModal(item); }}
                className="flex items-center justify-center h-6 w-6 rounded-md border border-border/60 text-muted-foreground hover:text-violet-600 hover:border-violet-300 transition-colors cursor-pointer"
                title="Create ticket"
              >
                <Ticket className="h-3 w-3" />
              </button>
            </div>
          </div>

          {isExpanded && (
            <div className="border-t border-border/50 px-4 py-3 space-y-3 bg-card">
              {/* L2 Drill-Down: Why is this happening? */}
              {item.expanded.l2Drills && item.expanded.l2Drills.length > 0 && (
                <div className="rounded-lg border border-amber-200/60 bg-amber-50/20 p-3">
                  <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="h-3 w-3" />
                    Why is this happening?
                  </p>
                  {item.expanded.l2Drills.map((drill, di) => (
                    <div key={di} className="space-y-1.5">
                      <ul className="space-y-1">
                        {drill.hypotheses.map((h, hi) => (
                          <li key={hi} className="text-[11px] text-foreground flex items-start gap-2 leading-relaxed">
                            <span className="text-amber-500 mt-0.5 shrink-0">▸</span>
                            {h}
                          </li>
                        ))}
                      </ul>
                      {drill.lenderBreakdown && drill.lenderBreakdown.length > 0 && (
                        <div className="mt-2">
                          <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Lender impact at this stage</p>
                          <div className="flex flex-wrap gap-1.5">
                            {drill.lenderBreakdown.map((lb) => (
                              <Badge
                                key={lb.lender}
                                variant="outline"
                                className={cn(
                                  "text-[9px] cursor-pointer",
                                  lb.delta < -3 ? "bg-red-50 text-red-700 border-red-200" :
                                  lb.delta < 0 ? "bg-amber-50 text-amber-700 border-amber-200" :
                                  "bg-emerald-50 text-emerald-700 border-emerald-200"
                                )}
                                onClick={() => navigateWithFilter(item.link, { lender: lb.lender }, item.section)}
                              >
                                {lb.lender}: {lb.delta > 0 ? "+" : ""}{lb.delta}pp
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Drill-Down</p>
                <ul className="space-y-1">
                  {item.expanded.bullets.map((b, i) => (
                    <li key={i} className="text-[11px] text-foreground flex items-start gap-2 leading-relaxed">
                      <span className="text-muted-foreground/50 mt-0.5 shrink-0">&bull;</span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>

              {item.expanded.chartData.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{item.expanded.chartLabel}</p>
                    <button
                      onClick={() => openFeedbackForChart(item.expanded.chartLabel, `Chart context: ${item.title} — ${item.detail}`)}
                      className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-orange-600 transition-colors cursor-pointer"
                      title="Raise feedback on this chart"
                    >
                      <MessageSquarePlus className="h-3 w-3" />
                      Feedback
                    </button>
                  </div>
                  <p className="text-[9px] text-muted-foreground mb-1 italic">Click any bar to navigate with that filter applied</p>
                  <div className="rounded-lg border bg-muted/10 overflow-hidden">
                    <ResponsiveContainer width="100%" height={Math.min(200, Math.max(120, item.expanded.chartData.length * 22 + 40))}>
                      <BarChart data={item.expanded.chartData} layout="vertical" margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 92%)" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                        <YAxis dataKey="label" type="category" tick={{ fontSize: 8 }} tickLine={false} axisLine={false} width={120} />
                        <Tooltip contentStyle={{ fontSize: 11 }} formatter={(val: number | undefined) => val != null ? `${val}${item.expanded.chartValueSuffix}` : ""} />
                        <Bar
                          dataKey="value"
                          barSize={12}
                          radius={[0, 4, 4, 0]}
                          cursor="pointer"
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          onClick={(data: any) => {
                            if (data?.filterContext?.lender) {
                              navigateWithFilter(item.link, { lender: data.filterContext.lender }, item.section);
                            } else {
                              navigateWithFilter(item.link, item.defaultFilter, item.section);
                            }
                          }}
                        >
                          {item.expanded.chartData.map((d, idx) => (
                            <Cell key={idx} fill={d.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[10px] h-7 cursor-pointer"
                  onClick={() => navigateWithFilter(item.link, item.defaultFilter, item.section)}
                >
                  <ExternalLink className="h-3 w-3 mr-1.5" />
                  {item.expanded.navigateLabel}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[10px] h-7 cursor-pointer"
                  onClick={() => openEmailModal(item)}
                >
                  <Mail className="h-3 w-3 mr-1.5" />
                  Email
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[10px] h-7 cursor-pointer"
                  onClick={() => openTicketModal(item)}
                >
                  <Ticket className="h-3 w-3 mr-1.5" />
                  Create Ticket
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[10px] h-7 cursor-pointer text-orange-600 border-orange-200 hover:bg-orange-50"
                  onClick={() => openFeedbackModal(item)}
                >
                  <MessageSquarePlus className="h-3 w-3 mr-1.5" />
                  Raise Feedback
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div>
      <PageHeader title="Insights & Briefing" description={`Your daily starting point · ${pL} vs ${cL} · ${today}`} />

      <div className="p-6 space-y-6">
        {/* ─── Key Metrics (3-zone, no health score) ─────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Key Metrics — 4 cards spanning 9 cols */}
          <div className="lg:col-span-9 grid grid-cols-2 md:grid-cols-4 gap-3">
            <ClickableKpiCard onClick={() => setKpiDive({ open: true, config: {
              title: `Disbursed (${pL})`, metric: coreMetrics.mtdDisbursed.toLocaleString("en-IN"),
              subtitle: `₹${coreMetrics.mtdAmountCr} Cr total disbursal amount`,
              sections: [
                { title: "Comparison", type: "kpi-row", kpis: [
                  { label: pL, value: coreMetrics.mtdDisbursed.toLocaleString("en-IN"), sub: `₹${coreMetrics.mtdAmountCr} Cr` },
                  { label: cL, value: coreMetrics.lmtdDisbursed.toLocaleString("en-IN") },
                  { label: "Growth", value: `${coreMetrics.lmtdDisbursed > 0 ? (((coreMetrics.mtdDisbursed - coreMetrics.lmtdDisbursed) / coreMetrics.lmtdDisbursed) * 100).toFixed(1) : 0}%`, color: coreMetrics.mtdDisbursed >= coreMetrics.lmtdDisbursed ? "text-emerald-600" : "text-red-600" },
                  { label: "ATS", value: `₹${AVG_ATS}L` },
                ]},
                { title: "Top Lenders by Disbursal", type: "chart", chart: { type: "bar", data: [...coreMetrics.lenderPerf].sort((a, b) => b.disbCr - a.disbCr).slice(0, 8).map((l) => ({ name: l.lender, value: l.disbCr, color: l.aopPct >= 80 ? "hsl(150,60%,45%)" : "hsl(220,70%,55%)" })), label: "Cr", valueSuffix: " Cr" }},
                { title: "Lender Breakdown", type: "table", headers: ["Lender", `${pL} Disb`, "₹ Cr", "AOP %", "Growth"], rows: [...coreMetrics.lenderPerf].sort((a, b) => b.disbCr - a.disbCr).slice(0, 8).map((l) => ({ label: l.lender, values: [l.mtdDisbursed?.toLocaleString("en-IN") || "-", `₹${l.disbCr.toFixed(1)}`, `${l.aopPct}%`, `${l.delta > 0 ? "+" : ""}${l.delta.toFixed(1)}pp`] })) },
              ],
            }})}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Banknote className="h-4 w-4 text-emerald-500" />
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Disbursed ({pL})</p>
                  </div>
                  <p className="text-2xl font-bold tabular-nums">{coreMetrics.mtdDisbursed.toLocaleString("en-IN")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">₹{coreMetrics.mtdAmountCr} Cr</p>
                  <div className="flex items-center gap-1 mt-2">
                    {coreMetrics.mtdDisbursed >= coreMetrics.lmtdDisbursed ? <TrendingUp className="h-3 w-3 text-emerald-600" /> : <TrendingDown className="h-3 w-3 text-red-600" />}
                    <span className={cn("text-[11px] font-semibold", coreMetrics.mtdDisbursed >= coreMetrics.lmtdDisbursed ? "text-emerald-600" : "text-red-600")}>{coreMetrics.lmtdDisbursed > 0 ? `${(((coreMetrics.mtdDisbursed - coreMetrics.lmtdDisbursed) / coreMetrics.lmtdDisbursed) * 100).toFixed(0)}%` : "-"} vs {cL}</span>
                  </div>
                </CardContent>
              </Card>
            </ClickableKpiCard>

            <ClickableKpiCard onClick={() => setKpiDive({ open: true, config: {
              title: "Funnel Conv%", metric: `${coreMetrics.mtdE2E}%`,
              subtitle: `Workable → Disbursed conversion (${coreMetrics.e2eDelta > 0 ? "+" : ""}${coreMetrics.e2eDelta}pp vs ${cL})`,
              sections: [
                { title: "Stage-wise Conversion", type: "chart", chart: { type: "bar", data: coreMetrics.stageDeltas.map((s) => ({ name: s.stage.length > 12 ? s.stage.substring(0, 10) + ".." : s.stage, value: s.mtdConv, color: s.delta >= 0 ? "hsl(150,60%,45%)" : "hsl(350,65%,55%)" })), label: "Conv%", valueSuffix: "%" }},
                { title: "Stage Details", type: "table", headers: ["Stage", `${pL} Conv%`, `${cL} Conv%`, "Delta"], rows: coreMetrics.stageDeltas.map((s) => ({ label: s.stage, values: [`${s.mtdConv.toFixed(1)}%`, `${s.lmtdConv.toFixed(1)}%`, `${s.delta > 0 ? "+" : ""}${s.delta.toFixed(1)}pp`], highlight: s.delta < -3 })) },
                { title: "Key Observations", type: "bullets", bullets: [
                  `${coreMetrics.stageDeltas.filter((s) => s.delta > 1).length} stages improved, ${coreMetrics.stageDeltas.filter((s) => s.delta < -1).length} declined`,
                  ...coreMetrics.stageDeltas.filter((s) => s.delta < -3).slice(0, 3).map((s) => `⚠ ${s.stage}: ${s.delta.toFixed(1)}pp drop — needs investigation`),
                ]},
              ],
            }})}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="h-4 w-4 text-blue-500" />
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Funnel Conv%</p>
                  </div>
                  <p className="text-2xl font-bold tabular-nums">{coreMetrics.mtdE2E}%</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Workable → Disbursed</p>
                  <div className="flex items-center gap-1 mt-2">
                    {coreMetrics.e2eDelta >= 0 ? <TrendingUp className="h-3 w-3 text-emerald-600" /> : <TrendingDown className="h-3 w-3 text-red-600" />}
                    <span className={cn("text-[11px] font-semibold", coreMetrics.e2eDelta >= 0 ? "text-emerald-600" : "text-red-600")}>{coreMetrics.e2eDelta > 0 ? "+" : ""}{coreMetrics.e2eDelta}pp vs {cL}</span>
                  </div>
                </CardContent>
              </Card>
            </ClickableKpiCard>

            <ClickableKpiCard onClick={() => setKpiDive({ open: true, config: {
              title: "AOP Pacing", metric: `${coreMetrics.aopPacing}%`,
              subtitle: `₹${coreMetrics.projectedCr} Cr projected vs ₹${coreMetrics.monthlyTarget} Cr monthly target`,
              sections: [
                { title: "AOP Summary", type: "kpi-row", kpis: [
                  { label: "Monthly Target", value: `₹${coreMetrics.monthlyTarget} Cr` },
                  { label: "Projected", value: `₹${coreMetrics.projectedCr} Cr`, color: coreMetrics.aopPacing >= 100 ? "text-emerald-600" : "text-red-600" },
                  { label: "Annual AOP", value: `₹${TOTAL_AOP} Cr` },
                ]},
                { title: "Lender AOP Pacing", type: "chart", chart: { type: "bar", data: coreMetrics.lenderPerf.filter((l) => l.aopPct > 0).sort((a, b) => a.aopPct - b.aopPct).map((l) => ({ name: l.lender, value: l.aopPct, color: l.aopPct >= 100 ? "hsl(150,60%,45%)" : l.aopPct >= 80 ? "hsl(220,70%,55%)" : l.aopPct >= 50 ? "hsl(40,80%,50%)" : "hsl(350,65%,55%)" })), label: "Pacing", valueSuffix: "%" }},
                { title: "Lender AOP Detail", type: "table", headers: ["Lender", "AOP (Cr)", `${pL} Run-Rate`, "Pacing %", "Status"], rows: coreMetrics.lenderPerf.filter((l) => l.aopPct > 0).sort((a, b) => a.aopPct - b.aopPct).map((l) => ({ label: l.lender, values: [`₹${(LENDER_AOP[l.lender] || 0)}`, `₹${l.disbCr.toFixed(1)} Cr`, `${l.aopPct}%`, l.aopPct >= 100 ? "✅ On Track" : l.aopPct >= 80 ? "⚠ Monitor" : "🔴 Behind"], highlight: l.aopPct < 60 })) },
              ],
            }})}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-4 w-4 text-amber-500" />
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">AOP Pacing</p>
                  </div>
                  <p className="text-2xl font-bold tabular-nums">{coreMetrics.aopPacing}%</p>
                  <p className="text-xs text-muted-foreground mt-0.5">₹{coreMetrics.projectedCr} / ₹{coreMetrics.monthlyTarget} Cr</p>
                  <Progress value={Math.min(coreMetrics.aopPacing, 100)} className="h-1.5 mt-2" />
                </CardContent>
              </Card>
            </ClickableKpiCard>

            <ClickableKpiCard onClick={() => setKpiDive({ open: true, config: {
              title: "Quick Pulse", metric: `${coreMetrics.stageDeltas.filter((s) => s.delta < -1).length} declining`,
              subtitle: "Overview of funnel stages and lender performance",
              sections: [
                { title: "Summary", type: "kpi-row", kpis: [
                  { label: "Stages Improving", value: coreMetrics.stageDeltas.filter((s) => s.delta > 1).length, color: "text-emerald-600" },
                  { label: "Stages Declining", value: coreMetrics.stageDeltas.filter((s) => s.delta < -1).length, color: "text-red-600" },
                  { label: "Lenders on AOP", value: `${coreMetrics.lenderPerf.filter((l) => l.aopPct >= 80).length}/${coreMetrics.lenderPerf.length}` },
                  { label: "Open Issues", value: coreMetrics.criticalStages + coreMetrics.criticalLenders, color: "text-amber-600" },
                ]},
                { title: "Declining Stages", type: "table", headers: ["Stage", `${pL} Conv%`, `${cL} Conv%`, "Delta (pp)"], rows: coreMetrics.stageDeltas.filter((s) => s.delta < -1).sort((a, b) => a.delta - b.delta).map((s) => ({ label: s.stage, values: [`${s.mtdConv.toFixed(1)}%`, `${s.lmtdConv.toFixed(1)}%`, `${s.delta.toFixed(1)}pp`], highlight: s.delta < -5 })) },
                { title: "Improving Stages", type: "table", headers: ["Stage", `${pL} Conv%`, `${cL} Conv%`, "Delta (pp)"], rows: coreMetrics.stageDeltas.filter((s) => s.delta > 1).sort((a, b) => b.delta - a.delta).map((s) => ({ label: s.stage, values: [`${s.mtdConv.toFixed(1)}%`, `${s.lmtdConv.toFixed(1)}%`, `+${s.delta.toFixed(1)}pp`] })) },
                { title: "Lenders Behind AOP (<80%)", type: "table", headers: ["Lender", "AOP Pacing", "Funnel Conv%", "Delta"], rows: coreMetrics.lenderPerf.filter((l) => l.aopPct > 0 && l.aopPct < 80).sort((a, b) => a.aopPct - b.aopPct).map((l) => ({ label: l.lender, values: [`${l.aopPct}%`, `${l.mtdConv.toFixed(1)}%`, `${l.delta > 0 ? "+" : ""}${l.delta.toFixed(1)}pp`], highlight: l.aopPct < 50 })) },
              ],
            }})}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="h-4 w-4 text-violet-500" />
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Quick Pulse</p>
                  </div>
                  <div className="space-y-1.5 mt-1">
                    <div className="flex items-center justify-between"><span className="text-xs">Stages improving</span><Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200">{coreMetrics.stageDeltas.filter((s) => s.delta > 1).length}</Badge></div>
                    <div className="flex items-center justify-between"><span className="text-xs">Stages declining</span><Badge variant="outline" className="text-[9px] bg-red-50 text-red-700 border-red-200">{coreMetrics.stageDeltas.filter((s) => s.delta < -1).length}</Badge></div>
                    <div className="flex items-center justify-between"><span className="text-xs">Lenders on AOP</span><Badge variant="outline" className="text-[9px]">{coreMetrics.lenderPerf.filter((l) => l.aopPct >= 80).length}/{coreMetrics.lenderPerf.length}</Badge></div>
                    <div className="flex items-center justify-between"><span className="text-xs">Open issues</span><Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700 border-amber-200">{coreMetrics.criticalStages + coreMetrics.criticalLenders}</Badge></div>
                  </div>
                </CardContent>
              </Card>
            </ClickableKpiCard>
          </div>

          {/* Lender Disbursal Chart */}
          <Card className="lg:col-span-3 overflow-hidden">
            <CardContent className="p-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Lender Disbursal (Cr)</p>
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={[...coreMetrics.lenderPerf].sort((a, b) => b.disbCr - a.disbCr).slice(0, 8)} margin={{ top: 10, right: 10, left: -5, bottom: 0 }}>
                  <XAxis dataKey="lender" tick={{ fontSize: 8 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} width={35} />
                  <Tooltip contentStyle={{ fontSize: 11 }} />
                  <Bar dataKey="disbCr" radius={[4, 4, 0, 0]} barSize={20} cursor="pointer"
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onClick={(data: any) => { if (data?.lender) navigateWithFilter("/disbursal-summary", { lender: data.lender }); }}>
                    {[...coreMetrics.lenderPerf].sort((a, b) => b.disbCr - a.disbCr).slice(0, 8).map((entry, idx) => (
                      <Cell key={idx} fill={entry.aopPct >= 80 ? "hsl(150, 60%, 45%)" : entry.aopPct >= 60 ? "hsl(220, 70%, 55%)" : "hsl(350, 65%, 55%)"} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* ─── Tickets counter ──────────────────────────────────────────── */}
        {tickets.length > 0 && (
          <div className="flex items-center gap-2">
            <Badge className="bg-violet-100 text-violet-700 border-violet-200 text-[10px]">
              <Ticket className="h-3 w-3 mr-1" />
              {tickets.length} ticket{tickets.length > 1 ? "s" : ""} created this session
            </Badge>
          </div>
        )}

        {/* ─── Priority Sections ───────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-0 border-b border-border mb-4 overflow-x-auto">
            {PRIORITY_SECTIONS.map((sec) => {
              const count = bucketedItems[sec.key].length;
              const SectionIcon = sec.icon;
              return (
                <button
                  key={sec.key}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-colors border-b-2 -mb-px whitespace-nowrap cursor-pointer",
                    activePriorityTab === sec.key
                      ? `${sec.border} ${sec.color} ${sec.bg}`
                      : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  )}
                  onClick={() => setActivePriorityTab(sec.key)}
                >
                  <SectionIcon className="h-3.5 w-3.5" />
                  {sec.label}
                  {count > 0 && (
                    <Badge variant="outline" className={cn("text-[8px] ml-0.5 px-1", activePriorityTab === sec.key ? sec.badge : "")}>
                      {count}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active section content */}
          {(() => {
            const activeItems = bucketedItems[activePriorityTab];
            const activeSec = PRIORITY_SECTIONS.find((s) => s.key === activePriorityTab)!;
            if (activeItems.length === 0) {
              return (
                <Card className="border-border">
                  <CardContent className="py-8 text-center">
                    <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-2" />
                    <p className="text-sm font-medium">No items in {activeSec.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">Check other priority levels for insights.</p>
                  </CardContent>
                </Card>
              );
            }
            return (
              <div>
                <p className="text-[11px] text-muted-foreground mb-3">
                  {activePriorityTab === "P0" && "Revenue-impacting issues requiring immediate action. Click to expand for drill-down."}
                  {activePriorityTab === "P1" && "Significant issues that should be addressed this sprint."}
                  {activePriorityTab === "P2" && "Medium-priority items to address this week."}
                  {activePriorityTab === "P3" && "Lower-priority items to monitor. No immediate action required."}
                  {activePriorityTab === "emerging" && "Issues appearing for the first time that may grow if not addressed."}
                  {activePriorityTab === "positive" && "Positive signals and improvements across the funnel."}
                </p>
                <div className="space-y-2">
                  {activeItems.map((item) => renderInsightCard(item))}
                </div>
              </div>
            );
          })()}
        </div>

        <Separator />

        {/* ─── Recommended Actions ─────────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-1">
            <Zap className="h-4 w-4 text-violet-500" />
            Recommended Actions
          </h2>
          <p className="text-[10px] text-muted-foreground mb-3">Click any action to navigate with relevant filters applied.</p>

          {actionItems.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-[10px] font-semibold w-[70px]">Priority</TableHead>
                      <TableHead className="text-[10px] font-semibold">Action</TableHead>
                      <TableHead className="text-[10px] font-semibold w-[80px]">Owner</TableHead>
                      <TableHead className="text-[10px] font-semibold w-[140px]">Navigate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {actionItems.map((item, i) => (
                      <TableRow key={i} className="hover:bg-muted/20 cursor-pointer" onClick={() => navigateWithFilter(item.href, item.filter)}>
                        <TableCell className="py-2">
                          <Badge variant="outline" className={cn("text-[8px] font-bold px-1.5", item.priority === "high" ? "bg-red-50 text-red-700 border-red-200" : item.priority === "medium" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-gray-50 text-gray-600 border-gray-200")}>
                            {item.priority.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs py-2 leading-relaxed">{item.action}</TableCell>
                        <TableCell className="text-xs py-2 text-muted-foreground">{item.owner}</TableCell>
                        <TableCell className="py-2">
                          <span className="flex items-center gap-1 text-[10px] text-blue-600 font-medium">
                            {item.tab} <ArrowRight className="h-3 w-3" />
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent className="py-8 text-center">
              <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-medium">No urgent actions needed</p>
              <p className="text-xs text-muted-foreground mt-1">All metrics are within acceptable ranges</p>
            </CardContent></Card>
          )}
        </div>

        <Separator />

        {/* ─── Lender & Program Scorecards (side-by-side) ────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Lender Scorecard */}
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2 mb-1">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              Lender Scorecard
            </h2>
            <p className="text-[10px] text-muted-foreground mb-3">Click any row to navigate.</p>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-[10px] font-semibold">Lender</TableHead>
                        <TableHead className="text-[10px] font-semibold text-right">₹ Cr</TableHead>
                        <TableHead className="text-[10px] font-semibold text-right">Conv%</TableHead>
                        <TableHead className="text-[10px] font-semibold text-right">Δ</TableHead>
                        <TableHead className="text-[10px] font-semibold text-center">AOP</TableHead>
                        <TableHead className="text-[10px] font-semibold text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...coreMetrics.lenderPerf].sort((a, b) => b.disbCr - a.disbCr).map((l) => {
                        const isBad = l.delta < -3 || (l.aopPct > 0 && l.aopPct < 60);
                        const isWarn = l.delta < 0 || (l.aopPct > 0 && l.aopPct < 80);
                        const isGood = l.delta >= 0 && l.aopPct >= 80;
                        return (
                          <TableRow key={l.lender} className="hover:bg-muted/20 cursor-pointer" onClick={() => navigateWithFilter("/funnel-summary", { lender: l.lender }, "lender-kpis")}>
                            <TableCell className="text-xs font-semibold py-1.5">{l.lender}</TableCell>
                            <TableCell className="text-xs text-right tabular-nums font-medium py-1.5">₹{l.disbCr}</TableCell>
                            <TableCell className="text-xs text-right tabular-nums py-1.5">{l.mtdConv}%</TableCell>
                            <TableCell className="text-right py-1.5">
                              <span className={cn("text-[10px] font-bold", l.delta > 0 ? "text-emerald-600" : l.delta < 0 ? "text-red-600" : "text-muted-foreground")}>{l.delta > 0 ? "+" : ""}{l.delta}pp</span>
                            </TableCell>
                            <TableCell className="py-1.5">{l.aopPct > 0 ? <div className="flex items-center gap-1 justify-center"><Progress value={Math.min(l.aopPct, 100)} className="h-1 w-10" /><span className="text-[8px] tabular-nums font-medium">{l.aopPct}%</span></div> : <span className="text-[8px] text-muted-foreground">-</span>}</TableCell>
                            <TableCell className="text-center py-1.5">
                              {isBad ? <Badge variant="outline" className="text-[7px] bg-red-50 text-red-700 border-red-200 px-1">Risk</Badge> : isWarn ? <Badge variant="outline" className="text-[7px] bg-amber-50 text-amber-700 border-amber-200 px-1">Watch</Badge> : isGood ? <Badge variant="outline" className="text-[7px] bg-emerald-50 text-emerald-700 border-emerald-200 px-1">OK</Badge> : <Badge variant="outline" className="text-[7px] px-1">-</Badge>}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Program Type Scorecard */}
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2 mb-1">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              Program Type Scorecard
            </h2>
            <p className="text-[10px] text-muted-foreground mb-3">Click any row to navigate.</p>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-[10px] font-semibold">Program</TableHead>
                        <TableHead className="text-[10px] font-semibold text-right">₹ Cr</TableHead>
                        <TableHead className="text-[10px] font-semibold text-right">Conv%</TableHead>
                        <TableHead className="text-[10px] font-semibold text-right">Δ</TableHead>
                        <TableHead className="text-[10px] font-semibold text-right">Vol%</TableHead>
                        <TableHead className="text-[10px] font-semibold text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...coreMetrics.programPerf].sort((a, b) => b.disbCr - a.disbCr).map((p) => {
                        const isBad = p.delta < -3;
                        const isWarn = p.delta < 0;
                        const isGood = p.delta >= 0;
                        return (
                          <TableRow key={p.program} className="hover:bg-muted/20 cursor-pointer" onClick={() => navigateWithFilter("/funnel-summary", { productType: p.program })}>
                            <TableCell className="text-xs font-semibold py-1.5">{p.program}</TableCell>
                            <TableCell className="text-xs text-right tabular-nums font-medium py-1.5">₹{p.disbCr}</TableCell>
                            <TableCell className="text-xs text-right tabular-nums py-1.5">{p.mtdConv}%</TableCell>
                            <TableCell className="text-right py-1.5">
                              <span className={cn("text-[10px] font-bold", p.delta > 0 ? "text-emerald-600" : p.delta < 0 ? "text-red-600" : "text-muted-foreground")}>{p.delta > 0 ? "+" : ""}{p.delta}pp</span>
                            </TableCell>
                            <TableCell className="text-right py-1.5">
                              <span className={cn("text-[10px] font-bold", p.volumeGrowth > 0 ? "text-emerald-600" : p.volumeGrowth < 0 ? "text-red-600" : "text-muted-foreground")}>{p.volumeGrowth > 0 ? "+" : ""}{p.volumeGrowth}%</span>
                            </TableCell>
                            <TableCell className="text-center py-1.5">
                              {isBad ? <Badge variant="outline" className="text-[7px] bg-red-50 text-red-700 border-red-200 px-1">Risk</Badge> : isWarn ? <Badge variant="outline" className="text-[7px] bg-amber-50 text-amber-700 border-amber-200 px-1">Watch</Badge> : isGood ? <Badge variant="outline" className="text-[7px] bg-emerald-50 text-emerald-700 border-emerald-200 px-1">OK</Badge> : <Badge variant="outline" className="text-[7px] px-1">-</Badge>}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Separator />

        {/* ─── Program × Lender Cross Table ───────────────────────────── */}
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-1">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            Program × Lender — Disbursal (Cr)
          </h2>
          <p className="text-[10px] text-muted-foreground mb-3">Cross-view showing ₹ Cr disbursed by each program × lender combination. Click a cell to apply both filters.</p>
          {(() => {
            const lenders = [...coreMetrics.lenderPerf].sort((a, b) => b.disbCr - a.disbCr).map((l) => l.lender);
            const programs = [...coreMetrics.programPerf].sort((a, b) => b.disbCr - a.disbCr).map((p) => p.program);
            // Build cross-map from raw filtered data
            const crossMap: Record<string, Record<string, number>> = {};
            filteredL2.filter((r) => r.month_start === "1.MTD" && !r.sub_stage && Math.floor(r.major_index) === r.major_index && r.major_index === coreMetrics.allIndices[coreMetrics.allIndices.length - 1]).forEach((r) => {
              if (!crossMap[r.product_type]) crossMap[r.product_type] = {};
              crossMap[r.product_type][r.lender] = (crossMap[r.product_type][r.lender] || 0) + r.leads;
            });
            return (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="text-[10px] font-semibold sticky left-0 bg-muted/50 z-10">Program \ Lender</TableHead>
                          {lenders.map((l) => (
                            <TableHead key={l} className="text-[9px] font-semibold text-center px-2 min-w-[65px]">{l}</TableHead>
                          ))}
                          <TableHead className="text-[9px] font-bold text-center px-2 bg-muted/30">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {programs.map((pt) => {
                          const rowTotal = lenders.reduce((s, l) => s + (crossMap[pt]?.[l] || 0), 0);
                          return (
                            <TableRow key={pt} className="hover:bg-muted/20">
                              <TableCell className="text-[10px] font-semibold py-1.5 sticky left-0 bg-card z-10">{pt}</TableCell>
                              {lenders.map((l) => {
                                const val = crossMap[pt]?.[l] || 0;
                                const crVal = parseFloat((val * AVG_ATS / 100).toFixed(1));
                                return (
                                  <TableCell key={l} className="text-center py-1.5 cursor-pointer hover:bg-primary/5" onClick={() => navigateWithFilter("/funnel-summary", { lender: l, productType: pt })}>
                                    {val > 0 ? (
                                      <span className="text-[10px] tabular-nums font-medium">{crVal}</span>
                                    ) : (
                                      <span className="text-[9px] text-muted-foreground">-</span>
                                    )}
                                  </TableCell>
                                );
                              })}
                              <TableCell className="text-center py-1.5 bg-muted/10">
                                <span className="text-[10px] tabular-nums font-bold">{(rowTotal * AVG_ATS / 100).toFixed(1)}</span>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {/* Total row */}
                        <TableRow className="bg-muted/30 font-bold">
                          <TableCell className="text-[10px] font-bold py-1.5 sticky left-0 bg-muted/30 z-10">Total</TableCell>
                          {lenders.map((l) => {
                            const colTotal = programs.reduce((s, pt) => s + (crossMap[pt]?.[l] || 0), 0);
                            return (
                              <TableCell key={l} className="text-center py-1.5">
                                <span className="text-[10px] tabular-nums font-bold">{(colTotal * AVG_ATS / 100).toFixed(1)}</span>
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center py-1.5 bg-muted/20">
                            <span className="text-[10px] tabular-nums font-bold">₹{coreMetrics.mtdAmountCr}</span>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            );
          })()}
        </div>
      </div>

      {/* ─── Modals ──────────────────────────────────────────────────── */}
      <EmailComposeModal
        open={emailModal.open}
        onClose={() => setEmailModal({ open: false, subject: "", body: "" })}
        defaultSubject={emailModal.subject}
        defaultBody={emailModal.body}
      />
      <CreateTicketModal
        open={ticketModal.open}
        onClose={() => setTicketModal({ open: false, title: "", description: "", priority: "P1" })}
        onSubmit={(ticket) => setTickets((prev) => [...prev, ticket])}
        defaultTitle={ticketModal.title}
        defaultDescription={ticketModal.description}
        defaultPriority={ticketModal.priority}
      />
      <InlineFeedbackModal
        open={feedbackModal.open}
        onClose={() => setFeedbackModal({ open: false, title: "", detail: "" })}
        context={{ title: feedbackModal.title, detail: feedbackModal.detail, page: "Insights & Briefing" }}
      />
      <KpiDeepDiveModal open={kpiDive.open} onClose={() => setKpiDive({ open: false, config: null })} config={kpiDive.config} />
    </div>
  );
}
