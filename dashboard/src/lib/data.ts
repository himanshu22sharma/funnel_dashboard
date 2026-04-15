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

export interface MarketplaceFunnelRow {
  major_index: number;
  major_stage: string;
  leads: number;
  period: string; // "1.MTD" or "2.LMTD"
}

export interface LenderMarketplaceRow {
  lender: string;
  product_type: string;
  major_index: number;
  major_stage: string;
  leads: number;
  period: string; // "1.MTD" or "2.LMTD"
}

export interface DisbursalSummaryRow {
  /** Program dimension from OLAP `lead_type` (kept as `product_type` for filters / matrix). */
  product_type: string;
  isautoleadcreated: string;
  /** Lender from OLAP `lender_name`. */
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
  /**
   * Flow type from `isautoleadcreated` on OLAP: **Flow 1 (auto)** vs **Flow 2 (manual)**.
   * Canonical values after normalization: {@link MARKETPLACE_FLOW_AUTO} | {@link MARKETPLACE_FLOW_MANUAL}.
   */
  isautoleadcreated: string;
  major_index: number;
  original_major_stage: string;
  sub_stage: string | null;
  leads: number;
  stuck_pct: number | null;
}

/** Flow 1 — auto-created child lead (`isautoleadcreated` true / auto side). */
export const MARKETPLACE_FLOW_AUTO = "Flow1(Auto)";
/** Flow 2 — manual flow (`isautoleadcreated` false / manual side). */
export const MARKETPLACE_FLOW_MANUAL = "Flow2(Manual)";

/**
 * Map raw ClickHouse / CSV `isautoleadcreated` to Flow 1 vs Flow 2 literals used by filters and joins.
 */
export function normalizeMarketplaceFlow(raw: string): string {
  const c = raw.trim().replace(/\s+/g, " ");
  if (!c) return "";
  const compact = c.toLowerCase().replace(/\s+/g, "");
  if (
    compact === "flow1(auto)" ||
    compact === "flow1" ||
    compact === "true" ||
    compact === "auto" ||
    /^flow\s*1/.test(c.toLowerCase())
  ) {
    return MARKETPLACE_FLOW_AUTO;
  }
  if (
    compact === "flow2(manual)" ||
    compact === "flow2" ||
    compact === "false" ||
    compact === "manual" ||
    /^flow\s*2/.test(c.toLowerCase())
  ) {
    return MARKETPLACE_FLOW_MANUAL;
  }
  return c;
}

/** Short UI label for funnel strips and tables. */
export function formatFlowTypeForUi(flow: string): string {
  const f = flow.trim();
  if (!f) return "All flows";
  if (f === MARKETPLACE_FLOW_AUTO) return "Flow 1 (Auto)";
  if (f === MARKETPLACE_FLOW_MANUAL) return "Flow 2 (Manual)";
  return f;
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

// Always use synced ClickHouse data from /data/ch-sync/
const L2_CSV_PATH = "/data/ch-sync/L2_Analysis.csv";
const DISB_LENDER_CSV_PATH = "/data/ch-sync/Lender_Level_Disb_Summary.csv";
const MARKETPLACE_FUNNEL_CSV_PATH = "/data/ch-sync/Marketplace_Funnel.csv";
const LENDER_MARKETPLACE_FUNNEL_CSV_PATH = "/data/ch-sync/Lender_Marketplace_Funnel.csv";

async function fetchCSV<T>(path: string, transform: (row: Record<string, string>) => T): Promise<T[]> {
  const res = await fetch(`${BASE}${path}?v=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.statusText}`);
  const text = await res.text();
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  return parsed.data.map(transform);
}

export async function fetchCompleteFunnel(): Promise<FunnelRow[]> {
  // Marketplace funnel data is loaded via fetchMarketplaceFunnel() instead
  return [];
}

export async function fetchLenderFunnel(): Promise<LenderFunnelRow[]> {
  // Lender funnel data is derived from L2_Analysis, not from CSV
  // This will be populated from L2 data dynamically in the page
  return [];
}

export async function fetchDisbursalSummary(): Promise<DisbursalSummaryRow[]> {
  return fetchCSV(DISB_LENDER_CSV_PATH, (row) => ({
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
  return fetchCSV(L2_CSV_PATH, (row) => ({
    lender: row["lender"]?.trim() || "",
    month_start: row["month_start"]?.trim() || "",
    product_type: row["product_type"]?.trim() || "",
    isautoleadcreated: normalizeMarketplaceFlow(row["isautoleadcreated"]?.trim() || ""),
    major_index: parseFloat(row["major_index"]) || 0,
    original_major_stage: row["original_major_stage"]?.trim() || "",
    sub_stage: row["sub_stage"]?.trim() || null,
    leads: parseInt(row["Leads"]?.replace(/,/g, "")) || 0,
    stuck_pct: row["Stuck%"] ? parseFloat(row["Stuck%"]) : null,
  }));
}

export async function fetchMarketplaceFunnel(): Promise<MarketplaceFunnelRow[]> {
  return fetchCSV(MARKETPLACE_FUNNEL_CSV_PATH, (row) => ({
    major_index: parseInt(row["major_index"]) || 0,
    major_stage: row["major_stage"]?.trim() || "",
    leads: parseInt(row["Leads"]?.replace(/,/g, "")) || 0,
    period: row["period"]?.trim() || "",
  }));
}

export async function fetchLenderMarketplaceFunnel(): Promise<LenderMarketplaceRow[]> {
  return fetchCSV(LENDER_MARKETPLACE_FUNNEL_CSV_PATH, (row) => ({
    lender: row["lender"]?.trim() || "",
    product_type: row["product_type"]?.trim() || "",
    major_index: parseInt(row["major_index"]) || 0,
    major_stage: row["major_stage"]?.trim() || "",
    leads: parseInt(row["leads"]?.replace(/,/g, "")) || 0,
    period: row["period"]?.trim() || "",
  }));
}

export async function fetchDisbursementSummaryOverall(): Promise<DisbursementSummaryOverallRow[]> {
  // Use mock data for overall summary
  return [{
    lender: "Overall",
    aop: 500,
    mtd_cr: 450,
    lmsd_cr: 400,
  }];
}

export async function fetchDisbursalMTDLender(): Promise<DisbursalBreakdownLenderRow[]> {
  // Use mock data for breakdown
  return [];
}

export async function fetchDisbursalLMSDLender(): Promise<DisbursalBreakdownLenderRow[]> {
  return [];
}

export async function fetchDisbursalFTDLender(): Promise<DisbursalBreakdownLenderRow[]> {
  return [];
}

export async function fetchDisbursalMTDLeadType(): Promise<DisbursalBreakdownLeadTypeRow[]> {
  return [];
}

export async function fetchDisbursalLMSDLeadType(): Promise<DisbursalBreakdownLeadTypeRow[]> {
  return [];
}

export async function fetchDisbursalFTDLeadType(): Promise<DisbursalBreakdownLeadTypeRow[]> {
  return [];
}

// ─── Data Processing Helpers ────────────────────────────────────────────────

/**
 * For each `major_index`, pick the `major_stage` label with the highest summed `leads`
 * across rows (ties broken lexicographically). Matches how ClickHouse stores multiple
 * spellings for the same index (e.g. Child Lead Created vs Child_Lead_Created).
 */
export function canonicalMajorStageByIndex(
  rows: { major_index: number; major_stage: string; leads: number }[]
): Record<number, string> {
  const perIndex = new Map<number, Map<string, number>>();
  for (const r of rows) {
    const idx = r.major_index;
    const stage = (r.major_stage ?? "").trim();
    if (!stage) continue;
    if (!perIndex.has(idx)) perIndex.set(idx, new Map());
    const m = perIndex.get(idx)!;
    m.set(stage, (m.get(stage) || 0) + r.leads);
  }
  const out: Record<number, string> = {};
  perIndex.forEach((stageMap, idx) => {
    let best = "";
    let bestLeads = -1;
    for (const [stage, leads] of stageMap) {
      if (leads > bestLeads || (leads === bestLeads && stage.localeCompare(best) < 0)) {
        bestLeads = leads;
        best = stage;
      }
    }
    if (best) out[idx] = best;
  });
  return out;
}

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

// ─── Month pacing (local calendar; browser TZ on client) ─────────────────────

export interface MonthPacing {
  /** Instant used for “as of” in UI copy. */
  referenceDate: Date;
  /** Length of the calendar month containing `asOf`. */
  daysInMonth: number;
  /**
   * Day of month (1-based), inclusive through `asOf`.
   * Used as run-rate denominator with MTD-through-today.
   */
  dayOfMonth: number;
}

/** Pacing for the month containing `asOf` (default: system “now”). */
export function getMonthPacing(asOf: Date = new Date()): MonthPacing {
  const y = asOf.getFullYear();
  const m = asOf.getMonth();
  const dayOfMonth = asOf.getDate();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  return { referenceDate: asOf, daysInMonth, dayOfMonth };
}

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
