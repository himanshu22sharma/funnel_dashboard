"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Flame,
  Clock,
  CheckCircle2,
  AlertOctagon,
  BarChart3,
  Banknote,
  ChevronDown,
  ChevronRight,
  Filter,
  RotateCcw,
  Zap,
  Eye,
  Wrench,
  Activity,
  Target,
  Info,
} from "lucide-react";
import { useFilters, useDateRangeFactors } from "@/lib/filter-context";
import {
  ResponsiveContainer,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  BarChart,
} from "recharts";
import {
  fetchL2Analysis,
  fetchDisbursalSummary,
  getUniqueValues,
  L2AnalysisRow,
  DisbursalSummaryRow,
} from "@/lib/data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichInsightPanel, type RichInsightItem } from "@/components/dashboard/rich-insight-card";
import { KpiDeepDiveModal, KpiDeepDiveConfig } from "@/components/dashboard/kpi-deep-dive-modal";

// ─── Constants ──────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-var-requires
const useRouterHook = require("next/navigation").useRouter;
const AVG_ATS = 1.83; // Lakhs (MTD 1528 Cr / 83401 loans)
const LENDER_AOP: Record<string, number> = {
  FULLERTON: 120, KSF: 80, PIRAMAL: 60, SHRIRAM: 55,
  NACL: 45, PYFL: 40, MFL: 35, UCL: 30,
};
const TOTAL_AOP = Object.values(LENDER_AOP).reduce((s, v) => s + v, 0);

// ─── Alert types ────────────────────────────────────────────────────────────
type AlertSeverity = "critical" | "high" | "medium" | "low";
type AlertStatus = "new" | "recurring" | "known";
type AlertCategory = "conversion_drop" | "volume_dip" | "stuck_spike" | "aop_risk" | "concentration" | "anomaly";

interface Alert {
  id: string;
  title: string;
  description: string; // plain-English
  severity: AlertSeverity;
  status: AlertStatus;
  category: AlertCategory;
  /** Estimated impact in leads */
  impactLeads: number;
  /** Estimated impact in Crores */
  impactCr: number;
  /** Attribution: which lender, program, stage, or combination */
  lender: string | null;
  program: string | null;
  stage: string | null;
  /** The metric value that triggered the alert */
  metricValue: number;
  /** Baseline value for comparison */
  baselineValue: number;
  /** Change percentage */
  changePct: number;
  /** Whether this needs immediate PM attention */
  needsAttention: boolean;
}

const severityConfig: Record<AlertSeverity, { color: string; bg: string; border: string; icon: typeof Flame; label: string; priority: number }> = {
  critical: { color: "text-red-700", bg: "bg-red-50", border: "border-red-200", icon: Flame, label: "Critical", priority: 0 },
  high: { color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200", icon: AlertOctagon, label: "High", priority: 1 },
  medium: { color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", icon: AlertTriangle, label: "Medium", priority: 2 },
  low: { color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200", icon: Eye, label: "Low", priority: 3 },
};

const statusConfig: Record<AlertStatus, { label: string; color: string; bg: string }> = {
  new: { label: "New", color: "text-red-700", bg: "bg-red-100" },
  recurring: { label: "Recurring", color: "text-amber-700", bg: "bg-amber-100" },
  known: { label: "Known", color: "text-gray-600", bg: "bg-gray-100" },
};

const categoryLabels: Record<AlertCategory, string> = {
  conversion_drop: "Conversion Drop",
  volume_dip: "Volume Dip",
  stuck_spike: "Stuck % Spike",
  aop_risk: "AOP Risk",
  concentration: "Concentration Risk",
  anomaly: "Anomaly",
};

export default function AlertTracking() {
  const router = useRouter();
  const {
    global,
    useGlobalFilters,
    setAvailableLenders,
    setAvailableProductTypes,
    setAvailableFlows,
  } = useFilters();
  const { periodLabel: pL, compareLabel: cL } = useDateRangeFactors();
  const [l2Data, setL2Data] = useState<L2AnalysisRow[]>([]);
  const [disbData, setDisbData] = useState<DisbursalSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [severityFilter, setSeverityFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());
  const [kpiDive, setKpiDive] = useState<{ open: boolean; config: KpiDeepDiveConfig | null }>({ open: false, config: null });

  useEffect(() => {
    Promise.all([fetchL2Analysis(), fetchDisbursalSummary()]).then(([l2, disb]) => {
      setL2Data(l2);
      setDisbData(disb);
      const lenders = getUniqueValues(l2, "lender");
      const products = getUniqueValues(l2, "product_type");
      const flows = getUniqueValues(l2, "isautoleadcreated");
      setAvailableLenders(lenders);
      setAvailableProductTypes(products);
      setAvailableFlows(flows);
      setLoading(false);
    });
  }, [setAvailableLenders, setAvailableProductTypes, setAvailableFlows]);

  // Scroll to section if hash is present in URL
  useEffect(() => {
    if (!loading && typeof window !== "undefined" && window.location.hash) {
      const id = window.location.hash.substring(1);
      setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    }
  }, [loading]);

  // ─── Effective filter values ─────────────────────────────────────────────
  const effectiveLender = useGlobalFilters ? global.lender : "All";
  const effectiveProductType = useGlobalFilters ? global.productType : "All";
  const effectiveFlow = useGlobalFilters ? global.flow : "All";

  // Pre-filter data by global filters
  const filteredL2 = useMemo(() => {
    return l2Data.filter((r) => {
      if (effectiveLender !== "All" && r.lender !== effectiveLender) return false;
      if (effectiveProductType !== "All" && r.product_type !== effectiveProductType) return false;
      if (effectiveFlow !== "All" && r.isautoleadcreated !== effectiveFlow) return false;
      return true;
    });
  }, [l2Data, effectiveLender, effectiveProductType, effectiveFlow]);

  const filteredDisb = useMemo(() => {
    return disbData.filter((r) => {
      if (effectiveLender !== "All" && r.lender !== effectiveLender) return false;
      if (effectiveProductType !== "All" && r.product_type !== effectiveProductType) return false;
      if (effectiveFlow !== "All" && r.isautoleadcreated !== effectiveFlow) return false;
      return true;
    });
  }, [disbData, effectiveLender, effectiveProductType, effectiveFlow]);

  // ─── Generate alerts from data ────────────────────────────────────────────
  const alerts = useMemo((): Alert[] => {
    if (filteredL2.length === 0) return [];

    const result: Alert[] = [];
    let alertId = 0;

    // Helper: get leads for a group
    const getLeads = (rows: L2AnalysisRow[], period: string, majorIndex: number) =>
      rows.filter((r) => r.month_start === period && Math.floor(r.major_index) === r.major_index && r.major_index === majorIndex && !r.sub_stage)
        .reduce((s, r) => s + r.leads, 0);

    // ─── 1) OVERALL STAGE CONVERSION DROPS ─────────────────────────────
    const allIndices = Array.from(
      new Set(
        filteredL2
          .filter((r) => !r.sub_stage && Math.floor(r.major_index) === r.major_index && r.major_index < 1000 && r.major_index !== 1)
          .map((r) => r.major_index)
      )
    ).sort((a, b) => a - b);

    // Aggregate overall MTD and LMTD leads by stage
    const overallMtd: Record<number, { stage: string; leads: number }> = {};
    const overallLmtd: Record<number, { stage: string; leads: number }> = {};

    filteredL2
      .filter((r) => !r.sub_stage && Math.floor(r.major_index) === r.major_index && r.major_index < 1000 && r.major_index !== 1)
      .forEach((r) => {
        const target = r.month_start === "1.MTD" ? overallMtd : overallLmtd;
        if (!target[r.major_index]) target[r.major_index] = { stage: r.original_major_stage, leads: 0 };
        target[r.major_index].leads += r.leads;
      });

    // End-to-end disbursed leads (last stage)
    const lastIdx = allIndices[allIndices.length - 1];
    const disbursedMtd = overallMtd[lastIdx]?.leads || 0;

    for (let i = 1; i < allIndices.length; i++) {
      const cur = allIndices[i];
      const prev = allIndices[i - 1];
      const mtdConv = (overallMtd[prev]?.leads || 0) > 0 ? ((overallMtd[cur]?.leads || 0) / (overallMtd[prev]?.leads || 0)) * 100 : 0;
      const lmtdConv = (overallLmtd[prev]?.leads || 0) > 0 ? ((overallLmtd[cur]?.leads || 0) / (overallLmtd[prev]?.leads || 0)) * 100 : 0;
      const delta = mtdConv - lmtdConv;
      const stageName = overallMtd[cur]?.stage || `Stage ${cur}`;

      if (delta < -3) {
        const droppedLeads = Math.round(((overallMtd[prev]?.leads || 0) * Math.abs(delta)) / 100);
        // Downstream conversion: from here to disbursal
        const downstreamConv = (overallMtd[cur]?.leads || 0) > 0 ? disbursedMtd / (overallMtd[cur]?.leads || 0) : 0;
        const lostLoans = Math.round(droppedLeads * downstreamConv);
        const lostCr = parseFloat(((lostLoans * AVG_ATS) / 100).toFixed(2));

        const isNew = delta < -5 && lmtdConv > 70; // MTD dropped sharply from a healthy baseline
        const severity: AlertSeverity = delta < -10 ? "critical" : delta < -5 ? "high" : "medium";

        result.push({
          id: `conv-overall-${alertId++}`,
          title: `${stageName} conversion dropped ${Math.abs(delta).toFixed(1)}pp`,
          description: `The "${stageName}" stage conversion has fallen from ${lmtdConv.toFixed(1)}% (${cL}) to ${mtdConv.toFixed(1)}% (${pL}) — a ${Math.abs(delta).toFixed(1)} percentage-point decline. This translates to roughly ${droppedLeads.toLocaleString("en-IN")} additional leads being lost at this stage, which could mean ~${lostLoans.toLocaleString("en-IN")} fewer disbursals (₹${lostCr.toFixed(1)} Cr).`,
          severity,
          status: isNew ? "new" : "recurring",
          category: "conversion_drop",
          impactLeads: droppedLeads,
          impactCr: lostCr,
          lender: null,
          program: null,
          stage: stageName,
          metricValue: mtdConv,
          baselineValue: lmtdConv,
          changePct: delta,
          needsAttention: severity === "critical" || severity === "high",
        });
      }
    }

    // ─── 2) LENDER-SPECIFIC CONVERSION DROPS ───────────────────────────
    const lenders = Array.from(new Set(filteredL2.map((r) => r.lender))).sort();

    for (const lender of lenders) {
      const lenderRows = filteredL2.filter((r) => r.lender === lender);
      const lenderMtd: Record<number, number> = {};
      const lenderLmtd: Record<number, number> = {};

      lenderRows
        .filter((r) => !r.sub_stage && Math.floor(r.major_index) === r.major_index && r.major_index < 1000 && r.major_index !== 1)
        .forEach((r) => {
          const t = r.month_start === "1.MTD" ? lenderMtd : lenderLmtd;
          t[r.major_index] = (t[r.major_index] || 0) + r.leads;
        });

      for (let i = 1; i < allIndices.length; i++) {
        const cur = allIndices[i];
        const prev = allIndices[i - 1];
        const mtdConv = (lenderMtd[prev] || 0) > 0 ? ((lenderMtd[cur] || 0) / (lenderMtd[prev] || 0)) * 100 : 0;
        const lmtdConv = (lenderLmtd[prev] || 0) > 0 ? ((lenderLmtd[cur] || 0) / (lenderLmtd[prev] || 0)) * 100 : 0;
        const delta = mtdConv - lmtdConv;
        const stageName = overallMtd[cur]?.stage || `Stage ${cur}`;

        if (delta < -5) {
          const droppedLeads = Math.round(((lenderMtd[prev] || 0) * Math.abs(delta)) / 100);
          const lostCr = parseFloat(((droppedLeads * 0.05 * AVG_ATS) / 100).toFixed(2)); // rough estimate
          const severity: AlertSeverity = delta < -15 ? "critical" : delta < -8 ? "high" : "medium";

          result.push({
            id: `conv-lender-${alertId++}`,
            title: `${lender}: ${stageName} down ${Math.abs(delta).toFixed(1)}pp`,
            description: `${lender}'s conversion at "${stageName}" dropped from ${lmtdConv.toFixed(1)}% to ${mtdConv.toFixed(1)}% (${delta.toFixed(1)}pp). About ${droppedLeads.toLocaleString("en-IN")} extra leads are being lost at this stage for this lender compared to ${cL}.`,
            severity,
            status: lmtdConv < 50 ? "recurring" : "new",
            category: "conversion_drop",
            impactLeads: droppedLeads,
            impactCr: lostCr,
            lender,
            program: null,
            stage: stageName,
            metricValue: mtdConv,
            baselineValue: lmtdConv,
            changePct: delta,
            needsAttention: severity === "critical",
          });
        }
      }
    }

    // ─── 3) VOLUME DIPS (overall workable leads) ───────────────────────
    const workableIdx = allIndices[0];
    const mtdWorkable = overallMtd[workableIdx]?.leads || 0;
    const lmtdWorkable = overallLmtd[workableIdx]?.leads || 0;

    if (lmtdWorkable > 0) {
      const volChange = ((mtdWorkable - lmtdWorkable) / lmtdWorkable) * 100;
      if (volChange < -10) {
        result.push({
          id: `vol-overall-${alertId++}`,
          title: `Top-of-funnel volume down ${Math.abs(volChange).toFixed(0)}%`,
          description: `Workable leads dropped from ${lmtdWorkable.toLocaleString("en-IN")} (${cL}) to ${mtdWorkable.toLocaleString("en-IN")} (${pL}) — a ${Math.abs(volChange).toFixed(1)}% decline. This reduces the total addressable funnel and will directly impact downstream disbursals unless conversion improves.`,
          severity: volChange < -25 ? "critical" : volChange < -15 ? "high" : "medium",
          status: "new",
          category: "volume_dip",
          impactLeads: Math.abs(mtdWorkable - lmtdWorkable),
          impactCr: parseFloat((Math.abs(mtdWorkable - lmtdWorkable) * 0.03 * AVG_ATS / 100).toFixed(2)),
          lender: null,
          program: null,
          stage: overallMtd[workableIdx]?.stage || "Workable",
          metricValue: mtdWorkable,
          baselineValue: lmtdWorkable,
          changePct: volChange,
          needsAttention: volChange < -15,
        });
      }

      // Per-lender volume dips
      for (const lender of lenders) {
        const lMtd = filteredL2.filter((r) => r.lender === lender && r.month_start === "1.MTD" && r.major_index === workableIdx && !r.sub_stage)
          .reduce((s, r) => s + r.leads, 0);
        const lLmtd = filteredL2.filter((r) => r.lender === lender && r.month_start === "2.LMTD" && r.major_index === workableIdx && !r.sub_stage)
          .reduce((s, r) => s + r.leads, 0);
        if (lLmtd > 0) {
          const lChange = ((lMtd - lLmtd) / lLmtd) * 100;
          if (lChange < -20) {
            result.push({
              id: `vol-lender-${alertId++}`,
              title: `${lender}: volume down ${Math.abs(lChange).toFixed(0)}%`,
              description: `${lender}'s workable leads fell from ${lLmtd.toLocaleString("en-IN")} to ${lMtd.toLocaleString("en-IN")} (${lChange.toFixed(1)}%). This is a significant volume contraction that will reduce ${lender}'s contribution to overall disbursals.`,
              severity: lChange < -40 ? "high" : "medium",
              status: "new",
              category: "volume_dip",
              impactLeads: Math.abs(lMtd - lLmtd),
              impactCr: parseFloat((Math.abs(lMtd - lLmtd) * 0.03 * AVG_ATS / 100).toFixed(2)),
              lender,
              program: null,
              stage: overallMtd[workableIdx]?.stage || "Workable",
              metricValue: lMtd,
              baselineValue: lLmtd,
              changePct: lChange,
              needsAttention: lChange < -40,
            });
          }
        }
      }
    }

    // ─── 4) STUCK % SPIKES ─────────────────────────────────────────────
    const mtdStuck = filteredL2.filter((r) => r.month_start === "1.MTD" && r.sub_stage && r.stuck_pct !== null);
    const lmtdStuck = filteredL2.filter((r) => r.month_start === "2.LMTD" && r.sub_stage && r.stuck_pct !== null);

    // Group LMTD stuck by lender+stage for baseline
    const lmtdStuckMap: Record<string, number> = {};
    lmtdStuck.forEach((r) => {
      const key = `${r.lender}|${r.original_major_stage}|${r.sub_stage}`;
      lmtdStuckMap[key] = r.stuck_pct || 0;
    });

    mtdStuck.forEach((r) => {
      if ((r.stuck_pct || 0) > 25) {
        const key = `${r.lender}|${r.original_major_stage}|${r.sub_stage}`;
        const baseline = lmtdStuckMap[key] || 0;
        const delta = (r.stuck_pct || 0) - baseline;

        if (delta > 5 || (r.stuck_pct || 0) > 40) {
          result.push({
            id: `stuck-${alertId++}`,
            title: `${r.lender}: ${r.stuck_pct?.toFixed(0)}% stuck at ${r.sub_stage}`,
            description: `${r.lender} has ${r.stuck_pct?.toFixed(1)}% of leads stuck at "${r.sub_stage}" (under "${r.original_major_stage}"). ${baseline > 0 ? `Last month it was ${baseline.toFixed(1)}%, so this is a ${delta.toFixed(1)}pp increase.` : "This is a new bottleneck."} High stuck rates at this sub-stage indicate a process or system issue that needs investigation.`,
            severity: (r.stuck_pct || 0) > 50 ? "high" : "medium",
            status: baseline > 20 ? "recurring" : "new",
            category: "stuck_spike",
            impactLeads: r.leads,
            impactCr: parseFloat((r.leads * 0.02 * AVG_ATS / 100).toFixed(2)),
            lender: r.lender,
            program: r.product_type,
            stage: `${r.original_major_stage} → ${r.sub_stage}`,
            metricValue: r.stuck_pct || 0,
            baselineValue: baseline,
            changePct: delta,
            needsAttention: (r.stuck_pct || 0) > 50,
          });
        }
      }
    });

    // ─── 5) AOP PACING RISK ────────────────────────────────────────────
    if (filteredDisb.length > 0) {
      const dayOfMonth = new Date().getDate();
      const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
      const pace = dayOfMonth / daysInMonth;

      // Per-lender AOP risk
      for (const lender of Object.keys(LENDER_AOP)) {
        const lenderDisb = filteredDisb.filter((r) => r.lender === lender);
        const totalLoans = lenderDisb.reduce((s, r) => s + r.disbursed, 0);
        const mtdCr = (totalLoans * AVG_ATS) / 100;
        const monthlyTarget = LENDER_AOP[lender] / 12;
        const projected = pace > 0 ? mtdCr / pace : 0;
        const gapPct = monthlyTarget > 0 ? ((projected - monthlyTarget) / monthlyTarget) * 100 : 0;

        if (gapPct < -15) {
          result.push({
            id: `aop-${alertId++}`,
            title: `${lender}: AOP pacing ${Math.abs(gapPct).toFixed(0)}% behind`,
            description: `${lender} has disbursed ₹${mtdCr.toFixed(1)} Cr ${pL}. At current run-rate, the projection for this month is ₹${projected.toFixed(1)} Cr against a monthly AOP target of ₹${monthlyTarget.toFixed(1)} Cr. The gap is ${Math.abs(gapPct).toFixed(0)}% — ${lender} needs to accelerate to stay on track for the annual target of ₹${LENDER_AOP[lender]} Cr.`,
            severity: gapPct < -40 ? "critical" : gapPct < -25 ? "high" : "medium",
            status: "known",
            category: "aop_risk",
            impactLeads: 0,
            impactCr: parseFloat(Math.abs(projected - monthlyTarget).toFixed(2)),
            lender,
            program: null,
            stage: null,
            metricValue: projected,
            baselineValue: monthlyTarget,
            changePct: gapPct,
            needsAttention: gapPct < -30,
          });
        }
      }

      // Overall AOP risk
      const totalDisb = filteredDisb.reduce((s, r) => s + r.disbursed, 0);
      const totalMtdCr = (totalDisb * AVG_ATS) / 100;
      const totalMonthly = TOTAL_AOP / 12;
      const totalProjected = pace > 0 ? totalMtdCr / pace : 0;
      const totalGap = totalMonthly > 0 ? ((totalProjected - totalMonthly) / totalMonthly) * 100 : 0;

      if (totalGap < -10) {
        result.push({
          id: `aop-total-${alertId++}`,
          title: `Overall AOP pacing ${Math.abs(totalGap).toFixed(0)}% behind target`,
          description: `Total ${pL} disbursals are ₹${totalMtdCr.toFixed(1)} Cr. Projected month-end is ₹${totalProjected.toFixed(1)} Cr vs a monthly target of ₹${totalMonthly.toFixed(1)} Cr (annual: ₹${TOTAL_AOP} Cr). The gap of ${Math.abs(totalGap).toFixed(0)}% means the team needs to ramp up daily run-rate significantly to close the month on target.`,
          severity: totalGap < -30 ? "critical" : totalGap < -20 ? "high" : "medium",
          status: "known",
          category: "aop_risk",
          impactLeads: 0,
          impactCr: parseFloat(Math.abs(totalProjected - totalMonthly).toFixed(2)),
          lender: null,
          program: null,
          stage: null,
          metricValue: totalProjected,
          baselineValue: totalMonthly,
          changePct: totalGap,
          needsAttention: totalGap < -20,
        });
      }

      // ─── 6) CONCENTRATION RISK ────────────────────────────────────────
      const lenderShares = lenders.map((l) => {
        const lDisb = filteredDisb.filter((r) => r.lender === l).reduce((s, r) => s + r.disbursed, 0);
        return { lender: l, disbursed: lDisb, share: totalDisb > 0 ? (lDisb / totalDisb) * 100 : 0 };
      }).sort((a, b) => b.share - a.share);

      const top2Share = lenderShares.slice(0, 2).reduce((s, l) => s + l.share, 0);
      if (top2Share > 65) {
        result.push({
          id: `conc-${alertId++}`,
          title: `Top-2 lenders account for ${top2Share.toFixed(0)}% of disbursals`,
          description: `${lenderShares[0]?.lender} (${lenderShares[0]?.share.toFixed(0)}%) and ${lenderShares[1]?.lender} (${lenderShares[1]?.share.toFixed(0)}%) together make up ${top2Share.toFixed(0)}% of all disbursals. This concentration creates risk — if either lender faces issues, overall numbers will be significantly impacted. Consider diversifying lender mix.`,
          severity: top2Share > 80 ? "high" : "medium",
          status: "known",
          category: "concentration",
          impactLeads: 0,
          impactCr: 0,
          lender: `${lenderShares[0]?.lender}, ${lenderShares[1]?.lender}`,
          program: null,
          stage: null,
          metricValue: top2Share,
          baselineValue: 50, // ideal
          changePct: top2Share - 50,
          needsAttention: top2Share > 75,
        });
      }
    }

    // Sort by severity priority, then by impact
    result.sort((a, b) => {
      const sPri = severityConfig[a.severity].priority - severityConfig[b.severity].priority;
      if (sPri !== 0) return sPri;
      return b.impactCr - a.impactCr;
    });

    return result;
  }, [filteredL2, filteredDisb, pL, cL]);

  // ─── Filtered alerts ──────────────────────────────────────────────────────
  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (severityFilter !== "All" && a.severity !== severityFilter) return false;
      if (statusFilter !== "All" && a.status !== statusFilter) return false;
      if (categoryFilter !== "All" && a.category !== categoryFilter) return false;
      return true;
    });
  }, [alerts, severityFilter, statusFilter, categoryFilter]);

  // ─── Summary stats ────────────────────────────────────────────────────────
  const summaryStats = useMemo(() => {
    const critical = alerts.filter((a) => a.severity === "critical").length;
    const high = alerts.filter((a) => a.severity === "high").length;
    const needsAttention = alerts.filter((a) => a.needsAttention).length;
    const newAlerts = alerts.filter((a) => a.status === "new").length;
    const totalImpactCr = alerts.reduce((s, a) => s + a.impactCr, 0);
    const totalImpactLeads = alerts.reduce((s, a) => s + a.impactLeads, 0);
    return { critical, high, needsAttention, newAlerts, totalImpactCr, totalImpactLeads };
  }, [alerts]);

  // ─── Impact chart data ────────────────────────────────────────────────────
  const impactChartData = useMemo(() => {
    // Top 10 alerts by Cr impact
    return alerts
      .filter((a) => a.impactCr > 0)
      .slice(0, 10)
      .map((a) => ({
        label: a.title.length > 35 ? a.title.substring(0, 33) + ".." : a.title,
        impactCr: a.impactCr,
        severity: a.severity,
      }));
  }, [alerts]);

  // ─── Category breakdown ───────────────────────────────────────────────────
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, { count: number; impactCr: number; impactLeads: number }> = {};
    alerts.forEach((a) => {
      if (!map[a.category]) map[a.category] = { count: 0, impactCr: 0, impactLeads: 0 };
      map[a.category].count++;
      map[a.category].impactCr += a.impactCr;
      map[a.category].impactLeads += a.impactLeads;
    });
    return Object.entries(map)
      .map(([cat, data]) => ({ category: cat as AlertCategory, ...data }))
      .sort((a, b) => b.impactCr - a.impactCr);
  }, [alerts]);

  // ─── Alert Insights for RichInsightPanel ───────────────────────────────────
  const alertInsights = useMemo((): RichInsightItem[] => {
    const insights: RichInsightItem[] = [];
    const criticalHigh = summaryStats.critical + summaryStats.high;
    const totalImpact = summaryStats.totalImpactCr;

    // 1. Critical/High alerts and total impact
    if (criticalHigh > 0 || totalImpact > 0) {
      insights.push({
        id: "alert-critical-high-impact",
        icon: Zap,
        color: criticalHigh > 3 ? "text-red-600" : "text-orange-600",
        title: `${criticalHigh} critical/high alert${criticalHigh !== 1 ? "s" : ""} — ₹${totalImpact.toFixed(1)} Cr total impact`,
        detail: `${summaryStats.critical} critical and ${summaryStats.high} high severity alerts affecting an estimated ₹${totalImpact.toFixed(1)} Cr in disbursals. ${summaryStats.needsAttention} need PM action.`,
        severity: criticalHigh > 3 ? "bad" : criticalHigh > 0 ? "warn" : "info",
        impactWeight: Math.min(100, criticalHigh * 20 + totalImpact),
        priorityBucket: criticalHigh > 3 ? "P0" : criticalHigh > 0 ? "P1" : "P3",
        link: "/alert-tracking",
        expanded: {
          bullets: [
            `Critical: ${summaryStats.critical}, High: ${summaryStats.high}`,
            `Total impact: ₹${totalImpact.toFixed(1)} Cr, ${summaryStats.totalImpactLeads.toLocaleString("en-IN")} leads at risk`,
            summaryStats.needsAttention > 0 ? `${summaryStats.needsAttention} alert(s) need immediate PM attention` : "No urgent PM action required",
          ],
          chartData: impactChartData.slice(0, 6).map((d) => ({
            label: d.label.length > 25 ? d.label.substring(0, 23) + ".." : d.label,
            value: d.impactCr,
            color: d.severity === "critical" ? "hsl(350, 65%, 55%)" : d.severity === "high" ? "hsl(25, 80%, 55%)" : "hsl(40, 80%, 55%)",
          })),
          chartLabel: "Top Impact by Alert (₹ Cr)",
          chartValueSuffix: " Cr",
        },
      });
    }

    // 2. New alerts this period
    if (summaryStats.newAlerts > 0) {
      insights.push({
        id: "alert-new-issues",
        icon: Zap,
        color: "text-violet-600",
        title: `${summaryStats.newAlerts} new alert${summaryStats.newAlerts !== 1 ? "s" : ""} appeared this period`,
        detail: `These issues were not present in the previous period and require investigation. Prioritize critical and high severity new alerts.`,
        severity: summaryStats.newAlerts > 3 ? "warn" : "info",
        impactWeight: summaryStats.newAlerts * 15,
        isEmerging: true,
        priorityBucket: "emerging",
        link: "/alert-tracking",
        defaultFilter: undefined,
        expanded: {
          bullets: alerts
            .filter((a) => a.status === "new")
            .slice(0, 5)
            .map((a) => `${a.title} — ${a.severity}`),
          chartData: alerts
            .filter((a) => a.status === "new")
            .slice(0, 5)
            .map((a) => ({
              label: a.title.length > 25 ? a.title.substring(0, 23) + ".." : a.title,
              value: a.impactCr,
              color: a.severity === "critical" ? "hsl(350, 65%, 55%)" : a.severity === "high" ? "hsl(25, 80%, 55%)" : "hsl(220, 70%, 55%)",
              filterContext: a.lender ? { lender: a.lender } : undefined,
            })),
          chartLabel: "New Alerts by Impact (₹ Cr)",
          chartValueSuffix: " Cr",
        },
      });
    }

    // 3. Category breakdown
    if (categoryBreakdown.length > 0) {
      insights.push({
        id: "alert-category-breakdown",
        icon: BarChart3,
        color: "text-blue-600",
        title: `Alerts spread across ${categoryBreakdown.length} categor${categoryBreakdown.length !== 1 ? "ies" : "y"}`,
        detail: categoryBreakdown.map((c) => `${categoryLabels[c.category]}: ${c.count} (₹${c.impactCr.toFixed(1)} Cr)`).join("; "),
        severity: "info",
        impactWeight: 30,
        priorityBucket: "P3",
        link: "/alert-tracking",
        expanded: {
          bullets: categoryBreakdown.map((c) => `${categoryLabels[c.category]}: ${c.count} alert(s), ₹${c.impactCr.toFixed(1)} Cr impact`),
          chartData: categoryBreakdown.map((c) => ({
            label: categoryLabels[c.category],
            value: c.impactCr,
            color: c.category === "conversion_drop" ? "hsl(350, 65%, 55%)" : c.category === "volume_dip" ? "hsl(25, 80%, 55%)" : c.category === "aop_risk" ? "hsl(40, 80%, 55%)" : "hsl(220, 70%, 55%)",
          })),
          chartLabel: "Impact by Category (₹ Cr)",
          chartValueSuffix: " Cr",
        },
      });
    }

    // 4. Top impact alerts
    const topImpact = alerts.filter((a) => a.impactCr > 0).slice(0, 5);
    if (topImpact.length > 0) {
      insights.push({
        id: "alert-top-impact",
        icon: TrendingDown,
        color: "text-red-600",
        title: `Top ${topImpact.length} alert${topImpact.length !== 1 ? "s" : ""} by business impact`,
        detail: topImpact.map((a) => `${a.title}: ₹${a.impactCr.toFixed(1)} Cr`).join("; "),
        severity: topImpact[0]?.impactCr > 5 ? "bad" : "warn",
        impactWeight: Math.min(95, (topImpact[0]?.impactCr ?? 0) * 10),
        priorityBucket: topImpact[0]?.impactCr > 5 ? "P0" : "P1",
        link: "/alert-tracking",
        expanded: {
          bullets: topImpact.map((a) => `${a.title} — ₹${a.impactCr.toFixed(1)} Cr (${a.severity})`),
          chartData: topImpact.map((a) => ({
            label: a.title.length > 30 ? a.title.substring(0, 28) + ".." : a.title,
            value: a.impactCr,
            color: a.severity === "critical" ? "hsl(350, 65%, 55%)" : a.severity === "high" ? "hsl(25, 80%, 55%)" : "hsl(40, 80%, 55%)",
            filterContext: a.lender ? { lender: a.lender } : undefined,
          })),
          chartLabel: "Impact Ranking (₹ Cr)",
          chartValueSuffix: " Cr",
        },
      });
    }

    // 5. Lender-specific alert concentration
    const lenderMap: Record<string, { count: number; impactCr: number }> = {};
    alerts.forEach((a) => {
      const key = a.lender || "Overall / System";
      if (!lenderMap[key]) lenderMap[key] = { count: 0, impactCr: 0 };
      lenderMap[key].count++;
      lenderMap[key].impactCr += a.impactCr;
    });
    const lenderEntries = Object.entries(lenderMap).sort((a, b) => b[1].count - a[1].count);
    const topLender = lenderEntries[0];
    if (topLender && topLender[1].count >= 2) {
      insights.push({
        id: "alert-lender-concentration",
        icon: Activity,
        color: "text-amber-600",
        title: `${topLender[0]} has highest alert concentration (${topLender[1].count} alert${topLender[1].count !== 1 ? "s" : ""})`,
        detail: `Lender-specific issues: ${lenderEntries.slice(0, 3).map(([l, d]) => `${l}: ${d.count} alert(s), ₹${d.impactCr.toFixed(1)} Cr`).join("; ")}`,
        severity: topLender[1].count > 5 ? "warn" : "info",
        impactWeight: topLender[1].count * 10,
        priorityBucket: topLender[1].count > 5 ? "P1" : "P2",
        link: "/alert-tracking",
        defaultFilter: topLender[0] !== "Overall / System" ? { lender: topLender[0] } : undefined,
        expanded: {
          bullets: lenderEntries.slice(0, 6).map(([l, d]) => `${l}: ${d.count} alert(s), ₹${d.impactCr.toFixed(1)} Cr impact`),
          chartData: lenderEntries.slice(0, 8).map(([l, d]) => ({
            label: l.length > 20 ? l.substring(0, 18) + ".." : l,
            value: d.count,
            color: d.count >= 3 ? "hsl(30, 80%, 55%)" : "hsl(220, 70%, 55%)",
            filterContext: l !== "Overall / System" ? { lender: l } : undefined,
          })),
          chartLabel: "Alerts by Lender",
          chartValueSuffix: " alert(s)",
        },
      });
    }

    // 6. Resolved/improving patterns (known alerts, or no critical)
    const knownCount = alerts.filter((a) => a.status === "known").length;
    const hasNoCritical = summaryStats.critical === 0;
    if (hasNoCritical && alerts.length > 0) {
      insights.push({
        id: "alert-no-critical",
        icon: CheckCircle2,
        color: "text-emerald-600",
        title: "No critical alerts — system within acceptable thresholds",
        detail: `All ${alerts.length} current alerts are high, medium, or low severity. ${knownCount} are known/tracked issues.`,
        severity: "good",
        impactWeight: 20,
        priorityBucket: "positive",
        link: "/alert-tracking",
        expanded: {
          bullets: [
            "No critical severity alerts detected",
            `${summaryStats.high} high, ${alerts.filter((a) => a.severity === "medium").length} medium, ${alerts.filter((a) => a.severity === "low").length} low`,
            knownCount > 0 ? `${knownCount} known issues under monitoring` : "Continue monitoring for new anomalies",
          ],
          chartData: [],
          chartLabel: "",
          chartValueSuffix: "",
        },
      });
    } else if (knownCount >= alerts.length * 0.5 && alerts.length > 0) {
      insights.push({
        id: "alert-known-patterns",
        icon: Target,
        color: "text-blue-600",
        title: `${knownCount} of ${alerts.length} alerts are known/tracked`,
        detail: "Majority of issues are under active monitoring. Focus on resolving new and recurring alerts first.",
        severity: "info",
        impactWeight: 15,
        link: "/alert-tracking",
        expanded: {
          bullets: [
            `${knownCount} known, ${alerts.filter((a) => a.status === "new").length} new, ${alerts.filter((a) => a.status === "recurring").length} recurring`,
            "Known issues have established mitigation plans — prioritize new and recurring for RCA.",
          ],
          chartData: [
            { label: "Known", value: knownCount, color: "hsl(220, 70%, 55%)" },
            { label: "New", value: summaryStats.newAlerts, color: "hsl(270, 70%, 55%)" },
            { label: "Recurring", value: alerts.filter((a) => a.status === "recurring").length, color: "hsl(40, 80%, 55%)" },
          ],
          chartLabel: "Alert Status Mix",
          chartValueSuffix: " alert(s)",
        },
      });
    }

    return insights;
  }, [alerts, summaryStats, categoryBreakdown, impactChartData]);

  const toggleExpand = (id: string) => {
    setExpandedAlerts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const openKpiDive = (type: "critical" | "high" | "new" | "needsAttention" | "totalImpact" | "leadsAtRisk") => {
    let config: KpiDeepDiveConfig;
    switch (type) {
      case "critical": {
        const alertsForSev = alerts.filter((a) => a.severity === "critical");
        config = {
          title: "Critical Alerts",
          metric: String(summaryStats.critical),
          subtitle: `Top ${alertsForSev.length} by impact`,
          sections: [
            {
              title: "Summary",
              type: "kpi-row",
              kpis: [
                { label: "Count", value: summaryStats.critical },
                { label: "Total Impact", value: `₹${alertsForSev.reduce((s, a) => s + a.impactCr, 0).toFixed(1)} Cr`, sub: "Estimated" },
              ],
            },
            {
              title: "Top Alerts by Impact",
              type: "table",
              headers: ["Alert", "Impact (Cr)", "Leads"],
              rows: alertsForSev
                .sort((a, b) => b.impactCr - a.impactCr)
                .slice(0, 10)
                .map((a) => ({ label: a.title.length > 40 ? a.title.substring(0, 38) + ".." : a.title, values: [a.impactCr.toFixed(1), a.impactLeads.toLocaleString("en-IN")] })),
            },
            {
              title: "Analysis",
              type: "bullets",
              bullets: [
                summaryStats.critical === 0 ? "No critical alerts — system within acceptable thresholds" : `${summaryStats.critical} critical severity issue(s) require immediate attention`,
                ...alertsForSev.slice(0, 3).map((a) => `${a.title}: ₹${a.impactCr.toFixed(1)} Cr`),
              ],
            },
          ],
        };
        break;
      }
      case "high": {
        const alertsForSev = alerts.filter((a) => a.severity === "high");
        config = {
          title: "High Severity Alerts",
          metric: String(summaryStats.high),
          subtitle: `Top ${alertsForSev.length} by impact`,
          sections: [
            {
              title: "Summary",
              type: "kpi-row",
              kpis: [
                { label: "Count", value: summaryStats.high },
                { label: "Total Impact", value: `₹${alertsForSev.reduce((s, a) => s + a.impactCr, 0).toFixed(1)} Cr`, sub: "Estimated" },
              ],
            },
            {
              title: "Top Alerts by Impact",
              type: "table",
              headers: ["Alert", "Impact (Cr)", "Leads"],
              rows: alertsForSev
                .sort((a, b) => b.impactCr - a.impactCr)
                .slice(0, 10)
                .map((a) => ({ label: a.title.length > 40 ? a.title.substring(0, 38) + ".." : a.title, values: [a.impactCr.toFixed(1), a.impactLeads.toLocaleString("en-IN")] })),
            },
            {
              title: "Analysis",
              type: "bullets",
              bullets: [
                summaryStats.high === 0 ? "No high severity alerts" : `${summaryStats.high} high severity issue(s) need prioritization`,
                ...alertsForSev.slice(0, 3).map((a) => `${a.title}: ₹${a.impactCr.toFixed(1)} Cr`),
              ],
            },
          ],
        };
        break;
      }
      case "new": {
        const newAlertsList = alerts.filter((a) => a.status === "new");
        config = {
          title: "New Issues",
          metric: String(summaryStats.newAlerts),
          subtitle: `Issues that appeared this period (vs ${cL})`,
          sections: [
            {
              title: "Summary",
              type: "kpi-row",
              kpis: [
                { label: "New Alerts", value: summaryStats.newAlerts },
                { label: "Impact", value: `₹${newAlertsList.reduce((s, a) => s + a.impactCr, 0).toFixed(1)} Cr`, sub: "Estimated" },
              ],
            },
            {
              title: "Top New Alerts by Impact",
              type: "table",
              headers: ["Alert", "Severity", "Impact (Cr)"],
              rows: newAlertsList
                .sort((a, b) => b.impactCr - a.impactCr)
                .slice(0, 10)
                .map((a) => ({ label: a.title.length > 40 ? a.title.substring(0, 38) + ".." : a.title, values: [severityConfig[a.severity].label, a.impactCr.toFixed(1)] })),
            },
            {
              title: "Analysis",
              type: "bullets",
              bullets: [
                summaryStats.newAlerts === 0 ? "No new issues this period" : `${summaryStats.newAlerts} new issue(s) require investigation`,
                ...newAlertsList.slice(0, 3).map((a) => `${a.title} (${a.severity})`),
              ],
            },
          ],
        };
        break;
      }
      case "needsAttention": {
        const needsList = alerts.filter((a) => a.needsAttention);
        config = {
          title: "Needs PM Action",
          metric: String(summaryStats.needsAttention),
          subtitle: "Alerts requiring immediate PM attention",
          sections: [
            {
              title: "Summary",
              type: "kpi-row",
              kpis: [
                { label: "Count", value: summaryStats.needsAttention },
                { label: "Total Impact", value: `₹${needsList.reduce((s, a) => s + a.impactCr, 0).toFixed(1)} Cr`, sub: "Estimated" },
              ],
            },
            {
              title: "Top Items by Impact",
              type: "table",
              headers: ["Alert", "Severity", "Impact (Cr)"],
              rows: needsList
                .sort((a, b) => b.impactCr - a.impactCr)
                .slice(0, 10)
                .map((a) => ({ label: a.title.length > 40 ? a.title.substring(0, 38) + ".." : a.title, values: [severityConfig[a.severity].label, a.impactCr.toFixed(1)] })),
            },
            {
              title: "Analysis",
              type: "bullets",
              bullets: [
                summaryStats.needsAttention === 0 ? "No urgent PM action required" : `${summaryStats.needsAttention} alert(s) need immediate PM attention`,
                ...needsList.slice(0, 3).map((a) => `${a.title} — ₹${a.impactCr.toFixed(1)} Cr`),
              ],
            },
          ],
        };
        break;
      }
      case "totalImpact": {
        const topByImpact = [...alerts].sort((a, b) => b.impactCr - a.impactCr).slice(0, 10);
        config = {
          title: "Total Impact",
          metric: `₹${summaryStats.totalImpactCr.toFixed(1)} Cr`,
          subtitle: "Estimated business impact across all alerts",
          sections: [
            {
              title: "Summary",
              type: "kpi-row",
              kpis: [
                { label: "Total Impact (Cr)", value: summaryStats.totalImpactCr.toFixed(1) },
                { label: "Leads at Risk", value: summaryStats.totalImpactLeads.toLocaleString("en-IN"), sub: "Estimated" },
              ],
            },
            {
              title: "Top Alerts by Impact",
              type: "table",
              headers: ["Alert", "Severity", "Impact (Cr)"],
              rows: topByImpact.map((a) => ({ label: a.title.length > 40 ? a.title.substring(0, 38) + ".." : a.title, values: [severityConfig[a.severity].label, a.impactCr.toFixed(1)] })),
            },
            {
              title: "Analysis",
              type: "bullets",
              bullets: [
                `Total estimated impact: ₹${summaryStats.totalImpactCr.toFixed(1)} Cr across ${alerts.length} alerts`,
                `Top contributors: ${topByImpact.slice(0, 2).map((a) => a.title).join("; ")}`,
                ...impactChartData.slice(0, 2).map((d) => `${d.label}: ₹${d.impactCr.toFixed(1)} Cr`),
              ],
            },
          ],
        };
        break;
      }
      case "leadsAtRisk": {
        const topByLeads = [...alerts].sort((a, b) => b.impactLeads - a.impactLeads).slice(0, 10);
        config = {
          title: "Leads at Risk",
          metric: summaryStats.totalImpactLeads.toLocaleString("en-IN"),
          subtitle: "Estimated leads affected by alerts",
          sections: [
            {
              title: "Summary",
              type: "kpi-row",
              kpis: [
                { label: "Total Leads", value: summaryStats.totalImpactLeads.toLocaleString("en-IN") },
                { label: "Impact (Cr)", value: `₹${summaryStats.totalImpactCr.toFixed(1)} Cr`, sub: "Estimated" },
              ],
            },
            {
              title: "Top Alerts by Leads Impact",
              type: "table",
              headers: ["Alert", "Leads", "Impact (Cr)"],
              rows: topByLeads.map((a) => ({ label: a.title.length > 40 ? a.title.substring(0, 38) + ".." : a.title, values: [a.impactLeads.toLocaleString("en-IN"), a.impactCr.toFixed(1)] })),
            },
            {
              title: "Analysis",
              type: "bullets",
              bullets: [
                `${summaryStats.totalImpactLeads.toLocaleString("en-IN")} leads estimated at risk across ${alerts.length} alerts`,
                ...topByLeads.slice(0, 3).map((a) => `${a.title}: ${a.impactLeads.toLocaleString("en-IN")} leads`),
              ],
            },
          ],
        };
        break;
      }
    }
    setKpiDive({ open: true, config });
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-muted-foreground animate-pulse">Detecting issues & anomalies...</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Issues, Alerts & Anomaly Detection"
        description="Automated detection of broken metrics, severity ranking, and plain-English issue descriptions"
      />

      <div className="p-6 space-y-6">
        {/* ─── Severity Summary Cards (clickable to filter) ─────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card
            className={cn("border-red-200/60 cursor-pointer transition-all hover:shadow-md relative", severityFilter === "critical" && "ring-2 ring-red-400")}
            onClick={() => setSeverityFilter(severityFilter === "critical" ? "All" : "critical")}
          >
            <CardContent className="p-3">
              <button
                onClick={(e) => { e.stopPropagation(); openKpiDive("critical"); }}
                className="absolute top-2 right-2 p-1 rounded hover:bg-muted/50 transition-colors"
                aria-label="Deep dive"
              >
                <Info className="h-3 w-3 text-muted-foreground hover:text-foreground" />
              </button>
              <div className="flex items-center gap-2 mb-1">
                <Flame className="h-3.5 w-3.5 text-red-600" />
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Critical</p>
              </div>
              <p className="text-2xl font-bold tabular-nums text-red-600">{summaryStats.critical}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">{severityFilter === "critical" ? "Click to clear" : "Click to filter"}</p>
            </CardContent>
          </Card>
          <Card
            className={cn("border-orange-200/60 cursor-pointer transition-all hover:shadow-md relative", severityFilter === "high" && "ring-2 ring-orange-400")}
            onClick={() => setSeverityFilter(severityFilter === "high" ? "All" : "high")}
          >
            <CardContent className="p-3">
              <button
                onClick={(e) => { e.stopPropagation(); openKpiDive("high"); }}
                className="absolute top-2 right-2 p-1 rounded hover:bg-muted/50 transition-colors"
                aria-label="Deep dive"
              >
                <Info className="h-3 w-3 text-muted-foreground hover:text-foreground" />
              </button>
              <div className="flex items-center gap-2 mb-1">
                <AlertOctagon className="h-3.5 w-3.5 text-orange-600" />
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">High</p>
              </div>
              <p className="text-2xl font-bold tabular-nums text-orange-600">{summaryStats.high}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">{severityFilter === "high" ? "Click to clear" : "Click to filter"}</p>
            </CardContent>
          </Card>
          <Card
            className={cn("cursor-pointer transition-all hover:shadow-md relative", statusFilter === "new" && "ring-2 ring-violet-400")}
            onClick={() => setStatusFilter(statusFilter === "new" ? "All" : "new")}
          >
            <CardContent className="p-3">
              <button
                onClick={(e) => { e.stopPropagation(); openKpiDive("new"); }}
                className="absolute top-2 right-2 p-1 rounded hover:bg-muted/50 transition-colors"
                aria-label="Deep dive"
              >
                <Info className="h-3 w-3 text-muted-foreground hover:text-foreground" />
              </button>
              <div className="flex items-center gap-2 mb-1">
                <Zap className="h-3.5 w-3.5 text-violet-600" />
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">New Issues</p>
              </div>
              <p className="text-2xl font-bold tabular-nums">{summaryStats.newAlerts}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">{statusFilter === "new" ? "Click to clear" : "Click to filter"}</p>
            </CardContent>
          </Card>
          <Card
            className={cn("cursor-pointer transition-all hover:shadow-md relative", severityFilter === "critical" && statusFilter === "All" ? "" : "")}
            onClick={() => {
              // Toggle: filter to only needsAttention alerts by setting severity to critical+high
              if (severityFilter === "critical" || severityFilter === "high") {
                setSeverityFilter("All");
              } else {
                setSeverityFilter("critical");
              }
            }}
          >
            <CardContent className="p-3">
              <button
                onClick={(e) => { e.stopPropagation(); openKpiDive("needsAttention"); }}
                className="absolute top-2 right-2 p-1 rounded hover:bg-muted/50 transition-colors"
                aria-label="Deep dive"
              >
                <Info className="h-3 w-3 text-muted-foreground hover:text-foreground" />
              </button>
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Needs PM Action</p>
              </div>
              <p className="text-2xl font-bold tabular-nums">{summaryStats.needsAttention}</p>
            </CardContent>
          </Card>
          <Card className="border-red-200/40 relative">
            <CardContent className="p-3">
              <button
                onClick={(e) => { e.stopPropagation(); openKpiDive("totalImpact"); }}
                className="absolute top-2 right-2 p-1 rounded hover:bg-muted/50 transition-colors"
                aria-label="Deep dive"
              >
                <Info className="h-3 w-3 text-muted-foreground hover:text-foreground" />
              </button>
              <div className="flex items-center gap-2 mb-1">
                <Banknote className="h-3.5 w-3.5 text-red-600" />
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Total Impact</p>
              </div>
              <p className="text-2xl font-bold tabular-nums text-red-600">{summaryStats.totalImpactCr.toFixed(1)} <span className="text-sm">Cr</span></p>
            </CardContent>
          </Card>
          <Card className="relative">
            <CardContent className="p-3">
              <button
                onClick={(e) => { e.stopPropagation(); openKpiDive("leadsAtRisk"); }}
                className="absolute top-2 right-2 p-1 rounded hover:bg-muted/50 transition-colors"
                aria-label="Deep dive"
              >
                <Info className="h-3 w-3 text-muted-foreground hover:text-foreground" />
              </button>
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="h-3.5 w-3.5 text-blue-600" />
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Leads at Risk</p>
              </div>
              <p className="text-2xl font-bold tabular-nums">{summaryStats.totalImpactLeads.toLocaleString("en-IN")}</p>
            </CardContent>
          </Card>
        </div>

        {/* ─── Impact Chart + Category Breakdown ───────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Impact ranking chart */}
          <Card className="lg:col-span-2 overflow-hidden">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Issue Ranking by Impact (₹ Cr)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-2 pr-2">
              {impactChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(200, impactChartData.length * 36)}>
                  <BarChart data={impactChartData} layout="vertical" margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 92%)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 9 }} tickLine={false} axisLine={false}
                      tickFormatter={(v) => `₹${v} Cr`}
                    />
                    <YAxis dataKey="label" type="category" tick={{ fontSize: 8 }} tickLine={false} axisLine={false} width={160} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || payload.length === 0) return null;
                        const d = payload[0]?.payload;
                        return (
                          <div className="rounded-lg border bg-card shadow-md px-3 py-2 text-xs">
                            <p className="font-semibold mb-1">{d?.label}</p>
                            <p>Impact: <span className="font-bold text-red-600">₹{d?.impactCr.toFixed(2)} Cr</span></p>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="impactCr" radius={[0, 4, 4, 0]} barSize={20}>
                      {impactChartData.map((entry, idx) => (
                        <Cell
                          key={idx}
                          fill={
                            entry.severity === "critical" ? "hsl(350, 65%, 55%)" :
                            entry.severity === "high" ? "hsl(25, 80%, 55%)" :
                            entry.severity === "medium" ? "hsl(40, 80%, 55%)" :
                            "hsl(220, 60%, 60%)"
                          }
                          fillOpacity={0.8}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-5 w-5 mr-2 text-emerald-500" />
                  No quantifiable impact issues detected
                </div>
              )}
            </CardContent>
          </Card>

          {/* Category breakdown */}
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Breakdown by Category
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-2">
              {categoryBreakdown.map((cat) => (
                <div key={cat.category} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{categoryLabels[cat.category]}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {cat.count} alert{cat.count > 1 ? "s" : ""}
                      {cat.impactCr > 0 && ` · ₹${cat.impactCr.toFixed(1)} Cr`}
                      {cat.impactLeads > 0 && ` · ${cat.impactLeads.toLocaleString("en-IN")} leads`}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[9px] shrink-0">{cat.count}</Badge>
                </div>
              ))}
              {categoryBreakdown.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No alerts to categorize</p>
              )}
            </CardContent>
          </Card>
        </div>

        {alertInsights.length > 0 && (
          <RichInsightPanel title="Alert Insights" insights={alertInsights} pageName="Alert Tracking" />
        )}

        <Separator />

        {/* ─── Filters ─────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            <Filter className="h-3 w-3" /> Filters
          </div>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Severity</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Status</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="recurring">Recurring</SelectItem>
              <SelectItem value="known">Known</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Categories</SelectItem>
              <SelectItem value="conversion_drop">Conversion Drop</SelectItem>
              <SelectItem value="volume_dip">Volume Dip</SelectItem>
              <SelectItem value="stuck_spike">Stuck % Spike</SelectItem>
              <SelectItem value="aop_risk">AOP Risk</SelectItem>
              <SelectItem value="concentration">Concentration</SelectItem>
              <SelectItem value="anomaly">Anomaly</SelectItem>
            </SelectContent>
          </Select>
          {(severityFilter !== "All" || statusFilter !== "All" || categoryFilter !== "All") && (
            <button
              onClick={() => { setSeverityFilter("All"); setStatusFilter("All"); setCategoryFilter("All"); }}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          )}
          <span className="text-[10px] text-muted-foreground ml-auto">
            Showing {filteredAlerts.length} of {alerts.length} alerts
          </span>
        </div>

        {/* ─── Alert Cards ─────────────────────────────────────────────── */}
        <div id="alert-list" className="space-y-2">
          {filteredAlerts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-3" />
                <p className="text-sm font-medium">No alerts match your filters</p>
                <p className="text-xs text-muted-foreground mt-1">Try broadening your filter criteria</p>
              </CardContent>
            </Card>
          ) : (
            filteredAlerts.map((alert) => {
              const sev = severityConfig[alert.severity];
              const stat = statusConfig[alert.status];
              const SevIcon = sev.icon;
              const isExpanded = expandedAlerts.has(alert.id);

              return (
                <Card
                  key={alert.id}
                  className={cn("transition-all hover:shadow-sm cursor-pointer", sev.border, alert.needsAttention && "ring-1 ring-red-200")}
                  onClick={() => toggleExpand(alert.id)}
                >
                  <CardContent className="p-0">
                    {/* Alert header row */}
                    <div className="flex items-start gap-3 px-4 py-3">
                      {/* Severity icon */}
                      <div className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", sev.bg)}>
                        <SevIcon className={cn("h-3.5 w-3.5", sev.color)} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold">{alert.title}</h3>
                          <Badge variant="outline" className={cn("text-[8px] font-bold px-1.5", sev.bg, sev.color, sev.border)}>
                            {sev.label}
                          </Badge>
                          <Badge variant="outline" className={cn("text-[8px] font-bold px-1.5", stat.bg, stat.color)}>
                            {stat.label}
                          </Badge>
                          {alert.needsAttention && (
                            <Badge className="text-[8px] font-bold px-1.5 bg-red-600 text-white hover:bg-red-700">
                              PM Action Needed
                            </Badge>
                          )}
                        </div>
                        {/* Attribution chips */}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <Badge variant="outline" className="text-[9px] px-1.5 bg-muted/50">
                            {categoryLabels[alert.category]}
                          </Badge>
                          {alert.lender && (
                            <span className="text-[10px] text-muted-foreground">
                              Lender: <span className="font-semibold text-foreground">{alert.lender}</span>
                            </span>
                          )}
                          {alert.program && (
                            <span className="text-[10px] text-muted-foreground">
                              Program: <span className="font-semibold text-foreground">{alert.program}</span>
                            </span>
                          )}
                          {alert.stage && (
                            <span className="text-[10px] text-muted-foreground">
                              Stage: <span className="font-semibold text-foreground">{alert.stage}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Impact + expand */}
                      <div className="shrink-0 text-right flex items-start gap-3">
                        <div>
                          {alert.impactCr > 0 && (
                            <p className="text-sm font-bold tabular-nums text-red-600">₹{alert.impactCr.toFixed(1)} Cr</p>
                          )}
                          {alert.impactLeads > 0 && (
                            <p className="text-[10px] text-muted-foreground tabular-nums">{alert.impactLeads.toLocaleString("en-IN")} leads</p>
                          )}
                        </div>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground mt-0.5" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5" />
                        )}
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="px-4 pb-3 pt-0 border-t border-border/50">
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Plain English description */}
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">What happened</p>
                            <p className="text-xs text-foreground leading-relaxed">{alert.description}</p>
                          </div>

                          {/* Metrics */}
                          <div className="space-y-2">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Key Metrics</p>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="p-2 rounded bg-muted/40">
                                <p className="text-[9px] text-muted-foreground">Current Value</p>
                                <p className="text-sm font-bold tabular-nums">
                                  {alert.category === "aop_risk" ? `₹${alert.metricValue.toFixed(1)} Cr` :
                                   alert.category === "volume_dip" ? alert.metricValue.toLocaleString("en-IN") :
                                   `${alert.metricValue.toFixed(1)}%`}
                                </p>
                              </div>
                              <div className="p-2 rounded bg-muted/40">
                                <p className="text-[9px] text-muted-foreground">Baseline</p>
                                <p className="text-sm font-bold tabular-nums text-muted-foreground">
                                  {alert.category === "aop_risk" ? `₹${alert.baselineValue.toFixed(1)} Cr` :
                                   alert.category === "volume_dip" ? alert.baselineValue.toLocaleString("en-IN") :
                                   `${alert.baselineValue.toFixed(1)}%`}
                                </p>
                              </div>
                              <div className="p-2 rounded bg-muted/40">
                                <p className="text-[9px] text-muted-foreground">Change</p>
                                <p className={cn("text-sm font-bold tabular-nums", alert.changePct < 0 ? "text-red-600" : "text-emerald-600")}>
                                  {alert.changePct > 0 ? "+" : ""}{alert.changePct.toFixed(1)}{alert.category === "volume_dip" || alert.category === "aop_risk" ? "%" : "pp"}
                                </p>
                              </div>
                              <div className="p-2 rounded bg-muted/40">
                                <p className="text-[9px] text-muted-foreground">Est. Business Impact</p>
                                <p className="text-sm font-bold tabular-nums text-red-600">
                                  {alert.impactCr > 0 ? `₹${alert.impactCr.toFixed(1)} Cr` : "-"}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end mt-3 pt-2 border-t border-border/30">
                          <button
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/stage-health?alert=${encodeURIComponent(alert.title)}&stage=${encodeURIComponent(alert.stage || '')}&lender=${encodeURIComponent(alert.lender || '')}`);
                            }}
                          >
                            <Wrench className="h-3.5 w-3.5" />
                            Raise RCA
                          </button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        <Separator />

        {/* ─── Attribution Tables ──────────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-1">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            Lender / Program / Stage Attribution
          </h2>
          <p className="text-[10px] text-muted-foreground mb-3">
            Which lenders, programs, and stages are contributing the most issues
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* By Lender */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  By Lender
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-[10px] font-semibold">Lender</TableHead>
                      <TableHead className="text-[10px] font-semibold">Programs Affected</TableHead>
                      <TableHead className="text-[10px] font-semibold text-center">Alerts</TableHead>
                      <TableHead className="text-[10px] font-semibold text-center">Critical</TableHead>
                      <TableHead className="text-[10px] font-semibold text-right">Impact (Cr)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const lenderMap: Record<string, { count: number; critical: number; impactCr: number; programs: Set<string> }> = {};
                      alerts.forEach((a) => {
                        const key = a.lender || "Overall / System";
                        if (!lenderMap[key]) lenderMap[key] = { count: 0, critical: 0, impactCr: 0, programs: new Set() };
                        lenderMap[key].count++;
                        if (a.severity === "critical") lenderMap[key].critical++;
                        lenderMap[key].impactCr += a.impactCr;
                        if (a.program) lenderMap[key].programs.add(a.program);
                      });
                      return Object.entries(lenderMap)
                        .sort((a, b) => b[1].impactCr - a[1].impactCr)
                        .map(([lender, data]) => (
                          <TableRow key={lender} className="hover:bg-muted/20">
                            <TableCell className="text-xs font-medium py-2">{lender}</TableCell>
                            <TableCell className="py-2">
                              <div className="flex flex-wrap gap-1">
                                {data.programs.size > 0 ? Array.from(data.programs).map((p) => (
                                  <Badge key={p} variant="outline" className="text-[8px] px-1.5 bg-muted/50">{p}</Badge>
                                )) : <span className="text-[9px] text-muted-foreground">All</span>}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-center tabular-nums">{data.count}</TableCell>
                            <TableCell className="text-center py-2">
                              {data.critical > 0 ? (
                                <Badge variant="outline" className="text-[9px] bg-red-50 text-red-700 border-red-200">{data.critical}</Badge>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-right tabular-nums font-medium text-red-600">
                              {data.impactCr > 0 ? `₹${data.impactCr.toFixed(1)}` : "-"}
                            </TableCell>
                          </TableRow>
                        ));
                    })()}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* By Stage */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  By Stage
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-[10px] font-semibold">Stage</TableHead>
                      <TableHead className="text-[10px] font-semibold">Programs Affected</TableHead>
                      <TableHead className="text-[10px] font-semibold text-center">Alerts</TableHead>
                      <TableHead className="text-[10px] font-semibold text-center">Critical</TableHead>
                      <TableHead className="text-[10px] font-semibold text-right">Impact (Cr)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const stageMap: Record<string, { count: number; critical: number; impactCr: number; programs: Set<string> }> = {};
                      alerts.forEach((a) => {
                        const key = a.stage || "N/A";
                        if (!stageMap[key]) stageMap[key] = { count: 0, critical: 0, impactCr: 0, programs: new Set() };
                        stageMap[key].count++;
                        if (a.severity === "critical") stageMap[key].critical++;
                        stageMap[key].impactCr += a.impactCr;
                        if (a.program) stageMap[key].programs.add(a.program);
                      });
                      return Object.entries(stageMap)
                        .sort((a, b) => b[1].impactCr - a[1].impactCr)
                        .slice(0, 10)
                        .map(([stage, data]) => (
                          <TableRow key={stage} className="hover:bg-muted/20">
                            <TableCell className="text-xs font-medium py-2 max-w-[160px] truncate" title={stage}>{stage}</TableCell>
                            <TableCell className="py-2">
                              <div className="flex flex-wrap gap-1">
                                {data.programs.size > 0 ? Array.from(data.programs).map((p) => (
                                  <Badge key={p} variant="outline" className="text-[8px] px-1.5 bg-muted/50">{p}</Badge>
                                )) : <span className="text-[9px] text-muted-foreground">All</span>}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-center tabular-nums">{data.count}</TableCell>
                            <TableCell className="text-center py-2">
                              {data.critical > 0 ? (
                                <Badge variant="outline" className="text-[9px] bg-red-50 text-red-700 border-red-200">{data.critical}</Badge>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-right tabular-nums font-medium text-red-600">
                              {data.impactCr > 0 ? `₹${data.impactCr.toFixed(1)}` : "-"}
                            </TableCell>
                          </TableRow>
                        ));
                    })()}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* By Program + Stage (combined view) */}
          <Card className="mt-4">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                By Program &times; Stage
              </CardTitle>
              <p className="text-[10px] text-muted-foreground">
                Combined view showing which program + stage combinations have the highest alert concentration
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-[10px] font-semibold">Program</TableHead>
                      <TableHead className="text-[10px] font-semibold">Stage</TableHead>
                      <TableHead className="text-[10px] font-semibold">Lenders Affected</TableHead>
                      <TableHead className="text-[10px] font-semibold text-center">Alerts</TableHead>
                      <TableHead className="text-[10px] font-semibold text-center">Severity</TableHead>
                      <TableHead className="text-[10px] font-semibold text-right">Impact (Leads)</TableHead>
                      <TableHead className="text-[10px] font-semibold text-right">Impact (Cr)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const comboMap: Record<string, {
                        program: string; stage: string; count: number;
                        maxSeverity: AlertSeverity; impactCr: number; impactLeads: number;
                        lenders: Set<string>;
                      }> = {};
                      alerts.forEach((a) => {
                        const prog = a.program || "All Programs";
                        const stg = a.stage || "N/A";
                        const key = `${prog}|||${stg}`;
                        if (!comboMap[key]) comboMap[key] = {
                          program: prog, stage: stg, count: 0,
                          maxSeverity: "low", impactCr: 0, impactLeads: 0, lenders: new Set(),
                        };
                        comboMap[key].count++;
                        comboMap[key].impactCr += a.impactCr;
                        comboMap[key].impactLeads += a.impactLeads;
                        if (a.lender) a.lender.split(", ").forEach((l) => comboMap[key].lenders.add(l));
                        // Track worst severity
                        const curPri = severityConfig[comboMap[key].maxSeverity].priority;
                        const newPri = severityConfig[a.severity].priority;
                        if (newPri < curPri) comboMap[key].maxSeverity = a.severity;
                      });
                      return Object.values(comboMap)
                        .sort((a, b) => b.impactCr - a.impactCr || b.count - a.count)
                        .slice(0, 15)
                        .map((row, idx) => {
                          const sev = severityConfig[row.maxSeverity];
                          return (
                            <TableRow key={idx} className="hover:bg-muted/20">
                              <TableCell className="text-xs font-medium py-2">
                                <Badge variant="outline" className="text-[9px] px-1.5 bg-muted/50">{row.program}</Badge>
                              </TableCell>
                              <TableCell className="text-xs font-medium py-2 max-w-[150px] truncate" title={row.stage}>
                                {row.stage}
                              </TableCell>
                              <TableCell className="py-2">
                                <div className="flex flex-wrap gap-1">
                                  {row.lenders.size > 0 ? Array.from(row.lenders).slice(0, 4).map((l) => (
                                    <span key={l} className="text-[9px] text-muted-foreground">{l}</span>
                                  )) : <span className="text-[9px] text-muted-foreground">-</span>}
                                  {row.lenders.size > 4 && <span className="text-[9px] text-muted-foreground">+{row.lenders.size - 4}</span>}
                                </div>
                              </TableCell>
                              <TableCell className="text-xs text-center tabular-nums font-medium">{row.count}</TableCell>
                              <TableCell className="text-center py-2">
                                <Badge variant="outline" className={cn("text-[8px] font-bold px-1.5", sev.bg, sev.color, sev.border)}>
                                  {sev.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-right tabular-nums">
                                {row.impactLeads > 0 ? row.impactLeads.toLocaleString("en-IN") : "-"}
                              </TableCell>
                              <TableCell className="text-xs text-right tabular-nums font-medium text-red-600">
                                {row.impactCr > 0 ? `₹${row.impactCr.toFixed(1)}` : "-"}
                              </TableCell>
                            </TableRow>
                          );
                        });
                    })()}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <KpiDeepDiveModal
        open={kpiDive.open}
        onClose={() => setKpiDive({ open: false, config: null })}
        config={kpiDive.config}
      />
    </div>
  );
}
