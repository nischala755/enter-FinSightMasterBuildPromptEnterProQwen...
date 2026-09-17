import type { CausalNode } from "@/domain/types";
import { ChevronRight, RotateCcw, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EvidenceList } from "@/components/primitives";
import { cn } from "@/lib/utils";

interface Props {
  nodes: CausalNode[];
  activeIndex: number;
  playing: boolean;
  onToggle: () => void;
  onRestart: () => void;
}

/**
 * Trace Cause — an animated causal graph. Each node lights up in sequence,
 * showing its metric/value and linked evidence. Evidence-first: every arrow
 * in the chain is backed by real invoice/vendor/PO IDs.
 */
export function CausalGraph({ nodes, activeIndex, playing, onToggle, onRestart }: Props) {
  const active = nodes[activeIndex];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Causal chain · node {Math.max(0, activeIndex) + 1} of {nodes.length}
        </div>
        <div className="flex gap-1.5">
          <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={onToggle}>
            {playing ? <Pause className="mr-1 h-3 w-3" /> : <Play className="mr-1 h-3 w-3" />}
            {playing ? "Pause" : "Play"}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={onRestart}>
            <RotateCcw className="mr-1 h-3 w-3" /> Restart
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-y-3">
        {nodes.map((node, i) => {
          const isActive = i === activeIndex;
          const isPast = i < activeIndex;
          return (
            <div key={node.id} className="flex items-center">
              <div
                className={cn(
                  "w-[190px] rounded-[4px] border p-3 transition-all duration-300",
                  isActive
                    ? "border-brand bg-brand-soft shadow-[0_0_0_3px_hsl(var(--brand)/0.15)]"
                    : isPast
                      ? "border-border bg-card opacity-60"
                      : "border-border bg-card opacity-90",
                )}
              >
                <div className={cn("text-[12px] font-semibold leading-snug", isActive ? "text-brand" : "text-foreground")}>
                  {node.label}
                </div>
                {node.metric && <div className="mt-1 text-[10.5px] text-muted-foreground">{node.metric}</div>}
                {node.value && <div className="tnum mt-0.5 text-[12px] font-semibold text-foreground">{node.value}</div>}
              </div>
              {i < nodes.length - 1 && (
                <div className="flex items-center px-1">
                  <ChevronRight className={cn("h-4 w-4", i < activeIndex ? "text-brand" : "text-muted-foreground/40")} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-[4px] border border-border bg-card p-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Evidence at this node</div>
        <div className="mt-2">
          {active?.evidence && active.evidence.length > 0 ? (
            <EvidenceList items={active.evidence} />
          ) : (
            <span className="text-[12px] italic text-muted-foreground">
              Aggregated from {active?.metric ?? "the linked ledger"} — see the risk card's evidence below for the underlying records.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
