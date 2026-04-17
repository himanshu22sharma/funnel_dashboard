/**
 * Human-readable errors when Lending CC returns HTML/plain text instead of JSON.
 */

export function buildLendingCcNonJsonError(status: number, rawBody: string): string {
  const t = rawBody.trim().replace(/\s+/g, " ");
  const snippet = t.slice(0, 220) || "(empty response body)";
  const title = t.match(/<title>([^<]{1,140})<\/title>/i)?.[1]?.trim();

  if (status >= 500) {
    return [
      `Lending CC returned HTTP ${status} with a non-JSON body (often a plain “Internal Server Error” or HTML page).`,
      title ? `Server title: ${title}.` : `Snippet: ${snippet}.`,
      "This almost always means ClickHouse rejected a query (e.g. unknown column) or Lending CC crashed — check Lending CC / ClickHouse logs.",
      "If funnel-summary broke after an L2 SQL change, confirm `ml_marketplace_olap` exposes every column used in `buildL2AnalysisSql` / L2 query (including `isautoleadcreated` when you enable flow split in SQL).",
    ].join(" ");
  }

  if (status === 401 || status === 403) {
    return `Lending CC returned HTTP ${status} with a non-JSON body (${snippet}). Check LENDING_CC_API_TOKEN / NEXT_PUBLIC_LENDING_CC_API_TOKEN.`;
  }

  return `Lending CC returned HTTP ${status} with a non-JSON body (${snippet}).`;
}
