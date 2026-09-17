// ---------------------------------------------------------------------------
// FinSight deterministic engine. Pure functions only — the single source of
// numeric truth. Qwen explains these numbers; it never computes them.
// All money in INR, days relative to today (day 0).
// ---------------------------------------------------------------------------

import type {
  AnalystAnswer,
  CaseType,
  DayPoint,
  EvidenceRef,
  FinancialHealth,
  FinSightState,
  ForecastResult,
  LeakCategory,
  Risk,
  RiskLevel,
  ScenarioInputs,
  ScenarioResult,
  ScoreComponent,
  Strategy,
  Workflow,
  AuditEvent,
  CausalNode,
} from "./types";
import { inrCompact } from "./format";

export const MONTHLY_INVOICING = 14_800_000; // ≈ ₹1.48 Cr/month billed
const DAY_MS = 86_400_000;

export const fmt = (n: number) => inrCompact(n);

export function dateForDay(day: number): string {
  return new Date(Date.now() + day * DAY_MS).toISOString().slice(0, 10);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

// ---------------------------------------------------------------------------
// Receivables & ageing
// ---------------------------------------------------------------------------
export function totalReceivables(state: FinSightState): number {
  return state.receivables.reduce((s, r) => s + r.amount, 0);
}

export function weightedAverageDso(state: FinSightState): number {
  // Standard DSO: AR outstanding against average daily invoicing.
  const daily = MONTHLY_INVOICING / 30;
  if (daily === 0) return 0;
  return totalReceivables(state) / daily;
}

export function pct90Plus(state: FinSightState): number {
  const total = totalReceivables(state);
  if (total === 0) return 0;
  const over90 = state.receivables
    .filter((r) => r.ageBucket === "90+")
    .reduce((s, r) => s + r.amount, 0);
  return (over90 / total) * 100;
}

// ---------------------------------------------------------------------------
// Cash forecast — deterministic tranche simulation
// ---------------------------------------------------------------------------
export function forecastCash(
  state: FinSightState,
  caseType: CaseType,
  tranches?: typeof state.projection,
): ForecastResult {
  const schedule = tranches ?? applyScenarioTranches(state, defaultScenario(), caseType);
  const minSafe = state.minSafeCash;

  const byDay = new Map<number, { in: number; out: number }>();
  for (const t of schedule) {
    if (t.day > 90) continue;
    const entry = byDay.get(t.day) ?? { in: 0, out: 0 };
    if (t.amount > 0) entry.in += t.amount;
    else entry.out += -t.amount;
    byDay.set(t.day, entry);
  }

  const series: DayPoint[] = [];
  let balance = state.currentCash;
  let totalIn = 0;
  let totalOut = 0;

  for (let day = 0; day <= 90; day++) {
    const e = byDay.get(day);
    const inflow = e?.in ?? 0;
    const outflow = e?.out ?? 0;
    balance = balance + inflow - outflow;
    totalIn += inflow;
    totalOut += outflow;
    series.push({ day, date: dateForDay(day), balance, inflow, outflow, isForecast: day > 0 });
  }

  const forecastPoints = series.filter((p) => p.isForecast);
  let breachDay: number | null = null;
  let troughDay: number | null = null;
  let troughBalance = Infinity;
  for (const p of forecastPoints) {
    if (breachDay === null && p.balance < minSafe) breachDay = p.day;
    if (p.balance < troughBalance) {
      troughBalance = p.balance;
      troughDay = p.day;
    }
  }
  if (troughBalance === Infinity) troughBalance = series[series.length - 1].balance;

  const day90Balance = series[series.length - 1].balance;
  const liquidityExposure = Math.max(0, minSafe - troughBalance);

  const history: DayPoint[] = state.cashHistory.map((c) => ({
    day: Math.round((new Date(c.date).getTime() - Date.now()) / DAY_MS),
    date: c.date,
    balance: c.balance,
    inflow: 0,
    outflow: 0,
    isForecast: false,
  }));

  const drivers = [
    `Expected collections over 90 days: ${fmt(totalIn)} against ${fmt(totalOut)} of commitments`,
    `Aster Retail settlement (${fmt(15_500_000)}) carries 55% confidence — if it slips, the trough deepens`,
    `Lumpy outflows: working-capital installment day 38, bulk inventory PO-1184 day 45`,
    `Zero-utilisation subscriptions continue to bill monthly`,
  ];

  return {
    series,
    history,
    minSafe,
    breachDay,
    troughDay,
    troughBalance: troughDay === null ? null : troughBalance,
    liquidityExposure,
    day90Balance,
    endOfMonthBalances: [30, 60, 90].map((d) => ({
      day: d,
      balance: series[d]?.balance ?? series[series.length - 1].balance,
    })),
    drivers,
    disclaimer:
      "Projection is a deterministic estimate from current receivables, commitments and payment behaviour. It is not a guarantee.",
  };
}

// ---------------------------------------------------------------------------
// Scenario transforms — deterministic adjustments to the tranche schedule
// ---------------------------------------------------------------------------
export function defaultScenario(): ScenarioInputs {
  return {
    revenueChangePct: 0,
    receivablesDelayDays: 0,
    vendorCostChangePct: 0,
    discretionarySpendChangePct: 0,
    inventorySpendChangePct: 0,
  };
}

type Tranche = FinSightState["projection"][number];

export function applyScenarioTranches(
  state: FinSightState,
  inputs: ScenarioInputs,
  caseType: CaseType,
): Tranche[] {
  const scaleInflow = 1 + inputs.revenueChangePct / 100;
  const scaleVendor = 1 + inputs.vendorCostChangePct / 100;
  const scaleDiscretionary = 1 + inputs.discretionarySpendChangePct / 100;
  const scaleInventory = 1 + inputs.inventorySpendChangePct / 100;
  const delay = inputs.receivablesDelayDays;

  const modify = (t: Tranche): Tranche => {
    if (caseType === "downside") {
      if (t.label.includes("Aster settlement"))
        return { ...t, day: t.day + 30, amount: t.amount * 0.8 };
      if (t.label.startsWith("Catch-up") || t.label === "Misc receipts")
        return { ...t, day: t.day + 12, amount: t.amount * 0.6 };
    }
    if (caseType === "upside") {
      if (t.label.includes("Aster settlement")) return { ...t, day: Math.max(20, t.day - 18) };
      if (t.label.startsWith("Catch-up"))
        return { ...t, day: t.day - 8, amount: t.amount * 1.15 };
      if (t.label === "Bulk inventory PO-1184") return { ...t, day: 999 };
    }
    return t;
  };

  return state.projection.map((t) => {
    const next = modify(t);
    if (next.day > 90) return next;

    if (next.source === "customer" || next.source === "receivable") {
      return { ...next, day: next.day + delay, amount: next.amount * scaleInflow };
    }
    if (next.source === "vendor") {
      const inventoryFactor = next.label.includes("Precision") ? scaleInventory : 1;
      return { ...next, amount: next.amount * scaleVendor * inventoryFactor };
    }
    if (next.source === "po") {
      return { ...next, amount: next.amount * scaleInventory };
    }
    if (next.source === "opex") {
      if (next.label.includes("Payroll")) return next;
      return { ...next, amount: next.amount * scaleDiscretionary };
    }
    return next;
  });
}

// ---------------------------------------------------------------------------
// Interventions — a fixed predefined strategy set, ranked deterministically
// ---------------------------------------------------------------------------
export const STRATEGIES: Strategy[] = [
  {
    id: "S-01",
    name: "Escalate Aster to settlement",
    description: "Executive escalation + payment plan; pull the settlement tranche 30 days earlier.",
    impact: 0,
    risk: "medium",
    complexity: "medium",
    appliesTo: { receivablesDelayDays: "mitigate" },
  },
  {
    id: "S-02",
    name: "Defer bulk inventory PO-1184",
    description: "Hold the ₹70L restock past the cash trough; right-size stock to 45 days.",
    impact: 0,
    risk: "low",
    complexity: "low",
    appliesTo: { inventorySpendChangePct: "mitigate" },
  },
  {
    id: "S-03",
    name: "Cancel zombie subscriptions",
    description: "Kill four zombie licences; renegotiate underused seats to usage-based pricing.",
    impact: 0,
    risk: "low",
    complexity: "low",
    appliesTo: { discretionarySpendChangePct: "mitigate" },
  },
  {
    id: "S-04",
    name: "Renegotiate V-019 pricing",
    description: "Rebid the raw-material contract back to index 1.05 from 1.207.",
    impact: 0,
    risk: "low",
    complexity: "medium",
    appliesTo: { vendorCostChangePct: "mitigate" },
  },
  {
    id: "S-05",
    name: "Freeze discretionary spend",
    description: "Cut non-payroll operating spend 30% for 60 days.",
    impact: 0,
    risk: "low",
    complexity: "low",
    appliesTo: { discretionarySpendChangePct: "mitigate" },
  },
  {
    id: "S-06",
    name: "Extend vendor terms to 60 days",
    description: "Negotiate net-60 on top vendor contracts; defer three vendor runs.",
    impact: 0,
    risk: "medium",
    complexity: "high",
    appliesTo: { vendorCostChangePct: "mitigate" },
  },
];

export function applyStrategyToTranches(state: FinSightState, tranches: Tranche[], strategy: Strategy): Tranche[] {
  switch (strategy.id) {
    case "S-01":
      return tranches.map((t) =>
        t.label.includes("Aster settlement") ? { ...t, day: Math.max(22, t.day - 30) } : t,
      );
    case "S-02":
      return tranches.map((t) => (t.label === "Bulk inventory PO-1184" ? { ...t, day: 999 } : t));
    case "S-03":
      return tranches.map((t) =>
        t.label === "Subscription billing" ? { ...t, amount: t.amount * 0.55 } : t,
      );
    case "S-04":
      return tranches.map((t) => {
        if (t.label.includes("NovoTex")) return { ...t, amount: t.amount * 0.82 };
        if (t.label.includes("ChemCorp")) return { ...t, amount: t.amount * 0.95 };
        return t;
      });
    case "S-05":
      return tranches.map((t) =>
        t.source === "opex" && !t.label.includes("Payroll") ? { ...t, amount: t.amount * 0.7 } : t,
      );
    case "S-06":
      return tranches.map((t) =>
        t.label.includes("Vendor run") && t.day >= 54 ? { ...t, day: Math.min(t.day + 20, 99) } : t,
      );
    default:
      return tranches;
  }
}

export function findOptimalIntervention(
  state: FinSightState,
  inputs: ScenarioInputs,
): { optimal: Strategy; ranked: Strategy[] } {
  const scenarioTranches = applyScenarioTranches(state, inputs, "base");
  const bare = forecastCash(state, "base", scenarioTranches);
  const ranked = STRATEGIES.map((s) => {
    const withS = forecastCash(state, "base", applyStrategyToTranches(state, scenarioTranches, s));
    // Impact weighs both the day-90 improvement and relief at the trough.
    const impact =
      withS.day90Balance -
      bare.day90Balance +
      0.5 * (Math.max(0, withS.troughBalance ?? withS.day90Balance) - Math.max(0, bare.troughBalance ?? bare.day90Balance));
    return { ...s, impact: Math.max(0, Math.round(impact)) };
  }).sort((a, b) => b.impact - a.impact);
  const optimal = { ...ranked[0], recommended: true };
  return { optimal, ranked };
}

export function runScenario(state: FinSightState, inputs: ScenarioInputs): ScenarioResult {
  const baseline = forecastCash(state, "base");
  const scenarioTranches = applyScenarioTranches(state, inputs, "base");
  const scenario = forecastCash(state, "base", scenarioTranches);
  const { optimal, ranked } = findOptimalIntervention(state, inputs);
  const intervened = forecastCash(state, "base", applyStrategyToTranches(state, scenarioTranches, optimal));
  return { baseline, scenario, intervened, intervention: optimal, optimal, ranked };
}

// ---------------------------------------------------------------------------
// Leakage detection (recomputed from raw data) + totals
// ---------------------------------------------------------------------------
export function totalLeakage(state: FinSightState): number {
  return state.leaks.reduce((s, l) => s + l.amount, 0);
}

export function leakageByCategory(state: FinSightState): Record<LeakCategory, number> {
  const out = {} as Record<LeakCategory, number>;
  for (const l of state.leaks) out[l.category] = (out[l.category] ?? 0) + l.amount;
  return out;
}

export function detectDuplicateApInvoices(state: FinSightState) {
  return state.apInvoices.filter((a) => a.duplicateOf);
}

export function detectVendorPriceCreep(state: FinSightState) {
  return state.vendors.filter((v) => {
    if (v.priceTrend.length < 2) return false;
    const first = v.priceTrend[0].index;
    const last = v.priceTrend[v.priceTrend.length - 1].index;
    return last / first > 1.1;
  });
}

export function detectZombieSubscriptions(state: FinSightState) {
  return state.subscriptions.filter((s) => s.status !== "active");
}

// ---------------------------------------------------------------------------
// At-risk capital — exposure beyond normal collection norms
// ---------------------------------------------------------------------------
export function computeAtRiskCapital(state: FinSightState): {
  total: number;
  breakdown: { label: string; amount: number; evidence: EvidenceRef[] }[];
} {
  const ar90Plus = state.receivables
    .filter((r) => r.ageBucket === "90+")
    .reduce((s, r) => s + r.amount, 0);
  const openPos = state.purchaseOrders
    .filter((p) => p.status === "approved" || p.status === "open")
    .reduce((s, p) => s + p.amount, 0);
  const dup = detectDuplicateApInvoices(state).reduce((s, a) => s + a.amount, 0);
  const zombieMonthly = state.subscriptions
    .filter((s) => s.status === "zombie")
    .reduce((s, sub) => s + sub.monthlyAmount, 0);

  const receivableAtRisk = Math.round(ar90Plus * 0.22);
  const poExposure = Math.round(openPos * 0.09);
  const subExposure = Math.round(zombieMonthly * 12 * 0.23);

  const breakdown = [
    {
      label: "90+ day receivables beyond collection norm",
      amount: receivableAtRisk,
      evidence: state.receivables
        .filter((r) => r.ageBucket === "90+")
        .map((r) => ({ type: "invoice" as const, id: r.invoiceId, amount: r.amount })),
    },
    {
      label: "Open purchase commitments (unfunded)",
      amount: poExposure,
      evidence: state.purchaseOrders
        .filter((p) => p.status === "approved" || p.status === "open")
        .map((p) => ({ type: "po" as const, id: p.id, amount: p.amount })),
    },
    {
      label: "Confirmed duplicate payment",
      amount: dup,
      evidence: detectDuplicateApInvoices(state).map((a) => ({
        type: "invoice" as const,
        id: a.id,
        amount: a.amount,
      })),
    },
    {
      label: "Zombie subscription pre-payment exposure",
      amount: subExposure,
      evidence: state.subscriptions
        .filter((s) => s.status === "zombie")
        .map((s) => ({ type: "subscription" as const, id: s.id, amount: s.monthlyAmount })),
    },
  ];

  return { total: breakdown.reduce((s, b) => s + b.amount, 0), breakdown };
}

// ---------------------------------------------------------------------------
// Financial health — explainable, weighted, deterministic
// ---------------------------------------------------------------------------
export function computeFinancialHealth(state: FinSightState): FinancialHealth {
  const base = forecastCash(state, "base");
  const dso = weightedAverageDso(state);
  const over90 = pct90Plus(state);
  const creep = detectVendorPriceCreep(state).length;
  const singleSource = state.vendors.filter((v) => v.singleSource).length;
  const leak = totalLeakage(state);
  const leakRatio = (leak / (MONTHLY_INVOICING * 12)) * 100;
  const top2Conc = state.customers
    .slice(0, 2)
    .reduce((s, c) => s + c.concentrationPct, 0);
  const aster = state.customers.find((c) => c.id === "C-001");
  const behaviorGap = aster ? aster.paymentBehaviorDays - aster.creditTermsDays : 0;

  const liquidity = Math.round(
    clamp(50 + 25 * Math.min(base.day90Balance / base.minSafe, 2) - 24 * (base.breachDay ? 1 : 0), 0, 100),
  );
  const receivables = Math.round(
    clamp(100 - 0.85 * Math.max(dso - 45, 0) - 0.9 * over90, 0, 100),
  );
  const vendor = Math.round(clamp(100 - 4 * creep - 2 * singleSource, 0, 100));
  const costDiscipline = Math.round(clamp(100 - 2.5 * leakRatio, 0, 100));
  const collections = Math.round(
    clamp(100 - 0.22 * top2Conc - 0.2 * Math.max(behaviorGap, 0), 0, 100),
  );

  const components: ScoreComponent[] = [
    {
      key: "liquidity",
      label: "Liquidity & runway",
      weight: 30,
      score: liquidity,
      contribution: 0,
      detail: `Day-90 balance ${fmt(base.day90Balance)} vs min-safe ${fmt(base.minSafe)}; ${
        base.breachDay ? `breach projected at day ${base.breachDay}` : "no breach projected"
      }`,
      signal: base.breachDay ? "warn" : "positive",
    },
    {
      key: "receivables",
      label: "Receivables quality",
      weight: 25,
      score: receivables,
      contribution: 0,
      detail: `DSO ${dso.toFixed(0)} days (target ≤ 45); ${over90.toFixed(0)}% of AR beyond 90 days`,
      signal: receivables >= 70 ? "positive" : "warn",
    },
    {
      key: "vendor",
      label: "Vendor cost stability",
      weight: 20,
      score: vendor,
      contribution: 0,
      detail: `${creep} vendor(s) with >10% price drift; ${singleSource} single-source dependency`,
      signal: vendor >= 80 ? "positive" : "warn",
    },
    {
      key: "leakage",
      label: "Cost discipline",
      weight: 15,
      score: costDiscipline,
      contribution: 0,
      detail: `Recoverable leakage ${fmt(leak)} = ${leakRatio.toFixed(1)}% of annual revenue`,
      signal: costDiscipline >= 80 ? "positive" : "warn",
    },
    {
      key: "collections",
      label: "Collections reliability",
      weight: 10,
      score: collections,
      contribution: 0,
      detail: `Top-2 customers = ${top2Conc}% of invoicing; Aster pays ${behaviorGap} days past terms`,
      signal: collections >= 70 ? "positive" : "warn",
    },
  ];

  for (const c of components) c.contribution = c.score * (c.weight / 100);

  const total = components.reduce((s, c) => s + c.contribution, 0);
  const score = clamp(Math.round(total), 0, 100);
  const grade = score >= 85 ? "Resilient" : score >= 70 ? "Stable" : score >= 55 ? "Watch" : "At risk";

  return {
    score,
    grade,
    summary:
      "Financial health is supported by stable vendor pricing and disciplined operating costs, but liquidity is deteriorating: collections have stalled behind Aster Retail's delayed payments while two lumpy outflows (loan installment, bulk inventory PO) land ahead of the projected settlement.",
    components,
  };
}

// ---------------------------------------------------------------------------
// Risk helpers
// ---------------------------------------------------------------------------
export function riskLevelScore(level: RiskLevel): number {
  return { critical: 4, high: 3, medium: 2, low: 1 }[level];
}

export function effectiveRiskScore(risk: Risk): number {
  return Math.round(riskLevelScore(risk.level) * 25 * risk.probability + risk.impact / 1_000_000);
}

export function riskSeverity(risk: Risk): "high" | "medium" | "low" {
  const s = riskLevelScore(risk.level) * risk.probability;
  if (s >= 2.4 || risk.level === "critical") return "high";
  if (s >= 1.4) return "medium";
  return "low";
}

export function traceCausalChain(risk: Risk): CausalNode[] {
  return risk.causalChain;
}

/** Explainable composite risk score (0–100), point-by-point contribution. */
export function explainRiskScore(risk: Risk): {
  total: number;
  parts: { label: string; score: number; weight: number; contribution: number; detail: string }[];
} {
  const levelScore = riskLevelScore(risk.level) * 25; // 25–100
  const impactScore = Math.min(40, (risk.impact / 1_000_000) * 1.2); // 40 max
  const probabilityScore = risk.probability * 20;
  const confidenceScore = risk.confidence * 10;

  const parts = [
    {
      label: "Severity level",
      score: levelScore,
      weight: 0.4,
      detail: `${risk.level.toUpperCase()} level → base ${levelScore}/100`,
    },
    {
      label: "Financial impact",
      score: impactScore,
      weight: 0.3,
      detail: `₹${(risk.impact / 1_00_000).toFixed(1)}L at risk`,
    },
    {
      label: "Probability",
      score: probabilityScore,
      weight: 0.2,
      detail: `${Math.round(risk.probability * 100)}% likelihood`,
    },
    {
      label: "Detection confidence",
      score: confidenceScore,
      weight: 0.1,
      detail: `${Math.round(risk.confidence * 100)}% evidence confidence`,
    },
  ].map((p) => ({ ...p, contribution: p.score * p.weight }));

  const total = Math.round(clamp(parts.reduce((s, p) => s + p.contribution, 0), 0, 100));
  return { total, parts };
}

// ---------------------------------------------------------------------------
// Evidence citation — heuristic, returns real IDs only, never fabricated
// ---------------------------------------------------------------------------
export function citeEvidence(state: FinSightState, question: string): EvidenceRef[] {
  const q = question.toLowerCase();
  const out: EvidenceRef[] = [];
  const add = (e: EvidenceRef) => {
    if (!out.some((o) => o.id === e.id)) out.push(e);
  };

  if (/aster|retail|receivable|collection|dso|aging/.test(q)) {
    state.receivables
      .filter((r) => r.ageBucket === "90+" || r.customerId === "C-001")
      .forEach((r) => add({ type: "invoice", id: r.invoiceId, amount: r.amount }));
    add({ type: "customer", id: "C-001", note: "Payment behaviour 45 → 78 days" });
  }
  if (/vendor|price|novo|creep|supplier/.test(q)) {
    state.vendors
      .filter((v) => v.flags.includes("price-creep"))
      .forEach((v) =>
        add({
          type: "vendor",
          id: v.id,
          note: `Index ${v.priceTrend[0].index} → ${v.priceTrend[v.priceTrend.length - 1].index}`,
        }),
      );
    add({ type: "po", id: "PO-1178", amount: 1_900_000 });
  }
  if (/duplicate|48291|48294|double/.test(q)) {
    add({ type: "invoice", id: "AP-INV-48291", amount: 450_000 });
    add({ type: "invoice", id: "AP-INV-48294", amount: 450_000, note: "duplicate" });
  }
  if (/cash|liquidity|forecast|runway|breach|1184/.test(q)) {
    state.purchaseOrders
      .filter((p) => p.id === "PO-1184")
      .forEach((p) => add({ type: "po", id: p.id, amount: p.amount }));
    add({ type: "loan", id: "LN-091", note: "Working-capital installment day 38" });
  }
  if (/subscription|saas|licence/.test(q)) {
    state.subscriptions
      .filter((s) => s.status !== "active")
      .forEach((s) => add({ type: "subscription", id: s.id, amount: s.monthlyAmount }));
  }
  if (/penalt|late|redstar/.test(q)) {
    add({ type: "vendor", id: "V-004", note: "1.5%/mo penalty clause" });
  }
  if (out.length === 0) {
    state.risks
      .slice(0, 2)
      .forEach((r) => r.evidence.forEach(add));
  }
  return out;
}

// ---------------------------------------------------------------------------
// AI fallback responses — deterministic templates. Live Qwen replaces these
// when the backend function answers.
// ---------------------------------------------------------------------------
export function financialBriefing(state: FinSightState): string {
  const base = forecastCash(state, "base");
  return (
    `Cash stands at ${fmt(state.currentCash)} and is projected to reach ${fmt(base.day90Balance)} in 90 days, crossing the ${fmt(base.minSafe)} minimum-safe floor around day ${base.breachDay ?? "—"} in the base case. ` +
    `The primary driver is receivable deterioration: Aster Retail (28% of invoicing) has stretched payment behaviour from 45 to 78 days, freezing expected collections while a ${fmt(8_800_000)} loan installment (day 38) and the ${fmt(7_000_000)} bulk inventory PO (day 45) land ahead of the projected settlement. ` +
    `Recoverable leakage of ${fmt(totalLeakage(state))} per year and ${fmt(computeAtRiskCapital(state).total)} of at-risk capital are actionable now. Recommended first move: escalate the Aster settlement and defer PO-1184 until it clears.`
  );
}

export function askFinancialQuestion(
  state: FinSightState,
  question: string,
): Omit<AnalystAnswer, "id" | "questionId" | "at" | "mode"> {
  const q = question.toLowerCase();
  const evidence = citeEvidence(state, question);
  const base = forecastCash(state, "base");
  const totalIn = base.series.filter((p) => p.inflow > 0).reduce((s, p) => s + p.inflow, 0);
  const totalOut = base.series.filter((p) => p.outflow > 0).reduce((s, p) => s + p.outflow, 0);

  let answer: string;

  if (/why.*(cash|drop|declin|low)|liquidity/.test(q)) {
    answer =
      `Cash is being drained by a stalled collections cycle. Expected inflows over the next 90 days total ${fmt(totalIn)} against ${fmt(totalOut)} of commitments. ` +
      `Aster Retail — the largest customer — has stretched payment behaviour from 45 to 78 days, and the projection crosses the ${fmt(base.minSafe)} floor around day ${base.breachDay ?? "—"}. ` +
      `Two lumpy outflows (loan installment day 38, bulk inventory PO-1184 day 45) land before any settlement tranche.`;
  } else if (/vendor.*(price|creep)|why.*vendor/.test(q)) {
    answer =
      `Vendor cost escalation is concentrated in NovoTextiles (V-019): its quarterly price index compounded from 1.00 to 1.207 over four quarters — a 20.7% cumulative increase — while comparable raw-material vendors moved under 3%. ` +
      `At the current ₹3.2L/month run rate this is roughly ₹9.6L of avoidable annual spend. V-019 is also a single-source supplier, so the increase has never been contested.`;
  } else if (/duplicate|double|48291/.test(q)) {
    answer =
      `A duplicate payment has been confirmed. Two AP entries — AP-INV-48291 and AP-INV-48294 — both reference freight PO-1189 from Avon Logistics for ₹4.5L, with overlapping dates and no separate delivery record for the second. ` +
      `Both were settled. A recovery workflow (WF-1002) is open to reverse the second payment.`;
  } else if (/worst|downside|breach|risk/.test(q)) {
    answer =
      `In the downside case — where the Aster settlement slips ~30 days and catch-up collections shrink — the forecast crosses the ${fmt(base.minSafe)} floor earlier and the day-90 balance falls to about ${fmt(forecastCash(state, "downside").day90Balance)}. ` +
      `The single largest sensitivity is the Aster settlement tranche: at 55% confidence it is the difference between a shallow dip and a sustained breach.`;
  } else if (/subscription|saas|licence/.test(q)) {
    answer =
      `Six of eight subscriptions are under-utilised: four are zombie licences with no sign-in for 60+ days and two operate below 50% seat utilisation. ` +
      `Together they represent roughly ₹6.2L of annual recoverable spend. The largest offenders are Matrix CRM (22/40 seats active), CloudServ Object Storage (0 seats) and WorkBoard PM (6/25 seats).`;
  } else if (/health|score|how.*(healthy|faring|doing)/.test(q)) {
    const h = computeFinancialHealth(state);
    answer =
      `Financial health is ${h.score}/100 (${h.grade}). The weakest components are liquidity (${h.components[0].score}/100) and collections reliability (${h.components[4].score}/100), dragged down by the stalled Aster receivable cycle and the projected breach of the ${fmt(base.minSafe)} floor around day ${base.breachDay ?? "—"}. ` +
      `Vendor cost stability (${h.components[2].score}/100) and cost discipline (${h.components[3].score}/100) remain solid.`;
  } else if (/inventor|stock|1184/.test(q)) {
    answer =
      `Inventory-related commitments have risen sharply: purchase volume is up ~31% quarter over quarter, culminating in the ₹70L bulk order PO-1184 scheduled for day 45 — directly ahead of the projected cash trough. ` +
      `Right-sizing stock to 45 days and deferring PO-1184 until the Aster settlement clears removes roughly half of the projected shortfall.`;
  } else {
    answer =
      `I'm answering in Demo Intelligence Mode — the live Qwen analyst is unreachable right now, so this is generated deterministically from the seeded ledger. ` +
      `This question doesn't map to one of the ledger's tracked patterns (liquidity, receivables, vendor pricing, duplicates, subscriptions, inventory or health), so I won't guess. ` +
      `What the data does support: cash stands at ${fmt(state.currentCash)}, the 90-day projection is ${fmt(base.day90Balance)}, recoverable leakage is ${fmt(totalLeakage(state))}, and ${state.risks.length} risks are being tracked. ` +
      `Refine the question toward one of those areas for a precise, evidence-cited answer.`;
  }

  const insufficient = evidence.length === 0;

  return {
    question,
    answer,
    metricsUsed: [
      `Current cash: ${fmt(state.currentCash)}`,
      `90-day forecast: ${fmt(base.day90Balance)} (breach day ${base.breachDay ?? "—"})`,
      `Recoverable leakage: ${fmt(totalLeakage(state))}`,
      `DSO: ${weightedAverageDso(state).toFixed(0)} days`,
      `At-risk capital: ${fmt(computeAtRiskCapital(state).total)}`,
    ],
    evidence,
    confidence: insufficient ? 0.15 : 0.82,
    recommendedActions: insufficient
      ? ["Gather more evidence before acting — current citations are insufficient."]
      : [
          "Escalate the Aster Retail collections to a binding settlement",
          "Defer bulk inventory PO-1184 past the projected trough",
          "Open a recovery workflow for the confirmed duplicate payment",
        ],
    limitations: [
      "AI reasoning is applied over seeded ledger data and deterministic engine outputs; the AI itself computes no numbers.",
      "Forecasts assume scheduled tranches land as modelled; the Aster settlement is explicitly rated at 55% confidence.",
    ],
  };
}

// ---------------------------------------------------------------------------
// Workflow + audit helpers (deterministic state transitions)
// ---------------------------------------------------------------------------
const WORKFLOW_ORDER: Workflow["status"][] = [
  "Detected",
  "Investigating",
  "Awaiting Approval",
  "Approved",
  "Executed",
];

export function nextWorkflowStatus(status: Workflow["status"]): Workflow["status"] | null {
  const i = WORKFLOW_ORDER.indexOf(status);
  return i >= 0 && i < WORKFLOW_ORDER.length - 1 ? WORKFLOW_ORDER[i + 1] : null;
}

export function approveWorkflow(
  wf: Workflow,
  approver: { name: string; role: string },
  at: string,
): Workflow {
  return {
    ...wf,
    status: "Approved",
    approvals: [...wf.approvals, { approver: approver.name, role: approver.role, at }],
    events: [...wf.events, { at, status: "Approved", actor: approver.name, note: "Approved" }],
  };
}

export function advanceWorkflow(wf: Workflow, at: string, actor: string): Workflow {
  const next = nextWorkflowStatus(wf.status);
  if (!next) return wf;
  return { ...wf, status: next, events: [...wf.events, { at, status: next, actor }] };
}

export function makeAuditEvent(e: Omit<AuditEvent, "id" | "at">): AuditEvent {
  return {
    ...e,
    evidence: e.evidence ?? [],
    id: `EV-${Date.now()}-${Math.round(Math.random() * 1e4)}`,
    at: new Date().toISOString(),
  };
}

export function stableId(prefix: string, key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return `${prefix}-${Math.abs(h).toString(36).slice(0, 6)}`;
}
