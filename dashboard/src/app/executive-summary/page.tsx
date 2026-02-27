"use client";

import { useEffect, useState, useMemo } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { KPICard } from "@/components/dashboard/kpi-card";
import { TrendChart } from "@/components/dashboard/trend-chart";
import {
  BreakdownTable,
  BreakdownRow,
} from "@/components/dashboard/breakdown-table";
import { RichInsightPanel, RichInsightItem } from "@/components/dashboard/rich-insight-card";
import { KpiDeepDiveModal, ClickableKpiCard, KpiDeepDiveConfig } from "@/components/dashboard/kpi-deep-dive-modal";
import { useFilters, useDateRangeFactors } from "@/lib/filter-context";
import {
  fetchDisbursalSummary,
  fetchDisbursementSummaryOverall,
  DisbursalSummaryRow,
  generateMonthlyTrends,
  MonthlyTrend,
  AOP_TARGET_CR,
  DAYS_ELAPSED,
  DAYS_IN_MONTH,
  REFERENCE_DATE,
} from "@/lib/data";
import { Banknote, TrendingUp, TrendingDown, Target, DollarSign, AlertTriangle } from "lucide-react";

/** Avg ticket size (Lakh): MTD 1528 Cr / 83401 loans ≈ 1.83 L */
const AVG_ATS = 1.83;

export default function ExecutiveSummary() {
  const { global, useGlobalFilters } = useFilters();
  const { periodLabel: pL, compareLabel: cL } = useDateRangeFactors();

  const effectiveLender = useGlobalFilters ? global.lender : "All";
  const effectiveProductType = useGlobalFilters ? global.productType : "All";
  const effectiveFlow = useGlobalFilters ? global.flow : "All";

  const [disbData, setDisbData] = useState<DisbursalSummaryRow[]>([]);
  const [summaryOverall, setSummaryOverall] = useState<{ lender: string; aop: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpiDive, setKpiDive] = useState<{ open: boolean; config: KpiDeepDiveConfig | null }>({ open: false, config: null });

  useEffect(() => {
    Promise.all([fetchDisbursalSummary(), fetchDisbursementSummaryOverall()]).then(([data, overall]) => {
      setDisbData(data);
      setSummaryOverall(overall);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    return disbData.filter((r) => {
      if (effectiveLender !== "All" && r.lender !== effectiveLender) return false;
      if (effectiveProductType !== "All" && r.product_type !== effectiveProductType) return false;
      if (effectiveFlow !== "All" && r.isautoleadcreated !== effectiveFlow) return false;
      return true;
    });
  }, [disbData, effectiveLender, effectiveProductType, effectiveFlow]);

  const totalDisbursed = useMemo(() => filtered.reduce((s, r) => s + r.disbursed, 0), [filtered]);
  const hasLmsdDisb = useMemo(() => filtered.some((r) => r.lmtd_disbursed != null && r.lmtd_disbursed > 0), [filtered]);
  const lmtdDisbursed = useMemo(() => {
    if (hasLmsdDisb) return filtered.reduce((s, r) => s + (r.lmtd_disbursed ?? 0), 0);
    return Math.round(totalDisbursed * 0.94);
  }, [hasLmsdDisb, filtered, totalDisbursed]);
  const hasAmtCr = useMemo(() => filtered.some((r) => r.amt_cr != null && r.amt_cr > 0), [filtered]);
  const totalAmountCr = useMemo(() => {
    if (hasAmtCr) return parseFloat((filtered.reduce((s, r) => s + (r.amt_cr ?? 0), 0).toFixed(2)));
    return parseFloat(((totalDisbursed * AVG_ATS) / 100).toFixed(2));
  }, [filtered, hasAmtCr, totalDisbursed]);
  const hasLmsdAmt = useMemo(() => filtered.some((r) => r.lmtd_amt_cr != null && r.lmtd_amt_cr >= 0), [filtered]);
  const lmtdAmountCr = useMemo(() => {
    if (hasLmsdAmt) return parseFloat((filtered.reduce((s, r) => s + (r.lmtd_amt_cr ?? 0), 0).toFixed(2)));
    if (hasAmtCr) return parseFloat((totalAmountCr * 0.94).toFixed(2));
    return parseFloat(((lmtdDisbursed * AVG_ATS) / 100).toFixed(2));
  }, [hasLmsdAmt, hasAmtCr, filtered, totalAmountCr, lmtdDisbursed]);

  const dayOfMonth = DAYS_ELAPSED; // as of 24-Feb-26
  const daysInMonth = DAYS_IN_MONTH; // Feb 2026
  const pace = dayOfMonth / daysInMonth;
  const projectedCr = pace > 0 ? parseFloat((totalAmountCr / pace).toFixed(2)) : 0;
  const totalAop = useMemo(() => {
    if (summaryOverall.length === 0) return AOP_TARGET_CR;
    if (effectiveLender === "All") return summaryOverall.reduce((s, r) => s + r.aop, 0);
    const row = summaryOverall.find((r) => r.lender === effectiveLender);
    return row ? row.aop : AOP_TARGET_CR;
  }, [summaryOverall, effectiveLender]);
  const monthlyAopCr = parseFloat((totalAop).toFixed(2)); // AOP = Feb'26 month target (Cr), not annual

  const mtdAts = useMemo(() => (totalDisbursed > 0 ? parseFloat(((totalAmountCr / totalDisbursed) * 100).toFixed(2)) : AVG_ATS), [totalDisbursed, totalAmountCr]);
  const lmtdAts = useMemo(() => (lmtdDisbursed > 0 ? parseFloat(((lmtdAmountCr / lmtdDisbursed) * 100).toFixed(2)) : mtdAts), [lmtdDisbursed, lmtdAmountCr, mtdAts]);
  const atsDelta = lmtdAts > 0 ? parseFloat((((mtdAts - lmtdAts) / lmtdAts) * 100).toFixed(1)) : 0;

  const trends = useMemo(() => generateMonthlyTrends(filtered), [filtered]);

  const byLender = useMemo((): BreakdownRow[] => {
    const map: Record<string, { disbursed: number; leads: number; amt_cr: number; lmtd_disb: number; lmtd_amt_cr: number }> = {};
    filtered.forEach((r) => {
      if (!map[r.lender]) map[r.lender] = { disbursed: 0, leads: 0, amt_cr: 0, lmtd_disb: 0, lmtd_amt_cr: 0 };
      map[r.lender].disbursed += r.disbursed;
      map[r.lender].leads += r.child_leads;
      map[r.lender].amt_cr += r.amt_cr ?? (r.disbursed * AVG_ATS) / 100;
      map[r.lender].lmtd_disb += r.lmtd_disbursed ?? Math.round(r.disbursed * 0.94);
      map[r.lender].lmtd_amt_cr += (r.lmtd_amt_cr != null && r.lmtd_amt_cr >= 0) ? r.lmtd_amt_cr : ((r.lmtd_disbursed ?? 0) * AVG_ATS) / 100;
    });
    return Object.entries(map).map(([lender, v]) => {
      const useAmt = hasAmtCr && v.amt_cr > 0;
      const useLmsdAmt = hasLmsdAmt && v.lmtd_amt_cr > 0;
      const atsL = v.disbursed > 0 ? parseFloat(((v.amt_cr / v.disbursed) * 100).toFixed(2)) : AVG_ATS;
      const lmtdAtsL = v.lmtd_disb > 0 ? parseFloat(((v.lmtd_amt_cr / v.lmtd_disb) * 100).toFixed(2)) : atsL;
      return {
        label: lender,
        disbursed_count: v.disbursed,
        lmtd_disbursed_count: v.lmtd_disb,
        amount_cr: useAmt ? parseFloat(v.amt_cr.toFixed(2)) : parseFloat(((v.disbursed * AVG_ATS) / 100).toFixed(2)),
        lmtd_amount_cr: useLmsdAmt ? parseFloat(v.lmtd_amt_cr.toFixed(2)) : parseFloat(((v.lmtd_disb * AVG_ATS) / 100).toFixed(2)),
        ats_lakhs: atsL,
        lmtd_ats_lakhs: lmtdAtsL,
        aop_cr: summaryOverall.find((r) => r.lender === lender)?.aop ?? 0, // AOP = Feb'26 month target (Cr)
      };
    });
  }, [filtered, hasAmtCr, hasLmsdAmt, summaryOverall]);

  const byProgram = useMemo((): BreakdownRow[] => {
    const map: Record<string, { disbursed: number; leads: number; amt_cr: number; lmtd_disb: number; lmtd_amt_cr: number }> = {};
    filtered.forEach((r) => {
      if (!map[r.product_type]) map[r.product_type] = { disbursed: 0, leads: 0, amt_cr: 0, lmtd_disb: 0, lmtd_amt_cr: 0 };
      map[r.product_type].disbursed += r.disbursed;
      map[r.product_type].leads += r.child_leads;
      map[r.product_type].amt_cr += r.amt_cr ?? (r.disbursed * AVG_ATS) / 100;
      map[r.product_type].lmtd_disb += r.lmtd_disbursed ?? Math.round(r.disbursed * 0.94);
      map[r.product_type].lmtd_amt_cr += (r.lmtd_amt_cr != null && r.lmtd_amt_cr >= 0) ? r.lmtd_amt_cr : ((r.lmtd_disbursed ?? 0) * AVG_ATS) / 100;
    });
    return Object.entries(map).map(([pt, v]) => {
      const useAmt = hasAmtCr && v.amt_cr > 0;
      const useLmsdAmt = hasLmsdAmt && v.lmtd_amt_cr > 0;
      const atsL = v.disbursed > 0 ? parseFloat(((v.amt_cr / v.disbursed) * 100).toFixed(2)) : AVG_ATS;
      const lmtdAtsL = v.lmtd_disb > 0 ? parseFloat(((v.lmtd_amt_cr / v.lmtd_disb) * 100).toFixed(2)) : atsL;
      return {
        label: pt,
        disbursed_count: v.disbursed,
        lmtd_disbursed_count: v.lmtd_disb,
        amount_cr: useAmt ? parseFloat(v.amt_cr.toFixed(2)) : parseFloat(((v.disbursed * AVG_ATS) / 100).toFixed(2)),
        lmtd_amount_cr: useLmsdAmt ? parseFloat(v.lmtd_amt_cr.toFixed(2)) : parseFloat(((v.lmtd_disb * AVG_ATS) / 100).toFixed(2)),
        ats_lakhs: atsL,
        lmtd_ats_lakhs: lmtdAtsL,
      };
    });
  }, [filtered, hasAmtCr, hasLmsdAmt]);

  const richInsights = useMemo((): RichInsightItem[] => {
    const items: RichInsightItem[] = [];
    let c = 0;
    const nid = () => `exec-${c++}`;
    const volGrowth = lmtdDisbursed > 0 ? ((totalDisbursed - lmtdDisbursed) / lmtdDisbursed) * 100 : 0;

    if (volGrowth > 5) {
      items.push({ id: nid(), icon: TrendingUp, color: "text-emerald-600", title: `Disbursals Up ${volGrowth.toFixed(1)}%`, detail: `${totalDisbursed.toLocaleString("en-IN")} loans vs ${lmtdDisbursed.toLocaleString("en-IN")} ${cL}.`, severity: "good", impactWeight: 50, link: "/disbursal-summary", expanded: { bullets: [`${pL}: ${totalDisbursed.toLocaleString("en-IN")} | ${cL}: ${lmtdDisbursed.toLocaleString("en-IN")}`, `Growth: +${volGrowth.toFixed(1)}%`, `Amount: ₹${totalAmountCr.toFixed(1)} Cr`], chartData: [], chartLabel: "", chartValueSuffix: "", navigateLabel: "View Disbursal Summary" } });
    } else if (volGrowth < -5) {
      items.push({ id: nid(), icon: TrendingDown, color: "text-red-600", title: `Disbursals Down ${Math.abs(volGrowth).toFixed(1)}%`, detail: `${totalDisbursed.toLocaleString("en-IN")} loans vs ${lmtdDisbursed.toLocaleString("en-IN")} ${cL}.`, severity: "bad", impactWeight: 80, link: "/disbursal-summary", expanded: { bullets: [`Decline: ${volGrowth.toFixed(1)}%`, `Amount: ₹${totalAmountCr.toFixed(1)} Cr`], chartData: [], chartLabel: "", chartValueSuffix: "", navigateLabel: "View Disbursal Summary" } });
    }

    const aopPct = monthlyAopCr > 0 ? (totalAmountCr / monthlyAopCr) * 100 : 0;
    if (aopPct >= 100) {
      items.push({ id: nid(), icon: Target, color: "text-emerald-600", title: `On Track for AOP: ${aopPct.toFixed(0)}%`, detail: `₹${totalAmountCr.toFixed(1)} Cr achieved. Projected: ₹${projectedCr.toFixed(1)} Cr.`, severity: "good", impactWeight: 30, link: "/disbursal-summary", expanded: { bullets: [`Achieved: ₹${totalAmountCr.toFixed(1)} Cr`, `Feb'26 AOP: ₹${monthlyAopCr.toFixed(1)} Cr`, `Projected: ₹${projectedCr.toFixed(1)} Cr`], chartData: [], chartLabel: "", chartValueSuffix: "" } });
    } else if (aopPct >= 70) {
      items.push({ id: nid(), icon: Target, color: "text-amber-600", title: `Slightly Behind AOP: ${aopPct.toFixed(0)}%`, detail: `₹${totalAmountCr.toFixed(1)} Cr achieved vs ₹${monthlyAopCr.toFixed(1)} Cr AOP. Projected: ₹${projectedCr.toFixed(1)} Cr.`, severity: "warn", impactWeight: 55, link: "/disbursal-summary", expanded: { bullets: [`Gap: ~₹${(monthlyAopCr - totalAmountCr).toFixed(1)} Cr`, `Projected: ₹${projectedCr.toFixed(1)} Cr`], chartData: [], chartLabel: "", chartValueSuffix: "" } });
    } else {
      items.push({ id: nid(), icon: Target, color: "text-red-600", title: `Behind AOP: ${aopPct.toFixed(0)}%`, detail: `Only ₹${totalAmountCr.toFixed(1)} Cr achieved (Feb'26 AOP: ₹${monthlyAopCr.toFixed(1)} Cr). Projected: ₹${projectedCr.toFixed(1)} Cr.`, severity: "bad", impactWeight: 85, link: "/disbursal-summary", expanded: { bullets: [`Gap: ~₹${(monthlyAopCr - totalAmountCr).toFixed(1)} Cr shortfall`, `Projected: ₹${projectedCr.toFixed(1)} Cr`], chartData: [], chartLabel: "", chartValueSuffix: "" } });
    }

    const sorted = [...byLender].sort((a, b) => (b.disbursed_count || 0) - (a.disbursed_count || 0));
    if (sorted.length > 0) {
      items.push({ id: nid(), icon: Banknote, color: "text-blue-600", title: `Top Contributor: ${sorted[0].label}`, detail: `${(sorted[0].disbursed_count || 0).toLocaleString("en-IN")} disbursals.`, severity: "info", impactWeight: 15, link: "/disbursal-summary", defaultFilter: { lender: sorted[0].label }, expanded: { bullets: sorted.slice(0, 4).map((l) => `${l.label}: ${(l.disbursed_count || 0).toLocaleString("en-IN")} disbursals`), chartData: sorted.slice(0, 6).map((l) => ({ label: l.label, value: l.disbursed_count || 0, color: "hsl(220, 70%, 55%)", filterContext: { lender: l.label } })), chartLabel: "Lender Disbursals", chartValueSuffix: "" } });
    }

    const declining = byLender.filter((l) => (l.lmtd_disbursed_count || 0) > 0 && (((l.disbursed_count || 0) - (l.lmtd_disbursed_count || 0)) / (l.lmtd_disbursed_count || 1)) * 100 < -15);
    if (declining.length > 0) {
      items.push({ id: nid(), icon: AlertTriangle, color: "text-amber-600", title: `${declining.length} Lender${declining.length > 1 ? "s" : ""} Declining >15%`, detail: `${declining.map((l) => l.label).join(", ")}.`, severity: "warn", impactWeight: 45, link: "/disbursal-summary", expanded: { bullets: declining.map((l) => { const g = (l.lmtd_disbursed_count || 0) > 0 ? (((l.disbursed_count || 0) - (l.lmtd_disbursed_count || 0)) / (l.lmtd_disbursed_count || 1) * 100) : 0; return `${l.label}: ${g.toFixed(1)}% decline`; }), chartData: declining.map((l) => { const g = (l.lmtd_disbursed_count || 0) > 0 ? Math.abs(((l.disbursed_count || 0) - (l.lmtd_disbursed_count || 0)) / (l.lmtd_disbursed_count || 1) * 100) : 0; return { label: l.label, value: parseFloat(g.toFixed(1)), color: "hsl(350, 65%, 55%)", filterContext: { lender: l.label } }; }), chartLabel: "Lender Decline (%)", chartValueSuffix: "%" } });
    }

    return items;
  }, [totalDisbursed, lmtdDisbursed, totalAmountCr, projectedCr, monthlyAopCr, byLender, pL, cL]);

  const disbGrowth = lmtdDisbursed > 0 ? ((totalDisbursed - lmtdDisbursed) / lmtdDisbursed) * 100 : 0;
  const amtGrowth = lmtdAmountCr > 0 ? ((totalAmountCr - lmtdAmountCr) / lmtdAmountCr) * 100 : 0;

  const openKpiDive = (type: "disbursals" | "amount" | "projected" | "ats") => {
    let config: KpiDeepDiveConfig;
    const sortedLender = [...byLender].sort((a, b) => (b.disbursed_count || 0) - (a.disbursed_count || 0));
    switch (type) {
      case "disbursals":
        config = {
          title: `Disbursals (${pL})`,
          metric: totalDisbursed.toLocaleString("en-IN"),
          subtitle: `${lmtdDisbursed.toLocaleString("en-IN")} ${cL}`,
          sections: [
            { title: "MTD vs LMTD", type: "kpi-row", kpis: [{ label: pL, value: totalDisbursed.toLocaleString("en-IN") }, { label: cL, value: lmtdDisbursed.toLocaleString("en-IN") }, { label: "Growth", value: `${disbGrowth >= 0 ? "+" : ""}${disbGrowth.toFixed(1)}%` }] },
            { title: "By Lender", type: "chart", chart: { type: "bar", data: sortedLender.slice(0, 8).map((l) => ({ name: l.label, value: l.disbursed_count || 0 })), label: "Disbursals", valueSuffix: "" } },
            { title: "Lender Details", type: "table", headers: ["Lender", pL, cL, "Growth"], rows: sortedLender.slice(0, 10).map((l) => { const g = (l.lmtd_disbursed_count || 0) > 0 ? (((l.disbursed_count || 0) - (l.lmtd_disbursed_count || 0)) / (l.lmtd_disbursed_count || 1)) * 100 : 0; return { label: l.label, values: [(l.disbursed_count || 0).toLocaleString("en-IN"), (l.lmtd_disbursed_count || 0).toLocaleString("en-IN"), `${g >= 0 ? "+" : ""}${g.toFixed(1)}%`] }; }) },
          ],
        };
        break;
      case "amount":
        config = {
          title: `Amount (${pL})`,
          metric: `₹${totalAmountCr} Cr`,
          subtitle: `₹${lmtdAmountCr} Cr ${cL}`,
          sections: [
            { title: "MTD vs LMTD", type: "kpi-row", kpis: [{ label: `${pL} (Cr)`, value: totalAmountCr.toFixed(1) }, { label: `${cL} (Cr)`, value: lmtdAmountCr.toFixed(1) }, { label: "Growth", value: `${amtGrowth >= 0 ? "+" : ""}${amtGrowth.toFixed(1)}%` }] },
            { title: "By Lender", type: "chart", chart: { type: "bar", data: sortedLender.slice(0, 8).map((l) => ({ name: l.label, value: l.amount_cr || 0 })), label: "Amount", valueSuffix: " Cr" } },
            { title: "Lender Details", type: "table", headers: ["Lender", "Amount (Cr)", "LMTD (Cr)"], rows: sortedLender.slice(0, 10).map((l) => ({ label: l.label, values: [(l.amount_cr || 0).toFixed(1), (l.lmtd_amount_cr || 0).toFixed(1)] })) },
          ],
        };
        break;
      case "projected": {
        const pacingPct = monthlyAopCr > 0 ? ((projectedCr / monthlyAopCr) * 100) : 0;
        config = {
          title: "Projected",
          metric: `₹${projectedCr} Cr`,
          subtitle: `Feb'26 AOP: ₹${monthlyAopCr} Cr · Day ${dayOfMonth}/${daysInMonth}`,
          sections: [
            { title: "Projection (at current run-rate)", type: "kpi-row", kpis: [{ label: "Projected month-end (Cr)", value: projectedCr.toFixed(1) }, { label: "Feb'26 AOP target (Cr)", value: monthlyAopCr.toFixed(1) }, { label: "Pacing", value: monthlyAopCr > 0 ? `${pacingPct.toFixed(0)}%` : "-" }] },
            { title: "By Lender (MTD amount)", type: "chart", chart: { type: "bar", data: sortedLender.slice(0, 8).map((l) => ({ name: l.label, value: l.amount_cr || 0 })), label: "MTD (Cr)", valueSuffix: " Cr" } },
            { title: "Lender-wise: MTD vs Projected vs AOP", type: "table", headers: ["Lender", "MTD (Cr)", "Projected (Cr)", "Feb'26 AOP (Cr)", "Pacing %"], rows: sortedLender.slice(0, 12).map((l) => {
              const mtd = l.amount_cr || 0;
              const proj = pace > 0 ? mtd / pace : 0;
              const aop = l.aop_cr || 0;
              const pct = aop > 0 ? ((proj / aop) * 100).toFixed(0) : "-";
              return { label: l.label, values: [mtd.toFixed(1), proj.toFixed(1), aop.toFixed(1), pct + (aop > 0 ? "%" : "")] };
            }) },
          ],
        };
        break;
      }
      case "ats":
        config = {
          title: "ATS",
          metric: `₹${mtdAts} L`,
          subtitle: `LMTD ATS: ₹${lmtdAts} L`,
          sections: [
            { title: "Summary", type: "kpi-row", kpis: [{ label: "MTD ATS (L)", value: mtdAts.toFixed(2) }, { label: "LMTD ATS (L)", value: lmtdAts.toFixed(2) }, { label: "Change vs LMTD", value: `${atsDelta >= 0 ? "+" : ""}${atsDelta}%` }] },
            { title: "By Lender", type: "chart", chart: { type: "bar", data: sortedLender.slice(0, 8).map((l) => ({ name: l.label, value: l.ats_lakhs ?? mtdAts })), label: "ATS", valueSuffix: " L" } },
            { title: "Lender Details", type: "table", headers: ["Lender", "ATS (L)", "LMTD ATS (L)", "Amount (Cr)"], rows: sortedLender.slice(0, 10).map((l) => ({ label: l.label, values: [(l.ats_lakhs ?? mtdAts).toFixed(2), (l.lmtd_ats_lakhs ?? lmtdAts).toFixed(2), (l.amount_cr || 0).toFixed(1)] })) },
          ],
        };
        break;
    }
    setKpiDive({ open: true, config });
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-muted-foreground animate-pulse">Loading executive summary...</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Executive Summary"
        description={`High-level business snapshot · ${pL} vs ${cL} · Day ${dayOfMonth}/${daysInMonth} (as of ${REFERENCE_DATE.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })})`}
      />

      <div className="p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ClickableKpiCard onClick={() => openKpiDive("disbursals")}>
            <KPICard
              title={`Disbursals (${pL})`}
              value={totalDisbursed.toLocaleString("en-IN")}
              subtitle={`${lmtdDisbursed.toLocaleString("en-IN")} ${cL}`}
              delta={disbGrowth}
              deltaLabel={`vs ${cL}`}
              icon={<Banknote className="h-5 w-5 text-emerald-500" />}
            />
          </ClickableKpiCard>
          <ClickableKpiCard onClick={() => openKpiDive("amount")}>
            <KPICard
              title={`Amount (${pL})`}
              value={`₹${totalAmountCr} Cr`}
              subtitle={`₹${lmtdAmountCr} Cr ${cL}`}
              delta={amtGrowth}
              deltaLabel={`vs ${cL}`}
              icon={<DollarSign className="h-5 w-5 text-blue-500" />}
            />
          </ClickableKpiCard>
          <ClickableKpiCard onClick={() => openKpiDive("projected")}>
            <KPICard
              title="Projected"
              value={`₹${projectedCr} Cr`}
              subtitle={`Feb'26 AOP: ₹${monthlyAopCr} Cr`}
              delta={monthlyAopCr > 0 ? ((projectedCr - monthlyAopCr) / monthlyAopCr) * 100 : 0}
              deltaLabel="vs AOP"
              icon={<Target className="h-5 w-5 text-amber-500" />}
            />
          </ClickableKpiCard>
          <ClickableKpiCard onClick={() => openKpiDive("ats")}>
            <KPICard
              title="ATS"
              value={`₹${mtdAts} L`}
              subtitle={`LMTD: ₹${lmtdAts} L`}
              delta={atsDelta}
              deltaLabel={`vs ${cL}`}
              icon={<TrendingUp className="h-5 w-5 text-violet-500" />}
            />
          </ClickableKpiCard>
        </div>

        {/* Trends */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TrendChart
            title="Monthly Disbursal Count"
            data={trends}
            dataKey="disbursed_count"
            color="hsl(220, 70%, 55%)"
            valueFormatter={(v) => v.toLocaleString("en-IN")}
          />
          <TrendChart
            title="Monthly Disbursal Amount (Cr)"
            data={trends}
            dataKey="disbursed_amount_cr"
            color="hsl(150, 60%, 45%)"
            valueFormatter={(v) => `₹${v} Cr`}
          />
        </div>

        {/* Breakdowns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <BreakdownTable title="By Lender" data={byLender} showAOP />
          <BreakdownTable title="By Program Type" data={byProgram} />
        </div>

        {/* Auto Insights */}
        <RichInsightPanel title="Executive Insights" insights={richInsights} pageName="Executive Summary" />
      </div>

      <KpiDeepDiveModal
        open={kpiDive.open}
        onClose={() => setKpiDive({ open: false, config: null })}
        config={kpiDive.config}
      />
    </div>
  );
}
