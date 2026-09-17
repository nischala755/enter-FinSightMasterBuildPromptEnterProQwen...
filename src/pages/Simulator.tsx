import { useEffect, useMemo, useState } from "react";
import { Play, Trophy, SlidersHorizontal } from "lucide-react";
import { PageHeader, SectionLabel, SourceTag } from "@/components/primitives";
import { CashChart } from "@/components/CashChart";
import { useFinSightState, useRunSimulation } from "@/hooks/useFinSight";
import { defaultScenario, runScenario } from "@/domain/engine";
import { inrCompact, daysLabel } from "@/domain/format";
import type { ScenarioInputs } from "@/domain/types";
import { useDemoIntent } from "@/components/demo/DemoWalkthrough";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SLIDERS: { key: keyof ScenarioInputs; label: string; min: number; max: number; step: number; suffix: string }[] = [
  { key: "revenueChangePct", label: "Revenue change", min: -30, max: 20, step: 1, suffix: "%" },
  { key: "receivablesDelayDays", label: "Receivables delay", min: 0, max: 60, step: 1, suffix: " days" },
  { key: "vendorCostChangePct", label: "Vendor cost change", min: -10, max: 20, step: 1, suffix: "%" },
  { key: "discretionarySpendChangePct", label: "Discretionary spend", min: -50, max: 30, step: 1, suffix: "%" },
  { key: "inventorySpendChangePct", label: "Inventory spend", min: -30, max: 50, step: 1, suffix: "%" },
];

export function Simulator() {
  const { data: state } = useFinSightState();
  const record = useRunSimulation();
  const [inputs, setInputs] = useState<ScenarioInputs>(defaultScenario());
  const { intent } = useDemoIntent();

  useEffect(() => {
    if (intent.type === "simulate" && intent.inputs) {
      setInputs({ ...defaultScenario(), ...intent.inputs });
    }
  }, [intent.ref]);

  const view = useMemo(() => {
    if (!state) return null;
    return runScenario(state, inputs);
  }, [state, inputs]);

  if (!state || !view) return <div className="p-6 text-[13px] text-muted-foreground">Loading…</div>;

  const set = (key: keyof ScenarioInputs, value: number) => setInputs((i) => ({ ...i, [key]: value }));

  const outcomeCard = (label: string, f: ReturnType<typeof runScenario>["baseline"], color: string, note: string) => (
    <div className="rounded-[4px] border p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      </div>
      <div className="tnum mt-2 text-[22px] font-semibold leading-none" style={{ color }}>
        {inrCompact(f.day90Balance)}
      </div>
      <div className="mt-1.5 text-[11.5px] text-muted-foreground">
        {f.breachDay ? <>breach day {daysLabel(f.breachDay)} · exposure {inrCompact(f.liquidityExposure)}</> : "no breach"} · {note}
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Crisis Simulator"
        subtitle="Adjust the drivers and see Baseline vs Scenario vs Scenario + recommended intervention — computed deterministically in the browser, never by the LLM."
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Controls */}
        <div className="space-y-4 rounded-[4px] border bg-card p-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-brand" />
            <SectionLabel>Scenario drivers</SectionLabel>
          </div>
          {SLIDERS.map((s) => (
            <div key={s.key}>
              <div className="flex items-baseline justify-between text-[12px]">
                <span className="font-medium">{s.label}</span>
                <span className="tnum font-semibold">
                  {inputs[s.key] > 0 ? "+" : ""}{inputs[s.key]}{s.suffix}
                </span>
              </div>
              <input
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={inputs[s.key]}
                onChange={(e) => set(s.key, Number(e.target.value))}
                className="mt-1.5 w-full accent-[hsl(var(--brand))]"
              />
            </div>
          ))}
          <button
            className="flex h-9 w-full items-center justify-center gap-2 rounded-[3px] bg-brand text-[12px] font-semibold text-brand-foreground hover:bg-brand/90"
            onClick={() => {
              record.mutate(inputs);
              toast.success("Simulation recorded to audit trail");
            }}
          >
            <Play className="h-3.5 w-3.5" /> Run & record simulation
          </button>
        </div>

        {/* Results */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {outcomeCard("Baseline", view.baseline, "hsl(var(--brand))", "current course")}
            {outcomeCard("Scenario", view.scenario, "hsl(var(--warn))", "with your inputs")}
            {outcomeCard("Scenario + intervention", view.intervened, "hsl(var(--positive))", view.intervention?.name ?? "optimal")}
          </div>

          <div className="rounded-[4px] border bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <SectionLabel>Baseline vs scenario vs intervention · 90-day balance</SectionLabel>
              <SourceTag kind="Calculated" />
            </div>
            <CashChart
              series={[
                { name: "Baseline", color: "hsl(var(--brand))", points: [...view.baseline.history, ...view.baseline.series] },
                { name: "Scenario", color: "hsl(var(--warn))", points: [...view.scenario.history, ...view.scenario.series], dashed: true },
                { name: "Scenario + intervention", color: "hsl(var(--positive))", points: [...view.intervened.history, ...view.intervened.series], dashed: true },
              ]}
              minSafe={state.minSafeCash}
              height={280}
            />
          </div>

          {/* Optimal intervention */}
          <div className="rounded-[4px] border border-brand/30 bg-brand-soft/50 p-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-brand" />
              <SectionLabel className="text-brand">Optimal intervention</SectionLabel>
            </div>
            <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
              <div className="text-[16px] font-semibold">{view.optimal?.name}</div>
              <div className="tnum text-[15px] font-bold text-positive">+{inrCompact(view.optimal?.impact ?? 0)} to day-90 balance</div>
            </div>
            <p className="mt-1 text-[12.5px] text-foreground/80">{view.optimal?.description}</p>
            <div className="mt-2 flex gap-3 text-[11px] text-muted-foreground">
              <span>Risk: <span className="font-semibold capitalize text-foreground">{view.optimal?.risk}</span></span>
              <span>Complexity: <span className="font-semibold capitalize text-foreground">{view.optimal?.complexity}</span></span>
              <span>Source: <span className="font-semibold">deterministic strategy search</span></span>
            </div>

            <div className="mt-4 border-t border-brand/20 pt-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Strategy ranking</div>
              {view.ranked.slice(0, 4).map((s, i) => (
                <div key={s.id} className={cn("flex items-center gap-3 rounded-[3px] px-2 py-1.5 text-[12px]", i === 0 && "bg-brand/10")}>
                  <span className="tnum w-5 font-mono text-muted-foreground">{i + 1}</span>
                  <span className="flex-1 truncate font-medium">{s.name}</span>
                  <span className="tnum font-semibold text-positive">+{inrCompact(s.impact)}</span>
                  <span className="hidden text-[10.5px] uppercase tracking-wide text-muted-foreground sm:block">
                    {s.risk} · {s.complexity}
                  </span>
                  {i === 0 && <span className="rounded-[2px] bg-brand px-1.5 text-[9px] font-bold uppercase tracking-wide text-brand-foreground">Best</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
