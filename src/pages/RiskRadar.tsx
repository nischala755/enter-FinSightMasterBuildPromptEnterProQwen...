import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { GitBranch, SlidersHorizontal } from "lucide-react";
import { PageHeader, RiskLevelBadge, ConfidenceBar, EmptyState } from "@/components/primitives";
import { RiskDetailSheet } from "@/components/RiskDetailSheet";
import {
  useAcknowledgeRisk,
  useCreateWorkflowFromRisk,
  useFinSightState,
  useRecordRiskTrace,
} from "@/hooks/useFinSight";
import { explainRiskScore, riskSeverity } from "@/domain/engine";
import { inrCompact, daysLabel } from "@/domain/format";
import type { Risk, RiskCategory } from "@/domain/types";
import { useDemoIntent } from "@/components/demo/DemoWalkthrough";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const CATEGORY_LABEL: Record<RiskCategory, string> = {
  liquidity: "Liquidity",
  receivables: "Receivables",
  vendor: "Vendor",
  duplicate: "Duplicate",
  subscription: "Subscriptions",
  inventory: "Inventory",
  penalties: "Penalties",
};

export function RiskRadar() {
  const { data: state } = useFinSightState();
  const [params, setParams] = useSearchParams();
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [catFilter, setCatFilter] = useState<string>("all");

  const riskParam = params.get("risk");
  const [selected, setSelected] = useState<Risk | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const ack = useAcknowledgeRisk();
  const create = useCreateWorkflowFromRisk();
  const trace = useRecordRiskTrace();
  const { intent } = useDemoIntent();

  const risks = useMemo(() => {
    if (!state) return [];
    return [...state.risks]
      .sort((a, b) => riskSeverity(b).localeCompare(riskSeverity(a)) || b.impact - a.impact)
      .filter((r) => (levelFilter === "all" ? true : r.level === levelFilter))
      .filter((r) => (catFilter === "all" ? true : r.category === catFilter));
  }, [state, levelFilter, catFilter]);

  // Open from query param (?risk=R-01)
  useEffect(() => {
    if (riskParam && state) {
      const r = state.risks.find((x) => x.id === riskParam);
      if (r) {
        setSelected(r);
        setSheetOpen(true);
        setParams({}, { replace: true });
      }
    }
  }, [riskParam, state, setParams]);

  // Demo intent: open R-01 and run the trace
  useEffect(() => {
    if (intent.type === "open-risk" && intent.riskId && state) {
      const r = state.risks.find((x) => x.id === intent.riskId);
      if (r) {
        setSelected(r);
        setSheetOpen(true);
        trace.mutate(r.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent.ref, state]);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Risk Radar"
        subtitle="Every risk is scored deterministically from the ledger, with a traceable causal chain and real evidence. Select a risk to trace its cause."
        actions={
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} className="h-8 rounded-[3px] border bg-card px-2 text-[12px]">
              <option value="all">All levels</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="h-8 rounded-[3px] border bg-card px-2 text-[12px]">
              <option value="all">All categories</option>
              {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        }
      />

      {risks.length === 0 ? (
        <EmptyState title="No risks match the filter" hint="Clear the level or category filter to see all tracked risks." />
      ) : (
        <div className="space-y-2">
          {risks.map((r) => {
            const score = explainRiskScore(r);
            return (
              <div key={r.id} className="grid grid-cols-1 gap-3 rounded-[4px] border bg-card p-4 transition-colors hover:border-brand/40 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10.5px] text-muted-foreground">{r.id}</span>
                    <RiskLevelBadge level={r.level} />
                    <span className="text-[10.5px] uppercase tracking-wide text-muted-foreground">{CATEGORY_LABEL[r.category]}</span>
                  </div>
                  <button
                    className="mt-1 text-left text-[15px] font-semibold leading-snug hover:text-brand"
                    onClick={() => {
                      setSelected(r);
                      setSheetOpen(true);
                    }}
                  >
                    {r.title}
                  </button>
                  <p className="mt-1 line-clamp-1 text-[12px] text-muted-foreground">{r.drivers[0]}</p>
                </div>

                <div className="grid grid-cols-4 items-center gap-2 text-[11.5px] lg:grid-cols-2">
                  <span className="text-muted-foreground">Impact <span className="tnum font-semibold text-foreground">{inrCompact(r.impact)}</span></span>
                  <span className="text-muted-foreground">Horizon <span className="tnum font-semibold text-foreground">{daysLabel(r.horizonDays)}</span></span>
                  <span className="text-muted-foreground">Prob <span className="tnum font-semibold text-foreground">{Math.round(r.probability * 100)}%</span></span>
                  <span className="text-muted-foreground">Score <span className="tnum font-semibold text-foreground">{score.total}</span></span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="hidden xl:block">
                    <ConfidenceBar value={r.confidence} label="evidence" />
                  </div>
                  <button
                    className={cn(
                      "flex h-8 shrink-0 items-center gap-1.5 rounded-[3px] border px-2.5 text-[11.5px] font-semibold",
                      "border-brand/40 bg-brand-soft text-brand hover:bg-brand hover:text-brand-foreground transition-colors",
                    )}
                    onClick={() => {
                      setSelected(r);
                      setSheetOpen(true);
                      trace.mutate(r.id);
                    }}
                  >
                    <GitBranch className="h-3.5 w-3.5" /> Trace cause
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <RiskDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        risk={selected}
        acknowledgePending={ack.isPending}
        workflowPending={create.isPending}
        onAcknowledge={() => {
          if (selected) {
            ack.mutate(selected.id);
            toast.success(`${selected.id} acknowledged — recorded to audit trail`);
          }
        }}
        onCreateWorkflow={() => {
          if (selected) {
            create.mutate(selected.id);
            toast.success(`EnterPro workflow created for ${selected.id}`);
          }
        }}
      />
    </div>
  );
}
