"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

export interface StageAnalysisStage {
  name: string;
  leads: number;
  prevLeads: number;
  prevStageName: string;
  convPct: number | null;
  lmtdLeads: number;
  lmtdPrevLeads: number;
  lmtdConvPct: number | null;
  deltaPp: number | null;
}

export interface LenderRow {
  lender: string;
  program: string;
  entryLeads: number;
  mtdLeads: number;
  lmtdLeads: number;
  mtdConv: number | null;
  deltaPp: number | null;
  impact: number;
}

export interface FlowRow {
  flow: string;
  entryLeads: number;
  mtdLeads: number;
  lmtdLeads: number;
  mtdConv: number | null;
  lmtdConv: number | null;
  deltaPp: number | null;
}

export interface SubStageRow {
  sub_stage: string;
  mtd_leads: number;
  lmtd_leads: number;
  delta_pp: number | null;
}

interface StageAnalysisViewProps {
  stage: StageAnalysisStage;
  compareLabel: string;
  periodLabel: string;
  lenderRows: LenderRow[];
  flowRows: FlowRow[];
  subStages: SubStageRow[];
  onBack: () => void;
}

export function StageAnalysisView({
  stage,
  compareLabel,
  periodLabel,
  lenderRows,
  flowRows,
  subStages,
  onBack,
}: StageAnalysisViewProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Button variant="outline" size="sm" onClick={onBack} className="shrink-0">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to funnel
        </Button>
        <h2 className="text-lg font-semibold truncate">{stage.name}</h2>
      </div>

      {/* Summary: count, conv %, drop in conv */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Stage summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Count ({periodLabel})</p>
              <p className="font-bold tabular-nums">{stage.leads.toLocaleString("en-IN")}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Conversion %</p>
              <p className="font-bold">{stage.convPct != null ? `${stage.convPct}%` : "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Drop in conv vs {compareLabel}</p>
              <p className={cn(
                "font-bold tabular-nums",
                stage.deltaPp != null && stage.deltaPp < 0 ? "text-red-600" : stage.deltaPp != null && stage.deltaPp > 0 ? "text-emerald-600" : ""
              )}>
                {stage.deltaPp != null ? `${stage.deltaPp >= 0 ? "+" : ""}${stage.deltaPp}pp` : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Entry (prev stage)</p>
              <p className="font-bold tabular-nums">{stage.prevLeads.toLocaleString("en-IN")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lender-wise trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Lender-wise trend</CardTitle>
        </CardHeader>
        <CardContent>
          {lenderRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No lender breakdown for this stage.</p>
          ) : (
            <div className="rounded border overflow-x-auto max-h-64 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs">Lender</TableHead>
                    <TableHead className="text-xs">Program</TableHead>
                    <TableHead className="text-xs text-right">Entry</TableHead>
                    <TableHead className="text-xs text-right">Count</TableHead>
                    <TableHead className="text-xs text-right">Conv %</TableHead>
                    <TableHead className="text-xs text-right">Δ (pp)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lenderRows.slice(0, 15).map((row, i) => (
                    <TableRow key={`${row.lender}-${row.program}-${i}`}>
                      <TableCell className="text-xs font-medium">{row.lender}</TableCell>
                      <TableCell className="text-xs">{row.program}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{row.entryLeads.toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{row.mtdLeads.toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-xs text-right">{row.mtdConv != null ? `${row.mtdConv.toFixed(1)}%` : "—"}</TableCell>
                      <TableCell className={cn(
                        "text-xs text-right tabular-nums",
                        row.deltaPp != null && row.deltaPp < 0 ? "text-red-600" : row.deltaPp != null && row.deltaPp > 0 ? "text-emerald-600" : ""
                      )}>
                        {row.deltaPp != null ? `${row.deltaPp >= 0 ? "+" : ""}${row.deltaPp}` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Flow-wise trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Flow-wise trend</CardTitle>
        </CardHeader>
        <CardContent>
          {flowRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No flow breakdown for this stage.</p>
          ) : (
            <div className="rounded border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs">Flow</TableHead>
                    <TableHead className="text-xs text-right">Entry</TableHead>
                    <TableHead className="text-xs text-right">Count</TableHead>
                    <TableHead className="text-xs text-right">Conv %</TableHead>
                    <TableHead className="text-xs text-right">Δ (pp)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flowRows.map((row, i) => (
                    <TableRow key={`${row.flow}-${i}`}>
                      <TableCell className="text-xs font-medium">{row.flow}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{row.entryLeads.toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{row.mtdLeads.toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-xs text-right">{row.mtdConv != null ? `${row.mtdConv.toFixed(1)}%` : "—"}</TableCell>
                      <TableCell className={cn(
                        "text-xs text-right tabular-nums",
                        row.deltaPp != null && row.deltaPp < 0 ? "text-red-600" : row.deltaPp != null && row.deltaPp > 0 ? "text-emerald-600" : ""
                      )}>
                        {row.deltaPp != null ? `${row.deltaPp >= 0 ? "+" : ""}${row.deltaPp}` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sub-stages (L2) */}
      {subStages.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Sub-stages (L2)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs">Sub-stage</TableHead>
                    <TableHead className="text-xs text-right">MTD leads</TableHead>
                    <TableHead className="text-xs text-right">LMTD leads</TableHead>
                    <TableHead className="text-xs text-right">Δ (pp)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subStages.map((sub) => (
                    <TableRow key={sub.sub_stage}>
                      <TableCell className="text-xs font-medium">{sub.sub_stage.replace(/_/g, " ")}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{sub.mtd_leads.toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{sub.lmtd_leads.toLocaleString("en-IN")}</TableCell>
                      <TableCell className={cn(
                        "text-xs text-right tabular-nums",
                        sub.delta_pp != null && sub.delta_pp < 0 ? "text-red-600" : sub.delta_pp != null && sub.delta_pp > 0 ? "text-emerald-600" : ""
                      )}>
                        {sub.delta_pp != null ? `${sub.delta_pp >= 0 ? "+" : ""}${sub.delta_pp}` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
