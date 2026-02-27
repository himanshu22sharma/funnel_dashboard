"use client";

import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";

interface PatternItem {
  id: string;
  description: string;
  frequency: number;
  lastSeen: string;
  relatedStageIndex: number;
  relatedStageName: string;
  type: "recurring" | "correlation" | "seasonal";
}

interface PatternMemoryProps {
  onStageClick: (stageIndex: number) => void;
}

const MOCK_PATTERNS: PatternItem[] = [
  {
    id: "p1",
    description: "Mandate completion drops every Friday — observed 3 times this month",
    frequency: 3,
    lastSeen: "Feb 21",
    relatedStageIndex: 12,
    relatedStageName: "Mandate_Completed",
    type: "recurring",
  },
  {
    id: "p2",
    description: "Child lead dip correlates with marketplace pricing uploads (typically Tuesday)",
    frequency: 4,
    lastSeen: "Feb 18",
    relatedStageIndex: 6,
    relatedStageName: "Child_Lead_Created",
    type: "correlation",
  },
  {
    id: "p3",
    description: "BRE1 pass rate tightens at quarter-start — Jan, Apr pattern repeating",
    frequency: 2,
    lastSeen: "Feb 3",
    relatedStageIndex: 9,
    relatedStageName: "BRE1_Completed",
    type: "seasonal",
  },
  {
    id: "p4",
    description: "KYC vendor timeout spikes during 12-2pm IST — vendor SLA degradation",
    frequency: 5,
    lastSeen: "Feb 24",
    relatedStageIndex: 8,
    relatedStageName: "KYC_Completed",
    type: "recurring",
  },
];

const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  recurring: { label: "Recurring", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  correlation: { label: "Correlation", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  seasonal: { label: "Seasonal", cls: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" },
};

export function PatternMemory({ onStageClick }: PatternMemoryProps) {
  const [expanded, setExpanded] = useState(false);

  const patterns = useMemo(() => MOCK_PATTERNS, []);

  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">🧠</span>
          <span className="text-[11px] font-semibold text-foreground">
            What this funnel has learned this month
          </span>
          <span className="text-[10px] font-bold rounded-full px-1.5 py-0.5 bg-primary/10 text-primary tabular-nums">
            {patterns.length}
          </span>
        </div>
        <span className="text-muted-foreground text-xs">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-2 border-t">
          {patterns.map((p) => {
            const badge = TYPE_BADGE[p.type];
            return (
              <div
                key={p.id}
                className="flex items-start gap-2 py-1.5"
              >
                <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 mt-0.5", badge.cls)}>
                  {badge.label}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-foreground leading-relaxed">{p.description}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] text-muted-foreground">Last: {p.lastSeen}</span>
                    <span className="text-[9px] text-muted-foreground">·</span>
                    <button
                      type="button"
                      onClick={() => onStageClick(p.relatedStageIndex)}
                      className="text-[9px] text-primary hover:underline"
                    >
                      {p.relatedStageName.replace(/_/g, " ")} →
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
