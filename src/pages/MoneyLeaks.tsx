import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Recycle, Lock } from "lucide-react";
import { PageHeader, MetricCard, ConfidenceBar, EvidenceList, SourceTag, EmptyState } from "@/components/primitives";
import { useEnterproRecoverLeak, useFinSightState } from "@/hooks/useFinSight";
import { leakageByCategory, totalLeakage } from "@/domain/engine";
import { inrCompact, inrFull } from "@/domain/format";
import type { LeakCategory } from "@/domain/types";
import { useDemoIntent } from "@/components/demo/DemoWalkthrough";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const CATEGORY_META: Record<LeakCategory, { label: string; tone: string }> = {
  "vendor-price-creep": { label: "Vendor price creep", tone: "bg-warn/10 text-warn border-warn/30" },
  "unused-subscriptions": { label: "Unused subscriptions", tone: "bg-muted text-muted-foreground border-border" },
  "duplicate-invoices": { label: "Duplicate invoices", tone: "bg-danger/10 text-danger border-danger/30" },
  "late-payment-penalties": { label: "Late-payment penalties", tone: "bg-warn/10 text-warn border-warn/30" },
  "expense-anomalies": { label: "Expense anomalies", tone: "bg-muted text-muted-foreground border-border" },
  "receivable-leakage": { label: "Receivable leakage", tone: "bg-brand-soft text-brand border-brand/30" },
};

export function MoneyLeaks() {
  const { data: state } = useFinSightState();
  const recover = useEnterproRecoverLeak();
  const [openId, setOpenId] = useState<string | null>(null);
  const { intent } = useDemoIntent();

  const total = useMemo(() => (state ? totalLeakage(state) : 0), [state]);
  const byCat = useMemo(() => (state ? leakageByCategory(state) : {} as Record<LeakCategory, number>), [state]);

  // Demo intent: recover LK-03 automatically
  useEffect(() => {
    if (intent.type === "recover" && intent.leakId && state) {
      const leak = state.leaks.find((l) => l.id === intent.leakId);
      if (leak && (leak.status === "open")) {
        recover.mutate(intent.leakId);
        toast.success("Duplicate payment recovery workflow created");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent.ref, state]);

  if (!state) return <div className="p-6 text-[13px] text-muted-foreground">Loading…</div>;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Money Leaks"
        subtitle="Recoverable value escaping the business each year, detected deterministically from the ledger. Each item carries its detection rationale, baseline comparison and linked evidence."
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-2">
          {state.leaks.map((leak) => {
            const meta = CATEGORY_META[leak.category];
            const open = openId === leak.id;
            const recovering = leak.status !== "open";
            return (
              <div key={leak.id} className="rounded-[4px] border bg-card">
                <button
                  className="flex w-full items-center gap-3 p-4 text-left"
                  onClick={() => setOpenId(open ? null : leak.id)}
                >
                  <span className={cn("shrink-0 rounded-[3px] border px-1.5 py-[1px] text-[10px] font-semibold tracking-wide", meta.tone)}>
                    {meta.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold">{leak.title}</div>
                    <div className="text-[11.5px] text-muted-foreground">{leak.frequency} · detected via ledger match</div>
                  </div>
                  <div className="tnum shrink-0 text-[15px] font-semibold text-positive">{inrCompact(leak.amount)}</div>
                  <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
                </button>

                {open && (
                  <div className="grid grid-cols-1 gap-4 border-t p-4 md:grid-cols-2">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Why it was detected</div>
                      <p className="mt-1 text-[12.5px] leading-relaxed">{leak.detectedReason}</p>
                      <div className="mt-3">
                        <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Baseline comparison</div>
                        <p className="mt-1 text-[12.5px] text-muted-foreground">{leak.baselineComparison}</p>
                      </div>
                      <div className="mt-3 flex items-center gap-4">
                        <ConfidenceBar value={leak.confidence} label="confidence" />
                        <SourceTag kind="Calculated" />
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Evidence</div>
                      <div className="mt-1 flex-1">
                        <EvidenceList items={leak.evidence} />
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t pt-3">
                        <span className="text-[11.5px] text-muted-foreground">
                          {recovering ? "Recovery in progress" : `Annualised value ${inrFull(leak.amount)}`}
                        </span>
                        <button
                          disabled={recovering}
                          className={cn(
                            "flex h-8 items-center gap-1.5 rounded-[3px] px-3 text-[11.5px] font-semibold transition-colors",
                            recovering
                              ? "cursor-not-allowed border border-border text-muted-foreground/50"
                              : "border border-positive/40 bg-positive/10 text-positive hover:bg-positive hover:text-positive-foreground",
                          )}
                          onClick={() => {
                            recover.mutate(leak.id);
                            toast.success(`Recovery workflow created for ${leak.id} — tracked in Workflows`);
                          }}
                        >
                          {recovering ? <Lock className="h-3.5 w-3.5" /> : <Recycle className="h-3.5 w-3.5" />}
                          {recovering ? "Recovery in progress" : "Recover this value"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {state.leaks.length === 0 && <EmptyState title="No leaks detected" />}
        </div>

        {/* Right rail: totals + breakdown */}
        <div className="space-y-3">
          <MetricCard label="Total recoverable leakage" value={inrCompact(total)} tone="positive" sub="annualised, 6 categories" />
          <div className="rounded-[4px] border bg-card p-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Category breakdown</div>
            <div className="mt-3 space-y-2.5">
              {Object.entries(CATEGORY_META).map(([key, meta]) => {
                const amt = byCat[key as LeakCategory] ?? 0;
                const pct = total > 0 ? (amt / total) * 100 : 0;
                return (
                  <div key={key}>
                    <div className="flex items-baseline justify-between text-[11.5px]">
                      <span className="text-muted-foreground">{meta.label}</span>
                      <span className="tnum font-semibold">{inrCompact(amt)}</span>
                    </div>
                    <div className="mt-1 h-[5px] overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
