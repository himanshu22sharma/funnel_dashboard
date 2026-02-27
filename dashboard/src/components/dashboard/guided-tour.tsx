"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { X, ChevronRight, ChevronLeft, HelpCircle } from "lucide-react";

// ── Tour step definitions ──────────────────────────────────────────
export interface TourStep {
  target: string;
  title: string;
  body: string;
  placement?: "top" | "bottom" | "left" | "right";
}

const ALL_TOUR_STEPS: TourStep[] = [
  {
    target: "funnel-filters",
    title: "Filters",
    body: "Slice data by Lender, Program or Flow. All charts and insights update in real-time.",
    placement: "bottom",
  },
  {
    target: "funnel-chart",
    title: "Funnel Visualization",
    body: "Each bar represents a stage. Click any stage name or bar to open a deep-dive with Business Insights, Lender Funnel and L2 Breakdown.",
    placement: "bottom",
  },
  {
    target: "ratio-metrics",
    title: "End-to-End Conversion",
    body: "Key disbursement ratios vs. workable leads, BRE1 completed and child leads. Compare MTD with LMTD at a glance.",
    placement: "top",
  },
  {
    target: "key-focus-areas",
    title: "Key Focus Areas",
    body: "Auto-detected drops and anomalies your team should investigate. Click any item to jump straight into the stage deep-dive.",
    placement: "top",
  },
];

const STORAGE_KEY = "funnel_dashboard_tour_v1";

function getEl(target: string): Element | null {
  return document.querySelector(`[data-tour="${target}"]`);
}

// ── Tooltip Positioner ─────────────────────────────────────────────
function TooltipCard({
  step,
  currentIndex,
  total,
  onNext,
  onPrev,
  onClose,
}: {
  step: TourStep;
  currentIndex: number;
  total: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    const el = getEl(step.target);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });

    const reposition = () => {
      const el = getEl(step.target);
      if (!el || !ref.current) return;
      const rect = el.getBoundingClientRect();
      const card = ref.current.getBoundingClientRect();
      const gap = 12;
      let top = 0;
      let left = 0;
      const p = step.placement || "bottom";
      if (p === "bottom") {
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2 - card.width / 2;
      } else if (p === "top") {
        top = rect.top - card.height - gap;
        left = rect.left + rect.width / 2 - card.width / 2;
      } else if (p === "right") {
        top = rect.top + rect.height / 2 - card.height / 2;
        left = rect.right + gap;
      } else {
        top = rect.top + rect.height / 2 - card.height / 2;
        left = rect.left - card.width - gap;
      }
      left = Math.max(12, Math.min(left, window.innerWidth - card.width - 12));
      top = Math.max(12, top);
      setPos({ top, left });
      setReady(true);
    };
    const t = setTimeout(reposition, 400);
    window.addEventListener("resize", reposition);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", reposition);
    };
  }, [step]);

  return (
    <div
      ref={ref}
      className={cn(
        "fixed z-[10001] w-[320px] rounded-xl border border-primary/30 bg-background shadow-2xl p-4 transition-opacity duration-200",
        ready ? "opacity-100" : "opacity-0"
      )}
      style={{ top: pos.top, left: pos.left }}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-2.5 right-2.5 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Close tour"
      >
        <X className="w-4 h-4" />
      </button>
      <h3 className="text-sm font-semibold text-foreground mb-1">{step.title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed mb-3">{step.body}</p>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {currentIndex + 1} / {total}
        </span>
        <div className="flex gap-1.5">
          {currentIndex > 0 && (
            <button
              type="button"
              onClick={onPrev}
              className="flex items-center gap-0.5 px-2.5 py-1 text-xs font-medium rounded-md border border-border hover:bg-muted transition-colors"
            >
              <ChevronLeft className="w-3 h-3" /> Back
            </button>
          )}
          <button
            type="button"
            onClick={onNext}
            className="flex items-center gap-0.5 px-3 py-1 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {currentIndex === total - 1 ? "Got it" : "Next"} {currentIndex < total - 1 && <ChevronRight className="w-3 h-3" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Highlight Overlay ──────────────────────────────────────────────
function HighlightOverlay({ target }: { target: string }) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const update = () => {
      const el = getEl(target);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    update();
    const t = setTimeout(update, 400);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [target]);

  if (!rect) return null;
  const pad = 6;
  return (
    <div
      className="fixed inset-0 z-[10000] pointer-events-none"
      style={{
        boxShadow: `0 0 0 100vmax rgba(0,0,0,0.45)`,
        clipPath: `polygon(0% 0%, 0% 100%, ${rect.left - pad}px 100%, ${rect.left - pad}px ${rect.top - pad}px, ${rect.right + pad}px ${rect.top - pad}px, ${rect.right + pad}px ${rect.bottom + pad}px, ${rect.left - pad}px ${rect.bottom + pad}px, ${rect.left - pad}px 100%, 100% 100%, 100% 0%)`,
      }}
    >
      <div
        className="absolute rounded-lg border-2 border-primary/50"
        style={{
          top: rect.top - pad,
          left: rect.left - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
        }}
      />
    </div>
  );
}

// ── Welcome Screen ─────────────────────────────────────────────────
function WelcomeScreen({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  return (
    <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-2xl border shadow-2xl p-8 max-w-md w-full mx-4">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-foreground">Welcome to Lending Funnel</h2>
          <p className="text-xs text-muted-foreground mt-1">Your end-to-end lead analytics dashboard</p>
        </div>
        <div className="space-y-3 mb-6">
          <div className="flex gap-3 items-start">
            <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold text-primary">1</span>
            <p className="text-sm text-muted-foreground"><span className="text-foreground font-medium">Filter</span> by lender, program or flow to slice the data</p>
          </div>
          <div className="flex gap-3 items-start">
            <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold text-primary">2</span>
            <p className="text-sm text-muted-foreground"><span className="text-foreground font-medium">Click any funnel stage</span> to see Business Insights, Lender Funnel and L2 Breakdown</p>
          </div>
          <div className="flex gap-3 items-start">
            <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold text-primary">3</span>
            <p className="text-sm text-muted-foreground"><span className="text-foreground font-medium">Deep-dive further</span> — click insight rows, lender combos and L2 stages for granular detail</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onStart}
            className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Take a Quick Tour
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="px-4 py-2.5 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Pulse Hint (contextual micro-hint) ─────────────────────────────
export function PulseHint({
  text,
  visible,
  onDismiss,
  className: extraClass,
}: {
  text: string;
  visible: boolean;
  onDismiss?: () => void;
  className?: string;
}) {
  if (!visible) return null;
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-[11px] text-primary font-medium",
        extraClass
      )}
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/60" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
      </span>
      {text}
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="ml-1 hover:text-primary/70">
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ── Contextual Hint (shown once per context) ───────────────────────
export function useContextualHint(key: string): [boolean, () => void] {
  const storageKey = `funnel_hint_${key}`;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(storageKey);
    if (!seen) setVisible(true);
  }, [storageKey]);

  const dismiss = useCallback(() => {
    setVisible(false);
    localStorage.setItem(storageKey, "1");
  }, [storageKey]);

  return [visible, dismiss];
}

// ── Main Tour Controller ───────────────────────────────────────────
export function GuidedTour() {
  const [phase, setPhase] = useState<"loading" | "welcome" | "touring" | "done">("loading");
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    setPhase(seen ? "done" : "welcome");
  }, []);

  const finishTour = useCallback(() => {
    setPhase("done");
    localStorage.setItem(STORAGE_KEY, "1");
  }, []);

  const startTour = useCallback(() => {
    setStepIndex(0);
    setPhase("touring");
  }, []);

  // Filter to steps whose target element exists on the page
  const [steps, setSteps] = useState<TourStep[]>([]);
  useEffect(() => {
    if (phase === "touring") {
      const available = ALL_TOUR_STEPS.filter((s) => !!getEl(s.target));
      setSteps(available);
      if (available.length === 0) finishTour();
    }
  }, [phase, finishTour]);

  if (phase === "loading" || phase === "done") return null;

  if (phase === "welcome") {
    return <WelcomeScreen onStart={startTour} onSkip={finishTour} />;
  }

  if (steps.length === 0) return null;
  const current = steps[Math.min(stepIndex, steps.length - 1)];

  return (
    <>
      <HighlightOverlay target={current.target} />
      <TooltipCard
        step={current}
        currentIndex={stepIndex}
        total={steps.length}
        onNext={() => {
          if (stepIndex < steps.length - 1) setStepIndex(stepIndex + 1);
          else finishTour();
        }}
        onPrev={() => setStepIndex(Math.max(0, stepIndex - 1))}
        onClose={finishTour}
      />
    </>
  );
}

// ── Help Button (restart tour) ─────────────────────────────────────
export function TourHelpButton() {
  const restart = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith("funnel_hint_")) localStorage.removeItem(k);
    });
    window.location.reload();
  }, []);

  return (
    <button
      type="button"
      onClick={restart}
      title="Restart guided tour"
      className="fixed bottom-20 right-6 z-[9999] w-9 h-9 rounded-full bg-muted border border-border text-muted-foreground shadow-md hover:bg-accent hover:text-foreground transition-all hover:scale-105 flex items-center justify-center"
    >
      <HelpCircle className="w-5 h-5" />
    </button>
  );
}
