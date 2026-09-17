// ---------------------------------------------------------------------------
// DataAccess layer. Phase 1 uses an in-memory adapter over the seed dataset so
// every screen is interactive immediately. Phase 3 swaps this adapter for an
// Enter Cloud Postgres-backed implementation behind the same interface — no
// component changes needed.
// ---------------------------------------------------------------------------

import type {
  AnalystAnswer,
  FinSightState,
  Risk,
  ScenarioInputs,
  ScenarioResult,
  Workflow,
  Leak,
} from "@/domain/types";
import {
  advanceWorkflow as engineAdvance,
  approveWorkflow as engineApprove,
  askFinancialQuestion,
  makeAuditEvent,
  runScenario,
} from "@/domain/engine";
import { buildSeedState } from "@/domain/seed";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type AnalystHistoryEntry = AnalystAnswer;

export interface DataAccess {
  getState(): Promise<FinSightState>;
  approveWorkflow(id: string, approver: { name: string; role: string }): Promise<FinSightState>;
  advanceWorkflow(id: string, actor: string, note?: string): Promise<FinSightState>;
  executeWorkflow(id: string, actor: string, note?: string): Promise<FinSightState>;
  createWorkflowFromLeak(leakId: string, type?: Workflow["type"]): Promise<FinSightState>;
  createWorkflowFromRisk(riskId: string, type?: Workflow["type"]): Promise<FinSightState>;
  createCollectionsWorkflow(customerId: string): Promise<FinSightState>;
  notifyStakeholder(note: { to: string; subject: string; body: string; evidence?: FinSightState["workflows"][number]["evidence"] }): Promise<FinSightState>;
  acknowledgeRisk(riskId: string): Promise<FinSightState>;
  recordRiskTrace(riskId: string): Promise<FinSightState>;
  askAnalyst(question: string): Promise<AnalystAnswer>;
  getAnalystHistory(): Promise<AnalystHistoryEntry[]>;
  runSimulation(inputs: ScenarioInputs): Promise<{ result: ScenarioResult; state: FinSightState }>;
  resetDemo(): Promise<FinSightState>;
}

class InMemoryBackend implements DataAccess {
  private state: FinSightState;
  private analystHistory: AnalystAnswer[] = [];

  constructor() {
    this.state = buildSeedState();
  }

  async getState(): Promise<FinSightState> {
    await delay(120);
    return this.state;
  }

  async resetDemo(): Promise<FinSightState> {
    await delay(120);
    this.state = buildSeedState();
    this.analystHistory = [];
    return this.state;
  }

  private mutate(fn: (s: FinSightState) => FinSightState): FinSightState {
    this.state = fn(this.state);
    return this.state;
  }

  async approveWorkflow(id: string, approver: { name: string; role: string }): Promise<FinSightState> {
    await delay(200);
    return this.mutate((s) => {
      const wf = s.workflows.find((w) => w.id === id);
      if (!wf) return s;
      const updated = engineApprove(wf, approver, new Date().toISOString());
      return {
        ...s,
        workflows: s.workflows.map((w) => (w.id === id ? updated : w)),
        auditEvents: [
          ...s.auditEvents,
          makeAuditEvent({
            actor: approver.name,
            role: approver.role,
            action: "workflow.approved",
            reason: "Approved via FinSight",
            evidence: updated.evidence,
            riskId: updated.sourceRiskId,
            workflowId: id,
            approvalState: "Approved",
            outcome: "Workflow approved; next action scheduled",
          }),
        ],
      };
    });
  }

  async advanceWorkflow(id: string, actor: string, note?: string): Promise<FinSightState> {
    await delay(160);
    return this.mutate((s) => {
      const wf = s.workflows.find((w) => w.id === id);
      if (!wf) return s;
      const updated = engineAdvance(wf, new Date().toISOString(), actor);
      return {
        ...s,
        workflows: s.workflows.map((w) => (w.id === id ? updated : w)),
        auditEvents: [
          ...s.auditEvents,
          makeAuditEvent({
            actor,
            role: s.currentUser.role,
            action: "workflow.status_changed",
            reason: note ?? "Status advanced",
            evidence: updated.evidence,
            riskId: updated.sourceRiskId,
            workflowId: id,
            approvalState: updated.status,
          }),
        ],
      };
    });
  }

  async executeWorkflow(id: string, actor: string, note?: string): Promise<FinSightState> {
    await delay(200);
    return this.mutate((s) => {
      const wf = s.workflows.find((w) => w.id === id);
      if (!wf || wf.status !== "Approved") return s;
      const updated = { ...wf, status: "Executed" as const, events: [...wf.events, { at: new Date().toISOString(), status: "Executed" as const, actor, note: note ?? "Executed" }] };
      return {
        ...s,
        workflows: s.workflows.map((w) => (w.id === id ? updated : w)),
        auditEvents: [
          ...s.auditEvents,
          makeAuditEvent({
            actor,
            role: s.currentUser.role,
            action: "workflow.executed",
            reason: note ?? "Workflow executed",
            evidence: updated.evidence,
            riskId: updated.sourceRiskId,
            workflowId: id,
            approvalState: "Executed",
            outcome: "Workflow executed",
          }),
        ],
      };
    });
  }

  async createWorkflowFromLeak(leakId: string, type: Workflow["type"] = "finance-task"): Promise<FinSightState> {
    await delay(250);
    return this.mutate((s) => {
      const leak = s.leaks.find((l) => l.id === leakId);
      if (!leak || leak.status === "recovering" || leak.status === "recovered") return s;
      const wf: Workflow = {
        id: `WF-${Date.now()}`,
        type,
        title: `Recover: ${leak.title}`,
        sourceLeakId: leak.id,
        status: "Detected",
        createdAt: new Date().toISOString(),
        approvals: [],
        events: [{ at: new Date().toISOString(), status: "Detected", actor: "FinSight", note: "Created from Money Leaks recovery action" }],
        evidence: leak.evidence,
        amount: leak.amount,
        owner: s.currentUser.name,
        origin: "enterpro",
      };
      const leak2: Leak = { ...leak, status: "recovering", workflowId: wf.id };
      return {
        ...s,
        workflows: [...s.workflows, wf],
        leaks: s.leaks.map((l) => (l.id === leakId ? leak2 : l)),
        auditEvents: [
          ...s.auditEvents,
          makeAuditEvent({
            actor: s.currentUser.name,
            role: s.currentUser.role,
            action: "leak.recovery_initiated",
            reason: "Recover this value pressed on Money Leaks",
            evidence: leak.evidence,
            workflowId: wf.id,
            outcome: "Workflow created via EnterPro",
            amount: leak.amount,
          }),
        ],
      };
    });
  }

  async createWorkflowFromRisk(riskId: string, type: Workflow["type"] = "investigation"): Promise<FinSightState> {
    await delay(250);
    return this.mutate((s) => {
      const risk = s.risks.find((r) => r.id === riskId);
      if (!risk) return s;
      const wf: Workflow = {
        id: `WF-${Date.now()}`,
        type,
        title: `${type === "vendor-review" ? "Vendor review" : type === "hold-payment" ? "Hold payment" : "Investigate"}: ${risk.title}`,
        sourceRiskId: risk.id,
        status: "Detected",
        createdAt: new Date().toISOString(),
        approvals: [],
        events: [{ at: new Date().toISOString(), status: "Detected", actor: "FinSight", note: "Created from Risk Radar via EnterPro" }],
        evidence: risk.evidence,
        amount: risk.impact,
        owner: s.currentUser.name,
        origin: "enterpro",
      };
      return {
        ...s,
        workflows: [...s.workflows, wf],
        auditEvents: [
          ...s.auditEvents,
          makeAuditEvent({
            actor: s.currentUser.name,
            role: s.currentUser.role,
            action: "workflow.created",
            reason: "Risk escalated to EnterPro workflow",
            evidence: risk.evidence,
            riskId: risk.id,
            workflowId: wf.id,
            outcome: "Workflow created via EnterPro",
            amount: risk.impact,
          }),
        ],
      };
    });
  }

  async createCollectionsWorkflow(customerId: string): Promise<FinSightState> {
    await delay(250);
    return this.mutate((s) => {
      const customer = s.customers.find((c) => c.id === customerId);
      if (!customer) return s;
      const outstanding = s.receivables
        .filter((r) => r.customerId === customerId)
        .reduce((sum, r) => sum + r.amount, 0);
      const wf: Workflow = {
        id: `WF-${Date.now()}`,
        type: "collections-task",
        title: `Collections escalation — ${customer.name}`,
        status: "Detected",
        createdAt: new Date().toISOString(),
        approvals: [],
        events: [{ at: new Date().toISOString(), status: "Detected", actor: "FinSight", note: `Created via EnterPro — ${outstanding.toLocaleString("en-IN")} outstanding` }],
        evidence: [{ type: "customer", id: customer.id, note: `Outstanding ${outstanding.toLocaleString("en-IN")}` }],
        amount: outstanding,
        owner: s.currentUser.name,
        origin: "enterpro",
      };
      return {
        ...s,
        workflows: [...s.workflows, wf],
        auditEvents: [
          ...s.auditEvents,
          makeAuditEvent({
            actor: s.currentUser.name,
            role: s.currentUser.role,
            action: "workflow.created",
            reason: `Collections task for ${customer.name}`,
            evidence: wf.evidence,
            workflowId: wf.id,
            outcome: "Workflow created via EnterPro",
            amount: outstanding,
          }),
        ],
      };
    });
  }

  async notifyStakeholder(note: { to: string; subject: string; body: string; evidence?: Workflow["evidence"] }): Promise<FinSightState> {
    await delay(120);
    return this.mutate((s) => ({
      ...s,
      auditEvents: [
        ...s.auditEvents,
        makeAuditEvent({
          actor: s.currentUser.name,
          role: s.currentUser.role,
          action: "workflow.created",
          reason: `EnterPro notification to ${note.to}: ${note.subject} — ${note.body}`,
          evidence: note.evidence ?? [],
          outcome: "Stakeholder notified",
        }),
      ],
    }));
  }

  async acknowledgeRisk(riskId: string): Promise<FinSightState> {
    await delay(120);
    return this.mutate((s) => ({
      ...s,
      auditEvents: [
        ...s.auditEvents,
        makeAuditEvent({
          actor: s.currentUser.name,
          role: s.currentUser.role,
          action: "risk.acknowledged",
          reason: "Acknowledged risk",
          riskId,
        }),
      ],
    }));
  }

  async recordRiskTrace(riskId: string): Promise<FinSightState> {
    await delay(120);
    return this.mutate((s) => ({
      ...s,
      auditEvents: [
        ...s.auditEvents,
        makeAuditEvent({
          actor: s.currentUser.name,
          role: s.currentUser.role,
          action: "risk.traced",
          reason: "Trace Cause executed",
          riskId,
        }),
      ],
    }));
  }

  async askAnalyst(question: string): Promise<AnalystAnswer> {
    await delay(400);
    const payload = askFinancialQuestion(this.state, question);
    const answer: AnalystAnswer = {
      id: `AN-${Date.now()}`,
      questionId: `Q-${Date.now()}`,
      question,
      ...payload,
      at: new Date().toISOString(),
      mode: this.state.aiMode,
    };
    this.analystHistory = [answer, ...this.analystHistory].slice(0, 50);
    this.mutate((s) => ({
      ...s,
      auditEvents: [
        ...s.auditEvents,
        makeAuditEvent({
          actor: s.currentUser.name,
          role: s.currentUser.role,
          action: "analyst.question",
          reason: question,
          outcome: answer.mode === "live" ? "Answered by Qwen" : "Answered in demo intelligence mode",
        }),
      ],
    }));
    return answer;
  }

  async getAnalystHistory(): Promise<AnalystHistoryEntry[]> {
    await delay(40);
    return this.analystHistory;
  }

  async runSimulation(inputs: ScenarioInputs): Promise<{ result: ScenarioResult; state: FinSightState }> {
    await delay(160);
    const result = runScenario(this.state, inputs);
    this.mutate((s) => ({
      ...s,
      auditEvents: [
        ...s.auditEvents,
        makeAuditEvent({
          actor: s.currentUser.name,
          role: s.currentUser.role,
          action: "simulation.run",
          reason: `Simulation: revenue ${inputs.revenueChangePct}%, receivables delay ${inputs.receivablesDelayDays}d, vendor cost ${inputs.vendorCostChangePct}%, discretionary ${inputs.discretionarySpendChangePct}%, inventory ${inputs.inventorySpendChangePct}%`,
          outcome: `Scenario day-90 ${result.scenario.day90Balance.toLocaleString("en-IN")}`,
        }),
      ],
    }));
    return { result, state: this.state };
  }

  // Convenience for risk state (used by Risk Radar)
  async getRisks(): Promise<Risk[]> {
    return this.state.risks;
  }
}

export const backend: DataAccess = new InMemoryBackend();
