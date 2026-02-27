"use client";

import { cn } from "@/lib/utils";

interface WaterfallStage {
  name: string;
  leads: number;
  drop: number;
  dropPct: number;
}

interface WaterfallChartProps {
  stages: WaterfallStage[];
  title?: string;
}

function formatCount(n: number): string {
  if (n >= 100000) return `${(n / 1000).toFixed(0)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString("en-IN");
}

export function WaterfallChart({ stages, title = "Funnel Drop-off Waterfall" }: WaterfallChartProps) {
  if (stages.length === 0) return null;
  const maxLeads = stages[0]?.leads || 1;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="space-y-1">
        {stages.map((s, i) => {
          const barWidth = (s.leads / maxLeads) * 100;
          const dropWidth = (s.drop / maxLeads) * 100;
          const isFirst = i === 0;

          return (
            <div key={s.name} className="flex items-center gap-2">
              <div className="w-32 shrink-0 text-[10px] font-medium text-foreground truncate text-right pr-1" title={s.name}>
                {s.name.replace(/_/g, " ")}
              </div>
              <div className="flex-1 flex items-center gap-0">
                <div
                  className="h-6 rounded-l bg-primary/80 flex items-center justify-end pr-1 transition-all"
                  style={{ width: `${Math.max(barWidth, 2)}%` }}
                >
                  <span className="text-[9px] font-bold text-primary-foreground tabular-nums">
                    {formatCount(s.leads)}
                  </span>
                </div>
                {!isFirst && s.drop > 0 && (
                  <div
                    className="h-6 rounded-r bg-red-400/60 dark:bg-red-500/40 flex items-center justify-center transition-all"
                    style={{ width: `${Math.max(dropWidth, 1)}%`, minWidth: "24px" }}
                  >
                    <span className="text-[8px] font-semibold text-red-800 dark:text-red-200 tabular-nums">
                      -{formatCount(s.drop)}
                    </span>
                  </div>
                )}
              </div>
              <div className="w-14 shrink-0 text-right">
                {!isFirst && (
                  <span className={cn(
                    "text-[10px] font-semibold tabular-nums",
                    s.dropPct > 30 ? "text-red-600" : s.dropPct > 15 ? "text-amber-600" : "text-muted-foreground"
                  )}>
                    -{s.dropPct.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 text-[9px] text-muted-foreground pt-1">
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-primary/80" /> Leads retained</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-red-400/60" /> Drop-off</span>
      </div>
    </div>
  );
}
