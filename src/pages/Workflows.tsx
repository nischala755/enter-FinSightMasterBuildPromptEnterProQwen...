import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, Send, SearchCheck, ShieldCheck, Play } from "lucide-react";
import { PageHeader, StatusBadge, EvidenceList, EmptyState, SourceTag } from "@/components/primitives";
import {
  useAdvanceWorkflow,
  useApproveWorkflow,
  useEnterproCreateWorkflowFromRisk,
  useExecuteWorkflow,
  useFinSightState,
} from "@/hooks/useFinSight";
import { enterpro } from "@/services/enterpro";
import { inrCompact, formatDateTime } from "@/domain/format";
import type { Workflow, WorkflowStatus } from "@/domain/types";
import { useDemoIntent } from "@/components/demo/DemoWalkthrough";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const TYPE_LABEL: Record<Workflow["type"], string> = {
  approval: "Approval",
  "hold-payment": "Hold payment",
  investigation: "Investigation",
  "finance-task": "Finance task",
  "vendor-review": "Vendor review",
  "collections-task": "Collections task",
  recovery: "Recovery",
};

const STATUS_ORDER: WorkflowStatus[] = ["Detected", "Investigating", "Awaiting Approval", "Approved", "Executed"];

export function Workflows() {
  const { data: state } = useFinSightState();
  const advance = useAdvanceWorkflow();
  const approve = useApproveWorkflow();
  const execute = useExecuteWorkflow();
  const createFromRisk = useEnterproCreateWorkflowFromRisk();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const { intent } = useDemoIntent();

  const user = state?.currentUser ?? { name: "A. Mehta", role: "Finance Manager" };

  // Demo intent: create an EnterPro workflow from the flagged risk (hold PO-1184)
  useEffect(() => {
    if (intent.type === "create-workflow" && intent.riskId) {
      createFromRisk.mutate(
        { riskId: intent.riskId, type: "hold-payment" },
        { onSuccess: () => toast.success(`EnterPro workflow created for ${intent.riskId} — status Detected`) },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent.ref]);

  const workflows = useMemo(() => {
    if (!state) return [];
    return state.workflows
      .slice()
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .filter((w) => (statusFilter === "all" ? true : w.status === statusFilter));
  }, [state, statusFilter]);

  if (!state) return <div className="p-6 text-[13px] text-muted-foreground">Loading…</div>;

  const canAdvance = (w: Workflow) => w.status === "Detected" || w.status === "Investigating";

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Workflows"
        subtitle="Enterprise orchestration via EnterPro. Approving a workflow records the approver, creates an audit event and updates the UI immediately — the chain is fully live."
        actions={
          <div className="flex overflow-hidden rounded-[3px] border bg-card">
            {(["all", ...STATUS_ORDER] as const).map((s) => (
              <button
                key={s}
                className={cn("px-2.5 py-1.5 text-[11.5px] font-medium", statusFilter === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
                onClick={() => setStatusFilter(s)}
              >
                {s === "all" ? "All" : s}
              </button>
            ))}
          </div>
        }
      />

      {workflows.length === 0 ? (
        <EmptyState title="No workflows in this state" hint="Approve or advance an existing workflow to see it move." />
      ) : (
        <div className="space-y-2.5">
          {workflows.map((wf) => {
            const open = expanded === wf.id;
            const stepIdx = STATUS_ORDER.indexOf(wf.status);
            return (
              <div key={wf.id} className="rounded-[4px] border bg-card">
                <button className="flex w-full flex-wrap items-center gap-3 p-4 text-left" onClick={() => setExpanded(open ? null : wf.id)}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10.5px] text-muted-foreground">{wf.id}</span>
                      <span className="rounded-[3px] border bg-muted px-1.5 py-[1px] text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {TYPE_LABEL[wf.type]}
                      </span>
                      {wf.origin === "enterpro" && (
                        <span className="rounded-[3px] border border-brand/30 bg-brand-soft px-1.5 py-[1px] text-[10px] font-semibold text-brand">EnterPro</span>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-[14px] font-semibold">{wf.title}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      owner {wf.owner} · created {formatDateTime(wf.createdAt)}
                      {wf.amount !== undefined && <> · <span className="tnum font-semibold text-foreground">{inrCompact(wf.amount)}</span></>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={wf.status} />
                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
                  </div>
                </button>

                {open && (
                  <div className="grid grid-cols-1 gap-4 border-t p-4 md:grid-cols-2">
                    <div>
                      <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Lifecycle</div>
                      <div className="space-y-0">
                        {STATUS_ORDER.map((s, i) => {
                          const reached = i <= stepIdx;
                          const isCurrent = i === stepIdx;
                          return (
                            <div key={s} className="flex gap-2.5">
                              <div className="flex flex-col items-center">
                                <div className={cn("h-2.5 w-2.5 rounded-full border-2", reached ? "border-brand bg-brand" : "border-border bg-card", isCurrent && "animate-pulse-node")} />
                                {i < STATUS_ORDER.length - 1 && <div className={cn("h-4 w-px", i < stepIdx ? "bg-brand" : "bg-border")} />}
                              </div>
                              <div className={cn("pb-1 text-[12px]", reached ? "font-semibold text-foreground" : "text-muted-foreground/60")}>{s}</div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-3 space-y-1 border-t pt-2">
                        {wf.events.map((e, i) => (
                          <div key={i} className="flex items-baseline gap-2 text-[11.5px]">
                            <span className="tnum shrink-0 font-mono text-[10px] text-muted-foreground">{formatDateTime(e.at)}</span>
                            <span className="font-semibold">{e.actor}</span>
                            <span className="text-muted-foreground">→ {e.status}{e.note ? ` · ${e.note}` : ""}</span>
                          </div>
                        ))}
                      </div>
                      {wf.approvals.length > 0 && (
                        <div className="mt-3 flex items-center gap-2 rounded-[3px] border border-positive/30 bg-positive/5 px-3 py-2 text-[12px]">
                          <ShieldCheck className="h-4 w-4 text-positive" />
                          <span>
                            Approved by <span className="font-semibold">{wf.approvals.map((a) => a.approver).join(", ")}</span> ({wf.approvals.map((a) => a.role).join(", ")})
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col">
                      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Evidence</div>
                      <div className="mt-1 flex-1">
                        <EvidenceList items={wf.evidence} />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">
                        {canAdvance(wf) && (
                          <ActionButton
                            icon={<Play className="h-3.5 w-3.5" />}
                            label={wf.status === "Detected" ? "Start investigating" : "Send for approval"}
                            onClick={() => {
                              advance.mutate({ id: wf.id, actor: user.name, note: `Advanced to ${wf.status === "Detected" ? "Investigating" : "Awaiting Approval"}` });
                              toast.success(`${wf.id} → ${wf.status === "Detected" ? "Investigating" : "Awaiting Approval"}`);
                            }}
                            pending={advance.isPending}
                            className="border-brand/40 bg-brand-soft text-brand hover:bg-brand hover:text-brand-foreground"
                          />
                        )}
                        {wf.status === "Awaiting Approval" && (
                          <ActionButton
                            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                            label="Approve"
                            onClick={() => {
                              approve.mutate({ id: wf.id, approver: { name: user.name, role: user.role } });
                              toast.success(`${wf.id} approved by ${user.name} — audit event created`);
                            }}
                            pending={approve.isPending}
                            className="border-positive/40 bg-positive/10 text-positive hover:bg-positive hover:text-positive-foreground"
                          />
                        )}
                        {wf.status === "Approved" && (
                          <ActionButton
                            icon={<Send className="h-3.5 w-3.5" />}
                            label="Execute"
                            onClick={() => {
                              execute.mutate({ id: wf.id, actor: user.name, note: "Executed" });
                              toast.success(`${wf.id} executed`);
                            }}
                            pending={execute.isPending}
                            className="border-positive/40 bg-positive/10 text-positive hover:bg-positive hover:text-positive-foreground"
                          />
                        )}
                        {wf.status === "Executed" && (
                          <span className="flex items-center gap-1.5 text-[11.5px] text-positive">
                            <SearchCheck className="h-3.5 w-3.5" /> Completed
                          </span>
                        )}
                        <SourceTag kind="AI-recommendation" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex items-start gap-2 rounded-[3px] border border-panel-border bg-panel p-3 text-[11.5px] leading-relaxed text-panel-foreground/70">
        <span className="mt-0.5 shrink-0 rounded-[3px] border border-brand/40 px-1.5 text-[10px] font-bold text-brand">ENTERPRO</span>
        Workflows are created through the EnterPro orchestration layer (stateful mock) and persist — refresh the page or open a second session and the status is unchanged.
      </div>
    </div>
  );
}

function ActionButton({ icon, label, onClick, pending, className }: { icon: React.ReactNode; label: string; onClick: () => void; pending?: boolean; className?: string }) {
  return (
    <button
      disabled={pending}
      onClick={onClick}
      className={cn("flex h-8 items-center gap-1.5 rounded-[3px] border px-3 text-[11.5px] font-semibold transition-colors disabled:opacity-60", className)}
    >
      {icon}
      {label}
    </button>
  );
}
