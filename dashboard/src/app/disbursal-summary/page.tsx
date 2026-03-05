"use client";

import React, { useEffect, useState, useMemo } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { KPICard } from "@/components/dashboard/kpi-card";
import { KpiDeepDiveModal, ClickableKpiCard, KpiDeepDiveConfig } from "@/components/dashboard/kpi-deep-dive-modal";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { RichInsightPanel, RichInsightItem, ChartFeedbackButton } from "@/components/dashboard/rich-insight-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  BarChart3,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
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

/** Avg ticket size (Lakh): from MTD/LMTD spreadsheet data */
const AVG_ATS = 1.83;
/** Used only when LMSD data is not available (avoid for amount – LMSD can be higher than MTD) */
const LMTD_FACTOR = 0.94;
// Fallback AOP (Feb'26 month target, Cr) when Disbursement_Summary_Overall.csv not loaded
// AOP (Feb'26 month target, Cr) per screenshot: SMFG 1375, PIRAMAL 140, NACL 130, MFL 130, PAYU 115, SRIRAM 100, KSF 100, TCL 15, UCL 0. Total 2105.
const LENDER_AOP_FALLBACK: Record<string, number> = {
  SMFG: 1375, PIRAMAL: 140, Piramal: 140, NACL: 130, MFL: 130, PAYU: 115,
  SRIRAM: 100, KSF: 100, TCL: 15, UCL: 0,
};
const TOTAL_AOP_FALLBACK = 2105;
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

// Raw MTD/LMTD data by product (lender, program, policy). Used for Disb count modal with FR split.
interface RawMTDLMTDRow {
  product_id: number;
  lender: string;
  program: string; // "FR" | "Topup" | "BT" | "AD"
  policy: string;  // "" | "Bureau" | "Banking" | "GST" | "GMV"
  mtd_lead_count: number;
  mtd_loan_amount_cr: number;
  mtd_ats: number;
  lmtd_lead_count: number;
  lmtd_loan_amount_cr: number;
  lmtd_ats: number;
}

// Raw MTD (Feb'26) / LMTD (Jan'26) from MTD_LMTD_data.csv. FR split applied in expandWithFRSplit.
const RAW_MTD_LMTD_DATA: RawMTDLMTDRow[] = [
  { product_id: 88, lender: "SMFG", program: "Topup", policy: "", mtd_lead_count: 23231, mtd_loan_amount_cr: 784.79, mtd_ats: 337821, lmtd_lead_count: 26067, lmtd_loan_amount_cr: 870.80, lmtd_ats: 334061 },
  { product_id: 85, lender: "SMFG", program: "FR", policy: "", mtd_lead_count: 23145, mtd_loan_amount_cr: 381.37, mtd_ats: 164772, lmtd_lead_count: 22995, lmtd_loan_amount_cr: 401.42, lmtd_ats: 174570 },
  { product_id: 291, lender: "KSF", program: "FR", policy: "", mtd_lead_count: 13015, mtd_loan_amount_cr: 131.06, mtd_ats: 100700, lmtd_lead_count: 13413, lmtd_loan_amount_cr: 125.71, lmtd_ats: 93724 },
  { product_id: 253, lender: "PAYU", program: "FR", policy: "", mtd_lead_count: 6975, mtd_loan_amount_cr: 128.79, mtd_ats: 184641, lmtd_lead_count: 7148, lmtd_loan_amount_cr: 129.62, lmtd_ats: 181330 },
  { product_id: 106, lender: "PAYU", program: "FR", policy: "", mtd_lead_count: 7317, mtd_loan_amount_cr: 95.11, mtd_ats: 129982, lmtd_lead_count: 8165, lmtd_loan_amount_cr: 100.51, lmtd_ats: 123103 },
  { product_id: 221, lender: "NACL", program: "FR", policy: "", mtd_lead_count: 3928, mtd_loan_amount_cr: 79.49, mtd_ats: 202367, lmtd_lead_count: 3389, lmtd_loan_amount_cr: 72.69, lmtd_ats: 214496 },
  { product_id: 87, lender: "Piramal", program: "FR", policy: "", mtd_lead_count: 4970, mtd_loan_amount_cr: 69.53, mtd_ats: 139892, lmtd_lead_count: 6917, lmtd_loan_amount_cr: 100.19, lmtd_ats: 144839 },
  { product_id: 509, lender: "SMFG", program: "FR", policy: "Bureau", mtd_lead_count: 7966, mtd_loan_amount_cr: 65.59, mtd_ats: 82332, lmtd_lead_count: 921, lmtd_loan_amount_cr: 8.56, lmtd_ats: 92906 },
  { product_id: 90, lender: "Piramal", program: "Topup", policy: "", mtd_lead_count: 1781, mtd_loan_amount_cr: 45.27, mtd_ats: 254197, lmtd_lead_count: 1958, lmtd_loan_amount_cr: 50.43, lmtd_ats: 257578 },
  { product_id: 124, lender: "MFL", program: "FR", policy: "", mtd_lead_count: 3446, mtd_loan_amount_cr: 43.33, mtd_ats: 125750, lmtd_lead_count: 5545, lmtd_loan_amount_cr: 82.40, lmtd_ats: 148605 },
  { product_id: 503, lender: "NACL", program: "Topup", policy: "", mtd_lead_count: 1637, mtd_loan_amount_cr: 39.56, mtd_ats: 241682, lmtd_lead_count: 1582, lmtd_loan_amount_cr: 38.27, lmtd_ats: 241898 },
  { product_id: 324, lender: "MFL", program: "Topup", policy: "", mtd_lead_count: 1940, mtd_loan_amount_cr: 39.55, mtd_ats: 203881, lmtd_lead_count: 1798, lmtd_loan_amount_cr: 35.20, lmtd_ats: 195749 },
  { product_id: 508, lender: "Piramal", program: "BT", policy: "", mtd_lead_count: 519, mtd_loan_amount_cr: 14.95, mtd_ats: 288048, lmtd_lead_count: 664, lmtd_loan_amount_cr: 20.65, lmtd_ats: 310925 },
  { product_id: 311, lender: "Piramal", program: "FR", policy: "Banking", mtd_lead_count: 1418, mtd_loan_amount_cr: 12.35, mtd_ats: 87062, lmtd_lead_count: 277, lmtd_loan_amount_cr: 3.17, lmtd_ats: 114588 },
  { product_id: 316, lender: "TCL", program: "FR", policy: "", mtd_lead_count: 312, mtd_loan_amount_cr: 6.81, mtd_ats: 218365, lmtd_lead_count: 441, lmtd_loan_amount_cr: 10.88, lmtd_ats: 246642 },
  { product_id: 89, lender: "SMFG", program: "AD", policy: "", mtd_lead_count: 467, mtd_loan_amount_cr: 6.79, mtd_ats: 145347, lmtd_lead_count: 303, lmtd_loan_amount_cr: 3.28, lmtd_ats: 108116 },
  { product_id: 515, lender: "KSF", program: "Topup", policy: "", mtd_lead_count: 348, mtd_loan_amount_cr: 4.90, mtd_ats: 140664, lmtd_lead_count: 0, lmtd_loan_amount_cr: 0, lmtd_ats: 0 },
];

// FR split: count 60% Fresh / 40% Renewal; amount 40% Fresh / 60% Renewal (Renewal ATS higher)
function expandWithFRSplit(rows: RawMTDLMTDRow[]): { lender: string; program: string; policy: string; mtd_count: number; mtd_amt_cr: number; mtd_ats: number; lmtd_count: number; lmtd_amt_cr: number; lmtd_ats: number }[] {
  const out: { lender: string; program: string; policy: string; mtd_count: number; mtd_amt_cr: number; mtd_ats: number; lmtd_count: number; lmtd_amt_cr: number; lmtd_ats: number }[] = [];
  for (const r of rows) {
    if (r.program === "FR") {
      const freshCountMtd = r.mtd_lead_count * 0.6;
      const renewalCountMtd = r.mtd_lead_count * 0.4;
      const freshAmtMtd = r.mtd_loan_amount_cr * 0.4;
      const renewalAmtMtd = r.mtd_loan_amount_cr * 0.6;
      const freshCountLmtd = r.lmtd_lead_count * 0.6;
      const renewalCountLmtd = r.lmtd_lead_count * 0.4;
      const freshAmtLmtd = r.lmtd_loan_amount_cr * 0.4;
      const renewalAmtLmtd = r.lmtd_loan_amount_cr * 0.6;
      const fCount = Math.round(freshCountMtd);
      const rCount = Math.round(renewalCountMtd);
      const fAmt = Math.round(freshAmtMtd * 100) / 100;
      const rAmt = Math.round(renewalAmtMtd * 100) / 100;
      const fCountL = Math.round(freshCountLmtd);
      const rCountL = Math.round(renewalCountLmtd);
      const fAmtL = Math.round(freshAmtLmtd * 100) / 100;
      const rAmtL = Math.round(renewalAmtLmtd * 100) / 100;
      out.push({
        lender: r.lender,
        program: "Fresh",
        policy: r.policy,
        mtd_count: fCount,
        mtd_amt_cr: fAmt,
        mtd_ats: fCount > 0 ? Math.round((fAmt * 1e7) / fCount) : 0,
        lmtd_count: fCountL,
        lmtd_amt_cr: fAmtL,
        lmtd_ats: fCountL > 0 ? Math.round((fAmtL * 1e7) / fCountL) : 0,
      });
      out.push({
        lender: r.lender,
        program: "Renewal",
        policy: r.policy,
        mtd_count: rCount,
        mtd_amt_cr: rAmt,
        mtd_ats: rCount > 0 ? Math.round((rAmt * 1e7) / rCount) : 0,
        lmtd_count: rCountL,
        lmtd_amt_cr: rAmtL,
        lmtd_ats: rCountL > 0 ? Math.round((rAmtL * 1e7) / rCountL) : 0,
      });
    } else {
      out.push({
        lender: r.lender,
        program: r.program,
        policy: r.policy,
        mtd_count: r.mtd_lead_count,
        mtd_amt_cr: r.mtd_loan_amount_cr,
        mtd_ats: r.mtd_ats,
        lmtd_count: r.lmtd_lead_count,
        lmtd_amt_cr: r.lmtd_loan_amount_cr,
        lmtd_ats: r.lmtd_ats,
      });
    }
  }
  return out;
}

// Program-type data: Loan and Disb Amt(Cr) by Feb-26 / Jan-26 (for Disb count modal) — derived from raw + FR split when using MTD/LMTD data
const PROGRAM_TYPE_DATA: { program_type: string; feb26_loan: number; feb26_amt_cr: number; jan26_loan: number; jan26_amt_cr: number }[] = [
  { program_type: "AD", feb26_loan: 488, feb26_amt_cr: 7.12, jan26_loan: 305, jan26_amt_cr: 3.3 },
  { program_type: "FRESH", feb26_loan: 54902, feb26_amt_cr: 653.31, jan26_loan: 53589, jan26_amt_cr: 673.38 },
  { program_type: "RENEWAL", feb26_loan: 19515, feb26_amt_cr: 383.09, jan26_loan: 17088, jan26_amt_cr: 381.88 },
  { program_type: "TOP UP", feb26_loan: 30154, feb26_amt_cr: 948.82, jan26_loan: 32813, jan26_amt_cr: 1039.44 },
  { program_type: "BT", feb26_loan: 0, feb26_amt_cr: 0, jan26_loan: 0, jan26_amt_cr: 0 },
];

export default function DisbursalSummary() {
  const { global, useGlobalFilters } = useFilters();
  const { periodLabel: pL, compareLabel: cL } = useDateRangeFactors();
  const [rawData, setRawData] = useState<DisbursalSummaryRow[]>([]);
  const [trends, setTrends] = useState<MonthlyTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpiDive, setKpiDive] = useState<{ open: boolean; config: KpiDeepDiveConfig | null }>({ open: false, config: null });
  const [disbCountModalOpen, setDisbCountModalOpen] = useState(false);
  const [disbCountView, setDisbCountView] = useState<"lender-wise" | "program-wise" | "policy-wise">("lender-wise");
  const [disbCountExpandedLender, setDisbCountExpandedLender] = useState<string | null>(null);
  const [trendLenderPopup, setTrendLenderPopup] = useState<string | null>(null);
  const [expandedProgramForLender, setExpandedProgramForLender] = useState<string | null>(null);
  const [expandedPolicyForLender, setExpandedPolicyForLender] = useState<string | null>(null);

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
  // AOP from screenshot (2105 total); fallback overrides API so table always shows correct AOP.
  const totalAop = TOTAL_AOP_FALLBACK;
  const lenderAopMap = useMemo(() => {
    const m: Record<string, number> = {};
    if (summaryOverall.length > 0) summaryOverall.forEach((r) => { m[r.lender] = r.aop; });
    return { ...m, ...LENDER_AOP_FALLBACK };
  }, [summaryOverall]);

  // ─── Raw MTD/LMTD (spreadsheet) as primary for this page: 102,415 MTD, 101,984 LMTD ───
  const expandedMTDLMTD = useMemo(() => expandWithFRSplit(RAW_MTD_LMTD_DATA), []);
  const mtdLmtdTotalCount = useMemo(() => expandedMTDLMTD.reduce((s, r) => s + r.mtd_count, 0), [expandedMTDLMTD]);
  const mtdLmtdTotalAmt = useMemo(() => expandedMTDLMTD.reduce((s, r) => s + r.mtd_amt_cr, 0), [expandedMTDLMTD]);
  const lmtdTotalCount = useMemo(() => expandedMTDLMTD.reduce((s, r) => s + r.lmtd_count, 0), [expandedMTDLMTD]);
  const lmtdTotalAmt = useMemo(() => expandedMTDLMTD.reduce((s, r) => s + r.lmtd_amt_cr, 0), [expandedMTDLMTD]);
  const mtdLmtdLenderRowsForPage = useMemo(() => {
    const byL: Record<string, { mtd_count: number; mtd_amt_cr: number; lmtd_count: number; lmtd_amt_cr: number }> = {};
    expandedMTDLMTD.forEach((r) => {
      if (!byL[r.lender]) byL[r.lender] = { mtd_count: 0, mtd_amt_cr: 0, lmtd_count: 0, lmtd_amt_cr: 0 };
      byL[r.lender].mtd_count += r.mtd_count;
      byL[r.lender].mtd_amt_cr += r.mtd_amt_cr;
      byL[r.lender].lmtd_count += r.lmtd_count;
      byL[r.lender].lmtd_amt_cr += r.lmtd_amt_cr;
    });
    const total = mtdLmtdTotalCount;
    const totalAmt = mtdLmtdTotalAmt;
    return Object.entries(byL)
      .map(([lender, v]) => {
        const growth = v.lmtd_amt_cr > 0 ? ((v.mtd_amt_cr - v.lmtd_amt_cr) / v.lmtd_amt_cr) * 100 : 0;
        return {
          lender,
          mtdCount: v.mtd_count,
          amtCr: v.mtd_amt_cr,
          lmtdCount: v.lmtd_count,
          lmtdAmtCr: v.lmtd_amt_cr,
          share: total > 0 ? (v.mtd_count / total) * 100 : 0,
          growth,
        };
      })
      .sort((a, b) => b.mtdCount - a.mtdCount);
  }, [expandedMTDLMTD, mtdLmtdTotalCount, mtdLmtdTotalAmt]);

  // ─── Top-level Aggregates (from raw spreadsheet data for Disbursal Summary page) ───
  const totalDisbursed = mtdLmtdTotalCount;
  const totalChildLeads = useMemo(() => data.reduce((s, r) => s + r.child_leads, 0), [data]);
  const amountCr = mtdLmtdTotalAmt;
  const lmtdDisbursed = lmtdTotalCount;
  const lmtdAmountCr = lmtdTotalAmt;
  const disbGrowth = lmtdDisbursed > 0 ? ((totalDisbursed - lmtdDisbursed) / lmtdDisbursed) * 100 : 0;
  const amtGrowth = lmtdAmountCr > 0 ? ((amountCr - lmtdAmountCr) / lmtdAmountCr) * 100 : 0;
  const convPct = totalChildLeads > 0 ? (totalDisbursed / totalChildLeads) * 100 : 0;
  const lmtdConv = totalChildLeads > 0 && lmtdDisbursed > 0 ? (lmtdDisbursed / Math.round(totalChildLeads * (totalDisbursed > 0 ? lmtdDisbursed / totalDisbursed : LMTD_FACTOR))) * 100 : 0;
  const convDelta = convPct - lmtdConv;

  const runRateCr = (amountCr / DAYS_ELAPSED) * TOTAL_DAYS;
  const monthlyAopTarget = totalAop; // AOP = Feb'26 month target (Cr)
  const runRatePacingPct = monthlyAopTarget > 0 ? (runRateCr / monthlyAopTarget) * 100 : 0;

  // ─── By-Lender (from raw MTD/LMTD for page consistency) ───
  const byLender = useMemo(() => mtdLmtdLenderRowsForPage.map((row) => ({
    lender: row.lender,
    disbursed: row.mtdCount,
    amount_cr: row.amtCr,
    lmtd_disb: row.lmtdCount,
    lmtd_amount_cr: row.lmtdAmtCr,
    child: 0,
    conv: 0,
    aop: lenderAopMap[row.lender] ?? 0,
    growth: row.growth,
    share: row.share,
  })), [mtdLmtdLenderRowsForPage, lenderAopMap]);

  // Disbursement Summary (Overall) table from raw data + AOP
  const displaySummaryOverall = useMemo(() => mtdLmtdLenderRowsForPage.map((row) => ({
    lender: row.lender,
    aop: lenderAopMap[row.lender] ?? 0,
    mtd_cr: row.amtCr,
    lmsd_cr: row.lmtdAmtCr,
  })), [mtdLmtdLenderRowsForPage, lenderAopMap]);

  // MTD / LMTD lender tables from raw spreadsheet (so "MTD DISBURSAL (Lender)" shows 102,415 not API 83,401)
  const mtdLenderDisplay = useMemo((): DisbursalBreakdownLenderRow[] => mtdLmtdLenderRowsForPage.map((row) => ({
    lender: row.lender,
    loan: row.mtdCount,
    amt_cr: row.amtCr,
    ats: row.mtdCount > 0 ? Math.round((row.amtCr * 1e7) / row.mtdCount) : 0,
    avg: 0,
    avg_pf: 0,
  })), [mtdLmtdLenderRowsForPage]);
  const lmsdLenderDisplay = useMemo((): DisbursalBreakdownLenderRow[] => mtdLmtdLenderRowsForPage.map((row) => ({
    lender: row.lender,
    loan: row.lmtdCount,
    amt_cr: row.lmtdAmtCr,
    ats: row.lmtdCount > 0 ? Math.round((row.lmtdAmtCr * 1e7) / row.lmtdCount) : 0,
    avg: 0,
    avg_pf: 0,
  })), [mtdLmtdLenderRowsForPage]);

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

  // Extended lender rows for Disb count modal: ATS, lead growth, disb growth, ATS change, share change
  const disbCountLenderRows = useMemo(() => {
    const mtdByLender: Record<string, { loan: number; amt_cr: number; ats: number }> = {};
    mtdLender.forEach((r) => { mtdByLender[r.lender] = { loan: r.loan, amt_cr: r.amt_cr, ats: r.ats }; });
    const lmsdByLender: Record<string, { loan: number; amt_cr: number; ats: number }> = {};
    lmsdLender.forEach((r) => { lmsdByLender[r.lender] = { loan: r.loan, amt_cr: r.amt_cr, ats: r.ats }; });
    const shareShiftMap: Record<string, number> = {};
    concentrationData.shareShifts.forEach((s) => { shareShiftMap[s.lender] = s.shift; });
    return byLender.map((l) => {
      const mtd = mtdByLender[l.lender];
      const lmsd = lmsdByLender[l.lender];
      const ats = mtd?.ats ?? (l.disbursed > 0 ? (l.amount_cr * 100) / l.disbursed : 0);
      const lmtdAts = lmsd?.ats ?? (l.lmtd_disb > 0 ? (l.lmtd_amount_cr * 100) / l.lmtd_disb : 0);
      const disbGrowthPct = l.lmtd_disb > 0 ? ((l.disbursed - l.lmtd_disb) / l.lmtd_disb) * 100 : null;
      const atsChangePct = lmtdAts > 0 ? ((ats - lmtdAts) / lmtdAts) * 100 : null;
      const shareChangePp = shareShiftMap[l.lender] ?? null;
      return {
        lender: l.lender,
        mtdCount: l.disbursed,
        amtCr: l.amount_cr,
        ats,
        share: l.share,
        leadGrowthPct: null as number | null,
        disbGrowthPct,
        atsChangePct,
        shareChangePp,
      };
    });
  }, [byLender, mtdLender, lmsdLender, concentrationData.shareShifts]);

  // Program-wise rows for Disb count modal: use PROGRAM_TYPE_DATA (Feb-26 / Jan-26 Loan & Disb Amt(Cr))
  const disbCountProgramRows = PROGRAM_TYPE_DATA;

  // ─── Modal tables: lender/program/policy from same raw data ───
  const mtdLmtdLenderRows = useMemo(() => {
    const byL: Record<string, { mtd_count: number; mtd_amt_cr: number; lmtd_count: number; lmtd_amt_cr: number }> = {};
    expandedMTDLMTD.forEach((r) => {
      if (!byL[r.lender]) byL[r.lender] = { mtd_count: 0, mtd_amt_cr: 0, lmtd_count: 0, lmtd_amt_cr: 0 };
      byL[r.lender].mtd_count += r.mtd_count;
      byL[r.lender].mtd_amt_cr += r.mtd_amt_cr;
      byL[r.lender].lmtd_count += r.lmtd_count;
      byL[r.lender].lmtd_amt_cr += r.lmtd_amt_cr;
    });
    const total = mtdLmtdTotalCount;
    return Object.entries(byL)
      .map(([lender, v]) => {
        const mtdCount = v.mtd_count;
        const lmtdCount = v.lmtd_count;
        const ats = mtdCount > 0 ? (v.mtd_amt_cr * 1e7) / mtdCount : 0;
        const lmtdAts = lmtdCount > 0 ? (v.lmtd_amt_cr * 1e7) / lmtdCount : 0;
        const share = total > 0 ? (mtdCount / total) * 100 : 0;
        const disbGrowthPct = lmtdCount > 0 ? ((mtdCount - lmtdCount) / lmtdCount) * 100 : null;
        const amtGrowthPct = v.lmtd_amt_cr > 0 ? ((v.mtd_amt_cr - v.lmtd_amt_cr) / v.lmtd_amt_cr) * 100 : null;
        const atsChangePct = lmtdAts > 0 ? ((ats - lmtdAts) / lmtdAts) * 100 : null;
        const myShareLmtd = lmtdTotalCount > 0 ? (lmtdCount / lmtdTotalCount) * 100 : 0;
        const shareChangePp = Math.round((share - myShareLmtd) * 10) / 10;
        return {
          lender,
          mtdCount,
          amtCr: v.mtd_amt_cr,
          ats: Math.round(ats),
          lmtdCount,
          lmtdAmtCr: v.lmtd_amt_cr,
          lmtdAts: Math.round(lmtdAts),
          share,
          leadGrowthPct: null as number | null,
          disbGrowthPct,
          amtGrowthPct,
          atsChangePct,
          shareChangePp,
        };
      })
      .sort((a, b) => b.mtdCount - a.mtdCount);
  }, [expandedMTDLMTD, mtdLmtdTotalCount, lmtdTotalCount]);

  const mtdLmtdProgramRows = useMemo(() => {
    const byP: Record<string, { mtd_count: number; mtd_amt_cr: number; mtd_ats: number; lmtd_count: number; lmtd_amt_cr: number; lmtd_ats: number }> = {};
    const programOrder = ["Fresh", "Renewal", "Topup", "AD", "BT"];
    programOrder.forEach((p) => { byP[p] = { mtd_count: 0, mtd_amt_cr: 0, mtd_ats: 0, lmtd_count: 0, lmtd_amt_cr: 0, lmtd_ats: 0 }; });
    expandedMTDLMTD.forEach((r) => {
      const p = r.program === "Topup" ? "Topup" : r.program;
      if (byP[p]) {
        byP[p].mtd_count += r.mtd_count;
        byP[p].mtd_amt_cr += r.mtd_amt_cr;
        byP[p].lmtd_count += r.lmtd_count;
        byP[p].lmtd_amt_cr += r.lmtd_amt_cr;
      }
    });
    return programOrder.map((program_type) => {
      const v = byP[program_type];
      const feb26_ats = v.mtd_count > 0 ? Math.round((v.mtd_amt_cr * 1e7) / v.mtd_count) : 0;
      const jan26_ats = v.lmtd_count > 0 ? Math.round((v.lmtd_amt_cr * 1e7) / v.lmtd_count) : 0;
      const countGrowthPct = v.lmtd_count > 0 ? ((v.mtd_count - v.lmtd_count) / v.lmtd_count) * 100 : null;
      return {
        program_type,
        feb26_loan: v.mtd_count,
        feb26_amt_cr: Math.round(v.mtd_amt_cr * 100) / 100,
        feb26_ats: feb26_ats,
        jan26_loan: v.lmtd_count,
        jan26_amt_cr: Math.round(v.lmtd_amt_cr * 100) / 100,
        jan26_ats: jan26_ats,
        countGrowthPct,
      };
    });
  }, [expandedMTDLMTD]);

  const mtdLmtdPolicyRows = useMemo(() => {
    const byPolicy: Record<string, { mtd_count: number; mtd_amt_cr: number; lmtd_count: number; lmtd_amt_cr: number }> = {};
    expandedMTDLMTD.forEach((r) => {
      const key = (r.policy && r.policy.trim()) || "GMV";
      if (!byPolicy[key]) byPolicy[key] = { mtd_count: 0, mtd_amt_cr: 0, lmtd_count: 0, lmtd_amt_cr: 0 };
      byPolicy[key].mtd_count += r.mtd_count;
      byPolicy[key].mtd_amt_cr += r.mtd_amt_cr;
      byPolicy[key].lmtd_count += r.lmtd_count;
      byPolicy[key].lmtd_amt_cr += r.lmtd_amt_cr;
    });
    const order = ["GMV", "Bureau", "GST", "Banking"];
    const total = mtdLmtdTotalCount;
    return order.map((policy) => {
      const v = byPolicy[policy] || { mtd_count: 0, mtd_amt_cr: 0, lmtd_count: 0, lmtd_amt_cr: 0 };
      const share = total > 0 ? (v.mtd_count / total) * 100 : 0;
      const mtdAts = v.mtd_count > 0 ? Math.round((v.mtd_amt_cr * 1e7) / v.mtd_count) : 0;
      const lmtdAts = v.lmtd_count > 0 ? Math.round((v.lmtd_amt_cr * 1e7) / v.lmtd_count) : 0;
      const countGrowthPct = v.lmtd_count > 0 ? ((v.mtd_count - v.lmtd_count) / v.lmtd_count) * 100 : null;
      return {
        policy,
        mtdCount: v.mtd_count,
        amtCr: v.mtd_amt_cr,
        mtdAts,
        lmtdCount: v.lmtd_count,
        lmtdAmtCr: v.lmtd_amt_cr,
        lmtdAts,
        share,
        countGrowthPct,
      };
    });
  }, [expandedMTDLMTD, mtdLmtdTotalCount]);

  // Per-program lender breakdown (for program-wise tab: click program → show lenders)
  const programLenderBreakdown = useMemo(() => {
    const out: Record<string, { lender: string; mtdCount: number; amtCr: number; ats: number; lmtdCount: number; lmtdAmtCr: number; lmtdAts: number; share: number; disbGrowthPct: number | null; amtGrowthPct: number | null; atsChangePct: number | null; shareChangePp: number }[]> = {};
    const programKeys = ["Fresh", "Renewal", "Topup", "AD", "BT"];
    programKeys.forEach((prog) => {
      const programFilter = (r: { program: string }) => (r.program === "Topup" ? "Topup" : r.program) === prog;
      const byL: Record<string, { mtd_count: number; mtd_amt_cr: number; lmtd_count: number; lmtd_amt_cr: number }> = {};
      expandedMTDLMTD.filter((r) => programFilter(r)).forEach((r) => {
        if (!byL[r.lender]) byL[r.lender] = { mtd_count: 0, mtd_amt_cr: 0, lmtd_count: 0, lmtd_amt_cr: 0 };
        byL[r.lender].mtd_count += r.mtd_count;
        byL[r.lender].mtd_amt_cr += r.mtd_amt_cr;
        byL[r.lender].lmtd_count += r.lmtd_count;
        byL[r.lender].lmtd_amt_cr += r.lmtd_amt_cr;
      });
      const progTotal = Object.values(byL).reduce((s, v) => s + v.mtd_count, 0);
      const progLmtdTotal = Object.values(byL).reduce((s, v) => s + v.lmtd_count, 0);
      out[prog] = Object.entries(byL)
        .map(([lender, v]) => {
          const ats = v.mtd_count > 0 ? Math.round((v.mtd_amt_cr * 1e7) / v.mtd_count) : 0;
          const lmtdAts = v.lmtd_count > 0 ? Math.round((v.lmtd_amt_cr * 1e7) / v.lmtd_count) : 0;
          const share = progTotal > 0 ? (v.mtd_count / progTotal) * 100 : 0;
          const disbGrowthPct = v.lmtd_count > 0 ? ((v.mtd_count - v.lmtd_count) / v.lmtd_count) * 100 : null;
          const amtGrowthPct = v.lmtd_amt_cr > 0 ? ((v.mtd_amt_cr - v.lmtd_amt_cr) / v.lmtd_amt_cr) * 100 : null;
          const atsChangePct = lmtdAts > 0 ? ((ats - lmtdAts) / lmtdAts) * 100 : null;
          const shareLmtd = progLmtdTotal > 0 ? (v.lmtd_count / progLmtdTotal) * 100 : 0;
          const shareChangePp = Math.round((share - shareLmtd) * 10) / 10;
          return {
            lender,
            mtdCount: v.mtd_count,
            amtCr: v.mtd_amt_cr,
            ats,
            lmtdCount: v.lmtd_count,
            lmtdAmtCr: v.lmtd_amt_cr,
            lmtdAts,
            share,
            disbGrowthPct,
            amtGrowthPct,
            atsChangePct,
            shareChangePp,
          };
        })
        .sort((a, b) => b.mtdCount - a.mtdCount);
    });
    return out;
  }, [expandedMTDLMTD]);

  // Per-policy lender breakdown (for policy-wise tab: click policy → show lenders)
  const policyLenderBreakdown = useMemo(() => {
    const out: Record<string, { lender: string; mtdCount: number; amtCr: number; ats: number; lmtdCount: number; lmtdAmtCr: number; lmtdAts: number; share: number; disbGrowthPct: number | null; amtGrowthPct: number | null; atsChangePct: number | null; shareChangePp: number }[]> = {};
    const policyKeys = ["GMV", "Bureau", "GST", "Banking"];
    policyKeys.forEach((pol) => {
      const policyFilter = (r: { policy: string }) => ((r.policy && r.policy.trim()) || "GMV") === pol;
      const byL: Record<string, { mtd_count: number; mtd_amt_cr: number; lmtd_count: number; lmtd_amt_cr: number }> = {};
      expandedMTDLMTD.filter((r) => policyFilter(r)).forEach((r) => {
        if (!byL[r.lender]) byL[r.lender] = { mtd_count: 0, mtd_amt_cr: 0, lmtd_count: 0, lmtd_amt_cr: 0 };
        byL[r.lender].mtd_count += r.mtd_count;
        byL[r.lender].mtd_amt_cr += r.mtd_amt_cr;
        byL[r.lender].lmtd_count += r.lmtd_count;
        byL[r.lender].lmtd_amt_cr += r.lmtd_amt_cr;
      });
      const polTotal = Object.values(byL).reduce((s, v) => s + v.mtd_count, 0);
      const polLmtdTotal = Object.values(byL).reduce((s, v) => s + v.lmtd_count, 0);
      out[pol] = Object.entries(byL)
        .map(([lender, v]) => {
          const ats = v.mtd_count > 0 ? Math.round((v.mtd_amt_cr * 1e7) / v.mtd_count) : 0;
          const lmtdAts = v.lmtd_count > 0 ? Math.round((v.lmtd_amt_cr * 1e7) / v.lmtd_count) : 0;
          const share = polTotal > 0 ? (v.mtd_count / polTotal) * 100 : 0;
          const disbGrowthPct = v.lmtd_count > 0 ? ((v.mtd_count - v.lmtd_count) / v.lmtd_count) * 100 : null;
          const amtGrowthPct = v.lmtd_amt_cr > 0 ? ((v.mtd_amt_cr - v.lmtd_amt_cr) / v.lmtd_amt_cr) * 100 : null;
          const atsChangePct = lmtdAts > 0 ? ((ats - lmtdAts) / lmtdAts) * 100 : null;
          const shareLmtd = polLmtdTotal > 0 ? (v.lmtd_count / polLmtdTotal) * 100 : 0;
          const shareChangePp = Math.round((share - shareLmtd) * 10) / 10;
          return {
            lender,
            mtdCount: v.mtd_count,
            amtCr: v.mtd_amt_cr,
            ats,
            lmtdCount: v.lmtd_count,
            lmtdAmtCr: v.lmtd_amt_cr,
            lmtdAts,
            share,
            disbGrowthPct,
            amtGrowthPct,
            atsChangePct,
            shareChangePp,
          };
        })
        .sort((a, b) => b.mtdCount - a.mtdCount);
    });
    return out;
  }, [expandedMTDLMTD]);

  // Per-lender program breakdown from expanded data (for L2 drill-down in modal)
  const mtdLmtdLenderProgramBreakdown = useMemo(() => {
    const byLenderProgram: Record<string, Record<string, { feb26_loan: number; feb26_amt_cr: number; jan26_loan: number; jan26_amt_cr: number }>> = {};
    expandedMTDLMTD.forEach((r) => {
      const p = r.program === "Topup" ? "TOP UP" : r.program.toUpperCase();
      if (!byLenderProgram[r.lender]) byLenderProgram[r.lender] = {};
      if (!byLenderProgram[r.lender][p]) byLenderProgram[r.lender][p] = { feb26_loan: 0, feb26_amt_cr: 0, jan26_loan: 0, jan26_amt_cr: 0 };
      byLenderProgram[r.lender][p].feb26_loan += r.mtd_count;
      byLenderProgram[r.lender][p].feb26_amt_cr += r.mtd_amt_cr;
      byLenderProgram[r.lender][p].jan26_loan += r.lmtd_count;
      byLenderProgram[r.lender][p].jan26_amt_cr += r.lmtd_amt_cr;
    });
    const programOrder = ["FRESH", "RENEWAL", "TOP UP", "AD", "BT"];
    const result: Record<string, { program_type: string; feb26_loan: number; feb26_amt_cr: number; jan26_loan: number; jan26_amt_cr: number }[]> = {};
    Object.keys(byLenderProgram).forEach((lender) => {
      result[lender] = programOrder
        .filter((p) => byLenderProgram[lender][p] && (byLenderProgram[lender][p].feb26_loan > 0 || byLenderProgram[lender][p].jan26_loan > 0))
        .map((p) => ({
          program_type: p,
          feb26_loan: byLenderProgram[lender][p].feb26_loan,
          feb26_amt_cr: Math.round(byLenderProgram[lender][p].feb26_amt_cr * 100) / 100,
          jan26_loan: byLenderProgram[lender][p].jan26_loan,
          jan26_amt_cr: Math.round(byLenderProgram[lender][p].jan26_amt_cr * 100) / 100,
        }));
    });
    return result;
  }, [expandedMTDLMTD]);

  // Per-lender day-wise cumulative (Cr) for trend popup: actual vs AOP target
  const lenderTrendDayData = useMemo(() => {
    const out: Record<string, { day: string; cumActual: number; cumTarget: number }[]> = {};
    mtdLmtdLenderRows.forEach((row) => {
      const aop = lenderAopMap[row.lender] ?? 0;
      const days: { day: string; cumActual: number; cumTarget: number }[] = [];
      for (let d = 1; d <= TOTAL_DAYS; d++) {
        const cumActual = d <= DAYS_ELAPSED ? row.amtCr * (d / DAYS_ELAPSED) : row.amtCr;
        const cumTarget = aop * (d / TOTAL_DAYS);
        days.push({ day: `D${d}`, cumActual: Math.round(cumActual * 100) / 100, cumTarget: Math.round(cumTarget * 100) / 100 });
      }
      out[row.lender] = days;
    });
    return out;
  }, [mtdLmtdLenderRows, lenderAopMap]);

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
          <ClickableKpiCard onClick={() => { setDisbCountModalOpen(true); }} data-disb-count-card>
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
              <p className="text-[10px] text-muted-foreground">
                Lender | AOP (Feb&apos;26 target, Cr) | MTD | LMSD | Growth% — Total AOP: {totalAop.toLocaleString("en-IN")} Cr
                {process.env.NEXT_PUBLIC_BUILD_ID ? ` · Build ${process.env.NEXT_PUBLIC_BUILD_ID}` : ""}
              </p>
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
                    {displaySummaryOverall.map((r) => {
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
                    {displaySummaryOverall.length > 0 && (
                      <TableRow className="bg-muted/40 font-bold border-t-2">
                        <TableCell className="text-xs font-bold py-2">Summary</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">
                          {totalAop.toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell className="text-xs text-right tabular-nums">
                          {displaySummaryOverall.reduce((s, r) => s + r.mtd_cr, 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-xs text-right tabular-nums">
                          {displaySummaryOverall.reduce((s, r) => s + r.lmsd_cr, 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right py-2">
                          {(() => {
                            const tMtd = displaySummaryOverall.reduce((s, r) => s + r.mtd_cr, 0);
                            const tLmsd = displaySummaryOverall.reduce((s, r) => s + r.lmsd_cr, 0);
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
                      {(disbPeriodTab === "MTD" ? mtdLenderDisplay : disbPeriodTab === "LMTD" ? lmsdLenderDisplay : ftdLender ?? []).map((r) => (
                        <TableRow key={r.lender} className="hover:bg-muted/20">
                          <TableCell className="text-xs font-medium py-2">{r.lender}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{r.loan.toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{r.amt_cr.toFixed(2)}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{r.ats.toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{r.avg.toFixed(2)}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{r.avg_pf.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                      {disbPeriodTab === "MTD" && mtdLenderDisplay.length > 0 && (
                        <TableRow className="bg-muted/40 font-bold border-t-2">
                          <TableCell className="text-xs font-bold py-2">Summary</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{mtdLenderDisplay.reduce((s, r) => s + r.loan, 0).toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{mtdLenderDisplay.reduce((s, r) => s + r.amt_cr, 0).toFixed(2)}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">
                            {mtdLenderDisplay.reduce((s, r) => s + r.loan, 0) > 0
                              ? Math.round(mtdLenderDisplay.reduce((s, r) => s + r.ats * r.loan, 0) / mtdLenderDisplay.reduce((s, r) => s + r.loan, 0)).toLocaleString("en-IN")
                              : "-"}
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums">
                            {mtdLenderDisplay.length ? (mtdLenderDisplay.reduce((s, r) => s + r.avg, 0) / mtdLenderDisplay.length).toFixed(2) : "-"}
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums">
                            {mtdLenderDisplay.length ? (mtdLenderDisplay.reduce((s, r) => s + r.avg_pf, 0) / mtdLenderDisplay.length).toFixed(2) : "-"}
                          </TableCell>
                        </TableRow>
                      )}
                      {disbPeriodTab === "LMTD" && lmsdLenderDisplay.length > 0 && (
                        <TableRow className="bg-muted/40 font-bold border-t-2">
                          <TableCell className="text-xs font-bold py-2">Summary</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{lmsdLenderDisplay.reduce((s, r) => s + r.loan, 0).toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{lmsdLenderDisplay.reduce((s, r) => s + r.amt_cr, 0).toFixed(2)}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">
                            {lmsdLenderDisplay.reduce((s, r) => s + r.loan, 0) > 0
                              ? Math.round(lmsdLenderDisplay.reduce((s, r) => s + r.ats * r.loan, 0) / lmsdLenderDisplay.reduce((s, r) => s + r.loan, 0)).toLocaleString("en-IN")
                              : "-"}
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums">
                            {lmsdLenderDisplay.length ? (lmsdLenderDisplay.reduce((s, r) => s + r.avg, 0) / lmsdLenderDisplay.length).toFixed(2) : "-"}
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums">
                            {lmsdLenderDisplay.length ? (lmsdLenderDisplay.reduce((s, r) => s + r.avg_pf, 0) / lmsdLenderDisplay.length).toFixed(2) : "-"}
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
                      {(disbPeriodTab === "MTD" ? mtdLeadType : disbPeriodTab === "LMTD" ? lmsdLeadType : ftdLeadType ?? []).map((r) => (
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
      </div>

      <KpiDeepDiveModal open={kpiDive.open} onClose={() => setKpiDive({ open: false, config: null })} config={kpiDive.config} />

      {/* Disb. count custom modal: no graph, view toggles, Analysis before table, program data, lender L2 drill-down */}
      <Dialog open={disbCountModalOpen} onOpenChange={(v) => { if (!v) { setDisbCountModalOpen(false); setDisbCountExpandedLender(null); setTrendLenderPopup(null); setExpandedProgramForLender(null); setExpandedPolicyForLender(null); } }}>
        <DialogContent
          className="max-h-[90vh] overflow-y-auto"
          style={{ maxWidth: "min(1400px, 95vw)", width: "95vw" }}
          data-modal="disb-count"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span>Total Disbursed</span>
              <Badge variant="outline" className="text-sm font-bold tabular-nums">
                {totalDisbursed.toLocaleString("en-IN")}
              </Badge>
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">from {totalChildLeads.toLocaleString("en-IN")} child leads</p>
          </DialogHeader>

          <div className="space-y-5 mt-2">
            {/* MTD vs LMTD overview (from raw data with FR split) */}
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">MTD vs LMTD Overview</p>
              <div className="grid grid-cols-3 gap-3">
                <Card className="bg-muted/20"><CardContent className="p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">MTD</p>
                  <p className="text-lg font-bold tabular-nums">{mtdLmtdTotalCount.toLocaleString("en-IN")} loans</p>
                  <p className="text-xs text-muted-foreground tabular-nums mt-0.5">₹{mtdLmtdTotalAmt.toFixed(1)} Cr</p>
                </CardContent></Card>
                <Card className="bg-muted/20"><CardContent className="p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">{cL}</p>
                  <p className="text-lg font-bold tabular-nums">{lmtdTotalCount.toLocaleString("en-IN")} loans</p>
                  <p className="text-xs text-muted-foreground tabular-nums mt-0.5">₹{lmtdTotalAmt.toFixed(1)} Cr</p>
                </CardContent></Card>
                <Card className="bg-muted/20"><CardContent className="p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">Growth</p>
                  <p className={cn("text-lg font-bold tabular-nums", lmtdTotalCount > 0 && ((mtdLmtdTotalCount - lmtdTotalCount) / lmtdTotalCount) * 100 >= 0 ? "text-emerald-600" : "text-red-600")}>
                    {lmtdTotalCount > 0 ? (mtdLmtdTotalCount - lmtdTotalCount) / lmtdTotalCount * 100 >= 0 ? "+" : "" : ""}{(lmtdTotalCount > 0 ? ((mtdLmtdTotalCount - lmtdTotalCount) / lmtdTotalCount) * 100 : 0).toFixed(1)}% vs prior
                  </p>
                  <p className={cn("text-xs tabular-nums mt-0.5", lmtdTotalAmt > 0 && ((mtdLmtdTotalAmt - lmtdTotalAmt) / lmtdTotalAmt) * 100 >= 0 ? "text-emerald-600" : "text-red-600")}>
                    {lmtdTotalAmt > 0
                      ? `${((mtdLmtdTotalAmt - lmtdTotalAmt) / lmtdTotalAmt * 100) >= 0 ? "+" : ""}${((mtdLmtdTotalAmt - lmtdTotalAmt) / lmtdTotalAmt * 100).toFixed(1)}% amt`
                      : "0% amt"}
                  </p>
                </CardContent></Card>
              </div>
            </div>

            {/* View options */}
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">View</p>
              <div className="flex flex-wrap gap-2">
                {(["lender-wise", "program-wise", "policy-wise"] as const).map((view) => (
                  <button
                    key={view}
                    type="button"
                    onClick={() => { setDisbCountView(view); setDisbCountExpandedLender(null); setExpandedProgramForLender(null); setExpandedPolicyForLender(null); }}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors",
                      disbCountView === view ? "bg-primary text-primary-foreground border-primary" : "bg-muted/30 border-border hover:bg-muted/50"
                    )}
                  >
                    {view === "lender-wise" && "Lender-wise"}
                    {view === "program-wise" && "Program-wise"}
                    {view === "policy-wise" && "Policy-wise"}
                  </button>
                ))}
              </div>
              <p className="text-[9px] text-muted-foreground mt-1">
                {disbCountView === "lender-wise" && "SMFG, Shriram, Piramal, MFL, NACL, PayU, KSF, TCL"}
                {disbCountView === "program-wise" && "Fresh, Renewal, AD, Topup, BT"}
                {disbCountView === "policy-wise" && "GMV, Bureau, GST, Banking"}
              </p>
            </div>

            {/* Analysis (before table) — detailed, Funnel-style with color coding */}
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Analysis</p>
              <ul className="space-y-2 pl-1 text-xs">
                <li className="flex gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
                  <span><span className="font-semibold text-foreground">{pL}:</span> <span className="tabular-nums">{mtdLmtdTotalCount.toLocaleString("en-IN")}</span> loans disbursed (<span className="font-semibold text-foreground tabular-nums">₹{mtdLmtdTotalAmt.toFixed(1)} Cr</span> at avg ATS).</span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
                  <span>FR split: <span className="text-muted-foreground">60% Fresh / 40% Renewal (count)</span>, <span className="text-muted-foreground">40% Fresh / 60% Renewal (amount)</span>.</span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
                  <span>Count growth vs {cL}:{" "}
                    {lmtdTotalCount > 0 ? (
                      <span className={cn("font-semibold tabular-nums", ((mtdLmtdTotalCount - lmtdTotalCount) / lmtdTotalCount * 100) >= 0 ? "text-emerald-600" : "text-red-600")}>
                        {((mtdLmtdTotalCount - lmtdTotalCount) / lmtdTotalCount * 100) >= 0 ? "+" : ""}{(lmtdTotalCount > 0 ? ((mtdLmtdTotalCount - lmtdTotalCount) / lmtdTotalCount) * 100 : 0).toFixed(1)}%
                      </span>
                    ) : "—"}
                    {lmtdTotalCount > 0 && ((mtdLmtdTotalCount - lmtdTotalCount) / lmtdTotalCount * 100) >= 0 ? " — ahead of prior month." : lmtdTotalCount > 0 ? " — below prior month." : ""}
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
                  <span>Amount growth vs {cL}:{" "}
                    {lmtdTotalAmt > 0 ? (
                      <span className={cn("font-semibold tabular-nums", ((mtdLmtdTotalAmt - lmtdTotalAmt) / lmtdTotalAmt * 100) >= 0 ? "text-emerald-600" : "text-red-600")}>
                        {((mtdLmtdTotalAmt - lmtdTotalAmt) / lmtdTotalAmt * 100) >= 0 ? "+" : ""}{((mtdLmtdTotalAmt - lmtdTotalAmt) / lmtdTotalAmt * 100).toFixed(1)}%
                      </span>
                    ) : "—"}
                    {lmtdTotalAmt > 0 && ((mtdLmtdTotalAmt - lmtdTotalAmt) / lmtdTotalAmt * 100) >= 0 ? " (₹ Cr up)." : lmtdTotalAmt > 0 ? " (₹ Cr down)." : ""}
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
                  <span><span className="font-semibold text-foreground">Top 3 lenders:</span>{" "}
                    {mtdLmtdLenderRows.slice(0, 3).map((l, i) => (
                      <span key={l.lender}>
                        {i > 0 && ", "}
                        <span className="font-medium">{l.lender}</span>
                        <span className={cn("tabular-nums", l.disbGrowthPct != null && l.disbGrowthPct >= 0 ? "text-emerald-600" : l.disbGrowthPct != null ? "text-red-600" : "text-muted-foreground")}>
                          {" "}({l.share.toFixed(0)}%{l.disbGrowthPct != null ? `, ${l.disbGrowthPct >= 0 ? "+" : ""}${l.disbGrowthPct.toFixed(1)}% vs LMTD` : ""})
                        </span>
                      </span>
                    ))}
                  </span>
                </li>
                <li className="flex gap-2 pt-1 border-t border-border/50">
                  <span className="text-[9px] text-muted-foreground">
                    <span className="text-emerald-600 font-medium">+Δ = better vs LMTD</span>
                    {" · "}
                    <span className="text-red-600 font-medium">−Δ = lower vs LMTD</span>
                  </span>
                </li>
              </ul>
            </div>

            {/* Table */}
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                {disbCountView === "lender-wise" && "Lender Details"}
                {disbCountView === "program-wise" && "Program Details"}
                {disbCountView === "policy-wise" && "Policy Details"}
              </p>
              <div className="rounded-lg border border-border overflow-x-auto overflow-y-visible min-w-0">
                <Table className="min-w-[1300px] w-full">
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      {disbCountView === "lender-wise" && (
                        <>
                          <TableHead className="text-[10px] font-semibold w-8" />
                          <TableHead className="text-[10px] font-semibold">Lender</TableHead>
                          <TableHead className="text-[10px] font-semibold text-right">MTD count</TableHead>
                          <TableHead className="text-[10px] font-semibold text-right">MTD Amt (Cr)</TableHead>
                          <TableHead className="text-[10px] font-semibold text-right">MTD ATS</TableHead>
                          <TableHead className="text-[10px] font-semibold text-right">LMTD count</TableHead>
                          <TableHead className="text-[10px] font-semibold text-right">LMTD Amt (Cr)</TableHead>
                          <TableHead className="text-[10px] font-semibold text-right">LMTD ATS</TableHead>
                          <TableHead className="text-[10px] font-semibold text-right">Share %</TableHead>
                          <TableHead className="text-[10px] font-semibold text-right">MTD vs LMTD count growth %</TableHead>
                          <TableHead className="text-[10px] font-semibold text-right">MTD vs LMTD amt growth %</TableHead>
                          <TableHead className="text-[10px] font-semibold text-right">ATS change vs LMTD</TableHead>
                          <TableHead className="text-[10px] font-semibold text-right">Share % change vs LMTD</TableHead>
                        </>
                      )}
                      {disbCountView === "program-wise" && (
                        <>
                          <TableHead className="text-[10px] font-semibold w-8" />
                          <TableHead className="text-[10px] font-semibold">program_type</TableHead>
                          <TableHead className="text-[10px] font-semibold text-right">MTD count</TableHead>
                          <TableHead className="text-[10px] font-semibold text-right">MTD Amt (Cr)</TableHead>
                          <TableHead className="text-[10px] font-semibold text-right">MTD ATS</TableHead>
                          <TableHead className="text-[10px] font-semibold text-right">LMTD count</TableHead>
                          <TableHead className="text-[10px] font-semibold text-right">LMTD Amt (Cr)</TableHead>
                          <TableHead className="text-[10px] font-semibold text-right">LMTD ATS</TableHead>
                          <TableHead className="text-[10px] font-semibold text-right">Lead count growth vs LMTD</TableHead>
                        </>
                      )}
                      {disbCountView === "policy-wise" && (
                        <>
                          <TableHead className="text-[10px] font-semibold w-8" />
                          <TableHead className="text-[10px] font-semibold">Policy</TableHead>
                          <TableHead className="text-[10px] font-semibold text-right">MTD count</TableHead>
                          <TableHead className="text-[10px] font-semibold text-right">MTD Amt (Cr)</TableHead>
                          <TableHead className="text-[10px] font-semibold text-right">MTD ATS</TableHead>
                          <TableHead className="text-[10px] font-semibold text-right">LMTD count</TableHead>
                          <TableHead className="text-[10px] font-semibold text-right">LMTD Amt (Cr)</TableHead>
                          <TableHead className="text-[10px] font-semibold text-right">LMTD ATS</TableHead>
                          <TableHead className="text-[10px] font-semibold text-right">Share %</TableHead>
                          <TableHead className="text-[10px] font-semibold text-right">Lead count growth vs LMTD</TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {disbCountView === "lender-wise" && mtdLmtdLenderRows.map((row) => (
                      <React.Fragment key={row.lender}>
                        <TableRow
                          key={row.lender}
                          className="cursor-pointer hover:bg-muted/40"
                          onClick={() => setDisbCountExpandedLender((prev) => (prev === row.lender ? null : row.lender))}
                        >
                          <TableCell className="w-8 py-2">
                            {disbCountExpandedLender === row.lender ? <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3 opacity-50" />}
                          </TableCell>
                          <TableCell className="text-xs font-medium py-2">
                            <span className="inline-flex items-center gap-1.5">
                              <span>{row.lender}</span>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setTrendLenderPopup(row.lender); }}
                                className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                                title="Day-wise trend vs AOP"
                              >
                                <LineChartIcon className="h-3.5 w-3.5" />
                              </button>
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums py-2">{row.mtdCount.toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums py-2">{row.amtCr.toFixed(2)}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums py-2">{row.ats.toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums py-2">{row.lmtdCount.toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums py-2">{row.lmtdAmtCr.toFixed(2)}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums py-2">{row.lmtdAts.toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums py-2">{row.share.toFixed(1)}%</TableCell>
                          <TableCell className="text-xs text-right tabular-nums py-2">
                            {row.disbGrowthPct != null ? <span className={cn(row.disbGrowthPct >= 0 ? "text-emerald-600" : "text-red-600")}>{row.disbGrowthPct >= 0 ? "+" : ""}{row.disbGrowthPct.toFixed(1)}%</span> : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums py-2">
                            {row.amtGrowthPct != null ? <span className={cn(row.amtGrowthPct >= 0 ? "text-emerald-600" : "text-red-600")}>{row.amtGrowthPct >= 0 ? "+" : ""}{row.amtGrowthPct.toFixed(1)}%</span> : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums py-2">
                            {row.atsChangePct != null ? <span className={cn(row.atsChangePct >= 0 ? "text-emerald-600" : "text-red-600")}>{row.atsChangePct >= 0 ? "+" : ""}{row.atsChangePct.toFixed(1)}%</span> : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums py-2">
                            {row.shareChangePp != null ? <span className={cn(row.shareChangePp >= 0 ? "text-emerald-600" : "text-red-600")}>{row.shareChangePp >= 0 ? "+" : ""}{row.shareChangePp.toFixed(1)}pp</span> : "—"}
                          </TableCell>
                        </TableRow>
                        {disbCountExpandedLender === row.lender && (
                          <TableRow key={`${row.lender}-l2`} className="bg-muted/20">
                            <TableCell colSpan={13} className="py-2 pl-8">
                              {(() => {
                                const progList = (mtdLmtdLenderProgramBreakdown[row.lender] ?? []).map((prog) => {
                                  const mtdCount = prog.feb26_loan;
                                  const lmtdCount = prog.jan26_loan;
                                  const amtCr = prog.feb26_amt_cr;
                                  const lmtdAmtCr = prog.jan26_amt_cr;
                                  const ats = mtdCount > 0 ? Math.round((amtCr * 1e7) / mtdCount) : 0;
                                  const lmtdAts = lmtdCount > 0 ? Math.round((lmtdAmtCr * 1e7) / lmtdCount) : 0;
                                  const lenderMtd = row.mtdCount;
                                  const lenderLmtd = row.lmtdCount;
                                  const share = lenderMtd > 0 ? (mtdCount / lenderMtd) * 100 : 0;
                                  const shareLmtd = lenderLmtd > 0 ? (lmtdCount / lenderLmtd) * 100 : 0;
                                  const disbGrowthPct = lmtdCount > 0 ? ((mtdCount - lmtdCount) / lmtdCount) * 100 : null;
                                  const amtGrowthPct = lmtdAmtCr > 0 ? ((amtCr - lmtdAmtCr) / lmtdAmtCr) * 100 : null;
                                  const atsChangePct = lmtdAts > 0 ? ((ats - lmtdAts) / lmtdAts) * 100 : null;
                                  const shareChangePp = Math.round((share - shareLmtd) * 10) / 10;
                                  return { program_type: prog.program_type, mtdCount, amtCr, ats, lmtdCount, lmtdAmtCr, lmtdAts, share, disbGrowthPct, amtGrowthPct, atsChangePct, shareChangePp };
                                });
                                return (
                                  <>
                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">{row.lender} — by program</p>
                                    <Table className="min-w-[1200px] w-full">
                                      <TableHeader>
                                        <TableRow className="bg-muted/50">
                                          <TableHead className="text-[10px] font-semibold">Program</TableHead>
                                          <TableHead className="text-[10px] font-semibold text-right">MTD count</TableHead>
                                          <TableHead className="text-[10px] font-semibold text-right">MTD Amt (Cr)</TableHead>
                                          <TableHead className="text-[10px] font-semibold text-right">MTD ATS</TableHead>
                                          <TableHead className="text-[10px] font-semibold text-right">LMTD count</TableHead>
                                          <TableHead className="text-[10px] font-semibold text-right">LMTD Amt (Cr)</TableHead>
                                          <TableHead className="text-[10px] font-semibold text-right">LMTD ATS</TableHead>
                                          <TableHead className="text-[10px] font-semibold text-right">Share %</TableHead>
                                          <TableHead className="text-[10px] font-semibold text-right">MTD vs LMTD count growth %</TableHead>
                                          <TableHead className="text-[10px] font-semibold text-right">MTD vs LMTD amt growth %</TableHead>
                                          <TableHead className="text-[10px] font-semibold text-right">ATS change vs LMTD</TableHead>
                                          <TableHead className="text-[10px] font-semibold text-right">Share % change vs LMTD</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {progList.map((p) => (
                                          <TableRow key={p.program_type}>
                                            <TableCell className="text-xs font-medium py-2">{p.program_type}</TableCell>
                                            <TableCell className="text-xs text-right tabular-nums py-2">{p.mtdCount.toLocaleString("en-IN")}</TableCell>
                                            <TableCell className="text-xs text-right tabular-nums py-2">{p.amtCr.toFixed(2)}</TableCell>
                                            <TableCell className="text-xs text-right tabular-nums py-2">{p.ats.toLocaleString("en-IN")}</TableCell>
                                            <TableCell className="text-xs text-right tabular-nums py-2">{p.lmtdCount.toLocaleString("en-IN")}</TableCell>
                                            <TableCell className="text-xs text-right tabular-nums py-2">{p.lmtdAmtCr.toFixed(2)}</TableCell>
                                            <TableCell className="text-xs text-right tabular-nums py-2">{p.lmtdAts.toLocaleString("en-IN")}</TableCell>
                                            <TableCell className="text-xs text-right tabular-nums py-2">{p.share.toFixed(1)}%</TableCell>
                                            <TableCell className="text-xs text-right tabular-nums py-2">
                                              {p.disbGrowthPct != null ? <span className={cn(p.disbGrowthPct >= 0 ? "text-emerald-600" : "text-red-600")}>{p.disbGrowthPct >= 0 ? "+" : ""}{p.disbGrowthPct.toFixed(1)}%</span> : "—"}
                                            </TableCell>
                                            <TableCell className="text-xs text-right tabular-nums py-2">
                                              {p.amtGrowthPct != null ? <span className={cn(p.amtGrowthPct >= 0 ? "text-emerald-600" : "text-red-600")}>{p.amtGrowthPct >= 0 ? "+" : ""}{p.amtGrowthPct.toFixed(1)}%</span> : "—"}
                                            </TableCell>
                                            <TableCell className="text-xs text-right tabular-nums py-2">
                                              {p.atsChangePct != null ? <span className={cn(p.atsChangePct >= 0 ? "text-emerald-600" : "text-red-600")}>{p.atsChangePct >= 0 ? "+" : ""}{p.atsChangePct.toFixed(1)}%</span> : "—"}
                                            </TableCell>
                                            <TableCell className="text-xs text-right tabular-nums py-2">
                                              <span className={cn(p.shareChangePp >= 0 ? "text-emerald-600" : "text-red-600")}>{p.shareChangePp >= 0 ? "+" : ""}{p.shareChangePp.toFixed(1)}pp</span>
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                        {progList.length > 0 && (
                                          <TableRow className="bg-muted/40 font-bold border-t-2">
                                            <TableCell className="text-xs font-bold py-2">Total</TableCell>
                                            <TableCell className="text-xs text-right tabular-nums py-2">{progList.reduce((s, p) => s + p.mtdCount, 0).toLocaleString("en-IN")}</TableCell>
                                            <TableCell className="text-xs text-right tabular-nums py-2">{progList.reduce((s, p) => s + p.amtCr, 0).toFixed(2)}</TableCell>
                                            <TableCell className="text-xs text-right tabular-nums py-2">
                                              {row.mtdCount > 0 ? Math.round((row.amtCr * 1e7) / row.mtdCount).toLocaleString("en-IN") : "—"}
                                            </TableCell>
                                            <TableCell className="text-xs text-right tabular-nums py-2">{progList.reduce((s, p) => s + p.lmtdCount, 0).toLocaleString("en-IN")}</TableCell>
                                            <TableCell className="text-xs text-right tabular-nums py-2">{progList.reduce((s, p) => s + p.lmtdAmtCr, 0).toFixed(2)}</TableCell>
                                            <TableCell className="text-xs text-right tabular-nums py-2">
                                              {row.lmtdCount > 0 ? Math.round((row.lmtdAmtCr * 1e7) / row.lmtdCount).toLocaleString("en-IN") : "—"}
                                            </TableCell>
                                            <TableCell className="text-xs text-right tabular-nums py-2">100%</TableCell>
                                            <TableCell className="text-xs text-right tabular-nums py-2">
                                              <span className={cn(row.disbGrowthPct != null && row.disbGrowthPct >= 0 ? "text-emerald-600" : "text-red-600")}>
                                                {row.disbGrowthPct != null ? (row.disbGrowthPct >= 0 ? "+" : "") + row.disbGrowthPct.toFixed(1) + "%" : "—"}
                                              </span>
                                            </TableCell>
                                            <TableCell className="text-xs text-right tabular-nums py-2">
                                              <span className={cn(row.amtGrowthPct != null && row.amtGrowthPct >= 0 ? "text-emerald-600" : "text-red-600")}>
                                                {row.amtGrowthPct != null ? (row.amtGrowthPct >= 0 ? "+" : "") + row.amtGrowthPct.toFixed(1) + "%" : "—"}
                                              </span>
                                            </TableCell>
                                            <TableCell className="text-xs text-right tabular-nums py-2">
                                              <span className={cn(row.atsChangePct != null && row.atsChangePct >= 0 ? "text-emerald-600" : "text-red-600")}>
                                                {row.atsChangePct != null ? (row.atsChangePct >= 0 ? "+" : "") + row.atsChangePct.toFixed(1) + "%" : "—"}
                                              </span>
                                            </TableCell>
                                            <TableCell className="text-xs text-right tabular-nums py-2">
                                              <span className={cn(row.shareChangePp != null && row.shareChangePp >= 0 ? "text-emerald-600" : "text-red-600")}>
                                                {row.shareChangePp != null ? (row.shareChangePp >= 0 ? "+" : "") + row.shareChangePp.toFixed(1) + "pp" : "—"}
                                              </span>
                                            </TableCell>
                                          </TableRow>
                                        )}
                                      </TableBody>
                                    </Table>
                                  </>
                                );
                              })()}
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    ))}
                    {disbCountView === "lender-wise" && mtdLmtdLenderRows.length > 0 && (
                      <TableRow className="bg-muted/40 font-bold border-t-2">
                        <TableCell className="w-8 py-2" />
                        <TableCell className="text-xs font-bold py-2">Total</TableCell>
                        <TableCell className="text-xs text-right tabular-nums py-2">{mtdLmtdLenderRows.reduce((s, r) => s + r.mtdCount, 0).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums py-2">{mtdLmtdLenderRows.reduce((s, r) => s + r.amtCr, 0).toFixed(2)}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums py-2">
                          {mtdLmtdTotalCount > 0 ? Math.round((mtdLmtdTotalAmt * 1e7) / mtdLmtdTotalCount).toLocaleString("en-IN") : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-right tabular-nums py-2">{mtdLmtdLenderRows.reduce((s, r) => s + r.lmtdCount, 0).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums py-2">{mtdLmtdLenderRows.reduce((s, r) => s + r.lmtdAmtCr, 0).toFixed(2)}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums py-2">
                          {lmtdTotalCount > 0 ? Math.round((lmtdTotalAmt * 1e7) / lmtdTotalCount).toLocaleString("en-IN") : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-right tabular-nums py-2">100%</TableCell>
                        <TableCell className="text-xs text-right tabular-nums py-2">
                          <span className={cn(lmtdTotalCount > 0 && ((mtdLmtdTotalCount - lmtdTotalCount) / lmtdTotalCount) * 100 >= 0 ? "text-emerald-600" : "text-red-600")}>
                            {lmtdTotalCount > 0 ? ((mtdLmtdTotalCount - lmtdTotalCount) / lmtdTotalCount * 100 >= 0 ? "+" : "") + ((mtdLmtdTotalCount - lmtdTotalCount) / lmtdTotalCount * 100).toFixed(1) + "%" : "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-right tabular-nums py-2">
                          {lmtdTotalAmt > 0 ? (() => {
                            const pct = ((mtdLmtdTotalAmt - lmtdTotalAmt) / lmtdTotalAmt) * 100;
                            return <span className={cn(pct >= 0 ? "text-emerald-600" : "text-red-600")}>{(pct >= 0 ? "+" : "") + pct.toFixed(1)}%</span>;
                          })() : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-right tabular-nums py-2">
                          {lmtdTotalCount > 0 && lmtdTotalAmt > 0 ? (() => {
                            const avgAtsMtd = (mtdLmtdTotalAmt * 1e7) / mtdLmtdTotalCount;
                            const avgAtsLmtd = (lmtdTotalAmt * 1e7) / lmtdTotalCount;
                            const pct = ((avgAtsMtd - avgAtsLmtd) / avgAtsLmtd) * 100;
                            return <span className={cn(pct >= 0 ? "text-emerald-600" : "text-red-600")}>{(pct >= 0 ? "+" : "") + pct.toFixed(1)}%</span>;
                          })() : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-right tabular-nums py-2">—</TableCell>
                      </TableRow>
                    )}
                    {disbCountView === "program-wise" && mtdLmtdProgramRows.map((row) => (
                      <React.Fragment key={row.program_type}>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/40"
                          onClick={() => setExpandedProgramForLender((p) => (p === row.program_type ? null : row.program_type))}
                        >
                          <TableCell className="w-8 py-2">
                            {expandedProgramForLender === row.program_type ? <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3 opacity-50" />}
                          </TableCell>
                          <TableCell className="text-xs font-medium py-2">{row.program_type}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums py-2">{row.feb26_loan.toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums py-2">{row.feb26_amt_cr.toFixed(2)}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums py-2">{row.feb26_ats.toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums py-2">{row.jan26_loan.toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums py-2">{row.jan26_amt_cr.toFixed(2)}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums py-2">{row.jan26_ats.toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums py-2">
                            {row.countGrowthPct != null ? <span className={cn(row.countGrowthPct >= 0 ? "text-emerald-600" : "text-red-600")}>{row.countGrowthPct >= 0 ? "+" : ""}{row.countGrowthPct.toFixed(1)}%</span> : "—"}
                          </TableCell>
                        </TableRow>
                        {expandedProgramForLender === row.program_type && (programLenderBreakdown[row.program_type] ?? []).length > 0 && (
                          <TableRow className="bg-muted/20">
                            <TableCell colSpan={10} className="py-2 pl-8">
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">{row.program_type} — Lender breakdown</p>
                              <Table className="min-w-[1200px] w-full">
                                <TableHeader>
                                  <TableRow className="bg-muted/50">
                                    <TableHead className="text-[10px] font-semibold">Lender</TableHead>
                                    <TableHead className="text-[10px] font-semibold text-right">MTD count</TableHead>
                                    <TableHead className="text-[10px] font-semibold text-right">MTD Amt (Cr)</TableHead>
                                    <TableHead className="text-[10px] font-semibold text-right">MTD ATS</TableHead>
                                    <TableHead className="text-[10px] font-semibold text-right">LMTD count</TableHead>
                                    <TableHead className="text-[10px] font-semibold text-right">LMTD Amt (Cr)</TableHead>
                                    <TableHead className="text-[10px] font-semibold text-right">LMTD ATS</TableHead>
                                    <TableHead className="text-[10px] font-semibold text-right">Share %</TableHead>
                                    <TableHead className="text-[10px] font-semibold text-right">MTD vs LMTD count growth %</TableHead>
                                    <TableHead className="text-[10px] font-semibold text-right">MTD vs LMTD amt growth %</TableHead>
                                    <TableHead className="text-[10px] font-semibold text-right">ATS change vs LMTD</TableHead>
                                    <TableHead className="text-[10px] font-semibold text-right">Share % change vs LMTD</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {(programLenderBreakdown[row.program_type] ?? []).map((l) => (
                                    <TableRow key={l.lender}>
                                      <TableCell className="text-xs font-medium py-2">{l.lender}</TableCell>
                                      <TableCell className="text-xs text-right tabular-nums py-2">{l.mtdCount.toLocaleString("en-IN")}</TableCell>
                                      <TableCell className="text-xs text-right tabular-nums py-2">{l.amtCr.toFixed(2)}</TableCell>
                                      <TableCell className="text-xs text-right tabular-nums py-2">{l.ats.toLocaleString("en-IN")}</TableCell>
                                      <TableCell className="text-xs text-right tabular-nums py-2">{l.lmtdCount.toLocaleString("en-IN")}</TableCell>
                                      <TableCell className="text-xs text-right tabular-nums py-2">{l.lmtdAmtCr.toFixed(2)}</TableCell>
                                      <TableCell className="text-xs text-right tabular-nums py-2">{l.lmtdAts.toLocaleString("en-IN")}</TableCell>
                                      <TableCell className="text-xs text-right tabular-nums py-2">{l.share.toFixed(1)}%</TableCell>
                                      <TableCell className="text-xs text-right tabular-nums py-2">{l.disbGrowthPct != null ? <span className={cn(l.disbGrowthPct >= 0 ? "text-emerald-600" : "text-red-600")}>{l.disbGrowthPct >= 0 ? "+" : ""}{l.disbGrowthPct.toFixed(1)}%</span> : "—"}</TableCell>
                                      <TableCell className="text-xs text-right tabular-nums py-2">{l.amtGrowthPct != null ? <span className={cn(l.amtGrowthPct >= 0 ? "text-emerald-600" : "text-red-600")}>{l.amtGrowthPct >= 0 ? "+" : ""}{l.amtGrowthPct.toFixed(1)}%</span> : "—"}</TableCell>
                                      <TableCell className="text-xs text-right tabular-nums py-2">{l.atsChangePct != null ? <span className={cn(l.atsChangePct >= 0 ? "text-emerald-600" : "text-red-600")}>{l.atsChangePct >= 0 ? "+" : ""}{l.atsChangePct.toFixed(1)}%</span> : "—"}</TableCell>
                                      <TableCell className="text-xs text-right tabular-nums py-2"><span className={cn(l.shareChangePp >= 0 ? "text-emerald-600" : "text-red-600")}>{l.shareChangePp >= 0 ? "+" : ""}{l.shareChangePp.toFixed(1)}pp</span></TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    ))}
                    {disbCountView === "program-wise" && mtdLmtdProgramRows.length > 0 && (
                      <TableRow className="bg-muted/40 font-bold border-t-2">
                        <TableCell className="w-8 py-2" />
                        <TableCell className="text-xs font-bold py-2">Total</TableCell>
                        <TableCell className="text-xs text-right tabular-nums py-2">{mtdLmtdProgramRows.reduce((s, r) => s + r.feb26_loan, 0).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums py-2">{mtdLmtdProgramRows.reduce((s, r) => s + r.feb26_amt_cr, 0).toFixed(2)}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums py-2">
                          {mtdLmtdTotalCount > 0 ? Math.round((mtdLmtdTotalAmt * 1e7) / mtdLmtdTotalCount).toLocaleString("en-IN") : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-right tabular-nums py-2">{mtdLmtdProgramRows.reduce((s, r) => s + r.jan26_loan, 0).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums py-2">{mtdLmtdProgramRows.reduce((s, r) => s + r.jan26_amt_cr, 0).toFixed(2)}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums py-2">
                          {lmtdTotalCount > 0 ? Math.round((lmtdTotalAmt * 1e7) / lmtdTotalCount).toLocaleString("en-IN") : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-right tabular-nums py-2">
                          {lmtdTotalCount > 0 ? <span className={cn(((mtdLmtdTotalCount - lmtdTotalCount) / lmtdTotalCount * 100) >= 0 ? "text-emerald-600" : "text-red-600")}>
                            {((mtdLmtdTotalCount - lmtdTotalCount) / lmtdTotalCount * 100) >= 0 ? "+" : ""}{(((mtdLmtdTotalCount - lmtdTotalCount) / lmtdTotalCount) * 100).toFixed(1)}%
                          </span> : "—"}
                        </TableCell>
                      </TableRow>
                    )}
                    {disbCountView === "policy-wise" && mtdLmtdPolicyRows.map((row) => (
                      <React.Fragment key={row.policy}>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/40"
                          onClick={() => setExpandedPolicyForLender((p) => (p === row.policy ? null : row.policy))}
                        >
                          <TableCell className="w-8 py-2">
                            {expandedPolicyForLender === row.policy ? <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3 opacity-50" />}
                          </TableCell>
                          <TableCell className="text-xs font-medium py-2">{row.policy}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums py-2">{row.mtdCount.toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums py-2">{row.amtCr.toFixed(2)}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums py-2">{row.mtdAts.toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums py-2">{row.lmtdCount.toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums py-2">{row.lmtdAmtCr.toFixed(2)}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums py-2">{row.lmtdAts.toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums py-2">{row.share.toFixed(1)}%</TableCell>
                          <TableCell className="text-xs text-right tabular-nums py-2">
                            {row.countGrowthPct != null ? <span className={cn(row.countGrowthPct >= 0 ? "text-emerald-600" : "text-red-600")}>{row.countGrowthPct >= 0 ? "+" : ""}{row.countGrowthPct.toFixed(1)}%</span> : "—"}
                          </TableCell>
                        </TableRow>
                        {expandedPolicyForLender === row.policy && (policyLenderBreakdown[row.policy] ?? []).length > 0 && (
                          <TableRow className="bg-muted/20">
                            <TableCell colSpan={11} className="py-2 pl-8">
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">{row.policy} — Lender breakdown</p>
                              <Table className="min-w-[1200px] w-full">
                                <TableHeader>
                                  <TableRow className="bg-muted/50">
                                    <TableHead className="text-[10px] font-semibold">Lender</TableHead>
                                    <TableHead className="text-[10px] font-semibold text-right">MTD count</TableHead>
                                    <TableHead className="text-[10px] font-semibold text-right">MTD Amt (Cr)</TableHead>
                                    <TableHead className="text-[10px] font-semibold text-right">MTD ATS</TableHead>
                                    <TableHead className="text-[10px] font-semibold text-right">LMTD count</TableHead>
                                    <TableHead className="text-[10px] font-semibold text-right">LMTD Amt (Cr)</TableHead>
                                    <TableHead className="text-[10px] font-semibold text-right">LMTD ATS</TableHead>
                                    <TableHead className="text-[10px] font-semibold text-right">Share %</TableHead>
                                    <TableHead className="text-[10px] font-semibold text-right">MTD vs LMTD count growth %</TableHead>
                                    <TableHead className="text-[10px] font-semibold text-right">MTD vs LMTD amt growth %</TableHead>
                                    <TableHead className="text-[10px] font-semibold text-right">ATS change vs LMTD</TableHead>
                                    <TableHead className="text-[10px] font-semibold text-right">Share % change vs LMTD</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {(policyLenderBreakdown[row.policy] ?? []).map((l) => (
                                    <TableRow key={l.lender}>
                                      <TableCell className="text-xs font-medium py-2">{l.lender}</TableCell>
                                      <TableCell className="text-xs text-right tabular-nums py-2">{l.mtdCount.toLocaleString("en-IN")}</TableCell>
                                      <TableCell className="text-xs text-right tabular-nums py-2">{l.amtCr.toFixed(2)}</TableCell>
                                      <TableCell className="text-xs text-right tabular-nums py-2">{l.ats.toLocaleString("en-IN")}</TableCell>
                                      <TableCell className="text-xs text-right tabular-nums py-2">{l.lmtdCount.toLocaleString("en-IN")}</TableCell>
                                      <TableCell className="text-xs text-right tabular-nums py-2">{l.lmtdAmtCr.toFixed(2)}</TableCell>
                                      <TableCell className="text-xs text-right tabular-nums py-2">{l.lmtdAts.toLocaleString("en-IN")}</TableCell>
                                      <TableCell className="text-xs text-right tabular-nums py-2">{l.share.toFixed(1)}%</TableCell>
                                      <TableCell className="text-xs text-right tabular-nums py-2">{l.disbGrowthPct != null ? <span className={cn(l.disbGrowthPct >= 0 ? "text-emerald-600" : "text-red-600")}>{l.disbGrowthPct >= 0 ? "+" : ""}{l.disbGrowthPct.toFixed(1)}%</span> : "—"}</TableCell>
                                      <TableCell className="text-xs text-right tabular-nums py-2">{l.amtGrowthPct != null ? <span className={cn(l.amtGrowthPct >= 0 ? "text-emerald-600" : "text-red-600")}>{l.amtGrowthPct >= 0 ? "+" : ""}{l.amtGrowthPct.toFixed(1)}%</span> : "—"}</TableCell>
                                      <TableCell className="text-xs text-right tabular-nums py-2">{l.atsChangePct != null ? <span className={cn(l.atsChangePct >= 0 ? "text-emerald-600" : "text-red-600")}>{l.atsChangePct >= 0 ? "+" : ""}{l.atsChangePct.toFixed(1)}%</span> : "—"}</TableCell>
                                      <TableCell className="text-xs text-right tabular-nums py-2"><span className={cn(l.shareChangePp >= 0 ? "text-emerald-600" : "text-red-600")}>{l.shareChangePp >= 0 ? "+" : ""}{l.shareChangePp.toFixed(1)}pp</span></TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    ))}
                    {disbCountView === "policy-wise" && mtdLmtdPolicyRows.length > 0 && (
                      <TableRow className="bg-muted/40 font-bold border-t-2">
                        <TableCell className="w-8 py-2" />
                        <TableCell className="text-xs font-bold py-2">Total</TableCell>
                        <TableCell className="text-xs text-right tabular-nums py-2">{mtdLmtdPolicyRows.reduce((s, r) => s + r.mtdCount, 0).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums py-2">{mtdLmtdPolicyRows.reduce((s, r) => s + r.amtCr, 0).toFixed(2)}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums py-2">
                          {mtdLmtdTotalCount > 0 ? Math.round((mtdLmtdTotalAmt * 1e7) / mtdLmtdTotalCount).toLocaleString("en-IN") : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-right tabular-nums py-2">{mtdLmtdPolicyRows.reduce((s, r) => s + r.lmtdCount, 0).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums py-2">{mtdLmtdPolicyRows.reduce((s, r) => s + r.lmtdAmtCr, 0).toFixed(2)}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums py-2">
                          {lmtdTotalCount > 0 ? Math.round((lmtdTotalAmt * 1e7) / lmtdTotalCount).toLocaleString("en-IN") : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-right tabular-nums py-2">100%</TableCell>
                        <TableCell className="text-xs text-right tabular-nums py-2">
                          {lmtdTotalCount > 0 ? <span className={cn(((mtdLmtdTotalCount - lmtdTotalCount) / lmtdTotalCount * 100) >= 0 ? "text-emerald-600" : "text-red-600")}>
                            {((mtdLmtdTotalCount - lmtdTotalCount) / lmtdTotalCount * 100) >= 0 ? "+" : ""}{(((mtdLmtdTotalCount - lmtdTotalCount) / lmtdTotalCount) * 100).toFixed(1)}%
                          </span> : "—"}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Trend popup: day-wise cumulative (Cr) vs AOP for selected lender */}
      <Dialog open={!!trendLenderPopup} onOpenChange={(v) => { if (!v) setTrendLenderPopup(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {trendLenderPopup ? `${trendLenderPopup} — Day-wise trend vs AOP` : ""}
            </DialogTitle>
            <p className="text-[10px] text-muted-foreground">
              Cumulative disbursement (Cr) by day. Blue = actual, orange = AOP target (Feb&apos;26).
            </p>
          </DialogHeader>
          {trendLenderPopup && Array.isArray(lenderTrendDayData[trendLenderPopup]) && lenderTrendDayData[trendLenderPopup].length > 0 && (
            <div className="h-[320px] w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={lenderTrendDayData[trendLenderPopup] ?? []} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v} Cr`} />
                  <Tooltip
                    formatter={(value) => [`${value != null && typeof value === "number" ? value.toFixed(1) : "—"} Cr`, ""] as [React.ReactNode, ""]}
                    labelFormatter={(label) => label}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="cumActual" name="Cum. actual (Cr)" fill="hsl(220, 70%, 55%)" stroke="hsl(220, 70%, 45%)" fillOpacity={0.4} />
                  <Line type="monotone" dataKey="cumTarget" name="AOP target (Cr)" stroke="hsl(30, 80%, 50%)" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
