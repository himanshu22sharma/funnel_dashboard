/**
 * Browser-side ClickHouse via Lending CC REST API (same /api/query as sync script).
 * Use NEXT_PUBLIC_* env vars so the static-export build can call the API from the client.
 */

import { buildLendingCcNonJsonError } from "@/lib/lending-cc-error-message";

export type LendingCCQueryResult = { columns: string[]; rows: unknown[][] };

export function getLendingCCClientConfig(): { baseUrl: string; token: string } | null {
  const baseUrl = (process.env.NEXT_PUBLIC_LENDING_CC_API_BASE_URL || "").replace(/\/$/, "");
  const token = (process.env.NEXT_PUBLIC_LENDING_CC_API_TOKEN || "").trim();
  if (!baseUrl || !token) return null;
  return { baseUrl, token };
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

/** CH can be slow; keep below typical LB idle timeouts but avoid hanging the UI forever. */
const DEFAULT_QUERY_TIMEOUT_MS = 60_000;

/** Same-origin URL when next.config rewrites /lending-cc/api/query → Lending CC (fixes browser CORS in dev / Vercel). */
function lendingCcPostQueryTarget(cfg: { baseUrl: string }): { url: string; viaProxy: boolean } {
  const forceDirect = process.env.NEXT_PUBLIC_LENDING_CC_DIRECT === "1";
  const rewriteEnabled = process.env.NEXT_PUBLIC_LENDING_CC_REWRITE === "1";
  if (forceDirect || !rewriteEnabled || typeof window === "undefined") {
    return { url: `${cfg.baseUrl}/api/query`, viaProxy: false };
  }
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");
  const pathname = `${basePath}/lending-cc/api/query`.replace(/\/+/g, "/");
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return { url: new URL(path, window.location.origin).href, viaProxy: true };
}

export async function lendingCCClientPostQuery(
  query: string,
  opts?: { timeoutMs?: number }
): Promise<LendingCCQueryResult> {
  const cfg = getLendingCCClientConfig();
  if (!cfg) {
    throw new Error(
      "Live ClickHouse from the browser requires NEXT_PUBLIC_LENDING_CC_API_BASE_URL and NEXT_PUBLIC_LENDING_CC_API_TOKEN (same values as LENDING_CC_* used for sync)."
    );
  }

  const { url: postUrl, viaProxy } = lendingCcPostQueryTarget(cfg);
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_QUERY_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(postUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.token}`,
      },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });
  } catch (e) {
    const aborted =
      (e instanceof Error && e.name === "AbortError") ||
      (typeof DOMException !== "undefined" && e instanceof DOMException && e.name === "AbortError");
    if (aborted) {
      throw new Error(
        `Lending CC request timed out after ${timeoutMs / 1000}s (check VPN, API reachability, and CORS on ${cfg.baseUrl}).`
      );
    }
    const raw = e instanceof Error ? e.message : String(e);
    if (raw === "Failed to fetch" && viaProxy) {
      throw new Error(
        `Failed to fetch same-origin proxy (${postUrl}). Restart next dev after setting LENDING_CC_API_BASE_URL (or NEXT_PUBLIC_) in .env.local so next.config rewrites apply, or fix your network.`
      );
    }
    if (raw === "Failed to fetch") {
      throw new Error(
        `Failed to fetch Lending CC at ${cfg.baseUrl}. This is usually CORS: run next dev with LENDING_CC_* in .env.local (same-origin proxy), host a CORS-enabled API, or set NEXT_PUBLIC_LENDING_CC_DIRECT=1 if the API already allows your origin.`
      );
    }
    throw e instanceof Error ? e : new Error(String(e));
  } finally {
    clearTimeout(timeoutId);
  }

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
