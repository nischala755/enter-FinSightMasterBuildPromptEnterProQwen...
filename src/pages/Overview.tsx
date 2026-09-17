import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, ArrowUpRight, CalendarClock, CircleDollarSign } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { PageHeader, MetricCard, RiskLevelBadge, SourceTag, SectionLabel } from "@/components/primitives";
import { HealthPanel } from "@/components/HealthGauge";
import { useFinSightState } from "@/hooks/useFinSight";
import { askQwen, buildQwenContext } from "@/services/qwen";
import {
  computeAtRiskCapital,
  computeFinancialHealth,
  financialBriefing,
  forecastCash,
  totalLeakage,
  riskSeverity,
} from "@/domain/engine";
import { inrCompact, daysLabel } from "@/domain/format";
import type { FinSightState, ScoreComponent } from "@/domain/types";
import { cn } from "@/lib/utils";

function HealthExplainSheet({ open, onOpenChange, components, score }: { open: boolean; onOpenChange: (o: boolean) => void; components: ScoreComponent[]; score: number }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-[480px]">
        <div className="p-5">
          <SheetTitle className="text-left text-[16px] font-semibold">Why the financial health score?</SheetTitle>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Each component is weighted; the score is the weighted sum, computed deterministically from the ledger.
          </p>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="tnum text-[34px] font-semibold">{score}</span>
            <span className="text-[12px] text-muted-foreground">/ 100 overall</span>
          </div>
          <div className="mt-4 space-y-4">
            {components.map((c) => (
              <div key={c.key} className="rounded-[4px] border border-border bg-card p-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] font-semibold">{c.label}</span>
                  <span className="tnum text-[13px] font-semibold">
                    {c.score}<span className="text-muted-foreground">/100</span>
                  </span>
                </div>
                <div className="mt-2 h-[5px] overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", c.score >= 80 ? "bg-positive" : c.score >= 55 ? "bg-warn" : "bg-danger")}
                    style={{ width: `${c.score}%` }}
                  />
                </div>
                <div className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">{c.detail}</div>
                <div className="tnum mt-1 text-[11px] text-muted-foreground">
                  Weight {c.weight}% · contribution {c.contribution.toFixed(1)} pts
                </div>
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function Overview() {
  const { data: state } = useFinSightState();
  const [explainOpen, setExplainOpen] = useState(false);
  const [liveBriefing, setLiveBriefing] = useState<{ text: string } | null>(null);

  // Qwen-generated briefing when live; deterministic template otherwise.
  useEffect(() => {
    let cancelled = false;
    if (state) {
      const ctx = buildQwenContext(state, "One-paragraph CFO briefing");
      ctx.question =
        "Write one plain-language paragraph briefing the CFO of Northstar Commerce. Cover: current cash, the 90-day outlook, the minimum-safe breach, the primary drivers, and the single most important recommended action. Use only the numbers and evidence provided — do not invent figures.";
      askQwen(ctx).then((r) => {
        if (r && !cancelled) setLiveBriefing({ text: r.answer });
      });
    }
    return () => {
      cancelled = true;
    };
  }, [state]);

  const view = useMemo(() => {
    if (!state) return null;
    const health = computeFinancialHealth(state);
    const base = forecastCash(state, "base");
    const leaks = totalLeakage(state);
    const atRisk = computeAtRiskCapital(state);
    const briefing = financialBriefing(state);
    const emerging = [...state.risks].sort((a, b) => riskSeverity(b).localeCompare(riskSeverity(a))).slice(0, 5);
    return { health, base, leaks, atRisk, briefing, emerging };
  }, [state]);

  if (!state || !view) return <div className="p-6 text-[13px] text-muted-foreground">Loading…</div>;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Overview"
        subtitle={`Northstar Commerce · INR · ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}`}
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard label="Current cash" value={inrCompact(state.currentCash)} sub="vs min-safe floor" tone="neutral" />
        <MetricCard
          label="90-day forecast"
          value={inrCompact(view.base.day90Balance)}
          delta={{ value: view.base.day90Balance - state.currentCash, suffix: " vs today", positiveIsGood: false }}
          tone="warn"
          sub={
            view.base.breachDay ? (
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="h-3 w-3 text-danger" />
                breach in {daysLabel(view.base.breachDay)}
              </span>
            ) : (
              "no breach projected"
            )
          }
        />
        <MetricCard label="At-risk capital" value={inrCompact(view.atRisk.total)} tone="danger" sub="exposure beyond collection norms" />
        <MetricCard label="Recoverable leakage" value={inrCompact(view.leaks)} tone="positive" sub="annualised · 6 categories" />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[300px_1fr]">
        {/* Health + explainability */}
        <HealthPanel health={view.health} onExplain={() => setExplainOpen(true)} />

        {/* AI briefing */}
        <div className="flex flex-col rounded-[4px] border border-panel-border bg-panel p-5 text-panel-foreground">
            <div className="flex items-center justify-between">
              <SectionLabel className="text-panel-foreground/45">AI financial briefing</SectionLabel>
              <div className="flex items-center gap-2">
                <SourceTag kind="AI-recommendation" />
                <span className={cn("rounded-[3px] border px-1.5 py-[1px] text-[10px]", liveBriefing ? "border-positive/40 bg-positive/10 text-positive" : "border-panel-border text-panel-foreground/50")}>
                  {liveBriefing ? "Qwen · live" : "Demo intelligence mode"}
                </span>
              </div>
            </div>
          <p className="mt-4 flex-1 text-[14px] leading-relaxed text-panel-foreground/85">{liveBriefing?.text ?? view.briefing}</p>

          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-panel-border pt-4 sm:grid-cols-4">
            <BriefStat label="Expected inflows (90d)" value={inrCompact(view.base.series.filter((p) => p.inflow > 0).reduce((s, p) => s + p.inflow, 0))} />
            <BriefStat label="Commitments (90d)" value={inrCompact(view.base.series.filter((p) => p.outflow > 0).reduce((s, p) => s + p.outflow, 0))} />
            <BriefStat label="Liquidity exposure" value={inrCompact(view.base.liquidityExposure)} tone="danger" />
            <BriefStat label="Min-safe floor" value={inrCompact(state.minSafeCash)} />
          </div>
        </div>
      </div>

      {/* Emerging risks */}
      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.12em] text-foreground">
            <ShieldAlert className="h-4 w-4 text-brand" /> Emerging risks
          </h2>
          <Link to="/risk-radar" className="flex items-center gap-1 text-[12px] font-semibold text-brand hover:underline">
            Full radar <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {view.emerging.map((r) => (
            <Link
              key={r.id}
              to={`/risk-radar?risk=${r.id}`}
              className="group rounded-[4px] border bg-card p-4 transition-colors hover:border-brand/40"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10.5px] text-muted-foreground">{r.id}</span>
                <RiskLevelBadge level={r.level} />
              </div>
              <div className="mt-1.5 text-[14px] font-semibold leading-snug group-hover:text-brand">{r.title}</div>
              <div className="mt-2 flex items-center justify-between text-[11.5px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CircleDollarSign className="h-3 w-3" /> {inrCompact(r.impact)} at risk
                </span>
                <span>horizon {daysLabel(r.horizonDays)}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <HealthExplainSheet open={explainOpen} onOpenChange={setExplainOpen} components={view.health.components} score={view.health.score} />
    </div>
  );
}

function BriefStat({ label, value, tone }: { label: string; value: string; tone?: "danger" | "positive" }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.12em] text-panel-foreground/45">{label}</div>
      <div className={cn("tnum mt-1 text-[17px] font-semibold", tone === "danger" ? "text-danger" : tone === "positive" ? "text-positive" : "text-panel-foreground")}>
        {value}
      </div>
    </div>
  );
}

export type { FinSightState };
