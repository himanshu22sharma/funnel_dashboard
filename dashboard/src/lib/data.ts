import Papa from "papaparse";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FunnelRow {
  product_type: string;
  isautoleadcreated: string;
  major_index: number;
  major_stage: string;
  leads: number;
  conv_pct: number | null;
}

export interface LenderFunnelRow {
  lender: string;
  product_type: string;
  isautoleadcreated: string;
  major_index: number;
  major_stage: string;
  leads: number;
  conv_pct: number | null;
}

export interface DisbursalSummaryRow {
  product_type: string;
  isautoleadcreated: string;
  lender: string;
  child_leads: number;
  disbursed: number;
  disbursal_pct: number;
  /** MTD amount in Cr (optional; when present, used for MTD total) */
  amt_cr?: number;
  /** LMSD/LMTD loan count (optional; when present, used for LMTD total) */
  lmtd_disbursed?: number;
  /** LMSD/LMTD amount in Cr (optional; when present, used for LMTD amount) */
  lmtd_amt_cr?: number;
}

export interface L2AnalysisRow {
  lender: string;
  month_start: string; // "1.MTD" or "2.LMTD"
  product_type: string;
  isautoleadcreated: string;
  major_index: number;
  original_major_stage: string;
  sub_stage: string | null;
  leads: number;
  stuck_pct: number | null;
}

/** Overall disbursement summary: AOP, MTD (Cr), LMSD (Cr) by lender */
export interface DisbursementSummaryOverallRow {
  lender: string;
  aop: number;
  mtd_cr: number;
  lmsd_cr: number;
}

/** Lender-wise disbursal breakdown: Loan, Amt(Cr.), ATS, Avg, Avg PF */
export interface DisbursalBreakdownLenderRow {
  lender: string;
  loan: number;
  amt_cr: number;
  ats: number;
  avg: number;
  avg_pf: number;
}

/** Lead-type (flow) wise disbursal breakdown */
export interface DisbursalBreakdownLeadTypeRow {
  lead_type: string;
  loan: number;
  amt_cr: number;
  ats: number;
  avg: number;
  avg_pf: number;
}

// ─── CSV Fetching ───────────────────────────────────────────────────────────

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

async function fetchCSV<T>(path: string, transform: (row: Record<string, string>) => T): Promise<T[]> {
  const res = await fetch(`${BASE}${path}?v=${Date.now()}`, { cache: "no-store" });
  const text = await res.text();
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  return parsed.data.map(transform);
}

export async function fetchCompleteFunnel(): Promise<FunnelRow[]> {
  return fetchCSV("/data/Complete_Funnel_with_Stages.csv", (row) => ({
    product_type: row["product_type"]?.trim() || "",
    isautoleadcreated: row["isautoleadcreated"]?.trim() || "",
    major_index: parseInt(row["major_index"]) || 0,
    major_stage: row["major_stage"]?.trim() || "",
    leads: parseInt(row["Leads"]?.replace(/,/g, "")) || 0,
    conv_pct: row["Conv%"] ? parseFloat(row["Conv%"]) : null,
  }));
}

export async function fetchLenderFunnel(): Promise<LenderFunnelRow[]> {
  return fetchCSV("/data/Lender_Level_Funnel_With_Stages.csv", (row) => ({
    lender: row["lender"]?.trim() || "",
    product_type: row["product_type"]?.trim() || "",
    isautoleadcreated: row["isautoleadcreated"]?.trim() || "",
    major_index: parseInt(row["major_index"]) || 0,
    major_stage: row["major_stage"]?.trim() || "",
    leads: parseInt(row["Leads"]?.replace(/,/g, "")) || 0,
    conv_pct: row["Conv. %"] ? parseFloat(row["Conv. %"]) : null,
  }));
}

export async function fetchDisbursalSummary(): Promise<DisbursalSummaryRow[]> {
  return fetchCSV("/data/Lender_Level_Disb_Summary.csv", (row) => ({
    product_type: row["product_type"]?.trim() || "",
    isautoleadcreated: row["isautoleadcreated"]?.trim() || "",
    lender: row["lender"]?.trim() || "",
    child_leads: parseInt(row["#Child_Leads_Created"]?.replace(/,/g, "")) || 0,
    disbursed: parseInt(row["#Disbursed"]?.replace(/,/g, "")) || 0,
    disbursal_pct: parseFloat(row["Disbursal %"]) || 0,
    amt_cr: row["Amt_Cr"] != null && row["Amt_Cr"] !== "" ? parseFloat(String(row["Amt_Cr"]).replace(/,/g, "")) : undefined,
    lmtd_disbursed: row["#Disbursed_LMSD"] != null && row["#Disbursed_LMSD"] !== "" ? parseInt(String(row["#Disbursed_LMSD"]).replace(/,/g, "")) || 0 : undefined,
    lmtd_amt_cr: row["Amt_Cr_LMSD"] != null && row["Amt_Cr_LMSD"] !== "" ? parseFloat(String(row["Amt_Cr_LMSD"]).replace(/,/g, "")) : undefined,
  }));
}

export async function fetchL2Analysis(): Promise<L2AnalysisRow[]> {
  return fetchCSV("/data/L2_Analysis.csv", (row) => ({
    lender: row["lender"]?.trim() || "",
    month_start: row["month_start"]?.trim() || "",
    product_type: row["product_type"]?.trim() || "",
    isautoleadcreated: row["isautoleadcreated"]?.trim() || "",
    major_index: parseFloat(row["major_index"]) || 0,
    original_major_stage: row["original_major_stage"]?.trim() || "",
    sub_stage: row["sub_stage"]?.trim() || null,
    leads: parseInt(row["Leads"]?.replace(/,/g, "")) || 0,
    stuck_pct: row["Stuck%"] ? parseFloat(row["Stuck%"]) : null,
  }));
}

export async function fetchDisbursementSummaryOverall(): Promise<DisbursementSummaryOverallRow[]> {
  return fetchCSV("/data/Disbursement_Summary_Overall.csv", (row) => ({
    lender: row["lender"]?.trim() || "",
    aop: parseFloat(row["aop"]?.replace(/,/g, "")) || 0,
    mtd_cr: parseFloat(row["mtd_cr"]?.replace(/,/g, "")) || 0,
    lmsd_cr: parseFloat(row["lmsd_cr"]?.replace(/,/g, "")) || 0,
  }));
}

export async function fetchDisbursalMTDLender(): Promise<DisbursalBreakdownLenderRow[]> {
  return fetchCSV("/data/Disbursal_MTD_Lender.csv", (row) => ({
    lender: row["lender"]?.trim() || "",
    loan: parseInt(row["loan"]?.replace(/,/g, "")) || 0,
    amt_cr: parseFloat(row["amt_cr"]?.replace(/,/g, "")) || 0,
    ats: parseInt(row["ats"]?.replace(/,/g, "")) || 0,
    avg: parseFloat(row["avg"]?.replace(/,/g, "")) || 0,
    avg_pf: parseFloat(row["avg_pf"]?.replace(/,/g, "")) || 0,
  }));
}

export async function fetchDisbursalLMSDLender(): Promise<DisbursalBreakdownLenderRow[]> {
  return fetchCSV("/data/Disbursal_LMSD_Lender.csv", (row) => ({
    lender: row["lender"]?.trim() || "",
    loan: parseInt(row["loan"]?.replace(/,/g, "")) || 0,
    amt_cr: parseFloat(row["amt_cr"]?.replace(/,/g, "")) || 0,
    ats: parseInt(row["ats"]?.replace(/,/g, "")) || 0,
    avg: parseFloat(row["avg"]?.replace(/,/g, "")) || 0,
    avg_pf: parseFloat(row["avg_pf"]?.replace(/,/g, "")) || 0,
  }));
}

export async function fetchDisbursalFTDLender(): Promise<DisbursalBreakdownLenderRow[]> {
  return fetchCSV("/data/Disbursal_FTD_Lender.csv", (row) => ({
    lender: row["lender"]?.trim() || "",
    loan: parseInt(row["loan"]?.replace(/,/g, "")) || 0,
    amt_cr: parseFloat(row["amt_cr"]?.replace(/,/g, "")) || 0,
    ats: parseInt(row["ats"]?.replace(/,/g, "")) || 0,
    avg: parseFloat(row["avg"]?.replace(/,/g, "")) || 0,
    avg_pf: parseFloat(row["avg_pf"]?.replace(/,/g, "")) || 0,
  }));
}

export async function fetchDisbursalMTDLeadType(): Promise<DisbursalBreakdownLeadTypeRow[]> {
  return fetchCSV("/data/Disbursal_MTD_LeadType.csv", (row) => ({
    lead_type: row["lead_type"]?.trim() || "",
    loan: parseInt(row["loan"]?.replace(/,/g, "")) || 0,
    amt_cr: parseFloat(row["amt_cr"]?.replace(/,/g, "")) || 0,
    ats: parseInt(row["ats"]?.replace(/,/g, "")) || 0,
    avg: parseFloat(row["avg"]?.replace(/,/g, "")) || 0,
    avg_pf: parseFloat(row["avg_pf"]?.replace(/,/g, "")) || 0,
  }));
}

export async function fetchDisbursalLMSDLeadType(): Promise<DisbursalBreakdownLeadTypeRow[]> {
  return fetchCSV("/data/Disbursal_LMSD_LeadType.csv", (row) => ({
    lead_type: row["lead_type"]?.trim() || "",
    loan: parseInt(row["loan"]?.replace(/,/g, "")) || 0,
    amt_cr: parseFloat(row["amt_cr"]?.replace(/,/g, "")) || 0,
    ats: parseInt(row["ats"]?.replace(/,/g, "")) || 0,
    avg: parseFloat(row["avg"]?.replace(/,/g, "")) || 0,
    avg_pf: parseFloat(row["avg_pf"]?.replace(/,/g, "")) || 0,
  }));
}

export async function fetchDisbursalFTDLeadType(): Promise<DisbursalBreakdownLeadTypeRow[]> {
  return fetchCSV("/data/Disbursal_FTD_LeadType.csv", (row) => ({
    lead_type: row["lead_type"]?.trim() || "",
    loan: parseInt(row["loan"]?.replace(/,/g, "")) || 0,
    amt_cr: parseFloat(row["amt_cr"]?.replace(/,/g, "")) || 0,
    ats: parseInt(row["ats"]?.replace(/,/g, "")) || 0,
    avg: parseFloat(row["avg"]?.replace(/,/g, "")) || 0,
    avg_pf: parseFloat(row["avg_pf"]?.replace(/,/g, "")) || 0,
  }));
}

// ─── Data Processing Helpers ────────────────────────────────────────────────

export function getUniqueValues<T>(data: T[], key: keyof T): string[] {
  const set = new Set<string>();
  data.forEach((row) => {
    const val = String(row[key]).trim();
    if (val) set.add(val);
  });
  return Array.from(set).sort();
}

export function formatNumber(num: number): string {
  if (num >= 10000000) return `${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `${(num / 100000).toFixed(2)} L`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString("en-IN");
}

export function formatPct(val: number | null | undefined): string {
  if (val === null || val === undefined) return "-";
  return `${val.toFixed(2)}%`;
}

export function formatDelta(val: number): string {
  const sign = val > 0 ? "+" : "";
  return `${sign}${val.toFixed(2)} pp`;
}

// ─── AOP Config (hardcoded for now) ─────────────────────────────────────────

export const AOP_TARGET_CR = 500; // Fallback Feb month target (Cr) when Disbursement_Summary_Overall not loaded

// ─── Reference date & month pacing (Feb 2026) ───────────────────────────────
export const REFERENCE_DATE = new Date(2026, 1, 24); // 24-Feb-26
export const DAYS_ELAPSED = 23; // days passed in month (as of 24-Feb-26)
export const DAYS_IN_MONTH = 28; // Feb 2026

// ─── Mock monthly trend data (for Executive Summary) ────────────────────────
// Since we only have MTD snapshot, we'll generate reasonable trend data
// based on the disbursal summary. This will be replaced with real OLAP data.

export interface MonthlyTrend {
  month: string;
  disbursed_count: number;
  disbursed_amount_cr: number;
  ats_lakhs: number;
}

export function generateMonthlyTrends(disbursalData: DisbursalSummaryRow[]): MonthlyTrend[] {
  const totalDisbursed = disbursalData.reduce((sum, r) => sum + r.disbursed, 0);
  // Average ticket size: MTD 1528 Cr / 83401 loans ≈ 1.83 L per loan
  const avgATS = 1.83;
  const currentAmountCr = (totalDisbursed * avgATS) / 100; // lakhs to crores

  const months = [
    "Sep 2025", "Oct 2025", "Nov 2025", "Dec 2025",
    "Jan 2026", "Feb 2026"
  ];

  // Simulate growth trend
  const growthFactors = [0.72, 0.78, 0.85, 0.90, 0.95, 1.0];

  return months.map((month, i) => {
    const factor = growthFactors[i];
    const count = Math.round(totalDisbursed * factor);
    const amount = parseFloat((currentAmountCr * factor).toFixed(2));
    return {
      month,
      disbursed_count: count,
      disbursed_amount_cr: amount,
      ats_lakhs: avgATS + (i * 0.05), // slight ATS growth
    };
  });
}
