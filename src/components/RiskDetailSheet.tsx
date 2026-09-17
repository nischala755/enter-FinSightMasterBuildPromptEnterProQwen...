import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CausalGraph } from "@/components/CausalGraph";
import { ConfidenceBar, EvidenceList, RiskLevelBadge, SourceTag } from "@/components/primitives";
import { explainRiskScore } from "@/domain/engine";
import { inrCompact, daysLabel } from "@/domain/format";
import type { Risk } from "@/domain/types";
import { CheckCheck, GitBranch, Handshake, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  risk: Risk | null;
  onAcknowledge?: () => void;
  onCreateWorkflow?: () => void;
  acknowledgePending?: boolean;
  workflowPending?: boolean;
  onExplainHealth?: () => void;
  healthScore?: number | null;
}

function useInterval(fn: () => void, ms: number | null) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (ms === null) return;
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}

export function RiskDetailSheet({ open, onOpenChange, risk, onAcknowledge, onCreateWorkflow, acknowledgePending, workflowPending }: Props) {
  const [traceIndex, setTraceIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!open) {
      setTraceIndex(-1);
      setPlaying(false);
    }
  }, [open]);

  useEffect(() => {
    // Restart the trace when a new risk opens.
    if (open && risk) {
      setTraceIndex(-1);
      setPlaying(true);
      setTimeout(() => setTraceIndex(0), 350);
    }
  }, [open, risk?.id]);

  useInterval(() => {
    if (!playing || !risk) return;
    setTraceIndex((i) => {
      if (i >= risk.causalChain.length - 1) {
        setPlaying(false);
        return i;
      }
      return i + 1;
    });
  }, playing ? 1500 : null);

  if (!risk) return null;

  const explain = explainRiskScore(risk);
  const showExplain = open;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-[620px]">
        <div className="flex h-full flex-col">
          <div className="border-b p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-muted-foreground">{risk.id}</span>
                <RiskLevelBadge level={risk.level} />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px]"
                  disabled={acknowledgePending}
                  onClick={onAcknowledge}
                >
                  {acknowledgePending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCheck className="mr-1 h-3 w-3" />}
                  Acknowledge
                </Button>
                <Button
                  size="sm"
                  className="h-7 bg-brand text-[11px] font-semibold text-brand-foreground hover:bg-brand"
                  disabled={workflowPending}
                  onClick={onCreateWorkflow}
                >
                  {workflowPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Handshake className="mr-1 h-3 w-3" />}
                  Create EnterPro workflow
                </Button>
              </div>
            </div>
            <SheetTitle className="mt-2 text-left text-[19px] font-semibold tracking-tight">{risk.title}</SheetTitle>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniStat label="Impact" value={inrCompact(risk.impact)} />
              <MiniStat label="Probability" value={`${Math.round(risk.probability * 100)}%`} />
              <MiniStat label="Horizon" value={daysLabel(risk.horizonDays)} />
              <div>
                <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Confidence</div>
                <div className="mt-1">
                  <ConfidenceBar value={risk.confidence} />
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            {/* Trace Cause */}
            <section>
              <div className="mb-2 flex items-center gap-2">
                <GitBranch className="h-3.5 w-3.5 text-brand" />
                <h4 className="text-[12px] font-bold uppercase tracking-[0.12em]">Trace cause</h4>
                <SourceTag kind="Calculated" />
              </div>
              <CausalGraph
                nodes={risk.causalChain}
                activeIndex={traceIndex}
                playing={playing}
                onToggle={() => setPlaying((p) => !p)}
                onRestart={() => {
                  setTraceIndex(0);
                  setPlaying(true);
                }}
              />
            </section>

            {/* Why this score */}
            {showExplain && (
              <section className="rounded-[4px] border border-border bg-card p-4">
                <h4 className="text-[12px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Why this score</h4>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="tnum text-[28px] font-semibold">{explain.total}</span>
                  <span className="text-[12px] text-muted-foreground">composite risk score (0–100)</span>
                </div>
                <div className="mt-3 space-y-2">
                  {explain.parts.map((p) => (
                    <div key={p.label} className="flex items-center justify-between gap-3 text-[12px]">
                      <div className="flex-1">
                        <div className="flex justify-between">
                          <span className="font-medium">{p.label}</span>
                          <span className="tnum text-muted-foreground">
                            {p.score.toFixed(0)} × {Math.round(p.weight * 100)}% = {p.contribution.toFixed(1)}
                          </span>
                        </div>
                        <div className="mt-1 h-[5px] overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-brand" style={{ width: `${p.score}%` }} />
                        </div>
                        <div className="mt-0.5 text-[10.5px] text-muted-foreground">{p.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Drivers */}
            <section>
              <h4 className="mb-2 text-[12px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Drivers</h4>
              <ul className="space-y-1.5">
                {risk.drivers.map((d, i) => (
                  <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed">
                    <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-brand" />
                    {d}
                  </li>
                ))}
              </ul>
            </section>

            {/* Evidence */}
            <section>
              <h4 className="mb-2 text-[12px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Evidence</h4>
              <div className="rounded-[4px] border border-border bg-card p-3">
                <EvidenceList items={risk.evidence} />
              </div>
            </section>

            {/* Recommended action */}
            <section className="rounded-[4px] border border-brand/30 bg-brand-soft/60 p-4">
              <h4 className="text-[12px] font-bold uppercase tracking-[0.12em] text-brand">Recommended action</h4>
              <p className="mt-1.5 text-[13px] leading-relaxed text-foreground">{risk.recommendedAction}</p>
              <div className="mt-2">
                <SourceTag kind="AI-recommendation" />
              </div>
            </section>

            <div className={cn("flex items-center gap-2 text-[11px] text-muted-foreground")}>
              <span className="rounded-[3px] border border-border px-1.5 py-[1px]">Updated {new Date(risk.lastUpdated).toLocaleDateString("en-IN")}</span>
              <span className="text-muted-foreground/60">All figures calculated deterministically from the ledger.</span>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className="tnum mt-0.5 text-[15px] font-semibold">{value}</div>
    </div>
  );
}
