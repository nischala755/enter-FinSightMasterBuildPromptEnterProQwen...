// ---------------------------------------------------------------------------
// DataAccess layer.
//   Primary: CloudBackend — Enter Cloud Postgres is the authoritative store for
//            workflows, audit events and leak recovery state, so status
//            persists across refreshes and is visible to any viewer.
//   Fallback: if Enter Cloud is unreachable (offline demo, test env), the same
//            interface runs on an in-memory store over the seed so the app
//            never hard-fails.
// Components never know which adapter is active.
// ---------------------------------------------------------------------------

import type {
  AnalystAnswer,
  FinSightState,
  Leak,
  ScenarioInputs,
  ScenarioResult,
  Workflow,
} from "@/domain/types";
import {
  advanceWorkflow as engineAdvance,
  approveWorkflow as engineApprove,
  askFinancialQuestion,
  makeAuditEvent,
  runScenario,
} from "@/domain/engine";
import { buildSeedState } from "@/domain/seed";
import { supabase } from "@/integrations/supabase/client";
import { askQwen, buildQwenContext } from "@/services/qwen";

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
  notifyStakeholder(note: { to: string; subject: string; body: string; evidence?: Workflow["evidence"] }): Promise<FinSightState>;
  acknowledgeRisk(riskId: string): Promise<FinSightState>;
  recordRiskTrace(riskId: string): Promise<FinSightState>;
  askAnalyst(question: string): Promise<AnalystAnswer>;
  getAnalystHistory(): Promise<AnalystHistoryEntry[]>;
  runSimulation(inputs: ScenarioInputs): Promise<{ result: ScenarioResult; state: FinSightState }>;
  resetDemo(): Promise<FinSightState>;
}

// ---------------------------------------------------------------------------
// In-memory adapter (fallback + test path)
// ---------------------------------------------------------------------------
class InMemoryBackend implements DataAccess {
  protected state: FinSightState;
  protected analystHistory: AnalystAnswer[] = [];
  protected mode: "live" | "fallback" = "fallback";

  constructor() {
    this.state = buildSeedState();
  }

  async getState(): Promise<FinSightState> {
    await delay(120);
    return { ...this.state, aiMode: this.mode };
  }

  async resetDemo(): Promise<FinSightState> {
    await delay(120);
    this.state = buildSeedState();
    this.analystHistory = [];
    this.mode = "fallback";
    return this.state;
  }

  protected mutate(fn: (s: FinSightState) => FinSightState): FinSightState {
    this.state = fn(this.state);
    return { ...this.state, aiMode: this.mode };
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
        auditEvents: [...s.auditEvents, this.auditFor(wf, updated, approver)],
      };
    });
  }

  protected auditFor(wf: Workflow, updated: Workflow, approver?: { name: string; role: string }): ReturnType<typeof makeAuditEvent> {
    return makeAuditEvent({
      actor: approver?.name ?? this.state.currentUser.name,
      role: approver?.role ?? this.state.currentUser.role,
      action: "workflow.approved",
      reason: "Approved via FinSight",
      evidence: updated.evidence,
      riskId: updated.sourceRiskId,
      workflowId: wf.id,
      approvalState: "Approved",
      outcome: "Workflow approved; next action scheduled",
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
      const updated: Workflow = {
        ...wf,
        status: "Executed",
        events: [...wf.events, { at: new Date().toISOString(), status: "Executed", actor, note: note ?? "Executed" }],
      };
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
      const outstanding = s.receivables.filter((r) => r.customerId === customerId).reduce((sum, r) => sum + r.amount, 0);
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
    await delay(300);
    // Try live Qwen first; fall back to deterministic templates on any failure.
    const live = await askQwen(buildQwenContext(this.state, question));
    const payload = live
      ? { ...askFinancialQuestion(this.state, question), answer: live.answer, mode: "live" as const }
      : { ...askFinancialQuestion(this.state, question), mode: "fallback" as const };
    if (live) this.mode = "live";
    const answer: AnalystAnswer = {
      id: `AN-${Date.now()}`,
      questionId: `Q-${Date.now()}`,
      question,
      answer: payload.answer,
      metricsUsed: payload.metricsUsed,
      evidence: payload.evidence,
      confidence: payload.confidence,
      recommendedActions: payload.recommendedActions,
      limitations: payload.limitations,
      at: new Date().toISOString(),
      mode: payload.mode,
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
    return { result, state: { ...this.state, aiMode: this.mode } };
  }
}

// ---------------------------------------------------------------------------
// Cloud adapter — Enter Cloud Postgres is authoritative for workflows, audit
// events and leak recovery; falls back to memory when unreachable.
// ---------------------------------------------------------------------------
interface WorkflowRow { id: string; data: unknown; status: string }
interface AuditRow { id: string; data: unknown }
interface LeakRow { id: string; status: string; workflow_id: string | null; data: unknown }

class CloudBackend extends InMemoryBackend {
  private cloudOk = true;

  private forceMemory(): boolean {
    // Test setups force the in-memory adapter so interaction tests never
    // mutate the live demo dataset.
    return (globalThis as { __FINSIGHT_FORCE_MEMORY__?: boolean }).__FINSIGHT_FORCE_MEMORY__ === true;
  }

  private async tryCloud<T>(op: () => Promise<T>): Promise<T | null> {
    if (this.forceMemory()) return null;
    try {
      const result = await op();
      this.cloudOk = true;
      return result;
    } catch (err) {
      if (this.cloudOk) {
        console.warn("[finsight] Enter Cloud unreachable — running on in-memory demo store:", err);
        this.cloudOk = false;
      }
      return null;
    }
  }

  private hydrate(base: FinSightState, wfRows: WorkflowRow[], auditRows: AuditRow[], leakRows: LeakRow[]): FinSightState {
    const leakMap = new Map(leakRows.map((l) => [l.id, l]));
    const normalize = <T extends { evidence?: FinSightState["auditEvents"][number]["evidence"] }>(obj: T): T => ({
      ...obj,
      evidence: Array.isArray(obj.evidence) ? obj.evidence : [],
    });
    return {
      ...base,
      aiMode: this.mode,
      workflows: wfRows
        .map((r) => normalize(r.data as unknown as Workflow))
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
      auditEvents: auditRows
        .map((r) => normalize(r.data as unknown as FinSightState["auditEvents"][number]))
        .sort((a, b) => (a.at < b.at ? 1 : -1)),
      leaks: base.leaks.map((l) => {
        const row = leakMap.get(l.id);
        if (!row) return l;
        return { ...(row.data as unknown as Leak), status: (row.status as Leak["status"]) ?? l.status, workflowId: row.workflow_id ?? undefined };
      }),
    };
  }

  private async seedIfEmpty(base: FinSightState): Promise<boolean> {
    const wf = await supabase.from("finsight_workflows").select("id").limit(1);
    if (wf.error) throw wf.error;
    if (wf.data.length > 0) return true;
    // Idempotent first-run seed from the canonical dataset.
    const workflowRows = base.workflows.map((w) => ({ id: w.id, data: w, status: w.status }));
    const auditRows = base.auditEvents.map((a) => ({ id: a.id, data: a }));
    const leakRows = base.leaks.map((l) => ({ id: l.id, data: l, status: l.status, workflow_id: l.workflowId ?? null }));
    const [w, a, l] = await Promise.all([
      supabase.from("finsight_workflows").upsert(workflowRows),
      supabase.from("finsight_audit_events").upsert(auditRows),
      supabase.from("finsight_leaks").upsert(leakRows),
    ]);
    if (w.error || a.error || l.error) throw new Error("seed failed");
    return true;
  }

  private async readState(): Promise<FinSightState> {
    const base = buildSeedState();
    await this.seedIfEmpty(base);
    const [wf, ae, lk] = await Promise.all([
      supabase.from("finsight_workflows").select("id, data, status").order("created_at", { ascending: false }),
      supabase.from("finsight_audit_events").select("id, data").order("created_at", { ascending: false }),
      supabase.from("finsight_leaks").select("id, status, workflow_id, data"),
    ]);
    if (wf.error || ae.error || lk.error) throw new Error("cloud read failed");
    return this.hydrate(base, wf.data as WorkflowRow[], ae.data as AuditRow[], lk.data as LeakRow[]);
  }

  async getState(): Promise<FinSightState> {
    const cloud = await this.tryCloud(() => this.readState());
    if (cloud) return cloud;
    return super.getState();
  }

  private async commit(fn: (s: FinSightState) => { workflows?: Workflow[]; auditEvents?: FinSightState["auditEvents"]; leaks?: Leak[] }): Promise<FinSightState> {
    const base = buildSeedState();
    await this.seedIfEmpty(base);
    const current = await this.readState();
    const changes = fn(current);
    const writes: Promise<unknown>[] = [];
    if (changes.workflows) {
      writes.push(
        supabase.from("finsight_workflows").upsert(changes.workflows.map((w) => ({ id: w.id, data: w, status: w.status }))),
      );
    }
    if (changes.auditEvents) {
      writes.push(supabase.from("finsight_audit_events").insert(changes.auditEvents.map((a) => ({ id: a.id, data: a }))));
    }
    if (changes.leaks) {
      writes.push(
        supabase.from("finsight_leaks").upsert(changes.leaks.map((l) => ({ id: l.id, data: l, status: l.status, workflow_id: l.workflowId ?? null }))),
      );
    }
    await Promise.all(writes);
    return this.readState();
  }

  async approveWorkflow(id: string, approver: { name: string; role: string }): Promise<FinSightState> {
    const cloud = await this.tryCloud(() => this.commit((s) => {
      const wf = s.workflows.find((w) => w.id === id);
      if (!wf) return {};
      const updated = engineApprove(wf, approver, new Date().toISOString());
      const audit = makeAuditEvent({
        actor: approver.name,
        role: approver.role,
        action: "workflow.approved",
        reason: "Approved via FinSight",
        evidence: updated.evidence,
        riskId: updated.sourceRiskId,
        workflowId: id,
        approvalState: "Approved",
        outcome: "Workflow approved; next action scheduled",
      });
      return { workflows: [updated], auditEvents: [audit] };
    }));
    if (cloud) return cloud;
    return super.approveWorkflow(id, approver);
  }

  async advanceWorkflow(id: string, actor: string, note?: string): Promise<FinSightState> {
    const cloud = await this.tryCloud(() => this.commit((s) => {
      const wf = s.workflows.find((w) => w.id === id);
      if (!wf) return {};
      const updated = engineAdvance(wf, new Date().toISOString(), actor);
      return {
        workflows: [updated],
        auditEvents: [makeAuditEvent({
          actor,
          role: s.currentUser.role,
          action: "workflow.status_changed",
          reason: note ?? "Status advanced",
          evidence: updated.evidence,
          riskId: updated.sourceRiskId,
          workflowId: id,
          approvalState: updated.status,
        })],
      };
    }));
    if (cloud) return cloud;
    return super.advanceWorkflow(id, actor, note);
  }

  async executeWorkflow(id: string, actor: string, note?: string): Promise<FinSightState> {
    const cloud = await this.tryCloud(() => this.commit((s) => {
      const wf = s.workflows.find((w) => w.id === id);
      if (!wf || wf.status !== "Approved") return {};
      const updated: Workflow = { ...wf, status: "Executed", events: [...wf.events, { at: new Date().toISOString(), status: "Executed", actor, note: note ?? "Executed" }] };
      return {
        workflows: [updated],
        auditEvents: [makeAuditEvent({
          actor,
          role: s.currentUser.role,
          action: "workflow.executed",
          reason: note ?? "Workflow executed",
          evidence: updated.evidence,
          riskId: updated.sourceRiskId,
          workflowId: id,
          approvalState: "Executed",
          outcome: "Workflow executed",
        })],
      };
    }));
    if (cloud) return cloud;
    return super.executeWorkflow(id, actor, note);
  }

  async createWorkflowFromLeak(leakId: string, type: Workflow["type"] = "finance-task"): Promise<FinSightState> {
    const cloud = await this.tryCloud(() => this.commit((s) => {
      const leak = s.leaks.find((l) => l.id === leakId);
      if (!leak || leak.status !== "open") return {};
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
      return {
        workflows: [wf],
        leaks: [{ ...leak, status: "recovering", workflowId: wf.id }],
        auditEvents: [makeAuditEvent({
          actor: s.currentUser.name,
          role: s.currentUser.role,
          action: "leak.recovery_initiated",
          reason: "Recover this value pressed on Money Leaks",
          evidence: leak.evidence,
          workflowId: wf.id,
          outcome: "Workflow created via EnterPro",
          amount: leak.amount,
        })],
      };
    }));
    if (cloud) return cloud;
    return super.createWorkflowFromLeak(leakId, type);
  }

  async createWorkflowFromRisk(riskId: string, type: Workflow["type"] = "investigation"): Promise<FinSightState> {
    const cloud = await this.tryCloud(() => this.commit((s) => {
      const risk = s.risks.find((r) => r.id === riskId);
      if (!risk) return {};
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
        workflows: [wf],
        auditEvents: [makeAuditEvent({
          actor: s.currentUser.name,
          role: s.currentUser.role,
          action: "workflow.created",
          reason: "Risk escalated to EnterPro workflow",
          evidence: risk.evidence,
          riskId: risk.id,
          workflowId: wf.id,
          outcome: "Workflow created via EnterPro",
          amount: risk.impact,
        })],
      };
    }));
    if (cloud) return cloud;
    return super.createWorkflowFromRisk(riskId, type);
  }

  async createCollectionsWorkflow(customerId: string): Promise<FinSightState> {
    const cloud = await this.tryCloud(() => this.commit((s) => {
      const customer = s.customers.find((c) => c.id === customerId);
      if (!customer) return {};
      const outstanding = s.receivables.filter((r) => r.customerId === customerId).reduce((sum, r) => sum + r.amount, 0);
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
        workflows: [wf],
        auditEvents: [makeAuditEvent({
          actor: s.currentUser.name,
          role: s.currentUser.role,
          action: "workflow.created",
          reason: `Collections task for ${customer.name}`,
          evidence: wf.evidence,
          workflowId: wf.id,
          outcome: "Workflow created via EnterPro",
          amount: outstanding,
        })],
      };
    }));
    if (cloud) return cloud;
    return super.createCollectionsWorkflow(customerId);
  }

  async notifyStakeholder(note: { to: string; subject: string; body: string; evidence?: Workflow["evidence"] }): Promise<FinSightState> {
    const cloud = await this.tryCloud(() => this.commit((s) => ({
      auditEvents: [makeAuditEvent({
        actor: s.currentUser.name,
        role: s.currentUser.role,
        action: "workflow.created",
        reason: `EnterPro notification to ${note.to}: ${note.subject} — ${note.body}`,
        evidence: note.evidence ?? [],
        outcome: "Stakeholder notified",
      })],
    })));
    if (cloud) return cloud;
    return super.notifyStakeholder(note);
  }

  async acknowledgeRisk(riskId: string): Promise<FinSightState> {
    const cloud = await this.tryCloud(() => this.commit((s) => ({
      auditEvents: [makeAuditEvent({
        actor: s.currentUser.name,
        role: s.currentUser.role,
        action: "risk.acknowledged",
        reason: "Acknowledged risk",
        riskId,
      })],
    })));
    if (cloud) return cloud;
    return super.acknowledgeRisk(riskId);
  }

  async recordRiskTrace(riskId: string): Promise<FinSightState> {
    const cloud = await this.tryCloud(() => this.commit((s) => ({
      auditEvents: [makeAuditEvent({
        actor: s.currentUser.name,
        role: s.currentUser.role,
        action: "risk.traced",
        reason: "Trace Cause executed",
        riskId,
      })],
    })));
    if (cloud) return cloud;
    return super.recordRiskTrace(riskId);
  }

  async askAnalyst(question: string): Promise<AnalystAnswer> {
    // Live path first, then fall back to the in-memory (template) path.
    const answer = await super.askAnalyst(question);
    return answer;
  }

  async getAnalystHistory(): Promise<AnalystHistoryEntry[]> {
    return super.getAnalystHistory();
  }

  async runSimulation(inputs: ScenarioInputs): Promise<{ result: ScenarioResult; state: FinSightState }> {
    const cloud = await this.tryCloud(() => this.commit((s) => {
      const result = runScenario(s, inputs);
      return {
        auditEvents: [makeAuditEvent({
          actor: s.currentUser.name,
          role: s.currentUser.role,
          action: "simulation.run",
          reason: `Simulation: revenue ${inputs.revenueChangePct}%, receivables delay ${inputs.receivablesDelayDays}d, vendor cost ${inputs.vendorCostChangePct}%, discretionary ${inputs.discretionarySpendChangePct}%, inventory ${inputs.inventorySpendChangePct}%`,
          outcome: `Scenario day-90 ${result.scenario.day90Balance.toLocaleString("en-IN")}`,
        })],
      };
    }));
    if (cloud) return cloud;
    return super.runSimulation(inputs);
  }

  async resetDemo(): Promise<FinSightState> {
    const cloud = await this.tryCloud(async () => {
      await Promise.all([
        supabase.from("finsight_workflows").delete().neq("id", ""),
        supabase.from("finsight_audit_events").delete().neq("id", ""),
        supabase.from("finsight_leaks").delete().neq("id", ""),
      ]);
      return this.readState();
    });
    if (cloud) return cloud;
    return super.resetDemo();
  }
}

export const backend: DataAccess = new CloudBackend();
