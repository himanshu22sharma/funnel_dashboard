"use client";

import React, { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  LineChart,
  Line,
} from "recharts";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DeepDiveTableRow {
  label: string;
  values: (string | number)[];
  highlight?: boolean;
}

export interface DeepDiveChart {
  type: "bar" | "pie" | "line";
  data: { name: string; value: number; color?: string }[];
  label?: string;
  valueSuffix?: string;
}

export interface DeepDiveSection {
  title: string;
  type: "table" | "chart" | "bullets" | "kpi-row";
  headers?: string[];
  rows?: DeepDiveTableRow[];
  chart?: DeepDiveChart;
  bullets?: string[];
  kpis?: { label: string; value: string | number; sub?: string; color?: string }[];
}

export interface KpiDeepDiveConfig {
  title: string;
  metric: string;
  subtitle?: string;
  sections: DeepDiveSection[];
}

// ─── Shared colors ──────────────────────────────────────────────────────────

const CHART_COLORS = [
  "hsl(220, 70%, 55%)",
  "hsl(150, 60%, 45%)",
  "hsl(350, 65%, 55%)",
  "hsl(25, 95%, 53%)",
  "hsl(280, 60%, 55%)",
  "hsl(40, 80%, 50%)",
  "hsl(190, 70%, 45%)",
  "hsl(330, 80%, 55%)",
];

// ─── Render helpers ─────────────────────────────────────────────────────────

function SectionKPIs({ kpis }: { kpis: NonNullable<DeepDiveSection["kpis"]> }) {
  return (
    <div className={cn("grid gap-3", kpis.length <= 3 ? "grid-cols-3" : "grid-cols-2 md:grid-cols-4")}>
      {kpis.map((k, i) => (
        <Card key={i} className="bg-muted/20">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{k.label}</p>
            <p className={cn("text-lg font-bold tabular-nums mt-0.5", k.color || "text-foreground")}>{k.value}</p>
            {k.sub && <p className="text-[10px] text-muted-foreground mt-0.5">{k.sub}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SectionTable({ headers, rows }: { headers: string[]; rows: DeepDiveTableRow[] }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            {headers.map((h, i) => (
              <TableHead
                key={i}
                className={cn("text-[10px] font-semibold", i > 0 && "text-right")}
              >
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, ri) => (
            <TableRow key={ri} className={cn(row.highlight && "bg-amber-50/40")}>
              <TableCell className="text-xs font-medium">{row.label}</TableCell>
              {row.values.map((v, vi) => (
                <TableCell key={vi} className="text-xs text-right tabular-nums">
                  {typeof v === "number" ? v.toLocaleString("en-IN") : v}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SectionChart({ chart }: { chart: DeepDiveChart }) {
  if (chart.type === "bar") {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chart.data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,90%)" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 8 }}
            formatter={(val) => [
              `${Number(val ?? 0).toLocaleString("en-IN")}${chart.valueSuffix || ""}`,
              chart.label || "Value",
            ]}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {chart.data.map((d, i) => (
              <Cell key={i} fill={d.color || CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (chart.type === "pie") {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={chart.data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
            label={({ name, percent }: { name?: string; percent?: number }) =>
              `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`
            }
          >
            {chart.data.map((d, i) => (
              <Cell key={i} fill={d.color || CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 8 }}
            formatter={(val) => [
              `${Number(val ?? 0).toLocaleString("en-IN")}${chart.valueSuffix || ""}`,
              chart.label || "Value",
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  // line
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chart.data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,90%)" />
        <XAxis dataKey="name" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
        <Line type="monotone" dataKey="value" stroke="hsl(220,70%,55%)" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function SectionBullets({ bullets }: { bullets: string[] }) {
  return (
    <ul className="space-y-1.5 pl-1">
      {bullets.map((b, i) => (
        <li key={i} className="flex gap-2 text-xs text-muted-foreground">
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
          <span>{b}</span>
        </li>
      ))}
    </ul>
  );
}

// ─── Main Modal ─────────────────────────────────────────────────────────────

export function KpiDeepDiveModal({
  open,
  onClose,
  config,
}: {
  open: boolean;
  onClose: () => void;
  config: KpiDeepDiveConfig | null;
}) {
  if (!config) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>{config.title}</span>
            <Badge variant="outline" className="text-sm font-bold tabular-nums">
              {config.metric}
            </Badge>
          </DialogTitle>
          {config.subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{config.subtitle}</p>
          )}
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {config.sections.map((section, si) => (
            <div key={si}>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                {section.title}
              </p>

              {section.type === "kpi-row" && section.kpis && (
                <SectionKPIs kpis={section.kpis} />
              )}

              {section.type === "table" && section.headers && section.rows && (
                <SectionTable headers={section.headers} rows={section.rows} />
              )}

              {section.type === "chart" && section.chart && (
                <SectionChart chart={section.chart} />
              )}

              {section.type === "bullets" && section.bullets && (
                <SectionBullets bullets={section.bullets} />
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Convenience: Clickable Card Wrapper ────────────────────────────────────

export function ClickableKpiCard({
  children,
  onClick,
  className,
}: {
  children: ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "cursor-pointer transition-all hover:shadow-md hover:ring-1 hover:ring-primary/20 rounded-lg",
        className
      )}
    >
      {children}
    </div>
  );
}
