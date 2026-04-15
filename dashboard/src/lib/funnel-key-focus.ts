/**
 * Key Focus Areas: lender × flow / product × stage + L2 + volume lines. Pure helpers for funnel-summary.
 */

import type { L2AnalysisRow, LenderMarketplaceRow } from "@/lib/data";
import { formatFlowTypeForUi, normalizeMarketplaceFlow } from "@/lib/data";

export function heuristicTerminalSubStage(sub: string): boolean {
  return /FAIL|REJECT|REJECTED|HOLD|TERMINAL|DISBURSEMENT|QC_REJECT|ON_HOLD|EMANDATE|BRE2_FAILURE|SERVICEABILITY|BANK_NAME/i.test(
    sub
  );
}

export function isMajorL2Row(r: L2AnalysisRow): boolean {
  const sub = (r.sub_stage ?? "").trim();
  return (
    sub === "" &&
    Math.floor(r.major_index) === r.major_index &&
    r.major_index < 1000 &&
    r.major_index !== 1
  );
}

function rowMatchesKeyFocusFilters(
  r: L2AnalysisRow,
  opts: { lender: string; productType: string; flow: string }
): boolean {
  if (opts.lender !== "All" && r.lender !== opts.lender) return false;
  if (opts.productType !== "All" && r.product_type !== opts.productType) return false;
  if (opts.flow === "All") return true;
  const f = normalizeMarketplaceFlow((r.isautoleadcreated ?? "").trim());
  if (f === "") return true;
  return f === normalizeMarketplaceFlow(opts.flow.trim());
}

function fmtIn(n: number): string {
  return n.toLocaleString("en-IN");
}

export type KeyFocusStripItem = {
  text: string;
  subtitle?: string;
  detailLine?: string;
  severity: "critical" | "warning" | "good";
  stageIndex: number;
  stage: string;
  lender?: string;
  deltaPp: number;
};

export type KeyFocusStagePair = {
  prevIdx: number;
  curIdx: number;
  prevName: string;
  curName: string;
};

function majorGet(
  m: Map<string, number>,
  lender: string,
  flow: string,
  period: string,
  idx: number
): number {
  return m.get(`${lender}\t${flow}\t${period}\t${idx}`) ?? 0;
}

function majorSumAllFlows(m: Map<string, number>, lender: string, period: string, idx: number): number {
  let s = 0;
  for (const [k, v] of m) {
    const parts = k.split("\t");
    if (parts.length !== 4) continue;
    const [l, , p, i] = parts;
    if (l === lender && p === period && Number(i) === idx) s += v;
  }
  return s;
}

function buildL2MajorMap(l2: L2AnalysisRow[], opts: { lender: string; productType: string; flow: string }): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of l2) {
    if (!rowMatchesKeyFocusFilters(r, opts) || !isMajorL2Row(r)) continue;
    if (r.month_start !== "1.MTD" && r.month_start !== "2.LMTD") continue;
    const flow = (r.isautoleadcreated ?? "").trim();
    const k = `${r.lender}\t${flow}\t${r.month_start}\t${r.major_index}`;
    m.set(k, (m.get(k) ?? 0) + r.leads);
  }
  return m;
}

function buildL2SubMap(l2: L2AnalysisRow[], opts: { lender: string; productType: string; flow: string }): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of l2) {
    if (!rowMatchesKeyFocusFilters(r, opts)) continue;
    const sub = (r.sub_stage ?? "").trim();
    if (!sub) continue;
    const prevIdx = Math.floor(r.major_index);
    const flow = (r.isautoleadcreated ?? "").trim();
    const k = `${r.lender}\t${flow}\t${r.month_start}\t${prevIdx}\t${sub}`;
    m.set(k, (m.get(k) ?? 0) + r.leads);
  }
  return m;
}

export function pickConcerningL2FromMaps(
  subMap: Map<string, number>,
  lender: string,
  flowKey: string,
  prevIdx: number,
  mtdPrev: number,
  lmtdPrev: number
): { name: string; note: string }[] {
  if (mtdPrev <= 0 && lmtdPrev <= 0) return [];
  type Agg = { mtd: number; lmtd: number };
  const bySub = new Map<string, Agg>();

  for (const [k, leads] of subMap) {
    const parts = k.split("\t");
    if (parts.length < 5) continue;
    const [l, flow, period, prevStr, ...subParts] = parts;
    const sub = subParts.join("\t");
    if (l !== lender) continue;
    if (Number(prevStr) !== prevIdx) continue;
    if (flowKey !== "" && flow !== flowKey) continue;

    let a = bySub.get(sub);
    if (!a) {
      a = { mtd: 0, lmtd: 0 };
      bySub.set(sub, a);
    }
    if (period === "1.MTD") a.mtd += leads;
    else if (period === "2.LMTD") a.lmtd += leads;
  }

  return [...bySub.entries()]
    .map(([name, { mtd, lmtd }]) => {
      const shareM = mtdPrev > 0 ? mtd / mtdPrev : 0;
      const shareL = lmtdPrev > 0 ? lmtd / lmtdPrev : 0;
      const deltaSharePp = (shareM - shareL) * 100;
      const countPp = lmtd > 0 ? ((mtd - lmtd) / lmtd) * 100 : mtd > 0 ? 100 : 0;
      const terminal = heuristicTerminalSubStage(name) ? 1.25 : 1;
      const strength =
        Math.min(55, Math.max(0, deltaSharePp)) * terminal + Math.min(25, Math.max(0, countPp)) * 0.12;
      return { name, deltaSharePp, countPp, lmtd, strength };
    })
    .filter((x) => x.lmtd >= 5 && (x.deltaSharePp >= 0.35 || x.countPp >= 12))
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 2)
    .map(({ name, deltaSharePp, countPp }) => ({
      name,
      note:
        Math.abs(deltaSharePp) >= 0.2
          ? `${deltaSharePp >= 0 ? "+" : ""}${deltaSharePp.toFixed(1)}pp share vs LMTD`
          : `${countPp >= 0 ? "+" : ""}${countPp.toFixed(0)}% vs LMTD count`,
    }));
}

function buildLenderMktMap(
  rows: LenderMarketplaceRow[],
  opts: { lender: string; productType: string }
): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    if (opts.lender !== "All" && r.lender !== opts.lender) continue;
    if (opts.productType !== "All" && r.product_type !== opts.productType) continue;
    const k = `${r.lender}\t${r.product_type}\t${r.period}\t${r.major_index}`;
    m.set(k, (m.get(k) ?? 0) + r.leads);
  }
  return m;
}

function mktGet(m: Map<string, number>, lender: string, product: string, period: string, idx: number): number {
  return m.get(`${lender}\t${product}\t${period}\t${idx}`) ?? 0;
}

/**
 * Ranked key-focus rows: L2 (lender × flow × stage) + lender marketplace (lender × product × stage 6–15).
 */
export function buildKeyFocusStripItems(
  l2Data: L2AnalysisRow[],
  lenderMkt: LenderMarketplaceRow[],
  stagePairs: KeyFocusStagePair[],
  opts: { lender: string; productType: string; flow: string },
  limits?: { maxItems?: number; minPrevLmtd?: number; maxDeltaPp?: number }
): KeyFocusStripItem[] {
  const maxItems = limits?.maxItems ?? 8;
  const minPrevLmtd = limits?.minPrevLmtd ?? 8;
  const maxDeltaPp = limits?.maxDeltaPp ?? -0.45;

  const majorMap = buildL2MajorMap(l2Data, opts);
  const subMap = buildL2SubMap(l2Data, opts);
  const mktMap = buildLenderMktMap(lenderMkt, { lender: opts.lender, productType: opts.productType });

  const keys = new Set<string>();
  for (const k of majorMap.keys()) {
    const parts = k.split("\t");
    if (parts.length !== 4 || parts[2] !== "1.MTD") continue;
    keys.add(`${parts[0]}\t${parts[1]}`);
  }

  const cands: KeyFocusStripItem[] = [];

  for (const { prevIdx, curIdx, prevName, curName } of stagePairs) {
    for (const key of keys) {
      const tab = key.indexOf("\t");
      const lender = tab >= 0 ? key.slice(0, tab) : key;
      const flowKey = tab >= 0 ? key.slice(tab + 1) : "";
      const mtdPrev = majorGet(majorMap, lender, flowKey, "1.MTD", prevIdx);
      const mtdCur = majorGet(majorMap, lender, flowKey, "1.MTD", curIdx);
      const lmtdPrev = majorGet(majorMap, lender, flowKey, "2.LMTD", prevIdx);
      const lmtdCur = majorGet(majorMap, lender, flowKey, "2.LMTD", curIdx);
      if (lmtdPrev < minPrevLmtd) continue;
      const mtdConv = mtdPrev > 0 ? (mtdCur / mtdPrev) * 100 : null;
      const lmtdConv = lmtdPrev > 0 ? (lmtdCur / lmtdPrev) * 100 : null;
      if (mtdConv === null || lmtdConv === null) continue;
      const deltaPp = parseFloat((mtdConv - lmtdConv).toFixed(2));
      if (deltaPp > maxDeltaPp) continue;
      const mtdPrevAll = majorSumAllFlows(majorMap, lender, "1.MTD", prevIdx);
      const lmtdPrevAll = majorSumAllFlows(majorMap, lender, "2.LMTD", prevIdx);
      const l2Highlights = pickConcerningL2FromMaps(subMap, lender, flowKey, prevIdx, mtdPrevAll, lmtdPrevAll);
      const flowLabel = formatFlowTypeForUi(flowKey);
      const severity: "critical" | "warning" = deltaPp <= -3 ? "critical" : "warning";
      const text = `${lender} · ${flowLabel} · ${curName}: conv ${mtdConv.toFixed(1)}% (${deltaPp >= 0 ? "+" : ""}${deltaPp.toFixed(1)}pp vs LMTD)`;
      const subtitle =
        l2Highlights.length > 0
          ? `L2: ${l2Highlights.map((h) => `${h.name} (${h.note})`).join(" · ")}`
          : undefined;
      const detailLine = `After ${prevName}: prior MTD ${fmtIn(mtdPrev)} vs LMTD ${fmtIn(lmtdPrev)} · at ${curName} MTD ${fmtIn(mtdCur)} vs LMTD ${fmtIn(lmtdCur)}`;
      cands.push({
        text,
        subtitle,
        detailLine,
        severity,
        stageIndex: curIdx,
        stage: curName,
        lender,
        deltaPp,
      });
    }

    if (prevIdx >= 6 && curIdx >= 6) {
      const lenders = new Set<string>();
      for (const r of lenderMkt) {
        if (opts.lender !== "All" && r.lender !== opts.lender) continue;
        if (opts.productType !== "All" && r.product_type !== opts.productType) continue;
        lenders.add(r.lender);
      }
      for (const lender of lenders) {
        const products = new Set<string>();
        for (const r of lenderMkt) {
          if (r.lender !== lender) continue;
          products.add(r.product_type);
        }
        for (const product of products) {
          if (opts.productType !== "All" && product !== opts.productType) continue;
          const mtdPrev = mktGet(mktMap, lender, product, "1.MTD", prevIdx);
          const mtdCur = mktGet(mktMap, lender, product, "1.MTD", curIdx);
          const lmtdPrev = mktGet(mktMap, lender, product, "2.LMTD", prevIdx);
          const lmtdCur = mktGet(mktMap, lender, product, "2.LMTD", curIdx);
          if (lmtdPrev < minPrevLmtd) continue;
          const mtdConv = mtdPrev > 0 ? (mtdCur / mtdPrev) * 100 : null;
          const lmtdConv = lmtdPrev > 0 ? (lmtdCur / lmtdPrev) * 100 : null;
          if (mtdConv === null || lmtdConv === null) continue;
          const deltaPp = parseFloat((mtdConv - lmtdConv).toFixed(2));
          if (deltaPp > maxDeltaPp) continue;
          const mtdPrevAll = majorSumAllFlows(majorMap, lender, "1.MTD", prevIdx);
          const lmtdPrevAll = majorSumAllFlows(majorMap, lender, "2.LMTD", prevIdx);
          const l2Highlights = pickConcerningL2FromMaps(subMap, lender, "", prevIdx, mtdPrevAll, lmtdPrevAll);
          const severity: "critical" | "warning" = deltaPp <= -3 ? "critical" : "warning";
          const text = `${lender} · ${product} · ${curName}: conv ${mtdConv.toFixed(1)}% (${deltaPp >= 0 ? "+" : ""}${deltaPp.toFixed(1)}pp vs LMTD)`;
          const subtitle =
            l2Highlights.length > 0
              ? `L2 (pooled flows): ${l2Highlights.map((h) => `${h.name} (${h.note})`).join(" · ")}`
              : undefined;
          const detailLine = `Lender funnel · after ${prevName}: prior MTD ${fmtIn(mtdPrev)} vs LMTD ${fmtIn(lmtdPrev)} · at ${curName} MTD ${fmtIn(mtdCur)} vs LMTD ${fmtIn(lmtdCur)}`;
          cands.push({
            text,
            subtitle,
            detailLine,
            severity,
            stageIndex: curIdx,
            stage: curName,
            lender,
            deltaPp,
          });
        }
      }
    }
  }

  const dedupe = new Map<string, KeyFocusStripItem>();
  for (const c of cands) {
    const k = `${c.lender ?? ""}|${c.stageIndex}|${c.text}`;
    const prev = dedupe.get(k);
    if (!prev || c.deltaPp < prev.deltaPp) dedupe.set(k, c);
  }
  const merged = [...dedupe.values()].sort((a, b) => a.deltaPp - b.deltaPp);
  return merged.slice(0, maxItems);
}
