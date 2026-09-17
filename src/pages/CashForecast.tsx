import { useMemo, useState } from "react";
import { CalendarClock, Info } from "lucide-react";
import { PageHeader, MetricCard, SectionLabel, SourceTag } from "@/components/primitives";
import { CashChart } from "@/components/CashChart";
import { useFinSightState } from "@/hooks/useFinSight";
import { forecastCash } from "@/domain/engine";
import { inrCompact, daysLabel } from "@/domain/format";
import type { CaseType } from "@/domain/types";
import { cn } from "@/lib/utils";

const CASES: { id: CaseType; label: string; color: string; note: string }[] = [
  { id: "base", label: "Base", color: "hsl(var(--brand))", note: "Settlement lands on schedule (55% confidence)" },
  { id: "downside", label: "Downside", color: "hsl(var(--danger))", note: "Aster settlement slips ~30 days; catch-up collections shrink" },
  { id: "upside", label: "Upside", color: "hsl(var(--positive))", note: "Early settlement + deferred PO-1184" },
];

export function CashForecast() {
  const { data: state } = useFinSightState();
  const [caseType, setCaseType] = useState<CaseType>("base");

  const view = useMemo(() => {
    if (!state) return null;
    const selected = forecastCash(state, caseType);
    return { selected };
  }, [state, caseType]);

  if (!state || !view) return <div className="p-6 text-[13px] text-muted-foreground">Loading…</div>;

  const meta = CASES.find((c) => c.id === caseType)!;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Cash Forecast"
        subtitle="Historical position plus a deterministic 90-day projection from current receivables, commitments and payment behaviour. The floor is the minimum safe cash balance."
        actions={
          <div className="flex rounded-[3px] border bg-card p-0.5">
            {CASES.map((c) => (
              <button
                key={c.id}
                className={cn(
                  "rounded-[2px] px-3 py-1.5 text-[12px] font-semibold transition-colors",
                  caseType === c.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setCaseType(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
        }
      />

      {/* Hero: breach stat */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <div className="col-span-2 rounded-[4px] border border-panel-border bg-panel p-5 text-panel-foreground xl:col-span-1">
          <SectionLabel className="text-panel-foreground/45">Projected breach</SectionLabel>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="tnum text-[38px] font-bold leading-none text-danger">
              {view.selected.breachDay ? daysLabel(view.selected.breachDay).split(" ")[0] : "—"}
            </span>
            <span className="text-[13px] text-panel-foreground/70">days</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[12px] text-panel-foreground/60">
            <CalendarClock className="h-3.5 w-3.5" />
            below the {inrCompact(state.minSafeCash)} floor · {meta.label.toLowerCase()} case
          </div>
        </div>
        <MetricCard label="Cash today" value={inrCompact(state.currentCash)} sub={meta.note} />
        <MetricCard label="Day-90 balance" value={inrCompact(view.selected.day90Balance)} tone={caseType === "downside" ? "danger" : caseType === "upside" ? "positive" : "warn"} sub={`${caseType} case`} />
        <MetricCard label="Liquidity exposure" value={inrCompact(view.selected.liquidityExposure)} tone="danger" sub="max shortfall vs floor" />
      </div>

      <div className="mt-3 rounded-[4px] border bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <SectionLabel>Projected cash position · 180d history → 90d forecast</SectionLabel>
          <SourceTag kind="Forecast" />
        </div>
        <CashChart
          series={[
            {
              name: meta.label,
              color: meta.color,
              points: [...view.selected.history, ...view.selected.series],
            },
          ]}
          minSafe={state.minSafeCash}
          breachDay={view.selected.breachDay}
          height={320}
        />
        <div className="mt-3 grid grid-cols-1 gap-2 border-t pt-3 text-[11px] text-muted-foreground sm:grid-cols-3">
          {view.selected.endOfMonthBalances.map((e) => (
            <span key={e.day}>
              Day {e.day}: <span className="tnum font-semibold text-foreground">{inrCompact(e.balance)}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-[4px] border bg-card p-4">
          <SectionLabel>Key drivers</SectionLabel>
          <ul className="mt-2 space-y-1.5">
            {view.selected.drivers.map((d, i) => (
              <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-foreground/90">
                <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-brand" />
                {d}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-start gap-2.5 rounded-[4px] border border-warn/30 bg-warn/5 p-4 text-[12px] leading-relaxed text-foreground/80">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
          <div>
            {view.selected.disclaimer} Forecasts are scenario estimates, not guarantees — the Aster settlement is modelled at 55% confidence and is the largest single sensitivity.
          </div>
        </div>
      </div>
    </div>
  );
}
