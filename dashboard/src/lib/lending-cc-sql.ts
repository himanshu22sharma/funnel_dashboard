/**
 * Default SELECTs against control_center OLAP tables (staging).
 * Tuned for dashboard types: L2AnalysisRow, DisbursalSummaryRow.
 */

/** Calendar windows for disbursal summary, FTD, and funnel MTD/LMTD (browser local date). */
export interface DisbursalSqlCalendarWindow {
  /** First day of month containing `asOf` (YYYY-MM-DD). */
  mtdStart: string;
  /** Same calendar day as `asOf` — MTD includes “today”. */
  mtdEnd: string;
  /** First day of prior month. */
  lmtdStart: string;
  /** Same day-of-month as `asOf`, capped by prior month length (parallel LMTD). */
  lmtdEnd: string;
  /** FTD = activations on this calendar day (same as `mtdEnd` when `asOf` is end-of-day “today”). */
  ftdDate: string;
}

function ymdFromParts(year: number, monthIndex0: number, day: number): string {
  const m = String(monthIndex0 + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

/**
 * MTD: month start → `asOf` (inclusive). LMTD: same span in the previous calendar month.
 * FTD: `asOf` calendar day only (typically today when callers pass `new Date()`).
 */
export function getDisbursalCalendarWindows(asOf: Date = new Date()): DisbursalSqlCalendarWindow {
  const y = asOf.getFullYear();
  const m = asOf.getMonth();
  const dom = asOf.getDate();

  const mtdStart = ymdFromParts(y, m, 1);
  const mtdEnd = ymdFromParts(y, m, dom);

  const lastDayPrevMonth = new Date(y, m, 0);
  const py = lastDayPrevMonth.getFullYear();
  const pm = lastDayPrevMonth.getMonth();
  const daysInPrev = lastDayPrevMonth.getDate();
  const lmtdEndDay = Math.min(dom, daysInPrev);
  const lmtdStart = ymdFromParts(py, pm, 1);
  const lmtdEnd = ymdFromParts(py, pm, lmtdEndDay);

  return { mtdStart, mtdEnd, lmtdStart, lmtdEnd, ftdDate: mtdEnd };
}

/** Alias: funnel L1/L2 + heatmap use the same MTD/LMTD windows as disbursal. */
export const getFunnelCalendarWindows = getDisbursalCalendarWindows;

/**
 * L2 / sub-stage grain for funnel-summary + ch-sync: marketplace OLAP only.
 * `lead_created_at` filtered by {@link getDisbursalCalendarWindows} (MTD includes query day).
 */
export function buildL2AnalysisSql(w: DisbursalSqlCalendarWindow): string {
  return `
SELECT
  month_start,
  lender,
  product_type,
  isautoleadcreated,
  major_index,
  original_major_stage,
  sub_stage,
  leads,
  stuck_pct
FROM (
  SELECT
    '1.MTD' AS month_start,
    lender,
    product_type,
    '' AS isautoleadcreated,
    major_index,
    major_stage AS original_major_stage,
    ifNull(sub_stage, '') AS sub_stage,
    count(distinct LRE_PARENT_LEAD) AS leads,
    CAST(NULL AS Nullable(Float64)) AS stuck_pct
  FROM control_center.ml_marketplace_olap
  WHERE major_index >= 2 AND major_index <= 15
    AND product_type = 'Fresh'
    AND isdynamicwhitelist = 'False'
    AND brp_flag = 'REGULAR'
    AND product_scheme = 'TERM_LOAN'
    AND toDate(lead_created_at) >= toDate('${w.mtdStart}')
    AND toDate(lead_created_at) <= toDate('${w.mtdEnd}')
    AND is_active = 1
  GROUP BY lender, product_type, major_index, major_stage, sub_stage

  UNION ALL

  SELECT
    '2.LMTD' AS month_start,
    lender,
    product_type,
    '' AS isautoleadcreated,
    major_index,
    major_stage AS original_major_stage,
    ifNull(sub_stage, '') AS sub_stage,
    count(distinct LRE_PARENT_LEAD) AS leads,
    CAST(NULL AS Nullable(Float64)) AS stuck_pct
  FROM control_center.ml_marketplace_olap
  WHERE major_index >= 2 AND major_index <= 15
    AND product_type = 'Fresh'
    AND isdynamicwhitelist = 'False'
    AND brp_flag = 'REGULAR'
    AND product_scheme = 'TERM_LOAN'
    AND toDate(lead_created_at) >= toDate('${w.lmtdStart}')
    AND toDate(lead_created_at) <= toDate('${w.lmtdEnd}')
    AND is_active = 1
  GROUP BY lender, product_type, major_index, major_stage, sub_stage
)
`.trim();
}

/**
 * `control_center.ml_disbursal` — same grain as `SELECT * FROM ml_disbursal`.
 * - Lender: `lender_name`
 * - Program: `lead_type` (as `product_type`)
 * - Count: `loans_disbursed`; amount: `amount_disbursed` / 1e7 → Cr
 * Windows come from {@link getDisbursalCalendarWindows} (MTD includes query day).
 */
export function buildDisbursalSummarySql(w: DisbursalSqlCalendarWindow): string {
  return `
WITH
mtd AS (
  SELECT
    lender_name,
    lead_type,
    sum(toUInt64(loans_disbursed)) AS disbursed,
    sum(toFloat64(amount_disbursed)) / 1e7 AS amt_cr
  FROM control_center.ml_disbursal
  WHERE toDate(account_activation_date) >= toDate('${w.mtdStart}')
    AND toDate(account_activation_date) <= toDate('${w.mtdEnd}')
  GROUP BY lender_name, lead_type
),
lmtd AS (
  SELECT
    lender_name,
    lead_type,
    sum(toUInt64(loans_disbursed)) AS lmtd_disbursed,
    sum(toFloat64(amount_disbursed)) / 1e7 AS lmtd_amt_cr
  FROM control_center.ml_disbursal
  WHERE toDate(account_activation_date) >= toDate('${w.lmtdStart}')
    AND toDate(account_activation_date) <= toDate('${w.lmtdEnd}')
  GROUP BY lender_name, lead_type
)
SELECT
  lead_type AS product_type,
  '' AS isautoleadcreated,
  coalesce(mtd.lender_name, lmtd.lender_name) AS lender,
  toUInt64(0) AS child_leads,
  toUInt64(coalesce(mtd.disbursed, toUInt64(0))) AS disbursed,
  toFloat64(0) AS disbursal_pct,
  toFloat64(coalesce(mtd.amt_cr, toFloat64(0))) AS amt_cr,
  toUInt64(coalesce(lmtd.lmtd_disbursed, toUInt64(0))) AS lmtd_disbursed,
  toFloat64(coalesce(lmtd.lmtd_amt_cr, toFloat64(0))) AS lmtd_amt_cr
FROM mtd
FULL OUTER JOIN lmtd ON mtd.lender_name = lmtd.lender_name AND mtd.lead_type = lmtd.lead_type
WHERE coalesce(mtd.disbursed, toUInt64(0)) > 0
   OR coalesce(lmtd.lmtd_disbursed, toUInt64(0)) > 0
`.trim();
}

/** Lender-wise FTD for one calendar day (`ftdDate` = YYYY-MM-DD). */
export function buildDisbursalFtdLenderSql(ftdDate: string): string {
  return `
SELECT
  lender_name AS lender,
  if(
    sum(toUInt64(ifNull(loans_disbursed, toUInt64(0)))) > 0,
    sum(toUInt64(ifNull(loans_disbursed, toUInt64(0)))),
    toUInt64(count())
  ) AS loan,
  sum(toFloat64(ifNull(amount_disbursed, 0))) / 1e7 AS amt_cr
FROM control_center.ml_disbursal
WHERE account_activation_date >= toDate('${ftdDate}')
  AND account_activation_date < toDate('${ftdDate}') + 1
GROUP BY lender_name
HAVING loan > 0
ORDER BY 2 DESC
`.trim();
}

/** Lead-type–wise FTD for the same calendar day. */
export function buildDisbursalFtdLeadTypeSql(ftdDate: string): string {
  return `
SELECT
  lead_type AS lead_type,
  if(
    sum(toUInt64(ifNull(loans_disbursed, toUInt64(0)))) > 0,
    sum(toUInt64(ifNull(loans_disbursed, toUInt64(0)))),
    toUInt64(count())
  ) AS loan,
  sum(toFloat64(ifNull(amount_disbursed, 0))) / 1e7 AS amt_cr
FROM control_center.ml_disbursal
WHERE account_activation_date >= toDate('${ftdDate}')
  AND account_activation_date < toDate('${ftdDate}') + 1
GROUP BY lead_type
HAVING loan > 0
ORDER BY 2 DESC
`.trim();
}

/** L1 marketplace funnel (major stages): `parent_created_dt`, same MTD/LMTD calendar as L2. */
export function buildMarketplaceFunnelSql(w: DisbursalSqlCalendarWindow): string {
  return `
SELECT
  major_index,
  major_stage,
  count(distinct LRE_PARENT_LEAD) AS leads,
  '1.MTD' AS period
FROM control_center.ml_marketplace_olap
WHERE product_scheme = 'TERM_LOAN'
  AND product_type = 'Fresh'
  AND isdynamicwhitelist = 'False'
  AND brp_flag = 'REGULAR'
  AND toDate(parent_created_dt) >= toDate('${w.mtdStart}')
  AND toDate(parent_created_dt) <= toDate('${w.mtdEnd}')
  AND major_index BETWEEN 2 AND 15
GROUP BY major_index, major_stage

UNION ALL

SELECT
  major_index,
  major_stage,
  count(distinct LRE_PARENT_LEAD) AS leads,
  '2.LMTD' AS period
FROM control_center.ml_marketplace_olap
WHERE product_scheme = 'TERM_LOAN'
  AND product_type = 'Fresh'
  AND isdynamicwhitelist = 'False'
  AND brp_flag = 'REGULAR'
  AND toDate(parent_created_dt) >= toDate('${w.lmtdStart}')
  AND toDate(parent_created_dt) <= toDate('${w.lmtdEnd}')
  AND major_index BETWEEN 2 AND 15
GROUP BY major_index, major_stage
`.trim();
}

/** Lender-level marketplace funnel for heatmap: `lead_created_at`, same MTD/LMTD as L2. */
export function buildLenderMarketplaceFunnelSql(w: DisbursalSqlCalendarWindow): string {
  return `
SELECT
  lender,
  product_type,
  major_index,
  major_stage,
  count(distinct LRE_PARENT_LEAD) AS leads,
  '1.MTD' AS period
FROM control_center.ml_marketplace_olap
WHERE product_scheme = 'TERM_LOAN'
  AND product_type = 'Fresh'
  AND isdynamicwhitelist = 'False'
  AND brp_flag = 'REGULAR'
  AND toDate(lead_created_at) >= toDate('${w.mtdStart}')
  AND toDate(lead_created_at) <= toDate('${w.mtdEnd}')
  AND major_index BETWEEN 6 AND 15
GROUP BY lender, product_type, major_index, major_stage

UNION ALL

SELECT
  lender,
  product_type,
  major_index,
  major_stage,
  count(distinct LRE_PARENT_LEAD) AS leads,
  '2.LMTD' AS period
FROM control_center.ml_marketplace_olap
WHERE product_scheme = 'TERM_LOAN'
  AND product_type = 'Fresh'
  AND isdynamicwhitelist = 'False'
  AND brp_flag = 'REGULAR'
  AND toDate(lead_created_at) >= toDate('${w.lmtdStart}')
  AND toDate(lead_created_at) <= toDate('${w.lmtdEnd}')
  AND major_index BETWEEN 6 AND 15
GROUP BY lender, product_type, major_index, major_stage
`.trim();
}
