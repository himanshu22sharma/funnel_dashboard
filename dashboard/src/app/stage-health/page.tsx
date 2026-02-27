"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
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
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronRight,
  BarChart3,
  Banknote,
  Eye,
  RotateCcw,
  Filter,
  Zap,
  Target,
  Activity,
} from "lucide-react";
import { useFilters, useDateRangeFactors } from "@/lib/filter-context";
import {
  ResponsiveContainer,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Cell,
  Legend,
} from "recharts";
import {
  fetchL2Analysis,
  getUniqueValues,
  L2AnalysisRow,
} from "@/lib/data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { RichInsightPanel, type RichInsightItem } from "@/components/dashboard/rich-insight-card";
import { KpiDeepDiveModal, ClickableKpiCard, KpiDeepDiveConfig } from "@/components/dashboard/kpi-deep-dive-modal";

// ─── Constants ──────────────────────────────────────────────────────────────
const AVG_ATS = 1.83; // Lakhs (MTD 1528 Cr / 83401 loans)

// ─── Types ──────────────────────────────────────────────────────────────────
type RcaPhase = "identified" | "rca_in_progress" | "fix_deployed" | "validated" | "closed";
type IssueSeverity = "critical" | "high" | "medium";

interface RcaItem {
  id: string;
  /** What broke */
  issue: string;
  issueDetail: string;
  severity: IssueSeverity;
  /** Attribution */
  lender: string | null;
  program: string | null;
  stage: string;
  /** Root cause analysis */
  rootCause: string;
  /** Fix description */
  fix: string;
  /** Owner */
  owner: string;
  /** Current phase */
  phase: RcaPhase;
  /** Days since identified */
  ageDays: number;
  /** Before metrics */
  beforeConv: number;
  beforeLeads: number;
  /** After / current metrics */
  afterConv: number;
  afterLeads: number;
  /** Expected recovery */
  expectedRecoveryConv: number;
  expectedRecoveryLeads: number;
  /** Business impact */
  impactLeadsDelta: number;
  impactCr: number;
  /** Recovery achieved */
  recoveryPct: number;
}

const phaseConfig: Record<RcaPhase, { label: string; color: string; bg: string; border: string; icon: typeof Clock; step: number }> = {
  identified: { label: "Identified", color: "text-red-700", bg: "bg-red-50", border: "border-red-200", icon: AlertTriangle, step: 1 },
  rca_in_progress: { label: "RCA In Progress", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", icon: Clock, step: 2 },
  fix_deployed: { label: "Fix Deployed", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200", icon: Wrench, step: 3 },
  validated: { label: "Validated", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", icon: CheckCircle2, step: 4 },
  closed: { label: "Closed", color: "text-gray-600", bg: "bg-gray-100", border: "border-gray-200", icon: CheckCircle2, step: 5 },
};

const severityConfig: Record<IssueSeverity, { color: string; bg: string; border: string; label: string }> = {
  critical: { color: "text-red-700", bg: "bg-red-50", border: "border-red-200", label: "Critical" },
  high: { color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200", label: "High" },
  medium: { color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", label: "Medium" },
};

// Simulated owners for RCA items
const OWNERS = ["Rahul (PM)", "Priya (Ops)", "Amit (Eng)", "Neha (Risk)", "Vikram (BD)", "Sonia (PM)"];

// Simulated root causes and fixes
const ROOT_CAUSES: Record<string, { cause: string; fix: string }[]> = {
  conversion_drop: [
    { cause: "Lender API response time increased from 2s to 8s, causing timeouts during offer generation", fix: "Coordinated with lender tech team to optimize API; added retry logic with exponential backoff" },
    { cause: "Bureau pull failure rate spiked due to upstream provider maintenance window", fix: "Implemented fallback bureau provider; added graceful degradation for bureau-dependent stages" },
    { cause: "Updated KYC validation rules rejected valid documents due to stricter regex pattern", fix: "Rolled back regex change; added comprehensive test suite for document patterns before deploy" },
    { cause: "Lender credit policy tightened: minimum score raised from 650 to 700 without notice", fix: "Escalated with lender; negotiated phased rollout; updated pre-qualification filters to avoid wasted leads" },
  ],
  volume_drop: [
    { cause: "Marketing campaign paused for budget reallocation, reducing top-of-funnel traffic by 30%", fix: "Reallocated budget from underperforming channels; launched targeted re-engagement campaign" },
    { cause: "App update introduced navigation bug on loan discovery page, reducing click-through", fix: "Hotfix deployed within 24hrs; A/B test confirmed recovery; added smoke tests for critical flows" },
  ],
  stuck_spike: [
    { cause: "Manual verification queue backlogged due to 2 verifiers on leave + holiday rush", fix: "Temporary staff augmentation; escalated SLA monitoring; implemented auto-approval for low-risk cases" },
    { cause: "E-sign provider downtime caused leads to pile up at agreement stage", fix: "Switched to backup e-sign provider; added real-time provider health monitoring dashboard" },
    { cause: "Penny drop verification failing for certain bank IFSCs due to NPCI routing change", fix: "Updated IFSC mapping table; added fallback validation via UPI for affected banks" },
  ],
};

export default function RcaFixTracking() {
  const {
    global,
    useGlobalFilters,
    setAvailableLenders,
    setAvailableProductTypes,
    setAvailableFlows,
  } = useFilters();
  const { periodLabel: pL, compareLabel: cL } = useDateRangeFactors();
  const [l2Data, setL2Data] = useState<L2AnalysisRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [phaseFilter, setPhaseFilter] = useState<string>("All");
  const [severityFilterState, setSeverityFilterState] = useState<string>("All");
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [kpiDive, setKpiDive] = useState<{ open: boolean; config: KpiDeepDiveConfig | null }>({ open: false, config: null });

  // Effective global filters
  const effectiveLender = useGlobalFilters ? global.lender : "All";
  const effectiveProductType = useGlobalFilters ? global.productType : "All";
  const effectiveFlow = useGlobalFilters ? global.flow : "All";

  useEffect(() => {
    fetchL2Analysis().then((data) => {
      setL2Data(data);
      setAvailableLenders(getUniqueValues(data, "lender"));
      setAvailableProductTypes(getUniqueValues(data, "product_type"));
      setAvailableFlows(getUniqueValues(data, "isautoleadcreated"));
      setLoading(false);
    });
  }, [setAvailableLenders, setAvailableProductTypes, setAvailableFlows]);

  // Pre-filter data by global filters
  const filteredL2 = useMemo(() => {
    return l2Data.filter((r) => {
      if (effectiveLender !== "All" && r.lender !== effectiveLender) return false;
      if (effectiveProductType !== "All" && r.product_type !== effectiveProductType) return false;
      if (effectiveFlow !== "All" && r.isautoleadcreated !== effectiveFlow) return false;
      return true;
    });
  }, [l2Data, effectiveLender, effectiveProductType, effectiveFlow]);

  // ─── Generate RCA items from data ─────────────────────────────────────────
  const rcaItems = useMemo((): RcaItem[] => {
    if (filteredL2.length === 0) return [];

    const result: RcaItem[] = [];
    let itemId = 0;

    // All unique major indices
    const allIndices = Array.from(
      new Set(
        filteredL2
          .filter((r) => !r.sub_stage && Math.floor(r.major_index) === r.major_index && r.major_index < 1000 && r.major_index !== 1)
          .map((r) => r.major_index)
      )
    ).sort((a, b) => a - b);

    const lenders = Array.from(new Set(filteredL2.map((r) => r.lender))).sort();

    // Disbursed leads for downstream impact calc
    const lastIdx = allIndices[allIndices.length - 1];
    const overallMtdLast = filteredL2
      .filter((r) => r.month_start === "1.MTD" && !r.sub_stage && r.major_index === lastIdx)
      .reduce((s, r) => s + r.leads, 0);
    const overallMtdFirst = filteredL2
      .filter((r) => r.month_start === "1.MTD" && !r.sub_stage && r.major_index === allIndices[0])
      .reduce((s, r) => s + r.leads, 0);
    const overallE2E = overallMtdFirst > 0 ? overallMtdLast / overallMtdFirst : 0;

    // ─── Detect issues per lender per stage ──────────────────────────────
    for (const lender of lenders) {
      const lenderRows = filteredL2.filter((r) => r.lender === lender);
      const lMtd: Record<number, number> = {};
      const lLmtd: Record<number, number> = {};
      const lPrograms: Record<number, Set<string>> = {};

      lenderRows
        .filter((r) => !r.sub_stage && Math.floor(r.major_index) === r.major_index && r.major_index < 1000 && r.major_index !== 1)
        .forEach((r) => {
          const t = r.month_start === "1.MTD" ? lMtd : lLmtd;
          t[r.major_index] = (t[r.major_index] || 0) + r.leads;
          if (!lPrograms[r.major_index]) lPrograms[r.major_index] = new Set();
          lPrograms[r.major_index].add(r.product_type);
        });

      for (let i = 1; i < allIndices.length; i++) {
        const cur = allIndices[i];
        const prev = allIndices[i - 1];
        const mtdConv = (lMtd[prev] || 0) > 0 ? ((lMtd[cur] || 0) / (lMtd[prev] || 0)) * 100 : 0;
        const lmtdConv = (lLmtd[prev] || 0) > 0 ? ((lLmtd[cur] || 0) / (lLmtd[prev] || 0)) * 100 : 0;
        const delta = mtdConv - lmtdConv;
        const stageName = filteredL2.find((r) => r.major_index === cur && !r.sub_stage)?.original_major_stage || `Stage ${cur}`;
        const programs = lPrograms[cur] ? Array.from(lPrograms[cur]).join(", ") : null;

        if (delta < -5 && lmtdConv > 0) {
          const droppedLeads = Math.round(((lMtd[prev] || 0) * Math.abs(delta)) / 100);
          const downstreamConv = (lMtd[cur] || 0) > 0 ? overallMtdLast / overallMtdFirst : overallE2E;
          const lostLoans = Math.round(droppedLeads * downstreamConv);
          const lostCr = parseFloat(((lostLoans * AVG_ATS) / 100).toFixed(2));

          const severity: IssueSeverity = delta < -15 ? "critical" : delta < -8 ? "high" : "medium";

          // Deterministic simulation: phase, age, recovery based on delta magnitude
          const seed = (lender.charCodeAt(0) + cur) % 10;
          const ageDays = Math.min(Math.abs(Math.round(delta)) + seed, 30);
          let phase: RcaPhase;
          let recoveryPct: number;
          let afterConv: number;

          if (seed < 2) {
            phase = "identified";
            recoveryPct = 0;
            afterConv = mtdConv;
          } else if (seed < 4) {
            phase = "rca_in_progress";
            recoveryPct = 0;
            afterConv = mtdConv;
          } else if (seed < 7) {
            phase = "fix_deployed";
            const partialRecovery = 0.3 + (seed * 0.08);
            afterConv = mtdConv + Math.abs(delta) * partialRecovery;
            recoveryPct = parseFloat((partialRecovery * 100).toFixed(0));
          } else if (seed < 9) {
            phase = "validated";
            const goodRecovery = 0.6 + (seed * 0.04);
            afterConv = mtdConv + Math.abs(delta) * goodRecovery;
            recoveryPct = parseFloat((goodRecovery * 100).toFixed(0));
          } else {
            phase = "closed";
            afterConv = lmtdConv * 0.98;
            recoveryPct = 95;
          }

          // Get root cause and fix from templates
          const rcaTemplates = ROOT_CAUSES[delta < -10 ? "conversion_drop" : "conversion_drop"];
          const template = rcaTemplates[itemId % rcaTemplates.length];
          const owner = OWNERS[itemId % OWNERS.length];

          const expectedRecoveryConv = lmtdConv; // target: restore to LMTD level
          const expectedRecoveryLeads = lLmtd[cur] || 0;
          const afterLeads = Math.round((lMtd[prev] || 0) * (afterConv / 100));

          result.push({
            id: `rca-${itemId++}`,
            issue: `${lender}: ${stageName} conversion dropped ${Math.abs(delta).toFixed(1)}pp`,
            issueDetail: `Conversion at "${stageName}" fell from ${lmtdConv.toFixed(1)}% (${cL}) to ${mtdConv.toFixed(1)}% (${pL}). ~${droppedLeads.toLocaleString("en-IN")} additional leads lost.`,
            severity,
            lender,
            program: programs,
            stage: stageName,
            rootCause: template.cause,
            fix: template.fix,
            owner,
            phase,
            ageDays,
            beforeConv: parseFloat(lmtdConv.toFixed(1)),
            beforeLeads: lLmtd[cur] || 0,
            afterConv: parseFloat(afterConv.toFixed(1)),
            afterLeads,
            expectedRecoveryConv: parseFloat(lmtdConv.toFixed(1)),
            expectedRecoveryLeads: lLmtd[cur] || 0,
            impactLeadsDelta: droppedLeads,
            impactCr: lostCr,
            recoveryPct,
          });
        }
      }
    }

    // ─── Stuck % spikes ──────────────────────────────────────────────────
    const mtdStuck = filteredL2.filter((r) => r.month_start === "1.MTD" && r.sub_stage && (r.stuck_pct || 0) > 35);
    const lmtdStuckMap: Record<string, number> = {};
    filteredL2.filter((r) => r.month_start === "2.LMTD" && r.sub_stage && r.stuck_pct !== null).forEach((r) => {
      lmtdStuckMap[`${r.lender}|${r.original_major_stage}|${r.sub_stage}`] = r.stuck_pct || 0;
    });

    mtdStuck.forEach((r) => {
      const key = `${r.lender}|${r.original_major_stage}|${r.sub_stage}`;
      const baseline = lmtdStuckMap[key] || 0;
      const delta = (r.stuck_pct || 0) - baseline;

      if (delta > 8 || (r.stuck_pct || 0) > 45) {
        const severity: IssueSeverity = (r.stuck_pct || 0) > 55 ? "critical" : (r.stuck_pct || 0) > 45 ? "high" : "medium";
        const seed = (r.lender.charCodeAt(0) + (r.stuck_pct || 0)) % 10;
        const ageDays = Math.min(Math.round(delta) + seed, 20);

        let phase: RcaPhase;
        let recoveryPct: number;
        let afterStuck: number;
        const mtdStuckVal = r.stuck_pct || 0;

        if (seed < 3) {
          phase = "rca_in_progress";
          recoveryPct = 0;
          afterStuck = mtdStuckVal;
        } else if (seed < 6) {
          phase = "fix_deployed";
          afterStuck = mtdStuckVal - delta * 0.4;
          recoveryPct = 40;
        } else {
          phase = "validated";
          afterStuck = baseline + delta * 0.2;
          recoveryPct = 75;
        }

        const rcaTemplates = ROOT_CAUSES["stuck_spike"];
        const template = rcaTemplates[itemId % rcaTemplates.length];
        const owner = OWNERS[(itemId + 2) % OWNERS.length];

        result.push({
          id: `rca-stuck-${itemId++}`,
          issue: `${r.lender}: ${mtdStuckVal.toFixed(0)}% stuck at ${r.sub_stage}`,
          issueDetail: `${r.lender} has ${mtdStuckVal.toFixed(1)}% stuck at "${r.sub_stage}" under "${r.original_major_stage}". ${baseline > 0 ? `Was ${baseline.toFixed(1)}% last month (+${delta.toFixed(1)}pp).` : "New bottleneck."}`,
          severity,
          lender: r.lender,
          program: r.product_type,
          stage: `${r.original_major_stage} → ${r.sub_stage}`,
          rootCause: template.cause,
          fix: template.fix,
          owner,
          phase,
          ageDays,
          beforeConv: baseline, // "before" is baseline stuck%
          beforeLeads: r.leads,
          afterConv: parseFloat(afterStuck.toFixed(1)),
          afterLeads: r.leads,
          expectedRecoveryConv: baseline > 0 ? baseline : mtdStuckVal * 0.6,
          expectedRecoveryLeads: r.leads,
          impactLeadsDelta: r.leads,
          impactCr: parseFloat((r.leads * 0.02 * AVG_ATS / 100).toFixed(2)),
          recoveryPct,
        });
      }
    });

    // Sort: open items first (by phase step), then by severity, then by impact
    result.sort((a, b) => {
      const phaseA = phaseConfig[a.phase].step;
      const phaseB = phaseConfig[b.phase].step;
      if (phaseA !== phaseB) return phaseA - phaseB;
      const sevOrder: Record<IssueSeverity, number> = { critical: 0, high: 1, medium: 2 };
      if (sevOrder[a.severity] !== sevOrder[b.severity]) return sevOrder[a.severity] - sevOrder[b.severity];
      return b.impactCr - a.impactCr;
    });

    return result;
  }, [filteredL2, pL, cL]);

  // ─── Filtered items ───────────────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    return rcaItems.filter((item) => {
      if (phaseFilter !== "All" && item.phase !== phaseFilter) return false;
      if (severityFilterState !== "All" && item.severity !== severityFilterState) return false;
      return true;
    });
  }, [rcaItems, phaseFilter, severityFilterState]);

  // ─── Summary stats ────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = rcaItems.length;
    const open = rcaItems.filter((i) => i.phase !== "closed" && i.phase !== "validated").length;
    const fixDeployed = rcaItems.filter((i) => i.phase === "fix_deployed").length;
    const validated = rcaItems.filter((i) => i.phase === "validated").length;
    const closed = rcaItems.filter((i) => i.phase === "closed").length;
    const totalImpactCr = rcaItems.reduce((s, i) => s + i.impactCr, 0);
    const recoveredCr = rcaItems
      .filter((i) => i.phase === "fix_deployed" || i.phase === "validated" || i.phase === "closed")
      .reduce((s, i) => s + (i.impactCr * i.recoveryPct / 100), 0);
    const avgRecovery = rcaItems.filter((i) => i.recoveryPct > 0).length > 0
      ? rcaItems.filter((i) => i.recoveryPct > 0).reduce((s, i) => s + i.recoveryPct, 0) / rcaItems.filter((i) => i.recoveryPct > 0).length
      : 0;
    const avgAgeDays = total > 0 ? rcaItems.reduce((s, i) => s + i.ageDays, 0) / total : 0;

    return { total, open, fixDeployed, validated, closed, totalImpactCr, recoveredCr, avgRecovery, avgAgeDays };
  }, [rcaItems]);

  // ─── Phase pipeline data ──────────────────────────────────────────────────
  const phasePipeline = useMemo(() => {
    const phases: RcaPhase[] = ["identified", "rca_in_progress", "fix_deployed", "validated", "closed"];
    return phases.map((p) => ({
      phase: p,
      ...phaseConfig[p],
      count: rcaItems.filter((i) => i.phase === p).length,
      impactCr: rcaItems.filter((i) => i.phase === p).reduce((s, i) => s + i.impactCr, 0),
    }));
  }, [rcaItems]);

  // ─── RCA Insights for RichInsightPanel ────────────────────────────────────
  const rcaInsights = useMemo((): RichInsightItem[] => {
    const insights: RichInsightItem[] = [];
    const hasCritical = rcaItems.some((i) => i.severity === "critical");

    // 1. Open issues count and total impact (bad if any critical)
    if (stats.open > 0 || stats.totalImpactCr > 0) {
      insights.push({
        id: "rca-open-impact",
        icon: AlertTriangle,
        color: hasCritical ? "text-red-600" : "text-amber-600",
        title: `${stats.open} open issues with ₹${stats.totalImpactCr.toFixed(1)} Cr at stake`,
        detail: hasCritical
          ? "Critical severity items require immediate attention."
          : "Open items span identified and RCA-in-progress phases.",
        severity: hasCritical ? "bad" : "warn",
        impactWeight: stats.totalImpactCr,
        priorityBucket: hasCritical ? "P0" : "P1",
        link: "/stage-health",
        expanded: {
          bullets: [
            `${stats.open} issues in identified or RCA-in-progress phases`,
            `Total business impact: ₹${stats.totalImpactCr.toFixed(1)} Cr`,
            hasCritical ? "At least one critical severity item needs escalation" : "No critical items; focus on high/medium",
          ],
          chartData: phasePipeline
            .filter((p) => p.phase === "identified" || p.phase === "rca_in_progress")
            .map((p) => ({
              label: phaseConfig[p.phase].label,
              value: p.count,
              color: p.phase === "identified" ? "hsl(0, 70%, 55%)" : "hsl(38, 92%, 50%)",
            })),
          chartLabel: "Open items by phase",
          chartValueSuffix: " items",
        },
      });
    }

    // 2. Fixes deployed awaiting validation
    if (stats.fixDeployed > 0) {
      const deployedImpact = rcaItems
        .filter((i) => i.phase === "fix_deployed")
        .reduce((s, i) => s + i.impactCr, 0);
      insights.push({
        id: "rca-fix-deployed",
        icon: Wrench,
        color: "text-blue-600",
        title: `${stats.fixDeployed} fixes deployed, awaiting validation`,
        detail: `₹${deployedImpact.toFixed(1)} Cr impact pending validation.`,
        severity: "info",
        impactWeight: deployedImpact,
        priorityBucket: "P2",
        link: "/stage-health",
        defaultFilter: undefined,
        expanded: {
          bullets: [
            `${stats.fixDeployed} items in fix_deployed phase`,
            `Impact at stake: ₹${deployedImpact.toFixed(1)} Cr`,
            "Validate recovery metrics to move to closed",
          ],
          chartData: rcaItems
            .filter((i) => i.phase === "fix_deployed")
            .slice(0, 6)
            .map((i) => ({
              label: i.issue.length > 25 ? i.issue.substring(0, 23) + ".." : i.issue,
              value: i.impactCr,
              color: "hsl(220, 70%, 55%)",
              filterContext: i.lender ? { lender: i.lender } : undefined,
            })),
          chartLabel: "Fix deployed by impact (Cr)",
          chartValueSuffix: " Cr",
        },
      });
    }

    // 3. Recovery rate (avgRecovery% of expected)
    if (rcaItems.filter((i) => i.recoveryPct > 0).length > 0) {
      const recoverySeverity: "good" | "warn" | "info" = stats.avgRecovery >= 70 ? "good" : stats.avgRecovery >= 40 ? "info" : "warn";
      insights.push({
        id: "rca-recovery-rate",
        icon: TrendingUp,
        color: recoverySeverity === "good" ? "text-emerald-600" : recoverySeverity === "warn" ? "text-amber-600" : "text-blue-600",
        title: `Avg recovery at ${stats.avgRecovery.toFixed(0)}% of expected`,
        detail: `₹${stats.recoveredCr.toFixed(1)} Cr recovered of ₹${stats.totalImpactCr.toFixed(1)} Cr total impact.`,
        severity: recoverySeverity,
        impactWeight: stats.recoveredCr,
        priorityBucket: recoverySeverity === "good" ? "positive" : recoverySeverity === "warn" ? "P2" : "P3",
        link: "/stage-health",
        expanded: {
          bullets: [
            `Average recovery: ${stats.avgRecovery.toFixed(0)}%`,
            `Recovered: ₹${stats.recoveredCr.toFixed(1)} Cr / ₹${stats.totalImpactCr.toFixed(1)} Cr total`,
            recoverySeverity === "good" ? "Recovery on track" : "Focus on validating deployed fixes",
          ],
          chartData: rcaItems
            .filter((i) => i.recoveryPct > 0)
            .sort((a, b) => b.impactCr - a.impactCr)
            .slice(0, 6)
            .map((i) => ({
              label: i.issue.length > 25 ? i.issue.substring(0, 23) + ".." : i.issue,
              value: i.recoveryPct,
              color: i.recoveryPct >= 70 ? "hsl(150, 60%, 45%)" : i.recoveryPct >= 40 ? "hsl(220, 70%, 55%)" : "hsl(38, 92%, 50%)",
              filterContext: i.lender ? { lender: i.lender } : undefined,
            })),
          chartLabel: "Recovery % by item",
          chartValueSuffix: "%",
        },
      });
    }

    // 4. Average age of open items (warn if >7 days)
    const openItems = rcaItems.filter((i) => i.phase !== "closed" && i.phase !== "validated");
    const avgOpenAge = openItems.length > 0
      ? openItems.reduce((s, i) => s + i.ageDays, 0) / openItems.length
      : 0;
    if (openItems.length > 0 && avgOpenAge > 0) {
      insights.push({
        id: "rca-avg-age",
        icon: Clock,
        color: avgOpenAge > 7 ? "text-amber-600" : "text-blue-600",
        title: `Avg age of open items: ${avgOpenAge.toFixed(0)} days`,
        detail: avgOpenAge > 7
          ? "Open items are aging; consider accelerating RCA and fix deployment."
          : "Open items are within acceptable age range.",
        severity: avgOpenAge > 7 ? "warn" : "info",
        impactWeight: avgOpenAge,
        priorityBucket: avgOpenAge > 7 ? "P1" : "P3",
        link: "/stage-health",
        expanded: {
          bullets: [
            `Average age: ${avgOpenAge.toFixed(0)} days across ${openItems.length} open items`,
            avgOpenAge > 7 ? "Some items may be stuck; review ownership and blockers" : "Turnaround time is healthy",
          ],
          chartData: phasePipeline
            .filter((p) => p.phase === "identified" || p.phase === "rca_in_progress")
            .map((p) => ({
              label: phaseConfig[p.phase].label,
              value: p.count,
              color: "hsl(220, 70%, 55%)",
            })),
          chartLabel: "Open items by phase",
          chartValueSuffix: " items",
        },
      });
    }

    // 5. Validated/closed items (positive)
    const resolvedCount = stats.validated + stats.closed;
    if (resolvedCount > 0) {
      insights.push({
        id: "rca-validated-closed",
        icon: CheckCircle2,
        color: "text-emerald-600",
        title: `${resolvedCount} items validated or closed`,
        detail: `${stats.validated} validated, ${stats.closed} closed. Recovery validated.`,
        severity: "good",
        impactWeight: stats.recoveredCr,
        link: "/stage-health",
        priorityBucket: "positive",
        expanded: {
          bullets: [
            `${stats.validated} validated (fix confirmed)`,
            `${stats.closed} closed (fully resolved)`,
            `₹${stats.recoveredCr.toFixed(1)} Cr recovered from resolved items`,
          ],
          chartData: phasePipeline
            .filter((p) => p.phase === "validated" || p.phase === "closed")
            .map((p) => ({
              label: phaseConfig[p.phase].label,
              value: p.count,
              color: p.phase === "validated" ? "hsl(150, 60%, 45%)" : "hsl(0, 0%, 50%)",
            })),
          chartLabel: "Resolved items by phase",
          chartValueSuffix: " items",
        },
      });
    }

    // 6. Top-impact items
    const topImpact = rcaItems
      .filter((i) => i.impactCr > 0)
      .sort((a, b) => b.impactCr - a.impactCr)
      .slice(0, 5);
    if (topImpact.length > 0) {
      const maxImpact = topImpact[0];
      insights.push({
        id: "rca-top-impact",
        icon: BarChart3,
        color: "text-red-600",
        title: `Top impact: ${maxImpact.issue.length > 35 ? maxImpact.issue.substring(0, 33) + ".." : maxImpact.issue}`,
        detail: `₹${maxImpact.impactCr.toFixed(1)} Cr at stake. ${topImpact.length} high-impact items.`,
        severity: maxImpact.severity === "critical" ? "bad" : "info",
        impactWeight: maxImpact.impactCr,
        priorityBucket: maxImpact.severity === "critical" ? "P0" : "P1",
        link: "/stage-health",
        defaultFilter: maxImpact.lender ? { lender: maxImpact.lender } : undefined,
        expanded: {
          bullets: topImpact.map((i) => `${i.issue}: ₹${i.impactCr.toFixed(1)} Cr (${i.phase})`),
          chartData: topImpact.map((i) => ({
            label: i.issue.length > 22 ? i.issue.substring(0, 20) + ".." : i.issue,
            value: i.impactCr,
            color: i.severity === "critical" ? "hsl(0, 70%, 55%)" : i.severity === "high" ? "hsl(25, 95%, 53%)" : "hsl(38, 92%, 50%)",
            filterContext: i.lender ? { lender: i.lender } : undefined,
          })),
          chartLabel: "Top impact by item (Cr)",
          chartValueSuffix: " Cr",
        },
      });
    }

    // 7. Phase pipeline distribution
    if (phasePipeline.some((p) => p.count > 0)) {
      insights.push({
        id: "rca-phase-pipeline",
        icon: Activity,
        color: "text-blue-600",
        title: "Phase pipeline distribution",
        detail: `${phasePipeline.map((p) => `${phaseConfig[p.phase].label}: ${p.count}`).join(" → ")}`,
        severity: "info",
        impactWeight: stats.totalImpactCr,
        priorityBucket: "P3",
        link: "/stage-health",
        expanded: {
          bullets: phasePipeline.map((p) =>
            `${phaseConfig[p.phase].label}: ${p.count} items, ₹${p.impactCr.toFixed(1)} Cr impact`
          ),
          chartData: phasePipeline.map((p) => ({
            label: phaseConfig[p.phase].label,
            value: p.count,
            color: p.phase === "identified" ? "hsl(0, 70%, 55%)"
              : p.phase === "rca_in_progress" ? "hsl(38, 92%, 50%)"
              : p.phase === "fix_deployed" ? "hsl(220, 70%, 55%)"
              : p.phase === "validated" ? "hsl(150, 60%, 45%)"
              : "hsl(0, 0%, 50%)",
          })),
          chartLabel: "Items by phase",
          chartValueSuffix: " items",
        },
      });
    }

    // 8. Specific lender patterns
    const lenderImpact = rcaItems
      .filter((i) => i.lender)
      .reduce((acc, i) => {
        const l = i.lender!;
        if (!acc[l]) acc[l] = { count: 0, impactCr: 0 };
        acc[l].count++;
        acc[l].impactCr += i.impactCr;
        return acc;
      }, {} as Record<string, { count: number; impactCr: number }>);
    const lenderEntries = Object.entries(lenderImpact)
      .sort((a, b) => b[1].impactCr - a[1].impactCr)
      .slice(0, 6);
    if (lenderEntries.length > 0) {
      const topLender = lenderEntries[0];
      insights.push({
        id: "rca-lender-patterns",
        icon: Target,
        color: "text-blue-600",
        title: `${topLender[0]} leads with ${topLender[1].count} issues (₹${topLender[1].impactCr.toFixed(1)} Cr)`,
        detail: `Lender concentration: ${lenderEntries.map(([l, d]) => `${l}: ${d.count}`).join(", ")}`,
        severity: "info",
        impactWeight: topLender[1].impactCr,
        priorityBucket: "P2",
        link: "/stage-health",
        defaultFilter: { lender: topLender[0] },
        expanded: {
          bullets: lenderEntries.map(([l, d]) => `${l}: ${d.count} issues, ₹${d.impactCr.toFixed(1)} Cr impact`),
          chartData: lenderEntries.map(([l, d]) => ({
            label: l,
            value: d.impactCr,
            color: "hsl(220, 70%, 55%)",
            filterContext: { lender: l },
          })),
          chartLabel: "Impact by lender (Cr)",
          chartValueSuffix: " Cr",
          navigateLabel: "View by lender",
        },
      });
    }

    return insights;
  }, [rcaItems, stats, phasePipeline]);

  // ─── Before vs After chart data ───────────────────────────────────────────
  const beforeAfterData = useMemo(() => {
    return rcaItems
      .filter((i) => i.phase === "fix_deployed" || i.phase === "validated" || i.phase === "closed")
      .slice(0, 10)
      .map((item) => ({
        label: item.issue.length > 30 ? item.issue.substring(0, 28) + ".." : item.issue,
        before: item.beforeConv,
        after: item.afterConv,
        target: item.expectedRecoveryConv,
        phase: item.phase,
      }));
  }, [rcaItems]);

  // ─── Recovery tracking data ───────────────────────────────────────────────
  const recoveryData = useMemo(() => {
    return rcaItems
      .filter((i) => i.recoveryPct > 0)
      .sort((a, b) => b.impactCr - a.impactCr)
      .slice(0, 8)
      .map((item) => ({
        label: item.issue.length > 35 ? item.issue.substring(0, 33) + ".." : item.issue,
        recoveryPct: item.recoveryPct,
        expectedCr: item.impactCr,
        recoveredCr: parseFloat((item.impactCr * item.recoveryPct / 100).toFixed(2)),
        phase: item.phase,
      }));
  }, [rcaItems]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const openKpiDive = useCallback((type: "open" | "fixDeployed" | "validated" | "closed" | "totalImpact" | "recovered" | "avgRecovery" | "avgAge") => {
    let config: KpiDeepDiveConfig;
    switch (type) {
      case "open": {
        const openItems = rcaItems.filter((i) => i.phase === "identified" || i.phase === "rca_in_progress");
        config = {
          title: "Open Issues",
          metric: String(stats.open),
          subtitle: "Identified + RCA in progress",
          sections: [
            { title: "Summary", type: "kpi-row", kpis: [{ label: "Open", value: stats.open }, { label: "Total Impact", value: `₹${openItems.reduce((s, i) => s + i.impactCr, 0).toFixed(1)} Cr` }] },
            { title: "Open Items", type: "table", headers: ["Issue", "Phase", "Impact (Cr)"], rows: openItems.slice(0, 10).map((i) => ({ label: i.issue.length > 45 ? i.issue.substring(0, 43) + ".." : i.issue, values: [phaseConfig[i.phase].label, i.impactCr.toFixed(1)] })) },
            { title: "Phase Distribution", type: "chart", chart: { type: "bar", data: phasePipeline.filter((p) => p.phase === "identified" || p.phase === "rca_in_progress").map((p) => ({ name: phaseConfig[p.phase].label, value: p.count })), label: "Items", valueSuffix: "" } },
          ],
        };
        break;
      }
      case "fixDeployed": {
        const deployed = rcaItems.filter((i) => i.phase === "fix_deployed");
        config = {
          title: "Fix Deployed",
          metric: String(stats.fixDeployed),
          subtitle: "Awaiting validation",
          sections: [
            { title: "Summary", type: "kpi-row", kpis: [{ label: "Count", value: stats.fixDeployed }, { label: "Impact at Stake", value: `₹${deployed.reduce((s, i) => s + i.impactCr, 0).toFixed(1)} Cr` }] },
            { title: "Items", type: "table", headers: ["Issue", "Owner", "Impact (Cr)"], rows: deployed.slice(0, 10).map((i) => ({ label: i.issue.length > 45 ? i.issue.substring(0, 43) + ".." : i.issue, values: [i.owner, i.impactCr.toFixed(1)] })) },
            { title: "Impact by Item", type: "chart", chart: { type: "bar", data: deployed.slice(0, 6).map((i) => ({ name: i.issue.length > 20 ? i.issue.substring(0, 18) + ".." : i.issue, value: i.impactCr })), label: "Impact", valueSuffix: " Cr" } },
          ],
        };
        break;
      }
      case "validated": {
        const validated = rcaItems.filter((i) => i.phase === "validated");
        config = {
          title: "Validated",
          metric: String(stats.validated),
          subtitle: "Fix confirmed",
          sections: [
            { title: "Summary", type: "kpi-row", kpis: [{ label: "Count", value: stats.validated }, { label: "Recovered", value: `₹${validated.reduce((s, i) => s + (i.impactCr * i.recoveryPct / 100), 0).toFixed(1)} Cr` }] },
            { title: "Items", type: "table", headers: ["Issue", "Recovery %", "Impact (Cr)"], rows: validated.slice(0, 10).map((i) => ({ label: i.issue.length > 45 ? i.issue.substring(0, 43) + ".." : i.issue, values: [`${i.recoveryPct}%`, i.impactCr.toFixed(1)] })) },
          ],
        };
        break;
      }
      case "closed": {
        const closed = rcaItems.filter((i) => i.phase === "closed");
        config = {
          title: "Closed",
          metric: String(stats.closed),
          subtitle: "Fully resolved",
          sections: [
            { title: "Summary", type: "kpi-row", kpis: [{ label: "Count", value: stats.closed }, { label: "Recovered", value: `₹${closed.reduce((s, i) => s + (i.impactCr * i.recoveryPct / 100), 0).toFixed(1)} Cr` }] },
            { title: "Items", type: "table", headers: ["Issue", "Recovery %"], rows: closed.slice(0, 10).map((i) => ({ label: i.issue.length > 45 ? i.issue.substring(0, 43) + ".." : i.issue, values: [`${i.recoveryPct}%`] })) },
          ],
        };
        break;
      }
      case "totalImpact": {
        const topImpact = [...rcaItems].sort((a, b) => b.impactCr - a.impactCr).slice(0, 10);
        config = {
          title: "Total Impact",
          metric: `₹${stats.totalImpactCr.toFixed(1)} Cr`,
          subtitle: "Business impact at stake",
          sections: [
            { title: "Summary", type: "kpi-row", kpis: [{ label: "Total Impact", value: `₹${stats.totalImpactCr.toFixed(1)} Cr` }, { label: "Recovered", value: `₹${stats.recoveredCr.toFixed(1)} Cr`, sub: `${stats.totalImpactCr > 0 ? ((stats.recoveredCr / stats.totalImpactCr) * 100).toFixed(0) : 0}%` }] },
            { title: "Top Items by Impact", type: "table", headers: ["Issue", "Phase", "Impact (Cr)"], rows: topImpact.map((i) => ({ label: i.issue.length > 45 ? i.issue.substring(0, 43) + ".." : i.issue, values: [phaseConfig[i.phase].label, i.impactCr.toFixed(1)] })) },
            { title: "Phase Distribution", type: "chart", chart: { type: "pie", data: phasePipeline.map((p) => ({ name: phaseConfig[p.phase].label, value: p.impactCr })), label: "Impact", valueSuffix: " Cr" } },
          ],
        };
        break;
      }
      case "recovered": {
        const withRecovery = rcaItems.filter((i) => i.recoveryPct > 0);
        config = {
          title: "Recovered",
          metric: `₹${stats.recoveredCr.toFixed(1)} Cr`,
          subtitle: "Business impact recovered",
          sections: [
            { title: "Summary", type: "kpi-row", kpis: [{ label: "Recovered", value: `₹${stats.recoveredCr.toFixed(1)} Cr` }, { label: "of Total", value: `₹${stats.totalImpactCr.toFixed(1)} Cr`, sub: stats.totalImpactCr > 0 ? `${((stats.recoveredCr / stats.totalImpactCr) * 100).toFixed(0)}%` : "-" }] },
            { title: "Recovery by Item", type: "table", headers: ["Issue", "Recovery %", "Recovered (Cr)"], rows: withRecovery.sort((a, b) => (b.impactCr * b.recoveryPct / 100) - (a.impactCr * a.recoveryPct / 100)).slice(0, 10).map((i) => ({ label: i.issue.length > 45 ? i.issue.substring(0, 43) + ".." : i.issue, values: [`${i.recoveryPct}%`, (i.impactCr * i.recoveryPct / 100).toFixed(1)] })) },
            { title: "Recovery Distribution", type: "chart", chart: { type: "bar", data: withRecovery.slice(0, 6).map((i) => ({ name: i.issue.length > 20 ? i.issue.substring(0, 18) + ".." : i.issue, value: i.recoveryPct })), label: "Recovery %", valueSuffix: "%" } },
          ],
        };
        break;
      }
      case "avgRecovery": {
        const withRec = rcaItems.filter((i) => i.recoveryPct > 0);
        config = {
          title: "Avg Recovery",
          metric: `${stats.avgRecovery.toFixed(0)}%`,
          subtitle: "Average recovery across items",
          sections: [
            { title: "Summary", type: "kpi-row", kpis: [{ label: "Avg Recovery", value: `${stats.avgRecovery.toFixed(0)}%` }, { label: "Items with Recovery", value: withRec.length }] },
            { title: "Recovery by Item", type: "table", headers: ["Issue", "Recovery %"], rows: withRec.sort((a, b) => b.recoveryPct - a.recoveryPct).slice(0, 10).map((i) => ({ label: i.issue.length > 45 ? i.issue.substring(0, 43) + ".." : i.issue, values: [`${i.recoveryPct}%`] })) },
            { title: "Recovery Distribution", type: "chart", chart: { type: "bar", data: withRec.slice(0, 6).map((i) => ({ name: i.issue.length > 20 ? i.issue.substring(0, 18) + ".." : i.issue, value: i.recoveryPct })), label: "Recovery %", valueSuffix: "%" } },
          ],
        };
        break;
      }
      case "avgAge": {
        const byAge = [...rcaItems].sort((a, b) => b.ageDays - a.ageDays).slice(0, 10);
        config = {
          title: "Avg Age",
          metric: `${stats.avgAgeDays.toFixed(0)} days`,
          subtitle: "Average age of RCA items",
          sections: [
            { title: "Summary", type: "kpi-row", kpis: [{ label: "Avg Age", value: `${stats.avgAgeDays.toFixed(0)} days` }, { label: "Total Items", value: rcaItems.length }] },
            { title: "Oldest Items", type: "table", headers: ["Issue", "Age (days)", "Phase"], rows: byAge.map((i) => ({ label: i.issue.length > 45 ? i.issue.substring(0, 43) + ".." : i.issue, values: [i.ageDays, phaseConfig[i.phase].label] })) },
            { title: "Phase Distribution", type: "chart", chart: { type: "bar", data: phasePipeline.map((p) => ({ name: phaseConfig[p.phase].label, value: p.count })), label: "Items", valueSuffix: "" } },
          ],
        };
        break;
      }
    }
    setKpiDive({ open: true, config });
  }, [rcaItems, stats, phasePipeline]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-muted-foreground animate-pulse">Analyzing issues & generating RCAs...</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="RCA & Fix Tracking"
        description="Issue lifecycle from detection to resolution — root causes, ownership, fixes, and validated recovery"
      />

      <div className="p-6 space-y-6">
        {/* ─── Summary Cards ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <ClickableKpiCard onClick={() => openKpiDive("open")}>
            <Card className="border-red-200/50">
              <CardContent className="p-3">
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Open Issues</p>
                <p className="text-xl font-bold tabular-nums text-red-600">{stats.open}</p>
              </CardContent>
            </Card>
          </ClickableKpiCard>
          <ClickableKpiCard onClick={() => openKpiDive("fixDeployed")}>
            <Card className="border-blue-200/50">
              <CardContent className="p-3">
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Fix Deployed</p>
                <p className="text-xl font-bold tabular-nums text-blue-600">{stats.fixDeployed}</p>
              </CardContent>
            </Card>
          </ClickableKpiCard>
          <ClickableKpiCard onClick={() => openKpiDive("validated")}>
            <Card className="border-emerald-200/50">
              <CardContent className="p-3">
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Validated</p>
                <p className="text-xl font-bold tabular-nums text-emerald-600">{stats.validated}</p>
              </CardContent>
            </Card>
          </ClickableKpiCard>
          <ClickableKpiCard onClick={() => openKpiDive("closed")}>
            <Card>
              <CardContent className="p-3">
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Closed</p>
                <p className="text-xl font-bold tabular-nums">{stats.closed}</p>
              </CardContent>
            </Card>
          </ClickableKpiCard>
          <ClickableKpiCard onClick={() => openKpiDive("totalImpact")}>
            <Card className="border-red-200/40">
              <CardContent className="p-3">
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Total Impact</p>
                <p className="text-xl font-bold tabular-nums text-red-600">{stats.totalImpactCr.toFixed(1)} <span className="text-xs">Cr</span></p>
              </CardContent>
            </Card>
          </ClickableKpiCard>
          <ClickableKpiCard onClick={() => openKpiDive("recovered")}>
            <Card className="border-emerald-200/40">
              <CardContent className="p-3">
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Recovered</p>
                <p className="text-xl font-bold tabular-nums text-emerald-600">{stats.recoveredCr.toFixed(1)} <span className="text-xs">Cr</span></p>
              </CardContent>
            </Card>
          </ClickableKpiCard>
          <ClickableKpiCard onClick={() => openKpiDive("avgRecovery")}>
            <Card>
              <CardContent className="p-3">
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Avg Recovery</p>
                <p className="text-xl font-bold tabular-nums">{stats.avgRecovery.toFixed(0)}%</p>
              </CardContent>
            </Card>
          </ClickableKpiCard>
          <ClickableKpiCard onClick={() => openKpiDive("avgAge")}>
            <Card>
              <CardContent className="p-3">
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Avg Age</p>
                <p className="text-xl font-bold tabular-nums">{stats.avgAgeDays.toFixed(0)} <span className="text-xs">days</span></p>
              </CardContent>
            </Card>
          </ClickableKpiCard>
        </div>

        <RichInsightPanel title="RCA & Fix Tracking Insights" insights={rcaInsights} pageName="RCA & Fix Tracking" />

        {/* ─── Phase Pipeline ─────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Issue → RCA → Fix → Validation Lifecycle
            </CardTitle>
            <p className="text-[10px] text-muted-foreground">Click any phase to filter the list below</p>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-center gap-1">
              {phasePipeline.map((p, idx) => {
                const PhaseIcon = p.icon;
                const isActive = phaseFilter === p.phase;
                return (
                  <div key={p.phase} className="flex items-center flex-1 min-w-0">
                    <button
                      onClick={() => setPhaseFilter(isActive ? "All" : p.phase)}
                      className={cn(
                        "flex-1 rounded-lg p-3 text-left transition-all hover:shadow-md border",
                        isActive ? `${p.bg} ${p.border} ring-2 ring-offset-1` : "bg-muted/30 border-border hover:bg-muted/50",
                        isActive && p.phase === "identified" && "ring-red-300",
                        isActive && p.phase === "rca_in_progress" && "ring-amber-300",
                        isActive && p.phase === "fix_deployed" && "ring-blue-300",
                        isActive && p.phase === "validated" && "ring-emerald-300",
                        isActive && p.phase === "closed" && "ring-gray-300",
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <PhaseIcon className={cn("h-3.5 w-3.5", p.color)} />
                        <span className={cn("text-[10px] font-bold uppercase tracking-wider", p.color)}>{p.label}</span>
                      </div>
                      <p className="text-lg font-bold tabular-nums">{p.count}</p>
                      {p.impactCr > 0 && (
                        <p className="text-[9px] text-muted-foreground">₹{p.impactCr.toFixed(1)} Cr</p>
                      )}
                    </button>
                    {idx < phasePipeline.length - 1 && (
                      <ArrowRight className="h-4 w-4 text-muted-foreground/40 shrink-0 mx-1" />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ─── Before vs After + Recovery Charts ──────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Before vs After Funnel Comparison */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Before vs After Fix (Conv%)
              </CardTitle>
              <p className="text-[10px] text-muted-foreground">Items with deployed fixes — comparing pre-issue baseline with current state</p>
            </CardHeader>
            <CardContent className="p-0 pb-2 pr-2">
              {beforeAfterData.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(200, beforeAfterData.length * 38)}>
                  <BarChart data={beforeAfterData} layout="vertical" margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 92%)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 9 }} tickLine={false} axisLine={false}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <YAxis dataKey="label" type="category" tick={{ fontSize: 7 }} tickLine={false} axisLine={false} width={140} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || payload.length === 0) return null;
                        const d = payload[0]?.payload;
                        if (!d) return null;
                        return (
                          <div className="rounded-lg border bg-card shadow-md px-3 py-2 text-xs">
                            <p className="font-semibold mb-1">{d.label}</p>
                            <p>Before ({cL}): <span className="font-bold">{d.before}%</span></p>
                            <p>After ({pL}): <span className="font-bold text-blue-600">{d.after}%</span></p>
                            <p>Target: <span className="font-bold text-emerald-600">{d.target}%</span></p>
                          </div>
                        );
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="before" name={`Before (${cL})`} fill="hsl(0, 0%, 75%)" barSize={10} radius={[0, 4, 4, 0]} />
                    <Bar dataKey="after" name={`After (${pL})`} fill="hsl(220, 70%, 55%)" barSize={10} radius={[0, 4, 4, 0]} />
                    <Bar dataKey="target" name="Target" fill="hsl(150, 60%, 45%)" barSize={10} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-40 text-xs text-muted-foreground">
                  No fixes deployed yet to compare
                </div>
              )}
            </CardContent>
          </Card>

          {/* Expected vs Actual Recovery */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Expected vs Actual Recovery (₹ Cr)
              </CardTitle>
              <p className="text-[10px] text-muted-foreground">How much business impact has been recovered vs total at stake</p>
            </CardHeader>
            <CardContent className="p-0 pb-2 pr-2">
              {recoveryData.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(200, recoveryData.length * 38)}>
                  <BarChart data={recoveryData} layout="vertical" margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 92%)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 9 }} tickLine={false} axisLine={false}
                      tickFormatter={(v) => `₹${v} Cr`}
                    />
                    <YAxis dataKey="label" type="category" tick={{ fontSize: 7 }} tickLine={false} axisLine={false} width={160} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || payload.length === 0) return null;
                        const d = payload[0]?.payload;
                        if (!d) return null;
                        return (
                          <div className="rounded-lg border bg-card shadow-md px-3 py-2 text-xs">
                            <p className="font-semibold mb-1">{d.label}</p>
                            <p>Total Impact: <span className="font-bold text-red-600">₹{d.expectedCr.toFixed(2)} Cr</span></p>
                            <p>Recovered: <span className="font-bold text-emerald-600">₹{d.recoveredCr.toFixed(2)} Cr</span></p>
                            <p>Recovery: <span className="font-bold">{d.recoveryPct}%</span></p>
                          </div>
                        );
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="expectedCr" name="Total Impact" fill="hsl(350, 60%, 65%)" barSize={10} radius={[0, 4, 4, 0]} fillOpacity={0.4} />
                    <Bar dataKey="recoveredCr" name="Recovered" fill="hsl(150, 60%, 45%)" barSize={10} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-40 text-xs text-muted-foreground">
                  No recovery data available yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* ─── Filters ────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            <Filter className="h-3 w-3" /> Filters
          </div>
          <Select value={phaseFilter} onValueChange={setPhaseFilter}>
            <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Phases</SelectItem>
              <SelectItem value="identified">Identified</SelectItem>
              <SelectItem value="rca_in_progress">RCA In Progress</SelectItem>
              <SelectItem value="fix_deployed">Fix Deployed</SelectItem>
              <SelectItem value="validated">Validated</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={severityFilterState} onValueChange={setSeverityFilterState}>
            <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Severity</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
            </SelectContent>
          </Select>
          {(phaseFilter !== "All" || severityFilterState !== "All") && (
            <button
              onClick={() => { setPhaseFilter("All"); setSeverityFilterState("All"); }}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          )}
          <span className="text-[10px] text-muted-foreground ml-auto">
            {filteredItems.length} of {rcaItems.length} items
          </span>
        </div>

        {/* ─── RCA Item Cards ─────────────────────────────────────────── */}
        <div className="space-y-2">
          {filteredItems.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-3" />
                <p className="text-sm font-medium">No items match your filters</p>
              </CardContent>
            </Card>
          ) : (
            filteredItems.map((item) => {
              const pCfg = phaseConfig[item.phase];
              const sCfg = severityConfig[item.severity];
              const PhIcon = pCfg.icon;
              const isExpanded = expandedItems.has(item.id);

              return (
                <Card
                  key={item.id}
                  className={cn("transition-all hover:shadow-sm cursor-pointer", pCfg.border)}
                  onClick={() => toggleExpand(item.id)}
                >
                  <CardContent className="p-0">
                    {/* Header */}
                    <div className="flex items-start gap-3 px-4 py-3">
                      <div className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", pCfg.bg)}>
                        <PhIcon className={cn("h-3.5 w-3.5", pCfg.color)} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold">{item.issue}</h3>
                          <Badge variant="outline" className={cn("text-[8px] font-bold px-1.5", sCfg.bg, sCfg.color, sCfg.border)}>
                            {sCfg.label}
                          </Badge>
                          <Badge variant="outline" className={cn("text-[8px] font-bold px-1.5", pCfg.bg, pCfg.color, pCfg.border)}>
                            {pCfg.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" /> {item.owner}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {item.ageDays}d ago
                          </span>
                          {item.lender && <span>Lender: <span className="font-semibold text-foreground">{item.lender}</span></span>}
                          {item.program && <span>Program: <span className="font-semibold text-foreground">{item.program}</span></span>}
                          <span>Stage: <span className="font-semibold text-foreground">{item.stage}</span></span>
                        </div>
                      </div>

                      <div className="shrink-0 text-right flex items-start gap-3">
                        <div>
                          {item.impactCr > 0 && (
                            <p className="text-sm font-bold tabular-nums text-red-600">₹{item.impactCr.toFixed(1)} Cr</p>
                          )}
                          {item.recoveryPct > 0 && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Progress value={item.recoveryPct} className="h-1.5 w-12" />
                              <span className="text-[10px] font-semibold tabular-nums text-emerald-600">{item.recoveryPct}%</span>
                            </div>
                          )}
                        </div>
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground mt-0.5" /> : <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5" />}
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-0 border-t border-border/50">
                        {/* Lifecycle stepper */}
                        <div className="mt-3 mb-4">
                          <div className="flex items-center gap-0">
                            {(["identified", "rca_in_progress", "fix_deployed", "validated", "closed"] as RcaPhase[]).map((phase, idx) => {
                              const cfg = phaseConfig[phase];
                              const isReached = cfg.step <= pCfg.step;
                              const isCurrent = phase === item.phase;
                              return (
                                <div key={phase} className="flex items-center flex-1 min-w-0">
                                  <div className={cn(
                                    "flex items-center justify-center h-6 w-6 rounded-full border-2 shrink-0",
                                    isCurrent ? `${cfg.bg} ${cfg.border}` :
                                    isReached ? "bg-emerald-50 border-emerald-300" :
                                    "bg-muted border-border"
                                  )}>
                                    {isReached && !isCurrent ? (
                                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                    ) : (
                                      <span className={cn("text-[8px] font-bold", isCurrent ? cfg.color : "text-muted-foreground")}>{idx + 1}</span>
                                    )}
                                  </div>
                                  {idx < 4 && (
                                    <div className={cn(
                                      "flex-1 h-0.5 mx-1",
                                      isReached && cfg.step < pCfg.step ? "bg-emerald-300" : "bg-border"
                                    )} />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex mt-1">
                            {(["identified", "rca_in_progress", "fix_deployed", "validated", "closed"] as RcaPhase[]).map((phase) => (
                              <div key={phase} className="flex-1 min-w-0">
                                <p className={cn(
                                  "text-[8px] text-center truncate",
                                  phase === item.phase ? "font-bold text-foreground" : "text-muted-foreground"
                                )}>{phaseConfig[phase].label}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Issue & RCA */}
                          <div className="space-y-3">
                            <div>
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Issue</p>
                              <p className="text-xs leading-relaxed">{item.issueDetail}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Root Cause</p>
                              <p className="text-xs leading-relaxed">{item.rootCause}</p>
                            </div>
                          </div>

                          {/* Fix & Owner */}
                          <div className="space-y-3">
                            <div>
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Fix Applied</p>
                              <p className="text-xs leading-relaxed">{item.fix}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Owner &amp; Status</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-[9px] px-1.5">
                                  <User className="h-2.5 w-2.5 mr-1" />{item.owner}
                                </Badge>
                                <Badge variant="outline" className={cn("text-[9px] px-1.5", pCfg.bg, pCfg.color, pCfg.border)}>
                                  {pCfg.label}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground">{item.ageDays} days old</span>
                              </div>
                            </div>
                          </div>

                          {/* Before vs After metrics */}
                          <div className="space-y-2">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Before vs After</p>
                            <div className="grid grid-cols-3 gap-2">
                              <div className="p-2 rounded bg-muted/40 text-center">
                                <p className="text-[8px] text-muted-foreground uppercase">Before ({cL})</p>
                                <p className="text-sm font-bold tabular-nums">{item.beforeConv}%</p>
                              </div>
                              <div className="p-2 rounded bg-blue-50 text-center">
                                <p className="text-[8px] text-blue-600 uppercase">After ({pL})</p>
                                <p className="text-sm font-bold tabular-nums text-blue-600">{item.afterConv}%</p>
                              </div>
                              <div className="p-2 rounded bg-emerald-50 text-center">
                                <p className="text-[8px] text-emerald-600 uppercase">Target</p>
                                <p className="text-sm font-bold tabular-nums text-emerald-600">{item.expectedRecoveryConv.toFixed(1)}%</p>
                              </div>
                            </div>
                            <div className="mt-2">
                              <div className="flex items-center justify-between text-[9px] mb-1">
                                <span className="text-muted-foreground">Recovery Progress</span>
                                <span className="font-bold">{item.recoveryPct}%</span>
                              </div>
                              <Progress value={item.recoveryPct} className="h-2" />
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              <div className="p-2 rounded bg-red-50/50">
                                <p className="text-[8px] text-muted-foreground">Impact</p>
                                <p className="text-xs font-bold text-red-600">₹{item.impactCr.toFixed(1)} Cr</p>
                              </div>
                              <div className="p-2 rounded bg-emerald-50/50">
                                <p className="text-[8px] text-muted-foreground">Recovered</p>
                                <p className="text-xs font-bold text-emerald-600">₹{(item.impactCr * item.recoveryPct / 100).toFixed(1)} Cr</p>
                              </div>
                            </div>
                          </div>
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

        {/* ─── Ownership & Status Summary ─────────────────────────────── */}
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-1">
            <User className="h-4 w-4 text-muted-foreground" />
            Ownership &amp; Status Summary
          </h2>
          <p className="text-[10px] text-muted-foreground mb-3">
            Who owns what, how long issues have been open, and recovery status by owner
          </p>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-[10px] font-semibold">Owner</TableHead>
                    <TableHead className="text-[10px] font-semibold text-center">Total</TableHead>
                    <TableHead className="text-[10px] font-semibold text-center">Open</TableHead>
                    <TableHead className="text-[10px] font-semibold text-center">Fix Deployed</TableHead>
                    <TableHead className="text-[10px] font-semibold text-center">Validated / Closed</TableHead>
                    <TableHead className="text-[10px] font-semibold text-right">Impact (Cr)</TableHead>
                    <TableHead className="text-[10px] font-semibold text-right">Recovered (Cr)</TableHead>
                    <TableHead className="text-[10px] font-semibold text-center">Avg Age</TableHead>
                    <TableHead className="text-[10px] font-semibold min-w-[100px]">Recovery</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const ownerMap: Record<string, {
                      total: number; open: number; deployed: number; resolved: number;
                      impactCr: number; recoveredCr: number; totalAge: number;
                    }> = {};
                    rcaItems.forEach((item) => {
                      if (!ownerMap[item.owner]) ownerMap[item.owner] = { total: 0, open: 0, deployed: 0, resolved: 0, impactCr: 0, recoveredCr: 0, totalAge: 0 };
                      const o = ownerMap[item.owner];
                      o.total++;
                      o.totalAge += item.ageDays;
                      o.impactCr += item.impactCr;
                      o.recoveredCr += item.impactCr * item.recoveryPct / 100;
                      if (item.phase === "identified" || item.phase === "rca_in_progress") o.open++;
                      else if (item.phase === "fix_deployed") o.deployed++;
                      else o.resolved++;
                    });
                    return Object.entries(ownerMap)
                      .sort((a, b) => b[1].impactCr - a[1].impactCr)
                      .map(([owner, data]) => {
                        const avgAge = data.total > 0 ? data.totalAge / data.total : 0;
                        const recovPct = data.impactCr > 0 ? (data.recoveredCr / data.impactCr) * 100 : 0;
                        return (
                          <TableRow key={owner} className="hover:bg-muted/20">
                            <TableCell className="text-xs font-medium py-2">
                              <div className="flex items-center gap-1.5">
                                <User className="h-3 w-3 text-muted-foreground" />
                                {owner}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-center tabular-nums font-medium">{data.total}</TableCell>
                            <TableCell className="text-center py-2">
                              {data.open > 0 ? (
                                <Badge variant="outline" className="text-[9px] bg-red-50 text-red-700 border-red-200">{data.open}</Badge>
                              ) : <span className="text-[10px] text-muted-foreground">0</span>}
                            </TableCell>
                            <TableCell className="text-center py-2">
                              {data.deployed > 0 ? (
                                <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-200">{data.deployed}</Badge>
                              ) : <span className="text-[10px] text-muted-foreground">0</span>}
                            </TableCell>
                            <TableCell className="text-center py-2">
                              {data.resolved > 0 ? (
                                <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200">{data.resolved}</Badge>
                              ) : <span className="text-[10px] text-muted-foreground">0</span>}
                            </TableCell>
                            <TableCell className="text-xs text-right tabular-nums font-medium text-red-600">
                              ₹{data.impactCr.toFixed(1)}
                            </TableCell>
                            <TableCell className="text-xs text-right tabular-nums font-medium text-emerald-600">
                              ₹{data.recoveredCr.toFixed(1)}
                            </TableCell>
                            <TableCell className="text-xs text-center tabular-nums">
                              {avgAge.toFixed(0)}d
                            </TableCell>
                            <TableCell className="py-2">
                              <div className="flex items-center gap-1.5">
                                <Progress value={recovPct} className="h-1.5 flex-1" />
                                <span className="text-[9px] font-semibold tabular-nums w-8 text-right">{recovPct.toFixed(0)}%</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      });
                  })()}
                </TableBody>
              </Table>
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
