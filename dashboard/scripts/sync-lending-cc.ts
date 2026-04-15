/**
 * Pulls L2 (marketplace OLAP, distinct parent leads) + disbursal slices from Lending CC and writes
 * CSVs under public/data/ch-sync/ for static export (GitHub Pages).
 *
 * Usage (from dashboard/):
 *   npm run sync:lending-cc
 *
 * Env: LENDING_CC_API_BASE_URL, LENDING_CC_API_TOKEN (or set in .env.local).
 * If staging TLS fails: NODE_TLS_REJECT_UNAUTHORIZED=0 npm run sync:lending-cc
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { lendingCCPostQuery, rowsToObjects } from "../src/lib/lending-cc-server";
import {
  buildDisbursalSummarySql,
  getDisbursalCalendarWindows,
  L2_ANALYSIS_SQL,
  LENDER_MARKETPLACE_FUNNEL_SQL,
  MARKETPLACE_FUNNEL_SQL,
} from "../src/lib/lending-cc-sql";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function loadEnvLocal(): void {
  const envPath = join(ROOT, ".env.local");
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function csvEscape(s: string): string {
  if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(headers: string[], rows: Record<string, string>[]): string {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h] ?? "")).join(","));
  }
  return `${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
  loadEnvLocal();

  const outDir = join(ROOT, "public", "data", "ch-sync");
  mkdirSync(outDir, { recursive: true });

  const l2Res = await lendingCCPostQuery(L2_ANALYSIS_SQL);
  const l2Objs = rowsToObjects(l2Res.columns, l2Res.rows);
  const l2CsvRows: Record<string, string>[] = l2Objs.map((o) => ({
    lender: String(o.lender ?? ""),
    month_start: String(o.month_start ?? ""),
    product_type: String(o.product_type ?? ""),
    isautoleadcreated: String(o.isautoleadcreated ?? ""),
    major_index: String(o.major_index ?? ""),
    original_major_stage: String(o.original_major_stage ?? ""),
    sub_stage: String(o.sub_stage ?? ""),
    Leads: String(o.leads ?? ""),
    "Stuck%": o.stuck_pct == null || o.stuck_pct === "" ? "" : String(o.stuck_pct),
  }));
  const l2Headers = [
    "lender",
    "month_start",
    "product_type",
    "isautoleadcreated",
    "major_index",
    "original_major_stage",
    "sub_stage",
    "Leads",
    "Stuck%",
  ];
  writeFileSync(join(outDir, "L2_Analysis.csv"), rowsToCsv(l2Headers, l2CsvRows), "utf8");

  const disRes = await lendingCCPostQuery(buildDisbursalSummarySql(getDisbursalCalendarWindows()));
  const disObjs = rowsToObjects(disRes.columns, disRes.rows);
  const disCsvRows: Record<string, string>[] = disObjs.map((o) => {
    const child = Number(o.child_leads) || 0;
    const disb = Number(o.disbursed) || 0;
    const pct =
      child > 0 ? ((disb / child) * 100).toFixed(2) : String(Number(o.disbursal_pct) || 0);
    return {
      product_type: String(o.product_type ?? ""),
      isautoleadcreated: String(o.isautoleadcreated ?? ""),
      lender: String(o.lender ?? ""),
      "#Child_Leads_Created": String(child),
      "#Disbursed": String(disb),
      "Disbursal %": pct,
      Amt_Cr: o.amt_cr == null ? "" : String(o.amt_cr),
      "#Disbursed_LMSD": o.lmtd_disbursed == null ? "" : String(o.lmtd_disbursed),
      Amt_Cr_LMSD: o.lmtd_amt_cr == null ? "" : String(o.lmtd_amt_cr),
    };
  });
  const disHeaders = [
    "product_type",
    "isautoleadcreated",
    "lender",
    "#Child_Leads_Created",
    "#Disbursed",
    "Disbursal %",
    "Amt_Cr",
    "#Disbursed_LMSD",
    "Amt_Cr_LMSD",
  ];
  writeFileSync(join(outDir, "Lender_Level_Disb_Summary.csv"), rowsToCsv(disHeaders, disCsvRows), "utf8");

  // Marketplace funnel
  const mktRes = await lendingCCPostQuery(MARKETPLACE_FUNNEL_SQL);
  const mktObjs = rowsToObjects(mktRes.columns, mktRes.rows);
  const mktCsvRows: Record<string, string>[] = mktObjs.map((o) => ({
    major_index: String(o.major_index ?? ""),
    major_stage: String(o.major_stage ?? ""),
    Leads: String(o.leads ?? ""),
    period: String(o.period ?? ""),
  }));
  const mktHeaders = ["major_index", "major_stage", "Leads", "period"];
  writeFileSync(join(outDir, "Marketplace_Funnel.csv"), rowsToCsv(mktHeaders, mktCsvRows), "utf8");

  // Lender-level marketplace funnel (for heatmap)
  const lenderMktRes = await lendingCCPostQuery(LENDER_MARKETPLACE_FUNNEL_SQL);
  const lenderMktObjs = rowsToObjects(lenderMktRes.columns, lenderMktRes.rows);
  const lenderMktCsvRows: Record<string, string>[] = lenderMktObjs.map((o) => ({
    lender: String(o.lender ?? ""),
    product_type: String(o.product_type ?? ""),
    major_index: String(o.major_index ?? ""),
    major_stage: String(o.major_stage ?? ""),
    leads: String(o.leads ?? ""),
    period: String(o.period ?? ""),
  }));
  const lenderMktHeaders = ["lender", "product_type", "major_index", "major_stage", "leads", "period"];
  writeFileSync(join(outDir, "Lender_Marketplace_Funnel.csv"), rowsToCsv(lenderMktHeaders, lenderMktCsvRows), "utf8");

  console.log(`Wrote ${l2CsvRows.length} L2 rows, ${disCsvRows.length} disbursal rows, ${mktCsvRows.length} marketplace funnel rows, and ${lenderMktCsvRows.length} lender-level marketplace rows to ${outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
