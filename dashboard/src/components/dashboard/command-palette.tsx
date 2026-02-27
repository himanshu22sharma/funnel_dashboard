"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Search, ArrowRight, BarChart3, Users, Activity, Target, FileText, Zap } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface CommandItem {
  id: string;
  label: string;
  category: string;
  icon: typeof Search;
  action: () => void;
}

interface CommandPaletteProps {
  stages: { index: number; name: string }[];
  lenders: string[];
  onStageClick: (index: number) => void;
  onNavigate: (path: string) => void;
}

export function CommandPalette({ stages, lenders, onStageClick, onNavigate }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        setQuery("");
        setSelectedIdx(0);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const items: CommandItem[] = [
    ...stages.map((s) => ({
      id: `stage-${s.index}`,
      label: `Go to ${s.name.replace(/_/g, " ")}`,
      category: "Stages",
      icon: BarChart3,
      action: () => { onStageClick(s.index); setOpen(false); },
    })),
    ...lenders.slice(0, 8).map((l) => ({
      id: `lender-${l}`,
      label: `Filter by ${l}`,
      category: "Lenders",
      icon: Users,
      action: () => { setOpen(false); },
    })),
    { id: "nav-insights", label: "Go to Insights & Briefing", category: "Navigation", icon: Zap, action: () => { onNavigate("/insights-summary"); setOpen(false); } },
    { id: "nav-exec", label: "Go to Executive Summary", category: "Navigation", icon: Target, action: () => { onNavigate("/executive-summary"); setOpen(false); } },
    { id: "nav-disbursal", label: "Go to Disbursal Summary", category: "Navigation", icon: Activity, action: () => { onNavigate("/disbursal-summary"); setOpen(false); } },
    { id: "nav-alerts", label: "Go to Alert Tracking", category: "Navigation", icon: FileText, action: () => { onNavigate("/alert-tracking"); setOpen(false); } },
  ];

  const filtered = query.trim()
    ? items.filter((i) => i.label.toLowerCase().includes(query.toLowerCase()))
    : items;

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && filtered[selectedIdx]) { filtered[selectedIdx].action(); }
    if (e.key === "Escape") { setOpen(false); }
  }, [filtered, selectedIdx]);

  const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, item) => {
    (acc[item.category] ??= []).push(item);
    return acc;
  }, {});

  let globalIdx = -1;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Search stages, lenders, pages..."
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
          />
          <kbd className="text-[9px] font-mono text-muted-foreground border rounded px-1 py-0.5">Esc</kbd>
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {Object.entries(grouped).map(([category, catItems]) => (
            <div key={category}>
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">{category}</p>
              {catItems.map((item) => {
                globalIdx++;
                const idx = globalIdx;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.action}
                    onMouseEnter={() => setSelectedIdx(idx)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-2 py-1.5 rounded text-left transition-colors",
                      idx === selectedIdx ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-[11px] flex-1">{item.label}</span>
                    <ArrowRight className="h-3 w-3 opacity-40" />
                  </button>
                );
              })}
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-[11px] text-muted-foreground text-center py-6">No results for &ldquo;{query}&rdquo;</p>
          )}
        </div>
        <div className="flex items-center justify-between border-t px-3 py-1.5 bg-muted/20">
          <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
            <span><kbd className="font-mono border rounded px-0.5">↑↓</kbd> navigate</span>
            <span><kbd className="font-mono border rounded px-0.5">↵</kbd> select</span>
          </div>
          <span className="text-[9px] text-muted-foreground">{filtered.length} results</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
