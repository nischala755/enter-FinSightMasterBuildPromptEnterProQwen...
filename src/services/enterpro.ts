// ---------------------------------------------------------------------------
// EnterPro — the enterprise workflow/orchestration layer FinSight talks to.
// No real EnterPro credentials exist, so this is a STATEFUL mock: every
// operation creates/updates real workflow + audit rows through the DataAccess
// layer, so status persists across refreshes and is visible to any viewer.
// Swapping this module for a real HTTP client requires no changes elsewhere.
// ---------------------------------------------------------------------------

import type { FinSightState, Workflow } from "@/domain/types";
import { backend } from "./data";

export interface EnterProResult {
  ok: boolean;
  workflowId?: string;
  status?: Workflow["status"];
  message: string;
}

async function run(op: () => Promise<FinSightState>, message: string): Promise<EnterProResult> {
  const state = await op();
  const newest = state.workflows[state.workflows.length - 1];
  return { ok: true, workflowId: newest?.id, status: newest?.status, message };
}

export interface StakeholderNote {
  to: string;
  subject: string;
  body: string;
  evidence?: Workflow["evidence"];
}

export const enterpro = {
  /** Create an approval request on an existing workflow. */
  async createApproval(workflowId: string, approver: { name: string; role: string }): Promise<EnterProResult> {
    const state = await backend.approveWorkflow(workflowId, approver);
    const wf = state.workflows.find((w) => w.id === workflowId);
    return { ok: true, workflowId, status: wf?.status, message: "Approval recorded" };
  },

  /** Hold a payment related to a risk (e.g. bulk PO). */
  async holdPayment(riskId: string): Promise<EnterProResult> {
    return run(() => backend.createWorkflowFromRisk(riskId, "hold-payment"), "Hold-payment workflow created");
  },

  /** Open an investigation on a flagged risk. */
  async createInvestigation(riskId: string): Promise<EnterProResult> {
    return run(() => backend.createWorkflowFromRisk(riskId, "investigation"), "Investigation workflow created");
  },

  /** Assign a finance task (subscription audit, expense review, recovery). */
  async assignFinanceTask(riskId: string): Promise<EnterProResult> {
    return run(() => backend.createWorkflowFromRisk(riskId, "finance-task"), "Finance task created");
  },

  /** Notify a stakeholder; recorded as an audit event. */
  async notifyStakeholder(note: StakeholderNote): Promise<EnterProResult> {
    const state = await backend.notifyStakeholder(note);
    return {
      ok: true,
      status: state.workflows[state.workflows.length - 1]?.status,
      message: `Notification sent to ${note.to}`,
    };
  },

  /** Create a vendor pricing review for a vendor-related risk. */
  async createVendorReview(riskId: string): Promise<EnterProResult> {
    return run(() => backend.createWorkflowFromRisk(riskId, "vendor-review"), "Vendor review workflow created");
  },

  /** Create a collections task for a customer. */
  async createCollectionsTask(customerId: string): Promise<EnterProResult> {
    return run(() => backend.createCollectionsWorkflow(customerId), "Collections task created");
  },

  /** Recover a leaked value as a workflow. */
  async recoverLeak(leakId: string): Promise<EnterProResult> {
    return run(() => backend.createWorkflowFromLeak(leakId, "recovery"), "Recovery workflow created");
  },
};
