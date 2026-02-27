"use client";

import { useEffect, useState, useMemo } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { FunnelTable } from "@/components/dashboard/funnel-table";
import { RichInsightPanel, RichInsightItem, RichChartBar, ChartFeedbackButton } from "@/components/dashboard/rich-insight-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Trophy, AlertTriangle, TrendingDown, TrendingUp, Banknote, Activity, Target, Hash, Users } from "lucide-react";
import { useFilters, useDateRangeFactors } from "@/lib/filter-context";
import {
  ResponsiveContainer,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ComposedChart,
  Line,
  BarChart,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from "recharts";
import {
  fetchL2Analysis,
  fetchCompleteFunnel,
  fetchLenderFunnel,
  fetchDisbursalSummary,
  getUniqueValues,
  L2AnalysisRow,
  FunnelRow,
  LenderFunnelRow,
  DisbursalSummaryRow,
} from "@/lib/data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KPICard } from "@/components/dashboard/kpi-card";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { KpiDeepDiveModal, ClickableKpiCard, KpiDeepDiveConfig, type DeepDiveSection } from "@/components/dashboard/kpi-deep-dive-modal";
import { CommandFunnel, type CommandFunnelStage } from "@/components/dashboard/command-funnel";
import {
  StageDrawer,
  StageDetailContent,
  type StageDrawerStage,
  type LenderProgramRow,
  type SubStageRow,
  type StructuralRow,
  type GlobalVsSpecificRow,
  type FlowLenderInsightRow,
} from "@/components/dashboard/stage-drawer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { GuidedTour, TourHelpButton, PulseHint, useContextualHint } from "@/components/dashboard/guided-tour";
import { FunnelEnhancements, type FunnelEnhancementsProps } from "@/components/dashboard/funnel-enhancements";
import { CommandPalette } from "@/components/dashboard/command-palette";
import { RevenueLossBar } from "@/components/dashboard/revenue-loss-bar";
import { PatternMemory } from "@/components/dashboard/pattern-memory";
import { useRouter } from "next/navigation";

export default function FunnelSummary() {
  const {
    global,
    setGlobal,
    useGlobalFilters,
    setAvailableLenders,
    setAvailableProductTypes,
    setAvailableFlows,
  } = useFilters();
  const [l2Data, setL2Data] = useState<L2AnalysisRow[]>([]);
  const [completeFunnel, setCompleteFunnel] = useState<FunnelRow[]>([]);
  const [lenderFunnel, setLenderFunnel] = useState<LenderFunnelRow[]>([]);
  const [disbData, setDisbData] = useState<DisbursalSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab-level filters
  const [tabLender, setTabLender] = useState("All");
  const [tabProductType, setTabProductType] = useState("All");
  const [tabFlow, setTabFlow] = useState("All");
  // Command Funnel: selected stage (inline panel below funnel) and insights modal
  const [selectedStageIndex, setSelectedStageIndex] = useState<number | null>(null);
  const [insightsModalOpen, setInsightsModalOpen] = useState(false);
  // Third-level: Lender×Program explorer (sub-drawer)
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [explorerLender, setExplorerLender] = useState<string | null>(null);
  const [explorerProgram, setExplorerProgram] = useState<string | null>(null);
  const [drillDownOpen, setDrillDownOpen] = useState(false);
  const [drillDownType, setDrillDownType] = useState<"lender" | "flow" | "l2" | null>(null);
  const [drillDownKey, setDrillDownKey] = useState<string | null>(null);
  // Insight deep-dive: lender × flow L2 breakdown
  const [insightDDOpen, setInsightDDOpen] = useState(false);
  const [insightDDLender, setInsightDDLender] = useState<string | null>(null);
  const [insightDDFlow, setInsightDDFlow] = useState<string | null>(null);
  const [l2DrillStage, setL2DrillStage] = useState<string | null>(null);
  const [l2DrillView, setL2DrillView] = useState<"reasons" | "cohorts" | null>(null);
  const [l2ReasonDrill, setL2ReasonDrill] = useState<string | null>(null);

  const router = useRouter();

  const effectiveLender = useGlobalFilters ? global.lender : tabLender;
  const effectiveProductType = useGlobalFilters
    ? global.productType
    : tabProductType;
  const effectiveFlow = useGlobalFilters ? global.flow : tabFlow;

  // Date range labels
  const { periodLabel: pL, compareLabel: cL, periodFactor: pF, compareFactor: cF } = useDateRangeFactors();

  // Whether we're viewing a specific lender (stages start from Child_Lead_Created)
  const isLenderFiltered = effectiveLender !== "All";

  useEffect(() => {
    async function load() {
      const [data, cf, lf, disb] = await Promise.all([
        fetchL2Analysis(),
        fetchCompleteFunnel(),
        fetchLenderFunnel(),
        fetchDisbursalSummary(),
      ]);
      setL2Data(data);
      setCompleteFunnel(cf);
      setLenderFunnel(lf);
      setDisbData(disb);
      setAvailableLenders(getUniqueValues(data, "lender"));
      setAvailableProductTypes(getUniqueValues(data, "product_type"));
      setAvailableFlows(getUniqueValues(data, "isautoleadcreated"));
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll to section if hash is present in URL
  useEffect(() => {
    if (!loading && typeof window !== "undefined" && window.location.hash) {
      const id = window.location.hash.substring(1);
      setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    }
  }, [loading]);

  const allLenders = useMemo(() => getUniqueValues(l2Data, "lender"), [l2Data]);
  const allProductTypes = useMemo(
    () => getUniqueValues(l2Data, "product_type"),
    [l2Data]
  );
  const allFlows = useMemo(
    () => getUniqueValues(l2Data, "isautoleadcreated"),
    [l2Data]
  );

  // ─── Funnel stages from the correct CSV source ─────────────────────────
  // No lender filter → Complete_Funnel_with_Stages.csv (all stages 2-15, unique parent IDs)
  // Lender filter → Lender_Level_Funnel_With_Stages.csv (stages 6-15 only)
  const funnelStages = useMemo(() => {
    if (isLenderFiltered) {
      // Use lender-level funnel, starting from Child_Lead_Created (index 6)
      let rows = lenderFunnel.filter((r) => r.lender === effectiveLender);
      if (effectiveProductType !== "All") rows = rows.filter((r) => r.product_type === effectiveProductType);
      if (effectiveFlow !== "All") rows = rows.filter((r) => r.isautoleadcreated === effectiveFlow);

      const byIdx: Record<number, { stage: string; leads: number }> = {};
      rows.forEach((r) => {
        if (!byIdx[r.major_index]) byIdx[r.major_index] = { stage: r.major_stage, leads: 0 };
        byIdx[r.major_index].leads += r.leads;
      });

      return Object.entries(byIdx)
        .map(([idx, v]) => ({ index: Number(idx), stage: v.stage, leads: v.leads }))
        .sort((a, b) => a.index - b.index);
    } else {
      // Use complete funnel (all stages including Marketplace_Offer_Selected)
      let rows = completeFunnel.filter((r) => r.major_index >= 2);
      if (effectiveProductType !== "All") rows = rows.filter((r) => r.product_type === effectiveProductType);
      if (effectiveFlow !== "All") rows = rows.filter((r) => r.isautoleadcreated === effectiveFlow);

      const byIdx: Record<number, { stage: string; leads: number }> = {};
      rows.forEach((r) => {
        if (!byIdx[r.major_index]) byIdx[r.major_index] = { stage: r.major_stage, leads: 0 };
        byIdx[r.major_index].leads += r.leads;
      });

      return Object.entries(byIdx)
        .map(([idx, v]) => ({ index: Number(idx), stage: v.stage, leads: v.leads }))
        .sort((a, b) => a.index - b.index);
    }
  }, [isLenderFiltered, completeFunnel, lenderFunnel, effectiveLender, effectiveProductType, effectiveFlow]);

  // ─── Compute stats using funnelStages (from correct CSV) ─────────────
  const stats = useMemo(() => {
    // Use funnelStages for the primary KPIs (from the correct CSV source)
    const fLookup = (idx: number) => funnelStages.find((s) => s.index === idx)?.leads || 0;
    const firstIdx = funnelStages[0]?.index || 2;
    const lastIdx = funnelStages[funnelStages.length - 1]?.index || 15;

    const mtdW = isLenderFiltered ? 0 : fLookup(2); // Only meaningful for complete funnel
    const mtdBRE1 = isLenderFiltered ? 0 : fLookup(4);
    const mtdMkt = isLenderFiltered ? 0 : fLookup(5);
    const mtdC = fLookup(6); // Child_Lead_Created
    const mtdD = fLookup(15); // Disbursed
    const mtdFirst = fLookup(firstIdx); // First stage in the funnel (for overall conv)

    // LMTD from L2 data (funnelStages CSVs don't have period split, use L2 for delta)
    const match = (r: L2AnalysisRow) => {
      if (effectiveLender !== "All" && r.lender !== effectiveLender) return false;
      if (effectiveProductType !== "All" && r.product_type !== effectiveProductType) return false;
      if (effectiveFlow !== "All" && r.isautoleadcreated !== effectiveFlow) return false;
      return true;
    };
    const lmtdRows = l2Data.filter(
      (r) => r.month_start === "2.LMTD" && !r.sub_stage &&
        Math.floor(r.major_index) === r.major_index && r.major_index < 1000 && r.major_index !== 1 && match(r)
    );
    const sumLmtd = (idx: number) => lmtdRows.filter((r) => r.major_index === idx).reduce((s, r) => s + r.leads, 0);

    const lmtdW = sumLmtd(2);
    const lmtdBRE1 = sumLmtd(4);
    const lmtdMkt = sumLmtd(5);
    const lmtdC = sumLmtd(6);
    const lmtdD = sumLmtd(15);
    const lmtdFirst = isLenderFiltered ? sumLmtd(6) : sumLmtd(2);

    // Flow-specific for LPV/FFR (Flow2 only) - always from L2 data
    const matchFlow2 = (r: L2AnalysisRow) => {
      if (effectiveLender !== "All" && r.lender !== effectiveLender) return false;
      if (effectiveProductType !== "All" && r.product_type !== effectiveProductType) return false;
      return r.isautoleadcreated === "Flow2(Manual)";
    };

    const mtdFlow2 = l2Data.filter(
      (r) => r.month_start === "1.MTD" && !r.sub_stage && Math.floor(r.major_index) === r.major_index && r.major_index < 1000 && r.major_index !== 1 && matchFlow2(r)
    );
    const lmtdFlow2 = l2Data.filter(
      (r) => r.month_start === "2.LMTD" && !r.sub_stage && Math.floor(r.major_index) === r.major_index && r.major_index < 1000 && r.major_index !== 1 && matchFlow2(r)
    );

    const mtdF2W = mtdFlow2.filter((r) => r.major_index === 2).reduce((s, r) => s + r.leads, 0);
    const lmtdF2W = lmtdFlow2.filter((r) => r.major_index === 2).reduce((s, r) => s + r.leads, 0);

    const matchFlow1 = (r: L2AnalysisRow) => {
      if (effectiveLender !== "All" && r.lender !== effectiveLender) return false;
      if (effectiveProductType !== "All" && r.product_type !== effectiveProductType) return false;
      return r.isautoleadcreated === "Flow1(Auto)";
    };

    const mtdF1W = l2Data.filter(
      (r) => r.month_start === "1.MTD" && !r.sub_stage && r.major_index === 2 && r.major_index < 1000 && matchFlow1(r)
    ).reduce((s, r) => s + r.leads, 0);
    const lmtdF1W = l2Data.filter(
      (r) => r.month_start === "2.LMTD" && !r.sub_stage && r.major_index === 2 && r.major_index < 1000 && matchFlow1(r)
    ).reduce((s, r) => s + r.leads, 0);

    const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);

    // Mock pre-funnel values
    const mtdWhitelisted = Math.round((mtdW || mtdC) * 8.5);
    const lmtdWhitelisted = Math.round((lmtdW || lmtdC) * 8.2);
    const mtdImpressions = Math.round((mtdW || mtdC) * 4.2);
    const lmtdImpressions = Math.round((lmtdW || lmtdC) * 3.9);
    const mtdClicks = Math.round((mtdW || mtdC) * 1.8);
    const lmtdClicks = Math.round((lmtdW || lmtdC) * 1.7);
    const mtdLPV = Math.round(mtdF2W * 1.35);
    const lmtdLPV = Math.round(lmtdF2W * 1.30);
    const mtdFFR = mtdLPV > 0 ? (mtdF2W / mtdLPV) * 100 : 0;
    const lmtdFFR = lmtdLPV > 0 ? (lmtdF2W / lmtdLPV) * 100 : 0;

    // Top-of-funnel and end-of-funnel conv
    const firstToLast = pct(mtdD, mtdFirst);
    const lmtdFirstToLast = pct(lmtdD, lmtdFirst);

    return {
      mtdW, lmtdW, mtdC, lmtdC, mtdD, lmtdD,
      mtdBRE1, lmtdBRE1, mtdMkt, lmtdMkt,
      mtdF1W, lmtdF1W, mtdF2W, lmtdF2W,
      mtdWhitelisted, lmtdWhitelisted,
      mtdImpressions, lmtdImpressions,
      mtdClicks, lmtdClicks,
      mtdLPV, lmtdLPV,
      mtdFFR, lmtdFFR,
      mtdFirst, lmtdFirst,
      // Ratios
      w2d: isLenderFiltered ? firstToLast : pct(mtdD, mtdW),
      lmtdW2d: isLenderFiltered ? lmtdFirstToLast : pct(lmtdD, lmtdW),
      parentToChild: mtdW > 0 ? mtdC / mtdW : 0,
      lmtdParentToChild: lmtdW > 0 ? lmtdC / lmtdW : 0,
      c2d: pct(mtdD, mtdC),
      lmtdC2d: pct(lmtdD, lmtdC),
      flowRatio: mtdF2W > 0 ? mtdF1W / mtdF2W : 0,
      lmtdFlowRatio: lmtdF2W > 0 ? lmtdF1W / lmtdF2W : 0,
    };
  }, [l2Data, funnelStages, isLenderFiltered, effectiveLender, effectiveProductType, effectiveFlow]);

  // ─── Command Funnel: stages with conv% (vs prev), delta pp, >100% flag; top leak ─
  type FunnelStageWithConv = {
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
  };
  const funnelStagesWithConv = useMemo((): FunnelStageWithConv[] => {
    const match = (r: L2AnalysisRow) => {
      if (effectiveLender !== "All" && r.lender !== effectiveLender) return false;
      if (effectiveProductType !== "All" && r.product_type !== effectiveProductType) return false;
      if (effectiveFlow !== "All" && r.isautoleadcreated !== effectiveFlow) return false;
      return true;
    };
    const mtdRows = l2Data.filter(
      (r) => r.month_start === "1.MTD" && !r.sub_stage &&
        Math.floor(r.major_index) === r.major_index && r.major_index < 1000 && r.major_index !== 1 && match(r)
    );
    const lmtdRows = l2Data.filter(
      (r) => r.month_start === "2.LMTD" && !r.sub_stage &&
        Math.floor(r.major_index) === r.major_index && r.major_index < 1000 && r.major_index !== 1 && match(r)
    );
    const sumMtd = (idx: number) => mtdRows.filter((r) => r.major_index === idx).reduce((s, r) => s + r.leads, 0);
    const sumLmtd = (idx: number) => lmtdRows.filter((r) => r.major_index === idx).reduce((s, r) => s + r.leads, 0);

    const result: FunnelStageWithConv[] = [];
    for (let i = 0; i < funnelStages.length; i++) {
      const cur = funnelStages[i];
      const prev = i > 0 ? funnelStages[i - 1] : null;
      const leads = sumMtd(cur.index);
      const prevLeads = prev ? sumMtd(prev.index) : 0;
      const prevStageName = prev?.stage ?? "";
      const lmtdLeads = sumLmtd(cur.index);
      const lmtdPrevLeads = prev ? sumLmtd(prev.index) : 0;

      const convPct = prevLeads > 0 ? parseFloat(((leads / prevLeads) * 100).toFixed(2)) : (i === 0 ? 100 : null);
      const lmtdConvPct = lmtdPrevLeads > 0 ? parseFloat(((lmtdLeads / lmtdPrevLeads) * 100).toFixed(2)) : (i === 0 ? 100 : null);
      // First stage (Workable) has no prior stage, so no Conv% delta — show "—" in funnel
      const deltaPp = i === 0 ? null : (convPct !== null && lmtdConvPct !== null ? parseFloat((convPct - lmtdConvPct).toFixed(2)) : null);
      const isDataAnomaly = convPct !== null && convPct > 100;

      result.push({
        index: cur.index,
        name: cur.stage,
        leads,
        prevLeads,
        prevStageName,
        convPct: convPct ?? null,
        lmtdLeads,
        lmtdPrevLeads,
        lmtdConvPct: lmtdConvPct ?? null,
        deltaPp,
        isDataAnomaly,
      });
    }
    return result;
  }, [funnelStages, l2Data, effectiveLender, effectiveProductType, effectiveFlow]);

  const topLeakStageIndex = useMemo((): number | null => {
    let bestImpact = 0;
    let bestIndex: number | null = null;
    funnelStagesWithConv.forEach((s) => {
      if (s.deltaPp !== null && s.deltaPp < 0 && s.prevLeads > 0) {
        const impact = Math.abs(s.deltaPp) * s.prevLeads;
        if (impact > bestImpact) {
          bestImpact = impact;
          bestIndex = s.index;
        }
      }
    });
    return bestIndex;
  }, [funnelStagesWithConv]);

  // ─── Mock L3 failure reasons (mirrored from funnel-table — will be shared later) ──
  const MOCK_FAILURE_REASONS: Record<string, { reason: string; pct: number }[]> = useMemo(() => ({
    BRE2_FAILURE: [
      { reason: "Income below threshold", pct: 32.5 },
      { reason: "Bureau score < 650", pct: 24.1 },
      { reason: "High existing EMI burden", pct: 18.7 },
      { reason: "Business vintage < 12 months", pct: 12.3 },
      { reason: "Other policy rejection", pct: 12.4 },
    ],
    KYC_FAILED: [
      { reason: "Name mismatch (PAN vs Aadhaar)", pct: 28.4 },
      { reason: "Photo mismatch / low quality", pct: 22.1 },
      { reason: "Aadhaar OTP timeout", pct: 19.6 },
    ],
    LENDER_BRE_REJECTED: [
      { reason: "Pincode not serviceable", pct: 35.2 },
      { reason: "Category excluded", pct: 22.8 },
      { reason: "Bureau model score low", pct: 20.3 },
    ],
    SERVICEABILITY_REJECTED: [
      { reason: "Pincode not serviceable by lender", pct: 52.3 },
      { reason: "Merchant category not eligible", pct: 28.7 },
    ],
    KYC_REJECTED: [
      { reason: "Video KYC failed — face mismatch", pct: 31.2 },
      { reason: "CKYC record not found", pct: 26.8 },
    ],
    EMANDATE_REQUIRED: [
      { reason: "User did not complete e-mandate", pct: 45.6 },
      { reason: "Bank not supported for e-mandate", pct: 28.3 },
    ],
    LOAN_DISBURSEMENT_FAILURE: [
      { reason: "Bank account validation failed", pct: 34.1 },
      { reason: "NEFT/IMPS transfer failed", pct: 28.7 },
    ],
    LOAN_APPLICATION_ON_HOLD: [
      { reason: "Pending FI (Field Investigation)", pct: 38.4 },
      { reason: "Pending additional document", pct: 27.6 },
    ],
    LOAN_QC_REJECTED: [
      { reason: "Document quality check failed", pct: 42.1 },
      { reason: "Income proof insufficient", pct: 28.5 },
    ],
    BANK_NAME_MATCH_FAILED: [
      { reason: "Account holder name != applicant name", pct: 55.2 },
      { reason: "Joint account detected", pct: 24.8 },
    ],
    LENDER_CREATE_APPLICATION_REJECTED: [
      { reason: "Duplicate lead at lender", pct: 38.5 },
      { reason: "KYC data mismatch with lender records", pct: 25.2 },
    ],
  }), []);

  type L2CohortRow = { segment: string; mtd: number; lmtd: number; diffPct: number | null };
  type L2CohortDimension = { dimension: string; rows: L2CohortRow[] };
  type L2ReasonRow = { reason: string; mtd: number; lmtd: number; diffPct: number | null; cohorts: L2CohortDimension[] };
  type L2DeepDiveData = { reasons: L2ReasonRow[]; cohorts: L2CohortDimension[] };

  const MOCK_L2_DEEP_DIVE: Record<string, L2DeepDiveData> = useMemo(() => {
    const d = (m: number, l: number) => l > 0 ? parseFloat((((m - l) / l) * 100).toFixed(1)) : null;
    const STD_COHORTS: L2CohortDimension[] = [
      { dimension: "Vintage", rows: [
        { segment: "0-6M", mtd: 35, lmtd: 48, diffPct: d(35, 48) },
        { segment: "6-12M", mtd: 22, lmtd: 28, diffPct: d(22, 28) },
        { segment: "12-18M", mtd: 12, lmtd: 18, diffPct: d(12, 18) },
        { segment: "18-24M", mtd: 10, lmtd: 14, diffPct: d(10, 14) },
        { segment: "24M+", mtd: 8, lmtd: 13, diffPct: d(8, 13) },
      ]},
      { dimension: "MCRS Decile", rows: [
        { segment: "1", mtd: 30, lmtd: 40, diffPct: d(30, 40) },
        { segment: "2", mtd: 20, lmtd: 28, diffPct: d(20, 28) },
        { segment: "3", mtd: 15, lmtd: 22, diffPct: d(15, 22) },
        { segment: "4", mtd: 12, lmtd: 18, diffPct: d(12, 18) },
        { segment: "4+", mtd: 10, lmtd: 13, diffPct: d(10, 13) },
      ]},
      { dimension: "NoWL", rows: [
        { segment: "0", mtd: 32, lmtd: 42, diffPct: d(32, 42) },
        { segment: "1", mtd: 22, lmtd: 30, diffPct: d(22, 30) },
        { segment: "2", mtd: 15, lmtd: 20, diffPct: d(15, 20) },
        { segment: "3", mtd: 10, lmtd: 15, diffPct: d(10, 15) },
        { segment: "3+", mtd: 8, lmtd: 14, diffPct: d(8, 14) },
      ]},
      { dimension: "Category", rows: [
        { segment: "Retail & Shopping", mtd: 28, lmtd: 38, diffPct: d(28, 38) },
        { segment: "Restaurant", mtd: 18, lmtd: 25, diffPct: d(18, 25) },
        { segment: "Automobiles", mtd: 15, lmtd: 20, diffPct: d(15, 20) },
        { segment: "Meat Shop", mtd: 14, lmtd: 22, diffPct: d(14, 22) },
        { segment: "Street Hawker", mtd: 12, lmtd: 16, diffPct: d(12, 16) },
      ]},
      { dimension: "Location", rows: [
        { segment: "Top 8", mtd: 30, lmtd: 42, diffPct: d(30, 42) },
        { segment: "9-20", mtd: 22, lmtd: 30, diffPct: d(22, 30) },
        { segment: "21-60", mtd: 20, lmtd: 28, diffPct: d(20, 28) },
        { segment: "Beyond 60", mtd: 15, lmtd: 21, diffPct: d(15, 21) },
      ]},
    ];

    const mkReasonCohorts = (scale: number): L2CohortDimension[] => STD_COHORTS.map((dim) => ({
      dimension: dim.dimension,
      rows: dim.rows.map((r) => {
        const m = Math.round(r.mtd * scale * (0.8 + Math.random() * 0.4));
        const l = Math.round(r.lmtd * scale * (0.8 + Math.random() * 0.4));
        return { segment: r.segment, mtd: m, lmtd: l, diffPct: d(m, l) };
      }),
    }));

    return {
      BRE2_FAILURE: {
        reasons: [
          { reason: "Income below threshold", mtd: 28, lmtd: 42, diffPct: d(28, 42), cohorts: mkReasonCohorts(0.32) },
          { reason: "Bureau score < 650", mtd: 22, lmtd: 30, diffPct: d(22, 30), cohorts: mkReasonCohorts(0.25) },
          { reason: "High existing EMI burden", mtd: 18, lmtd: 24, diffPct: d(18, 24), cohorts: mkReasonCohorts(0.2) },
          { reason: "Business vintage < 12 months", mtd: 11, lmtd: 15, diffPct: d(11, 15), cohorts: mkReasonCohorts(0.13) },
          { reason: "Other policy rejection", mtd: 8, lmtd: 10, diffPct: d(8, 10), cohorts: mkReasonCohorts(0.09) },
        ],
        cohorts: STD_COHORTS,
      },
      KYC_FAILED: {
        reasons: [
          { reason: "Name mismatch (PAN vs Aadhaar)", mtd: 15, lmtd: 20, diffPct: d(15, 20), cohorts: mkReasonCohorts(0.33) },
          { reason: "Photo mismatch / low quality", mtd: 12, lmtd: 16, diffPct: d(12, 16), cohorts: mkReasonCohorts(0.27) },
          { reason: "Aadhaar OTP timeout", mtd: 10, lmtd: 14, diffPct: d(10, 14), cohorts: mkReasonCohorts(0.22) },
          { reason: "Document upload failed", mtd: 8, lmtd: 9, diffPct: d(8, 9), cohorts: mkReasonCohorts(0.18) },
        ],
        cohorts: STD_COHORTS.map((dim) => ({ dimension: dim.dimension, rows: dim.rows.map((r) => ({ ...r, mtd: Math.round(r.mtd * 0.6), lmtd: Math.round(r.lmtd * 0.7), diffPct: d(Math.round(r.mtd * 0.6), Math.round(r.lmtd * 0.7)) })) })),
      },
      INITIATE_MULTIMODE_KYC: {
        reasons: [
          { reason: "User dropped off before KYC start", mtd: 45, lmtd: 38, diffPct: d(45, 38), cohorts: mkReasonCohorts(0.48) },
          { reason: "Camera permission denied", mtd: 20, lmtd: 22, diffPct: d(20, 22), cohorts: mkReasonCohorts(0.22) },
          { reason: "Session timeout", mtd: 18, lmtd: 15, diffPct: d(18, 15), cohorts: mkReasonCohorts(0.19) },
          { reason: "Technical error on KYC SDK", mtd: 10, lmtd: 12, diffPct: d(10, 12), cohorts: mkReasonCohorts(0.11) },
        ],
        cohorts: STD_COHORTS.map((dim) => ({ dimension: dim.dimension, rows: dim.rows.map((r) => ({ ...r, mtd: Math.round(r.mtd * 1.1), lmtd: Math.round(r.lmtd * 0.9), diffPct: d(Math.round(r.mtd * 1.1), Math.round(r.lmtd * 0.9)) })) })),
      },
      KYC_SELFIE_REUPLOAD_REQUIRED: {
        reasons: [
          { reason: "Selfie blurry / low resolution", mtd: 30, lmtd: 25, diffPct: d(30, 25), cohorts: mkReasonCohorts(0.5) },
          { reason: "Face not matching ID photo", mtd: 22, lmtd: 20, diffPct: d(22, 20), cohorts: mkReasonCohorts(0.37) },
          { reason: "Multiple faces detected", mtd: 8, lmtd: 6, diffPct: d(8, 6), cohorts: mkReasonCohorts(0.13) },
        ],
        cohorts: STD_COHORTS.map((dim) => ({ dimension: dim.dimension, rows: dim.rows.map((r) => ({ ...r, mtd: Math.round(r.mtd * 0.8), lmtd: Math.round(r.lmtd * 0.65), diffPct: d(Math.round(r.mtd * 0.8), Math.round(r.lmtd * 0.65)) })) })),
      },
      LENDER_BRE_REJECTED: {
        reasons: [
          { reason: "Pincode not serviceable", mtd: 20, lmtd: 28, diffPct: d(20, 28), cohorts: mkReasonCohorts(0.37) },
          { reason: "Category excluded", mtd: 14, lmtd: 18, diffPct: d(14, 18), cohorts: mkReasonCohorts(0.26) },
          { reason: "Bureau model score low", mtd: 12, lmtd: 16, diffPct: d(12, 16), cohorts: mkReasonCohorts(0.22) },
          { reason: "Income criteria not met", mtd: 8, lmtd: 10, diffPct: d(8, 10), cohorts: mkReasonCohorts(0.15) },
        ],
        cohorts: STD_COHORTS.map((dim) => ({ dimension: dim.dimension, rows: dim.rows.map((r) => ({ ...r, mtd: Math.round(r.mtd * 0.7), lmtd: Math.round(r.lmtd * 0.85), diffPct: d(Math.round(r.mtd * 0.7), Math.round(r.lmtd * 0.85)) })) })),
      },
      EMANDATE_REQUIRED: {
        reasons: [
          { reason: "User did not complete e-mandate", mtd: 25, lmtd: 30, diffPct: d(25, 30), cohorts: mkReasonCohorts(0.5) },
          { reason: "Bank not supported for e-mandate", mtd: 15, lmtd: 18, diffPct: d(15, 18), cohorts: mkReasonCohorts(0.3) },
          { reason: "Mandate registration failed", mtd: 10, lmtd: 12, diffPct: d(10, 12), cohorts: mkReasonCohorts(0.2) },
        ],
        cohorts: STD_COHORTS.map((dim) => ({ dimension: dim.dimension, rows: dim.rows.map((r) => ({ ...r, mtd: Math.round(r.mtd * 0.65), lmtd: Math.round(r.lmtd * 0.75), diffPct: d(Math.round(r.mtd * 0.65), Math.round(r.lmtd * 0.75)) })) })),
      },
    };
  }, []);

  // ─── Deep funnel insights (rich format like Insights tab) ──────────────
  const funnelInsights = useMemo((): RichInsightItem[] => {
    const insights: RichInsightItem[] = [];
    const AVG_ATS = 1.83; // Avg ticket size in Lakhs (MTD 1528 Cr / 83401 loans)
    let insightCounter = 0;
    const nextId = () => `funnel-insight-${insightCounter++}`;

    // --- VOLUME & GROWTH INSIGHTS ---
    const w2dDelta = stats.w2d - stats.lmtdW2d;
    if (Math.abs(w2dDelta) > 0.3) {
      const isGood = w2dDelta > 0;
      const impactLeads = Math.abs(stats.mtdD - (stats.mtdFirst > 0 ? Math.round(stats.mtdFirst * stats.lmtdW2d / 100) : 0));
      const impactCr = (impactLeads * AVG_ATS / 100).toFixed(1);
      insights.push({
        id: nextId(),
        icon: isGood ? TrendingUp : TrendingDown,
        color: isGood ? "text-emerald-600" : "text-red-600",
        title: `Funnel Conv% ${isGood ? "Improved" : "Dropped"} ${Math.abs(w2dDelta).toFixed(2)}pp`,
        detail: `Overall funnel conversion is ${stats.w2d.toFixed(2)}% vs ${stats.lmtdW2d.toFixed(2)}% ${cL}. Est. impact: ~₹${impactCr} Cr.`,
        severity: isGood ? "good" : "bad",
        impactWeight: isGood ? 60 : 90,
        link: "/funnel-summary",
        section: "stage-health",
        expanded: {
          bullets: [
            `${pL} Conv: ${stats.w2d.toFixed(2)}% | ${cL} Conv: ${stats.lmtdW2d.toFixed(2)}%`,
            `Delta: ${w2dDelta > 0 ? "+" : ""}${w2dDelta.toFixed(2)}pp`,
            `${pL} Disbursals: ${stats.mtdD.toLocaleString("en-IN")} | ${cL}: ${stats.lmtdD.toLocaleString("en-IN")}`,
            `Est. disbursal impact: ~₹${impactCr} Cr`,
          ],
          chartData: [],
          chartLabel: "",
          chartValueSuffix: "pp",
        },
      });
    }

    const volGrowth = stats.lmtdW > 0 ? ((stats.mtdW - stats.lmtdW) / stats.lmtdW) * 100 : 0;
    if (Math.abs(volGrowth) > 10) {
      const isGood = volGrowth > 0;
      insights.push({
        id: nextId(),
        icon: isGood ? TrendingUp : TrendingDown,
        color: isGood ? "text-emerald-600" : "text-amber-600",
        title: `Top-of-Funnel Volume ${isGood ? "Up" : "Down"} ${Math.abs(volGrowth).toFixed(1)}%`,
        detail: `${stats.mtdW.toLocaleString("en-IN")} workable leads vs ${stats.lmtdW.toLocaleString("en-IN")} ${cL}.`,
        severity: isGood ? "good" : "warn",
        impactWeight: 50,
        link: "/funnel-summary",
        section: "funnel-drilldown",
        expanded: {
          bullets: [
            `${pL}: ${stats.mtdW.toLocaleString("en-IN")} workable leads`,
            `${cL}: ${stats.lmtdW.toLocaleString("en-IN")} workable leads`,
            `Change: ${volGrowth > 0 ? "+" : ""}${volGrowth.toFixed(1)}%`,
            isGood ? "Higher inflow should improve disbursals if conversion holds." : "Lower inflow may reduce disbursals even if conv% improves.",
          ],
          chartData: [],
          chartLabel: "",
          chartValueSuffix: "",
        },
      });
    }

    const ptcDelta = stats.parentToChild - stats.lmtdParentToChild;
    if (Math.abs(ptcDelta) > 0.05) {
      insights.push({
        id: nextId(),
        icon: Activity,
        color: "text-blue-600",
        title: `Child/Parent Ratio: ${stats.parentToChild.toFixed(2)}x`,
        detail: `${ptcDelta > 0 ? "Up" : "Down"} from ${stats.lmtdParentToChild.toFixed(2)}x.${stats.parentToChild > 1 ? " Multiple child leads per parent." : ""}`,
        severity: "info",
        impactWeight: 30,
        link: "/funnel-summary",
        expanded: {
          bullets: [
            `${pL} ratio: ${stats.parentToChild.toFixed(2)}x | ${cL}: ${stats.lmtdParentToChild.toFixed(2)}x`,
            `Delta: ${ptcDelta > 0 ? "+" : ""}${ptcDelta.toFixed(2)}x`,
            stats.parentToChild > 1.2 ? "High ratio indicates many lenders per parent lead — good for offer coverage." : "Low ratio may indicate limited lender matching.",
          ],
          chartData: [],
          chartLabel: "",
          chartValueSuffix: "",
        },
      });
    }

    // --- STAGE-BY-STAGE CONV% INSIGHTS WITH SUB-STAGE ROOT CAUSE ---
    const match = (r: L2AnalysisRow) => {
      if (effectiveLender !== "All" && r.lender !== effectiveLender) return false;
      if (effectiveProductType !== "All" && r.product_type !== effectiveProductType) return false;
      if (effectiveFlow !== "All" && r.isautoleadcreated !== effectiveFlow) return false;
      return true;
    };

    const agg = (period: string) => {
      const map: Record<number, { stage: string; leads: number }> = {};
      l2Data.filter(
        (r) => r.month_start === period && !r.sub_stage &&
          Math.floor(r.major_index) === r.major_index &&
          r.major_index < 1000 && r.major_index !== 1 && match(r)
      ).forEach((r) => {
        if (!map[r.major_index]) map[r.major_index] = { stage: r.original_major_stage, leads: 0 };
        map[r.major_index].leads += r.leads;
      });
      return map;
    };

    const mtdMajor = agg("1.MTD");
    const lmtdMajor = agg("2.LMTD");
    const allIdx = Array.from(
      new Set([...Object.keys(mtdMajor).map(Number), ...Object.keys(lmtdMajor).map(Number)])
    ).sort((a, b) => a - b);

    // Lender-level breakdown helper
    const getLenderBreakdown = (prevIdx: number, curIdx: number) => {
      const lenders = new Set(l2Data.filter((r) => r.month_start === "1.MTD" && !r.sub_stage && match(r)).map((r) => r.lender));
      const breakdown: { lender: string; delta: number }[] = [];
      lenders.forEach((lndr) => {
        const lMatch = (r: L2AnalysisRow) => r.lender === lndr && (effectiveProductType === "All" || r.product_type === effectiveProductType) && (effectiveFlow === "All" || r.isautoleadcreated === effectiveFlow);
        const mPrev = l2Data.filter((r) => r.month_start === "1.MTD" && !r.sub_stage && r.major_index === prevIdx && lMatch(r)).reduce((s, r) => s + r.leads, 0);
        const mCur = l2Data.filter((r) => r.month_start === "1.MTD" && !r.sub_stage && r.major_index === curIdx && lMatch(r)).reduce((s, r) => s + r.leads, 0);
        const lPrev = l2Data.filter((r) => r.month_start === "2.LMTD" && !r.sub_stage && r.major_index === prevIdx && lMatch(r)).reduce((s, r) => s + r.leads, 0);
        const lCur = l2Data.filter((r) => r.month_start === "2.LMTD" && !r.sub_stage && r.major_index === curIdx && lMatch(r)).reduce((s, r) => s + r.leads, 0);
        const mc = mPrev > 0 ? (mCur / mPrev) * 100 : 0;
        const lc = lPrev > 0 ? (lCur / lPrev) * 100 : 0;
        const d = mc - lc;
        if (Math.abs(d) > 1) breakdown.push({ lender: lndr, delta: parseFloat(d.toFixed(1)) });
      });
      return breakdown.sort((a, b) => a.delta - b.delta);
    };

    for (let i = 1; i < allIdx.length; i++) {
      const curIdx = allIdx[i];
      const prevIdx = allIdx[i - 1];
      const mCur = mtdMajor[curIdx]?.leads || 0;
      const mPrev = mtdMajor[prevIdx]?.leads || 0;
      const lCur = lmtdMajor[curIdx]?.leads || 0;
      const lPrev = lmtdMajor[prevIdx]?.leads || 0;

      const mtdConv = mPrev > 0 ? (mCur / mPrev) * 100 : 0;
      const lmtdConv = lPrev > 0 ? (lCur / lPrev) * 100 : 0;
      const convDelta = mtdConv - lmtdConv;

      if (Math.abs(convDelta) < 1.5) continue;

      const stageName = mtdMajor[curIdx]?.stage || `Stage ${curIdx}`;
      const prevStageName = mtdMajor[prevIdx]?.stage || `Stage ${prevIdx}`;

      const getSubDeltas = () => {
        const mtdSub = l2Data.filter(
          (r) => r.month_start === "1.MTD" && r.sub_stage &&
            Math.floor(r.major_index) === prevIdx && match(r)
        );
        const lmtdSub = l2Data.filter(
          (r) => r.month_start === "2.LMTD" && r.sub_stage &&
            Math.floor(r.major_index) === prevIdx && match(r)
        );
        const mtdMap: Record<string, number> = {};
        mtdSub.forEach((r) => { if (r.sub_stage) mtdMap[r.sub_stage] = (mtdMap[r.sub_stage] || 0) + r.leads; });
        const lmtdMap: Record<string, number> = {};
        lmtdSub.forEach((r) => { if (r.sub_stage) lmtdMap[r.sub_stage] = (lmtdMap[r.sub_stage] || 0) + r.leads; });
        const mtdBase = mPrev;
        const lmtdBase = lPrev;
        const allSubs = new Set([...Object.keys(mtdMap), ...Object.keys(lmtdMap)]);
        return Array.from(allSubs).map((sub) => {
          const mL = mtdMap[sub] || 0;
          const lL = lmtdMap[sub] || 0;
          const mS = mtdBase > 0 ? (mL / mtdBase) * 100 : 0;
          const lS = lmtdBase > 0 ? (lL / lmtdBase) * 100 : 0;
          return { sub_stage: sub, mtd_leads: mL, lmtd_leads: lL, delta_pp: mS - lS };
        }).sort((a, b) => b.delta_pp - a.delta_pp);
      };

      const subDeltas = getSubDeltas();
      const leadsLost = Math.abs(mCur - Math.round(mPrev * lmtdConv / 100));
      const impactCr = (leadsLost * AVG_ATS / 100).toFixed(1);
      const lenderBd = effectiveLender === "All" ? getLenderBreakdown(prevIdx, curIdx) : [];

      if (convDelta < -1.5) {
        const topStuck = subDeltas.filter((s) => s.delta_pp > 0.5);
        const hypotheses: string[] = [];
        const bullets: string[] = [
          `${pL} Conv: ${mtdConv.toFixed(1)}% | ${cL} Conv: ${lmtdConv.toFixed(1)}% | Drop: ${Math.abs(convDelta).toFixed(2)}pp`,
          `Leads at ${prevStageName}: ${mPrev.toLocaleString("en-IN")} → Leads at ${stageName}: ${mCur.toLocaleString("en-IN")}`,
          `~${leadsLost.toLocaleString("en-IN")} additional leads lost vs ${cL} baseline. Est. impact: ~₹${impactCr} Cr`,
        ];

        topStuck.slice(0, 3).forEach((s) => {
          hypotheses.push(`Sub-stage "${s.sub_stage}" stuck rate increased +${s.delta_pp.toFixed(1)}pp (${s.mtd_leads.toLocaleString("en-IN")} leads stuck).`);
          const l3 = MOCK_FAILURE_REASONS[s.sub_stage];
          if (l3 && l3.length > 0) {
            hypotheses.push(`Top reason at ${s.sub_stage}: "${l3[0].reason}" (${l3[0].pct}%).`);
          }
          bullets.push(`${s.sub_stage}: +${s.delta_pp.toFixed(1)}pp stuck rate increase`);
        });

        if (hypotheses.length === 0) {
          hypotheses.push(`Conversion at ${prevStageName} → ${stageName} has degraded. Review sub-stage failure distributions.`);
        }

        const chartData: RichChartBar[] = subDeltas
          .filter((s) => s.delta_pp > 0.3)
          .slice(0, 6)
          .map((s) => ({
            label: s.sub_stage.replace(/_/g, " ").slice(0, 25),
            value: parseFloat(s.delta_pp.toFixed(1)),
            color: s.delta_pp > 2 ? "hsl(0, 70%, 55%)" : "hsl(30, 80%, 55%)",
          }));

        const isCritical = Math.abs(convDelta) > 3;
        insights.push({
          id: nextId(),
          icon: TrendingDown,
          color: "text-red-600",
          title: `${prevStageName} → ${stageName}: ${Math.abs(convDelta).toFixed(1)}pp Drop`,
          detail: `Conv dropped from ${lmtdConv.toFixed(1)}% to ${mtdConv.toFixed(1)}%. ~${leadsLost.toLocaleString("en-IN")} leads lost, ~₹${impactCr} Cr impact.`,
          severity: "bad",
          impactWeight: isCritical ? 95 : 75,
          priorityBucket: isCritical ? "P0" : "P1",
          link: "/funnel-summary",
          section: "stage-health",
          expanded: {
            bullets,
            chartData,
            chartLabel: "Sub-Stage Stuck Rate Increase (pp)",
            chartValueSuffix: "pp",
            l2Drills: [{
              stage: `${prevStageName} → ${stageName}`,
              hypotheses,
              lenderBreakdown: lenderBd.length > 0 ? lenderBd.slice(0, 6) : undefined,
            }],
          },
        });
      } else if (convDelta > 1.5) {
        const topCleared = subDeltas.filter((s) => s.delta_pp < -0.5).sort((a, b) => a.delta_pp - b.delta_pp);
        const hypotheses: string[] = [];
        const bullets: string[] = [
          `${pL} Conv: ${mtdConv.toFixed(1)}% | ${cL} Conv: ${lmtdConv.toFixed(1)}% | Gain: +${convDelta.toFixed(2)}pp`,
          `Leads at ${prevStageName}: ${mPrev.toLocaleString("en-IN")} → Leads at ${stageName}: ${mCur.toLocaleString("en-IN")}`,
        ];

        topCleared.slice(0, 3).forEach((s) => {
          hypotheses.push(`"${s.sub_stage}" stuck rate decreased ${s.delta_pp.toFixed(1)}pp — clearing faster.`);
          bullets.push(`${s.sub_stage}: ${s.delta_pp.toFixed(1)}pp improvement`);
        });

        if (hypotheses.length === 0) {
          hypotheses.push(`Conversion has improved at this stage. Review what changed to sustain gains.`);
        }

        const chartData: RichChartBar[] = topCleared
          .filter((s) => s.delta_pp < -0.3)
          .slice(0, 6)
          .map((s) => ({
            label: s.sub_stage.replace(/_/g, " ").slice(0, 25),
            value: parseFloat(Math.abs(s.delta_pp).toFixed(1)),
            color: "hsl(145, 60%, 45%)",
          }));

        insights.push({
          id: nextId(),
          icon: TrendingUp,
          color: "text-emerald-600",
          title: `${prevStageName} → ${stageName}: +${convDelta.toFixed(1)}pp Improvement`,
          detail: `Conv improved from ${lmtdConv.toFixed(1)}% to ${mtdConv.toFixed(1)}%.`,
          severity: "good",
          impactWeight: 40,
          priorityBucket: "positive",
          link: "/funnel-summary",
          section: "stage-health",
          expanded: {
            bullets,
            chartData,
            chartLabel: "Sub-Stage Improvement (pp)",
            chartValueSuffix: "pp",
            l2Drills: hypotheses.length > 0 ? [{
              stage: `${prevStageName} → ${stageName}`,
              hypotheses,
              lenderBreakdown: lenderBd.length > 0 ? lenderBd.filter((lb) => lb.delta > 0).slice(0, 6) : undefined,
            }] : undefined,
          },
        });
      }
    }

    // --- FFR & FLOW INSIGHTS ---
    const ffrDelta = stats.mtdFFR - stats.lmtdFFR;
    if (Math.abs(ffrDelta) > 2) {
      const isGood = ffrDelta > 0;
      insights.push({
        id: nextId(),
        icon: isGood ? TrendingUp : AlertTriangle,
        color: isGood ? "text-emerald-600" : "text-amber-600",
        title: `Flow2 FFR ${isGood ? "Improved" : "Dropped"} ${Math.abs(ffrDelta).toFixed(1)}pp`,
        detail: `Form Fill Rate: ${stats.mtdFFR.toFixed(1)}% vs ${stats.lmtdFFR.toFixed(1)}% ${cL}.${!isGood ? " Check landing page UX." : ""}`,
        severity: isGood ? "good" : "warn",
        impactWeight: 45,
        link: "/funnel-summary",
        expanded: {
          bullets: [
            `${pL} FFR: ${stats.mtdFFR.toFixed(1)}% | ${cL} FFR: ${stats.lmtdFFR.toFixed(1)}%`,
            `Change: ${ffrDelta > 0 ? "+" : ""}${ffrDelta.toFixed(1)}pp`,
            `LPV (${pL}): ${stats.mtdLPV.toLocaleString("en-IN")} | Flow2 leads: ${stats.mtdF2W.toLocaleString("en-IN")}`,
            !isGood ? "Possible causes: landing page changes, load time increase, or form complexity." : "Improved UX or faster page load contributing to higher fill rates.",
          ],
          chartData: [],
          chartLabel: "",
          chartValueSuffix: "pp",
        },
      });
    }

    return insights;
  }, [stats, l2Data, effectiveLender, effectiveProductType, effectiveFlow, MOCK_FAILURE_REASONS, cL, pL]);

  // ─── Cross-lender conv% comparison table data ──────────────────────
  const crossLenderData = useMemo(() => {
    // Get all major stages from MTD data, applying product/flow filters
    const mtdMajor = l2Data.filter(
      (r) =>
        r.month_start === "1.MTD" &&
        !r.sub_stage &&
        Math.floor(r.major_index) === r.major_index &&
        r.major_index < 1000 &&
        r.major_index !== 1 &&
        (effectiveProductType === "All" || r.product_type === effectiveProductType) &&
        (effectiveFlow === "All" || r.isautoleadcreated === effectiveFlow)
    );

    // All unique lenders
    const lenders = Array.from(new Set(mtdMajor.map((r) => r.lender))).sort();

    // All unique flows
    const flows = Array.from(new Set(mtdMajor.map((r) => r.isautoleadcreated))).sort();

    // Group by lender+flow → stage
    type StageMap = Record<number, { stage: string; leads: number }>;
    const byLenderFlow: Record<string, StageMap> = {};
    const byLender: Record<string, StageMap> = {};

    mtdMajor.forEach((r) => {
      // By lender (all flows)
      const lKey = r.lender;
      if (!byLender[lKey]) byLender[lKey] = {};
      if (!byLender[lKey][r.major_index])
        byLender[lKey][r.major_index] = { stage: r.original_major_stage, leads: 0 };
      byLender[lKey][r.major_index].leads += r.leads;

      // By lender+flow
      const lfKey = `${r.lender}||${r.isautoleadcreated}`;
      if (!byLenderFlow[lfKey]) byLenderFlow[lfKey] = {};
      if (!byLenderFlow[lfKey][r.major_index])
        byLenderFlow[lfKey][r.major_index] = { stage: r.original_major_stage, leads: 0 };
      byLenderFlow[lfKey][r.major_index].leads += r.leads;
    });

    // Compute stage indices
    const allIndices = Array.from(new Set(mtdMajor.map((r) => r.major_index))).sort(
      (a, b) => a - b
    );

    // Stage pairs: [prevIdx, curIdx, stageName]
    const stagePairs: { prevIdx: number; curIdx: number; stageName: string }[] = [];
    for (let i = 1; i < allIndices.length; i++) {
      const curIdx = allIndices[i];
      const prevIdx = allIndices[i - 1];
      const stageName =
        mtdMajor.find((r) => r.major_index === curIdx)?.original_major_stage ||
        `Stage ${curIdx}`;
      stagePairs.push({ prevIdx, curIdx, stageName });
    }

    // Compute conv% for each lender (all flows)
    const lenderConv: Record<string, Record<number, number | null>> = {};
    lenders.forEach((lender) => {
      lenderConv[lender] = {};
      stagePairs.forEach(({ prevIdx, curIdx }) => {
        const prevLeads = byLender[lender]?.[prevIdx]?.leads || 0;
        const curLeads = byLender[lender]?.[curIdx]?.leads || 0;
        lenderConv[lender][curIdx] =
          prevLeads > 0 ? parseFloat(((curLeads / prevLeads) * 100).toFixed(1)) : null;
      });
    });

    // Compute conv% for each lender+flow
    const lenderFlowConv: Record<string, Record<number, number | null>> = {};
    lenders.forEach((lender) => {
      flows.forEach((flow) => {
        const key = `${lender}||${flow}`;
        lenderFlowConv[key] = {};
        stagePairs.forEach(({ prevIdx, curIdx }) => {
          const prevLeads = byLenderFlow[key]?.[prevIdx]?.leads || 0;
          const curLeads = byLenderFlow[key]?.[curIdx]?.leads || 0;
          lenderFlowConv[key][curIdx] =
            prevLeads > 0 ? parseFloat(((curLeads / prevLeads) * 100).toFixed(1)) : null;
        });
      });
    });

    // Find hero per stage (highest conv%)
    const heroPerStage: Record<number, { lender: string; conv: number }> = {};
    stagePairs.forEach(({ curIdx }) => {
      let best = -1;
      let bestLender = "";
      lenders.forEach((lender) => {
        const conv = lenderConv[lender]?.[curIdx];
        if (conv !== null && conv !== undefined && conv > best) {
          best = conv;
          bestLender = lender;
        }
      });
      if (best >= 0) heroPerStage[curIdx] = { lender: bestLender, conv: best };
    });

    return { lenders, flows, stagePairs, lenderConv, lenderFlowConv, heroPerStage };
  }, [l2Data, effectiveProductType, effectiveFlow]);

  const [showFlowBreakdown, setShowFlowBreakdown] = useState(false);
  const [kpiDive, setKpiDive] = useState<{ open: boolean; config: KpiDeepDiveConfig | null }>({ open: false, config: null });

  // Command Funnel: data for hero and drawer
  const commandFunnelStages: CommandFunnelStage[] = useMemo(
    () =>
      funnelStagesWithConv.map((s) => {
        const volumeChangePct =
          s.lmtdLeads > 0
            ? parseFloat((((s.leads - s.lmtdLeads) / s.lmtdLeads) * 100).toFixed(2))
            : null;
        return {
          index: s.index,
          name: s.name,
          leads: s.leads,
          prevLeads: s.prevLeads,
          convPct: s.convPct,
          volumeChangePct,
          deltaPp: s.deltaPp,
          isDataAnomaly: s.isDataAnomaly,
          lmtdLeads: s.lmtdLeads,
        };
      }),
    [funnelStagesWithConv]
  );
  const overallConvPct = useMemo(() => {
    if (funnelStagesWithConv.length === 0) return stats.w2d;
    const first = funnelStagesWithConv[0];
    const last = funnelStagesWithConv[funnelStagesWithConv.length - 1];
    return first.leads > 0 ? parseFloat(((last.leads / first.leads) * 100).toFixed(2)) : stats.w2d;
  }, [funnelStagesWithConv, stats.w2d]);
  const overallConvDeltaPp = useMemo(() => {
    if (funnelStagesWithConv.length === 0) return stats.w2d - stats.lmtdW2d;
    const first = funnelStagesWithConv[0];
    const last = funnelStagesWithConv[funnelStagesWithConv.length - 1];
    const mtdConv = first.leads > 0 ? (last.leads / first.leads) * 100 : null;
    const lmtdConv = first.lmtdLeads > 0 ? (last.lmtdLeads / first.lmtdLeads) * 100 : null;
    return mtdConv !== null && lmtdConv !== null ? parseFloat((mtdConv - lmtdConv).toFixed(2)) : stats.w2d - stats.lmtdW2d;
  }, [funnelStagesWithConv, stats.w2d, stats.lmtdW2d]);

  // ─── Enhancement data for FunnelEnhancements component ──────────────────
  const enhancementStages = useMemo(() =>
    funnelStagesWithConv.map((s) => ({
      index: s.index, name: s.name, leads: s.leads,
      convPct: s.convPct, deltaPp: s.deltaPp, lmtdLeads: s.lmtdLeads,
    })),
  [funnelStagesWithConv]);

  const lenderStageConvData = useMemo(() => {
    if (isLenderFiltered) return [];
    const lenderRows = lenderFunnel.filter((r) => {
      if (effectiveProductType !== "All" && r.product_type !== effectiveProductType) return false;
      if (effectiveFlow !== "All" && r.isautoleadcreated !== effectiveFlow) return false;
      return true;
    });
    const lmtdByLenderStage: Record<string, { leads: number; prevLeads: number }> = {};
    l2Data.filter((r) => r.month_start === "2.LMTD" && !r.sub_stage && Math.floor(r.major_index) === r.major_index)
      .forEach((r) => {
        if (effectiveProductType !== "All" && r.product_type !== effectiveProductType) return;
        if (effectiveFlow !== "All" && r.isautoleadcreated !== effectiveFlow) return;
        const key = `${r.lender}|${r.major_index}`;
        if (!lmtdByLenderStage[key]) lmtdByLenderStage[key] = { leads: 0, prevLeads: 0 };
        lmtdByLenderStage[key].leads += r.leads;
      });

    const byLenderIdx: Record<string, number> = {};
    lenderRows.forEach((r) => {
      const key = `${r.lender}|${r.major_index}`;
      byLenderIdx[key] = (byLenderIdx[key] || 0) + r.leads;
    });

    const stageIndices = [...new Set(lenderRows.map((r) => r.major_index))].sort((a, b) => a - b);
    const lenderNames = [...new Set(lenderRows.map((r) => r.lender))];
    const result: { lender: string; stage: string; convPct: number; lmtdConvPct: number }[] = [];

    lenderNames.forEach((lender) => {
      stageIndices.forEach((idx, si) => {
        if (si === 0) return;
        const prevIdx = stageIndices[si - 1];
        const curr = byLenderIdx[`${lender}|${idx}`] || 0;
        const prev = byLenderIdx[`${lender}|${prevIdx}`] || 0;
        const lmtdCurr = lmtdByLenderStage[`${lender}|${idx}`]?.leads || 0;
        const lmtdPrev = lmtdByLenderStage[`${lender}|${prevIdx}`]?.leads || 0;
        const stageName = lenderRows.find((r) => r.major_index === idx)?.major_stage || `Stage ${idx}`;
        result.push({
          lender, stage: stageName,
          convPct: prev > 0 ? parseFloat(((curr / prev) * 100).toFixed(1)) : 0,
          lmtdConvPct: lmtdPrev > 0 ? parseFloat(((lmtdCurr / lmtdPrev) * 100).toFixed(1)) : 0,
        });
      });
    });
    return result;
  }, [isLenderFiltered, lenderFunnel, l2Data, effectiveProductType, effectiveFlow]);

  // ─── Ratio metrics: Disb/W, Disb/BRE1, Disb/Child — MTD vs LMTD conv % ──
  const ratioMetrics = useMemo(() => {
    const pct = (n: number, d: number) => (d > 0 ? parseFloat(((n / d) * 100).toFixed(2)) : null);
    const disbW_mtd = pct(stats.mtdD, stats.mtdW);
    const disbW_lmtd = pct(stats.lmtdD, stats.lmtdW);
    const disbBRE1_mtd = pct(stats.mtdD, stats.mtdBRE1);
    const disbBRE1_lmtd = pct(stats.lmtdD, stats.lmtdBRE1);
    const disbChild_mtd = pct(stats.mtdD, stats.mtdC);
    const disbChild_lmtd = pct(stats.lmtdD, stats.lmtdC);
    return [
      { label: "Disb. / W leads", mtd: disbW_mtd, lmtd: disbW_lmtd, deltaPp: disbW_mtd !== null && disbW_lmtd !== null ? parseFloat((disbW_mtd - disbW_lmtd).toFixed(2)) : null },
      { label: "Disb. / BRE1 Completed", mtd: disbBRE1_mtd, lmtd: disbBRE1_lmtd, deltaPp: disbBRE1_mtd !== null && disbBRE1_lmtd !== null ? parseFloat((disbBRE1_mtd - disbBRE1_lmtd).toFixed(2)) : null },
      { label: "Disb. / Child Lead", mtd: disbChild_mtd, lmtd: disbChild_lmtd, deltaPp: disbChild_mtd !== null && disbChild_lmtd !== null ? parseFloat((disbChild_mtd - disbChild_lmtd).toFixed(2)) : null },
    ];
  }, [stats]);

  const selectedStageForDrawer: StageDrawerStage | null = useMemo(() => {
    if (selectedStageIndex == null) return null;
    const s = funnelStagesWithConv.find((x) => x.index === selectedStageIndex);
    return s
      ? {
          index: s.index,
          name: s.name,
          leads: s.leads,
          prevLeads: s.prevLeads,
          prevStageName: s.prevStageName,
          convPct: s.convPct,
          lmtdLeads: s.lmtdLeads,
          lmtdPrevLeads: s.lmtdPrevLeads,
          lmtdConvPct: s.lmtdConvPct,
          deltaPp: s.deltaPp,
          isDataAnomaly: s.isDataAnomaly,
        }
      : null;
  }, [funnelStagesWithConv, selectedStageIndex]);

  const lenderProgramRowsForDrawer: LenderProgramRow[] = useMemo(() => {
    if (selectedStageIndex == null) return [];
    const match = (r: L2AnalysisRow) => {
      if (effectiveLender !== "All" && r.lender !== effectiveLender) return false;
      if (effectiveProductType !== "All" && r.product_type !== effectiveProductType) return false;
      if (effectiveFlow !== "All" && r.isautoleadcreated !== effectiveFlow) return false;
      return true;
    };
    const idx = funnelStages.findIndex((s) => s.index === selectedStageIndex);
    if (idx <= 0) return [];
    const prevIdx = funnelStages[idx - 1].index;
    const mtdRows = l2Data.filter(
      (r) => r.month_start === "1.MTD" && !r.sub_stage && match(r)
    );
    const lmtdRows = l2Data.filter(
      (r) => r.month_start === "2.LMTD" && !r.sub_stage && match(r)
    );
    const byKey: Record<
      string,
      { mtdCur: number; mtdPrev: number; lmtdCur: number; lmtdPrev: number }
    > = {};
    mtdRows.forEach((r) => {
      if (r.major_index !== selectedStageIndex && r.major_index !== prevIdx) return;
      const key = `${r.lender}|||${r.product_type}`;
      if (!byKey[key]) byKey[key] = { mtdCur: 0, mtdPrev: 0, lmtdCur: 0, lmtdPrev: 0 };
      if (r.major_index === selectedStageIndex) byKey[key].mtdCur += r.leads;
      if (r.major_index === prevIdx) byKey[key].mtdPrev += r.leads;
    });
    lmtdRows.forEach((r) => {
      if (r.major_index !== selectedStageIndex && r.major_index !== prevIdx) return;
      const key = `${r.lender}|||${r.product_type}`;
      if (!byKey[key]) byKey[key] = { mtdCur: 0, mtdPrev: 0, lmtdCur: 0, lmtdPrev: 0 };
      if (r.major_index === selectedStageIndex) byKey[key].lmtdCur += r.leads;
      if (r.major_index === prevIdx) byKey[key].lmtdPrev += r.leads;
    });
    const rows: LenderProgramRow[] = Object.entries(byKey)
      .filter(([, v]) => v.mtdPrev > 0 || v.lmtdPrev > 0)
      .map(([key, v]) => {
        const [lender, program] = key.split("|||");
        const mtdConv = v.mtdPrev > 0 ? (v.mtdCur / v.mtdPrev) * 100 : null;
        const lmtdConv = v.lmtdPrev > 0 ? (v.lmtdCur / v.lmtdPrev) * 100 : null;
        const deltaPp = mtdConv !== null && lmtdConv !== null ? mtdConv - lmtdConv : null;
        const impact = deltaPp !== null ? Math.abs(deltaPp) * v.mtdPrev : 0;
        return {
          lender,
          program,
          entryLeads: v.mtdPrev,
          mtdLeads: v.mtdCur,
          lmtdLeads: v.lmtdCur,
          mtdConv,
          deltaPp,
          impact,
        };
      })
      .sort((a, b) => b.impact - a.impact);
    return rows;
  }, [
    selectedStageIndex,
    funnelStages,
    l2Data,
    effectiveLender,
    effectiveProductType,
    effectiveFlow,
  ]);

  const flowRowsForStage: { flow: string; entryLeads: number; mtdLeads: number; lmtdLeads: number; mtdConv: number | null; lmtdConv: number | null; deltaPp: number | null; countDiffPct: number | null }[] = useMemo(() => {
    if (selectedStageIndex == null) return [];
    const idx = funnelStages.findIndex((s) => s.index === selectedStageIndex);
    if (idx <= 0) return [];
    const prevIdx = funnelStages[idx - 1].index;
    const match = (r: L2AnalysisRow) => {
      if (effectiveLender !== "All" && r.lender !== effectiveLender) return false;
      if (effectiveProductType !== "All" && r.product_type !== effectiveProductType) return false;
      return true;
    };
    const mtdRows = l2Data.filter((r) => r.month_start === "1.MTD" && !r.sub_stage && match(r));
    const lmtdRows = l2Data.filter((r) => r.month_start === "2.LMTD" && !r.sub_stage && match(r));
    const byFlow: Record<string, { mtdCur: number; mtdPrev: number; lmtdCur: number; lmtdPrev: number }> = {};
    mtdRows.forEach((r) => {
      if (r.major_index !== selectedStageIndex && r.major_index !== prevIdx) return;
      const flow = r.isautoleadcreated || "—";
      if (!byFlow[flow]) byFlow[flow] = { mtdCur: 0, mtdPrev: 0, lmtdCur: 0, lmtdPrev: 0 };
      if (r.major_index === selectedStageIndex) byFlow[flow].mtdCur += r.leads;
      if (r.major_index === prevIdx) byFlow[flow].mtdPrev += r.leads;
    });
    lmtdRows.forEach((r) => {
      if (r.major_index !== selectedStageIndex && r.major_index !== prevIdx) return;
      const flow = r.isautoleadcreated || "—";
      if (!byFlow[flow]) byFlow[flow] = { mtdCur: 0, mtdPrev: 0, lmtdCur: 0, lmtdPrev: 0 };
      if (r.major_index === selectedStageIndex) byFlow[flow].lmtdCur += r.leads;
      if (r.major_index === prevIdx) byFlow[flow].lmtdPrev += r.leads;
    });
    return Object.entries(byFlow)
      .filter(([, v]) => v.mtdPrev > 0 || v.lmtdPrev > 0)
      .map(([flow, v]) => {
        const mtdConv = v.mtdPrev > 0 ? (v.mtdCur / v.mtdPrev) * 100 : null;
        const lmtdConv = v.lmtdPrev > 0 ? (v.lmtdCur / v.lmtdPrev) * 100 : null;
        const deltaPp = mtdConv !== null && lmtdConv !== null ? parseFloat((mtdConv - lmtdConv).toFixed(2)) : null;
        const countDiffPct = v.lmtdCur > 0 ? parseFloat((((v.mtdCur - v.lmtdCur) / v.lmtdCur) * 100).toFixed(2)) : null;
        return {
          flow,
          entryLeads: v.mtdPrev,
          mtdLeads: v.mtdCur,
          lmtdLeads: v.lmtdCur,
          mtdConv,
          lmtdConv,
          deltaPp,
          countDiffPct,
        };
      })
      .sort((a, b) => b.mtdLeads - a.mtdLeads);
  }, [selectedStageIndex, funnelStages, l2Data, effectiveLender, effectiveProductType]);

  const subStagesForDrawer: SubStageRow[] = useMemo(() => {
    if (selectedStageIndex == null) return [];
    const match = (r: L2AnalysisRow) => {
      if (effectiveLender !== "All" && r.lender !== effectiveLender) return false;
      if (effectiveProductType !== "All" && r.product_type !== effectiveProductType) return false;
      if (effectiveFlow !== "All" && r.isautoleadcreated !== effectiveFlow) return false;
      return true;
    };

    // When clicking stage X, show L2 sub-stages of the PREVIOUS stage (X-1).
    // These are leads that completed stage X-1 but are stuck before reaching stage X.
    const idx = funnelStages.findIndex((s) => s.index === selectedStageIndex);
    if (idx <= 0) return [];
    const prevStageIdx = funnelStages[idx - 1].index;

    const mtdSub = l2Data.filter(
      (r) =>
        r.month_start === "1.MTD" &&
        r.sub_stage &&
        Math.floor(r.major_index) === prevStageIdx &&
        match(r)
    );
    const lmtdSub = l2Data.filter(
      (r) =>
        r.month_start === "2.LMTD" &&
        r.sub_stage &&
        Math.floor(r.major_index) === prevStageIdx &&
        match(r)
    );
    const mtdBase = l2Data
      .filter(
        (r) =>
          r.month_start === "1.MTD" &&
          !r.sub_stage &&
          r.major_index === prevStageIdx &&
          match(r)
      )
      .reduce((s, r) => s + r.leads, 0);
    const lmtdBase = l2Data
      .filter(
        (r) =>
          r.month_start === "2.LMTD" &&
          !r.sub_stage &&
          r.major_index === prevStageIdx &&
          match(r)
      )
      .reduce((s, r) => s + r.leads, 0);

    // Aggregate by sub_stage
    const mtdMap: Record<string, number> = {};
    mtdSub.forEach((r) => {
      if (r.sub_stage) mtdMap[r.sub_stage] = (mtdMap[r.sub_stage] || 0) + r.leads;
    });
    const lmtdMap: Record<string, number> = {};
    lmtdSub.forEach((r) => {
      if (r.sub_stage) lmtdMap[r.sub_stage] = (lmtdMap[r.sub_stage] || 0) + r.leads;
    });

    // Lender × flow detail per sub_stage (MTD + LMTD)
    type DetailEntry = { lender: string; flow: string; leads: number; lmtd_leads: number; countDiffPct: number | null };
    const detailMap: Record<string, DetailEntry[]> = {};
    const getOrCreate = (sub: string, lender: string, flow: string): DetailEntry => {
      if (!detailMap[sub]) detailMap[sub] = [];
      let e = detailMap[sub].find((d) => d.lender === lender && d.flow === flow);
      if (!e) { e = { lender, flow, leads: 0, lmtd_leads: 0, countDiffPct: null }; detailMap[sub].push(e); }
      return e;
    };
    mtdSub.forEach((r) => { if (r.sub_stage) getOrCreate(r.sub_stage, r.lender, r.isautoleadcreated).leads += r.leads; });
    lmtdSub.forEach((r) => { if (r.sub_stage) getOrCreate(r.sub_stage, r.lender, r.isautoleadcreated).lmtd_leads += r.leads; });
    // Count diff % per combo — same formula as countDiffPct in Business Insights
    Object.values(detailMap).forEach((arr) => {
      arr.forEach((d) => {
        d.countDiffPct = d.lmtd_leads > 0 ? parseFloat((((d.leads - d.lmtd_leads) / d.lmtd_leads) * 100).toFixed(1)) : null;
      });
      arr.sort((a, b) => b.leads - a.leads);
    });

    const totalMtdStuck = Object.values(mtdMap).reduce((s, v) => s + v, 0);
    const TERMINAL = new Set(Object.keys(MOCK_FAILURE_REASONS));
    return Array.from(new Set([...Object.keys(mtdMap), ...Object.keys(lmtdMap)]))
      .map((sub) => ({
        sub_stage: sub,
        mtd_leads: mtdMap[sub] || 0,
        lmtd_leads: lmtdMap[sub] || 0,
        stuck_pct: totalMtdStuck > 0 ? parseFloat((((mtdMap[sub] || 0) / totalMtdStuck) * 100).toFixed(1)) : null,
        delta_pp:
          mtdBase > 0 && lmtdBase > 0
            ? parseFloat(
                (
                  ((mtdMap[sub] || 0) / mtdBase) * 100 -
                  ((lmtdMap[sub] || 0) / lmtdBase) * 100
                ).toFixed(2)
              )
            : null,
        is_terminal: TERMINAL.has(sub),
        lender_flow_detail: detailMap[sub] || [],
      }))
      .sort((a, b) => b.mtd_leads - a.mtd_leads);
  }, [
    selectedStageIndex,
    funnelStages,
    l2Data,
    effectiveLender,
    effectiveProductType,
    effectiveFlow,
    MOCK_FAILURE_REASONS,
  ]);

  const prevStageNameForDrawer: string | undefined = useMemo(() => {
    if (selectedStageIndex == null) return undefined;
    const idx = funnelStages.findIndex((s) => s.index === selectedStageIndex);
    return idx > 0 ? funnelStages[idx - 1].stage : undefined;
  }, [selectedStageIndex, funnelStages]);

  const top2Insights = useMemo(() => {
    const sorted = [...funnelInsights].sort(
      (a, b) => (b.impactWeight ?? 0) - (a.impactWeight ?? 0)
    );
    return sorted.slice(0, 2);
  }, [funnelInsights]);

  const narrativeInsights = useMemo((): { id: string; text: string }[] => {
    return top2Insights.map((i) => {
      const action =
        i.severity === "bad" ? " This needs immediate risk review."
        : i.severity === "warn" ? " Monitor and escalate if it continues."
        : "";
      return { id: i.id, text: (i.detail || "").trim() + action };
    });
  }, [top2Insights]);

  const AVG_ATS = 1.83; // Average ticket size in Lakhs (MTD 1528 Cr / 83401 loans)

  // ─── SECTION A: Stage Drop-off Waterfall (from funnelStages) ────────
  const dropoffData = useMemo(() => {
    const result: { stage: string; leads: number; dropped: number; dropPct: number; retained: number; retainedPct: number; index: number }[] = [];

    for (let i = 0; i < funnelStages.length; i++) {
      const s = funnelStages[i];
      const prev = i > 0 ? funnelStages[i - 1].leads : s.leads;
      const cur = s.leads;
      const dropped = i > 0 ? prev - cur : 0;
      const dropPct = prev > 0 ? (dropped / prev) * 100 : 0;

      result.push({
        stage: s.stage.length > 16 ? s.stage.substring(0, 14) + ".." : s.stage,
        leads: cur,
        dropped,
        dropPct: parseFloat(dropPct.toFixed(1)),
        retained: cur,
        retainedPct: prev > 0 ? parseFloat(((cur / prev) * 100).toFixed(1)) : 100,
        index: s.index,
      });
    }
    return result;
  }, [funnelStages]);

  // ─── SECTION B: Structural vs Temporary Analysis ───────────────────
  const structuralAnalysis = useMemo(() => {
    const match = (r: L2AnalysisRow) => {
      if (effectiveLender !== "All" && r.lender !== effectiveLender) return false;
      if (effectiveProductType !== "All" && r.product_type !== effectiveProductType) return false;
      if (effectiveFlow !== "All" && r.isautoleadcreated !== effectiveFlow) return false;
      return true;
    };

    // L2 data for LMTD comparison
    const aggL2 = (period: string) => {
      const map: Record<number, { stage: string; leads: number }> = {};
      l2Data.filter(
        (r) => r.month_start === period && !r.sub_stage &&
          Math.floor(r.major_index) === r.major_index &&
          r.major_index < 1000 && r.major_index !== 1 && match(r)
      ).forEach((r) => {
        if (!map[r.major_index]) map[r.major_index] = { stage: r.original_major_stage, leads: 0 };
        map[r.major_index].leads += r.leads;
      });
      return map;
    };

    const mtdL2 = aggL2("1.MTD");
    const lmtd = aggL2("2.LMTD");

    // Build a lookup from funnelStages (CSV source, has Bureau Pull Success, MOS, etc.)
    const funnelMap: Record<number, { stage: string; leads: number }> = {};
    funnelStages.forEach((fs) => { funnelMap[fs.index] = { stage: fs.stage, leads: fs.leads }; });

    // Merge all known indices from both sources
    const indices = Array.from(
      new Set([
        ...Object.keys(mtdL2).map(Number),
        ...Object.keys(lmtd).map(Number),
        ...Object.keys(funnelMap).map(Number),
      ])
    ).sort((a, b) => a - b);

    const result: {
      stage: string; index: number;
      mtdConv: number | null; lmtdConv: number | null; delta: number | null;
      diagnosis: "structural" | "temporary_drop" | "temporary_gain" | "healthy";
      severity: "critical" | "warning" | "ok";
    }[] = [];

    for (let i = 1; i < indices.length; i++) {
      const cur = indices[i];
      const prev = indices[i - 1];
      // Prefer funnelStages (CSV) for MTD leads; fall back to L2
      const mCur = funnelMap[cur]?.leads ?? mtdL2[cur]?.leads ?? 0;
      const mPrev = funnelMap[prev]?.leads ?? mtdL2[prev]?.leads ?? 0;
      const lCur = lmtd[cur]?.leads || 0;
      const lPrev = lmtd[prev]?.leads || 0;

      const mtdConv = mPrev > 0 ? (mCur / mPrev) * 100 : null;
      const lmtdConv = lPrev > 0 ? (lCur / lPrev) * 100 : null;
      const delta = mtdConv !== null && lmtdConv !== null ? mtdConv - lmtdConv : null;

      let diagnosis: "structural" | "temporary_drop" | "temporary_gain" | "healthy" = "healthy";
      let severity: "critical" | "warning" | "ok" = "ok";

      const mtdVal = mtdConv || 0;
      const lmtdVal = lmtdConv || 0;
      const deltaVal = delta || 0;

      if (mtdVal < 60 && lmtdVal < 60) {
        diagnosis = "structural";
        severity = mtdVal < 40 ? "critical" : "warning";
      } else if (mtdVal < 60 && lmtdVal >= 60) {
        diagnosis = "temporary_drop";
        severity = "critical";
      } else if (deltaVal < -3) {
        diagnosis = "temporary_drop";
        severity = Math.abs(deltaVal) > 5 ? "critical" : "warning";
      } else if (deltaVal > 3) {
        diagnosis = "temporary_gain";
        severity = "ok";
      }

      result.push({
        stage: funnelMap[cur]?.stage || mtdL2[cur]?.stage || lmtd[cur]?.stage || `Stage ${cur}`,
        index: cur,
        mtdConv: mtdConv !== null ? parseFloat(mtdConv.toFixed(1)) : null,
        lmtdConv: lmtdConv !== null ? parseFloat(lmtdConv.toFixed(1)) : null,
        delta: delta !== null ? parseFloat(delta.toFixed(2)) : null,
        diagnosis,
        severity,
      });
    }
    return result;
  }, [l2Data, funnelStages, effectiveLender, effectiveProductType, effectiveFlow]);

  // ─── SECTION C: Global vs Lender/Program-specific ──────────────────
  const globalVsSpecific = useMemo(() => {
    // For each stage transition, compute per-lender conv% to see if the issue is global or localized
    const mtdMajor = l2Data.filter(
      (r) => r.month_start === "1.MTD" && !r.sub_stage &&
        Math.floor(r.major_index) === r.major_index && r.major_index < 1000 && r.major_index !== 1
    );
    const lmtdMajor = l2Data.filter(
      (r) => r.month_start === "2.LMTD" && !r.sub_stage &&
        Math.floor(r.major_index) === r.major_index && r.major_index < 1000 && r.major_index !== 1
    );

    // Group by lender → idx → leads
    const groupByLender = (rows: L2AnalysisRow[]) => {
      const map: Record<string, Record<number, number>> = {};
      rows.forEach((r) => {
        if (!map[r.lender]) map[r.lender] = {};
        map[r.lender][r.major_index] = (map[r.lender][r.major_index] || 0) + r.leads;
      });
      return map;
    };

    // Group by product → idx → leads
    const groupByProduct = (rows: L2AnalysisRow[]) => {
      const map: Record<string, Record<number, number>> = {};
      rows.forEach((r) => {
        if (!map[r.product_type]) map[r.product_type] = {};
        map[r.product_type][r.major_index] = (map[r.product_type][r.major_index] || 0) + r.leads;
      });
      return map;
    };

    const mtdByLender = groupByLender(mtdMajor);
    const lmtdByLender = groupByLender(lmtdMajor);
    const mtdByProduct = groupByProduct(mtdMajor);
    const lmtdByProduct = groupByProduct(lmtdMajor);

    // Include funnelStages indices so Bureau Pull Success, MOS, etc. appear
    const funnelIndices = funnelStages.map((fs) => fs.index);
    const allIndices = Array.from(new Set([...mtdMajor.map((r) => r.major_index), ...funnelIndices])).sort((a, b) => a - b);
    const allLenderNames = Array.from(new Set(mtdMajor.map((r) => r.lender))).sort();
    const allProductNames = Array.from(new Set(mtdMajor.map((r) => r.product_type))).sort();

    const result: {
      stage: string; index: number;
      lenderDeltas: { name: string; mtdConv: number | null; delta: number | null }[];
      productDeltas: { name: string; mtdConv: number | null; delta: number | null }[];
      isGlobal: boolean;
      droppedCount: number;
      totalCount: number;
      worstLender: string | null;
      worstProduct: string | null;
    }[] = [];

    for (let i = 1; i < allIndices.length; i++) {
      const cur = allIndices[i];
      const prev = allIndices[i - 1];
      const stageName = funnelStages.find((fs) => fs.index === cur)?.stage || mtdMajor.find((r) => r.major_index === cur)?.original_major_stage || `Stage ${cur}`;

      // Per-lender delta
      const lenderDeltas = allLenderNames.map((lender) => {
        const mCur = mtdByLender[lender]?.[cur] || 0;
        const mPrev = mtdByLender[lender]?.[prev] || 0;
        const lCur = lmtdByLender[lender]?.[cur] || 0;
        const lPrev = lmtdByLender[lender]?.[prev] || 0;
        const mtdConv = mPrev > 0 ? (mCur / mPrev) * 100 : null;
        const lmtdConv = lPrev > 0 ? (lCur / lPrev) * 100 : null;
        const delta = mtdConv !== null && lmtdConv !== null ? mtdConv - lmtdConv : null;
        return { name: lender, mtdConv: mtdConv !== null ? parseFloat(mtdConv.toFixed(1)) : null, delta: delta !== null ? parseFloat(delta.toFixed(1)) : null };
      });

      // Per-product delta
      const productDeltas = allProductNames.map((product) => {
        const mCur = mtdByProduct[product]?.[cur] || 0;
        const mPrev = mtdByProduct[product]?.[prev] || 0;
        const lCur = lmtdByProduct[product]?.[cur] || 0;
        const lPrev = lmtdByProduct[product]?.[prev] || 0;
        const mtdConv = mPrev > 0 ? (mCur / mPrev) * 100 : null;
        const lmtdConv = lPrev > 0 ? (lCur / lPrev) * 100 : null;
        const delta = mtdConv !== null && lmtdConv !== null ? mtdConv - lmtdConv : null;
        return { name: product, mtdConv: mtdConv !== null ? parseFloat(mtdConv.toFixed(1)) : null, delta: delta !== null ? parseFloat(delta.toFixed(1)) : null };
      });

      // If >60% of lenders are dropping, it's global
      const droppedCount = lenderDeltas.filter((l) => l.delta !== null && l.delta < -1.5).length;
      const withData = lenderDeltas.filter((l) => l.delta !== null).length;
      const isGlobal = withData > 0 && (droppedCount / withData) > 0.6;

      const worstLender = lenderDeltas.filter((l) => l.delta !== null).sort((a, b) => (a.delta || 0) - (b.delta || 0))[0];
      const worstProduct = productDeltas.filter((p) => p.delta !== null).sort((a, b) => (a.delta || 0) - (b.delta || 0))[0];

      result.push({
        stage: stageName,
        index: cur,
        lenderDeltas,
        productDeltas,
        isGlobal,
        droppedCount,
        totalCount: withData,
        worstLender: worstLender?.delta !== null && (worstLender?.delta || 0) < -1.5 ? worstLender.name : null,
        worstProduct: worstProduct?.delta !== null && (worstProduct?.delta || 0) < -1.5 ? worstProduct.name : null,
      });
    }
    return result;
  }, [l2Data, funnelStages]);

  const structuralRowForDrawer: StructuralRow | undefined = useMemo(() => {
    if (selectedStageIndex == null) return undefined;
    const sa = structuralAnalysis.find((s) => s.index === selectedStageIndex);
    return sa ? { stage: sa.stage, index: sa.index, mtdConv: sa.mtdConv, lmtdConv: sa.lmtdConv, delta: sa.delta, diagnosis: sa.diagnosis } : undefined;
  }, [selectedStageIndex, structuralAnalysis]);

  const globalVsSpecificRowForDrawer: GlobalVsSpecificRow | undefined = useMemo(() => {
    if (selectedStageIndex == null) return undefined;
    const g = globalVsSpecific.find((gv) => gv.index === selectedStageIndex);
    return g ? { stage: g.stage, index: g.index, isGlobal: g.isGlobal, droppedCount: g.droppedCount, totalCount: g.totalCount, worstLender: g.worstLender, worstProduct: g.worstProduct } : undefined;
  }, [selectedStageIndex, globalVsSpecific]);

  // ─── Top 4-5 key insights across entire funnel (PM-focused) ────────
  type FunnelInsightItem = { text: string; severity: "critical" | "warning" | "good"; stageIndex: number; stage: string; lender?: string; deltaPp: number };
  const topFunnelInsightsStrip: FunnelInsightItem[] = useMemo(() => {
    const items: FunnelInsightItem[] = [];

    funnelStagesWithConv.forEach((s, i) => {
      if (i === 0) return;
      const gvs = globalVsSpecific.find((g) => g.index === s.index);

      if (s.deltaPp !== null && s.deltaPp <= -3) {
        const driver = gvs?.isGlobal
          ? "global drop across lenders"
          : gvs?.worstLender
            ? `driven by ${gvs.worstLender}`
            : "";
        items.push({
          text: `${s.name}: conv ${s.convPct !== null ? s.convPct.toFixed(1) : "—"}% (${s.deltaPp >= 0 ? "+" : ""}${s.deltaPp.toFixed(1)}pp vs LMTD)${driver ? ` — ${driver}` : ""}`,
          severity: "critical",
          stageIndex: s.index,
          stage: s.name,
          lender: gvs?.worstLender ?? undefined,
          deltaPp: s.deltaPp,
        });
      } else if (s.convPct !== null && s.convPct < 50 && s.lmtdConvPct !== null && s.lmtdConvPct < 50) {
        items.push({
          text: `${s.name}: structural low conv at ${s.convPct.toFixed(1)}% (LMTD also ${s.lmtdConvPct.toFixed(1)}%)`,
          severity: "warning",
          stageIndex: s.index,
          stage: s.name,
          deltaPp: s.deltaPp ?? 0,
        });
      }
    });

    globalVsSpecific.forEach((gvs) => {
      if (!gvs.isGlobal && gvs.worstLender) {
        const lenderDelta = gvs.lenderDeltas?.find((l: { name: string; delta: number | null }) => l.name === gvs.worstLender);
        if (lenderDelta && lenderDelta.delta !== null && lenderDelta.delta <= -5) {
          const exists = items.some((it) => it.stageIndex === gvs.index && it.lender === gvs.worstLender);
          if (!exists) {
            items.push({
              text: `${gvs.stage}: ${gvs.worstLender} conv dropped ${Math.abs(lenderDelta.delta).toFixed(1)}pp (MTD ${lenderDelta.mtdConv?.toFixed(1)}%)`,
              severity: "critical",
              stageIndex: gvs.index,
              stage: gvs.stage,
              lender: gvs.worstLender,
              deltaPp: lenderDelta.delta,
            });
          }
        }
      }
    });

    items.sort((a, b) => a.deltaPp - b.deltaPp);
    return items.slice(0, 5);
  }, [funnelStagesWithConv, globalVsSpecific]);

  const lenderRowsForStage: { lender: string; mtdLeads: number; lmtdLeads: number; mtdConv: number | null; lmtdConv: number | null; countDiffPct: number | null; deltaPp: number | null }[] = useMemo(() => {
    if (selectedStageIndex == null) return [];
    const match = (r: L2AnalysisRow) => {
      if (effectiveLender !== "All" && r.lender !== effectiveLender) return false;
      if (effectiveProductType !== "All" && r.product_type !== effectiveProductType) return false;
      if (effectiveFlow !== "All" && r.isautoleadcreated !== effectiveFlow) return false;
      return true;
    };
    const idx = funnelStages.findIndex((s) => s.index === selectedStageIndex);
    if (idx <= 0) return [];
    const prevIdx = funnelStages[idx - 1].index;
    const byLender: Record<string, { mtdPrev: number; mtdCur: number; lmtdPrev: number; lmtdCur: number }> = {};
    ["1.MTD", "2.LMTD"].forEach((period) => {
      const rows = l2Data.filter((r) => r.month_start === period && !r.sub_stage && match(r));
      rows.forEach((r) => {
        if (r.major_index !== selectedStageIndex && r.major_index !== prevIdx) return;
        if (!byLender[r.lender]) byLender[r.lender] = { mtdPrev: 0, mtdCur: 0, lmtdPrev: 0, lmtdCur: 0 };
        if (r.month_start === "1.MTD") {
          if (r.major_index === prevIdx) byLender[r.lender].mtdPrev += r.leads;
          if (r.major_index === selectedStageIndex) byLender[r.lender].mtdCur += r.leads;
        } else {
          if (r.major_index === prevIdx) byLender[r.lender].lmtdPrev += r.leads;
          if (r.major_index === selectedStageIndex) byLender[r.lender].lmtdCur += r.leads;
        }
      });
    });
    return Object.entries(byLender)
      .filter(([, v]) => v.mtdPrev > 0 || v.lmtdPrev > 0)
      .map(([lender, v]) => {
        const mtdConv = v.mtdPrev > 0 ? parseFloat(((v.mtdCur / v.mtdPrev) * 100).toFixed(2)) : null;
        const lmtdConv = v.lmtdPrev > 0 ? parseFloat(((v.lmtdCur / v.lmtdPrev) * 100).toFixed(2)) : null;
        const deltaPp = mtdConv !== null && lmtdConv !== null ? parseFloat((mtdConv - lmtdConv).toFixed(2)) : null;
        const countDiffPct = v.lmtdCur > 0 ? parseFloat((((v.mtdCur - v.lmtdCur) / v.lmtdCur) * 100).toFixed(2)) : null;
        return { lender, mtdLeads: v.mtdCur, lmtdLeads: v.lmtdCur, mtdConv, lmtdConv, countDiffPct, deltaPp };
      })
      .sort((a, b) => (a.deltaPp ?? 0) - (b.deltaPp ?? 0));
  }, [selectedStageIndex, funnelStages, l2Data, effectiveLender, effectiveProductType, effectiveFlow]);

  type LenderFlowL2Row = { lender: string; flow: string; l2Stage: string; mtdLeads: number; lmtdLeads: number; countDiffPct: number | null; mtdPrevStage?: number; lmtdPrevStage?: number };
  const lenderFlowL2RowsForStage: LenderFlowL2Row[] = useMemo(() => {
    if (selectedStageIndex == null) return [];
    const match = (r: L2AnalysisRow) => {
      if (effectiveLender !== "All" && r.lender !== effectiveLender) return false;
      if (effectiveProductType !== "All" && r.product_type !== effectiveProductType) return false;
      if (effectiveFlow !== "All" && r.isautoleadcreated !== effectiveFlow) return false;
      return true;
    };
    const idx = funnelStages.findIndex((s) => s.index === selectedStageIndex);
    if (idx <= 0) return [];
    const prevIdx = funnelStages[idx - 1].index;
    const rows: LenderFlowL2Row[] = [];

    const byLenderFlow: Record<string, { mtdPrev: number; mtdCur: number; lmtdPrev: number; lmtdCur: number }> = {};
    l2Data.filter((r) => !r.sub_stage && match(r)).forEach((r) => {
      if (r.major_index !== selectedStageIndex && r.major_index !== prevIdx) return;
      const key = `${r.lender}||${r.isautoleadcreated || "—"}`;
      if (!byLenderFlow[key]) byLenderFlow[key] = { mtdPrev: 0, mtdCur: 0, lmtdPrev: 0, lmtdCur: 0 };
      if (r.month_start === "1.MTD") {
        if (r.major_index === prevIdx) byLenderFlow[key].mtdPrev += r.leads;
        if (r.major_index === selectedStageIndex) byLenderFlow[key].mtdCur += r.leads;
      } else {
        if (r.major_index === prevIdx) byLenderFlow[key].lmtdPrev += r.leads;
        if (r.major_index === selectedStageIndex) byLenderFlow[key].lmtdCur += r.leads;
      }
    });
    Object.entries(byLenderFlow).forEach(([key, v]) => {
      if (v.mtdPrev === 0 && v.lmtdPrev === 0) return;
      const [lender, flow] = key.split("||");
      const countDiffPct = v.lmtdCur > 0 ? parseFloat((((v.mtdCur - v.lmtdCur) / v.lmtdCur) * 100).toFixed(1)) : null;
      rows.push({ lender, flow, l2Stage: "Overall", mtdLeads: v.mtdCur, lmtdLeads: v.lmtdCur, countDiffPct, mtdPrevStage: v.mtdPrev, lmtdPrevStage: v.lmtdPrev });
    });

    const byLenderFlowL2: Record<string, { mtd: number; lmtd: number }> = {};
    l2Data.filter((r) => r.sub_stage && Math.floor(r.major_index) === prevIdx && match(r)).forEach((r) => {
      const key = `${r.lender}||${r.isautoleadcreated || "—"}||${r.sub_stage!}`;
      if (!byLenderFlowL2[key]) byLenderFlowL2[key] = { mtd: 0, lmtd: 0 };
      if (r.month_start === "1.MTD") byLenderFlowL2[key].mtd += r.leads;
      else byLenderFlowL2[key].lmtd += r.leads;
    });
    Object.entries(byLenderFlowL2).forEach(([key, v]) => {
      const [lender, flow, l2Stage] = key.split("||");
      const countDiffPct = v.lmtd > 0 ? parseFloat((((v.mtd - v.lmtd) / v.lmtd) * 100).toFixed(1)) : null;
      rows.push({ lender, flow, l2Stage, mtdLeads: v.mtd, lmtdLeads: v.lmtd, countDiffPct });
    });
    return rows;
  }, [selectedStageIndex, funnelStages, l2Data, effectiveLender, effectiveProductType, effectiveFlow]);

  /** L2 stages by lender (e.g. BRE2_REQUESTED in SMFG) — aggregated from lenderFlowL2 where l2Stage !== "Overall" */
  type LenderL2Row = { lender: string; l2Stage: string; mtdLeads: number; lmtdLeads: number; countDiffPct: number | null };
  const lenderL2RowsForStage: LenderL2Row[] = useMemo(() => {
    const filtered = lenderFlowL2RowsForStage.filter((r) => r.l2Stage !== "Overall");
    const byKey: Record<string, { mtdLeads: number; lmtdLeads: number }> = {};
    filtered.forEach((r) => {
      const key = `${r.lender}|||${r.l2Stage}`;
      if (!byKey[key]) byKey[key] = { mtdLeads: 0, lmtdLeads: 0 };
      byKey[key].mtdLeads += r.mtdLeads;
      byKey[key].lmtdLeads += r.lmtdLeads;
    });
    return Object.entries(byKey)
      .map(([key, v]) => {
        const [lender, l2Stage] = key.split("|||");
        const countDiffPct = v.lmtdLeads > 0 ? parseFloat((((v.mtdLeads - v.lmtdLeads) / v.lmtdLeads) * 100).toFixed(1)) : null;
        return { lender, l2Stage, mtdLeads: v.mtdLeads, lmtdLeads: v.lmtdLeads, countDiffPct };
      })
      .sort((a, b) => (a.countDiffPct ?? 0) - (b.countDiffPct ?? 0));
  }, [lenderFlowL2RowsForStage]);

  /** Flow × lender rows for business insights: MTD/LMTD count, count diff %, conv diff pp */
  const flowLenderInsightRows: FlowLenderInsightRow[] = useMemo(() => {
    if (selectedStageIndex == null) return [];
    const match = (r: L2AnalysisRow) => {
      if (effectiveLender !== "All" && r.lender !== effectiveLender) return false;
      if (effectiveProductType !== "All" && r.product_type !== effectiveProductType) return false;
      if (effectiveFlow !== "All" && r.isautoleadcreated !== effectiveFlow) return false;
      return true;
    };
    const idx = funnelStages.findIndex((s) => s.index === selectedStageIndex);
    if (idx <= 0) return [];
    const prevIdx = funnelStages[idx - 1].index;
    const byLenderFlow: Record<string, { mtdPrev: number; mtdCur: number; lmtdPrev: number; lmtdCur: number }> = {};
    l2Data.filter((r) => !r.sub_stage && match(r)).forEach((r) => {
      if (r.major_index !== selectedStageIndex && r.major_index !== prevIdx) return;
      const key = `${r.lender}||${r.isautoleadcreated || "—"}`;
      if (!byLenderFlow[key]) byLenderFlow[key] = { mtdPrev: 0, mtdCur: 0, lmtdPrev: 0, lmtdCur: 0 };
      if (r.month_start === "1.MTD") {
        if (r.major_index === prevIdx) byLenderFlow[key].mtdPrev += r.leads;
        if (r.major_index === selectedStageIndex) byLenderFlow[key].mtdCur += r.leads;
      } else {
        if (r.major_index === prevIdx) byLenderFlow[key].lmtdPrev += r.leads;
        if (r.major_index === selectedStageIndex) byLenderFlow[key].lmtdCur += r.leads;
      }
    });
    return Object.entries(byLenderFlow)
      .filter(([, v]) => v.mtdPrev > 0 || v.lmtdPrev > 0)
      .map(([key, v]) => {
        const [lender, flow] = key.split("||");
        const mtdConv = v.mtdPrev > 0 ? parseFloat(((v.mtdCur / v.mtdPrev) * 100).toFixed(2)) : null;
        const lmtdConv = v.lmtdPrev > 0 ? parseFloat(((v.lmtdCur / v.lmtdPrev) * 100).toFixed(2)) : null;
        const deltaPp = mtdConv !== null && lmtdConv !== null ? parseFloat((mtdConv - lmtdConv).toFixed(2)) : null;
        const countDiffPct = v.lmtdCur > 0 ? parseFloat((((v.mtdCur - v.lmtdCur) / v.lmtdCur) * 100).toFixed(2)) : null;
        return {
          lender,
          flow,
          mtdLeads: v.mtdCur,
          lmtdLeads: v.lmtdCur,
          mtdConv,
          lmtdConv,
          countDiffPct,
          deltaPp,
        };
      });
  }, [selectedStageIndex, funnelStages, l2Data, effectiveLender, effectiveProductType, effectiveFlow]);

  // ─── SECTION D: Leakage Impact on Disbursals ──────────────────────
  const leakageImpact = useMemo(() => {
    if (dropoffData.length < 2) return { stages: [], totalLostLeads: 0, totalLostLoans: 0, totalLostAmountCr: 0 };

    // End-to-end conversion from each stage to disbursed
    const disbursedLeads = dropoffData[dropoffData.length - 1]?.leads || 0;
    const workableLeads = dropoffData[0]?.leads || 0;
    const overallConv = workableLeads > 0 ? disbursedLeads / workableLeads : 0;

    let totalLostLeads = 0;
    let totalLostLoans = 0;
    let totalLostAmountCr = 0;

    const stages = dropoffData.slice(1).map((stage, i) => {
      const prevLeads = dropoffData[i].leads;
      const dropped = prevLeads - stage.leads;
      // Downstream conversion: from this stage to disbursed
      const stagesRemaining = dropoffData.length - 1 - (i + 1);
      // Use remaining funnel conversion as proxy
      const downstreamConv = stage.leads > 0 ? disbursedLeads / stage.leads : 0;
      const estimatedLostLoans = Math.round(dropped * downstreamConv);
      const estimatedLostAmountCr = (estimatedLostLoans * AVG_ATS) / 100;

      totalLostLeads += dropped;
      totalLostLoans += estimatedLostLoans;
      totalLostAmountCr += estimatedLostAmountCr;

      return {
        stage: stage.stage,
        index: stage.index,
        prevStage: dropoffData[i].stage,
        leadsEntering: prevLeads,
        leadsExiting: stage.leads,
        dropped,
        dropPct: stage.dropPct,
        downstreamConv: parseFloat((downstreamConv * 100).toFixed(2)),
        estimatedLostLoans,
        estimatedLostAmountCr: parseFloat(estimatedLostAmountCr.toFixed(2)),
        stagesRemaining,
      };
    });

    return { stages, totalLostLeads, totalLostLoans, totalLostAmountCr: parseFloat(totalLostAmountCr.toFixed(2)) };
  }, [dropoffData, AVG_ATS]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══ LENDER-SPECIFIC DATA (shown when lender filter is applied) ═════════
  // ═══════════════════════════════════════════════════════════════════════════
  const LMTD_FACTOR = 0.85;
  const LENDER_AOP: Record<string, number> = {
    FULLERTON: 120, KSF: 80, PIRAMAL: 60, SHRIRAM: 55,
    NACL: 45, PYFL: 40, MFL: 35, UCL: 30,
  };

  const lenderDisb = useMemo(() =>
    disbData.filter((r) => r.lender === effectiveLender),
    [disbData, effectiveLender]
  );

  const lenderKPIs = useMemo(() => {
    if (!isLenderFiltered) return null;
    const totalDisb = lenderDisb.reduce((s, r) => s + r.disbursed, 0);
    const totalChild = lenderDisb.reduce((s, r) => s + r.child_leads, 0);
    const amountCr = (totalDisb * AVG_ATS) / 100;
    const lmtdDisb = Math.round(totalDisb * LMTD_FACTOR);
    const lmtdAmountCr = amountCr * LMTD_FACTOR;
    const growth = lmtdDisb > 0 ? ((totalDisb - lmtdDisb) / lmtdDisb) * 100 : 0;
    const amtGrowth = lmtdAmountCr > 0 ? ((amountCr - lmtdAmountCr) / lmtdAmountCr) * 100 : 0;
    const convPct = totalChild > 0 ? (totalDisb / totalChild) * 100 : 0;
    const aop = LENDER_AOP[effectiveLender] || 0;
    const achvPct = aop > 0 ? (amountCr / aop) * 100 : 0;
    return { totalDisb, totalChild, amountCr, lmtdAmountCr, growth, amtGrowth, convPct, aop, achvPct };
  }, [isLenderFiltered, lenderDisb, effectiveLender, AVG_ATS, LMTD_FACTOR, LENDER_AOP]);

  const byProduct = useMemo(() => {
    if (!isLenderFiltered) return [];
    const map: Record<string, { disb: number; child: number; lmtd: number }> = {};
    lenderDisb.forEach((r) => {
      if (!map[r.product_type]) map[r.product_type] = { disb: 0, child: 0, lmtd: 0 };
      map[r.product_type].disb += r.disbursed;
      map[r.product_type].child += r.child_leads;
      map[r.product_type].lmtd += Math.round(r.disbursed * LMTD_FACTOR);
    });
    return Object.entries(map).map(([pt, v]) => ({
      product_type: pt,
      disbursed: v.disb,
      child: v.child,
      lmtd: v.lmtd,
      amount_cr: parseFloat(((v.disb * AVG_ATS) / 100).toFixed(1)),
      conv: v.child > 0 ? parseFloat(((v.disb / v.child) * 100).toFixed(1)) : 0,
      growth: v.lmtd > 0 ? parseFloat((((v.disb - v.lmtd) / v.lmtd) * 100).toFixed(1)) : 0,
    })).sort((a, b) => b.disbursed - a.disbursed);
  }, [isLenderFiltered, lenderDisb, LMTD_FACTOR, AVG_ATS]);

  // Lender breakdown for deep dive charts (when not lender-filtered)
  const lenderBreakdown = useMemo(() => {
    const match = (r: L2AnalysisRow) => {
      if (effectiveProductType !== "All" && r.product_type !== effectiveProductType) return false;
      if (effectiveFlow !== "All" && r.isautoleadcreated !== effectiveFlow) return false;
      return true;
    };
    const mtdRows = l2Data.filter((r) => r.month_start === "1.MTD" && !r.sub_stage && Math.floor(r.major_index) === r.major_index && r.major_index < 1000 && r.major_index !== 1 && match(r));
    const workableByLender: Record<string, number> = {};
    const childByLender: Record<string, number> = {};
    mtdRows.forEach((r) => {
      if (r.major_index === 2) workableByLender[r.lender] = (workableByLender[r.lender] || 0) + r.leads;
      if (r.major_index === 6) childByLender[r.lender] = (childByLender[r.lender] || 0) + r.leads;
    });
    const disbByLender: Record<string, number> = {};
    disbData.forEach((r) => {
      if (effectiveProductType !== "All" && r.product_type !== effectiveProductType) return;
      if (effectiveFlow !== "All" && r.isautoleadcreated !== effectiveFlow) return;
      disbByLender[r.lender] = (disbByLender[r.lender] || 0) + r.disbursed;
    });
    return { workableByLender, childByLender, disbByLender };
  }, [l2Data, disbData, effectiveProductType, effectiveFlow]);

  // Pre-built KPI deep dive configs (avoids > in JSX attributes)
  const kpiConfigs = useMemo(() => {
    const wb = Object.keys(lenderBreakdown.workableByLender).length;
    const cb = Object.keys(lenderBreakdown.childByLender).length;
    const db = Object.keys(lenderBreakdown.disbByLender).length;
    const workableChart = wb > 0 ? { type: "chart" as const, title: "Lender-wise Workable Leads", chart: { type: "bar" as const, data: Object.entries(lenderBreakdown.workableByLender).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8), label: "Leads", valueSuffix: "" } } : null;
    const childChart = cb > 0 ? { type: "chart" as const, title: "Lender-wise Child Leads", chart: { type: "bar" as const, data: Object.entries(lenderBreakdown.childByLender).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8), label: "Leads", valueSuffix: "" } } : null;
    const disbChart = db > 0 ? { type: "chart" as const, title: "Lender-wise Disbursals", chart: { type: "bar" as const, data: Object.entries(lenderBreakdown.disbByLender).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8), label: "Disbursed", valueSuffix: "" } } : null;
    const productBar = byProduct.length > 0 ? { type: "chart" as const, title: "Product-wise Disbursals", chart: { type: "bar" as const, data: byProduct.map((p) => ({ name: p.product_type, value: p.disbursed })), label: "Loans", valueSuffix: "" } } : null;
    const convChart = byProduct.length > 0 ? { type: "chart" as const, title: "Conv% by Product", chart: { type: "bar" as const, data: byProduct.map((p) => ({ name: p.product_type, value: p.conv })), label: "Conv%", valueSuffix: "%" } } : null;
    const tot = lenderKPIs?.totalDisb ?? 0;
    const shareChart = byProduct.length && tot ? { type: "chart" as const, title: "Share by Product", chart: { type: "pie" as const, data: byProduct.map((p) => ({ name: p.product_type, value: parseFloat(((p.disbursed / tot) * 100).toFixed(1)) })), label: "Share", valueSuffix: "%" } } : null;
    return { workableChart, childChart, disbChart, productBar, convChart, shareChart };
  }, [lenderBreakdown, byProduct, lenderKPIs]);

  // Lender KPI deep dive configs (built outside JSX to avoid > parsing issues)
  const lenderKpiConfigs = useMemo((): Record<string, KpiDeepDiveConfig> => {
    if (!lenderKPIs) return {};
    const aop = lenderKPIs!.aop;
    const achv = lenderKPIs!.achvPct;
    const hasAop = aop !== 0;
    const progressColor = achv >= 80 ? "text-emerald-600" : achv >= 50 ? "text-amber-600" : "text-red-600";
    const productBullets = byProduct.length
      ? [`${effectiveLender} has ${byProduct.length} product type(s).`, ...byProduct.slice(0, 5).map((p) => {
          const share = lenderKPIs!.totalDisb ? ((p.disbursed / lenderKPIs!.totalDisb) * 100).toFixed(1) : "0";
          return `${p.product_type}: ${p.disbursed.toLocaleString("en-IN")} loans (${share}% share)`;
        })]
      : ["No product data for this lender."];
    const productTypesSections: DeepDiveSection[] = [
      { type: "kpi-row", title: "Products", kpis: [{ label: "Count", value: byProduct.length }, { label: "Total Disb", value: lenderKPIs!.totalDisb.toLocaleString("en-IN") }, { label: "Top", value: byProduct[0]?.product_type || "-" }] },
      { type: "bullets", title: "Analysis", bullets: productBullets },
      ...(kpiConfigs.shareChart ? [kpiConfigs.shareChart] : []),
    ];
    return {
      loansDisb: { title: "Loans Disbursed", metric: lenderKPIs!.totalDisb.toLocaleString("en-IN"), subtitle: `${effectiveLender} — from ${lenderKPIs!.totalChild.toLocaleString("en-IN")} child leads`, sections: [{ type: "kpi-row", title: "Period Comparison", kpis: [{ label: pL, value: lenderKPIs!.totalDisb.toLocaleString("en-IN") }, { label: cL, value: Math.round(lenderKPIs!.totalDisb * LMTD_FACTOR).toLocaleString("en-IN"), sub: "est." }, { label: "Growth", value: `${lenderKPIs!.growth >= 0 ? "+" : ""}${lenderKPIs!.growth.toFixed(1)}%`, color: lenderKPIs!.growth >= 0 ? "text-emerald-600" : "text-red-600" }] }, { type: "bullets", title: "Analysis", bullets: [`${effectiveLender} disbursed ${lenderKPIs!.totalDisb.toLocaleString("en-IN")} loans.`, `Amount: ₹${lenderKPIs!.amountCr.toFixed(1)} Cr at ~₹${AVG_ATS}L ATS.`, "Compare with other lenders in All Lenders view."] }, ...(kpiConfigs.productBar ? [kpiConfigs.productBar] : [])] },
      amount: { title: `Amount (${pL})`, metric: `${lenderKPIs!.amountCr.toFixed(1)} Cr`, subtitle: `${effectiveLender} disbursal value`, sections: [{ type: "kpi-row", title: "Period Comparison", kpis: [{ label: pL, value: `${lenderKPIs!.amountCr.toFixed(1)} Cr` }, { label: cL, value: `${lenderKPIs!.lmtdAmountCr.toFixed(1)} Cr`, sub: "est." }, { label: "Growth", value: `${lenderKPIs!.amtGrowth >= 0 ? "+" : ""}${lenderKPIs!.amtGrowth.toFixed(1)}%`, color: lenderKPIs!.amtGrowth >= 0 ? "text-emerald-600" : "text-red-600" }] }, { type: "bullets", title: "Analysis", bullets: [`Amount = Disbursed × ATS (~₹${AVG_ATS}L).`, hasAop ? `AOP Target: ₹${aop} Cr. Achievement: ${achv.toFixed(1)}%.` : "No AOP set for this lender.", "Track monthly trends for pacing."] }] },
      convPct: { title: "Disbursal Conv%", metric: `${lenderKPIs!.convPct.toFixed(1)}%`, subtitle: "Child Lead → Disbursal", sections: [{ type: "kpi-row", title: "Conversion", kpis: [{ label: "Conv%", value: `${lenderKPIs!.convPct.toFixed(1)}%` }, { label: "Child Leads", value: lenderKPIs!.totalChild.toLocaleString("en-IN") }, { label: "Disbursed", value: lenderKPIs!.totalDisb.toLocaleString("en-IN") }] }, { type: "bullets", title: "Analysis", bullets: ["Conversion from child lead creation to disbursal.", "Higher conv% indicates better lender process and approval rates.", "Compare with Hero Funnel in radar chart."] }, ...(kpiConfigs.convChart ? [kpiConfigs.convChart] : [])] },
      aop: { title: "AOP Target", metric: hasAop ? `${aop} Cr` : "N/A", subtitle: hasAop ? `${achv.toFixed(1)}% achieved` : "No AOP set", sections: [{ type: "kpi-row", title: "AOP Progress", kpis: [{ label: "Target", value: hasAop ? `${aop} Cr` : "N/A" }, { label: "Achieved", value: `${lenderKPIs!.amountCr.toFixed(1)} Cr` }, { label: "Progress", value: hasAop ? `${achv.toFixed(1)}%` : "-", color: progressColor }] }, { type: "bullets", title: "Analysis", bullets: hasAop ? [`AOP = Annual Operating Plan target for ${effectiveLender}.`, `Current: ${achv.toFixed(1)}% of target.`, achv >= 80 ? "On track for target." : "Monitor pacing — consider volume or conversion improvements."] : ["No AOP target configured for this lender.", "Set targets in lender configuration to track progress."] }] },
      productTypes: { title: "Product Types", metric: `${byProduct.length}`, subtitle: byProduct.map((p) => p.product_type).join(", "), sections: productTypesSections },
    };
  }, [lenderKPIs, effectiveLender, pL, byProduct, kpiConfigs, AVG_ATS, LMTD_FACTOR]);

  // Radar: this lender vs Hero Funnel
  // ═══ Spider / Radar chart data ═══════════════════════════════════════
  // When NO lender filter: MTD conv% vs LMTD conv% across all stages
  // When lender filtered: Lender conv% vs Hero Funnel per stage
  const radarData = useMemo(() => {
    if (isLenderFiltered) {
      // ── Lender vs Hero Funnel ──
      const allLmtd = l2Data.filter(
        (r) => r.month_start === "2.LMTD" && !r.sub_stage &&
          Math.floor(r.major_index) === r.major_index && r.major_index < 1000 && r.major_index !== 1
      );
      const byLdr: Record<string, Record<number, { stage: string; leads: number }>> = {};
      allLmtd.forEach((r) => {
        if (!byLdr[r.lender]) byLdr[r.lender] = {};
        if (!byLdr[r.lender][r.major_index]) byLdr[r.lender][r.major_index] = { stage: r.original_major_stage, leads: 0 };
        byLdr[r.lender][r.major_index].leads += r.leads;
      });
      const allIdx = Array.from(new Set(allLmtd.map((r) => r.major_index))).sort((a, b) => a - b);
      const heroMap: Record<number, { conv: number; lender: string }> = {};
      for (let i = 1; i < allIdx.length; i++) {
        const cur = allIdx[i]; const prev = allIdx[i - 1];
        let best = -1; let bestL = "";
        Object.entries(byLdr).forEach(([l, sm]) => {
          const c = sm[cur]?.leads || 0; const p = sm[prev]?.leads || 0;
          if (p > 0) { const cv = (c / p) * 100; if (cv > best) { best = cv; bestL = l; } }
        });
        if (best >= 0) heroMap[cur] = { conv: best, lender: bestL };
      }

      const lenderMtd = l2Data.filter((r) => r.lender === effectiveLender && r.month_start === "1.MTD" && !r.sub_stage && Math.floor(r.major_index) === r.major_index && r.major_index < 1000 && r.major_index !== 1);
      const mtdMap: Record<number, number> = {};
      lenderMtd.forEach((r) => { mtdMap[r.major_index] = (mtdMap[r.major_index] || 0) + r.leads; });
      const lenderIdx = Object.keys(mtdMap).map(Number).sort((a, b) => a - b);

      return lenderIdx.filter((_, i) => i > 0).slice(0, 8).map((idx) => {
        const prev = lenderIdx[lenderIdx.indexOf(idx) - 1];
        const conv = (mtdMap[prev] || 0) > 0 ? ((mtdMap[idx] || 0) / (mtdMap[prev] || 0)) * 100 : 0;
        const hero = heroMap[idx];
        const stageName = lenderMtd.find((r) => r.major_index === idx)?.original_major_stage || `Stage ${idx}`;
        return {
          stage: stageName.length > 18 ? stageName.substring(0, 16) + "..." : stageName,
          [effectiveLender]: parseFloat(conv.toFixed(1)),
          "Hero Funnel": hero ? parseFloat(hero.conv.toFixed(1)) : 0,
        };
      });
    } else {
      // ── All-lender: MTD conv% vs LMTD conv% ──
      // Use structuralAnalysis which now has all stages from both CSV and L2
      const mtdKey = `${pL} Conv%`;
      const lmtdKey = `${cL} Conv%`;
      return structuralAnalysis
        .filter((sa) => sa.mtdConv !== null)
        .slice(0, 10)
        .map((sa) => ({
          stage: sa.stage.length > 18 ? sa.stage.substring(0, 16) + "..." : sa.stage,
          [mtdKey]: sa.mtdConv ?? 0,
          [lmtdKey]: sa.lmtdConv ?? 0,
        }));
    }
  }, [isLenderFiltered, l2Data, effectiveLender, structuralAnalysis, pL, cL]);

  // Lender comparison bar chart
  const lenderCompare = useMemo(() => {
    if (!isLenderFiltered) return [];
    const map: Record<string, number> = {};
    disbData.forEach((r) => { map[r.lender] = (map[r.lender] || 0) + r.disbursed; });
    return Object.entries(map).map(([l, c]) => ({ lender: l, disbursed: c, isActive: l === effectiveLender }))
      .sort((a, b) => b.disbursed - a.disbursed);
  }, [isLenderFiltered, disbData, effectiveLender]);

  // Monthly trends for lender
  const lenderTrends = useMemo(() => {
    if (!isLenderFiltered || !lenderKPIs) return [];
    const months = ["Sep 2025", "Oct 2025", "Nov 2025", "Dec 2025", "Jan 2026", "Feb 2026"];
    const factors = [0.72, 0.78, 0.85, 0.90, 0.95, 1.0];
    return months.map((month, i) => ({
      month,
      disbursed: Math.round(lenderKPIs!.totalDisb * factors[i]),
      amount_cr: parseFloat(((lenderKPIs!.totalDisb * factors[i] * AVG_ATS) / 100).toFixed(2)),
    }));
  }, [isLenderFiltered, lenderKPIs, AVG_ATS]);

  const [stageHintVisible, dismissStageHint] = useContextualHint("stage_click");

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-muted-foreground animate-pulse">
          Loading funnel data...
        </div>
      </div>
    );
  }

  const handleStageClick = (stageIndex: number) => {
    setSelectedStageIndex(stageIndex);
  };

  return (
    <div>
      <GuidedTour />
      <TourHelpButton />
      <PageHeader
        title={isLenderFiltered ? `Funnel — ${effectiveLender}` : "Funnel Summary"}
        description={`${pL} vs ${cL}. Click a stage to open the Stage Deep Dive.`}
      />

      <div className="p-6 space-y-6">
        {/* Global controls bar */}
        <div data-tour="funnel-filters" className="rounded-lg border bg-card p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
              Filters
            </span>
            <span className="text-[10px] text-muted-foreground">— Use these filters to drill down by lender, program or flow. All charts and insights update instantly.</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
          <Select
            value={useGlobalFilters ? global.lender : tabLender}
            onValueChange={(v) => (useGlobalFilters ? setGlobal({ lender: v }) : setTabLender(v))}
          >
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="Lender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Lenders</SelectItem>
              {allLenders.map((l) => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={useGlobalFilters ? global.productType : tabProductType}
            onValueChange={(v) => (useGlobalFilters ? setGlobal({ productType: v }) : setTabProductType(v))}
          >
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="Program" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Programs</SelectItem>
              {allProductTypes.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={useGlobalFilters ? global.flow : tabFlow}
            onValueChange={(v) => (useGlobalFilters ? setGlobal({ flow: v }) : setTabFlow(v))}
          >
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="Flow" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Flows</SelectItem>
              {allFlows.map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground/70 text-[10px]">|</span>
          <span className="text-[10px] text-muted-foreground">
            Time: MTD vs LMTD
          </span>
          <span className="text-[10px] text-muted-foreground">
            Compare: {cL}
          </span>
          {(effectiveLender !== "All" || effectiveProductType !== "All" || effectiveFlow !== "All") && (
            <div className="flex flex-wrap gap-1.5">
              {effectiveLender !== "All" && (
                <Badge variant="secondary" className="text-[10px]">
                  {effectiveLender}
                </Badge>
              )}
              {effectiveProductType !== "All" && (
                <Badge variant="secondary" className="text-[10px]">
                  {effectiveProductType}
                </Badge>
              )}
              {effectiveFlow !== "All" && (
                <Badge variant="secondary" className="text-[10px]">
                  {effectiveFlow}
                </Badge>
              )}
            </div>
          )}
          </div>
          {/* Active filter summary prompt */}
          {effectiveLender === "All" && effectiveProductType === "All" && effectiveFlow === "All" ? (
            <p className="text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-900/15 rounded-md px-2.5 py-1.5 border border-blue-200 dark:border-blue-800/40">
              Showing <span className="font-semibold">all data</span> across every lender, program and flow. Select any filter above to focus on a specific segment.
            </p>
          ) : (
            <p className="text-[10px] text-foreground bg-primary/5 rounded-md px-2.5 py-1.5 border border-primary/20">
              Filtered view: <span className="font-semibold">{effectiveLender !== "All" ? effectiveLender : "All Lenders"}</span>
              {" · "}<span className="font-semibold">{effectiveProductType !== "All" ? effectiveProductType : "All Programs"}</span>
              {" · "}<span className="font-semibold">{effectiveFlow !== "All" ? effectiveFlow : "All Flows"}</span>
              <span className="text-muted-foreground ml-1">— Change filters above to compare other segments.</span>
            </p>
          )}
        </div>

        {/* Funnel: click stage opens insight as independent block below (like Executive Summary tabs) */}
        <div data-tour="funnel-chart" className="rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold mb-3">Funnel</h2>
          <CommandFunnel
            stages={commandFunnelStages}
            compareLabel={cL}
            periodLabel={pL}
            overallConvPct={overallConvPct}
            overallConvDeltaPp={overallConvDeltaPp}
            topLeakStageIndex={topLeakStageIndex}
            onStageClick={(idx) => { dismissStageHint(); handleStageClick(idx); }}
          />
          <div className="mt-2 flex justify-center">
            <PulseHint text="Click any stage above to deep-dive into Business Insights, Lender Funnel & L2 Breakdown" visible={stageHintVisible} onDismiss={dismissStageHint} />
          </div>
        </div>

        {/* B1: Revenue Loss Bar */}
        <RevenueLossBar
          stages={funnelStagesWithConv.map((s) => ({
            index: s.index,
            name: s.name,
            leads: s.leads,
            lmtdLeads: s.lmtdLeads,
            prevLeads: s.prevLeads,
            deltaPp: s.deltaPp ?? null,
          }))}
          onStageClick={(idx) => handleStageClick(idx)}
        />

        {/* B2: Pattern Memory */}
        <PatternMemory onStageClick={(idx) => handleStageClick(idx)} />

        {/* ── Ratio Metrics: Disb/W, Disb/BRE1, Disb/Child ──────────── */}
        {!isLenderFiltered && (
          <div data-tour="ratio-metrics" className="rounded-lg border bg-card p-4">
            <h2 className="text-sm font-semibold mb-3">End-to-End Conversion</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {ratioMetrics.map((rm) => (
                <div key={rm.label} className="rounded-lg border bg-muted/20 p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{rm.label}</p>
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-lg font-bold tabular-nums">
                      {rm.mtd !== null ? `${rm.mtd}%` : "—"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">MTD</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 mt-0.5">
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {rm.lmtd !== null ? `${rm.lmtd}%` : "—"} <span className="text-[9px]">LMTD</span>
                    </span>
                    {rm.deltaPp !== null && (
                      <span className={cn(
                        "text-xs font-semibold tabular-nums",
                        rm.deltaPp < 0 ? "text-red-600" : rm.deltaPp > 0 ? "text-emerald-600" : "text-muted-foreground"
                      )}>
                        {rm.deltaPp >= 0 ? "+" : ""}{rm.deltaPp.toFixed(2)}pp
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Key Insights Strip (4-5 PM focus areas) ────────────────── */}
        {topFunnelInsightsStrip.length > 0 && (
          <div data-tour="key-focus-areas" className="rounded-lg border bg-card p-4">
            <h2 className="text-sm font-semibold mb-3">Key Focus Areas</h2>
            <div className="space-y-2">
              {topFunnelInsightsStrip.map((ins, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleStageClick(ins.stageIndex)}
                  className={cn(
                    "w-full rounded-lg border px-3 py-2 text-xs text-left transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    ins.severity === "critical"
                      ? "border-red-300 bg-red-50/60 dark:bg-red-900/15 dark:border-red-700/50 hover:bg-red-100/70 dark:hover:bg-red-900/25"
                      : ins.severity === "warning"
                        ? "border-amber-200 bg-amber-50/50 dark:bg-amber-900/10 dark:border-amber-700/50 hover:bg-amber-100/60 dark:hover:bg-amber-900/20"
                        : "border-emerald-200 bg-emerald-50/50 dark:bg-emerald-900/10 dark:border-emerald-700/50 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/20"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span className={cn(
                      "mt-0.5 inline-block w-2 h-2 rounded-full shrink-0",
                      ins.severity === "critical" ? "bg-red-600" : ins.severity === "warning" ? "bg-amber-500" : "bg-emerald-500"
                    )} />
                    <span className="text-foreground flex-1">{ins.text}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">View →</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Stage insight: modal overlay (like Executive Summary deep-dive) when a stage is selected */}
        <Dialog open={!!selectedStageForDrawer} onOpenChange={(open) => !open && setSelectedStageIndex(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <DialogHeader>
              <DialogTitle className="text-left">
                {selectedStageForDrawer?.name ?? "Stage"}
              </DialogTitle>
            </DialogHeader>
            {selectedStageForDrawer && (
              <div className="mt-4">
                <StageDetailContent
                  stage={selectedStageForDrawer}
                  isTopLeak={topLeakStageIndex === selectedStageForDrawer.index}
                  hasLenderAllocation={selectedStageForDrawer.index >= 6}
                  structuralRow={structuralRowForDrawer}
                  globalVsSpecificRow={globalVsSpecificRowForDrawer}
                  compareLabel={cL}
                  periodLabel={pL}
                  lenderProgramRows={lenderProgramRowsForDrawer}
                  lenderRows={lenderRowsForStage}
                  flowRows={flowRowsForStage}
                  lenderL2Rows={lenderL2RowsForStage}
                  flowLenderInsightRows={flowLenderInsightRows}
                  subStages={subStagesForDrawer}
                  prevStageName={prevStageNameForDrawer}
                  failureReasons={MOCK_FAILURE_REASONS}
                  onInsightClick={(lender, flow) => {
                    setInsightDDLender(lender);
                    setInsightDDFlow(flow);
                    setInsightDDOpen(true);
                  }}
                  onViewFullTable={undefined}
                />
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Deep-dive modal for a specific lender × flow (post-allocation) or flow-only (pre-allocation) */}
        <Dialog open={insightDDOpen} onOpenChange={(open) => { if (!open) { setInsightDDOpen(false); setInsightDDLender(null); setInsightDDFlow(null); setL2DrillStage(null); setL2DrillView(null); setL2ReasonDrill(null); } }}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto p-6">
            <DialogHeader>
              <DialogTitle className="text-left text-sm">
                {insightDDLender ? `${insightDDLender} × ${insightDDFlow}` : insightDDFlow}
              </DialogTitle>
            </DialogHeader>
            {insightDDFlow && (() => {
              const isFlowOnly = !insightDDLender;
              const combo = isFlowOnly
                ? flowRowsForStage.find((r) => r.flow === insightDDFlow)
                : flowLenderInsightRows.find((r) => r.lender === insightDDLender && r.flow === insightDDFlow);
              const overallRow = isFlowOnly
                ? lenderFlowL2RowsForStage.find((r) => r.flow === insightDDFlow && r.l2Stage === "Overall")
                : lenderFlowL2RowsForStage.find((r) => r.lender === insightDDLender && r.flow === insightDDFlow && r.l2Stage === "Overall");
              const l2Rows = isFlowOnly
                ? lenderFlowL2RowsForStage.filter((r) => r.flow === insightDDFlow && r.l2Stage !== "Overall")
                : lenderFlowL2RowsForStage.filter((r) => r.lender === insightDDLender && r.flow === insightDDFlow && r.l2Stage !== "Overall");

              const stageMTD = combo?.mtdLeads ?? 0;
              const stageLMTD = combo?.lmtdLeads ?? 0;
              const stageDiff = stageLMTD > 0 ? parseFloat((((stageMTD - stageLMTD) / stageLMTD) * 100).toFixed(1)) : null;

              const stuckMTD = l2Rows.reduce((s, r) => s + r.mtdLeads, 0);
              const stuckLMTD = l2Rows.reduce((s, r) => s + r.lmtdLeads, 0);
              const stuckDiff = stuckLMTD > 0 ? parseFloat((((stuckMTD - stuckLMTD) / stuckLMTD) * 100).toFixed(1)) : null;

              const prevMTD = overallRow?.mtdPrevStage ?? 0;
              const prevLMTD = overallRow?.lmtdPrevStage ?? 0;
              const stuckConvMTD = prevMTD > 0 ? parseFloat(((stuckMTD / prevMTD) * 100).toFixed(2)) : null;
              const stuckConvLMTD = prevLMTD > 0 ? parseFloat(((stuckLMTD / prevLMTD) * 100).toFixed(2)) : null;
              const convDiffPp = stuckConvMTD != null && stuckConvLMTD != null ? parseFloat((stuckConvMTD - stuckConvLMTD).toFixed(2)) : null;

              const curStageName = selectedStageForDrawer?.name ?? "Current stage";
              const prevName = prevStageNameForDrawer ?? "Previous stage";

              return (
                <div className="mt-3 space-y-4">
                  {/* Section 1: Stage throughput */}
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Stage throughput — leads reaching {curStageName}</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg border bg-muted/20 p-2.5 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase">MTD</p>
                        <p className="text-base font-bold tabular-nums">{stageMTD.toLocaleString("en-IN")}</p>
                      </div>
                      <div className="rounded-lg border bg-muted/20 p-2.5 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase">{cL}</p>
                        <p className="text-base font-bold tabular-nums">{stageLMTD.toLocaleString("en-IN")}</p>
                      </div>
                      <div className="rounded-lg border bg-muted/20 p-2.5 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase">Δ%</p>
                        <p className={cn("text-base font-bold tabular-nums", stageDiff != null && stageDiff < 0 ? "text-red-600" : stageDiff != null && stageDiff > 0 ? "text-emerald-600" : "")}>
                          {stageDiff != null ? `${stageDiff >= 0 ? "+" : ""}${stageDiff.toFixed(1)}%` : "—"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Stuck leads between prevStage → currentStage */}
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Stuck leads — between {prevName} → {curStageName}</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg border bg-muted/20 p-2.5 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase">MTD stuck</p>
                        <p className="text-base font-bold tabular-nums">{stuckMTD.toLocaleString("en-IN")}</p>
                      </div>
                      <div className="rounded-lg border bg-muted/20 p-2.5 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase">{cL} stuck</p>
                        <p className="text-base font-bold tabular-nums">{stuckLMTD.toLocaleString("en-IN")}</p>
                      </div>
                      <div className="rounded-lg border bg-muted/20 p-2.5 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase">Stuck Δ%</p>
                        <p className={cn("text-base font-bold tabular-nums", stuckDiff != null && stuckDiff > 0 ? "text-red-600" : stuckDiff != null && stuckDiff < 0 ? "text-emerald-600" : "")}>
                          {stuckDiff != null ? `${stuckDiff >= 0 ? "+" : ""}${stuckDiff.toFixed(1)}%` : "—"}
                        </p>
                      </div>
                    </div>

                    {/* Stuck conv % row */}
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <div className="rounded-lg border bg-muted/20 p-2 text-center">
                        <p className="text-[9px] text-muted-foreground uppercase">MTD stuck rate</p>
                        <p className="text-sm font-bold tabular-nums">{stuckConvMTD != null ? `${stuckConvMTD.toFixed(2)}%` : "—"}</p>
                        <p className="text-[9px] text-muted-foreground">{stuckMTD.toLocaleString("en-IN")} / {prevMTD.toLocaleString("en-IN")}</p>
                      </div>
                      <div className="rounded-lg border bg-muted/20 p-2 text-center">
                        <p className="text-[9px] text-muted-foreground uppercase">{cL} stuck rate</p>
                        <p className="text-sm font-bold tabular-nums">{stuckConvLMTD != null ? `${stuckConvLMTD.toFixed(2)}%` : "—"}</p>
                        <p className="text-[9px] text-muted-foreground">{stuckLMTD.toLocaleString("en-IN")} / {prevLMTD.toLocaleString("en-IN")}</p>
                      </div>
                      <div className="rounded-lg border bg-muted/20 p-2 text-center">
                        <p className="text-[9px] text-muted-foreground uppercase">Rate Δ (pp)</p>
                        <p className={cn("text-sm font-bold tabular-nums", convDiffPp != null && convDiffPp > 0 ? "text-red-600" : convDiffPp != null && convDiffPp < 0 ? "text-emerald-600" : "")}>
                          {convDiffPp != null ? `${convDiffPp >= 0 ? "+" : ""}${convDiffPp.toFixed(2)}pp` : "—"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Messaging */}
                  <div className="rounded-lg border bg-blue-50/60 dark:bg-blue-900/15 border-blue-200 dark:border-blue-800/40 px-3 py-2.5 space-y-1">
                    <p className="text-[10px] font-semibold text-foreground">Key Insights:</p>
                    <div className="space-y-0.5 text-[10px] text-foreground">
                      {stuckDiff != null && (
                        <p>
                          • Stuck count{" "}
                          {stuckDiff > 0
                            ? <><span className="font-semibold text-red-600">increased +{stuckDiff.toFixed(1)}%</span> vs {cL} — more leads getting stuck, needs attention.</>
                            : stuckDiff < 0
                            ? <><span className="font-semibold text-emerald-600">decreased {stuckDiff.toFixed(1)}%</span> vs {cL} — fewer leads stuck, improvement.</>
                            : <>flat vs {cL}.</>}
                        </p>
                      )}
                      {convDiffPp != null && (
                        <p>
                          • Stuck rate{" "}
                          {convDiffPp > 0
                            ? <><span className="font-semibold text-red-600">worsened by +{convDiffPp.toFixed(2)}pp</span> — higher proportion of leads getting stuck.</>
                            : convDiffPp < 0
                            ? <><span className="font-semibold text-emerald-600">improved by {convDiffPp.toFixed(2)}pp</span> — lower proportion stuck, healthier.</>
                            : <>unchanged.</>}
                        </p>
                      )}
                      {stuckDiff != null && convDiffPp != null && ((stuckDiff < 0 && convDiffPp > 0) || (stuckDiff > 0 && convDiffPp < 0)) && (
                        <p className="text-amber-700 dark:text-amber-400 font-medium">
                          • Note: Stuck count and stuck rate are diverging — {stuckDiff < 0 ? "fewer absolute leads stuck but a higher proportion is getting stuck" : "more absolute leads stuck but the proportion has actually improved"}.
                        </p>
                      )}
                      {(() => {
                        const topBlocker = [...l2Rows].sort((a, b) => b.mtdLeads - a.mtdLeads)[0];
                        const mostWorsened = [...l2Rows].filter((r) => r.countDiffPct != null && r.countDiffPct > 5).sort((a, b) => (b.countDiffPct ?? 0) - (a.countDiffPct ?? 0))[0];
                        return (
                          <>
                            {topBlocker && topBlocker.mtdLeads > 0 && (
                              <p>• <span className="font-semibold">Top blocker:</span> {topBlocker.l2Stage.replace(/_/g, " ")} ({topBlocker.mtdLeads.toLocaleString("en-IN")} stuck).</p>
                            )}
                            {mostWorsened && (
                              <p>• <span className="font-semibold text-red-600">Most worsened:</span> {mostWorsened.l2Stage.replace(/_/g, " ")} stuck count up <span className="font-semibold text-red-600">+{mostWorsened.countDiffPct!.toFixed(1)}%</span>.</p>
                            )}
                          </>
                        );
                      })()}
                    </div>
                    <p className="text-[9px] text-muted-foreground pt-0.5">Stuck rate = stuck leads ÷ {prevName} count. <span className="text-red-600 font-medium">+Δ = worse</span>, <span className="text-emerald-600 font-medium">-Δ = better</span>.</p>
                  </div>

                  {/* L2 table with drill-down CTAs */}
                  {l2Rows.length > 0 ? (
                    <div>
                      <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        L2 sub-stage breakdown
                      </h4>
                      <div className="space-y-0">
                        {/* Header row */}
                        <div className="grid grid-cols-[1fr_60px_60px_70px] gap-1 text-[10px] text-muted-foreground font-medium border-b pb-1">
                          <span>L2 stage</span>
                          <span className="text-right">MTD</span>
                          <span className="text-right">{cL}</span>
                          <span className="text-right">Stuck Δ%</span>
                        </div>
                        {[...l2Rows].sort((a, b) => (b.countDiffPct ?? 0) - (a.countDiffPct ?? 0)).map((r, i) => {
                          const isExpanded = l2DrillStage === r.l2Stage;
                          const deepDive = MOCK_L2_DEEP_DIVE[r.l2Stage];
                          const hasData = !!deepDive;
                          return (
                            <div key={`${r.l2Stage}-${i}`} className={cn(
                              "border-b border-border/40",
                              r.countDiffPct != null && r.countDiffPct > 10 ? "bg-red-50/40 dark:bg-red-900/10" :
                              r.countDiffPct != null && r.countDiffPct < -10 ? "bg-emerald-50/30 dark:bg-emerald-900/10" : ""
                            )}>
                              {/* Main row */}
                              <div className="grid grid-cols-[1fr_60px_60px_70px] gap-1 items-center py-1.5 text-xs">
                                <span className="font-medium pr-1">{r.l2Stage.replace(/_/g, " ")}</span>
                                <span className="text-right tabular-nums">{r.mtdLeads.toLocaleString("en-IN")}</span>
                                <span className="text-right tabular-nums">{r.lmtdLeads.toLocaleString("en-IN")}</span>
                                <span className={cn("text-right tabular-nums font-semibold", r.countDiffPct != null && r.countDiffPct > 0 ? "text-red-600" : r.countDiffPct != null && r.countDiffPct < 0 ? "text-emerald-600" : "")}>
                                  {r.countDiffPct != null ? `${r.countDiffPct >= 0 ? "+" : ""}${r.countDiffPct.toFixed(1)}%` : "—"}
                                </span>
                              </div>
                              {/* CTA row */}
                              {hasData && (
                                <div className="flex items-center gap-2 pb-1.5 pl-1">
                                  <button
                                    type="button"
                                    onClick={() => { setL2DrillStage(isExpanded && l2DrillView === "reasons" ? null : r.l2Stage); setL2DrillView("reasons"); setL2ReasonDrill(null); }}
                                    className={cn(
                                      "text-[10px] px-2 py-0.5 rounded-full border transition-colors",
                                      isExpanded && l2DrillView === "reasons"
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "border-primary/30 text-primary hover:bg-primary/10"
                                    )}
                                  >
                                    {isExpanded && l2DrillView === "reasons" ? "▲ Rejection reasons" : "▼ Rejection reasons"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { setL2DrillStage(isExpanded && l2DrillView === "cohorts" ? null : r.l2Stage); setL2DrillView("cohorts"); setL2ReasonDrill(null); }}
                                    className={cn(
                                      "text-[10px] px-2 py-0.5 rounded-full border transition-colors",
                                      isExpanded && l2DrillView === "cohorts"
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "border-primary/30 text-primary hover:bg-primary/10"
                                    )}
                                  >
                                    {isExpanded && l2DrillView === "cohorts" ? "▲ Cohort analysis" : "▼ Cohort analysis"}
                                  </button>
                                </div>
                              )}
                              {/* Expanded panel: Rejection Reasons */}
                              {isExpanded && l2DrillView === "reasons" && deepDive && (
                                <div className="rounded-lg border bg-muted/20 mx-1 mb-2 p-2.5 space-y-2">
                                  <p className="text-[10px] font-semibold text-foreground">Rejection reasons — {r.l2Stage.replace(/_/g, " ")}</p>
                                  <p className="text-[9px] text-muted-foreground">Click any reason to view its cohort breakdown (Vintage, MCRS, NoWL, Category, Location).</p>
                                  <div className="space-y-0">
                                    {/* Header */}
                                    <div className="grid grid-cols-[1fr_44px_44px_56px] gap-1 text-[10px] text-muted-foreground font-medium border-b pb-1">
                                      <span>Reason</span><span className="text-right">MTD</span><span className="text-right">{cL}</span><span className="text-right">Δ%</span>
                                    </div>
                                    {[...deepDive.reasons].sort((a, b) => b.mtd - a.mtd).map((rr, ri) => {
                                      const isReasonExpanded = l2ReasonDrill === rr.reason;
                                      return (
                                        <div key={`reason-${ri}`} className="border-b border-border/30">
                                          <button
                                            type="button"
                                            onClick={() => setL2ReasonDrill(isReasonExpanded ? null : rr.reason)}
                                            className="w-full grid grid-cols-[1fr_44px_44px_56px] gap-1 items-center py-1.5 text-[11px] text-left hover:bg-muted/30 rounded transition-colors"
                                          >
                                            <span className="pr-1 flex items-center gap-1">
                                              <span className={cn("text-[9px]", isReasonExpanded ? "text-primary" : "text-muted-foreground")}>{isReasonExpanded ? "▼" : "▶"}</span>
                                              <span className={cn("font-medium", isReasonExpanded && "text-primary")}>{rr.reason}</span>
                                            </span>
                                            <span className="text-right tabular-nums font-medium">{rr.mtd}</span>
                                            <span className="text-right tabular-nums">{rr.lmtd}</span>
                                            <span className={cn("text-right tabular-nums font-semibold",
                                              rr.diffPct != null && rr.diffPct > 0 ? "text-red-600" : rr.diffPct != null && rr.diffPct < 0 ? "text-emerald-600" : ""
                                            )}>
                                              {rr.diffPct != null ? `${rr.diffPct >= 0 ? "+" : ""}${rr.diffPct.toFixed(1)}%` : "—"}
                                            </span>
                                          </button>
                                          {/* Reason-level cohort drill-down */}
                                          {isReasonExpanded && rr.cohorts && rr.cohorts.length > 0 && (
                                            <div className="rounded-md border bg-background/80 mx-1 mb-1.5 p-2 space-y-2">
                                              <p className="text-[9px] font-semibold text-primary">Cohort breakdown for: {rr.reason}</p>
                                              {(() => {
                                                const allSegs = rr.cohorts.flatMap((dim) =>
                                                  dim.rows.filter((cr) => cr.diffPct != null)
                                                    .map((cr) => ({ dim: dim.dimension, seg: cr.segment, pct: cr.diffPct as number }))
                                                ).sort((a, b) => b.pct - a.pct);
                                                const top2 = allSegs.slice(0, 2);
                                                if (top2.length === 0) return null;
                                                const hasRising = top2[0].pct > 0;
                                                return (
                                                  <div className={cn("rounded border px-2 py-1.5 space-y-0.5",
                                                    hasRising ? "bg-red-50/60 dark:bg-red-900/15 border-red-200/50 dark:border-red-800/30" : "bg-amber-50/60 dark:bg-amber-900/15 border-amber-200/50 dark:border-amber-800/30"
                                                  )}>
                                                    {top2.map((s, si) => (
                                                      <p key={si} className={cn("text-[10px]", s.pct > 0 ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400")}>
                                                        {s.pct > 0
                                                          ? <><span className="font-semibold">↑ {s.dim}: {s.seg}</span> — stuck count up <span className="font-bold">+{s.pct.toFixed(1)}%</span> vs {cL}</>
                                                          : <><span className="font-semibold">{s.dim}: {s.seg}</span> — least improved ({s.pct.toFixed(1)}%), monitor</>
                                                        }
                                                      </p>
                                                    ))}
                                                  </div>
                                                );
                                              })()}
                                              {rr.cohorts.map((dim, di) => (
                                                <div key={`rcoh-${di}`}>
                                                  <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{dim.dimension}</p>
                                                  <div className="grid grid-cols-[1fr_40px_40px_52px] gap-1 text-[9px] text-muted-foreground font-medium border-b pb-0.5 mb-0.5">
                                                    <span>Segment</span><span className="text-right">MTD</span><span className="text-right">{cL}</span><span className="text-right">Δ%</span>
                                                  </div>
                                                  {dim.rows.map((cr, ci) => (
                                                    <div key={`rcr-${di}-${ci}`} className={cn(
                                                      "grid grid-cols-[1fr_40px_40px_52px] gap-1 text-[10px] py-0.5 border-b border-border/20",
                                                      cr.diffPct != null && cr.diffPct > 15 ? "bg-red-50/50 dark:bg-red-900/10" :
                                                      cr.diffPct != null && cr.diffPct < -15 ? "bg-emerald-50/40 dark:bg-emerald-900/10" : ""
                                                    )}>
                                                      <span className="font-medium">{cr.segment}</span>
                                                      <span className="text-right tabular-nums font-medium">{cr.mtd}</span>
                                                      <span className="text-right tabular-nums">{cr.lmtd}</span>
                                                      <span className={cn("text-right tabular-nums font-semibold",
                                                        cr.diffPct != null && cr.diffPct > 0 ? "text-red-600" : cr.diffPct != null && cr.diffPct < 0 ? "text-emerald-600" : ""
                                                      )}>
                                                        {cr.diffPct != null ? `${cr.diffPct >= 0 ? "+" : ""}${cr.diffPct.toFixed(1)}%` : "—"}
                                                      </span>
                                                    </div>
                                                  ))}
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                  {(() => {
                                    const allSpikes = deepDive.reasons.flatMap((rr) =>
                                      rr.cohorts.flatMap((dim) =>
                                        dim.rows.filter((cr) => cr.diffPct != null && cr.diffPct > 0)
                                          .map((cr) => ({ reason: rr.reason, dim: dim.dimension, seg: cr.segment, pct: cr.diffPct as number }))
                                      )
                                    ).sort((a, b) => b.pct - a.pct);
                                    const top2 = allSpikes.slice(0, 2);
                                    if (top2.length === 0) {
                                      const sorted = [...deepDive.reasons].sort((a, b) => (b.diffPct ?? 0) - (a.diffPct ?? 0));
                                      const leastImproved = sorted.slice(0, 2);
                                      return leastImproved.length > 0 ? (
                                        <div className="rounded bg-amber-50/60 dark:bg-amber-900/15 border border-amber-200/50 dark:border-amber-800/30 px-2 py-1.5 space-y-0.5 mt-1">
                                          <p className="text-[9px] font-semibold text-amber-700 dark:text-amber-400 mb-0.5">Watch areas (least improved)</p>
                                          {leastImproved.map((rr, i) => (
                                            <p key={i} className="text-[10px] text-amber-700 dark:text-amber-400">
                                              • <span className="font-semibold">{rr.reason}</span> — only {rr.diffPct != null ? `${rr.diffPct.toFixed(1)}%` : "—"} change, monitor closely
                                            </p>
                                          ))}
                                        </div>
                                      ) : null;
                                    }
                                    return (
                                      <div className="rounded bg-red-50/60 dark:bg-red-900/15 border border-red-200/50 dark:border-red-800/30 px-2 py-1.5 space-y-0.5 mt-1">
                                        <p className="text-[9px] font-semibold text-red-700 dark:text-red-400 mb-0.5">Key concern areas</p>
                                        {top2.map((s, si) => (
                                          <p key={si} className="text-[10px] text-red-700 dark:text-red-400">
                                            • <span className="font-semibold">{s.reason}</span> — <span className="font-semibold">{s.dim}: {s.seg}</span> up +{s.pct.toFixed(1)}% vs {cL}
                                          </p>
                                        ))}
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}
                              {/* Expanded panel: Cohort Analysis */}
                              {isExpanded && l2DrillView === "cohorts" && deepDive && (
                                <div className="rounded-lg border bg-muted/20 mx-1 mb-2 p-2.5 space-y-3">
                                  <p className="text-[10px] font-semibold text-foreground">Cohort analysis — {r.l2Stage.replace(/_/g, " ")}</p>
                                  {deepDive.cohorts.map((dim, di) => (
                                    <div key={`dim-${di}`}>
                                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{dim.dimension}</p>
                                      <table className="w-full text-[11px] border-collapse">
                                        <thead>
                                          <tr className="border-b text-muted-foreground text-left">
                                            <th className="py-1 pr-2 font-medium">Segment</th>
                                            <th className="py-1 pr-1 text-right font-medium w-12">MTD</th>
                                            <th className="py-1 pr-1 text-right font-medium w-12">{cL}</th>
                                            <th className="py-1 text-right font-medium w-14">Δ%</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {dim.rows.sort((a, b) => b.mtd - a.mtd).map((cr, ci) => (
                                            <tr key={`cohort-${di}-${ci}`} className={cn(
                                              "border-b border-border/30",
                                              cr.diffPct != null && cr.diffPct > 15 ? "bg-red-50/40 dark:bg-red-900/10" :
                                              cr.diffPct != null && cr.diffPct < -15 ? "bg-emerald-50/30 dark:bg-emerald-900/10" : ""
                                            )}>
                                              <td className="py-1 pr-2 font-medium">{cr.segment}</td>
                                              <td className="py-1 pr-1 text-right tabular-nums font-medium">{cr.mtd}</td>
                                              <td className="py-1 pr-1 text-right tabular-nums">{cr.lmtd}</td>
                                              <td className={cn("py-1 text-right tabular-nums font-semibold",
                                                cr.diffPct != null && cr.diffPct > 0 ? "text-red-600" : cr.diffPct != null && cr.diffPct < 0 ? "text-emerald-600" : ""
                                              )}>
                                                {cr.diffPct != null ? `${cr.diffPct >= 0 ? "+" : ""}${cr.diffPct.toFixed(1)}%` : "—"}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ))}
                                  <p className="text-[10px] text-muted-foreground">Cohorts with <span className="text-red-600 font-medium">+Δ%</span> (red) have more stuck leads in MTD vs {cL}. Focus on these segments.</p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No L2 sub-stage data available.</p>
                  )}
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* Drawer not used for stage click — stage insight opens as block above */}
        <StageDrawer
          open={false}
          onOpenChange={() => {}}
          stage={null}
          isTopLeak={selectedStageForDrawer != null && topLeakStageIndex === selectedStageForDrawer.index}
          structuralRow={structuralRowForDrawer}
          globalVsSpecificRow={globalVsSpecificRowForDrawer}
          compareLabel={cL}
          periodLabel={pL}
          lenderProgramRows={lenderProgramRowsForDrawer}
          lenderRows={lenderRowsForStage}
          flowRows={flowRowsForStage}
          lenderL2Rows={lenderL2RowsForStage}
          flowLenderInsightRows={flowLenderInsightRows}
          subStages={subStagesForDrawer}
          prevStageName={prevStageNameForDrawer}
          failureReasons={MOCK_FAILURE_REASONS}
          onLenderClick={(lender) => {
            setDrillDownType("lender");
            setDrillDownKey(lender);
            setDrillDownOpen(true);
          }}
          onFlowClick={(flow) => {
            setDrillDownType("flow");
            setDrillDownKey(flow);
            setDrillDownOpen(true);
          }}
          onL2Click={(l2Stage) => {
            setDrillDownType("l2");
            setDrillDownKey(l2Stage);
            setDrillDownOpen(true);
          }}
          onViewFullTable={undefined}
        />

        {/* Drill-down: Lender × L2 × Flow | Flow × Lender × L2 | L2 × Lender × Flow */}
        <Sheet open={drillDownOpen} onOpenChange={(open) => { setDrillDownOpen(open); if (!open) { setDrillDownType(null); setDrillDownKey(null); } }}>
          <SheetContent className="w-full max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="text-base">
                {drillDownType === "lender" && `Lender × L2 stage × Flow — ${drillDownKey ?? ""}`}
                {drillDownType === "flow" && `Flow × Lender × L2 stage — ${drillDownKey ?? ""}`}
                {drillDownType === "l2" && `L2 stage × Lender × Flow — ${drillDownKey ?? ""}`}
                {!drillDownType && "Breakdown"}
              </SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              {drillDownType && drillDownKey && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {drillDownType === "lender" && (
                        <>
                          <TableHead className="text-xs">Flow</TableHead>
                          <TableHead className="text-xs">L2 stage</TableHead>
                        </>
                      )}
                      {drillDownType === "flow" && (
                        <>
                          <TableHead className="text-xs">Lender</TableHead>
                          <TableHead className="text-xs">L2 stage</TableHead>
                        </>
                      )}
                      {drillDownType === "l2" && (
                        <>
                          <TableHead className="text-xs">Lender</TableHead>
                          <TableHead className="text-xs">Flow</TableHead>
                        </>
                      )}
                      <TableHead className="text-xs text-right">Count</TableHead>
                      <TableHead className="text-xs text-right">Δ (pp)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drillDownType === "lender" &&
                      lenderFlowL2RowsForStage
                        .filter((r) => r.lender === drillDownKey)
                        .map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs">{r.flow}</TableCell>
                            <TableCell className="text-xs">{r.l2Stage}</TableCell>
                            <TableCell className="text-xs text-right tabular-nums">{r.mtdLeads.toLocaleString("en-IN")}</TableCell>
                            <TableCell className="text-xs text-right tabular-nums">{r.countDiffPct != null ? `${r.countDiffPct >= 0 ? "+" : ""}${r.countDiffPct.toFixed(1)}%` : "—"}</TableCell>
                          </TableRow>
                        ))}
                    {drillDownType === "flow" &&
                      lenderFlowL2RowsForStage
                        .filter((r) => r.flow === drillDownKey)
                        .map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs">{r.lender}</TableCell>
                            <TableCell className="text-xs">{r.l2Stage}</TableCell>
                            <TableCell className="text-xs text-right tabular-nums">{r.mtdLeads.toLocaleString("en-IN")}</TableCell>
                            <TableCell className="text-xs text-right tabular-nums">{r.countDiffPct != null ? `${r.countDiffPct >= 0 ? "+" : ""}${r.countDiffPct.toFixed(1)}%` : "—"}</TableCell>
                          </TableRow>
                        ))}
                    {drillDownType === "l2" &&
                      lenderFlowL2RowsForStage
                        .filter((r) => r.l2Stage === drillDownKey)
                        .map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs">{r.lender}</TableCell>
                            <TableCell className="text-xs">{r.flow}</TableCell>
                            <TableCell className="text-xs text-right tabular-nums">{r.mtdLeads.toLocaleString("en-IN")}</TableCell>
                            <TableCell className="text-xs text-right tabular-nums">{r.countDiffPct != null ? `${r.countDiffPct >= 0 ? "+" : ""}${r.countDiffPct.toFixed(1)}%` : "—"}</TableCell>
                          </TableRow>
                        ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* Third-level: Stage Explorer (Lender × Program slice) */}
        <Sheet open={explorerOpen} onOpenChange={setExplorerOpen}>
          <SheetContent className="w-full max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="text-base">
                Stage Explorer — {selectedStageForDrawer?.name ?? "Stage"} / {explorerLender ?? ""} / {explorerProgram ?? ""}
              </SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4 text-sm text-muted-foreground">
              <p>Same stage metrics for this lender and program slice.</p>
              <p>Cohort slicing (risk band, city tier, new vs repeat) — placeholder until cohort dimensions exist in data.</p>
              <p>L2/L3 failure reasons distribution — use the L2/Sub-stages tab in the main Stage Drawer.</p>
              <p>
                <a href="#" className="text-primary underline" onClick={(e) => e.preventDefault()}>
                  Raw lead list
                </a>{" "}
                — placeholder link.
              </p>
            </div>
          </SheetContent>
        </Sheet>

        {/* Legacy / detailed sections removed from default view per Command Funnel redesign */}

        {/* ─── Pre-Funnel Metrics (only when not lender-filtered) — hidden by default ────── */}
        {false && !isLenderFiltered && (
          <>
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Pre-Funnel
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <ClickableKpiCard onClick={() => setKpiDive({ open: true, config: { title: "Whitelisted Base", metric: Math.round(stats.mtdWhitelisted * pF).toLocaleString("en-IN"), subtitle: "Pre-funnel audience eligible for offers", sections: [{ type: "kpi-row", title: "Period Comparison", kpis: [{ label: pL, value: Math.round(stats.mtdWhitelisted * pF).toLocaleString("en-IN"), sub: "MTD" }, { label: cL, value: Math.round(stats.lmtdWhitelisted * cF).toLocaleString("en-IN"), sub: "LMTD" }, { label: "Growth", value: `${stats.lmtdWhitelisted > 0 ? (((stats.mtdWhitelisted * pF) - (stats.lmtdWhitelisted * cF)) / (stats.lmtdWhitelisted * cF) * 100).toFixed(1) : 0}%`, color: (stats.mtdWhitelisted * pF) >= (stats.lmtdWhitelisted * cF) ? "text-emerald-600" : "text-red-600" }] }, { type: "bullets", title: "Analysis", bullets: ["Whitelisted base represents users eligible for lending offers.", "Higher base typically correlates with more downstream workable leads.", "Mock data — derived from funnel volume estimates."] }] } })}>
                  <QuickStat label="Whitelisted Base" mtd={Math.round(stats.mtdWhitelisted * pF)} lmtd={Math.round(stats.lmtdWhitelisted * cF)} mock />
                </ClickableKpiCard>
                <ClickableKpiCard onClick={() => setKpiDive({ open: true, config: { title: "Unique Impressions", metric: Math.round(stats.mtdImpressions * pF).toLocaleString("en-IN"), subtitle: "Offer impressions served to users", sections: [{ type: "kpi-row", title: "Period Comparison", kpis: [{ label: pL, value: Math.round(stats.mtdImpressions * pF).toLocaleString("en-IN") }, { label: cL, value: Math.round(stats.lmtdImpressions * cF).toLocaleString("en-IN") }, { label: "Growth", value: `${stats.lmtdImpressions > 0 ? (((stats.mtdImpressions * pF) - (stats.lmtdImpressions * cF)) / (stats.lmtdImpressions * cF) * 100).toFixed(1) : 0}%`, color: (stats.mtdImpressions * pF) >= (stats.lmtdImpressions * cF) ? "text-emerald-600" : "text-red-600" }] }, { type: "bullets", title: "Analysis", bullets: ["Impressions indicate reach of lending offers.", "Higher impressions with stable CTR drive more clicks.", "Mock data — derived from funnel volume estimates."] }] } })}>
                  <QuickStat label="Unique Impressions" mtd={Math.round(stats.mtdImpressions * pF)} lmtd={Math.round(stats.lmtdImpressions * cF)} mock />
                </ClickableKpiCard>
                <ClickableKpiCard onClick={() => setKpiDive({ open: true, config: { title: "Unique Clicks", metric: Math.round(stats.mtdClicks * pF).toLocaleString("en-IN"), subtitle: "Users who clicked on offers", sections: [{ type: "kpi-row", title: "Period Comparison", kpis: [{ label: pL, value: Math.round(stats.mtdClicks * pF).toLocaleString("en-IN") }, { label: cL, value: Math.round(stats.lmtdClicks * cF).toLocaleString("en-IN") }, { label: "Growth", value: `${stats.lmtdClicks > 0 ? (((stats.mtdClicks * pF) - (stats.lmtdClicks * cF)) / (stats.lmtdClicks * cF) * 100).toFixed(1) : 0}%`, color: (stats.mtdClicks * pF) >= (stats.lmtdClicks * cF) ? "text-emerald-600" : "text-red-600" }] }, { type: "bullets", title: "Analysis", bullets: ["Clicks indicate user interest in offers.", "CTR = Clicks / Impressions. Higher CTR suggests better targeting.", "Mock data — derived from funnel volume estimates."] }] } })}>
                  <QuickStat label="Unique Clicks" mtd={Math.round(stats.mtdClicks * pF)} lmtd={Math.round(stats.lmtdClicks * cF)} mock />
                </ClickableKpiCard>
                <ClickableKpiCard onClick={() => setKpiDive({ open: true, config: { title: "LPV (Flow2 only)", metric: Math.round(stats.mtdLPV * pF).toLocaleString("en-IN"), subtitle: "Landing Page Views — Flow2 Manual", sections: [{ type: "kpi-row", title: "Period Comparison", kpis: [{ label: pL, value: Math.round(stats.mtdLPV * pF).toLocaleString("en-IN") }, { label: cL, value: Math.round(stats.lmtdLPV * cF).toLocaleString("en-IN") }, { label: "Growth", value: `${stats.lmtdLPV > 0 ? (((stats.mtdLPV * pF) - (stats.lmtdLPV * cF)) / (stats.lmtdLPV * cF) * 100).toFixed(1) : 0}%`, color: (stats.mtdLPV * pF) >= (stats.lmtdLPV * cF) ? "text-emerald-600" : "text-red-600" }] }, { type: "bullets", title: "Analysis", bullets: ["LPV = Landing Page Views for Flow2 (Manual) users.", "FFR% = Workable Leads / LPV. Higher FFR indicates better form completion.", "Mock data — derived from Flow2 workable volume."] }] } })}>
                  <QuickStat label="LPV (Flow2 only)" mtd={Math.round(stats.mtdLPV * pF)} lmtd={Math.round(stats.lmtdLPV * cF)} mock />
                </ClickableKpiCard>
                <ClickableKpiCard onClick={() => setKpiDive({ open: true, config: { title: "FFR% (Flow2)", metric: `${stats.mtdFFR.toFixed(1)}%`, subtitle: "Form Fill Rate — Flow2 only", sections: [{ type: "kpi-row", title: "Period Comparison", kpis: [{ label: pL, value: `${stats.mtdFFR.toFixed(1)}%` }, { label: cL, value: `${stats.lmtdFFR.toFixed(1)}%` }, { label: "Delta", value: `${(stats.mtdFFR - stats.lmtdFFR).toFixed(1)}pp`, color: stats.mtdFFR >= stats.lmtdFFR ? "text-emerald-600" : "text-red-600" }] }, { type: "bullets", title: "Analysis", bullets: ["FFR = Workable Leads / LPV. Measures form completion rate.", "Higher FFR indicates better landing page UX and form design.", "Check load times and form complexity if FFR drops."] }] } })}>
                  <QuickRatio label="FFR% (Flow2)" mtd={stats.mtdFFR} lmtd={stats.lmtdFFR} />
                </ClickableKpiCard>
                <ClickableKpiCard onClick={() => setKpiDive({ open: true, config: { title: "Flow1 : Flow2 Ratio", metric: `${stats.flowRatio.toFixed(2)}x`, subtitle: "Auto vs Manual flow volume", sections: [{ type: "kpi-row", title: "Period Comparison", kpis: [{ label: pL, value: `${stats.flowRatio.toFixed(2)}x` }, { label: cL, value: `${stats.lmtdFlowRatio.toFixed(2)}x` }, { label: "Delta", value: `${(stats.flowRatio - stats.lmtdFlowRatio).toFixed(2)}x`, color: stats.flowRatio >= stats.lmtdFlowRatio ? "text-emerald-600" : "text-red-600" }] }, { type: "bullets", title: "Analysis", bullets: ["Flow1 (Auto) vs Flow2 (Manual) workable lead ratio.", "Ratio > 1: More auto leads. Ratio < 1: More manual leads.", "Balance depends on product mix and acquisition strategy."] }] } })}>
                  <QuickRatio label="Flow1 : Flow2 Ratio" mtd={stats.flowRatio} lmtd={stats.lmtdFlowRatio} suffix="x" isPct={false} />
                </ClickableKpiCard>
              </div>
            </div>
            <Separator />
          </>
        )}

        {lenderKPIs && false && (
        <>
        {/* ─── Funnel Metrics (legacy, hidden by default) ────────────────── */}
        <div id="funnel-kpis">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {isLenderFiltered ? `${effectiveLender} — Funnel KPIs (Child Lead → Disbursal)` : "Funnel KPIs"}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {!isLenderFiltered && (
              <ClickableKpiCard onClick={() => setKpiDive({ open: true, config: { title: "Workable Leads", metric: Math.round(stats.mtdW * pF).toLocaleString("en-IN"), subtitle: "Leads that passed initial eligibility", sections: [{ type: "kpi-row", title: "Period Comparison", kpis: [{ label: pL, value: Math.round(stats.mtdW * pF).toLocaleString("en-IN") }, { label: cL, value: Math.round(stats.lmtdW * cF).toLocaleString("en-IN") }, { label: "Growth", value: stats.lmtdW ? `${(((stats.mtdW * pF) - (stats.lmtdW * cF)) / (stats.lmtdW * cF) * 100).toFixed(1)}%` : "0%", color: (stats.mtdW * pF) >= (stats.lmtdW * cF) ? "text-emerald-600" : "text-red-600" }] }, { type: "bullets", title: "Analysis", bullets: ["Workable leads are the top of funnel — passed initial eligibility checks.", "Higher volume with stable conversion drives more disbursals.", "Monitor for seasonal patterns and acquisition changes."] }, ...(kpiConfigs.workableChart ? [kpiConfigs.workableChart] : [])] } })}>
                <QuickStat label="Workable Leads" mtd={Math.round(stats.mtdW * pF)} lmtd={Math.round(stats.lmtdW * cF)} />
              </ClickableKpiCard>
            )}
            <ClickableKpiCard onClick={() => setKpiDive({ open: true, config: { title: "Child Leads", metric: Math.round(stats.mtdC * pF).toLocaleString("en-IN"), subtitle: "Child leads created at lenders", sections: [{ type: "kpi-row", title: "Period Comparison", kpis: [{ label: pL, value: Math.round(stats.mtdC * pF).toLocaleString("en-IN") }, { label: cL, value: Math.round(stats.lmtdC * cF).toLocaleString("en-IN") }, { label: "Growth", value: stats.lmtdC ? `${(((stats.mtdC * pF) - (stats.lmtdC * cF)) / (stats.lmtdC * cF) * 100).toFixed(1)}%` : "0%", color: (stats.mtdC * pF) >= (stats.lmtdC * cF) ? "text-emerald-600" : "text-red-600" }] }, { type: "bullets", title: "Analysis", bullets: ["Child leads = leads sent to lenders for processing.", "Child/Parent ratio indicates multi-lender coverage per parent.", "Higher child leads with good conversion = more disbursals."] }, ...(kpiConfigs.childChart ? [kpiConfigs.childChart] : [])] } })}>
              <QuickStat label="Child Leads" mtd={Math.round(stats.mtdC * pF)} lmtd={Math.round(stats.lmtdC * cF)} />
            </ClickableKpiCard>
            <ClickableKpiCard onClick={() => setKpiDive({ open: true, config: { title: "Disbursed", metric: Math.round(stats.mtdD * pF).toLocaleString("en-IN"), subtitle: "Loans successfully disbursed", sections: [{ type: "kpi-row", title: "Period Comparison", kpis: [{ label: pL, value: Math.round(stats.mtdD * pF).toLocaleString("en-IN") }, { label: cL, value: Math.round(stats.lmtdD * cF).toLocaleString("en-IN") }, { label: "Amount (Cr)", value: `${((stats.mtdD * pF * AVG_ATS) / 100).toFixed(1)}`, sub: `ATS ~${AVG_ATS}L` }] }, { type: "bullets", title: "Analysis", bullets: ["Disbursed = loans successfully funded.", `Est. amount: ₹${((stats.mtdD * pF * AVG_ATS) / 100).toFixed(1)} Cr at ~₹${AVG_ATS}L ATS.`, "Track lender-wise disbursal for portfolio mix."] }, ...(kpiConfigs.disbChart ? [kpiConfigs.disbChart] : [])] } })}>
              <QuickStat label="Disbursed" mtd={Math.round(stats.mtdD * pF)} lmtd={Math.round(stats.lmtdD * cF)} />
            </ClickableKpiCard>
            <ClickableKpiCard onClick={() => setKpiDive({ open: true, config: { title: isLenderFiltered ? "Child to Disbursal" : "Workable to Disbursal", metric: `${stats.w2d.toFixed(2)}%`, subtitle: "End-to-end funnel conversion", sections: [{ type: "kpi-row", title: "Period Comparison", kpis: [{ label: pL, value: `${stats.w2d.toFixed(2)}%` }, { label: cL, value: `${stats.lmtdW2d.toFixed(2)}%` }, { label: "Delta", value: `${(stats.w2d - stats.lmtdW2d).toFixed(2)}pp`, color: stats.w2d >= stats.lmtdW2d ? "text-emerald-600" : "text-red-600" }] }, { type: "bullets", title: "Stage-wise Funnel", bullets: isLenderFiltered ? [`Child Lead → Disbursal: ${stats.w2d.toFixed(2)}%`, "Conversion from child lead creation to final disbursal.", "Improve by addressing stage drop-offs (BRE, KYC, etc.)."] : [`Workable → Disbursed: ${stats.w2d.toFixed(2)}%`, "Full funnel from workable lead to disbursal.", "Stage-wise conversion: Workable → Child → ... → Disbursed.", "Improve by fixing bottlenecks at each stage."] }] } })}>
              <QuickRatio label={isLenderFiltered ? "Child to Disbursal" : "Workable to Disbursal"} mtd={stats.w2d} lmtd={stats.lmtdW2d} />
            </ClickableKpiCard>
            {!isLenderFiltered && (
              <ClickableKpiCard onClick={() => setKpiDive({ open: true, config: { title: "Child / Parent Ratio", metric: `${stats.parentToChild.toFixed(2)}x`, subtitle: "Child leads per workable parent", sections: [{ type: "kpi-row", title: "Period Comparison", kpis: [{ label: pL, value: `${stats.parentToChild.toFixed(2)}x` }, { label: cL, value: `${stats.lmtdParentToChild.toFixed(2)}x` }, { label: "Delta", value: `${(stats.parentToChild - stats.lmtdParentToChild).toFixed(2)}x`, color: stats.parentToChild >= stats.lmtdParentToChild ? "text-emerald-600" : "text-red-600" }] }, { type: "bullets", title: "Analysis", bullets: ["Ratio = Child Leads / Workable Leads.", ">1x: Multiple lenders per parent — good offer coverage.", "<1x: Fewer child leads — may indicate limited matching."] }] } })}>
                <QuickRatio label="Child / Parent Ratio" mtd={stats.parentToChild} lmtd={stats.lmtdParentToChild} suffix="x" isPct={false} />
              </ClickableKpiCard>
            )}
            {!isLenderFiltered && (
              <ClickableKpiCard onClick={() => setKpiDive({ open: true, config: { title: "Child to Disbursal", metric: `${stats.c2d.toFixed(2)}%`, subtitle: "Child Lead → Disbursal conversion", sections: [{ type: "kpi-row", title: "Period Comparison", kpis: [{ label: pL, value: `${stats.c2d.toFixed(2)}%` }, { label: cL, value: `${stats.lmtdC2d.toFixed(2)}%` }, { label: "Delta", value: `${(stats.c2d - stats.lmtdC2d).toFixed(2)}pp`, color: stats.c2d >= stats.lmtdC2d ? "text-emerald-600" : "text-red-600" }] }, { type: "bullets", title: "Analysis", bullets: ["Conversion from child lead creation to disbursal.", "Excludes pre-child stages (workable, BRE, MOS).", "Key metric for lender performance and process efficiency."] }] } })}>
                <QuickRatio label="Child to Disbursal" mtd={stats.c2d} lmtd={stats.lmtdC2d} />
              </ClickableKpiCard>
            )}
          </div>
        </div>

        {/* ═══ Lender-specific KPIs, Radar, Product Table ═══════════════ */}
        {isLenderFiltered && lenderKPIs && (
          <>
            <Separator />
            {/* Lender Disbursal KPIs */}
            <div id="lender-kpis" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <ClickableKpiCard onClick={() => setKpiDive({ open: true, config: { title: "Loans Disbursed", metric: lenderKPIs!.totalDisb.toLocaleString("en-IN"), subtitle: `${effectiveLender} — from ${lenderKPIs!.totalChild.toLocaleString("en-IN")} child leads`, sections: [{ type: "kpi-row", title: "Period Comparison", kpis: [{ label: pL, value: lenderKPIs!.totalDisb.toLocaleString("en-IN") }, { label: cL, value: Math.round(lenderKPIs!.totalDisb * LMTD_FACTOR).toLocaleString("en-IN"), sub: "est." }, { label: "Growth", value: `${lenderKPIs!.growth > 0 ? "+" : ""}${lenderKPIs!.growth.toFixed(1)}%`, color: lenderKPIs!.growth >= 0 ? "text-emerald-600" : "text-red-600" }] }, { type: "bullets", title: "Analysis", bullets: [`${effectiveLender} disbursed ${lenderKPIs!.totalDisb.toLocaleString("en-IN")} loans.`, `Amount: ₹${lenderKPIs!.amountCr.toFixed(1)} Cr at ~₹${AVG_ATS}L ATS.`, "Compare with other lenders in All Lenders view."] }, ...(byProduct.length > 0 ? [{ type: "chart" as const, title: "Product-wise Disbursals", chart: { type: "bar" as const, data: byProduct.map((p) => ({ name: p.product_type, value: p.disbursed })), label: "Loans", valueSuffix: "" } }] : [])] } })}>
                <KPICard title="Loans Disbursed" value={lenderKPIs!.totalDisb.toLocaleString("en-IN")}
                  subtitle={`from ${lenderKPIs!.totalChild.toLocaleString("en-IN")} child leads`}
                  delta={lenderKPIs!.growth} icon={<Hash className="h-5 w-5 text-violet-600" />}
                />
              </ClickableKpiCard>
              <ClickableKpiCard onClick={() => setKpiDive({ open: true, config: { title: `Amount (${pL})`, metric: `${lenderKPIs!.amountCr.toFixed(1)} Cr`, subtitle: `${effectiveLender} disbursal value`, sections: [{ type: "kpi-row", title: "Period Comparison", kpis: [{ label: pL, value: `${lenderKPIs!.amountCr.toFixed(1)} Cr` }, { label: cL, value: `${lenderKPIs!.lmtdAmountCr.toFixed(1)} Cr`, sub: "est." }, { label: "Growth", value: `${lenderKPIs!.amtGrowth > 0 ? "+" : ""}${lenderKPIs!.amtGrowth.toFixed(1)}%`, color: lenderKPIs!.amtGrowth >= 0 ? "text-emerald-600" : "text-red-600" }] }, { type: "bullets", title: "Analysis", bullets: [`Amount = Disbursed × ATS (~₹${AVG_ATS}L).`, lenderKPIs!.aop > 0 ? `AOP Target: ₹${lenderKPIs!.aop} Cr. Achievement: ${lenderKPIs!.achvPct.toFixed(1)}%.` : "No AOP set for this lender.", "Track monthly trends for pacing."] }] } })}>
                <KPICard title={`Amount (${pL})`} value={`${lenderKPIs!.amountCr.toFixed(1)} Cr`}
                  subtitle={`${cL}: ${lenderKPIs!.lmtdAmountCr.toFixed(1)} Cr`}
                  delta={lenderKPIs!.amtGrowth} icon={<Banknote className="h-5 w-5 text-emerald-600" />}
                />
              </ClickableKpiCard>
              <ClickableKpiCard onClick={() => setKpiDive({ open: true, config: { title: "Disbursal Conv%", metric: `${lenderKPIs!.convPct.toFixed(1)}%`, subtitle: "Child Lead → Disbursal", sections: [{ type: "kpi-row", title: "Conversion", kpis: [{ label: "Conv%", value: `${lenderKPIs!.convPct.toFixed(1)}%` }, { label: "Child Leads", value: lenderKPIs!.totalChild.toLocaleString("en-IN") }, { label: "Disbursed", value: lenderKPIs!.totalDisb.toLocaleString("en-IN") }] }, { type: "bullets", title: "Analysis", bullets: ["Conversion from child lead creation to disbursal.", "Higher conv% indicates better lender process and approval rates.", "Compare with Hero Funnel in radar chart."] }, ...(byProduct.length > 0 ? [{ type: "chart" as const, title: "Conv% by Product", chart: { type: "bar" as const, data: byProduct.map((p) => ({ name: p.product_type, value: p.conv })), label: "Conv%", valueSuffix: "%" } }] : [])] } })}>
                <KPICard title="Disbursal Conv%" value={`${lenderKPIs!.convPct.toFixed(1)}%`}
                  subtitle="Child Lead → Disbursal"
                  icon={<TrendingUp className="h-5 w-5 text-blue-600" />}
                />
              </ClickableKpiCard>
              <ClickableKpiCard onClick={() => setKpiDive({ open: true, config: { title: "AOP Target", metric: lenderKPIs!.aop > 0 ? `${lenderKPIs!.aop} Cr` : "N/A", subtitle: lenderKPIs!.aop > 0 ? `${lenderKPIs!.achvPct.toFixed(1)}% achieved` : "No AOP set", sections: [{ type: "kpi-row", title: "AOP Progress", kpis: [{ label: "Target", value: lenderKPIs!.aop > 0 ? `${lenderKPIs!.aop} Cr` : "N/A" }, { label: "Achieved", value: `${lenderKPIs!.amountCr.toFixed(1)} Cr` }, { label: "Progress", value: lenderKPIs!.aop > 0 ? `${lenderKPIs!.achvPct.toFixed(1)}%` : "-", color: lenderKPIs!.achvPct >= 80 ? "text-emerald-600" : lenderKPIs!.achvPct >= 50 ? "text-amber-600" : "text-red-600" }] }, { type: "bullets", title: "Analysis", bullets: lenderKPIs!.aop > 0 ? [`AOP = Annual Operating Plan target for ${effectiveLender}.`, `Current: ${lenderKPIs!.achvPct.toFixed(1)}% of target.`, lenderKPIs!.achvPct >= 80 ? "On track for target." : "Monitor pacing — consider volume or conversion improvements."] : ["No AOP target configured for this lender.", "Set targets in lender configuration to track progress."] }] } })}>
                <KPICard title="AOP Target" value={lenderKPIs!.aop > 0 ? `${lenderKPIs!.aop} Cr` : "N/A"}
                  subtitle={lenderKPIs!.aop > 0 ? `${lenderKPIs!.achvPct.toFixed(1)}% achieved` : "No AOP set"}
                  icon={<Target className="h-5 w-5 text-amber-600" />}
                />
              </ClickableKpiCard>
              <ClickableKpiCard onClick={() => lenderKpiConfigs.productTypes && setKpiDive({ open: true, config: lenderKpiConfigs.productTypes })}>
                <KPICard title="Product Types" value={`${byProduct.length}`}
                  subtitle={byProduct.map(p => p.product_type).join(", ")}
                  icon={<Users className="h-5 w-5 text-orange-600" />}
                />
              </ClickableKpiCard>
            </div>

            {lenderKPIs!.aop > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">AOP Progress:</span>
                <Progress value={Math.min(lenderKPIs!.achvPct, 100)} className="w-40 h-2" />
                <span className={cn(
                  "text-xs font-bold",
                  lenderKPIs!.achvPct >= 80 ? "text-emerald-600" : lenderKPIs!.achvPct >= 50 ? "text-amber-600" : "text-red-600"
                )}>{lenderKPIs!.achvPct.toFixed(0)}% of {lenderKPIs!.aop} Cr</span>
              </div>
            )}

            {/* Trend + Comparison */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <TrendChart
                title={`${effectiveLender} — Monthly Disbursals`}
                data={lenderTrends}
                dataKey="disbursed"
                type="bar"
                color="hsl(220, 70%, 55%)"
                valueFormatter={(v) => v.toLocaleString("en-IN")}
                height={260}
              />
              <Card className="overflow-hidden">
                <CardHeader className="pb-1 pt-4 px-5">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">All Lenders Comparison</CardTitle>
                </CardHeader>
                <CardContent className="p-0 pb-2 pr-2">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={lenderCompare} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 92%)" vertical={false} />
                      <XAxis dataKey="lender" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
                        tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toString()} width={45}
                      />
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <Tooltip formatter={(value: any) => [Number(value).toLocaleString("en-IN"), "Disbursed"]} />
                      <Bar dataKey="disbursed" radius={[4, 4, 0, 0]} barSize={28}>
                        {lenderCompare.map((entry, idx) => (
                          <Cell key={idx} fill={entry.isActive ? "hsl(220, 70%, 55%)" : "hsl(220, 20%, 80%)"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Radar + Product Table */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Stage Conversion: {effectiveLender} vs Hero Funnel</CardTitle>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Hero = best lender conv% per stage ({cL} basis)</p>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="stage" tick={{ fontSize: 8 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 8 }} />
                      <Radar name={effectiveLender} dataKey={effectiveLender} stroke="hsl(220, 70%, 55%)"
                        fill="hsl(220, 70%, 55%)" fillOpacity={0.3} strokeWidth={2} />
                      <Radar name="Hero Funnel" dataKey="Hero Funnel" stroke="hsl(45, 93%, 47%)"
                        fill="hsl(45, 93%, 47%)" fillOpacity={0.1} strokeWidth={1.5} strokeDasharray="4 4" />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ fontSize: 11 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{effectiveLender} — Product Type Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-[10px] font-semibold">Product</TableHead>
                        <TableHead className="text-[10px] font-semibold text-right">Loans</TableHead>
                        <TableHead className="text-[10px] font-semibold text-right">Amount (Cr)</TableHead>
                        <TableHead className="text-[10px] font-semibold text-right">Conv%</TableHead>
                        <TableHead className="text-[10px] font-semibold text-right">Growth</TableHead>
                        <TableHead className="text-[10px] font-semibold text-right">Share</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {byProduct.map((p) => (
                        <TableRow key={p.product_type}>
                          <TableCell className="text-xs font-medium">{p.product_type}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{p.disbursed.toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{p.amount_cr}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{p.conv}%</TableCell>
                          <TableCell className="text-right">
                            <span className={cn("text-[10px] font-semibold", p.growth > 0 ? "text-emerald-600" : p.growth < 0 ? "text-red-600" : "text-muted-foreground")}>
                              {p.growth > 0 ? "+" : ""}{p.growth}%
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums">
                            {lenderKPIs!.totalDisb > 0 ? ((p.disbursed / lenderKPIs!.totalDisb) * 100).toFixed(1) : 0}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </>
        )}


        {/* ═══ Spider Chart (always visible) ═══════════════════════════ */}
        {!isLenderFiltered && radarData.length > 0 && (
          <>
            <Separator />
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Stage Conversion: {pL} vs {cL}</CardTitle>
                  <ChartFeedbackButton chartTitle={`Stage Conversion: ${pL} vs ${cL}`} pageName="Funnel Summary" />
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Current period conversion% compared against comparison period at each funnel stage
                </p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={340}>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="stage" tick={{ fontSize: 8 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 8 }} />
                    <Radar name={`${pL} Conv%`} dataKey={`${pL} Conv%`} stroke="hsl(220, 70%, 55%)"
                      fill="hsl(220, 70%, 55%)" fillOpacity={0.3} strokeWidth={2} />
                    <Radar name={`${cL} Conv%`} dataKey={`${cL} Conv%`} stroke="hsl(45, 93%, 47%)"
                      fill="hsl(45, 93%, 47%)" fillOpacity={0.1} strokeWidth={1.5} strokeDasharray="4 4" />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ fontSize: 11 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </>
        )}

        {/* ═══ Funnel Drop-off Overview ═══════════════════════════════ */}
        <Separator />
        <div id="funnel-dropoff">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
              Funnel Drop-off &amp; Leakage Impact
            </h2>
            <ChartFeedbackButton chartTitle="Funnel Drop-off & Leakage Impact" pageName="Funnel Summary" />
          </div>
          <p className="text-[10px] text-muted-foreground mb-3">
            Where leads drop, whether issues are structural or temporary, global or lender-specific, and the estimated disbursal impact
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            {/* Drop-off chart */}
            <Card className="overflow-hidden lg:col-span-2">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Stage-wise Lead Count &amp; Drop-off
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 pb-2 pr-2">
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart data={dropoffData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 92%)" vertical={false} />
                    <XAxis dataKey="stage" tick={{ fontSize: 7 }} tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={45} />
                    <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} width={50}
                      tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toString()}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || payload.length === 0) return null;
                        const d = payload[0]?.payload;
                        if (!d) return null;
                        return (
                          <div className="rounded-lg border bg-card shadow-md px-3 py-2 text-xs">
                            <p className="font-semibold mb-1">{d.stage} <span className="text-muted-foreground font-normal">#{d.index}</span></p>
                            <p>Leads: <span className="font-bold">{d.leads.toLocaleString("en-IN")}</span></p>
                            {d.dropped > 0 && (
                              <>
                                <p className="text-red-600">Dropped: {d.dropped.toLocaleString("en-IN")} ({d.dropPct}%)</p>
                                <p className="text-emerald-600">Retained: {d.retainedPct}%</p>
                              </>
                            )}
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="leads" name="Leads" radius={[4, 4, 0, 0]} barSize={28}>
                      {dropoffData.map((entry, idx) => (
                        <Cell
                          key={idx}
                          fill={entry.dropPct > 30 ? "hsl(350, 65%, 55%)" : entry.dropPct > 15 ? "hsl(30, 80%, 55%)" : "hsl(220, 70%, 55%)"}
                          fillOpacity={0.7}
                        />
                      ))}
                    </Bar>
                    <Line type="monotone" dataKey="leads" stroke="hsl(220, 70%, 45%)" strokeWidth={2} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Leakage summary cards */}
            <div className="grid grid-cols-2 gap-3 content-start">
              <Card className="border-red-200/50">
                <CardContent className="p-3">
                  <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Leads Lost</p>
                  <p className="text-base font-bold tabular-nums text-red-600">{leakageImpact.totalLostLeads.toLocaleString("en-IN")}</p>
                </CardContent>
              </Card>
              <Card className="border-red-200/50">
                <CardContent className="p-3">
                  <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Est. Lost Loans</p>
                  <p className="text-base font-bold tabular-nums text-red-600">{leakageImpact.totalLostLoans.toLocaleString("en-IN")}</p>
                </CardContent>
              </Card>
              <Card className="border-red-200/50">
                <CardContent className="p-3">
                  <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Est. Lost Amount</p>
                  <p className="text-base font-bold tabular-nums text-red-600">{leakageImpact.totalLostAmountCr.toFixed(1)} Cr</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Actual Disbursed</p>
                  <p className="text-base font-bold tabular-nums text-emerald-600">{Math.round(stats.mtdD * pF).toLocaleString("en-IN")}</p>
                  <p className="text-[9px] text-muted-foreground">{((stats.mtdD * pF * AVG_ATS) / 100).toFixed(1)} Cr</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* ─── Unified Stage Health Table ─────────────────────────────── */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Stage Health: Drop-off, Diagnosis &amp; Impact</CardTitle>
                <ChartFeedbackButton chartTitle="Stage Health: Drop-off, Diagnosis & Impact" pageName="Funnel Summary" />
              </div>
              <p className="text-[10px] text-muted-foreground">
                One view combining where leads drop, whether it is structural or temporary, global or specific, and the disbursal impact
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-[10px] font-semibold min-w-[120px]">Stage</TableHead>
                      <TableHead className="text-[10px] font-semibold text-right">Drop%</TableHead>
                      <TableHead className="text-[10px] font-semibold text-right">{pL} Conv%</TableHead>
                      <TableHead className="text-[10px] font-semibold text-right">{cL} Conv%</TableHead>
                      <TableHead className="text-[10px] font-semibold text-right">Delta</TableHead>
                      <TableHead className="text-[10px] font-semibold text-center">Diagnosis</TableHead>
                      <TableHead className="text-[10px] font-semibold text-center">Scope</TableHead>
                      <TableHead className="text-[10px] font-semibold">Worst Lender / Program</TableHead>
                      <TableHead className="text-[10px] font-semibold text-right">Est. Lost (Cr)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {structuralAnalysis.map((sa, saIdx) => {
                      const gvs = globalVsSpecific.find((g) => g.index === sa.index);
                      const li = leakageImpact.stages.find((l) => l.index === sa.index);
                      const dd = dropoffData.find((d) => d.index === sa.index);

                      return (
                        <TableRow
                          key={sa.index}
                          className="hover:bg-muted/20 cursor-pointer transition-colors"
                          onClick={() => {
                            document.getElementById("funnel-drilldown")?.scrollIntoView({ behavior: "smooth", block: "start" });
                          }}
                          title="Click to scroll to Funnel Drill-down"
                        >
                          <TableCell className="text-xs font-medium py-2">
                            {sa.stage.length > 18 ? sa.stage.substring(0, 16) + ".." : sa.stage}
                            <span className="text-[9px] text-muted-foreground ml-1">#{sa.index}</span>
                          </TableCell>
                          <TableCell className="text-right py-2">
                            {dd && dd.dropPct > 0 ? (
                              <span className={cn(
                                "text-[11px] font-bold tabular-nums",
                                dd.dropPct > 30 ? "text-red-600" : dd.dropPct > 15 ? "text-amber-600" : "text-muted-foreground"
                              )}>
                                {dd.dropPct}%
                              </span>
                            ) : <span className="text-[10px] text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums font-medium">
                            {sa.mtdConv !== null ? `${sa.mtdConv}%` : "-"}
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums text-muted-foreground">
                            {sa.lmtdConv !== null ? `${sa.lmtdConv}%` : "-"}
                          </TableCell>
                          <TableCell className="text-right py-2">
                            {sa.delta !== null ? (
                              <span className={cn(
                                "text-[10px] font-bold",
                                sa.delta > 0 ? "text-emerald-600" : sa.delta < 0 ? "text-red-600" : "text-muted-foreground"
                              )}>
                                {sa.delta > 0 ? "+" : ""}{sa.delta.toFixed(1)}pp
                              </span>
                            ) : "-"}
                          </TableCell>
                          <TableCell className="text-center py-2">
                            <Badge variant="outline" className={cn(
                              "text-[8px] font-bold px-1.5",
                              sa.diagnosis === "structural" ? "bg-red-50 text-red-700 border-red-200" :
                              sa.diagnosis === "temporary_drop" ? "bg-amber-50 text-amber-700 border-amber-200" :
                              sa.diagnosis === "temporary_gain" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                              "bg-gray-50 text-gray-600 border-gray-200"
                            )}>
                              {sa.diagnosis === "structural" ? "Structural" :
                               sa.diagnosis === "temporary_drop" ? "Temp Drop" :
                               sa.diagnosis === "temporary_gain" ? "Temp Gain" : "Healthy"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center py-2">
                            {gvs ? (
                              <Badge variant="outline" className={cn(
                                "text-[8px] font-bold px-1.5",
                                gvs.isGlobal ? "bg-red-50 text-red-700 border-red-200" : "bg-blue-50 text-blue-700 border-blue-200"
                              )}>
                                {gvs.isGlobal ? `Global (${gvs.droppedCount}/${gvs.totalCount})` : `Specific`}
                              </Badge>
                            ) : "-"}
                          </TableCell>
                          <TableCell className="py-2">
                            <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                              {gvs?.worstLender && (
                                <span className="text-[10px]">
                                  <span className="font-semibold text-red-600">{gvs.worstLender}</span>
                                  <span className="text-muted-foreground ml-0.5">
                                    ({gvs.lenderDeltas.find((l) => l.name === gvs.worstLender)?.delta?.toFixed(1)}pp)
                                  </span>
                                </span>
                              )}
                              {gvs?.worstProduct && (
                                <span className="text-[10px]">
                                  <span className="font-semibold text-amber-700">{gvs.worstProduct}</span>
                                  <span className="text-muted-foreground ml-0.5">
                                    ({gvs.productDeltas.find((p) => p.name === gvs.worstProduct)?.delta?.toFixed(1)}pp)
                                  </span>
                                </span>
                              )}
                              {!gvs?.worstLender && !gvs?.worstProduct && (
                                <span className="text-[10px] text-muted-foreground">-</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right py-2">
                            {li ? (
                              <span className="text-[11px] font-bold tabular-nums text-red-600">
                                {li.estimatedLostAmountCr.toFixed(1)}
                              </span>
                            ) : <span className="text-[10px] text-muted-foreground">-</span>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><Badge variant="outline" className="text-[8px] px-1 bg-red-50 text-red-700 border-red-200">Structural</Badge> Consistently low both periods</span>
            <span className="flex items-center gap-1"><Badge variant="outline" className="text-[8px] px-1 bg-amber-50 text-amber-700 border-amber-200">Temp Drop</Badge> {pL} fell vs {cL}</span>
            <span className="flex items-center gap-1"><Badge variant="outline" className="text-[8px] px-1 bg-red-50 text-red-700 border-red-200">Global</Badge> &gt;60% lenders affected</span>
            <span className="flex items-center gap-1"><Badge variant="outline" className="text-[8px] px-1 bg-blue-50 text-blue-700 border-blue-200">Specific</Badge> Isolated to few lenders</span>
          </div>
        </div>

        <Separator />

        {/* ═══ Funnel Drill-down Table (L1/L2/L3) ═══════════════════════ */}
        <div id="funnel-drilldown">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Funnel Drill-down
            </h2>
            <ChartFeedbackButton chartTitle="Funnel Drill-down" pageName="Funnel Summary" />
          </div>
          <p className="text-[10px] text-muted-foreground mb-3">
            Click any stage to drill into sub-stages (L2) and failure reasons (L3)
          </p>
          <FunnelTable
            l2Data={l2Data}
            allL2Data={l2Data}
            funnelStages={funnelStages}
            selectedLender={effectiveLender}
            selectedProductType={effectiveProductType}
            selectedFlow={effectiveFlow}
          />
        </div>

        {/* Cross-Lender Conv% Comparison Table (only when not filtered to a single lender) */}
        {!isLenderFiltered && <Separator />}
        {!isLenderFiltered && <Card id="cross-lender">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium">
                  Cross-Lender Stage Conversion Comparison
                </CardTitle>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {pL} conv% per stage across all lenders. Hero (best) highlighted.
                </p>
              </div>
              <button
                className={cn(
                  "text-[10px] font-semibold px-3 py-1.5 rounded-md border transition-colors",
                  showFlowBreakdown
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                )}
                onClick={() => setShowFlowBreakdown(!showFlowBreakdown)}
              >
                {showFlowBreakdown ? "Hide Flow Breakdown" : "Show Flow Breakdown"}
              </button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-[10px] font-semibold sticky left-0 bg-muted/50 z-10 min-w-[100px]">
                      Lender
                    </TableHead>
                    {crossLenderData.stagePairs.map(({ curIdx, stageName }) => (
                      <TableHead
                        key={curIdx}
                        className="text-[10px] font-semibold text-center min-w-[90px]"
                      >
                        <div>{stageName.length > 14 ? stageName.substring(0, 12) + "..." : stageName}</div>
                        <div className="text-[8px] font-normal text-muted-foreground">#{curIdx}</div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {crossLenderData.lenders.map((lender) => (
                    <>
                      {/* All-flow row */}
                      <TableRow key={lender} className="hover:bg-muted/20">
                        <TableCell className="text-xs font-semibold sticky left-0 bg-card z-10">
                          {lender}
                        </TableCell>
                        {crossLenderData.stagePairs.map(({ curIdx }) => {
                          const conv = crossLenderData.lenderConv[lender]?.[curIdx];
                          const hero = crossLenderData.heroPerStage[curIdx];
                          const isHero = hero?.lender === lender;
                          return (
                            <TableCell key={curIdx} className="text-center py-2">
                              {conv !== null && conv !== undefined ? (
                                <span
                                  className={cn(
                                    "text-[11px] tabular-nums font-medium",
                                    isHero
                                      ? "inline-flex items-center gap-0.5 bg-amber-50 text-amber-700 font-bold rounded-full px-2 py-0.5"
                                      : conv >= (hero?.conv || 0) * 0.9
                                      ? "text-emerald-700"
                                      : conv < (hero?.conv || 0) * 0.7
                                      ? "text-red-600"
                                      : "text-foreground/80"
                                  )}
                                >
                                  {isHero && <Trophy className="h-2.5 w-2.5" />}
                                  {conv.toFixed(1)}%
                                </span>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>

                      {/* Flow breakdown rows */}
                      {showFlowBreakdown &&
                        crossLenderData.flows.map((flow) => {
                          const key = `${lender}||${flow}`;
                          const hasAnyData = crossLenderData.stagePairs.some(
                            ({ curIdx }) => crossLenderData.lenderFlowConv[key]?.[curIdx] != null
                          );
                          if (!hasAnyData) return null;
                          return (
                            <TableRow
                              key={`${lender}-${flow}`}
                              className="bg-muted/5 border-b border-dashed border-border/30"
                            >
                              <TableCell className="text-[10px] text-muted-foreground pl-6 sticky left-0 bg-card/95 z-10">
                                {flow.includes("Auto") ? "Flow1 (Auto)" : "Flow2 (Manual)"}
                              </TableCell>
                              {crossLenderData.stagePairs.map(({ curIdx }) => {
                                const conv =
                                  crossLenderData.lenderFlowConv[key]?.[curIdx];
                                return (
                                  <TableCell
                                    key={curIdx}
                                    className="text-center py-1.5"
                                  >
                                    {conv !== null && conv !== undefined ? (
                                      <span className="text-[10px] tabular-nums text-muted-foreground">
                                        {conv.toFixed(1)}%
                                      </span>
                                    ) : (
                                      <span className="text-[9px] text-muted-foreground/50">
                                        -
                                      </span>
                                    )}
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          );
                        })}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>}

        </>
        )}

        {/* ─── Theme 1-7: Funnel Enhancements ─────────────────────────────── */}
        <FunnelEnhancements
          stages={enhancementStages}
          lenderStageConv={lenderStageConvData}
          lenders={allLenders}
          periodLabel={pL}
          compareLabel={cL}
          daysElapsed={23}
          daysInMonth={28}
        />

        <KpiDeepDiveModal open={kpiDive.open} onClose={() => setKpiDive({ open: false, config: null })} config={kpiDive.config} />
      </div>

      {/* Command Palette (Cmd+K) */}
      <CommandPalette
        stages={funnelStages.map((s) => ({ index: s.index, name: s.stage }))}
        lenders={allLenders}
        onStageClick={(idx) => { setSelectedStageIndex(idx); setInsightsModalOpen(true); }}
        onNavigate={(path) => router.push(path)}
      />
    </div>
  );
}

// ─── Small components ───────────────────────────────────────────────────────

function QuickStat({
  label,
  mtd,
  lmtd,
  mock = false,
}: {
  label: string;
  mtd: number;
  lmtd: number;
  mock?: boolean;
}) {
  const { compareLabel: cL } = useDateRangeFactors();
  const growth = lmtd > 0 ? ((mtd - lmtd) / lmtd) * 100 : 0;
  return (
    <Card className={mock ? "border-dashed" : ""}>
      <CardContent className="p-3">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
          {label}
          {mock && <span className="text-[8px] ml-1 text-muted-foreground/50">(mock)</span>}
        </p>
        <p className="text-lg font-bold tabular-nums">
          {mtd.toLocaleString("en-IN")}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-muted-foreground">
            {cL}: {lmtd.toLocaleString("en-IN")}
          </span>
          <Badge
            variant="outline"
            className={`text-[10px] px-1 py-0 ${
              growth > 0
                ? "text-emerald-600 border-emerald-200"
                : growth < 0
                ? "text-red-600 border-red-200"
                : ""
            }`}
          >
            {growth > 0 ? "+" : ""}
            {growth.toFixed(1)}%
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickRatio({
  label,
  mtd,
  lmtd,
  suffix = "%",
  isPct = true,
}: {
  label: string;
  mtd: number;
  lmtd: number;
  suffix?: string;
  isPct?: boolean;
}) {
  const { compareLabel: cL } = useDateRangeFactors();
  const delta = mtd - lmtd;
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
          {label}
        </p>
        <p className="text-lg font-bold tabular-nums">
          {mtd.toFixed(2)}{suffix}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-muted-foreground">
            {cL}: {lmtd.toFixed(2)}{suffix}
          </span>
          <Badge
            variant="outline"
            className={`text-[10px] px-1 py-0 ${
              isPct
                ? delta > 0
                  ? "text-emerald-600 border-emerald-200"
                  : delta < 0
                  ? "text-red-600 border-red-200"
                  : ""
                : ""
            }`}
          >
            {delta > 0 ? "+" : ""}
            {delta.toFixed(2)} {isPct ? "pp" : ""}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
