/**
 * Map Lending CC /api/query results into dashboard types for funnel-summary (ClickHouse-only path).
 */

import { lendingCCClientPostQuery, rowsToObjects } from "@/lib/lending-cc-client";
import {
  buildDisbursalFtdLeadTypeSql,
  buildDisbursalFtdLenderSql,
  buildDisbursalSummarySql,
  buildL2AnalysisSql,
  buildLenderMarketplaceFunnelSql,
  buildMarketplaceFunnelSql,
  getDisbursalCalendarWindows,
} from "@/lib/lending-cc-sql";
import {
  normalizeMarketplaceFlow,
  type DisbursalBreakdownLeadTypeRow,
  type DisbursalBreakdownLenderRow,
  type DisbursalSummaryRow,
  type FunnelRow,
  type L2AnalysisRow,
  type LenderFunnelRow,
  type LenderMarketplaceRow,
  type MarketplaceFunnelRow,
} from "@/lib/data";

function num(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return Math.round(v);
  return parseInt(String(v ?? "0").replace(/,/g, ""), 10) || 0;
}

function floatOpt(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = parseFloat(String(v).replace(/,/g, ""));
  return Number.isNaN(n) ? undefined : n;
}

export function mapL2QueryRow(o: Record<string, unknown>): L2AnalysisRow {
  const mi = o.major_index;
  const majorIndex =
    typeof mi === "number" && !Number.isNaN(mi) ? mi : parseFloat(String(mi ?? "0")) || 0;
  const sub = o.sub_stage;
  const subStage =
    sub != null && String(sub).trim() !== "" ? String(sub).trim() : null;
  const leadsRaw = o.leads ?? o.Leads;
  return {
    lender: String(o.lender ?? ""),
    month_start: String(o.month_start ?? ""),
    product_type: String(o.product_type ?? ""),
    isautoleadcreated: normalizeMarketplaceFlow(String(o.isautoleadcreated ?? "")),
    major_index: majorIndex,
    original_major_stage: String(o.original_major_stage ?? ""),
    sub_stage: subStage,
    leads:
      typeof leadsRaw === "number" && !Number.isNaN(leadsRaw)
        ? Math.round(leadsRaw)
        : parseInt(String(leadsRaw ?? "0").replace(/,/g, ""), 10) || 0,
    stuck_pct:
      o.stuck_pct != null && o.stuck_pct !== "" ? parseFloat(String(o.stuck_pct)) : null,
  };
}

export function mapMarketplaceQueryRow(o: Record<string, unknown>): MarketplaceFunnelRow {
  return {
    major_index: num(o.major_index),
    major_stage: String(o.major_stage ?? "").trim(),
    leads: num(o.leads),
    period: String(o.period ?? "").trim(),
  };
}

export function mapLenderMarketplaceQueryRow(o: Record<string, unknown>): LenderMarketplaceRow {
  return {
    lender: String(o.lender ?? "").trim(),
    product_type: String(o.product_type ?? "").trim(),
    major_index: num(o.major_index),
    major_stage: String(o.major_stage ?? "").trim(),
    leads: num(o.leads),
    period: String(o.period ?? "").trim(),
  };
}

export function mapFtdLenderBreakdownRow(o: Record<string, unknown>): DisbursalBreakdownLenderRow {
  const loan = num(o.loan ?? (o as { Loan?: unknown }).Loan ?? o.disbursed);
  const amtRaw = floatOpt(o.amt_cr) ?? floatOpt((o as { Amt_Cr?: unknown }).Amt_Cr) ?? 0;
  const ats = loan > 0 ? Math.round((amtRaw * 1e7) / loan) : 0;
  return {
    lender: String(o.lender ?? (o as { Lender?: unknown }).Lender ?? "").trim(),
    loan,
    amt_cr: amtRaw,
    ats,
    avg: 0,
    avg_pf: 0,
  };
}

export function mapFtdLeadTypeBreakdownRow(o: Record<string, unknown>): DisbursalBreakdownLeadTypeRow {
  const loan = num(o.loan ?? (o as { Loan?: unknown }).Loan ?? o.disbursed);
  const amtRaw = floatOpt(o.amt_cr) ?? floatOpt((o as { Amt_Cr?: unknown }).Amt_Cr) ?? 0;
  const ats = loan > 0 ? Math.round((amtRaw * 1e7) / loan) : 0;
  return {
    lead_type: String(o.lead_type ?? (o as { Lead_type?: unknown }).Lead_type ?? "").trim(),
    loan,
    amt_cr: amtRaw,
    ats,
    avg: 0,
    avg_pf: 0,
  };
}

export function mapDisbursalQueryRow(o: Record<string, unknown>): DisbursalSummaryRow {
  const child = num(o.child_leads);
  const disb =
    o.disbursed != null && o.disbursed !== ""
      ? num(o.disbursed)
      : num(o.loans_disbursed ?? o.loan_disbursed);
  const pctRaw = o.disbursal_pct;
  const pct =
    child > 0
      ? parseFloat(((disb / child) * 100).toFixed(2))
      : typeof pctRaw === "number"
        ? pctRaw
        : parseFloat(String(pctRaw ?? "0")) || 0;
  return {
    product_type: String(o.product_type ?? "").trim(),
    isautoleadcreated: String(o.isautoleadcreated ?? "").trim(),
    lender: String(o.lender ?? "").trim(),
    child_leads: child,
    disbursed: disb,
    disbursal_pct: pct,
    amt_cr: floatOpt(o.amt_cr),
    lmtd_disbursed: o.lmtd_disbursed != null && o.lmtd_disbursed !== "" ? num(o.lmtd_disbursed) : undefined,
    lmtd_amt_cr: floatOpt(o.lmtd_amt_cr),
  };
}

/**
 * Aggregate MTD L2 major-stage rows (no sub_stage) into lender funnel rows for lender-scoped funnel UI.
 */
export function deriveLenderFunnelFromL2(l2: L2AnalysisRow[]): LenderFunnelRow[] {
  type Key = string;
  const sums = new Map<Key, { lender: string; product_type: string; isautoleadcreated: string; major_index: number; major_stage: string; leads: number }>();
  for (const r of l2) {
    if (r.month_start !== "1.MTD" || r.sub_stage) continue;
    if (Math.floor(r.major_index) !== r.major_index || r.major_index >= 1000 || r.major_index === 1) continue;
    const k = `${r.lender}\t${r.product_type}\t${r.isautoleadcreated}\t${r.major_index}\t${r.original_major_stage}`;
    const cur = sums.get(k);
    if (cur) cur.leads += r.leads;
    else
      sums.set(k, {
        lender: r.lender,
        product_type: r.product_type,
        isautoleadcreated: r.isautoleadcreated,
        major_index: r.major_index,
        major_stage: r.original_major_stage,
        leads: r.leads,
      });
  }
  return Array.from(sums.values())
    .map((v) => ({
      lender: v.lender,
      product_type: v.product_type,
      isautoleadcreated: v.isautoleadcreated,
      major_index: v.major_index,
      major_stage: v.major_stage,
      leads: v.leads,
      conv_pct: null as number | null,
    }))
    .sort((a, b) => a.major_index - b.major_index || a.lender.localeCompare(b.lender));
}

export interface FunnelSummaryChPayload {
  l2: L2AnalysisRow[];
  mkt: MarketplaceFunnelRow[];
  lenderMkt: LenderMarketplaceRow[];
  disb: DisbursalSummaryRow[];
}

/** Core funnel payload (2 parallel queries) — use first for faster perceived load on funnel-summary. */
export async function loadFunnelSummaryCoreChData(asOf: Date = new Date()): Promise<{
  l2: L2AnalysisRow[];
  mkt: MarketplaceFunnelRow[];
}> {
  const w = getDisbursalCalendarWindows(asOf);
  const [l2Res, mktRes] = await Promise.all([
    lendingCCClientPostQuery(buildL2AnalysisSql(w)),
    lendingCCClientPostQuery(buildMarketplaceFunnelSql(w)),
  ]);
  const l2 = rowsToObjects(l2Res.columns, l2Res.rows).map(mapL2QueryRow);
  const mkt = rowsToObjects(mktRes.columns, mktRes.rows).map(mapMarketplaceQueryRow);
  return { l2, mkt };
}

/** Heatmap + disbursal (2 parallel queries). */
export async function loadFunnelSummarySecondaryChData(asOf: Date = new Date()): Promise<{
  lenderMkt: LenderMarketplaceRow[];
  disb: DisbursalSummaryRow[];
}> {
  const w = getDisbursalCalendarWindows(asOf);
  const disbursalSql = buildDisbursalSummarySql(w);
  const [lenderMktRes, disRes] = await Promise.all([
    lendingCCClientPostQuery(buildLenderMarketplaceFunnelSql(w)),
    lendingCCClientPostQuery(disbursalSql),
  ]);
  const lenderMkt = rowsToObjects(lenderMktRes.columns, lenderMktRes.rows).map(mapLenderMarketplaceQueryRow);
  const disb = rowsToObjects(disRes.columns, disRes.rows).map(mapDisbursalQueryRow);
  return { lenderMkt, disb };
}

/** Disbursal summary only (single query) — disbursal-summary page when Lending CC is configured. */
export async function loadDisbursalSummaryChRows(asOf: Date = new Date()): Promise<DisbursalSummaryRow[]> {
  const sql = buildDisbursalSummarySql(getDisbursalCalendarWindows(asOf));
  const disRes = await lendingCCClientPostQuery(sql);
  return rowsToObjects(disRes.columns, disRes.rows).map(mapDisbursalQueryRow);
}

/** FTD = `ftdDate` calendar day (default: today). Lender + lead-type queries from `ml_disbursal`. */
export async function loadDisbursalFtdChRows(asOf: Date = new Date()): Promise<{
  lenders: DisbursalBreakdownLenderRow[];
  leadTypes: DisbursalBreakdownLeadTypeRow[];
  errors: string[];
}> {
  const { ftdDate } = getDisbursalCalendarWindows(asOf);
  const errors: string[] = [];
  let lenders: DisbursalBreakdownLenderRow[] = [];
  let leadTypes: DisbursalBreakdownLeadTypeRow[] = [];
  try {
    const lRes = await lendingCCClientPostQuery(buildDisbursalFtdLenderSql(ftdDate));
    lenders = rowsToObjects(lRes.columns, lRes.rows).map(mapFtdLenderBreakdownRow);
  } catch (e) {
    errors.push(`FTD lender query: ${e instanceof Error ? e.message : String(e)}`);
  }
  try {
    const tRes = await lendingCCClientPostQuery(buildDisbursalFtdLeadTypeSql(ftdDate));
    leadTypes = rowsToObjects(tRes.columns, tRes.rows).map(mapFtdLeadTypeBreakdownRow);
  } catch (e) {
    errors.push(`FTD lead-type query: ${e instanceof Error ? e.message : String(e)}`);
  }
  return { lenders, leadTypes, errors };
}

export async function loadFunnelSummaryClickhouseData(asOf: Date = new Date()): Promise<FunnelSummaryChPayload> {
  const [core, secondary] = await Promise.all([
    loadFunnelSummaryCoreChData(asOf),
    loadFunnelSummarySecondaryChData(asOf),
  ]);
  return { l2: core.l2, mkt: core.mkt, lenderMkt: secondary.lenderMkt, disb: secondary.disb };
}

/** Build CommandFunnel `completeFunnel` rows from MTD marketplace slice (same rules as previous CSV path). */
export function buildCompleteFunnelFromMarketplaceMtd(mkt: MarketplaceFunnelRow[]): FunnelRow[] {
  return mkt
    .filter((r) => r.period === "1.MTD")
    .filter((r) => r.major_index >= 2 && r.major_index <= 15)
    .filter((r) => r.major_index !== 6 || r.major_stage === "Child_Lead_Created")
    .map((r) => ({
      product_type: "Fresh",
      isautoleadcreated: "",
      major_index: r.major_index,
      major_stage: r.major_stage,
      leads: r.leads,
      conv_pct: null,
    }))
    .sort((a, b) => a.major_index - b.major_index);
}
