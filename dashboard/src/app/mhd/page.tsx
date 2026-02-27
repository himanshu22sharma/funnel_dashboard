"use client";

import React, { useEffect, useState, useMemo } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
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
  Headphones,
  Bot,
  Users,
  Phone,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MessageCircle,
  BarChart3,
  Activity,
  Banknote,
  ArrowRight,
  Zap,
  Target,
  ThumbsUp,
  ThumbsDown,
  UserCheck,
  Globe,
  ChevronDown,
  ChevronRight,
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
  PieChart,
  Pie,
  ComposedChart,
  Line,
  Legend,
} from "recharts";
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

const LOAN_STAGES = [
  "Lead Create",
  "Bureau pull success",
  "BRE1 completed",
  "Loan offer accepted",
  "Selfie uploaded",
  "KYC completed",
  "BRE2 completed",
  "Disbursal acc verified",
  "Review submit",
  "Mandate done",
  "Application submitted by user",
  "Submit to LMS",
  "Lead closed",
];

const TOP_ISSUE_STAGES = [
  "MARKETPLACE_OFFER_SELECTED",
  "LEAD_FAILURE",
  "BRE1_SUCCESS",
  "LMS_SUBMIT_APPLICATION_SUCCESS",
  "LEAD_SUCCESSFULLY_CLOSED",
  "BUSINESS_APPROVAL_AWAITED",
];

const ISSUE_CATEGORIES = [
  { name: "Loan Offer Related", count: 4218, lmtd: 3890, pct: 22.3,
    subQueries: [
      { query: "Why am I not getting a loan offer?", count: 1420, lmtd: 1280 },
      { query: "Offer amount is too low", count: 986, lmtd: 910 },
      { query: "Offer expired, can I get a new one?", count: 742, lmtd: 680 },
      { query: "Interest rate seems high", count: 618, lmtd: 590 },
      { query: "Multiple offers — which to choose?", count: 452, lmtd: 430 },
    ]},
  { name: "Loan Application Status", count: 3512, lmtd: 3240, pct: 18.6,
    subQueries: [
      { query: "Application stuck / not moving", count: 1180, lmtd: 1050 },
      { query: "How long will approval take?", count: 890, lmtd: 820 },
      { query: "Application shows wrong status", count: 680, lmtd: 650 },
      { query: "Need to update application details", count: 462, lmtd: 420 },
      { query: "Cannot see my application", count: 300, lmtd: 300 },
    ]},
  { name: "Rejection Reason", count: 2987, lmtd: 3150, pct: 15.8,
    subQueries: [
      { query: "Why was my loan rejected?", count: 1240, lmtd: 1380 },
      { query: "Can I reapply after rejection?", count: 720, lmtd: 760 },
      { query: "Bureau score issue — how to fix?", count: 510, lmtd: 520 },
      { query: "Rejected by lender but eligible", count: 320, lmtd: 310 },
      { query: "Need rejection letter/reason", count: 197, lmtd: 180 },
    ]},
  { name: "Loan Disbursal Status", count: 2145, lmtd: 1980, pct: 11.3,
    subQueries: [
      { query: "When will I receive the money?", count: 860, lmtd: 780 },
      { query: "Disbursal failed / reversed", count: 520, lmtd: 480 },
      { query: "Wrong bank account credited", count: 380, lmtd: 360 },
      { query: "Partial disbursal received", count: 240, lmtd: 220 },
      { query: "Disbursal confirmation not received", count: 145, lmtd: 140 },
    ]},
  { name: "Unable to Complete Application", count: 1876, lmtd: 2010, pct: 9.9,
    subQueries: [
      { query: "App crashes / loading error", count: 620, lmtd: 680 },
      { query: "OTP not received", count: 450, lmtd: 490 },
      { query: "Document upload failing", count: 380, lmtd: 400 },
      { query: "Selfie/KYC step not working", count: 280, lmtd: 300 },
      { query: "Cannot proceed to next step", count: 146, lmtd: 140 },
    ]},
  { name: "Loan Closure Related", count: 1654, lmtd: 1580, pct: 8.7,
    subQueries: [
      { query: "How to close my loan early?", count: 680, lmtd: 640 },
      { query: "Foreclosure charges too high", count: 420, lmtd: 400 },
      { query: "Loan shows open after payment", count: 310, lmtd: 300 },
      { query: "Need NOC / closure certificate", count: 244, lmtd: 240 },
    ]},
  { name: "Mandate Setup Related", count: 1423, lmtd: 1510, pct: 7.5,
    subQueries: [
      { query: "e-Mandate registration failed", count: 520, lmtd: 560 },
      { query: "Bank not supported for mandate", count: 380, lmtd: 400 },
      { query: "Mandate amount incorrect", count: 310, lmtd: 320 },
      { query: "How to change mandate bank?", count: 213, lmtd: 230 },
    ]},
  { name: "EDI Deduction Related", count: 1098, lmtd: 1040, pct: 5.8,
    subQueries: [
      { query: "EMI deducted but not reflecting", count: 420, lmtd: 390 },
      { query: "Double deduction happened", count: 310, lmtd: 290 },
      { query: "EMI date change request", count: 220, lmtd: 220 },
      { query: "Penalty charged on delay", count: 148, lmtd: 140 },
    ]},
];

const LOAN_PROGRAMS = ["Fresh", "Renewal", "Top-up", "BT", "AD", "Micro ML", "Bureau", "Banking"];

const MHD_LENDERS = ["FULLERTON", "KSF", "PIRAMAL", "SHRIRAM", "NACL", "PYFL", "MFL", "UCL"];

const CHANNEL_NAMES = ["Callcentre", "FSE", "DIY"];

const COLORS = [
  "hsl(220, 70%, 55%)",
  "hsl(150, 60%, 45%)",
  "hsl(350, 65%, 55%)",
  "hsl(40, 80%, 50%)",
  "hsl(280, 60%, 55%)",
  "hsl(190, 70%, 45%)",
  "hsl(20, 80%, 55%)",
  "hsl(310, 50%, 50%)",
];

// ─── Mock data generators ────────────────────────────────────────────────────
function generateMHDData() {
  const seed = (s: string) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0x7fffffff;
    return h;
  };

  const botSessionsByStageRaw = LOAN_STAGES.map((stage, i) => {
    const base = 1200 - i * 70 + (seed(stage) % 200);
    const lmtdBase = Math.round(base * (0.90 + (seed(stage + "l") % 15) / 100));
    // Per-program breakdown for filtering
    const byProgram: Record<string, { botSessions: number; agentSessions: number; resolved: number }> = {};
    let usedBot = 0, usedAgent = 0, usedResolved = 0;
    const totalBot = Math.max(50, base);
    const totalAgent = Math.max(20, Math.round(base * (0.15 + (seed(stage + "a") % 15) / 100)));
    const totalResolved = Math.max(30, Math.round(base * (0.65 + (seed(stage + "r") % 20) / 100)));
    LOAN_PROGRAMS.forEach((prog, pi) => {
      const share = pi < LOAN_PROGRAMS.length - 1
        ? (0.08 + (seed(stage + prog) % 20) / 100)
        : 1;
      const pBot = pi < LOAN_PROGRAMS.length - 1 ? Math.round(totalBot * share) : totalBot - usedBot;
      const pAgent = pi < LOAN_PROGRAMS.length - 1 ? Math.round(totalAgent * share) : totalAgent - usedAgent;
      const pRes = pi < LOAN_PROGRAMS.length - 1 ? Math.round(totalResolved * share) : totalResolved - usedResolved;
      byProgram[prog] = { botSessions: Math.max(1, pBot), agentSessions: Math.max(1, pAgent), resolved: Math.max(1, pRes) };
      usedBot += pBot; usedAgent += pAgent; usedResolved += pRes;
    });
    return {
      stage: stage.length > 18 ? stage.substring(0, 16) + ".." : stage,
      fullStage: stage,
      botSessions: totalBot,
      agentSessions: totalAgent,
      resolved: totalResolved,
      lmtdBotSessions: Math.max(40, lmtdBase),
      lmtdAgentSessions: Math.max(15, Math.round(lmtdBase * (0.16 + (seed(stage + "la") % 15) / 100))),
      byProgram,
    };
  });
  const botSessionsByStage = botSessionsByStageRaw;

  const botByProgram = LOAN_PROGRAMS.map((prog) => {
    const base = 800 + (seed(prog) % 600);
    const lmtdBase = Math.round(base * (0.90 + (seed(prog + "l") % 15) / 100));
    return {
      program: prog,
      sessions: base,
      selfResolved: Math.round(base * (0.6 + (seed(prog + "s") % 20) / 100)),
      handover: Math.round(base * (0.12 + (seed(prog + "h") % 10) / 100)),
      lmtdSessions: lmtdBase,
      lmtdSelfResolved: Math.round(lmtdBase * (0.58 + (seed(prog + "ls") % 20) / 100)),
    };
  });

  const issuesByStage = TOP_ISSUE_STAGES.map((stage) => {
    const total = 500 + (seed(stage) % 800);
    const lmtdTotal = Math.round(total * (0.88 + (seed(stage + "lt") % 20) / 100));
    return {
      stage: stage.replace(/_/g, " "),
      total,
      lmtdTotal,
      botResolved: Math.round(total * (0.55 + (seed(stage + "b") % 20) / 100)),
      agentResolved: Math.round(total * (0.25 + (seed(stage + "g") % 15) / 100)),
      pending: Math.round(total * (0.05 + (seed(stage + "p") % 10) / 100)),
      lmtdBotResolved: Math.round(lmtdTotal * (0.52 + (seed(stage + "lb") % 20) / 100)),
      lmtdAgentResolved: Math.round(lmtdTotal * (0.26 + (seed(stage + "lg") % 15) / 100)),
    };
  });

  const channelLeadData = LOAN_STAGES.map((stage, i) => {
    const total = 5000 - i * 300 + (seed(stage + "ch") % 400);
    const callcentre = Math.round(total * (0.25 + (seed(stage + "cc") % 10) / 100));
    const fse = Math.round(total * (0.35 + (seed(stage + "fse") % 10) / 100));
    const diy = total - callcentre - fse;
    return {
      stage: stage.length > 18 ? stage.substring(0, 16) + ".." : stage,
      fullStage: stage,
      total,
      Callcentre: callcentre,
      FSE: fse,
      DIY: diy,
      callcentrePct: parseFloat(((callcentre / total) * 100).toFixed(1)),
      fsePct: parseFloat(((fse / total) * 100).toFixed(1)),
      diyPct: parseFloat(((diy / total) * 100).toFixed(1)),
    };
  });

  const channelDisbursal = {
    Callcentre: { leads: 12450, disbursed: 3870, amount: parseFloat(((3870 * AVG_ATS) / 100).toFixed(1)) },
    FSE: { leads: 18200, disbursed: 5640, amount: parseFloat(((5640 * AVG_ATS) / 100).toFixed(1)) },
    DIY: { leads: 15800, disbursed: 4120, amount: parseFloat(((4120 * AVG_ATS) / 100).toFixed(1)) },
  };

  return { botSessionsByStage, botByProgram, issuesByStage, channelLeadData, channelDisbursal };
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function MHDPage() {
  const { global, useGlobalFilters } = useFilters();
  const { periodLabel: pL, compareLabel: cL } = useDateRangeFactors();
  const [activeView, setActiveView] = useState<"mhd" | "channels">("mhd");
  const [localProgramFilter, setLocalProgramFilter] = useState("All");
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [expandedL2, setExpandedL2] = useState<string | null>(null);
  const [expandedL3, setExpandedL3] = useState<string | null>(null);
  const [l2l3Mode, setL2l3Mode] = useState<"program-lender" | "lender-program">("program-lender");
  const [loading, setLoading] = useState(true);
  const [kpiDive, setKpiDive] = useState<{ open: boolean; config: KpiDeepDiveConfig | null }>({ open: false, config: null });
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(t);
  }, []);

  // Sync with global filters
  const programFilter = useGlobalFilters && global.productType !== "All" ? global.productType : localProgramFilter;
  const setProgramFilter = useGlobalFilters ? (v: string) => setLocalProgramFilter(v) : setLocalProgramFilter;
  const effectiveLender = useGlobalFilters ? global.lender : "All";

  const data = useMemo(() => generateMHDData(), []);

  // Filtered bot sessions by program
  const filteredBotSessions = useMemo(() => {
    if (programFilter === "All") return data.botSessionsByStage;
    return data.botSessionsByStage.map((row) => {
      const pg = row.byProgram?.[programFilter];
      if (!pg) return row;
      return {
        ...row,
        botSessions: pg.botSessions,
        agentSessions: pg.agentSessions,
        resolved: pg.resolved,
      };
    });
  }, [data.botSessionsByStage, programFilter]);

  // ─── MHD KPIs ──────────────────────────────────────────────────────────────
  const mhdKPIs = useMemo(() => {
    const totalBotSessions = data.botSessionsByStage.reduce((s, r) => s + r.botSessions, 0);
    const totalAgentSessions = data.botSessionsByStage.reduce((s, r) => s + r.agentSessions, 0);
    const totalResolved = data.botSessionsByStage.reduce((s, r) => s + r.resolved, 0);
    const totalContacts = totalBotSessions + totalAgentSessions;
    const totalCategories = ISSUE_CATEGORIES.reduce((s, c) => s + c.count, 0);

    // Contact ratio: contacts per 1000 workable leads (mock)
    const workableLeads = 486000;
    const contactRatio = parseFloat(((totalContacts / workableLeads) * 1000).toFixed(1));
    const lmtdContactRatio = parseFloat((contactRatio * 1.08).toFixed(1));

    // Bot MSAT
    const botMSAT = 4.2;
    const lmtdBotMSAT = 4.0;

    // Bot self-resolution
    const botSelfResolution = parseFloat(((totalResolved / totalBotSessions) * 100).toFixed(1));
    const lmtdBotSelfResolution = parseFloat((botSelfResolution - 2.3).toFixed(1));

    // Bot sentiment
    const positiveSentiment = 62.4;
    const neutralSentiment = 25.8;
    const negativeSentiment = 11.8;

    // Bot to agent handover
    const handoverRate = parseFloat(((totalAgentSessions / totalBotSessions) * 100).toFixed(1));
    const lmtdHandoverRate = parseFloat((handoverRate + 1.5).toFixed(1));

    // IVR metrics
    const ivrInflow = Math.round(totalContacts * 0.35);
    const ivrSelfResolution = 42.3;
    const ivrToAgentHandover = 57.7;

    // Agent metrics
    const agentInflow = totalAgentSessions;
    const agentResolutionRate = 87.6;

    // MHD lead creation & disbursal impact
    const mhdLeadsCreated = 8420;
    const mhdDisbursals = 2180;
    const mhdDisbursalValue = parseFloat(((mhdDisbursals * AVG_ATS) / 100).toFixed(1));
    const totalLeads = 46500;
    const totalDisbursals = 13630;
    const mhdLeadPct = parseFloat(((mhdLeadsCreated / totalLeads) * 100).toFixed(1));
    const mhdDisbPct = parseFloat(((mhdDisbursals / totalDisbursals) * 100).toFixed(1));

    // Leads that moved ahead after bot interaction
    const botFunnelAdvance = 5640;
    const botFunnelAdvanceValue = parseFloat(((botFunnelAdvance * 0.35 * AVG_ATS) / 100).toFixed(1));

    // TAT metrics
    const tatDisbursalFromLead = 4.2; // days
    const tatQueryResolution = 2.8; // hours
    const tatFirstResponse = 12; // minutes
    const lmtdTatDisbursalFromLead = 4.5;
    const lmtdTatQueryResolution = 3.1;
    const lmtdTatFirstResponse = 15;

    // LMTD for IVR and Agent metrics
    const lmtdIvrInflow = Math.round(ivrInflow * 1.04);
    const lmtdIvrSelfResolution = 63.8;
    const lmtdIvrToAgentHandover = 18.5;
    const lmtdAgentInflow = Math.round(agentInflow * 0.96);
    const lmtdAgentResolutionRate = 89.2;
    const lmtdMhdLeadsCreated = Math.round(mhdLeadsCreated * 0.93);
    const lmtdMhdDisbursals = Math.round(mhdDisbursals * 0.91);
    const lmtdBotFunnelAdvance = Math.round(botFunnelAdvance * 0.92);

    return {
      totalBotSessions, totalAgentSessions, totalResolved, totalContacts,
      contactRatio, lmtdContactRatio,
      botMSAT, lmtdBotMSAT,
      botSelfResolution, lmtdBotSelfResolution,
      positiveSentiment, neutralSentiment, negativeSentiment,
      handoverRate, lmtdHandoverRate,
      ivrInflow, ivrSelfResolution, ivrToAgentHandover,
      lmtdIvrInflow, lmtdIvrSelfResolution, lmtdIvrToAgentHandover,
      agentInflow, agentResolutionRate,
      lmtdAgentInflow, lmtdAgentResolutionRate,
      mhdLeadsCreated, mhdDisbursals, mhdDisbursalValue,
      mhdLeadPct, mhdDisbPct,
      lmtdMhdLeadsCreated, lmtdMhdDisbursals,
      botFunnelAdvance, botFunnelAdvanceValue,
      lmtdBotFunnelAdvance,
      totalCategories,
      tatDisbursalFromLead, tatQueryResolution, tatFirstResponse,
      lmtdTatDisbursalFromLead, lmtdTatQueryResolution, lmtdTatFirstResponse,
    };
  }, [data]);

  // ─── MHD Insights for RichInsightPanel ────────────────────────────────────
  const mhdInsights = useMemo((): RichInsightItem[] => {
    const insights: RichInsightItem[] = [];

    // 1. Contact Ratio change
    const contactDelta = mhdKPIs.contactRatio - mhdKPIs.lmtdContactRatio;
    insights.push({
      id: "mhd-contact-ratio",
      icon: Phone,
      color: "text-violet-600",
      title: contactDelta < 0 ? "Contact Ratio improved" : "Contact Ratio increased",
      detail: `Contact ratio is ${mhdKPIs.contactRatio} per 1K workable leads (${cL}: ${mhdKPIs.lmtdContactRatio}). ${contactDelta < 0 ? "Lower contacts per lead indicates better efficiency." : "Higher contacts may indicate more support needed."}`,
      severity: contactDelta < 0 ? "good" : "bad",
      impactWeight: contactDelta < 0 ? 20 : 75,
      priorityBucket: contactDelta < 0 ? "positive" : "P1",
      expanded: {
        bullets: [
          `Current: ${mhdKPIs.contactRatio} vs ${cL}: ${mhdKPIs.lmtdContactRatio}`,
          contactDelta < 0 ? "Fewer contacts per workable lead suggests improved self-service or fewer issues." : "Rising contact ratio may require capacity planning or root-cause analysis.",
        ],
        chartData: [
          { label: pL, value: mhdKPIs.contactRatio, color: "hsl(220, 70%, 55%)" },
          { label: cL, value: mhdKPIs.lmtdContactRatio, color: "hsl(0, 0%, 75%)" },
        ],
        chartLabel: "Contact Ratio",
        chartValueSuffix: " per 1K",
      },
    });

    // 2. Bot MSAT change (4.2 vs 4.0)
    const msatImproved = mhdKPIs.botMSAT > mhdKPIs.lmtdBotMSAT;
    insights.push({
      id: "mhd-bot-msat",
      icon: ThumbsUp,
      color: "text-emerald-600",
      title: msatImproved ? "Bot MSAT improved" : "Bot MSAT declined",
      detail: `Bot Mean Satisfaction is ${mhdKPIs.botMSAT}/5.0 (${cL}: ${mhdKPIs.lmtdBotMSAT}). ${msatImproved ? "Customer satisfaction with bot interactions is up." : "Review bot flows and resolution quality."}`,
      severity: msatImproved ? "good" : "bad",
      impactWeight: msatImproved ? 15 : 65,
      priorityBucket: msatImproved ? "positive" : "P1",
      expanded: {
        bullets: [
          `Current MSAT: ${mhdKPIs.botMSAT} out of 5.0`,
          `Compare to ${cL}: ${mhdKPIs.lmtdBotMSAT}`,
          msatImproved ? "Positive sentiment and resolution quality likely contributing." : "Consider sentiment analysis and handover reasons.",
        ],
        chartData: [
          { label: pL, value: mhdKPIs.botMSAT, color: "hsl(150, 60%, 45%)" },
          { label: cL, value: mhdKPIs.lmtdBotMSAT, color: "hsl(0, 0%, 75%)" },
        ],
        chartLabel: "Bot MSAT",
        chartValueSuffix: "/5",
      },
    });

    // 3. Bot Self-Resolution improvement
    const selfResDelta = mhdKPIs.botSelfResolution - mhdKPIs.lmtdBotSelfResolution;
    insights.push({
      id: "mhd-bot-self-resolution",
      icon: Bot,
      color: "text-blue-600",
      title: selfResDelta > 0 ? "Bot Self-Resolution improved" : "Bot Self-Resolution declined",
      detail: `Bot self-resolution is ${mhdKPIs.botSelfResolution}% (${cL}: ${mhdKPIs.lmtdBotSelfResolution}%). ${selfResDelta > 0 ? "More queries resolved without agent handover." : "More handovers may increase agent load."}`,
      severity: selfResDelta > 0 ? "good" : "bad",
      impactWeight: selfResDelta > 0 ? 20 : 60,
      priorityBucket: selfResDelta > 0 ? "positive" : "P2",
      expanded: {
        bullets: [
          `Current: ${mhdKPIs.botSelfResolution}% vs ${cL}: ${mhdKPIs.lmtdBotSelfResolution}%`,
          selfResDelta > 0 ? "Bot is handling more queries end-to-end." : "Review top handover reasons and bot knowledge gaps.",
        ],
        chartData: [
          { label: pL, value: mhdKPIs.botSelfResolution, color: "hsl(220, 70%, 55%)" },
          { label: cL, value: mhdKPIs.lmtdBotSelfResolution, color: "hsl(0, 0%, 75%)" },
        ],
        chartLabel: "Bot Self-Resolution",
        chartValueSuffix: "%",
      },
    });

    // 4. Handover Rate change
    const handoverDelta = mhdKPIs.handoverRate - mhdKPIs.lmtdHandoverRate;
    insights.push({
      id: "mhd-handover-rate",
      icon: Users,
      color: "text-amber-600",
      title: handoverDelta < 0 ? "Handover rate reduced" : "Handover rate increased",
      detail: `Bot→Agent handover is ${mhdKPIs.handoverRate}% (${cL}: ${mhdKPIs.lmtdHandoverRate}%). ${handoverDelta < 0 ? "Fewer handovers reduce agent workload." : "Higher handover may strain agent capacity."}`,
      severity: handoverDelta < 0 ? "good" : "bad",
      impactWeight: handoverDelta < 0 ? 15 : 55,
      priorityBucket: handoverDelta < 0 ? "positive" : "P2",
      expanded: {
        bullets: [
          `Current: ${mhdKPIs.handoverRate}% vs ${cL}: ${mhdKPIs.lmtdHandoverRate}%`,
          handoverDelta < 0 ? "Bot is resolving more before escalation." : "Analyze handover triggers and bot coverage.",
        ],
        chartData: [
          { label: pL, value: mhdKPIs.handoverRate, color: "hsl(40, 80%, 50%)" },
          { label: cL, value: mhdKPIs.lmtdHandoverRate, color: "hsl(0, 0%, 75%)" },
        ],
        chartLabel: "Handover Rate",
        chartValueSuffix: "%",
      },
    });

    // 5. Negative Sentiment level
    const negSentWarn = mhdKPIs.negativeSentiment > 15;
    insights.push({
      id: "mhd-negative-sentiment",
      icon: ThumbsDown,
      color: negSentWarn ? "text-red-600" : "text-muted-foreground",
      title: negSentWarn ? "Negative sentiment above threshold" : "Negative sentiment within range",
      detail: `Negative sentiment is ${mhdKPIs.negativeSentiment}% (positive: ${mhdKPIs.positiveSentiment}%, neutral: ${mhdKPIs.neutralSentiment}%). ${negSentWarn ? "Above 15% — investigate pain points." : "Below 15% — monitor for trends."}`,
      severity: negSentWarn ? "warn" : "info",
      impactWeight: negSentWarn ? 70 : 25,
      priorityBucket: negSentWarn ? "P1" : "P3",
      expanded: {
        bullets: [
          `Negative: ${mhdKPIs.negativeSentiment}%, Positive: ${mhdKPIs.positiveSentiment}%, Neutral: ${mhdKPIs.neutralSentiment}%`,
          negSentWarn ? "Review negative feedback themes and resolution quality." : "Sentiment mix is acceptable; continue monitoring.",
        ],
        chartData: [
          { label: "Positive", value: mhdKPIs.positiveSentiment, color: "hsl(150, 60%, 45%)" },
          { label: "Neutral", value: mhdKPIs.neutralSentiment, color: "hsl(220, 70%, 55%)" },
          { label: "Negative", value: mhdKPIs.negativeSentiment, color: "hsl(350, 65%, 55%)" },
        ],
        chartLabel: "Sentiment Distribution",
        chartValueSuffix: "%",
      },
    });

    // 6. Query Category spikes (>5% growth)
    const spikingCategories = ISSUE_CATEGORIES.filter((c) => c.lmtd > 0 && ((c.count - c.lmtd) / c.lmtd) * 100 > 5);
    if (spikingCategories.length > 0) {
      insights.push({
        id: "mhd-query-category-spikes",
        icon: AlertTriangle,
        color: "text-amber-600",
        title: `${spikingCategories.length} query category(ies) with >5% growth`,
        detail: spikingCategories.map((c) => `${c.name}: +${(((c.count - c.lmtd) / c.lmtd) * 100).toFixed(1)}%`).join("; ") + ". Prioritize root-cause analysis.",
        severity: "warn",
        impactWeight: 65,
        priorityBucket: "P1",
        isEmerging: true,
        expanded: {
          bullets: spikingCategories.flatMap((c) => [
            `${c.name}: ${c.count} (${cL}: ${c.lmtd}) — +${(((c.count - c.lmtd) / c.lmtd) * 100).toFixed(1)}% growth`,
          ]),
          chartData: spikingCategories.map((c, i) => ({
            label: c.name,
            value: Math.round(((c.count - c.lmtd) / c.lmtd) * 100),
            color: COLORS[i % COLORS.length],
          })),
          chartLabel: "Category Growth vs LMTD",
          chartValueSuffix: "%",
        },
      });
    }

    // 7. MHD Funnel Impact (leads & disbursals)
    const leadsGrowth = mhdKPIs.mhdLeadsCreated - mhdKPIs.lmtdMhdLeadsCreated;
    const disbGrowth = mhdKPIs.mhdDisbursals - mhdKPIs.lmtdMhdDisbursals;
    insights.push({
      id: "mhd-funnel-impact",
      icon: Activity,
      color: "text-emerald-600",
      title: "MHD funnel impact: leads & disbursals",
      detail: `${mhdKPIs.mhdLeadsCreated.toLocaleString("en-IN")} leads created via MHD (${mhdKPIs.mhdLeadPct}% of total); ${mhdKPIs.mhdDisbursals.toLocaleString("en-IN")} disbursals (₹${mhdKPIs.mhdDisbursalValue} Cr, ${mhdKPIs.mhdDisbPct}%). ${leadsGrowth > 0 ? "Leads up vs " + cL : "Leads down vs " + cL}; ${disbGrowth > 0 ? "Disbursals up." : "Disbursals down."}`,
      severity: leadsGrowth > 0 && disbGrowth > 0 ? "good" : leadsGrowth < 0 && disbGrowth < 0 ? "bad" : "info",
      impactWeight: leadsGrowth > 0 && disbGrowth > 0 ? 25 : 85,
      priorityBucket: leadsGrowth > 0 && disbGrowth > 0 ? "positive" : leadsGrowth < 0 && disbGrowth < 0 ? "P0" : "P2",
      expanded: {
        bullets: [
          `Leads via MHD: ${mhdKPIs.mhdLeadsCreated.toLocaleString("en-IN")} (${mhdKPIs.mhdLeadPct}%) vs ${cL}: ${mhdKPIs.lmtdMhdLeadsCreated.toLocaleString("en-IN")}`,
          `Disbursals via MHD: ${mhdKPIs.mhdDisbursals.toLocaleString("en-IN")} (₹${mhdKPIs.mhdDisbursalValue} Cr) vs ${cL}: ${mhdKPIs.lmtdMhdDisbursals.toLocaleString("en-IN")}`,
          `Bot funnel advance: ${mhdKPIs.botFunnelAdvance.toLocaleString("en-IN")} leads moved ahead (₹${mhdKPIs.botFunnelAdvanceValue} Cr est.)`,
        ],
        chartData: [
          { label: "MHD Leads", value: mhdKPIs.mhdLeadsCreated, color: "hsl(220, 70%, 55%)" },
          { label: "MHD Disbursals", value: mhdKPIs.mhdDisbursals, color: "hsl(150, 60%, 45%)" },
          { label: "Bot Funnel Advance", value: mhdKPIs.botFunnelAdvance, color: "hsl(40, 80%, 50%)" },
        ],
        chartLabel: "MHD Funnel Metrics",
        chartValueSuffix: "",
      },
    });

    // 8. TAT improvements
    const tatResImproved = mhdKPIs.tatQueryResolution < mhdKPIs.lmtdTatQueryResolution;
    const tatFirstImproved = mhdKPIs.tatFirstResponse < mhdKPIs.lmtdTatFirstResponse;
    insights.push({
      id: "mhd-tat-improvements",
      icon: Clock,
      color: "text-orange-600",
      title: tatResImproved || tatFirstImproved ? "TAT improvements" : "TAT regressions",
      detail: `Query resolution TAT: ${mhdKPIs.tatQueryResolution}h (${cL}: ${mhdKPIs.lmtdTatQueryResolution}h). First response: ${mhdKPIs.tatFirstResponse}m (${cL}: ${mhdKPIs.lmtdTatFirstResponse}m). ${tatResImproved ? "Faster resolution." : "Slower resolution."} ${tatFirstImproved ? "Faster first reply." : "Slower first reply."}`,
      severity: tatResImproved && tatFirstImproved ? "good" : !tatResImproved && !tatFirstImproved ? "bad" : "warn",
      impactWeight: tatResImproved && tatFirstImproved ? 15 : 50,
      priorityBucket: tatResImproved && tatFirstImproved ? "positive" : "P2",
      expanded: {
        bullets: [
          `Query resolution TAT: ${mhdKPIs.tatQueryResolution}h vs ${cL}: ${mhdKPIs.lmtdTatQueryResolution}h`,
          `First response: ${mhdKPIs.tatFirstResponse}m vs ${cL}: ${mhdKPIs.lmtdTatFirstResponse}m`,
          `Disbursal TAT from lead: ${mhdKPIs.tatDisbursalFromLead}d vs ${cL}: ${mhdKPIs.lmtdTatDisbursalFromLead}d`,
        ],
        chartData: [
          { label: "Query Resolution (h)", value: mhdKPIs.tatQueryResolution, color: "hsl(25, 95%, 53%)" },
          { label: "First Response (m)", value: mhdKPIs.tatFirstResponse, color: "hsl(330, 80%, 55%)" },
          { label: "Disbursal from Lead (d)", value: mhdKPIs.tatDisbursalFromLead, color: "hsl(220, 70%, 55%)" },
        ],
        chartLabel: "TAT Metrics",
        chartValueSuffix: "",
      },
    });

    // 9. IVR metrics
    const ivrSelfImproved = mhdKPIs.ivrSelfResolution > mhdKPIs.lmtdIvrSelfResolution;
    const ivrHandoverLower = mhdKPIs.ivrToAgentHandover < mhdKPIs.lmtdIvrToAgentHandover;
    insights.push({
      id: "mhd-ivr-metrics",
      icon: Headphones,
      color: "text-violet-600",
      title: ivrSelfImproved ? "IVR self-resolution improved" : "IVR metrics need attention",
      detail: `IVR inflow: ${mhdKPIs.ivrInflow.toLocaleString("en-IN")}. Self-resolution: ${mhdKPIs.ivrSelfResolution}% (${cL}: ${mhdKPIs.lmtdIvrSelfResolution}%). IVR→Agent handover: ${mhdKPIs.ivrToAgentHandover}% (${cL}: ${mhdKPIs.lmtdIvrToAgentHandover}%).`,
      severity: ivrSelfImproved && ivrHandoverLower ? "good" : !ivrSelfImproved && !ivrHandoverLower ? "bad" : "info",
      impactWeight: ivrSelfImproved && ivrHandoverLower ? 15 : 45,
      priorityBucket: ivrSelfImproved && ivrHandoverLower ? "positive" : "P2",
      expanded: {
        bullets: [
          `IVR inflow: ${mhdKPIs.ivrInflow.toLocaleString("en-IN")} vs ${cL}: ${mhdKPIs.lmtdIvrInflow.toLocaleString("en-IN")}`,
          `IVR self-resolution: ${mhdKPIs.ivrSelfResolution}% vs ${cL}: ${mhdKPIs.lmtdIvrSelfResolution}%`,
          `IVR→Agent handover: ${mhdKPIs.ivrToAgentHandover}% vs ${cL}: ${mhdKPIs.lmtdIvrToAgentHandover}%`,
        ],
        chartData: [
          { label: "IVR Self-Resolution", value: mhdKPIs.ivrSelfResolution, color: "hsl(150, 60%, 45%)" },
          { label: "IVR→Agent Handover", value: mhdKPIs.ivrToAgentHandover, color: "hsl(40, 80%, 50%)" },
        ],
        chartLabel: "IVR Metrics",
        chartValueSuffix: "%",
      },
    });

    // 10. Agent metrics
    const agentResImproved = mhdKPIs.agentResolutionRate > mhdKPIs.lmtdAgentResolutionRate;
    insights.push({
      id: "mhd-agent-metrics",
      icon: CheckCircle2,
      color: "text-emerald-600",
      title: agentResImproved ? "Agent resolution rate improved" : "Agent resolution rate declined",
      detail: `Agent inflow: ${mhdKPIs.agentInflow.toLocaleString("en-IN")} (${cL}: ${mhdKPIs.lmtdAgentInflow.toLocaleString("en-IN")}). Resolution rate: ${mhdKPIs.agentResolutionRate}% (${cL}: ${mhdKPIs.lmtdAgentResolutionRate}%).`,
      severity: agentResImproved ? "good" : "bad",
      impactWeight: agentResImproved ? 15 : 40,
      priorityBucket: agentResImproved ? "positive" : "P3",
      expanded: {
        bullets: [
          `Agent inflow: ${mhdKPIs.agentInflow.toLocaleString("en-IN")} vs ${cL}: ${mhdKPIs.lmtdAgentInflow.toLocaleString("en-IN")}`,
          `Resolution rate: ${mhdKPIs.agentResolutionRate}% vs ${cL}: ${mhdKPIs.lmtdAgentResolutionRate}%`,
        ],
        chartData: [
          { label: pL, value: mhdKPIs.agentResolutionRate, color: "hsl(150, 60%, 45%)" },
          { label: cL, value: mhdKPIs.lmtdAgentResolutionRate, color: "hsl(0, 0%, 75%)" },
        ],
        chartLabel: "Agent Resolution Rate",
        chartValueSuffix: "%",
      },
    });

    return insights;
  }, [mhdKPIs, pL, cL]);

  // ─── Chatbot handler ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-muted-foreground animate-pulse">Loading MHD data...</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="MHD & Channels"
        description="Merchant Help Desk performance, Bot analytics, channel contribution & customer success metrics"
      />

      <div className="p-6 space-y-6">
        {/* ─── Section Toggle ────────────────────────────────────────────── */}
        <div className="flex items-center gap-2">
          <button
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-semibold transition-colors",
              activeView === "mhd"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
            onClick={() => setActiveView("mhd")}
          >
            <Headphones className="h-3.5 w-3.5 inline mr-1.5" />
            Merchant Help Desk
          </button>
          <button
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-semibold transition-colors",
              activeView === "channels"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
            onClick={() => setActiveView("channels")}
          >
            <Globe className="h-3.5 w-3.5 inline mr-1.5" />
            Channels
          </button>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ═══ SECTION: MERCHANT HELP DESK ══════════════════════════════════ */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {activeView === "mhd" && (
          <div className="space-y-6">
            {/* ─── Major KPIs ────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <ClickableKpiCard
                onClick={() =>
                  setKpiDive({
                    open: true,
                    config: {
                      title: "Contact Ratio",
                      metric: `${mhdKPIs.contactRatio} per 1K`,
                      subtitle: "Contacts per 1,000 workable leads",
                      sections: [
                        {
                          title: "Comparison",
                          type: "kpi-row",
                          kpis: [
                            { label: pL, value: mhdKPIs.contactRatio, sub: "per 1K leads" },
                            { label: cL, value: mhdKPIs.lmtdContactRatio, sub: "per 1K leads" },
                            {
                              label: "Change",
                              value: `${(mhdKPIs.contactRatio - mhdKPIs.lmtdContactRatio).toFixed(1)}`,
                              color: mhdKPIs.contactRatio <= mhdKPIs.lmtdContactRatio ? "text-emerald-600" : "text-red-600",
                            },
                          ],
                        },
                        {
                          title: "Contact Breakdown",
                          type: "kpi-row",
                          kpis: [
                            { label: "Total Contacts", value: mhdKPIs.totalContacts.toLocaleString("en-IN") },
                            { label: "Bot Sessions", value: mhdKPIs.totalBotSessions.toLocaleString("en-IN") },
                            { label: "Agent Sessions", value: mhdKPIs.totalAgentSessions.toLocaleString("en-IN") },
                          ],
                        },
                        {
                          title: "Insights",
                          type: "bullets",
                          bullets: [
                            `Contact ratio ${mhdKPIs.contactRatio <= mhdKPIs.lmtdContactRatio ? "improved" : "increased"} from ${mhdKPIs.lmtdContactRatio} to ${mhdKPIs.contactRatio}`,
                            `Total contacts: ${mhdKPIs.totalContacts.toLocaleString("en-IN")} (Bot: ${mhdKPIs.totalBotSessions.toLocaleString("en-IN")}, Agent: ${mhdKPIs.totalAgentSessions.toLocaleString("en-IN")})`,
                          ],
                        },
                      ],
                    },
                  })
                }
              >
                <MajorKPI
                  label="Contact Ratio"
                  value={`${mhdKPIs.contactRatio}`}
                  subtitle="per 1K workable leads"
                  lmtd={mhdKPIs.lmtdContactRatio}
                  lmtdLabel={`${mhdKPIs.lmtdContactRatio}`}
                  compareLabel={cL}
                  isBetter={mhdKPIs.contactRatio < mhdKPIs.lmtdContactRatio}
                  icon={<Phone className="h-4 w-4 text-violet-600" />}
                  major
                />
              </ClickableKpiCard>
              <ClickableKpiCard
                onClick={() =>
                  setKpiDive({
                    open: true,
                    config: {
                      title: "Bot MSAT",
                      metric: `${mhdKPIs.botMSAT} / 5.0`,
                      subtitle: "Bot Mean Satisfaction Score",
                      sections: [
                        {
                          title: "Comparison",
                          type: "kpi-row",
                          kpis: [
                            { label: pL, value: mhdKPIs.botMSAT, sub: "/ 5.0" },
                            { label: cL, value: mhdKPIs.lmtdBotMSAT, sub: "/ 5.0" },
                            {
                              label: "Change",
                              value: `${(mhdKPIs.botMSAT - mhdKPIs.lmtdBotMSAT).toFixed(1)}`,
                              color: mhdKPIs.botMSAT >= mhdKPIs.lmtdBotMSAT ? "text-emerald-600" : "text-red-600",
                            },
                          ],
                        },
                        {
                          title: "Sentiment Breakdown",
                          type: "kpi-row",
                          kpis: [
                            { label: "Positive", value: `${mhdKPIs.positiveSentiment}%`, color: "text-emerald-600" },
                            { label: "Neutral", value: `${mhdKPIs.neutralSentiment}%`, color: "text-blue-600" },
                            { label: "Negative", value: `${mhdKPIs.negativeSentiment}%`, color: "text-red-600" },
                          ],
                        },
                        {
                          title: "Chart",
                          type: "chart",
                          chart: {
                            type: "bar",
                            data: [
                              { name: pL, value: mhdKPIs.botMSAT, color: "hsl(150, 60%, 45%)" },
                              { name: cL, value: mhdKPIs.lmtdBotMSAT, color: "hsl(0, 0%, 75%)" },
                            ],
                            label: "MSAT",
                            valueSuffix: "/5",
                          },
                        },
                        {
                          title: "Insights",
                          type: "bullets",
                          bullets: [
                            `Bot MSAT ${mhdKPIs.botMSAT >= mhdKPIs.lmtdBotMSAT ? "improved" : "declined"} from ${mhdKPIs.lmtdBotMSAT} to ${mhdKPIs.botMSAT} out of 5.0`,
                            `Sentiment: ${mhdKPIs.positiveSentiment}% positive, ${mhdKPIs.neutralSentiment}% neutral, ${mhdKPIs.negativeSentiment}% negative`,
                          ],
                        },
                      ],
                    },
                  })
                }
              >
                <MajorKPI
                  label="Bot MSAT"
                  value={`${mhdKPIs.botMSAT}`}
                  subtitle="out of 5.0"
                  lmtd={mhdKPIs.lmtdBotMSAT}
                  lmtdLabel={`${mhdKPIs.lmtdBotMSAT}`}
                  compareLabel={cL}
                  isBetter={mhdKPIs.botMSAT > mhdKPIs.lmtdBotMSAT}
                  icon={<ThumbsUp className="h-4 w-4 text-emerald-600" />}
                  major
                />
              </ClickableKpiCard>
              <ClickableKpiCard
                onClick={() =>
                  setKpiDive({
                    open: true,
                    config: {
                      title: "Bot Self-Resolution",
                      metric: `${mhdKPIs.botSelfResolution}%`,
                      subtitle: "Queries resolved by bot without agent handover",
                      sections: [
                        {
                          title: "Comparison",
                          type: "kpi-row",
                          kpis: [
                            { label: pL, value: `${mhdKPIs.botSelfResolution}%` },
                            { label: cL, value: `${mhdKPIs.lmtdBotSelfResolution}%` },
                            {
                              label: "Change",
                              value: `${(mhdKPIs.botSelfResolution - mhdKPIs.lmtdBotSelfResolution).toFixed(1)}%`,
                              color: mhdKPIs.botSelfResolution >= mhdKPIs.lmtdBotSelfResolution ? "text-emerald-600" : "text-red-600",
                            },
                          ],
                        },
                        {
                          title: "Resolution Stats",
                          type: "kpi-row",
                          kpis: [
                            { label: "Total Resolved", value: mhdKPIs.totalResolved.toLocaleString("en-IN") },
                            { label: "Bot Sessions", value: mhdKPIs.totalBotSessions.toLocaleString("en-IN") },
                            { label: "Resolution Rate", value: `${mhdKPIs.botSelfResolution}%` },
                          ],
                        },
                        {
                          title: "Chart",
                          type: "chart",
                          chart: {
                            type: "bar",
                            data: [
                              { name: pL, value: mhdKPIs.botSelfResolution, color: "hsl(220, 70%, 55%)" },
                              { name: cL, value: mhdKPIs.lmtdBotSelfResolution, color: "hsl(0, 0%, 75%)" },
                            ],
                            label: "Self-Resolution",
                            valueSuffix: "%",
                          },
                        },
                        {
                          title: "Insights",
                          type: "bullets",
                          bullets: [
                            `Self-resolution ${mhdKPIs.botSelfResolution >= mhdKPIs.lmtdBotSelfResolution ? "improved" : "declined"} from ${mhdKPIs.lmtdBotSelfResolution}% to ${mhdKPIs.botSelfResolution}%`,
                            `${mhdKPIs.totalResolved.toLocaleString("en-IN")} queries resolved out of ${mhdKPIs.totalBotSessions.toLocaleString("en-IN")} bot sessions`,
                          ],
                        },
                      ],
                    },
                  })
                }
              >
                <MajorKPI
                  label="Bot Self-Resolution"
                  value={`${mhdKPIs.botSelfResolution}%`}
                  subtitle=""
                  lmtd={mhdKPIs.lmtdBotSelfResolution}
                  lmtdLabel={`${mhdKPIs.lmtdBotSelfResolution}%`}
                  compareLabel={cL}
                  isBetter={mhdKPIs.botSelfResolution > mhdKPIs.lmtdBotSelfResolution}
                  icon={<Bot className="h-4 w-4 text-blue-600" />}
                />
              </ClickableKpiCard>
              <ClickableKpiCard
                onClick={() =>
                  setKpiDive({
                    open: true,
                    config: {
                      title: "Bot→Agent Handover",
                      metric: `${mhdKPIs.handoverRate}%`,
                      subtitle: "Bot sessions escalated to agent",
                      sections: [
                        {
                          title: "Comparison",
                          type: "kpi-row",
                          kpis: [
                            { label: pL, value: `${mhdKPIs.handoverRate}%` },
                            { label: cL, value: `${mhdKPIs.lmtdHandoverRate}%` },
                            {
                              label: "Change",
                              value: `${(mhdKPIs.handoverRate - mhdKPIs.lmtdHandoverRate).toFixed(1)}%`,
                              color: mhdKPIs.handoverRate <= mhdKPIs.lmtdHandoverRate ? "text-emerald-600" : "text-red-600",
                            },
                          ],
                        },
                        {
                          title: "Handover Trends",
                          type: "kpi-row",
                          kpis: [
                            { label: "Agent Sessions", value: mhdKPIs.totalAgentSessions.toLocaleString("en-IN") },
                            { label: "Bot Sessions", value: mhdKPIs.totalBotSessions.toLocaleString("en-IN") },
                            { label: "Handover Rate", value: `${mhdKPIs.handoverRate}%` },
                          ],
                        },
                        {
                          title: "Chart",
                          type: "chart",
                          chart: {
                            type: "bar",
                            data: [
                              { name: pL, value: mhdKPIs.handoverRate, color: "hsl(40, 80%, 50%)" },
                              { name: cL, value: mhdKPIs.lmtdHandoverRate, color: "hsl(0, 0%, 75%)" },
                            ],
                            label: "Handover Rate",
                            valueSuffix: "%",
                          },
                        },
                        {
                          title: "Insights",
                          type: "bullets",
                          bullets: [
                            `Handover rate ${mhdKPIs.handoverRate <= mhdKPIs.lmtdHandoverRate ? "reduced" : "increased"} from ${mhdKPIs.lmtdHandoverRate}% to ${mhdKPIs.handoverRate}%`,
                            `${mhdKPIs.totalAgentSessions.toLocaleString("en-IN")} agent sessions from ${mhdKPIs.totalBotSessions.toLocaleString("en-IN")} bot sessions`,
                          ],
                        },
                      ],
                    },
                  })
                }
              >
                <MajorKPI
                  label="Bot→Agent Handover"
                  value={`${mhdKPIs.handoverRate}%`}
                  subtitle=""
                  lmtd={mhdKPIs.lmtdHandoverRate}
                  lmtdLabel={`${mhdKPIs.lmtdHandoverRate}%`}
                  compareLabel={cL}
                  isBetter={mhdKPIs.handoverRate < mhdKPIs.lmtdHandoverRate}
                  icon={<Users className="h-4 w-4 text-amber-600" />}
                />
              </ClickableKpiCard>
              <ClickableKpiCard
                onClick={() =>
                  setKpiDive({
                    open: true,
                    config: {
                      title: "Query Resolution TAT",
                      metric: `${mhdKPIs.tatQueryResolution}h`,
                      subtitle: "Average time from query raised to solved",
                      sections: [
                        {
                          title: "Comparison",
                          type: "kpi-row",
                          kpis: [
                            { label: pL, value: `${mhdKPIs.tatQueryResolution}h` },
                            { label: cL, value: `${mhdKPIs.lmtdTatQueryResolution}h` },
                            {
                              label: "Change",
                              value: `${(mhdKPIs.tatQueryResolution - mhdKPIs.lmtdTatQueryResolution).toFixed(1)}h`,
                              color: mhdKPIs.tatQueryResolution <= mhdKPIs.lmtdTatQueryResolution ? "text-emerald-600" : "text-red-600",
                            },
                          ],
                        },
                        {
                          title: "All TAT Metrics",
                          type: "kpi-row",
                          kpis: [
                            { label: "Query Resolution", value: `${mhdKPIs.tatQueryResolution}h`, sub: pL },
                            { label: "First Response", value: `${mhdKPIs.tatFirstResponse}m`, sub: pL },
                            { label: "Disbursal from Lead", value: `${mhdKPIs.tatDisbursalFromLead}d`, sub: pL },
                            { label: "Query Resolution", value: `${mhdKPIs.lmtdTatQueryResolution}h`, sub: cL },
                          ],
                        },
                        {
                          title: "Chart",
                          type: "chart",
                          chart: {
                            type: "bar",
                            data: [
                              { name: "Query Res (h)", value: mhdKPIs.tatQueryResolution, color: "hsl(25, 95%, 53%)" },
                              { name: "First Resp (m)", value: mhdKPIs.tatFirstResponse, color: "hsl(330, 80%, 55%)" },
                              { name: "Disbursal (d)", value: mhdKPIs.tatDisbursalFromLead, color: "hsl(220, 70%, 55%)" },
                            ],
                            label: "TAT",
                            valueSuffix: "",
                          },
                        },
                        {
                          title: "Insights",
                          type: "bullets",
                          bullets: [
                            `Query resolution TAT ${mhdKPIs.tatQueryResolution <= mhdKPIs.lmtdTatQueryResolution ? "improved" : "increased"} from ${mhdKPIs.lmtdTatQueryResolution}h to ${mhdKPIs.tatQueryResolution}h`,
                            `First response: ${mhdKPIs.tatFirstResponse}m, Disbursal from lead: ${mhdKPIs.tatDisbursalFromLead} days`,
                          ],
                        },
                      ],
                    },
                  })
                }
              >
                <MajorKPI
                  label="Query Resolution TAT"
                  value={`${mhdKPIs.tatQueryResolution}h`}
                  subtitle="avg raised → solved"
                  lmtd={mhdKPIs.lmtdTatQueryResolution}
                  lmtdLabel={`${mhdKPIs.lmtdTatQueryResolution}h`}
                  compareLabel={cL}
                  isBetter={mhdKPIs.tatQueryResolution < mhdKPIs.lmtdTatQueryResolution}
                  icon={<Clock className="h-4 w-4 text-orange-600" />}
                />
              </ClickableKpiCard>
              <ClickableKpiCard
                onClick={() =>
                  setKpiDive({
                    open: true,
                    config: {
                      title: "First Response Time",
                      metric: `${mhdKPIs.tatFirstResponse}m`,
                      subtitle: "Average time to first reply",
                      sections: [
                        {
                          title: "Comparison",
                          type: "kpi-row",
                          kpis: [
                            { label: pL, value: `${mhdKPIs.tatFirstResponse}m` },
                            { label: cL, value: `${mhdKPIs.lmtdTatFirstResponse}m` },
                            {
                              label: "Change",
                              value: `${(mhdKPIs.tatFirstResponse - mhdKPIs.lmtdTatFirstResponse).toFixed(0)}m`,
                              color: mhdKPIs.tatFirstResponse <= mhdKPIs.lmtdTatFirstResponse ? "text-emerald-600" : "text-red-600",
                            },
                          ],
                        },
                        {
                          title: "Response Metrics",
                          type: "kpi-row",
                          kpis: [
                            { label: "First Response", value: `${mhdKPIs.tatFirstResponse}m`, sub: pL },
                            { label: "First Response", value: `${mhdKPIs.lmtdTatFirstResponse}m`, sub: cL },
                            { label: "Query Resolution TAT", value: `${mhdKPIs.tatQueryResolution}h`, sub: "raised → solved" },
                          ],
                        },
                        {
                          title: "Chart",
                          type: "chart",
                          chart: {
                            type: "bar",
                            data: [
                              { name: pL, value: mhdKPIs.tatFirstResponse, color: "hsl(330, 80%, 55%)" },
                              { name: cL, value: mhdKPIs.lmtdTatFirstResponse, color: "hsl(0, 0%, 75%)" },
                            ],
                            label: "First Response",
                            valueSuffix: "m",
                          },
                        },
                        {
                          title: "Insights",
                          type: "bullets",
                          bullets: [
                            `First response time ${mhdKPIs.tatFirstResponse <= mhdKPIs.lmtdTatFirstResponse ? "improved" : "increased"} from ${mhdKPIs.lmtdTatFirstResponse}m to ${mhdKPIs.tatFirstResponse}m`,
                            `Query resolution TAT: ${mhdKPIs.tatQueryResolution}h (raised → solved)`,
                          ],
                        },
                      ],
                    },
                  })
                }
              >
                <MajorKPI
                  label="First Response Time"
                  value={`${mhdKPIs.tatFirstResponse}m`}
                  subtitle="avg time to first reply"
                  lmtd={mhdKPIs.lmtdTatFirstResponse}
                  lmtdLabel={`${mhdKPIs.lmtdTatFirstResponse}m`}
                  compareLabel={cL}
                  isBetter={mhdKPIs.tatFirstResponse < mhdKPIs.lmtdTatFirstResponse}
                  icon={<Zap className="h-4 w-4 text-pink-600" />}
                />
              </ClickableKpiCard>
            </div>

            {/* ─── Sentiment + IVR + Agent Row ───────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Sentiment Analysis */}
              <Card>
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Bot Sentiment Analysis</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="space-y-2">
                    <SentimentBar label="Positive" pct={mhdKPIs.positiveSentiment} color="bg-emerald-500" />
                    <SentimentBar label="Neutral" pct={mhdKPIs.neutralSentiment} color="bg-blue-400" />
                    <SentimentBar label="Negative" pct={mhdKPIs.negativeSentiment} color="bg-red-500" />
                  </div>
                </CardContent>
              </Card>

              {/* IVR Metrics */}
              <Card>
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">IVR Metrics</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-muted-foreground">Inflow on IVR</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold tabular-nums">{mhdKPIs.ivrInflow.toLocaleString("en-IN")}</span>
                      <span className="text-[9px] text-muted-foreground">{cL}: {mhdKPIs.lmtdIvrInflow.toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-muted-foreground">Self-Resolution Rate</span>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">{mhdKPIs.ivrSelfResolution}%</Badge>
                      <span className="text-[9px] text-muted-foreground">{cL}: {mhdKPIs.lmtdIvrSelfResolution}%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-muted-foreground">IVR→Agent Handover</span>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">{mhdKPIs.ivrToAgentHandover}%</Badge>
                      <span className="text-[9px] text-muted-foreground">{cL}: {mhdKPIs.lmtdIvrToAgentHandover}%</span>
                    </div>
                  </div>
                  <Separator className="my-1" />
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-medium">Disbursal TAT from Lead</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-violet-600">{mhdKPIs.tatDisbursalFromLead} days</span>
                      <span className="text-[9px] text-muted-foreground">{cL}: {mhdKPIs.lmtdTatDisbursalFromLead}d</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Agent Metrics */}
              <Card>
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">MHD Agent Metrics</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-muted-foreground">Inflow on MHD Agent</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold tabular-nums">{mhdKPIs.agentInflow.toLocaleString("en-IN")}</span>
                      <span className="text-[9px] text-muted-foreground">{cL}: {mhdKPIs.lmtdAgentInflow.toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-muted-foreground">Resolution Rate</span>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">{mhdKPIs.agentResolutionRate}%</Badge>
                      <span className="text-[9px] text-muted-foreground">{cL}: {mhdKPIs.lmtdAgentResolutionRate}%</span>
                    </div>
                  </div>
                  <Separator className="my-1" />
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-medium">Leads Created via MHD</span>
                    <div className="text-right">
                      <span className="text-xs font-bold tabular-nums">{mhdKPIs.mhdLeadsCreated.toLocaleString("en-IN")}</span>
                      <span className="text-[9px] text-muted-foreground ml-1">({mhdKPIs.mhdLeadPct}%)</span>
                      <span className={cn("text-[9px] font-bold ml-1", mhdKPIs.mhdLeadsCreated > mhdKPIs.lmtdMhdLeadsCreated ? "text-emerald-600" : "text-red-600")}>
                        {mhdKPIs.mhdLeadsCreated > mhdKPIs.lmtdMhdLeadsCreated ? "↑" : "↓"} {cL}: {mhdKPIs.lmtdMhdLeadsCreated.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-medium">Disbursals via MHD</span>
                    <div className="text-right">
                      <span className="text-xs font-bold tabular-nums text-emerald-600">{mhdKPIs.mhdDisbursals.toLocaleString("en-IN")}</span>
                      <span className="text-[9px] text-muted-foreground ml-1">(₹{mhdKPIs.mhdDisbursalValue} Cr · {mhdKPIs.mhdDisbPct}%)</span>
                      <span className={cn("text-[9px] font-bold ml-1", mhdKPIs.mhdDisbursals > mhdKPIs.lmtdMhdDisbursals ? "text-emerald-600" : "text-red-600")}>
                        {mhdKPIs.mhdDisbursals > mhdKPIs.lmtdMhdDisbursals ? "↑" : "↓"} {cL}: {mhdKPIs.lmtdMhdDisbursals.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-medium">Bot → Funnel Advance</span>
                    <div className="text-right">
                      <span className="text-xs font-bold tabular-nums text-blue-600">{mhdKPIs.botFunnelAdvance.toLocaleString("en-IN")}</span>
                      <span className="text-[9px] text-muted-foreground ml-1">(₹{mhdKPIs.botFunnelAdvanceValue} Cr est.)</span>
                      <span className={cn("text-[9px] font-bold ml-1", mhdKPIs.botFunnelAdvance > mhdKPIs.lmtdBotFunnelAdvance ? "text-emerald-600" : "text-red-600")}>
                        {mhdKPIs.botFunnelAdvance > mhdKPIs.lmtdBotFunnelAdvance ? "↑" : "↓"} {cL}: {mhdKPIs.lmtdBotFunnelAdvance.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <RichInsightPanel title="MHD & Channels Insights" insights={mhdInsights} pageName="MHD & Channels" />

            <Separator />

            {/* ─── Issue Categories — Compact Table with Drill-down ────── */}
            <div id="mhd-categories">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-muted-foreground" />
                    Merchant Loan Query Categories
                  </h2>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {mhdKPIs.totalCategories.toLocaleString("en-IN")} queries across {ISSUE_CATEGORIES.length} categories — click any row to drill down (L1→L2→L3→L4)
                  </p>
                </div>
                <button
                  className="flex items-center gap-1.5 text-[9px] font-medium text-blue-600 hover:text-blue-800 border border-blue-200 rounded-md px-2 py-1 bg-blue-50/50 hover:bg-blue-50 transition-colors cursor-pointer"
                  onClick={() => {
                    setL2l3Mode(l2l3Mode === "program-lender" ? "lender-program" : "program-lender");
                    setExpandedL2(null);
                    setExpandedL3(null);
                  }}
                >
                  <ArrowRight className="h-2.5 w-2.5" />
                  L2={l2l3Mode === "program-lender" ? "Program" : "Lender"} → L3={l2l3Mode === "program-lender" ? "Lender" : "Program"} (click to swap)
                </button>
              </div>
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-xs font-semibold w-8"></TableHead>
                        <TableHead className="text-xs font-semibold">Category / Breakdown</TableHead>
                        <TableHead className="text-xs font-semibold text-right">{pL}</TableHead>
                        <TableHead className="text-xs font-semibold text-right">{cL}</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Change</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Share</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ISSUE_CATEGORIES.map((cat) => {
                        const isExpanded = expandedCategory === cat.name;
                        const growth = cat.lmtd > 0 ? ((cat.count - cat.lmtd) / cat.lmtd) * 100 : 0;

                        const seed = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0; return Math.abs(h); };
                        const programs = LOAN_PROGRAMS.map((prog, pi) => {
                          const share = [0.28, 0.22, 0.14, 0.12, 0.08, 0.07, 0.05, 0.04][pi] || 0.04;
                          const noise = 0.9 + (seed(cat.name + prog) % 20) / 100;
                          return { name: prog, count: Math.round(cat.count * share * noise), lmtd: Math.round(cat.lmtd * share * (0.92 + (seed(prog + cat.name) % 16) / 100)) };
                        });
                        const lenders = MHD_LENDERS.map((lndr, li) => {
                          const share = [0.22, 0.18, 0.15, 0.12, 0.10, 0.09, 0.08, 0.06][li] || 0.06;
                          const noise = 0.88 + (seed(cat.name + lndr) % 24) / 100;
                          return { name: lndr, count: Math.round(cat.count * share * noise), lmtd: Math.round(cat.lmtd * share * (0.90 + (seed(lndr + cat.name) % 18) / 100)) };
                        });
                        const l2Items = l2l3Mode === "program-lender" ? programs : lenders;
                        const l3Items = l2l3Mode === "program-lender" ? lenders : programs;
                        const l3Label = l2l3Mode === "program-lender" ? "Lender" : "Program Type";

                        return (
                          <React.Fragment key={cat.name}>
                            {/* L1: Category Row */}
                            <TableRow
                              className={cn("transition-colors cursor-pointer hover:bg-muted/40", isExpanded && "bg-muted/30 border-b-0")}
                              onClick={() => { setExpandedCategory(isExpanded ? null : cat.name); setExpandedL2(null); setExpandedL3(null); }}
                            >
                              <TableCell className="w-8 py-2.5">
                                {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                              </TableCell>
                              <TableCell className="py-2.5">
                                <span className="text-sm font-medium">{cat.name}</span>
                              </TableCell>
                              <TableCell className="text-sm text-right tabular-nums font-medium py-2.5">{cat.count.toLocaleString("en-IN")}</TableCell>
                              <TableCell className="text-sm text-right tabular-nums text-muted-foreground py-2.5">{cat.lmtd.toLocaleString("en-IN")}</TableCell>
                              <TableCell className="text-right py-2.5">
                                <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold rounded-full px-2 py-0.5",
                                  growth > 0 ? "bg-red-50 text-red-700" : growth < 0 ? "bg-emerald-50 text-emerald-700" : "bg-gray-50 text-gray-600"
                                )}>
                                  {growth > 0 ? "+" : ""}{growth.toFixed(1)}%
                                </span>
                              </TableCell>
                              <TableCell className="text-sm text-right tabular-nums py-2.5">{cat.pct}%</TableCell>
                            </TableRow>

                            {/* L2 header */}
                            {isExpanded && (
                              <TableRow className="bg-muted/20 border-b-0">
                                <TableCell className="py-1.5"></TableCell>
                                <TableCell colSpan={5} className="py-1.5 pl-8">
                                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                    L2: By {l2l3Mode === "program-lender" ? "Program Type" : "Lender"}
                                  </span>
                                </TableCell>
                              </TableRow>
                            )}

                            {/* L2 rows */}
                            {isExpanded && l2Items.map((l2Row) => {
                              const l2Growth = l2Row.lmtd > 0 ? ((l2Row.count - l2Row.lmtd) / l2Row.lmtd) * 100 : 0;
                              const l2RowKey = `${cat.name}--${l2Row.name}`;
                              const isL2Expanded = expandedL2 === l2RowKey;
                              return (
                                <React.Fragment key={l2Row.name}>
                                  <TableRow
                                    className={cn("bg-muted/10 hover:bg-muted/20 cursor-pointer border-b border-dashed border-border/50", isL2Expanded && "border-b-0")}
                                    onClick={() => { setExpandedL2(isL2Expanded ? null : l2RowKey); setExpandedL3(null); }}
                                  >
                                    <TableCell className="w-8 py-2 pl-6">
                                      {isL2Expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                                    </TableCell>
                                    <TableCell className="py-2 pl-8">
                                      <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                                        <span className="text-xs font-medium">{l2Row.name}</span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-xs text-right tabular-nums font-medium py-2">{l2Row.count.toLocaleString("en-IN")}</TableCell>
                                    <TableCell className="text-xs text-right tabular-nums text-muted-foreground py-2">{l2Row.lmtd.toLocaleString("en-IN")}</TableCell>
                                    <TableCell className="text-right py-2">
                                      <span className={cn("inline-flex items-center text-[11px] font-semibold rounded-full px-1.5 py-0.5",
                                        l2Growth > 5 ? "bg-red-50 text-red-700" : l2Growth < -5 ? "bg-emerald-50 text-emerald-700" : "bg-gray-50 text-gray-600"
                                      )}>
                                        {l2Growth > 0 ? "+" : ""}{l2Growth.toFixed(1)}%
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-xs text-right tabular-nums py-2">
                                      {cat.count > 0 ? ((l2Row.count / cat.count) * 100).toFixed(1) : 0}%
                                    </TableCell>
                                  </TableRow>

                                  {/* L3 header */}
                                  {isL2Expanded && (
                                    <TableRow className="bg-indigo-50/30 border-b-0">
                                      <TableCell className="py-1"></TableCell>
                                      <TableCell colSpan={5} className="py-1 pl-12">
                                        <span className="text-[9px] font-semibold text-indigo-700 uppercase tracking-wider">L3: By {l3Label}</span>
                                      </TableCell>
                                    </TableRow>
                                  )}

                                  {/* L3 rows */}
                                  {isL2Expanded && l3Items.map((l3Row) => {
                                    const l3Count = Math.round(l2Row.count * (l3Row.count / cat.count) * (0.85 + (seed(l2Row.name + l3Row.name) % 30) / 100));
                                    const l3Lmtd = Math.round(l2Row.lmtd * (l3Row.lmtd / Math.max(1, cat.lmtd)) * (0.85 + (seed(l3Row.name + l2Row.name) % 30) / 100));
                                    const l3Growth = l3Lmtd > 0 ? ((l3Count - l3Lmtd) / l3Lmtd) * 100 : 0;
                                    const l3RowKey = `${l2RowKey}--${l3Row.name}`;
                                    const isL3Expanded = expandedL3 === l3RowKey;
                                    return (
                                      <React.Fragment key={l3Row.name}>
                                        <TableRow
                                          className="bg-indigo-50/10 hover:bg-indigo-50/20 cursor-pointer border-b border-dotted border-border/30"
                                          onClick={() => setExpandedL3(isL3Expanded ? null : l3RowKey)}
                                        >
                                          <TableCell className="w-8 py-1.5 pl-10">
                                            {isL3Expanded ? <ChevronDown className="h-2.5 w-2.5 text-muted-foreground" /> : <ChevronRight className="h-2.5 w-2.5 text-muted-foreground" />}
                                          </TableCell>
                                          <TableCell className="text-[11px] font-medium pl-14 py-1.5">
                                            <div className="flex items-center gap-2">
                                              <div className="w-1 h-1 rounded-full bg-indigo-400/50" />
                                              {l3Row.name}
                                            </div>
                                          </TableCell>
                                          <TableCell className="text-[11px] text-right tabular-nums py-1.5">{l3Count.toLocaleString("en-IN")}</TableCell>
                                          <TableCell className="text-[11px] text-right tabular-nums text-muted-foreground py-1.5">{l3Lmtd.toLocaleString("en-IN")}</TableCell>
                                          <TableCell className="text-right py-1.5">
                                            <span className={cn("text-[10px] font-bold",
                                              l3Growth > 5 ? "text-red-600" : l3Growth < -5 ? "text-emerald-600" : "text-muted-foreground"
                                            )}>
                                              {l3Growth > 0 ? "+" : ""}{l3Growth.toFixed(1)}%
                                            </span>
                                          </TableCell>
                                          <TableCell className="text-[11px] text-right tabular-nums py-1.5">
                                            {l2Row.count > 0 ? ((l3Count / l2Row.count) * 100).toFixed(1) : 0}%
                                          </TableCell>
                                        </TableRow>

                                        {/* L4: Query Types */}
                                        {isL3Expanded && (
                                          <>
                                            <TableRow className="bg-amber-50/30 border-b-0">
                                              <TableCell className="py-0.5"></TableCell>
                                              <TableCell colSpan={5} className="py-0.5 pl-16">
                                                <span className="text-[8px] font-semibold text-amber-700 uppercase tracking-wider">L4: Query Types</span>
                                              </TableCell>
                                            </TableRow>
                                            {cat.subQueries.map((sq, sqIdx) => {
                                              const sqForL3 = Math.round(sq.count * (l3Count / Math.max(1, cat.count)));
                                              const sqLmtdForL3 = Math.round(sq.lmtd * (l3Lmtd / Math.max(1, cat.lmtd)));
                                              const sqGrowth = sqLmtdForL3 > 0 ? ((sqForL3 - sqLmtdForL3) / sqLmtdForL3) * 100 : 0;
                                              return (
                                                <TableRow key={sq.query} className={cn("bg-amber-50/10 border-b border-dotted border-border/20",
                                                  sqIdx === cat.subQueries.length - 1 && "border-b-2 border-solid border-border/20"
                                                )}>
                                                  <TableCell className="py-1"></TableCell>
                                                  <TableCell className="py-1 pl-18">
                                                    <div className="flex items-center gap-2 pl-2">
                                                      <div className="w-1 h-1 rounded-full bg-amber-400" />
                                                      <span className="text-[10px] text-muted-foreground">{sq.query}</span>
                                                    </div>
                                                  </TableCell>
                                                  <TableCell className="text-[10px] text-right tabular-nums py-1">{sqForL3.toLocaleString("en-IN")}</TableCell>
                                                  <TableCell className="text-[10px] text-right tabular-nums text-muted-foreground py-1">{sqLmtdForL3.toLocaleString("en-IN")}</TableCell>
                                                  <TableCell className="text-right py-1">
                                                    <span className={cn("text-[9px] font-bold",
                                                      sqGrowth > 5 ? "text-red-600" : sqGrowth < -5 ? "text-emerald-600" : "text-muted-foreground"
                                                    )}>
                                                      {sqGrowth > 0 ? "+" : ""}{sqGrowth.toFixed(1)}%
                                                    </span>
                                                  </TableCell>
                                                  <TableCell className="text-[10px] text-right tabular-nums py-1">
                                                    {l3Count > 0 ? ((sqForL3 / l3Count) * 100).toFixed(1) : 0}%
                                                  </TableCell>
                                                </TableRow>
                                              );
                                            })}
                                          </>
                                        )}
                                      </React.Fragment>
                                    );
                                  })}
                                </React.Fragment>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                {/* Legend */}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 bg-muted/30 border-t border-border text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-red-500" />
                    Growth &gt; 5% (query volume increased)
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    Decline &gt; 5% (query volume decreased)
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-semibold border rounded px-1 py-0 border-muted-foreground/30">L2→L3→L4</span>
                    Click rows to drill down
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* ─── Top Issue Stages ──────────────────────────────────────── */}
            <div id="mhd-issue-stages">
              <h2 className="text-sm font-semibold flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                Top Loan Stages Where Issues Occur
              </h2>
              <p className="text-[10px] text-muted-foreground mb-3">
                Resolution breakdown by stage — {pL} vs {cL}
              </p>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-[10px] font-semibold">Stage</TableHead>
                        <TableHead className="text-[10px] font-semibold text-right">Total ({pL})</TableHead>
                        <TableHead className="text-[10px] font-semibold text-right">{cL}</TableHead>
                        <TableHead className="text-[10px] font-semibold text-right">Change</TableHead>
                        <TableHead className="text-[10px] font-semibold text-right">Bot Resolved</TableHead>
                        <TableHead className="text-[10px] font-semibold text-right">Agent Resolved</TableHead>
                        <TableHead className="text-[10px] font-semibold text-right">Pending</TableHead>
                        <TableHead className="text-[10px] font-semibold text-center">Resolution Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.issuesByStage.map((row) => {
                        const resRate = row.total > 0 ? ((row.botResolved + row.agentResolved) / row.total) * 100 : 0;
                        const growth = row.lmtdTotal > 0 ? ((row.total - row.lmtdTotal) / row.lmtdTotal) * 100 : 0;
                        return (
                          <TableRow key={row.stage} className="hover:bg-muted/20">
                            <TableCell className="text-xs font-medium">{row.stage}</TableCell>
                            <TableCell className="text-xs text-right tabular-nums font-bold">{row.total.toLocaleString("en-IN")}</TableCell>
                            <TableCell className="text-xs text-right tabular-nums text-muted-foreground">{row.lmtdTotal.toLocaleString("en-IN")}</TableCell>
                            <TableCell className="text-right">
                              <span className={cn("text-[10px] font-bold",
                                growth > 5 ? "text-red-600" : growth < -5 ? "text-emerald-600" : "text-muted-foreground"
                              )}>
                                {growth > 0 ? "+" : ""}{growth.toFixed(1)}%
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-right tabular-nums text-blue-600">{row.botResolved.toLocaleString("en-IN")}</TableCell>
                            <TableCell className="text-xs text-right tabular-nums text-amber-600">{row.agentResolved.toLocaleString("en-IN")}</TableCell>
                            <TableCell className="text-xs text-right tabular-nums text-red-600">{row.pending.toLocaleString("en-IN")}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className={cn(
                                "text-[9px]",
                                resRate >= 85 ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                resRate >= 70 ? "bg-amber-50 text-amber-700 border-amber-200" :
                                "bg-red-50 text-red-700 border-red-200"
                              )}>{resRate.toFixed(1)}%</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            <Separator />

            {/* ─── Bot Sessions by Program ────────────────────────────────── */}
            <div id="mhd-bot-program">
              <h2 className="text-sm font-semibold flex items-center gap-2 mb-1">
                <Bot className="h-4 w-4 text-muted-foreground" />
                Bot Sessions by Loan Program Type
              </h2>
              <p className="text-[10px] text-muted-foreground mb-3">
                Sessions, self-resolution, and handover across Fresh, Renewal, Top-up, etc.
              </p>
              <Card>
                <CardContent className="p-0 pb-2 pr-2">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={data.botByProgram} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 92%)" vertical={false} />
                      <XAxis dataKey="program" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} width={50} />
                      <Tooltip contentStyle={{ fontSize: 11 }} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Bar dataKey="sessions" name="Total Sessions" fill="hsl(220, 70%, 55%)" radius={[4, 4, 0, 0]} barSize={20} />
                      <Bar dataKey="selfResolved" name="Self-Resolved" fill="hsl(150, 60%, 45%)" radius={[4, 4, 0, 0]} barSize={20} />
                      <Bar dataKey="handover" name="Handover" fill="hsl(40, 80%, 50%)" radius={[4, 4, 0, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Separator />

            {/* ─── Bot + Agent Sessions by Loan Stage ────────────────────── */}
            <div id="mhd-sessions-stage">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    Bot &amp; Agent Sessions Across Loan Stages
                  </h2>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Sessions and resolution by funnel stage</p>
                </div>
                <Select value={programFilter} onValueChange={setProgramFilter} disabled={useGlobalFilters && global.productType !== "All"}>
                  <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Programs</SelectItem>
                    {LOAN_PROGRAMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <Card>
                <CardContent className="p-0 pb-2 pr-2">
                  <ResponsiveContainer width="100%" height={320}>
                    <ComposedChart data={filteredBotSessions} layout="vertical" margin={{ top: 10, right: 20, left: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 92%)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                      <YAxis dataKey="stage" type="category" tick={{ fontSize: 8 }} tickLine={false} axisLine={false} width={130} />
                      <Tooltip contentStyle={{ fontSize: 11 }} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Bar dataKey="botSessions" name="Bot Sessions" fill="hsl(220, 70%, 55%)" barSize={10} radius={[0, 4, 4, 0]} />
                      <Bar dataKey="agentSessions" name="Agent Sessions" fill="hsl(40, 80%, 50%)" barSize={10} radius={[0, 4, 4, 0]} />
                      <Bar dataKey="resolved" name="Resolved" fill="hsl(150, 60%, 45%)" barSize={10} radius={[0, 4, 4, 0]} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ═══ SECTION: CHANNELS ════════════════════════════════════════════ */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {activeView === "channels" && (
          <div className="space-y-6">
            {/* ─── Channel KPIs ──────────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {CHANNEL_NAMES.map((ch) => {
                const cd = data.channelDisbursal[ch as keyof typeof data.channelDisbursal];
                const totalDisb = Object.values(data.channelDisbursal).reduce((s, v) => s + v.disbursed, 0);
                const share = totalDisb > 0 ? ((cd.disbursed / totalDisb) * 100).toFixed(1) : "0";
                return (
                  <ClickableKpiCard
                    key={ch}
                    onClick={() =>
                      setKpiDive({
                        open: true,
                        config: {
                          title: `${ch} Channel`,
                          metric: `${cd.disbursed.toLocaleString("en-IN")} disbursed`,
                          subtitle: `Leads, disbursals, and amount for ${ch}`,
                          sections: [
                            {
                              title: "Channel Metrics",
                              type: "kpi-row",
                              kpis: [
                                { label: "Leads", value: cd.leads.toLocaleString("en-IN") },
                                { label: "Disbursed", value: cd.disbursed.toLocaleString("en-IN") },
                                { label: "Amount", value: `₹${cd.amount} Cr` },
                              ],
                            },
                            {
                              title: "Share vs All Channels",
                              type: "kpi-row",
                              kpis: [
                                { label: "Disbursal Share", value: `${share}%` },
                                { label: "Total Disbursals (All)", value: totalDisb.toLocaleString("en-IN") },
                              ],
                            },
                            {
                              title: "Chart",
                              type: "chart",
                              chart: {
                                type: "bar",
                                data: [
                                  { name: "Leads", value: cd.leads, color: "hsl(220, 70%, 55%)" },
                                  { name: "Disbursed", value: cd.disbursed, color: "hsl(150, 60%, 45%)" },
                                  { name: "Amount (Cr)", value: cd.amount, color: "hsl(40, 80%, 50%)" },
                                ],
                                label: ch,
                                valueSuffix: "",
                              },
                            },
                            {
                              title: "Insights",
                              type: "bullets",
                              bullets: [
                                `${ch}: ${cd.leads.toLocaleString("en-IN")} leads, ${cd.disbursed.toLocaleString("en-IN")} disbursed (₹${cd.amount} Cr)`,
                                `${share}% of total disbursals across all channels`,
                              ],
                            },
                          ],
                        },
                      })
                    }
                  >
                    <Card>
                      <CardHeader className="pb-1 pt-3 px-4">
                        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                          {ch === "Callcentre" && <Phone className="h-3.5 w-3.5 text-violet-500" />}
                          {ch === "FSE" && <UserCheck className="h-3.5 w-3.5 text-emerald-500" />}
                          {ch === "DIY" && <Globe className="h-3.5 w-3.5 text-blue-500" />}
                          {ch}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-4 pb-3">
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <p className="text-[9px] text-muted-foreground">Leads</p>
                            <p className="text-sm font-bold tabular-nums">{cd.leads.toLocaleString("en-IN")}</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-muted-foreground">Disbursed</p>
                            <p className="text-sm font-bold tabular-nums text-emerald-600">{cd.disbursed.toLocaleString("en-IN")}</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-muted-foreground">Amount</p>
                            <p className="text-sm font-bold tabular-nums">₹{cd.amount} Cr</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Progress value={parseFloat(share)} className="h-1.5 flex-1" />
                          <span className="text-[10px] font-bold text-muted-foreground">{share}% share</span>
                        </div>
                      </CardContent>
                    </Card>
                  </ClickableKpiCard>
                );
              })}
            </div>

            <Separator />

            {/* ─── Channel Contribution in Lead Creation & Disbursal ──────── */}
            <div id="channel-contribution">
              <h2 className="text-sm font-semibold flex items-center gap-2 mb-1">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                Channel Contribution: Lead Creation &amp; Disbursals
              </h2>
              <p className="text-[10px] text-muted-foreground mb-3">
                Absolute numbers and percentage share by channel
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Lead Creation Chart */}
                <Card>
                  <CardHeader className="pb-1 pt-3 px-4">
                    <CardTitle className="text-xs font-medium">Lead Creation by Channel</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 pb-2 pr-2">
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={CHANNEL_NAMES.map((ch, i) => ({
                            name: ch,
                            value: data.channelDisbursal[ch as keyof typeof data.channelDisbursal].leads,
                          }))}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          dataKey="value"
                          label={({ name, percent }: { name?: string; percent?: number }) => `${name || ""} ${((percent || 0) * 100).toFixed(0)}%`}
                          labelLine={{ strokeWidth: 1 }}
                        >
                          {CHANNEL_NAMES.map((_, i) => (
                            <Cell key={i} fill={COLORS[i]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ fontSize: 11 }} formatter={(val: number | undefined) => (val ?? 0).toLocaleString("en-IN")} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Disbursal Chart */}
                <Card>
                  <CardHeader className="pb-1 pt-3 px-4">
                    <CardTitle className="text-xs font-medium">Disbursals by Channel</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 pb-2 pr-2">
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={CHANNEL_NAMES.map((ch) => ({
                            name: ch,
                            value: data.channelDisbursal[ch as keyof typeof data.channelDisbursal].disbursed,
                          }))}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          dataKey="value"
                          label={({ name, percent }: { name?: string; percent?: number }) => `${name || ""} ${((percent || 0) * 100).toFixed(0)}%`}
                          labelLine={{ strokeWidth: 1 }}
                        >
                          {CHANNEL_NAMES.map((_, i) => (
                            <Cell key={i} fill={COLORS[i]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ fontSize: 11 }} formatter={(val: number | undefined) => (val ?? 0).toLocaleString("en-IN")} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </div>

            <Separator />

            {/* ─── Channel Intervention Across Funnel Stages ──────────────── */}
            <div id="channel-intervention">
              <h2 className="text-sm font-semibold flex items-center gap-2 mb-1">
                <Activity className="h-4 w-4 text-muted-foreground" />
                Channel Intervention Across Funnel Stages
              </h2>
              <p className="text-[10px] text-muted-foreground mb-3">
                Percentage contribution of Callcentre, FSE, and DIY at each major stage
              </p>

              {/* Stacked Bar Chart */}
              <Card className="mb-4">
                <CardContent className="p-0 pb-2 pr-2">
                  <ResponsiveContainer width="100%" height={340}>
                    <BarChart data={data.channelLeadData} layout="vertical" margin={{ top: 10, right: 20, left: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 92%)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                      <YAxis dataKey="stage" type="category" tick={{ fontSize: 8 }} tickLine={false} axisLine={false} width={130} />
                      <Tooltip
                        contentStyle={{ fontSize: 11 }}
                        formatter={(val: number | undefined, name: string | undefined) => [(val ?? 0).toLocaleString("en-IN"), name || ""]}
                      />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Bar dataKey="Callcentre" stackId="a" fill={COLORS[0]} barSize={14} />
                      <Bar dataKey="FSE" stackId="a" fill={COLORS[1]} barSize={14} />
                      <Bar dataKey="DIY" stackId="a" fill={COLORS[2]} barSize={14} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Detailed Table */}
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="text-[10px] font-semibold min-w-[140px]">Stage</TableHead>
                          <TableHead className="text-[10px] font-semibold text-right">Total</TableHead>
                          <TableHead className="text-[10px] font-semibold text-right">Callcentre</TableHead>
                          <TableHead className="text-[10px] font-semibold text-center">%</TableHead>
                          <TableHead className="text-[10px] font-semibold text-right">FSE</TableHead>
                          <TableHead className="text-[10px] font-semibold text-center">%</TableHead>
                          <TableHead className="text-[10px] font-semibold text-right">DIY</TableHead>
                          <TableHead className="text-[10px] font-semibold text-center">%</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.channelLeadData.map((row) => (
                          <TableRow key={row.fullStage} className="hover:bg-muted/20">
                            <TableCell className="text-xs font-medium">{row.fullStage}</TableCell>
                            <TableCell className="text-xs text-right tabular-nums font-bold">{row.total.toLocaleString("en-IN")}</TableCell>
                            <TableCell className="text-xs text-right tabular-nums">{row.Callcentre.toLocaleString("en-IN")}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="text-[9px]">{row.callcentrePct}%</Badge>
                            </TableCell>
                            <TableCell className="text-xs text-right tabular-nums">{row.FSE.toLocaleString("en-IN")}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="text-[9px]">{row.fsePct}%</Badge>
                            </TableCell>
                            <TableCell className="text-xs text-right tabular-nums">{row.DIY.toLocaleString("en-IN")}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="text-[9px]">{row.diyPct}%</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      <KpiDeepDiveModal open={kpiDive.open} onClose={() => setKpiDive({ open: false, config: null })} config={kpiDive.config} />
    </div>
  );
}

// ─── Helper components ───────────────────────────────────────────────────────

function MajorKPI({
  label,
  value,
  subtitle,
  lmtd,
  lmtdLabel,
  compareLabel = "LMTD",
  isBetter,
  icon,
  major = false,
}: {
  label: string;
  value: string;
  subtitle: string;
  lmtd?: number;
  lmtdLabel?: string;
  compareLabel?: string;
  isBetter?: boolean;
  icon: React.ReactNode;
  major?: boolean;
}) {
  return (
    <Card className={major ? "border-primary/30 shadow-sm" : ""}>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-1">
          {icon}
          <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
          {major && <Badge className="text-[8px] px-1 py-0 bg-primary/10 text-primary border-primary/20">Major</Badge>}
        </div>
        <p className="text-xl font-bold tabular-nums">{value}</p>
        <div className="flex flex-col gap-0.5 mt-1">
          <span className="text-[10px] text-muted-foreground">{subtitle}</span>
          {lmtd !== undefined && isBetter !== undefined && (
            <div className="flex items-center gap-1.5">
              {lmtdLabel && <span className="text-[10px] text-muted-foreground">{compareLabel}: {lmtdLabel}</span>}
              <Badge
                variant="outline"
                className={cn(
                  "text-[9px] px-1 py-0",
                  isBetter ? "text-emerald-600 border-emerald-200" : "text-red-600 border-red-200"
                )}
              >
                {isBetter ? <TrendingUp className="h-2.5 w-2.5 inline mr-0.5" /> : <TrendingDown className="h-2.5 w-2.5 inline mr-0.5" />}
                vs {compareLabel}
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SentimentBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between items-center">
        <span className="text-[11px] font-medium">{label}</span>
        <span className="text-[11px] font-bold tabular-nums">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
