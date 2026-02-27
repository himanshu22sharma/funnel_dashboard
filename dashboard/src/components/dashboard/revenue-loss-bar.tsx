"use client";

import { cn } from "@/lib/utils";
import { useMemo } from "react";

interface RevenueLossStage {
  index: number;
  name: string;
  leads: number;
  lmtdLeads: number;
  prevLeads: number;
  deltaPp: number | null;
}

interface RevenueLossBarProps {
  stages: RevenueLossStage[];
  avgTicketSize?: number;
  onStageClick: (stageIndex: number) => void;
}

export function RevenueLossBar({
  stages,
  avgTicketSize = 85000,
  onStageClick,
}: RevenueLossBarProps) {
  const lossStages = useMemo(() => {
    return stages
      .filter((s) => s.deltaPp != null && s.deltaPp < 0 && s.prevLeads > 0)
      .map((s) => {
        const impactLeads = Math.round(s.prevLeads * Math.abs(s.deltaPp!) / 100);
        const lossCr = (impactLeads * avgTicketSize) / 1e7;
        return { ...s, impactLeads, lossCr };
      })
      .sort((a, b) => b.lossCr - a.lossCr)
      .slice(0, 3);
  }, [stages, avgTicketSize]);

  if (lossStages.length === 0) return null;

  const maxLoss = Math.max(...lossStages.map((s) => s.lossCr), 0.01);

  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Estimated Revenue Leakage
        </span>
        <span className="text-[9px] text-muted-foreground">(Top 3 stages by ₹ Cr impact from conv% drop)</span>
      </div>
      <div className="flex items-end gap-4">
        {lossStages.map((s, idx) => {
          const barH = Math.max(12, (s.lossCr / maxLoss) * 48);
          return (
            <button
              key={s.index}
              type="button"
              onClick={() => onStageClick(s.index)}
              className="flex flex-col items-center gap-1.5 group flex-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded p-1 hover:bg-muted/30 transition-colors"
            >
              <span className="text-sm font-bold tabular-nums text-red-600">
                ₹{s.lossCr.toFixed(1)} Cr
              </span>
              <div
                className={cn(
                  "w-full rounded-t transition-colors",
                  idx === 0 ? "bg-red-500 group-hover:bg-red-600" :
                  idx === 1 ? "bg-red-400 group-hover:bg-red-500" :
                  "bg-red-300 group-hover:bg-red-400"
                )}
                style={{ height: `${barH}px` }}
              />
              <span className="text-[10px] font-semibold text-foreground truncate max-w-full" title={s.name}>
                {s.name.replace(/_/g, " ")}
              </span>
              <span className="text-[9px] text-muted-foreground tabular-nums">
                {s.deltaPp?.toFixed(1)}pp drop · ~{s.impactLeads.toLocaleString("en-IN")} leads lost
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
