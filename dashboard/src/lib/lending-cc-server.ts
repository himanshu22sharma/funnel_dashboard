/**
 * Server-only: calls Lending CC ClickHouse REST API (staging).
 * @see ML_CC_Overall "Lending CC - clickhouse _ mcp consumer guide" docx
 */

import { buildLendingCcNonJsonError } from "@/lib/lending-cc-error-message";

function getConfig(): { baseUrl: string; token: string } | null {
  const baseUrl = (process.env.LENDING_CC_API_BASE_URL || "").replace(/\/$/, "");
  const token = process.env.LENDING_CC_API_TOKEN || "";
  if (!baseUrl || !token) return null;
  return { baseUrl, token };
}

export type LendingCCQueryResult = { columns: string[]; rows: unknown[][] };

export async function lendingCCPostQuery(query: string): Promise<LendingCCQueryResult> {
  const cfg = getConfig();
  if (!cfg) throw new Error("LENDING_CC_API_BASE_URL and LENDING_CC_API_TOKEN must be set");

  const res = await fetch(`${cfg.baseUrl}/api/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.token}`,
    },
    body: JSON.stringify({ query }),
  });

  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(buildLendingCcNonJsonError(res.status, text));
  }

  if (!res.ok) {
    const err = (json as { error?: string })?.error || text.slice(0, 300);
    throw new Error(`Lending CC API ${res.status}: ${err}`);
  }

  const obj = json as LendingCCQueryResult;
  if (!Array.isArray(obj.columns) || !Array.isArray(obj.rows)) {
    throw new Error("Lending CC API: unexpected response shape");
  }
  return obj;
}

export function rowsToObjects(columns: string[], rows: unknown[][]): Record<string, unknown>[] {
  return rows.map((row) => {
    const o: Record<string, unknown> = {};
    columns.forEach((c, i) => {
      o[c] = row[i];
    });
    return o;
  });
}
