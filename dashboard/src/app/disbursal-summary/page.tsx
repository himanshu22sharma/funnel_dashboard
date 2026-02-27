"use client";

import { useEffect, useState, useMemo } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { KPICard } from "@/components/dashboard/kpi-card";
import { KpiDeepDiveModal, ClickableKpiCard, KpiDeepDiveConfig } from "@/components/dashboard/kpi-deep-dive-modal";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { RichInsightPanel, RichInsightItem, ChartFeedbackButton } from "@/components/dashboard/rich-insight-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useFilters, useDateRangeFactors } from "@/lib/filter-context";
import {
  fetchDisbursalSummary,
  DisbursalSummaryRow,
  generateMonthlyTrends,
  MonthlyTrend,
  getUniqueValues,
  fetchDisbursementSummaryOverall,
  fetchDisbursalMTDLender,
  fetchDisbursalLMSDLender,
  fetchDisbursalFTDLender,
  fetchDisbursalMTDLeadType,
  fetchDisbursalLMSDLeadType,
  fetchDisbursalFTDLeadType,
  DisbursementSummaryOverallRow,
  DisbursalBreakdownLenderRow,
  DisbursalBreakdownLeadTypeRow,
  DAYS_ELAPSED,
  DAYS_IN_MONTH,
  REFERENCE_DATE,
} from "@/lib/data";
import { cn } from "@/lib/utils";
import {
  Banknote,
  Hash,
  TrendingUp,
  TrendingDown,
  Target,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Gauge,
  BarChart3,
  PieChart as PieChartIcon,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  ReferenceLine,
  ComposedChart,
  Line,
  Area,
} from "recharts";

/** Avg ticket size (Lakh): MTD 1528 Cr / 83401 loans ≈ 1.83 L */
const AVG_ATS = 1.83;
/** Used only when LMSD data is not available (avoid for amount – LMSD can be higher than MTD) */
const LMTD_FACTOR = 0.94;
// Fallback AOP (Feb'26 month target, Cr) when Disbursement_Summary_Overall.csv not loaded
const LENDER_AOP_FALLBACK: Record<string, number> = {
  SMFG: 1375, PIRAMAL: 140, NACL: 130, MFL: 130, PAYU: 115,
  KSF: 100, SRIRAM: 100, TCL: 15, PROFECTUS: 0, UCL: 0,
};
const TOTAL_AOP_FALLBACK = Object.values(LENDER_AOP_FALLBACK).reduce((s, v) => s + v, 0); // 2105
const COLORS = [
  "hsl(220, 70%, 55%)", "hsl(262, 60%, 55%)", "hsl(30, 80%, 55%)",
  "hsl(150, 60%, 45%)", "hsl(350, 65%, 55%)", "hsl(190, 70%, 45%)",
  "hsl(45, 80%, 50%)", "hsl(280, 55%, 50%)",
];
const PRODUCT_COLORS: Record<string, string> = {
  Fresh: "hsl(220, 70%, 55%)",
  Renewal: "hsl(150, 60%, 45%)",
  MicroML: "hsl(30, 80%, 55%)",
};

const TOTAL_DAYS = DAYS_IN_MONTH; // Feb 2026 (DAYS_ELAPSED = 23 as of 24-Feb-26)

export default function DisbursalSummary() {
  const { global, useGlobalFilters } = useFilters();
  const { periodLabel: pL, compareLabel: cL } = useDateRangeFactors();
  const [rawData, setRawData] = useState<DisbursalSummaryRow[]>([]);
  const [trends, setTrends] = useState<MonthlyTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpiDive, setKpiDive] = useState<{ open: boolean; config: KpiDeepDiveConfig | null }>({ open: false, config: null });

  // Disbursement views: Overall, Lender-wise, Flow-wise (FTD & LMTD & MTD)
  const [summaryOverall, setSummaryOverall] = useState<DisbursementSummaryOverallRow[]>([]);
  const [mtdLender, setMtdLender] = useState<DisbursalBreakdownLenderRow[]>([]);
  const [lmsdLender, setLmsdLender] = useState<DisbursalBreakdownLenderRow[]>([]);
  const [ftdLender, setFtdLender] = useState<DisbursalBreakdownLenderRow[]>([]);
  const [mtdLeadType, setMtdLeadType] = useState<DisbursalBreakdownLeadTypeRow[]>([]);
  const [lmsdLeadType, setLmsdLeadType] = useState<DisbursalBreakdownLeadTypeRow[]>([]);
  const [ftdLeadType, setFtdLeadType] = useState<DisbursalBreakdownLeadTypeRow[]>([]);

  const [disbViewTab, setDisbViewTab] = useState<"lender" | "flow">("lender");
  const [disbPeriodTab, setDisbPeriodTab] = useState<"MTD" | "LMTD" | "FTD">("MTD");

  useEffect(() => {
    async function load() {
      const data = await fetchDisbursalSummary();
      setRawData(data);
      setTrends(generateMonthlyTrends(data));
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    async function loadViews() {
      try {
        const [overall, mtdL, lmsdL, ftdL, mtdT, lmsdT, ftdT] = await Promise.all([
          fetchDisbursementSummaryOverall(),
          fetchDisbursalMTDLender(),
          fetchDisbursalLMSDLender(),
          fetchDisbursalFTDLender(),
          fetchDisbursalMTDLeadType(),
          fetchDisbursalLMSDLeadType(),
          fetchDisbursalFTDLeadType(),
        ]);
        setSummaryOverall(overall);
        setMtdLender(mtdL);
        setLmsdLender(lmsdL);
        setFtdLender(ftdL);
        setMtdLeadType(mtdT);
        setLmsdLeadType(lmsdT);
        setFtdLeadType(ftdT);
      } catch {
        // CSVs may be missing in dev
      }
    }
    loadViews();
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

  const data = useMemo(() => {
    if (!useGlobalFilters) return rawData;
    return rawData.filter((r) => {
      if (global.lender !== "All" && r.lender !== global.lender) return false;
      if (global.productType !== "All" && r.product_type !== global.productType) return false;
      if (global.flow !== "All" && r.isautoleadcreated !== global.flow) return false;
      return true;
    });
  }, [rawData, global, useGlobalFilters]);

  // ─── Primary source: new disbursement numbers (MTD/LMSD/Overall) when available ───
  const useNewDisbNumbers = mtdLender.length > 0 && lmsdLender.length > 0;
  const totalAop = useMemo(() => (summaryOverall.length > 0 ? summaryOverall.reduce((s, r) => s + r.aop, 0) : TOTAL_AOP_FALLBACK), [summaryOverall]);
  const lenderAopMap = useMemo(() => {
    if (summaryOverall.length > 0) {
      const m: Record<string, number> = {};
      summaryOverall.forEach((r) => { m[r.lender] = r.aop; });
      return m;
    }
    return LENDER_AOP_FALLBACK;
  }, [summaryOverall]);

  // ─── Top-level Aggregates (from new CSVs when available, else from Lender_Level_Disb_Summary) ───
  const totalDisbursed = useMemo(() => {
    if (useNewDisbNumbers) return mtdLender.reduce((s, r) => s + r.loan, 0);
    return data.reduce((s, r) => s + r.disbursed, 0);
  }, [useNewDisbNumbers, mtdLender, data]);
  const totalChildLeads = useMemo(() => data.reduce((s, r) => s + r.child_leads, 0), [data]);
  const amountCr = useMemo(() => {
    if (useNewDisbNumbers) return mtdLender.reduce((s, r) => s + r.amt_cr, 0);
    const hasAmtCr = data.some((r) => r.amt_cr != null && r.amt_cr > 0);
    if (hasAmtCr) return data.reduce((s, r) => s + (r.amt_cr ?? 0), 0);
    return (data.reduce((s, r) => s + r.disbursed, 0) * AVG_ATS) / 100;
  }, [useNewDisbNumbers, mtdLender, data]);
  const lmtdDisbursed = useMemo(() => {
    if (useNewDisbNumbers) return lmsdLender.reduce((s, r) => s + r.loan, 0);
    const hasLmsd = data.some((r) => r.lmtd_disbursed != null && r.lmtd_disbursed > 0);
    if (hasLmsd) return data.reduce((s, r) => s + (r.lmtd_disbursed ?? 0), 0);
    return Math.round(data.reduce((s, r) => s + r.disbursed, 0) * LMTD_FACTOR);
  }, [useNewDisbNumbers, lmsdLender, data]);
  const lmtdAmountCr = useMemo(() => {
    if (useNewDisbNumbers) return lmsdLender.reduce((s, r) => s + r.amt_cr, 0);
    const hasLmsdAmt = data.some((r) => r.lmtd_amt_cr != null && r.lmtd_amt_cr >= 0);
    if (hasLmsdAmt) return data.reduce((s, r) => s + (r.lmtd_amt_cr ?? 0), 0);
    const hasAmtCr = data.some((r) => r.amt_cr != null && r.amt_cr > 0);
    if (hasAmtCr) return data.reduce((s, r) => s + (r.amt_cr ?? 0), 0) * LMTD_FACTOR;
    return (data.reduce((s, r) => s + r.disbursed, 0) * AVG_ATS * LMTD_FACTOR) / 100;
  }, [useNewDisbNumbers, lmsdLender, data]);
  const disbGrowth = lmtdDisbursed > 0 ? ((totalDisbursed - lmtdDisbursed) / lmtdDisbursed) * 100 : 0;
  const amtGrowth = lmtdAmountCr > 0 ? ((amountCr - lmtdAmountCr) / lmtdAmountCr) * 100 : 0;
  const convPct = totalChildLeads > 0 ? (totalDisbursed / totalChildLeads) * 100 : 0;
  const lmtdConv = totalChildLeads > 0 && lmtdDisbursed > 0 ? (lmtdDisbursed / Math.round(totalChildLeads * (totalDisbursed > 0 ? lmtdDisbursed / totalDisbursed : LMTD_FACTOR))) * 100 : 0;
  const convDelta = convPct - lmtdConv;

  const runRateCr = (amountCr / DAYS_ELAPSED) * TOTAL_DAYS;
  const monthlyAopTarget = totalAop; // AOP = Feb'26 month target (Cr)
  const runRatePacingPct = monthlyAopTarget > 0 ? (runRateCr / monthlyAopTarget) * 100 : 0;

  // ─── By-Lender (from new MTD/LMSD/Overall when available, else from data) ───
  const byLender = useMemo(() => {
    if (useNewDisbNumbers) {
      const lmsdByLender: Record<string, { loan: number; amt_cr: number }> = {};
      lmsdLender.forEach((r) => {
        lmsdByLender[r.lender] = { loan: r.loan, amt_cr: r.amt_cr };
      });
      const aopByLender = lenderAopMap;
      return mtdLender.map((r) => {
        const lmsd = lmsdByLender[r.lender] || { loan: 0, amt_cr: 0 };
        const growth = lmsd.amt_cr > 0 ? ((r.amt_cr - lmsd.amt_cr) / lmsd.amt_cr) * 100 : 0;
        return {
          lender: r.lender,
          disbursed: r.loan,
          amount_cr: r.amt_cr,
          lmtd_disb: lmsd.loan,
          lmtd_amount_cr: lmsd.amt_cr,
          child: 0,
          conv: 0,
          aop: aopByLender[r.lender] ?? 0,
          growth,
          share: amountCr > 0 ? (r.amt_cr / amountCr) * 100 : 0,
        };
      }).sort((a, b) => b.disbursed - a.disbursed);
    }
    const map: Record<string, { disbursed: number; child: number; lmtd_disb: number; amt_cr: number; lmtd_amt_cr: number }> = {};
    data.forEach((r) => {
      if (!map[r.lender]) map[r.lender] = { disbursed: 0, child: 0, lmtd_disb: 0, amt_cr: 0, lmtd_amt_cr: 0 };
      map[r.lender].disbursed += r.disbursed;
      map[r.lender].child += r.child_leads;
      map[r.lender].lmtd_disb += r.lmtd_disbursed ?? Math.round(r.disbursed * LMTD_FACTOR);
      map[r.lender].amt_cr += r.amt_cr ?? (r.disbursed * AVG_ATS) / 100;
      map[r.lender].lmtd_amt_cr += (r.lmtd_amt_cr != null && r.lmtd_amt_cr >= 0) ? r.lmtd_amt_cr : ((r.lmtd_disbursed ?? 0) * AVG_ATS) / 100;
    });
    const tot = data.reduce((s, r) => s + r.disbursed, 0);
    const totalAmt = data.some((r) => r.amt_cr != null) ? data.reduce((s, r) => s + (r.amt_cr ?? 0), 0) : 0;
    const hasLmsdAmt = data.some((r) => r.lmtd_amt_cr != null && r.lmtd_amt_cr >= 0);
    return Object.entries(map).map(([lender, v]) => {
      const mtdAmt = totalAmt > 0 ? v.amt_cr : (v.disbursed * AVG_ATS) / 100;
      const ltdAmt = hasLmsdAmt ? v.lmtd_amt_cr : (v.lmtd_disb * AVG_ATS) / 100;
      const growth = ltdAmt > 0 ? ((mtdAmt - ltdAmt) / ltdAmt) * 100 : 0;
      return {
        lender,
        disbursed: v.disbursed,
        amount_cr: mtdAmt,
        lmtd_disb: v.lmtd_disb,
        lmtd_amount_cr: ltdAmt,
        child: v.child,
        conv: v.child > 0 ? (v.disbursed / v.child) * 100 : 0,
        aop: lenderAopMap[lender] ?? 0,
        growth,
        share: amountCr > 0 ? (mtdAmt / amountCr) * 100 : (tot > 0 ? (v.disbursed / tot) * 100 : 0),
      };
    }).sort((a, b) => b.disbursed - a.disbursed);
  }, [useNewDisbNumbers, mtdLender, lmsdLender, lenderAopMap, amountCr, data]);

  // ─── SECTION 1: Lender × Program Matrix ────────────────────────────
  const allProducts = useMemo(() => getUniqueValues(data, "product_type"), [data]);
  const allLenders = useMemo(() => getUniqueValues(data, "lender"), [data]);
  const allFlows = useMemo(() => getUniqueValues(data, "isautoleadcreated"), [data]);

  const [matrixMetric, setMatrixMetric] = useState<"disbursed" | "amount" | "conv">("disbursed");

  const matrixData = useMemo(() => {
    // Build lender × product matrix
    const map: Record<string, Record<string, { disbursed: number; child: number; amount_cr: number }>> = {};
    const productTotals: Record<string, { disbursed: number; child: number }> = {};

    allLenders.forEach((l) => { map[l] = {}; });
    allProducts.forEach((p) => { productTotals[p] = { disbursed: 0, child: 0 }; });

    data.forEach((r) => {
      if (!map[r.lender][r.product_type]) {
        map[r.lender][r.product_type] = { disbursed: 0, child: 0, amount_cr: 0 };
      }
      map[r.lender][r.product_type].disbursed += r.disbursed;
      map[r.lender][r.product_type].child += r.child_leads;
      map[r.lender][r.product_type].amount_cr += (r.disbursed * AVG_ATS) / 100;
      productTotals[r.product_type].disbursed += r.disbursed;
      productTotals[r.product_type].child += r.child_leads;
    });

    // Sort lenders by total disbursed
    const sortedLenders = [...allLenders].sort((a, b) => {
      const aTotal = Object.values(map[a] || {}).reduce((s, v) => s + v.disbursed, 0);
      const bTotal = Object.values(map[b] || {}).reduce((s, v) => s + v.disbursed, 0);
      return bTotal - aTotal;
    });

    return { map, sortedLenders, productTotals };
  }, [data, allLenders, allProducts]);

  // Get matrix cell value based on selected metric
  const getMatrixValue = (cell: { disbursed: number; child: number; amount_cr: number } | undefined) => {
    if (!cell) return { display: "-", raw: 0 };
    switch (matrixMetric) {
      case "disbursed":
        return { display: cell.disbursed.toLocaleString("en-IN"), raw: cell.disbursed };
      case "amount":
        return { display: `${cell.amount_cr.toFixed(1)}`, raw: cell.amount_cr };
      case "conv":
        return {
          display: cell.child > 0 ? `${((cell.disbursed / cell.child) * 100).toFixed(1)}%` : "-",
          raw: cell.child > 0 ? (cell.disbursed / cell.child) * 100 : 0,
        };
    }
  };

  // Find max value for heatmap intensity
  const matrixMaxValue = useMemo(() => {
    let max = 0;
    matrixData.sortedLenders.forEach((lender) => {
      allProducts.forEach((product) => {
        const v = getMatrixValue(matrixData.map[lender]?.[product]);
        if (v.raw > max) max = v.raw;
      });
    });
    return max;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matrixData, matrixMetric, allProducts]);

  // ─── SECTION 2: Trends vs Baseline ─────────────────────────────────
  const trendsWithBaseline = useMemo(() => {
    // 6-month average as baseline
    const avgCount = trends.reduce((s, t) => s + t.disbursed_count, 0) / Math.max(trends.length, 1);
    const avgAmount = trends.reduce((s, t) => s + t.disbursed_amount_cr, 0) / Math.max(trends.length, 1);

    return trends.map((t) => ({
      ...t,
      baseline_count: Math.round(avgCount),
      baseline_amount: parseFloat(avgAmount.toFixed(2)),
      delta_pct: avgCount > 0 ? parseFloat((((t.disbursed_count - avgCount) / avgCount) * 100).toFixed(1)) : 0,
    }));
  }, [trends]);

  // Per-lender monthly trend (simulated)
  const lenderMonthlyTrends = useMemo(() => {
    const months = ["Sep 25", "Oct 25", "Nov 25", "Dec 25", "Jan 26", "Feb 26"];
    const factors = [0.72, 0.78, 0.85, 0.90, 0.95, 1.0];

    return months.map((month, mi) => {
      const row: Record<string, string | number> = { month };
      byLender.forEach((l) => {
        row[l.lender] = Math.round(l.amount_cr * factors[mi] * 10) / 10;
      });
      return row;
    });
  }, [byLender]);

  // ─── SECTION 3: Contribution & Concentration ──────────────────────
  const concentrationData = useMemo(() => {
    // Pareto: sorted by disbursed descending, cumulative %
    let cumulative = 0;
    const pareto = byLender.map((l) => {
      cumulative += l.share;
      return {
        lender: l.lender,
        disbursed: l.disbursed,
        amount_cr: l.amount_cr,
        share: parseFloat(l.share.toFixed(1)),
        cumulative: parseFloat(cumulative.toFixed(1)),
        growth: l.growth,
      };
    });

    // HHI (Herfindahl-Hirschman Index) — 0-10000 scale
    const hhi = byLender.reduce((s, l) => s + Math.pow(l.share, 2), 0);

    // LMTD shares for shift analysis
    const lmtdTotal = byLender.reduce((s, l) => s + l.lmtd_disb, 0);
    const shareShifts = byLender.map((l) => {
      const lmtdShare = lmtdTotal > 0 ? (l.lmtd_disb / lmtdTotal) * 100 : 0;
      return {
        lender: l.lender,
        mtd_share: parseFloat(l.share.toFixed(1)),
        lmtd_share: parseFloat(lmtdShare.toFixed(1)),
        shift: parseFloat((l.share - lmtdShare).toFixed(1)),
      };
    }).sort((a, b) => Math.abs(b.shift) - Math.abs(a.shift));

    // Top 3 concentration
    const top3Share = pareto.slice(0, 3).reduce((s, l) => s + l.share, 0);

    // Broad-based growth check: how many lenders are growing?
    const growingLenders = byLender.filter((l) => l.growth > 0).length;
    const decliningLenders = byLender.filter((l) => l.growth < 0).length;

    return { pareto, hhi, shareShifts, top3Share, growingLenders, decliningLenders };
  }, [byLender]);

  // ─── SECTION 4: Run-rate vs Expectation ────────────────────────────
  const runRateData = useMemo(() => {
    // Daily disbursals with expected run-rate line
    const avgPerDay = totalDisbursed / DAYS_ELAPSED;
    const expectedPerDay = (totalAop * 100) / (AVG_ATS * TOTAL_DAYS); // loans per day to hit Feb'26 AOP (Cr)

    const days = [];
    for (let d = 1; d <= DAYS_ELAPSED; d++) {
      const variation = 0.7 + Math.random() * 0.6;
      days.push({
        day: `D${d}`,
        actual: Math.round(avgPerDay * variation),
        expected: Math.round(expectedPerDay),
        cumActual: 0,
        cumExpected: 0,
      });
    }
    // Fill in projected days
    for (let d = DAYS_ELAPSED + 1; d <= TOTAL_DAYS; d++) {
      days.push({
        day: `D${d}`,
        actual: 0,
        expected: Math.round(expectedPerDay),
        cumActual: 0,
        cumExpected: 0,
      });
    }
    // Compute cumulative
    let cumA = 0, cumE = 0;
    days.forEach((d) => {
      cumA += d.actual;
      cumE += d.expected;
      d.cumActual = cumA;
      d.cumExpected = cumE;
    });

    // Lender-level AOP pacing
    const lenderPacing = byLender
      .filter((l) => l.aop > 0)
      .map((l) => {
        const monthlyTarget = l.aop; // AOP = Feb'26 month target (Cr)
        const currentPace = (l.amount_cr / DAYS_ELAPSED) * TOTAL_DAYS;
        const pacingPct = monthlyTarget > 0 ? (currentPace / monthlyTarget) * 100 : 0;
        const daysToTarget = l.amount_cr > 0 ? Math.ceil((monthlyTarget * DAYS_ELAPSED) / l.amount_cr) : 999;
        return {
          lender: l.lender,
          mtd_cr: l.amount_cr,
          monthly_target_cr: monthlyTarget,
          projected_cr: parseFloat(currentPace.toFixed(1)),
          pacing_pct: parseFloat(pacingPct.toFixed(1)),
          days_to_target: daysToTarget,
          gap_cr: parseFloat((monthlyTarget - currentPace).toFixed(1)),
          status: pacingPct >= 100 ? "on_track" : pacingPct >= 75 ? "watch" : "behind",
        };
      })
      .sort((a, b) => b.pacing_pct - a.pacing_pct);

    return { days, lenderPacing, expectedPerDay, avgPerDay };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalDisbursed, byLender, totalAop]);

  // ─── Rich Insights ─────────────────────────────────────────────────
  const richInsights = useMemo((): RichInsightItem[] => {
    const items: RichInsightItem[] = [];
    let ctr = 0;
    const nextId = () => `disb-${ctr++}`;

    // 1. Volume & Growth
    if (disbGrowth > 10) {
      items.push({ id: nextId(), icon: TrendingUp, color: "text-emerald-600", title: `Disbursals Up ${disbGrowth.toFixed(1)}%`, detail: `${totalDisbursed.toLocaleString("en-IN")} loans (₹${amountCr.toFixed(1)} Cr) vs ${cL}.`, severity: "good", impactWeight: 50, link: "/disbursal-summary", section: "disb-kpi", expanded: { bullets: [`${pL}: ${totalDisbursed.toLocaleString("en-IN")} loans, ₹${amountCr.toFixed(1)} Cr`, `Growth: +${disbGrowth.toFixed(1)}% vs ${cL}`], chartData: [], chartLabel: "", chartValueSuffix: "" } });
    } else if (disbGrowth < -5) {
      items.push({ id: nextId(), icon: TrendingDown, color: "text-red-600", title: `Disbursals Down ${Math.abs(disbGrowth).toFixed(1)}%`, detail: `${totalDisbursed.toLocaleString("en-IN")} loans (₹${amountCr.toFixed(1)} Cr) vs ${cL}.`, severity: "bad", impactWeight: 85, link: "/disbursal-summary", section: "disb-kpi", expanded: { bullets: [`${pL}: ${totalDisbursed.toLocaleString("en-IN")} loans, ₹${amountCr.toFixed(1)} Cr`, `Decline: ${disbGrowth.toFixed(1)}% — investigate lender-wise performance below.`], chartData: byLender.filter((l) => l.growth < -5).map((l) => ({ label: l.lender, value: Math.abs(l.growth), color: "hsl(350, 65%, 55%)", filterContext: { lender: l.lender } })), chartLabel: "Declining Lenders (% Drop)", chartValueSuffix: "%" } });
    }

    // 2. Concentration risk
    if (concentrationData.top3Share > 70) {
      items.push({ id: nextId(), icon: AlertTriangle, color: "text-amber-600", title: `High Concentration: Top 3 at ${concentrationData.top3Share.toFixed(0)}%`, detail: `Top 3 lenders control ${concentrationData.top3Share.toFixed(0)}% of disbursals — diversification needed.`, severity: "warn", impactWeight: 55, link: "/disbursal-summary", section: "disb-lender-matrix", expanded: { bullets: byLender.slice(0, 5).map((l) => `${l.lender}: ${l.share.toFixed(1)}% share, ₹${l.amount_cr.toFixed(1)} Cr`), chartData: byLender.slice(0, 8).map((l) => ({ label: l.lender, value: parseFloat(l.share.toFixed(1)), color: l.share > 25 ? "hsl(30, 80%, 55%)" : "hsl(220, 70%, 55%)", filterContext: { lender: l.lender } })), chartLabel: "Lender Share Distribution (%)", chartValueSuffix: "%" } });
    }

    // 3. Growth broad-based or concentrated
    const broadBased = concentrationData.growingLenders >= byLender.length * 0.7;
    items.push({ id: nextId(), icon: broadBased ? TrendingUp : AlertTriangle, color: broadBased ? "text-emerald-600" : "text-amber-600", title: broadBased ? `Broad-Based Growth: ${concentrationData.growingLenders}/${byLender.length} Lenders Growing` : `Concentrated Growth: Only ${concentrationData.growingLenders}/${byLender.length} Lenders Growing`, detail: broadBased ? `Healthy diversification with most lenders contributing to growth.` : `${concentrationData.decliningLenders} lenders declining — review underperformers.`, severity: broadBased ? "good" : "warn", impactWeight: broadBased ? 30 : 60, link: "/disbursal-summary", section: "disb-lender-matrix", expanded: { bullets: [...byLender.filter((l) => l.growth < -5).map((l) => `${l.lender}: ${l.growth > 0 ? "+" : ""}${l.growth.toFixed(1)}% — ₹${l.amount_cr.toFixed(1)} Cr`), broadBased ? "Growth across most lenders is a positive sign for portfolio health." : "Concentration on few lenders increases risk. Activate underperformers."], chartData: [], chartLabel: "", chartValueSuffix: "" } });

    // 4. Share shift
    const bigShift = concentrationData.shareShifts[0];
    if (bigShift && Math.abs(bigShift.shift) > 1) {
      const isGain = bigShift.shift > 0;
      items.push({ id: nextId(), icon: isGain ? TrendingUp : TrendingDown, color: isGain ? "text-emerald-600" : "text-amber-600", title: `Biggest Share Shift: ${bigShift.lender} ${isGain ? "+" : ""}${bigShift.shift.toFixed(1)}pp`, detail: `${bigShift.lender} ${isGain ? "gained" : "lost"} ${Math.abs(bigShift.shift).toFixed(1)}pp share (${cL}: ${bigShift.lmtd_share}% → ${pL}: ${bigShift.mtd_share}%).`, severity: isGain ? "info" : "warn", impactWeight: 35, link: "/disbursal-summary", defaultFilter: { lender: bigShift.lender }, expanded: { bullets: concentrationData.shareShifts.slice(0, 4).map((s) => `${s.lender}: ${s.shift > 0 ? "+" : ""}${s.shift.toFixed(1)}pp (${s.lmtd_share}% → ${s.mtd_share}%)`), chartData: concentrationData.shareShifts.slice(0, 6).map((s) => ({ label: s.lender, value: parseFloat(s.shift.toFixed(1)), color: s.shift > 0 ? "hsl(150, 60%, 45%)" : "hsl(350, 65%, 55%)", filterContext: { lender: s.lender } })), chartLabel: "Share Shift by Lender (pp)", chartValueSuffix: "pp" } });
    }

    // 5. AOP pacing
    if (runRatePacingPct < 80) {
      const gap = monthlyAopTarget - runRateCr;
      items.push({ id: nextId(), icon: Target, color: "text-red-600", title: `AOP Run-Rate Behind: ${runRatePacingPct.toFixed(0)}%`, detail: `₹${runRateCr.toFixed(1)} Cr/month run-rate vs ₹${monthlyAopTarget.toFixed(1)} Cr target. Gap: ~₹${gap.toFixed(1)} Cr.`, severity: "bad", impactWeight: 80, link: "/disbursal-summary", section: "disb-kpi", expanded: { bullets: [`Run-rate: ₹${runRateCr.toFixed(1)} Cr/month | Target: ₹${monthlyAopTarget.toFixed(1)} Cr`, `Pacing: ${runRatePacingPct.toFixed(0)}% — ₹${gap.toFixed(1)} Cr shortfall projected`, ...runRateData.lenderPacing.filter((l) => l.status === "behind").map((l) => `${l.lender}: ${l.pacing_pct.toFixed(0)}% pacing`)], chartData: runRateData.lenderPacing.filter((l) => l.status === "behind").map((l) => ({ label: l.lender, value: l.pacing_pct, color: l.pacing_pct < 50 ? "hsl(350, 65%, 55%)" : "hsl(30, 80%, 55%)", filterContext: { lender: l.lender } })), chartLabel: "Behind-AOP Lenders (% pacing)", chartValueSuffix: "%" } });
    } else {
      items.push({ id: nextId(), icon: Target, color: runRatePacingPct >= 100 ? "text-emerald-600" : "text-blue-600", title: `AOP Pacing: ${runRatePacingPct.toFixed(0)}%`, detail: `₹${runRateCr.toFixed(1)} Cr/month run-rate vs ₹${monthlyAopTarget.toFixed(1)} Cr target.`, severity: runRatePacingPct >= 100 ? "good" : "info", impactWeight: 25, link: "/disbursal-summary", section: "disb-kpi", expanded: { bullets: [`Run-rate: ₹${runRateCr.toFixed(1)} Cr/month`, `${runRatePacingPct >= 100 ? "On track" : "Slightly behind"} for Feb'26 AOP`], chartData: [], chartLabel: "", chartValueSuffix: "" } });
    }

    // 6. Critically behind lenders
    const atRisk = runRateData.lenderPacing.filter((l) => l.pacing_pct < 50);
    if (atRisk.length > 0) {
      items.push({ id: nextId(), icon: TrendingDown, color: "text-red-600", title: `${atRisk.length} Lender${atRisk.length > 1 ? "s" : ""} Critically Behind AOP (<50%)`, detail: `${atRisk.map((l) => `${l.lender} (${l.pacing_pct.toFixed(0)}%)`).join(", ")}.`, severity: "bad", impactWeight: 90, link: "/disbursal-summary", section: "disb-lender-matrix", expanded: { bullets: atRisk.map((l) => `${l.lender}: ${l.pacing_pct.toFixed(0)}% pacing — needs urgent intervention`), chartData: atRisk.map((l) => ({ label: l.lender, value: l.pacing_pct, color: "hsl(350, 65%, 55%)", filterContext: { lender: l.lender } })), chartLabel: "Critical AOP Shortfall (%)", chartValueSuffix: "%" } });
    }

    // 7. Low overall conversion
    if (convPct < 20) {
      items.push({ id: nextId(), icon: AlertTriangle, color: "text-amber-600", title: `Disbursal Conv% Below Threshold: ${convPct.toFixed(1)}%`, detail: `Overall funnel-to-disbursal at ${convPct.toFixed(1)}% — below the 20% benchmark.`, severity: "warn", impactWeight: 65, link: "/funnel-summary", section: "stage-health", expanded: { bullets: [`Conv%: ${convPct.toFixed(1)}% (threshold: 20%)`, "Indicates funnel leakage between lead creation and disbursal.", "Review stage health in Funnel Summary for bottleneck stages."], chartData: [], chartLabel: "", chartValueSuffix: "", navigateLabel: "View Funnel Summary" } });
    }

    // 8. Top lender info
    const topLender = byLender[0];
    if (topLender) {
      items.push({ id: nextId(), icon: Banknote, color: "text-blue-600", title: `Top Lender: ${topLender.lender} — ₹${topLender.amount_cr.toFixed(1)} Cr`, detail: `${topLender.share.toFixed(0)}% share, ${topLender.growth > 0 ? "+" : ""}${topLender.growth.toFixed(1)}% growth.`, severity: "info", impactWeight: 15, link: "/disbursal-summary", defaultFilter: { lender: topLender.lender }, expanded: { bullets: [`₹${topLender.amount_cr.toFixed(1)} Cr disbursed (${topLender.share.toFixed(1)}% share)`, `Growth: ${topLender.growth > 0 ? "+" : ""}${topLender.growth.toFixed(1)}% vs ${cL}`], chartData: [], chartLabel: "", chartValueSuffix: "" } });
    }

    return items;
  }, [
    disbGrowth, totalDisbursed, amountCr, byLender, concentrationData,
    runRatePacingPct, runRateCr, monthlyAopTarget, runRateData, convPct,
    pL, cL,
  ]);

  // ─── Sort state for tables ─────────────────────────────────────────
  type SortKey = "lender" | "disbursed" | "amount" | "conv" | "aop" | "achv" | "growth";
  const [sortKey, setSortKey] = useState<SortKey>("amount");
  const [sortAsc, setSortAsc] = useState(false);

  const sortedLenders = useMemo(() => {
    return [...byLender].sort((a, b) => {
      const getVal = (r: typeof a) => {
        switch (sortKey) {
          case "lender": return 0;
          case "disbursed": return r.disbursed;
          case "amount": return r.amount_cr;
          case "conv": return r.conv;
          case "aop": return r.aop;
          case "achv": return r.aop > 0 ? (r.amount_cr / r.aop) * 100 : 0;
          case "growth": return r.growth;
          default: return 0;
        }
      };
      if (sortKey === "lender") return sortAsc ? a.lender.localeCompare(b.lender) : b.lender.localeCompare(a.lender);
      return sortAsc ? getVal(a) - getVal(b) : getVal(b) - getVal(a);
    });
  }, [byLender, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-2.5 w-2.5 opacity-30" />;
    return sortAsc ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />;
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-muted-foreground animate-pulse">Loading disbursal data...</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Disbursal Summary"
        description={`Where disbursements come from (${pL} vs ${cL}), who is performing, and whether we are on track. Day ${DAYS_ELAPSED}/${TOTAL_DAYS} (as of ${REFERENCE_DATE.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })}).`}
      />

      <div className="p-6 space-y-6">
        {/* ═══ KPI Cards ═══════════════════════════════════════════════════ */}
        <div id="disb-kpi" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <ClickableKpiCard
            onClick={() =>
              setKpiDive({
                open: true,
                config: {
                  title: "Total Disbursed",
                  metric: totalDisbursed.toLocaleString("en-IN"),
                  subtitle: `from ${totalChildLeads.toLocaleString("en-IN")} child leads`,
                  sections: [
                    {
                      title: "MTD vs LMTD",
                      type: "kpi-row",
                      kpis: [
                        { label: pL, value: totalDisbursed.toLocaleString("en-IN"), sub: "loans" },
                        { label: cL, value: lmtdDisbursed.toLocaleString("en-IN"), sub: "loans" },
                        { label: "Growth", value: `${disbGrowth > 0 ? "+" : ""}${disbGrowth.toFixed(1)}%`, sub: "vs prior", color: disbGrowth >= 0 ? "text-emerald-600" : "text-red-600" },
                      ],
                    },
                    {
                      title: "Lender Breakdown (Volume)",
                      type: "chart",
                      chart: {
                        type: "bar",
                        data: byLender.map((l, i) => ({ name: l.lender, value: l.disbursed, color: COLORS[i % COLORS.length] })),
                        label: "Loans",
                      },
                    },
                    {
                      title: "Lender Details",
                      type: "table",
                      headers: ["Lender", "Loans", "Amount (Cr)", "Share %", "Growth"],
                      rows: byLender.map((l) => ({
                        label: l.lender,
                        values: [l.disbursed.toLocaleString("en-IN"), l.amount_cr.toFixed(1), `${l.share.toFixed(1)}%`, `${l.growth > 0 ? "+" : ""}${l.growth.toFixed(1)}%`],
                      })),
                    },
                    {
                      title: "Analysis",
                      type: "bullets",
                      bullets: [
                        `${pL}: ${totalDisbursed.toLocaleString("en-IN")} loans disbursed (₹${amountCr.toFixed(1)} Cr at avg ATS)`,
                        `Growth: ${disbGrowth > 0 ? "+" : ""}${disbGrowth.toFixed(1)}% vs ${cL}`,
                        `Top 3 lenders: ${byLender.slice(0, 3).map((l) => `${l.lender} (${l.share.toFixed(0)}%)`).join(", ")}`,
                      ],
                    },
                  ],
                },
              })
            }
          >
            <KPICard
              title="Total Disbursed"
              value={totalDisbursed.toLocaleString("en-IN")}
              subtitle={`from ${totalChildLeads.toLocaleString("en-IN")} child leads`}
              delta={disbGrowth}
              icon={<Hash className="h-5 w-5 text-violet-600" />}
            />
          </ClickableKpiCard>
          <ClickableKpiCard
            onClick={() =>
              setKpiDive({
                open: true,
                config: {
                  title: `Amount (${pL})`,
                  metric: `${amountCr.toFixed(1)} Cr`,
                  subtitle: `${cL}: ${lmtdAmountCr.toFixed(1)} Cr`,
                  sections: [
                    {
                      title: "MTD vs LMTD",
                      type: "kpi-row",
                      kpis: [
                        { label: pL, value: `${amountCr.toFixed(1)} Cr`, sub: "disbursed" },
                        { label: cL, value: `${lmtdAmountCr.toFixed(1)} Cr`, sub: "disbursed" },
                        { label: "Growth", value: `${amtGrowth > 0 ? "+" : ""}${amtGrowth.toFixed(1)}%`, sub: "vs prior", color: amtGrowth >= 0 ? "text-emerald-600" : "text-red-600" },
                      ],
                    },
                    {
                      title: "Lender Breakdown (Amount Cr)",
                      type: "chart",
                      chart: {
                        type: "bar",
                        data: byLender.map((l, i) => ({ name: l.lender, value: parseFloat(l.amount_cr.toFixed(1)), color: COLORS[i % COLORS.length] })),
                        label: "Cr",
                        valueSuffix: " Cr",
                      },
                    },
                    {
                      title: "Lender Details",
                      type: "table",
                      headers: ["Lender", "Amount (Cr)", "LMTD (Cr)", "Share %", "Growth"],
                      rows: byLender.map((l) => ({
                        label: l.lender,
                        values: [l.amount_cr.toFixed(1), l.lmtd_amount_cr.toFixed(1), `${l.share.toFixed(1)}%`, `${l.growth > 0 ? "+" : ""}${l.growth.toFixed(1)}%`],
                      })),
                    },
                    {
                      title: "Analysis",
                      type: "bullets",
                      bullets: [
                        `Total disbursed: ₹${amountCr.toFixed(1)} Cr (${totalDisbursed.toLocaleString("en-IN")} loans × ₹${AVG_ATS} L ATS)`,
                        `Amount growth: ${amtGrowth > 0 ? "+" : ""}${amtGrowth.toFixed(1)}% vs ${cL}`,
                        `Monthly run-rate: ₹${runRateCr.toFixed(1)} Cr at current pace`,
                      ],
                    },
                  ],
                },
              })
            }
          >
            <KPICard
              title={`Amount (${pL})`}
              value={`${amountCr.toFixed(1)} Cr`}
              subtitle={`${cL}: ${lmtdAmountCr.toFixed(1)} Cr`}
              delta={amtGrowth}
              icon={<Banknote className="h-5 w-5 text-emerald-600" />}
            />
          </ClickableKpiCard>
          <ClickableKpiCard
            onClick={() =>
              setKpiDive({
                open: true,
                config: {
                  title: "Monthly Run Rate",
                  metric: `${runRateCr.toFixed(1)} Cr`,
                  subtitle: `${DAYS_ELAPSED}/${TOTAL_DAYS} days | Pacing: ${runRatePacingPct.toFixed(0)}%`,
                  sections: [
                    {
                      title: "Run Rate vs Target",
                      type: "kpi-row",
                      kpis: [
                        { label: "Projected (EOM)", value: `${runRateCr.toFixed(1)} Cr`, sub: "at current pace" },
                        { label: "Feb'26 AOP Target", value: `${monthlyAopTarget.toFixed(1)} Cr`, sub: "target" },
                        { label: "Pacing", value: `${runRatePacingPct.toFixed(0)}%`, sub: "vs target", color: runRatePacingPct >= 100 ? "text-emerald-600" : runRatePacingPct >= 75 ? "text-amber-600" : "text-red-600" },
                      ],
                    },
                    {
                      title: "Lender Breakdown (Amount Cr)",
                      type: "chart",
                      chart: {
                        type: "bar",
                        data: byLender.map((l, i) => ({ name: l.lender, value: parseFloat(l.amount_cr.toFixed(1)), color: COLORS[i % COLORS.length] })),
                        label: "Cr",
                        valueSuffix: " Cr",
                      },
                    },
                    {
                      title: "Lender Details",
                      type: "table",
                      headers: ["Lender", "MTD (Cr)", "Share %", "Growth"],
                      rows: byLender.map((l) => ({
                        label: l.lender,
                        values: [l.amount_cr.toFixed(1), `${l.share.toFixed(1)}%`, `${l.growth > 0 ? "+" : ""}${l.growth.toFixed(1)}%`],
                      })),
                    },
                    {
                      title: "Analysis",
                      type: "bullets",
                      bullets: [
                        `Run-rate: ₹${runRateCr.toFixed(1)} Cr/month (${DAYS_ELAPSED}/${TOTAL_DAYS} days elapsed)`,
                        `Pacing at ${runRatePacingPct.toFixed(0)}% of Feb'26 AOP (₹${monthlyAopTarget.toFixed(1)} Cr)`,
                        runRatePacingPct >= 100 ? "On track for Feb'26 AOP." : `Gap: ~₹${(monthlyAopTarget - runRateCr).toFixed(1)} Cr shortfall projected.`,
                      ],
                    },
                  ],
                },
              })
            }
          >
            <KPICard
              title="Monthly Run Rate"
              value={`${runRateCr.toFixed(1)} Cr`}
              subtitle={`${DAYS_ELAPSED}/${TOTAL_DAYS} days`}
              delta={runRatePacingPct - 100}
              deltaLabel="vs Feb'26 AOP"
              icon={<Gauge className="h-5 w-5 text-blue-600" />}
            />
          </ClickableKpiCard>
          <ClickableKpiCard
            onClick={() =>
              setKpiDive({
                open: true,
                config: {
                  title: "Conv%",
                  metric: `${convPct.toFixed(1)}%`,
                  subtitle: `${cL}: ${lmtdConv.toFixed(1)}% | Δ ${convDelta > 0 ? "+" : ""}${convDelta.toFixed(1)}pp`,
                  sections: [
                    {
                      title: "MTD vs LMTD",
                      type: "kpi-row",
                      kpis: [
                        { label: pL, value: `${convPct.toFixed(1)}%`, sub: "overall conv" },
                        { label: cL, value: `${lmtdConv.toFixed(1)}%`, sub: "overall conv" },
                        { label: "Delta", value: `${convDelta > 0 ? "+" : ""}${convDelta.toFixed(1)}pp`, sub: "change", color: convDelta >= 0 ? "text-emerald-600" : "text-red-600" },
                      ],
                    },
                    {
                      title: "Lender Breakdown (Conv%)",
                      type: "chart",
                      chart: {
                        type: "bar",
                        data: byLender.map((l, i) => ({ name: l.lender, value: parseFloat(l.conv.toFixed(1)), color: COLORS[i % COLORS.length] })),
                        label: "Conv%",
                        valueSuffix: "%",
                      },
                    },
                    {
                      title: "Lender Details",
                      type: "table",
                      headers: ["Lender", "Conv%", "Loans", "Child Leads", "Share %"],
                      rows: byLender.map((l) => ({
                        label: l.lender,
                        values: [`${l.conv.toFixed(1)}%`, l.disbursed.toLocaleString("en-IN"), l.child.toLocaleString("en-IN"), `${l.share.toFixed(1)}%`],
                      })),
                    },
                    {
                      title: "Analysis",
                      type: "bullets",
                      bullets: [
                        `Overall conversion: ${convPct.toFixed(1)}% (${totalDisbursed.toLocaleString("en-IN")} / ${totalChildLeads.toLocaleString("en-IN")} child leads)`,
                        `Delta vs ${cL}: ${convDelta > 0 ? "+" : ""}${convDelta.toFixed(1)}pp`,
                        `Best performer: ${byLender[0]?.lender || "-"} at ${byLender[0]?.conv.toFixed(1) || "-"}%`,
                      ],
                    },
                  ],
                },
              })
            }
          >
            <KPICard
              title="Conv%"
              value={`${convPct.toFixed(1)}%`}
              subtitle={`${cL}: ${lmtdConv.toFixed(1)}%`}
              delta={convDelta}
              icon={<Target className="h-5 w-5 text-amber-600" />}
            />
          </ClickableKpiCard>
          <ClickableKpiCard
            onClick={() =>
              setKpiDive({
                open: true,
                config: {
                  title: "ATS",
                  metric: `${AVG_ATS.toFixed(2)} L`,
                  subtitle: `Avg ticket size | ${totalDisbursed.toLocaleString("en-IN")} loans`,
                  sections: [
                    {
                      title: "ATS Summary",
                      type: "kpi-row",
                      kpis: [
                        { label: "Avg ATS", value: `${AVG_ATS.toFixed(2)} L`, sub: "₹ Lakhs" },
                        { label: "Total Loans", value: totalDisbursed.toLocaleString("en-IN"), sub: "disbursed" },
                        { label: "Total Amount", value: `${amountCr.toFixed(1)} Cr`, sub: "disbursed" },
                      ],
                    },
                    {
                      title: "Lender Breakdown (Amount Cr)",
                      type: "chart",
                      chart: {
                        type: "bar",
                        data: byLender.map((l, i) => ({ name: l.lender, value: parseFloat(l.amount_cr.toFixed(1)), color: COLORS[i % COLORS.length] })),
                        label: "Cr",
                        valueSuffix: " Cr",
                      },
                    },
                    {
                      title: "Lender Details",
                      type: "table",
                      headers: ["Lender", "Amount (Cr)", "Loans", "Share %"],
                      rows: byLender.map((l) => ({
                        label: l.lender,
                        values: [l.amount_cr.toFixed(1), l.disbursed.toLocaleString("en-IN"), `${l.share.toFixed(1)}%`],
                      })),
                    },
                    {
                      title: "Analysis",
                      type: "bullets",
                      bullets: [
                        `ATS (Avg Ticket Size): ₹${AVG_ATS} Lakhs per loan`,
                        `Total disbursed: ₹${amountCr.toFixed(1)} Cr across ${totalDisbursed.toLocaleString("en-IN")} loans`,
                        `Amount = Loans × ATS / 100 (conversion to Cr)`,
                      ],
                    },
                  ],
                },
              })
            }
          >
            <KPICard
              title="ATS"
              value={`${AVG_ATS.toFixed(2)} L`}
              subtitle={`${totalDisbursed.toLocaleString("en-IN")} loans`}
              delta={2.1}
              icon={<Banknote className="h-5 w-5 text-orange-600" />}
            />
          </ClickableKpiCard>
          <ClickableKpiCard
            onClick={() =>
              setKpiDive({
                open: true,
                config: {
                  title: "Active Lenders",
                  metric: `${byLender.length}`,
                  subtitle: `${concentrationData.growingLenders} growing | ${concentrationData.decliningLenders} declining`,
                  sections: [
                    {
                      title: "Lender Count",
                      type: "kpi-row",
                      kpis: [
                        { label: "Active Lenders", value: byLender.length, sub: "with disbursals" },
                        { label: "Growing", value: concentrationData.growingLenders, sub: "vs LMTD", color: "text-emerald-600" },
                        { label: "Declining", value: concentrationData.decliningLenders, sub: "vs LMTD", color: concentrationData.decliningLenders > 0 ? "text-red-600" : undefined },
                      ],
                    },
                    {
                      title: "Lender Share Distribution",
                      type: "chart",
                      chart: {
                        type: "bar",
                        data: byLender.map((l, i) => ({ name: l.lender, value: parseFloat(l.share.toFixed(1)), color: COLORS[i % COLORS.length] })),
                        label: "Share %",
                        valueSuffix: "%",
                      },
                    },
                    {
                      title: "Lender Details",
                      type: "table",
                      headers: ["Lender", "Amount (Cr)", "Share %", "Growth"],
                      rows: byLender.map((l) => ({
                        label: l.lender,
                        values: [l.amount_cr.toFixed(1), `${l.share.toFixed(1)}%`, `${l.growth > 0 ? "+" : ""}${l.growth.toFixed(1)}%`],
                      })),
                    },
                    {
                      title: "Analysis",
                      type: "bullets",
                      bullets: [
                        `${byLender.length} lenders active in ${pL}`,
                        `Top 3 concentration: ${concentrationData.top3Share.toFixed(0)}%`,
                        concentrationData.growingLenders >= byLender.length * 0.7
                          ? `Broad-based growth: ${concentrationData.growingLenders}/${byLender.length} lenders growing`
                          : `Concentrated: only ${concentrationData.growingLenders}/${byLender.length} lenders growing`,
                      ],
                    },
                  ],
                },
              })
            }
          >
            <KPICard
              title="Active Lenders"
              value={`${byLender.length}`}
              subtitle={`${concentrationData.growingLenders} growing`}
              icon={<BarChart3 className="h-5 w-5 text-pink-600" />}
            />
          </ClickableKpiCard>
        </div>

        {/* ═══ Disbursement Views: Overall, Lender-wise, Flow-wise (FTD & LMTD & MTD) ═════ */}
        <div id="disbursement-views" className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Banknote className="h-4 w-4 text-muted-foreground" />
              Disbursement Views
            </h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Overall summary, lender-wise and flow-wise (lead type) : FTD, LMTD & MTD
            </p>
          </div>

          {/* Overall: Disbursement Summary */}
          <Card>
            <CardHeader className="py-3 px-5 bg-primary/10">
              <CardTitle className="text-xs font-semibold">Disbursement Summary (Overall)</CardTitle>
              <p className="text-[10px] text-muted-foreground">Lender | AOP (Feb&apos;26 target, Cr) | MTD | LMSD | Growth%</p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-[10px] font-semibold">Lender</TableHead>
                      <TableHead className="text-[10px] font-semibold text-right">AOP (Target) (Cr)</TableHead>
                      <TableHead className="text-[10px] font-semibold text-right">MTD (Cr)</TableHead>
                      <TableHead className="text-[10px] font-semibold text-right">LMSD (Cr)</TableHead>
                      <TableHead className="text-[10px] font-semibold text-right">Growth%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summaryOverall.map((r) => {
                      const growth = r.lmsd_cr > 0 ? ((r.mtd_cr - r.lmsd_cr) / r.lmsd_cr) * 100 : 0;
                      return (
                        <TableRow key={r.lender} className="hover:bg-muted/20">
                          <TableCell className="text-xs font-medium py-2">{r.lender}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{r.aop.toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{r.mtd_cr.toFixed(2)}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{r.lmsd_cr.toFixed(2)}</TableCell>
                          <TableCell className="text-right py-2">
                            <span className={cn(
                              "text-[10px] font-semibold",
                              growth > 0 ? "text-emerald-600" : growth < 0 ? "text-red-600" : "text-muted-foreground"
                            )}>
                              {growth > 0 ? "+" : ""}{growth.toFixed(2)}%
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {summaryOverall.length > 0 && (
                      <TableRow className="bg-muted/40 font-bold border-t-2">
                        <TableCell className="text-xs font-bold py-2">Summary</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">
                          {summaryOverall.reduce((s, r) => s + r.aop, 0).toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell className="text-xs text-right tabular-nums">
                          {summaryOverall.reduce((s, r) => s + r.mtd_cr, 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-xs text-right tabular-nums">
                          {summaryOverall.reduce((s, r) => s + r.lmsd_cr, 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right py-2">
                          {(() => {
                            const tMtd = summaryOverall.reduce((s, r) => s + r.mtd_cr, 0);
                            const tLmsd = summaryOverall.reduce((s, r) => s + r.lmsd_cr, 0);
                            const g = tLmsd > 0 ? ((tMtd - tLmsd) / tLmsd) * 100 : 0;
                            return (
                              <span className={cn(
                                "text-[10px] font-bold",
                                g > 0 ? "text-emerald-600" : g < 0 ? "text-red-600" : "text-muted-foreground"
                              )}>
                                {g > 0 ? "+" : ""}{g.toFixed(2)}%
                              </span>
                            );
                          })()}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Lender-wise / Flow-wise tabs */}
          <div className="flex flex-wrap gap-2">
            <div className="flex rounded-lg border border-border overflow-hidden">
              {(["lender", "flow"] as const).map((tab) => (
                <button
                  key={tab}
                  className={cn(
                    "px-3 py-1.5 text-[11px] font-semibold transition-colors",
                    disbViewTab === tab ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/60"
                  )}
                  onClick={() => setDisbViewTab(tab)}
                >
                  {tab === "lender" ? "Lender-wise" : "Flow-wise"}
                </button>
              ))}
            </div>
            <div className="flex rounded-lg border border-border overflow-hidden">
              {(["MTD", "LMTD", "FTD"] as const).map((period) => (
                <button
                  key={period}
                  className={cn(
                    "px-3 py-1.5 text-[11px] font-semibold transition-colors",
                    disbPeriodTab === period ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/60"
                  )}
                  onClick={() => setDisbPeriodTab(period)}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>

          {/* Lender-wise table */}
          {disbViewTab === "lender" && (
            <Card>
              <CardHeader className="py-3 px-5 bg-primary/10">
                <CardTitle className="text-xs font-semibold">
                  {disbPeriodTab} DISBURSAL (Lender)
                </CardTitle>
                <p className="text-[10px] text-muted-foreground">Loan | Amt(Cr.) | ATS | Avg | Avg PF</p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-[10px] font-semibold">Lender</TableHead>
                        <TableHead className="text-[10px] font-semibold text-right">Loan</TableHead>
                        <TableHead className="text-[10px] font-semibold text-right">Amt(Cr.)</TableHead>
                        <TableHead className="text-[10px] font-semibold text-right">ATS</TableHead>
                        <TableHead className="text-[10px] font-semibold text-right">Avg</TableHead>
                        <TableHead className="text-[10px] font-semibold text-right">Avg PF</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(disbPeriodTab === "MTD" ? mtdLender : disbPeriodTab === "LMTD" ? lmsdLender : ftdLender).map((r) => (
                        <TableRow key={r.lender} className="hover:bg-muted/20">
                          <TableCell className="text-xs font-medium py-2">{r.lender}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{r.loan.toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{r.amt_cr.toFixed(2)}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{r.ats.toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{r.avg.toFixed(2)}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{r.avg_pf.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                      {disbPeriodTab === "MTD" && mtdLender.length > 0 && (
                        <TableRow className="bg-muted/40 font-bold border-t-2">
                          <TableCell className="text-xs font-bold py-2">Summary</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{mtdLender.reduce((s, r) => s + r.loan, 0).toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{mtdLender.reduce((s, r) => s + r.amt_cr, 0).toFixed(2)}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">
                            {mtdLender.reduce((s, r) => s + r.loan, 0) > 0
                              ? Math.round(mtdLender.reduce((s, r) => s + r.ats * r.loan, 0) / mtdLender.reduce((s, r) => s + r.loan, 0)).toLocaleString("en-IN")
                              : "-"}
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums">
                            {mtdLender.length ? (mtdLender.reduce((s, r) => s + r.avg, 0) / mtdLender.length).toFixed(2) : "-"}
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums">
                            {mtdLender.length ? (mtdLender.reduce((s, r) => s + r.avg_pf, 0) / mtdLender.length).toFixed(2) : "-"}
                          </TableCell>
                        </TableRow>
                      )}
                      {disbPeriodTab === "LMTD" && lmsdLender.length > 0 && (
                        <TableRow className="bg-muted/40 font-bold border-t-2">
                          <TableCell className="text-xs font-bold py-2">Summary</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{lmsdLender.reduce((s, r) => s + r.loan, 0).toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{lmsdLender.reduce((s, r) => s + r.amt_cr, 0).toFixed(2)}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">
                            {lmsdLender.reduce((s, r) => s + r.loan, 0) > 0
                              ? Math.round(lmsdLender.reduce((s, r) => s + r.ats * r.loan, 0) / lmsdLender.reduce((s, r) => s + r.loan, 0)).toLocaleString("en-IN")
                              : "-"}
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums">
                            {lmsdLender.length ? (lmsdLender.reduce((s, r) => s + r.avg, 0) / lmsdLender.length).toFixed(2) : "-"}
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums">
                            {lmsdLender.length ? (lmsdLender.reduce((s, r) => s + r.avg_pf, 0) / lmsdLender.length).toFixed(2) : "-"}
                          </TableCell>
                        </TableRow>
                      )}
                      {disbPeriodTab === "FTD" && ftdLender.length > 0 && (
                        <TableRow className="bg-muted/40 font-bold border-t-2">
                          <TableCell className="text-xs font-bold py-2">Summary</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{ftdLender.reduce((s, r) => s + r.loan, 0).toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{ftdLender.reduce((s, r) => s + r.amt_cr, 0).toFixed(2)}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">
                            {ftdLender.reduce((s, r) => s + r.loan, 0) > 0
                              ? Math.round(ftdLender.reduce((s, r) => s + r.ats * r.loan, 0) / ftdLender.reduce((s, r) => s + r.loan, 0)).toLocaleString("en-IN")
                              : "-"}
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums">
                            {ftdLender.length ? (ftdLender.reduce((s, r) => s + r.avg, 0) / ftdLender.length).toFixed(2) : "-"}
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums">
                            {ftdLender.length ? (ftdLender.reduce((s, r) => s + r.avg_pf, 0) / ftdLender.length).toFixed(2) : "-"}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Flow-wise (lead type) table */}
          {disbViewTab === "flow" && (
            <Card>
              <CardHeader className="py-3 px-5 bg-primary/10">
                <CardTitle className="text-xs font-semibold">
                  {disbPeriodTab} DISBURSAL (Lead Type)
                </CardTitle>
                <p className="text-[10px] text-muted-foreground">Loan | Amt(Cr.) | ATS | Avg | Avg PF</p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-[10px] font-semibold">Lead Type</TableHead>
                        <TableHead className="text-[10px] font-semibold text-right">Loan</TableHead>
                        <TableHead className="text-[10px] font-semibold text-right">Amt(Cr.)</TableHead>
                        <TableHead className="text-[10px] font-semibold text-right">ATS</TableHead>
                        <TableHead className="text-[10px] font-semibold text-right">Avg</TableHead>
                        <TableHead className="text-[10px] font-semibold text-right">Avg PF</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(disbPeriodTab === "MTD" ? mtdLeadType : disbPeriodTab === "LMTD" ? lmsdLeadType : ftdLeadType).map((r) => (
                        <TableRow key={r.lead_type} className="hover:bg-muted/20">
                          <TableCell className="text-xs font-medium py-2">{r.lead_type}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{r.loan.toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{r.amt_cr.toFixed(2)}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{r.ats.toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{r.avg.toFixed(2)}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{r.avg_pf.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                      {disbPeriodTab === "MTD" && mtdLeadType.length > 0 && (
                        <TableRow className="bg-muted/40 font-bold border-t-2">
                          <TableCell className="text-xs font-bold py-2">Summary</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{mtdLeadType.reduce((s, r) => s + r.loan, 0).toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{mtdLeadType.reduce((s, r) => s + r.amt_cr, 0).toFixed(2)}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">
                            {mtdLeadType.reduce((s, r) => s + r.loan, 0) > 0
                              ? Math.round(mtdLeadType.reduce((s, r) => s + r.ats * r.loan, 0) / mtdLeadType.reduce((s, r) => s + r.loan, 0)).toLocaleString("en-IN")
                              : "-"}
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums">
                            {mtdLeadType.length ? (mtdLeadType.reduce((s, r) => s + r.avg, 0) / mtdLeadType.length).toFixed(2) : "-"}
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums">
                            {mtdLeadType.length ? (mtdLeadType.reduce((s, r) => s + r.avg_pf, 0) / mtdLeadType.length).toFixed(2) : "-"}
                          </TableCell>
                        </TableRow>
                      )}
                      {disbPeriodTab === "LMTD" && lmsdLeadType.length > 0 && (
                        <TableRow className="bg-muted/40 font-bold border-t-2">
                          <TableCell className="text-xs font-bold py-2">Summary</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{lmsdLeadType.reduce((s, r) => s + r.loan, 0).toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{lmsdLeadType.reduce((s, r) => s + r.amt_cr, 0).toFixed(2)}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">
                            {lmsdLeadType.reduce((s, r) => s + r.loan, 0) > 0
                              ? Math.round(lmsdLeadType.reduce((s, r) => s + r.ats * r.loan, 0) / lmsdLeadType.reduce((s, r) => s + r.loan, 0)).toLocaleString("en-IN")
                              : "-"}
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums">
                            {lmsdLeadType.length ? (lmsdLeadType.reduce((s, r) => s + r.avg, 0) / lmsdLeadType.length).toFixed(2) : "-"}
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums">
                            {lmsdLeadType.length ? (lmsdLeadType.reduce((s, r) => s + r.avg_pf, 0) / lmsdLeadType.length).toFixed(2) : "-"}
                          </TableCell>
                        </TableRow>
                      )}
                      {disbPeriodTab === "FTD" && ftdLeadType.length > 0 && (
                        <TableRow className="bg-muted/40 font-bold border-t-2">
                          <TableCell className="text-xs font-bold py-2">Summary</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{ftdLeadType.reduce((s, r) => s + r.loan, 0).toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{ftdLeadType.reduce((s, r) => s + r.amt_cr, 0).toFixed(2)}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">
                            {ftdLeadType.reduce((s, r) => s + r.loan, 0) > 0
                              ? Math.round(ftdLeadType.reduce((s, r) => s + r.ats * r.loan, 0) / ftdLeadType.reduce((s, r) => s + r.loan, 0)).toLocaleString("en-IN")
                              : "-"}
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums">
                            {ftdLeadType.length ? (ftdLeadType.reduce((s, r) => s + r.avg, 0) / ftdLeadType.length).toFixed(2) : "-"}
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums">
                            {ftdLeadType.length ? (ftdLeadType.reduce((s, r) => s + r.avg_pf, 0) / ftdLeadType.length).toFixed(2) : "-"}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Insights */}
        <RichInsightPanel title="Disbursal Insights" insights={richInsights} pageName="Disbursal Summary" />

        {/* ═══ SECTION 1: Lender × Program Matrix ════════════════════════ */}
        <Separator />
        <div id="disb-lender-matrix">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <PieChartIcon className="h-4 w-4 text-muted-foreground" />
                Lender × Program Disbursement Matrix
              </h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Which lenders / programs are driving disbursements
              </p>
            </div>
            <div className="flex gap-1">
              {([
                ["disbursed", "Loans"],
                ["amount", "Amount (Cr)"],
                ["conv", "Conv%"],
              ] as [typeof matrixMetric, string][]).map(([key, label]) => (
                <button
                  key={key}
                  className={cn(
                    "text-[10px] font-semibold px-2.5 py-1 rounded-md border transition-colors",
                    matrixMetric === key
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/60"
                  )}
                  onClick={() => setMatrixMetric(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-[10px] font-semibold min-w-[100px]">Lender</TableHead>
                      {allProducts.map((p) => (
                        <TableHead key={p} className="text-[10px] font-semibold text-center min-w-[90px]">
                          <div className="flex items-center justify-center gap-1">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PRODUCT_COLORS[p] || COLORS[0] }} />
                            {p}
                          </div>
                        </TableHead>
                      ))}
                      <TableHead className="text-[10px] font-bold text-center bg-muted/70 min-w-[80px]">Total</TableHead>
                      <TableHead className="text-[10px] font-semibold text-center min-w-[60px]">Share</TableHead>
                      <TableHead className="text-[10px] font-semibold text-center min-w-[70px]">Growth</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matrixData.sortedLenders.map((lender) => {
                      const lRow = byLender.find((l) => l.lender === lender);
                      const totalVal = matrixMetric === "disbursed" ? (lRow?.disbursed || 0)
                        : matrixMetric === "amount" ? (lRow?.amount_cr || 0)
                        : (lRow?.conv || 0);

                      return (
                        <TableRow key={lender} className="hover:bg-muted/20">
                          <TableCell className="text-xs font-semibold py-2">{lender}</TableCell>
                          {allProducts.map((product) => {
                            const cell = matrixData.map[lender]?.[product];
                            const v = getMatrixValue(cell);
                            const intensity = matrixMaxValue > 0 ? v.raw / matrixMaxValue : 0;
                            return (
                              <TableCell key={product} className="text-center py-2">
                                {v.display !== "-" ? (
                                  <span
                                    className="text-[11px] tabular-nums font-medium px-2 py-0.5 rounded"
                                    style={{
                                      backgroundColor: `hsla(220, 70%, 55%, ${intensity * 0.2})`,
                                    }}
                                  >
                                    {v.display}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center py-2 bg-muted/20">
                            <span className="text-[11px] tabular-nums font-bold">
                              {matrixMetric === "conv"
                                ? `${totalVal.toFixed(1)}%`
                                : matrixMetric === "amount"
                                ? totalVal.toFixed(1)
                                : totalVal.toLocaleString("en-IN")}
                            </span>
                          </TableCell>
                          <TableCell className="text-center py-2">
                            <span className="text-[10px] tabular-nums">{lRow?.share.toFixed(1)}%</span>
                          </TableCell>
                          <TableCell className="text-center py-2">
                            <span className={cn(
                              "text-[10px] font-semibold",
                              (lRow?.growth || 0) > 0 ? "text-emerald-600" : (lRow?.growth || 0) < 0 ? "text-red-600" : "text-muted-foreground"
                            )}>
                              {(lRow?.growth || 0) > 0 ? "+" : ""}{lRow?.growth.toFixed(1)}%
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {/* Grand total row */}
                    <TableRow className="bg-muted/40 font-bold border-t-2">
                      <TableCell className="text-xs font-bold py-2">Grand Total</TableCell>
                      {allProducts.map((product) => {
                        const pTotal = matrixData.productTotals[product];
                        const display = matrixMetric === "disbursed"
                          ? pTotal.disbursed.toLocaleString("en-IN")
                          : matrixMetric === "amount"
                          ? ((pTotal.disbursed * AVG_ATS) / 100).toFixed(1)
                          : pTotal.child > 0
                          ? `${((pTotal.disbursed / pTotal.child) * 100).toFixed(1)}%`
                          : "-";
                        return (
                          <TableCell key={product} className="text-center py-2">
                            <span className="text-[11px] tabular-nums font-bold">{display}</span>
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center py-2 bg-muted/30">
                        <span className="text-[11px] tabular-nums font-bold">
                          {matrixMetric === "disbursed"
                            ? totalDisbursed.toLocaleString("en-IN")
                            : matrixMetric === "amount"
                            ? amountCr.toFixed(1)
                            : `${convPct.toFixed(1)}%`}
                        </span>
                      </TableCell>
                      <TableCell className="text-center py-2">
                        <span className="text-[10px] font-bold">100%</span>
                      </TableCell>
                      <TableCell className="text-center py-2">
                        <span className={cn(
                          "text-[10px] font-bold",
                          disbGrowth > 0 ? "text-emerald-600" : "text-red-600"
                        )}>
                          {disbGrowth > 0 ? "+" : ""}{disbGrowth.toFixed(1)}%
                        </span>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ═══ SECTION 2: Trends vs Baseline ═════════════════════════════ */}
        <Separator />
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Trends vs Baseline
          </h2>
          <p className="text-[10px] text-muted-foreground mb-3">
            How current month compares to historical average (6-month baseline)
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Monthly amount with baseline */}
            <Card className="overflow-hidden">
              <CardHeader className="pb-1 pt-4 px-5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Monthly Amount (Cr) vs 6M Baseline
                  </CardTitle>
                  <ChartFeedbackButton chartTitle="Monthly Amount (Cr) vs 6M Baseline" pageName="Disbursal Summary" />
                </div>
              </CardHeader>
              <CardContent className="p-0 pb-2 pr-2">
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={trendsWithBaseline} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 92%)" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={45}
                      tickFormatter={(v) => `${v} Cr`}
                    />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <ReferenceLine y={trendsWithBaseline[0]?.baseline_amount || 0} stroke="hsl(350, 65%, 55%)"
                      strokeDasharray="6 4" strokeWidth={1.5} label={{ value: "Baseline", position: "right", fontSize: 9, fill: "hsl(350, 65%, 55%)" }}
                    />
                    <Bar dataKey="disbursed_amount_cr" name="Amount (Cr)" fill="hsl(220, 70%, 55%)" radius={[4, 4, 0, 0]} barSize={32}>
                      {trendsWithBaseline.map((entry, idx) => (
                        <Cell key={idx} fill={entry.disbursed_amount_cr >= entry.baseline_amount ? "hsl(150, 60%, 45%)" : "hsl(350, 65%, 55%)"} />
                      ))}
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Lender-level stacked area trend */}
            <Card className="overflow-hidden">
              <CardHeader className="pb-1 pt-4 px-5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Lender-wise Monthly Trend (Cr)
                  </CardTitle>
                  <ChartFeedbackButton chartTitle="Lender-wise Monthly Trend (Cr)" pageName="Disbursal Summary" />
                </div>
              </CardHeader>
              <CardContent className="p-0 pb-2 pr-2">
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={lenderMonthlyTrends} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 92%)" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={45}
                      tickFormatter={(v) => `${v}`}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload || payload.length === 0) return null;
                        const monthTotal = payload.reduce((s, p) => s + (Number(p.value) || 0), 0);
                        return (
                          <div className="rounded-lg border bg-card shadow-md px-3 py-2 text-xs">
                            <p className="font-semibold text-foreground mb-1.5 border-b pb-1">{label}</p>
                            {[...payload].reverse().map((entry, i) => {
                              const val = Number(entry.value) || 0;
                              const pct = monthTotal > 0 ? (val / monthTotal) * 100 : 0;
                              return (
                                <div key={i} className="flex items-center gap-2 py-0.5">
                                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                                  <span className="text-muted-foreground flex-1">{entry.dataKey}</span>
                                  <span className="font-semibold tabular-nums">{val.toFixed(1)} Cr</span>
                                  <span className="text-muted-foreground tabular-nums w-10 text-right">({pct.toFixed(0)}%)</span>
                                </div>
                              );
                            })}
                            <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t font-bold">
                              <span className="flex-1">Month Total</span>
                              <span className="tabular-nums">{monthTotal.toFixed(1)} Cr</span>
                              <span className="text-muted-foreground tabular-nums w-10 text-right">(100%)</span>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 9 }} />
                    {byLender.slice(0, 6).map((l, i) => (
                      <Area key={l.lender} type="monotone" dataKey={l.lender} stackId="1"
                        fill={COLORS[i % COLORS.length]} stroke={COLORS[i % COLORS.length]}
                        fillOpacity={0.6}
                      />
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ═══ SECTION 3: Contribution & Concentration ═══════════════════ */}
        <Separator />
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-1">
            <PieChartIcon className="h-4 w-4 text-muted-foreground" />
            Contribution & Concentration
          </h2>
          <p className="text-[10px] text-muted-foreground mb-3">
            Is growth broad-based or concentrated? How is share shifting between lenders?
          </p>

          {/* Quick stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Card>
              <CardContent className="p-3">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Top 3 Concentration</p>
                <p className="text-lg font-bold tabular-nums">{concentrationData.top3Share.toFixed(0)}%</p>
                <p className="text-[10px] text-muted-foreground">{concentrationData.pareto.slice(0, 3).map((l) => l.lender).join(", ")}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">HHI Index</p>
                <p className="text-lg font-bold tabular-nums">{concentrationData.hhi.toFixed(0)}</p>
                <p className="text-[10px] text-muted-foreground">
                  {concentrationData.hhi > 2500 ? "Highly concentrated" : concentrationData.hhi > 1500 ? "Moderately concentrated" : "Low concentration"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Growing Lenders</p>
                <p className="text-lg font-bold tabular-nums text-emerald-600">{concentrationData.growingLenders} / {byLender.length}</p>
                <p className="text-[10px] text-muted-foreground">{concentrationData.decliningLenders} declining</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Biggest Share Gainer</p>
                {concentrationData.shareShifts[0] && (
                  <>
                    <p className="text-lg font-bold tabular-nums">{concentrationData.shareShifts[0].lender}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {concentrationData.shareShifts[0].shift > 0 ? "+" : ""}{concentrationData.shareShifts[0].shift}pp shift
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Pareto chart */}
            <Card className="overflow-hidden">
              <CardHeader className="pb-1 pt-4 px-5">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Pareto: Disbursals by Lender (Cumulative %)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 pb-2 pr-2">
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={concentrationData.pareto} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 92%)" vertical={false} />
                    <XAxis dataKey="lender" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={45}
                      tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toString()}
                    />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={40}
                      domain={[0, 100]} tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <Bar yAxisId="left" dataKey="disbursed" name="Disbursed" fill="hsl(220, 70%, 55%)" radius={[4, 4, 0, 0]} barSize={28} />
                    <Line yAxisId="right" type="monotone" dataKey="cumulative" name="Cumulative %"
                      stroke="hsl(350, 65%, 55%)" strokeWidth={2} dot={{ r: 3 }}
                    />
                    <ReferenceLine yAxisId="right" y={80} stroke="hsl(0, 0%, 70%)" strokeDasharray="4 4" />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Share Shift table */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Share Shift: {pL} vs {cL}</CardTitle>
                  <ChartFeedbackButton chartTitle={`Share Shift: ${pL} vs ${cL}`} pageName="Disbursal Summary" />
                </div>
                <p className="text-[10px] text-muted-foreground">How lender share is moving month-over-month</p>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-[10px] font-semibold">Lender</TableHead>
                      <TableHead className="text-[10px] font-semibold text-right">{cL} Share</TableHead>
                      <TableHead className="text-[10px] font-semibold text-right">{pL} Share</TableHead>
                      <TableHead className="text-[10px] font-semibold text-right">Shift</TableHead>
                      <TableHead className="text-[10px] font-semibold w-[100px]">Visual</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {concentrationData.shareShifts.map((row) => (
                      <TableRow key={row.lender} className="hover:bg-muted/20">
                        <TableCell className="text-xs font-medium py-2">{row.lender}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums text-muted-foreground">{row.lmtd_share}%</TableCell>
                        <TableCell className="text-xs text-right tabular-nums font-medium">{row.mtd_share}%</TableCell>
                        <TableCell className="text-right py-2">
                          <span className={cn(
                            "inline-flex items-center gap-0.5 text-[10px] font-bold rounded-full px-2 py-0.5",
                            row.shift > 0 ? "bg-emerald-50 text-emerald-700" : row.shift < 0 ? "bg-red-50 text-red-700" : "bg-gray-50 text-gray-600"
                          )}>
                            {row.shift > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : row.shift < 0 ? <TrendingDown className="h-2.5 w-2.5" /> : null}
                            {row.shift > 0 ? "+" : ""}{row.shift}pp
                          </span>
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="flex items-center gap-1">
                            <div className="h-1.5 rounded-full bg-muted w-full relative overflow-hidden">
                              <div
                                className={cn("h-full rounded-full absolute left-0 top-0", row.shift >= 0 ? "bg-emerald-500" : "bg-red-500")}
                                style={{ width: `${Math.min(Math.abs(row.shift) * 10, 100)}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ═══ SECTION 4: Run-Rate vs Expectation ════════════════════════ */}
        <Separator />
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-1">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            Run-Rate vs Expectation
          </h2>
          <p className="text-[10px] text-muted-foreground mb-3">
            Are we on pace to hit monthly / AOP targets? Day {DAYS_ELAPSED} of {TOTAL_DAYS}.
          </p>

          {/* Pacing summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Card>
              <CardContent className="p-3">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{pL} Disbursed</p>
                <p className="text-lg font-bold tabular-nums">{amountCr.toFixed(1)} Cr</p>
                <p className="text-[10px] text-muted-foreground">{DAYS_ELAPSED} days elapsed</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Projected (EOM)</p>
                <p className="text-lg font-bold tabular-nums">{runRateCr.toFixed(1)} Cr</p>
                <p className="text-[10px] text-muted-foreground">at current pace</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Feb'26 AOP Target</p>
                <p className="text-lg font-bold tabular-nums">{monthlyAopTarget.toFixed(1)} Cr</p>
                <div className="flex items-center gap-1 mt-1">
                  <Progress value={Math.min(runRatePacingPct, 100)} className="h-1.5 flex-1" />
                  <span className={cn(
                    "text-[10px] font-bold",
                    runRatePacingPct >= 100 ? "text-emerald-600" : runRatePacingPct >= 75 ? "text-amber-600" : "text-red-600"
                  )}>
                    {runRatePacingPct.toFixed(0)}%
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Gap to Target</p>
                <p className={cn(
                  "text-lg font-bold tabular-nums",
                  runRateCr >= monthlyAopTarget ? "text-emerald-600" : "text-red-600"
                )}>
                  {runRateCr >= monthlyAopTarget ? "+" : "-"}{Math.abs(runRateCr - monthlyAopTarget).toFixed(1)} Cr
                </p>
                <p className="text-[10px] text-muted-foreground">projected {runRateCr >= monthlyAopTarget ? "surplus" : "shortfall"}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Cumulative progress chart */}
            <Card className="overflow-hidden">
              <CardHeader className="pb-1 pt-4 px-5">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Cumulative Disbursals: Actual vs AOP Pace
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 pb-2 pr-2">
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={runRateData.days} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 92%)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 8 }} tickLine={false} axisLine={false} interval={2} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={45}
                      tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toString()}
                    />
                    <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8 }} />
                    <Area type="monotone" dataKey="cumActual" name="Actual" fill="hsl(220, 70%, 55%)"
                      stroke="hsl(220, 70%, 55%)" fillOpacity={0.3} strokeWidth={2}
                    />
                    <Line type="monotone" dataKey="cumExpected" name="AOP Pace" stroke="hsl(350, 65%, 55%)"
                      strokeDasharray="6 4" strokeWidth={1.5} dot={false}
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Lender AOP pacing table */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Lender AOP Pacing</CardTitle>
                <p className="text-[10px] text-muted-foreground">Monthly target vs projected at current run-rate</p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[280px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-[10px] font-semibold">Lender</TableHead>
                        <TableHead className="text-[10px] font-semibold text-right">{pL} (Cr)</TableHead>
                        <TableHead className="text-[10px] font-semibold text-right">Target (Cr)</TableHead>
                        <TableHead className="text-[10px] font-semibold text-right">Projected</TableHead>
                        <TableHead className="text-[10px] font-semibold text-right">Pacing</TableHead>
                        <TableHead className="text-[10px] font-semibold text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {runRateData.lenderPacing.map((row) => (
                        <TableRow key={row.lender} className="hover:bg-muted/20">
                          <TableCell className="text-xs font-medium py-2">{row.lender}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{row.mtd_cr.toFixed(1)}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums text-muted-foreground">{row.monthly_target_cr.toFixed(1)}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums font-medium">{row.projected_cr.toFixed(1)}</TableCell>
                          <TableCell className="text-right py-2">
                            <div className="flex items-center gap-1.5 justify-end">
                              <Progress value={Math.min(row.pacing_pct, 100)} className="w-14 h-1.5" />
                              <span className={cn(
                                "text-[10px] font-bold tabular-nums w-10 text-right",
                                row.pacing_pct >= 100 ? "text-emerald-600" : row.pacing_pct >= 75 ? "text-amber-600" : "text-red-600"
                              )}>
                                {row.pacing_pct.toFixed(0)}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center py-2">
                            <Badge variant="outline" className={cn(
                              "text-[9px] font-bold px-1.5",
                              row.status === "on_track" ? "text-emerald-600 border-emerald-200 bg-emerald-50" :
                              row.status === "watch" ? "text-amber-600 border-amber-200 bg-amber-50" :
                              "text-red-600 border-red-200 bg-red-50"
                            )}>
                              {row.status === "on_track" ? "On Track" : row.status === "watch" ? "Watch" : "Behind"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ═══ Detailed Lender Table (existing, refined) ════════════════ */}
        <Separator />
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Lender-wise Disbursal & AOP Tracking</CardTitle>
            <p className="text-[10px] text-muted-foreground">Click column headers to sort</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[500px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    {([
                      ["lender", "Lender", "left"],
                      ["disbursed", "Loans", "right"],
                      ["amount", "Amount (Cr)", "right"],
                      ["conv", "Conv%", "right"],
                      ["growth", "Growth%", "right"],
                      ["aop", "AOP (Cr)", "right"],
                      ["achv", "Achievement", "right"],
                    ] as [SortKey, string, string][]).map(([col, label, align]) => (
                      <TableHead
                        key={col}
                        className="text-[10px] font-semibold cursor-pointer select-none hover:text-foreground transition-colors"
                        onClick={() => handleSort(col)}
                      >
                        <div className={cn("flex items-center gap-0.5", align === "right" ? "justify-end" : "")}>
                          {label} <SortIcon col={col} />
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedLenders.map((row) => {
                    const achv = row.aop > 0 ? (row.amount_cr / row.aop) * 100 : 0;
                    return (
                      <TableRow key={row.lender} className="hover:bg-muted/30">
                        <TableCell className="text-xs font-medium py-2.5">{row.lender}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{row.disbursed.toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums font-medium">{row.amount_cr.toFixed(1)}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{row.conv.toFixed(1)}%</TableCell>
                        <TableCell className="text-right">
                          <span className={cn(
                            "text-[10px] font-semibold",
                            row.growth > 0 ? "text-emerald-600" : row.growth < 0 ? "text-red-600" : "text-muted-foreground"
                          )}>
                            {row.growth > 0 ? "+" : ""}{row.growth.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{row.aop > 0 ? row.aop.toFixed(0) : "-"}</TableCell>
                        <TableCell className="text-right py-2.5">
                          {row.aop > 0 ? (
                            <div className="flex items-center gap-2 justify-end">
                              <Progress value={Math.min(achv, 100)} className="w-16 h-1.5" />
                              <span className={cn(
                                "text-[10px] font-bold tabular-nums w-10 text-right",
                                achv >= 80 ? "text-emerald-600" : achv >= 50 ? "text-amber-600" : "text-red-600"
                              )}>
                                {achv.toFixed(0)}%
                              </span>
                            </div>
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
      </div>

      <KpiDeepDiveModal open={kpiDive.open} onClose={() => setKpiDive({ open: false, config: null })} config={kpiDive.config} />
    </div>
  );
}
