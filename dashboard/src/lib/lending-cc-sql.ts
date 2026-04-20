/**
 * Default SELECTs against control_center OLAP tables (staging).
 * Tuned for dashboard types: L2AnalysisRow, DisbursalSummaryRow.
 */

/**
 * Calendar windows for disbursal summary, FTD, and funnel MTD/LMTD.
 *
 * **Reporting timezone:** day boundaries follow {@link getReportTimeZone} (default **Asia/Kolkata**), not the
 * browser’s local zone. That way MTD/LMTD ranges match India ops / ClickHouse reports even when the laptop is
 * set to US/Europe (where “local today” can still be “yesterday” in IST).
 *
 * **MTD:** first day of the month containing the report-zone **calendar date** of `asOf` → through that same
 * calendar date (inclusive).
 *
 * **LMTD (parallel prior month):** first day of the **previous** calendar month (in that zone) → the **same
 * day-of-month** as the anchor date, **capped** to that month’s length (28 / 30 / 31). Example: anchor 15 Apr
 * (IST) → LMTD 1 Mar–15 Mar; anchor 31 Mar → LMTD 1 Feb–28 Feb.
 */
export interface DisbursalSqlCalendarWindow {
  /** First day of month containing `asOf` (YYYY-MM-DD). */
  mtdStart: string;
  /** `asOf`’s calendar date — MTD **includes today** when `asOf` is current. */
  mtdEnd: string;
  /** First day of the **prior** calendar month (e.g. 1 Mar when `asOf` is in April). */
  lmtdStart: string;
  /** Parallel “today” in the prior month, capped to 28/30/31 (e.g. 15 Mar when `asOf` is 15 Apr). */
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
 * IANA timezone used for MTD/LMTD/FTD calendar math. Override with `REPORT_TIME_ZONE` or
 * `NEXT_PUBLIC_REPORT_TIME_ZONE` (e.g. `Asia/Kolkata`). Invalid values fall back to Asia/Kolkata.
 */
export function getReportTimeZone(): string {
  const raw =
    (typeof process !== "undefined" &&
      process.env &&
      (process.env.NEXT_PUBLIC_REPORT_TIME_ZONE || process.env.REPORT_TIME_ZONE)) ||
    "";
  const z = String(raw).trim();
  if (!z) return "Asia/Kolkata";
  try {
    Intl.DateTimeFormat(undefined, { timeZone: z });
    return z;
  } catch {
    return "Asia/Kolkata";
  }
}

/** Calendar y / zero-based month / day-of-month for `d` in `timeZone` (Gregorian). */
export function getCalendarPartsInTimeZone(d: Date, timeZone: string): { y: number; m0: number; dom: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const parts = fmt.formatToParts(d);
  let y = 0;
  let mo = 1;
  let dom = 1;
  for (const p of parts) {
    if (p.type === "year") y = parseInt(p.value, 10);
    else if (p.type === "month") mo = parseInt(p.value, 10);
    else if (p.type === "day") dom = parseInt(p.value, 10);
  }
  return { y, m0: mo - 1, dom };
}

/**
 * MTD: month start → anchor calendar date in the report zone (inclusive). LMTD: 1st of prior month → same DOM,
 * capped. FTD: that same calendar day (`mtdEnd`).
 */
export function getDisbursalCalendarWindows(asOf: Date = new Date()): DisbursalSqlCalendarWindow {
  const tz = getReportTimeZone();
  const { y, m0, dom } = getCalendarPartsInTimeZone(asOf, tz);

  const mtdStart = ymdFromParts(y, m0, 1);
  const mtdEnd = ymdFromParts(y, m0, dom);

  const lastDayPrevMonth = new Date(y, m0, 0);
  const py = lastDayPrevMonth.getFullYear();
  const pm = lastDayPrevMonth.getMonth();
  const daysInPrevMonth = lastDayPrevMonth.getDate();
  const lmtdParallelDay = Math.min(dom, daysInPrevMonth);
  const lmtdStart = ymdFromParts(py, pm, 1);
  const lmtdEnd = ymdFromParts(py, pm, lmtdParallelDay);

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
