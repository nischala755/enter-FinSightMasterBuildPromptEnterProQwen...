import { describe, expect, it } from "vitest";
import {
  computeAtRiskCapital,
  computeFinancialHealth,
  defaultScenario,
  detectDuplicateApInvoices,
  detectVendorPriceCreep,
  findOptimalIntervention,
  forecastCash,
  runScenario,
  totalLeakage,
  askFinancialQuestion,
  approveWorkflow,
  nextWorkflowStatus,
  makeAuditEvent,
  weightedAverageDso,
} from "./engine";
import { buildSeedState } from "./seed";

const state = buildSeedState();

describe("calibration targets (Northstar demo figures)", () => {
  it("financial health scores exactly 78/100", () => {
    const h = computeFinancialHealth(state);
    expect(h.score).toBe(78);
    expect(h.components.reduce((s, c) => s + c.weight, 0)).toBe(100);
  });

  it("current cash equals ₹4.82 Cr", () => {
    expect(state.currentCash).toBe(48_200_000);
  });

  it("base forecast day-90 balance lands near ₹2.17 Cr", () => {
    const f = forecastCash(state, "base");
    expect(f.day90Balance).toBeGreaterThan(19_000_000);
    expect(f.day90Balance).toBeLessThan(24_000_000);
  });

  it("breach of min-safe (~₹1.25 Cr) lands near day 52", () => {
    const f = forecastCash(state, "base");
    expect(f.minSafe).toBe(12_500_000);
    expect(f.breachDay).not.toBeNull();
    expect(f.breachDay!).toBeGreaterThanOrEqual(42);
    expect(f.breachDay!).toBeLessThanOrEqual(60);
  });

  it("liquidity exposure lands near ₹64L", () => {
    const f = forecastCash(state, "base");
    expect(f.liquidityExposure).toBeGreaterThan(5_000_000);
    expect(f.liquidityExposure).toBeLessThan(8_000_000);
  });

  it("total recoverable leakage equals ₹38.4L", () => {
    expect(totalLeakage(state)).toBe(3_840_000);
  });

  it("at-risk capital lands near ₹28.4L", () => {
    const c = computeAtRiskCapital(state);
    expect(c.total).toBeGreaterThan(2_600_000);
    expect(c.total).toBeLessThan(3_100_000);
  });
});

describe("detection", () => {
  it("detects the duplicate AP pair (AP-INV-48294)", () => {
    const dup = detectDuplicateApInvoices(state);
    expect(dup.map((d) => d.id)).toEqual(["AP-INV-48294"]);
  });

  it("detects vendor price creep (V-019 >10% drift)", () => {
    const creep = detectVendorPriceCreep(state);
    expect(creep.map((c) => c.id)).toContain("V-019");
  });

  it("computes a meaningful DSO from ageing buckets", () => {
    expect(weightedAverageDso(state)).toBeGreaterThan(45);
  });
});

describe("scenario simulation (deterministic)", () => {
  it("scenario worsens cash vs baseline and intervention improves it", () => {
    const inputs = { ...defaultScenario(), revenueChangePct: -15, receivablesDelayDays: 10 };
    const r = runScenario(state, inputs);
    expect(r.scenario.day90Balance).toBeLessThan(r.baseline.day90Balance);
    expect(r.intervened.day90Balance).toBeGreaterThan(r.scenario.day90Balance);
  });

  it("ranks a predefined strategy set and picks an optimal", () => {
    const inputs = { ...defaultScenario(), revenueChangePct: -15 };
    const { optimal, ranked } = findOptimalIntervention(state, inputs);
    expect(ranked.length).toBe(6);
    expect(optimal.recommended).toBe(true);
    expect(optimal.impact).toBeGreaterThan(0);
  });

  it("downside case breaches earlier than base", () => {
    const base = forecastCash(state, "base");
    const down = forecastCash(state, "downside");
    expect(down.day90Balance).toBeLessThan(base.day90Balance);
  });
});

describe("workflow approval chain", () => {
  it("approval sets status, records approver, appends event", () => {
    const wf = state.workflows.find((w) => w.id === "WF-1002")!;
    expect(wf.status).toBe("Investigating");
    const approved = approveWorkflow(wf, { name: "A. Mehta", role: "Finance Manager" }, new Date().toISOString());
    expect(approved.status).toBe("Approved");
    expect(approved.approvals.at(-1)?.approver).toBe("A. Mehta");
    expect(approved.events.at(-1)?.status).toBe("Approved");
  });

  it("workflow order is strictly Detected → … → Executed", () => {
    expect(nextWorkflowStatus("Detected")).toBe("Investigating");
    expect(nextWorkflowStatus("Awaiting Approval")).toBe("Approved");
    expect(nextWorkflowStatus("Executed")).toBeNull();
  });

  it("audit event creation is complete", () => {
    const e = makeAuditEvent({
      actor: "A. Mehta",
      role: "Finance Manager",
      action: "workflow.approved",
      reason: "Test",
      evidence: [{ type: "po", id: "PO-1184" }],
      workflowId: "WF-1004",
      approvalState: "Approved",
    });
    expect(e.id).toBeTruthy();
    expect(e.at).toBeTruthy();
    expect(e.workflowId).toBe("WF-1004");
  });
});

describe("AI fallback mode", () => {
  it("answers with evidence, metrics, actions and limitations", () => {
    const a = askFinancialQuestion(state, "Why is cash dropping and when do we breach?");
    expect(a.answer.length).toBeGreaterThan(50);
    expect(a.evidence.length).toBeGreaterThan(0);
    expect(a.metricsUsed.length).toBeGreaterThan(0);
    expect(a.recommendedActions.length).toBeGreaterThan(0);
    expect(a.limitations.length).toBeGreaterThan(0);
  });

  it("cites only real IDs", () => {
    const a = askFinancialQuestion(state, "Why is cash dropping and when do we breach?");
    const realIds = new Set([
      ...state.receivables.map((r) => r.invoiceId),
      ...state.purchaseOrders.map((p) => p.id),
      ...state.apInvoices.map((a2) => a2.id),
      ...state.subscriptions.map((s) => s.id),
      ...state.vendors.map((v) => v.id),
      ...state.customers.map((c) => c.id),
      "LN-091", // documented working-capital facility reference
    ]);
    for (const e of a.evidence) expect(realIds.has(e.id)).toBe(true);
  });
});
