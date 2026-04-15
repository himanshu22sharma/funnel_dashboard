"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronRight,
  Mail,
  Ticket,
  AlertTriangle,
  MessageSquarePlus,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Zap,
  Eye,
  Activity,
  Sparkles,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { EmailComposeModal } from "./email-compose-modal";
import { CreateTicketModal, TicketItem } from "./create-ticket-modal";

// ─── Shared Types ──────────────────────────────────────────────────────────

export interface RichChartBar {
  label: string;
  value: number;
  color: string;
  filterContext?: { lender?: string };
}

export interface RichL2Drill {
  stage: string;
  hypotheses: string[];
  lenderBreakdown?: { lender: string; delta: number }[];
}

export interface RichInsightItem {
  id: string;
  icon: LucideIcon;
  color: string;
  title: string;
  detail: string;
  severity: "good" | "warn" | "bad" | "info";
  impactWeight: number;
  link?: string;
  defaultFilter?: { lender?: string };
  section?: string;
  isEmerging?: boolean;
  priorityBucket?: "P0" | "P1" | "P2" | "P3" | "emerging" | "positive";
  expanded: {
    bullets: string[];
    chartData: RichChartBar[];
    chartLabel: string;
    chartValueSuffix: string;
    navigateLabel?: string;
    l2Drills?: RichL2Drill[];
  };
}

// ─── Inline Feedback Modal ─────────────────────────────────────────────────

export function InlineFeedbackModal({
  open,
  onClose,
  context,
}: {
  open: boolean;
  onClose: () => void;
  context: { title: string; detail: string; page: string };
}) {
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackType, setFeedbackType] = useState<"question" | "bug" | "enhancement" | "data-issue">("question");
  const [submitted, setSubmitted] = useState(false);

  if (!open) return null;

  const handleSubmit = () => {
    if (!feedbackText.trim()) return;
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setFeedbackText("");
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 animate-in zoom-in-95 fade-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {submitted ? (
          <div className="p-8 text-center">
            <div className="flex items-center justify-center h-12 w-12 rounded-full bg-emerald-100 mx-auto mb-3">
              <MessageSquarePlus className="h-5 w-5 text-emerald-600" />
            </div>
            <p className="text-sm font-semibold text-emerald-700">Feedback Submitted!</p>
            <p className="text-xs text-muted-foreground mt-1">Your feedback has been sent to the backend team for review.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <MessageSquarePlus className="h-4 w-4 text-blue-600" />
                <h3 className="text-sm font-semibold">Raise Feedback / Question</h3>
              </div>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                <span className="sr-only">Close</span>
                &times;
              </button>
            </div>
            <div className="p-4 space-y-3">
              {/* Context */}
              <div className="rounded-lg border bg-muted/20 p-2.5">
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Context</p>
                <p className="text-xs font-medium">{context.title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{context.detail}</p>
                <Badge variant="outline" className="text-[8px] mt-1">{context.page}</Badge>
              </div>

              {/* Feedback Type */}
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Type</label>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {(["question", "bug", "enhancement", "data-issue"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setFeedbackType(t)}
                      className={cn(
                        "px-2.5 py-1 text-[10px] font-semibold rounded-md border transition-all cursor-pointer capitalize",
                        feedbackType === t
                          ? t === "bug" ? "bg-red-50 text-red-700 border-red-200"
                            : t === "data-issue" ? "bg-amber-50 text-amber-700 border-amber-200"
                            : t === "enhancement" ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-violet-50 text-violet-700 border-violet-200"
                          : "border-border/60 text-muted-foreground hover:border-border"
                      )}
                    >
                      {t === "data-issue" ? "Data Issue" : t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Feedback Text */}
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Your Feedback</label>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  rows={3}
                  placeholder="Describe your question, concern, or suggestion..."
                  className="mt-1 w-full text-xs border border-border rounded-md px-3 py-2 bg-card focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border bg-muted/20">
              <button onClick={onClose} className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!feedbackText.trim()}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer",
                  feedbackText.trim()
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                <MessageSquarePlus className="h-3 w-3" />
                Submit Feedback
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

interface RichInsightPanelProps {
  title: string;
  insights: RichInsightItem[];
  pageName?: string;
  onNavigate?: (link: string, filter?: { lender?: string }, section?: string) => void;
}

export function RichInsightPanel({ title, insights, pageName = "Funnel Summary", onNavigate }: RichInsightPanelProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [emailModal, setEmailModal] = useState<{ open: boolean; subject: string; body: string }>({ open: false, subject: "", body: "" });
  const [ticketModal, setTicketModal] = useState<{ open: boolean; title: string; description: string; priority: string }>({ open: false, title: "", description: "", priority: "P1" });
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [feedbackModal, setFeedbackModal] = useState<{ open: boolean; title: string; detail: string }>({ open: false, title: "", detail: "" });

  if (insights.length === 0) return null;

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openEmailModal = (item: RichInsightItem) => {
    const bullets = item.expanded.bullets.join("\n• ");
    setEmailModal({
      open: true,
      subject: `[Lending Dashboard] ${item.title}`,
      body: `Hi,\n\nInsight from ${pageName}:\n\n${item.title}\n${item.detail}\n\nDrill-Down:\n• ${bullets}\n\nDashboard: ${typeof window !== "undefined" ? window.location.origin : ""}${item.link || "/funnel-summary"}\n\nRegards`,
    });
  };

  const openTicketModal = (item: RichInsightItem) => {
    const bullets = item.expanded.bullets.join("\n- ");
    const priorityMap: Record<string, string> = { P0: "P0", P1: "P1", P2: "P2", P3: "P3", emerging: "P2", positive: "P3" };
    setTicketModal({
      open: true,
      title: item.title,
      description: `${item.detail}\n\nAnalysis:\n- ${bullets}\n\nSource: ${pageName}\nDashboard: ${typeof window !== "undefined" ? window.location.origin : ""}${item.link || "/funnel-summary"}`,
      priority: priorityMap[item.priorityBucket || ""] || (item.severity === "bad" ? "P1" : item.severity === "warn" ? "P2" : "P3"),
    });
  };

  const openFeedbackModal = (item: RichInsightItem) => {
    setFeedbackModal({
      open: true,
      title: item.title,
      detail: item.detail,
    });
  };

  const openFeedbackForChart = (chartTitle: string, detail: string) => {
    setFeedbackModal({
      open: true,
      title: chartTitle,
      detail,
    });
  };

  const renderCard = (item: RichInsightItem) => {
    const Icon = item.icon;
    const isExpanded = expandedIds.has(item.id);
    return (
      <Card key={item.id} className={cn(
        "transition-all overflow-hidden",
        item.severity === "bad" ? "border-red-200/60" :
        item.severity === "warn" ? "border-amber-200/60" :
        item.severity === "good" ? "border-emerald-200/60" : "border-border",
        isExpanded && "shadow-md",
      )}>
        <CardContent className="p-0">
          <div
            className={cn(
              "flex items-start gap-3 p-3 text-left transition-colors",
              item.severity === "bad" ? "bg-red-50/30 hover:bg-red-50/50" :
              item.severity === "warn" ? "bg-amber-50/30 hover:bg-amber-50/50" :
              item.severity === "good" ? "bg-emerald-50/30 hover:bg-emerald-50/50" :
              "bg-muted/20 hover:bg-muted/30"
            )}
          >
            <button className="cursor-pointer shrink-0 mt-0.5" onClick={() => toggleExpand(item.id)}>
              {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </button>
            <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-lg",
              item.severity === "bad" ? "bg-red-100" : item.severity === "warn" ? "bg-amber-100" : item.severity === "good" ? "bg-emerald-100" : "bg-muted"
            )}>
              <Icon className={cn("h-3.5 w-3.5", item.color)} />
            </div>
            <button className="flex-1 min-w-0 text-left cursor-pointer" onClick={() => toggleExpand(item.id)}>
              <p className="text-xs font-semibold">{item.title}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{item.detail}</p>
            </button>
            {/* Action buttons */}
            <div className="flex items-center gap-1 shrink-0">
              {item.isEmerging && (
                <Badge variant="outline" className="text-[8px] bg-violet-50 text-violet-700 border-violet-200 px-1.5">NEW</Badge>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); openFeedbackModal(item); }}
                className="flex items-center justify-center h-6 w-6 rounded-md border border-border/60 text-muted-foreground hover:text-orange-600 hover:border-orange-300 transition-colors cursor-pointer"
                title="Raise feedback / question"
              >
                <MessageSquarePlus className="h-3 w-3" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); openEmailModal(item); }}
                className="flex items-center justify-center h-6 w-6 rounded-md border border-border/60 text-muted-foreground hover:text-blue-600 hover:border-blue-300 transition-colors cursor-pointer"
                title="Share via email"
              >
                <Mail className="h-3 w-3" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); openTicketModal(item); }}
                className="flex items-center justify-center h-6 w-6 rounded-md border border-border/60 text-muted-foreground hover:text-violet-600 hover:border-violet-300 transition-colors cursor-pointer"
                title="Create ticket"
              >
                <Ticket className="h-3 w-3" />
              </button>
            </div>
          </div>

          {isExpanded && (
            <div className="border-t border-border/50 px-4 py-3 space-y-3 bg-card">
              {/* L2 Drill-Down */}
              {item.expanded.l2Drills && item.expanded.l2Drills.length > 0 && (
                <div className="rounded-lg border border-amber-200/60 bg-amber-50/20 p-3">
                  <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="h-3 w-3" />
                    Why is this happening?
                  </p>
                  {item.expanded.l2Drills.map((drill, di) => (
                    <div key={di} className="space-y-1.5">
                      <ul className="space-y-1">
                        {drill.hypotheses.map((h, hi) => (
                          <li key={hi} className="text-[11px] text-foreground flex items-start gap-2 leading-relaxed">
                            <span className="text-amber-500 mt-0.5 shrink-0">&#9656;</span>
                            {h}
                          </li>
                        ))}
                      </ul>
                      {drill.lenderBreakdown && drill.lenderBreakdown.length > 0 && (
                        <div className="mt-2">
                          <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Lender impact at this stage</p>
                          <div className="flex flex-wrap gap-1.5">
                            {drill.lenderBreakdown.map((lb) => (
                              <Badge
                                key={lb.lender}
                                variant="outline"
                                className={cn(
                                  "text-[9px] cursor-pointer",
                                  lb.delta < -3 ? "bg-red-50 text-red-700 border-red-200" :
                                  lb.delta < 0 ? "bg-amber-50 text-amber-700 border-amber-200" :
                                  "bg-emerald-50 text-emerald-700 border-emerald-200"
                                )}
                                onClick={() => onNavigate?.(item.link || "/funnel-summary", { lender: lb.lender }, item.section)}
                              >
                                {lb.lender}: {lb.delta > 0 ? "+" : ""}{lb.delta}pp
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Drill-Down</p>
                <ul className="space-y-1">
                  {item.expanded.bullets.map((b, i) => (
                    <li key={i} className="text-[11px] text-foreground flex items-start gap-2 leading-relaxed">
                      <span className="text-muted-foreground/50 mt-0.5 shrink-0">&bull;</span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>

              {item.expanded.chartData.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{item.expanded.chartLabel}</p>
                    <button
                      onClick={() => openFeedbackForChart(item.expanded.chartLabel, `Chart context: ${item.title} — ${item.detail}`)}
                      className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-orange-600 transition-colors cursor-pointer"
                      title="Raise feedback on this chart"
                    >
                      <MessageSquarePlus className="h-3 w-3" />
                      Feedback
                    </button>
                  </div>
                  {onNavigate && <p className="text-[9px] text-muted-foreground mb-1 italic">Click any bar to navigate with that filter applied</p>}
                  <div className="rounded-lg border bg-muted/10 overflow-hidden">
                    <ResponsiveContainer width="100%" height={Math.min(200, Math.max(120, item.expanded.chartData.length * 22 + 40))}>
                      <BarChart data={item.expanded.chartData} layout="vertical" margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 92%)" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                        <YAxis dataKey="label" type="category" tick={{ fontSize: 8 }} tickLine={false} axisLine={false} width={120} />
                        <Tooltip
                          contentStyle={{ fontSize: 11 }}
                          formatter={(val) => (val != null && val !== "" ? `${val}${item.expanded.chartValueSuffix}` : "")}
                        />
                        <Bar
                          dataKey="value"
                          barSize={12}
                          radius={[0, 4, 4, 0]}
                          cursor={onNavigate ? "pointer" : "default"}
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          onClick={(data: any) => {
                            if (!onNavigate) return;
                            if (data?.filterContext?.lender) {
                              onNavigate(item.link || "/funnel-summary", { lender: data.filterContext.lender }, item.section);
                            } else {
                              onNavigate(item.link || "/funnel-summary", item.defaultFilter, item.section);
                            }
                          }}
                        >
                          {item.expanded.chartData.map((d, idx) => (
                            <Cell key={idx} fill={d.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                {onNavigate && item.expanded.navigateLabel && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-[10px] h-7 cursor-pointer"
                    onClick={() => onNavigate(item.link || "/funnel-summary", item.defaultFilter, item.section)}
                  >
                    <ExternalLink className="h-3 w-3 mr-1.5" />
                    {item.expanded.navigateLabel}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[10px] h-7 cursor-pointer"
                  onClick={() => openEmailModal(item)}
                >
                  <Mail className="h-3 w-3 mr-1.5" />
                  Email
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[10px] h-7 cursor-pointer"
                  onClick={() => openTicketModal(item)}
                >
                  <Ticket className="h-3 w-3 mr-1.5" />
                  Create Ticket
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[10px] h-7 cursor-pointer text-orange-600 border-orange-200 hover:bg-orange-50"
                  onClick={() => openFeedbackModal(item)}
                >
                  <MessageSquarePlus className="h-3 w-3 mr-1.5" />
                  Raise Feedback
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Priority tab config
  const TABS = [
    { key: "P0" as const, label: "P0 — Critical", color: "text-red-700", bg: "bg-red-50/40", border: "border-red-500", badge: "bg-red-100 text-red-700 border-red-200", icon: Zap },
    { key: "P1" as const, label: "P1 — High", color: "text-orange-700", bg: "bg-orange-50/40", border: "border-orange-500", badge: "bg-orange-100 text-orange-700 border-orange-200", icon: AlertTriangle },
    { key: "P2" as const, label: "P2 — Medium", color: "text-amber-700", bg: "bg-amber-50/40", border: "border-amber-500", badge: "bg-amber-100 text-amber-700 border-amber-200", icon: Eye },
    { key: "P3" as const, label: "P3 — Low", color: "text-blue-700", bg: "bg-blue-50/40", border: "border-blue-500", badge: "bg-blue-100 text-blue-700 border-blue-200", icon: Activity },
    { key: "emerging" as const, label: "Emerging Issues", color: "text-violet-700", bg: "bg-violet-50/40", border: "border-violet-500", badge: "bg-violet-100 text-violet-700 border-violet-200", icon: Sparkles },
    { key: "positive" as const, label: "What's Working", color: "text-emerald-700", bg: "bg-emerald-50/40", border: "border-emerald-500", badge: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  ];
  type PKey = typeof TABS[number]["key"];

  // Bucket insights into priority sections
  const buckets = React.useMemo(() => {
    const b: Record<PKey, RichInsightItem[]> = { P0: [], P1: [], P2: [], P3: [], emerging: [], positive: [] };
    insights.forEach((item) => {
      if (item.severity === "good" || item.severity === "info") {
        b.positive.push(item);
        return;
      }
      if (item.isEmerging) { b.emerging.push(item); return; }
      if (item.priorityBucket && b[item.priorityBucket as PKey]) {
        b[item.priorityBucket as PKey].push(item);
        return;
      }
      // Auto-assign by impact weight
      if (item.impactWeight >= 85) b.P0.push(item);
      else if (item.impactWeight >= 60) b.P1.push(item);
      else if (item.impactWeight >= 35) b.P2.push(item);
      else b.P3.push(item);
    });
    return b;
  }, [insights]);

  // Find first non-empty tab
  const firstTab = TABS.find((t) => buckets[t.key].length > 0)?.key || "P0";
  const [activeTab, setActiveTab] = useState<PKey>(firstTab);
  const activeItems = buckets[activeTab] || [];
  const activeConfig = TABS.find((t) => t.key === activeTab)!;

  return (
    <>
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold">{title}</p>
            <Badge variant="outline" className="text-[9px] ml-auto">{insights.length} insights</Badge>
          </div>

          {/* Priority tabs */}
          <div className="flex flex-wrap gap-1">
            {TABS.map((tab) => {
              const count = buckets[tab.key].length;
              if (count === 0) return null;
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all border cursor-pointer",
                    isActive
                      ? `${tab.bg} ${tab.color} ${tab.border} shadow-sm`
                      : "bg-muted/20 text-muted-foreground border-transparent hover:bg-muted/40"
                  )}
                >
                  <TabIcon className="h-3 w-3" />
                  {tab.label}
                  <Badge variant="outline" className={cn("text-[8px] px-1 py-0 ml-0.5", isActive ? tab.badge : "")}>
                    {count}
                  </Badge>
                </button>
              );
            })}
          </div>

          {/* Active tab content */}
          <div className={cn("rounded-lg p-2 space-y-2", activeConfig.bg)}>
            {activeItems.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No insights in this category</p>
            ) : (
              activeItems.map(renderCard)
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      <EmailComposeModal
        open={emailModal.open}
        onClose={() => setEmailModal((p) => ({ ...p, open: false }))}
        defaultSubject={emailModal.subject}
        defaultBody={emailModal.body}
      />
      <CreateTicketModal
        open={ticketModal.open}
        onClose={() => setTicketModal((p) => ({ ...p, open: false }))}
        onSubmit={(t) => setTickets((prev) => [...prev, t])}
        defaultTitle={ticketModal.title}
        defaultDescription={ticketModal.description}
        defaultPriority={ticketModal.priority}
      />
      <InlineFeedbackModal
        open={feedbackModal.open}
        onClose={() => setFeedbackModal((p) => ({ ...p, open: false }))}
        context={{ title: feedbackModal.title, detail: feedbackModal.detail, page: pageName }}
      />
    </>
  );
}

// ─── Standalone Chart Feedback Button ──────────────────────────────────────

export function ChartFeedbackButton({ chartTitle, pageName = "Dashboard" }: { chartTitle: string; pageName?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-orange-600 transition-colors cursor-pointer"
        title="Raise feedback on this chart"
      >
        <MessageSquarePlus className="h-3 w-3" />
        Feedback
      </button>
      <InlineFeedbackModal
        open={open}
        onClose={() => setOpen(false)}
        context={{ title: chartTitle, detail: `Feedback on chart: ${chartTitle}`, page: pageName }}
      />
    </>
  );
}
