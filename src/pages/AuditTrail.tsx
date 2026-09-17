import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { PageHeader, EmptyState, SourceTag } from "@/components/primitives";
import { useFinSightState } from "@/hooks/useFinSight";
import { formatDateTime, inrCompact } from "@/domain/format";
import type { AuditAction } from "@/domain/types";
import { cn } from "@/lib/utils";

export function AuditTrail() {
  const { data: state } = useFinSightState();
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const events = useMemo(() => {
    if (!state) return [];
    return [...state.auditEvents]
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .filter((e) => (actionFilter === "all" ? true : e.action === actionFilter))
      .filter((e) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          e.id.toLowerCase().includes(q) ||
          e.actor.toLowerCase().includes(q) ||
          e.riskId?.toLowerCase().includes(q) ||
          e.workflowId?.toLowerCase().includes(q) ||
          (e.reason ?? "").toLowerCase().includes(q)
        );
      });
  }, [state, actionFilter, search]);

  const actions = useMemo(() => {
    if (!state) return [];
    return [...new Set(state.auditEvents.map((e) => e.action))].sort();
  }, [state]);

  if (!state) return <div className="p-6 text-[13px] text-muted-foreground">Loading…</div>;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Audit Trail"
        subtitle="Immutable event log of every workflow, risk and approval action — actor, action, reason, evidence, approval state and outcome."
        actions={
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search actor, ID, reason…"
              className="h-8 w-56 rounded-[3px] border bg-card pl-8 pr-3 text-[12px] outline-none placeholder:text-muted-foreground focus:border-brand"
            />
          </div>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <button
          className={cn("rounded-[3px] border px-2.5 py-1 text-[11.5px] font-medium", actionFilter === "all" ? "border-transparent bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground")}
          onClick={() => setActionFilter("all")}
        >
          All actions
        </button>
        {actions.map((a) => (
          <button
            key={a}
            className={cn("rounded-[3px] border px-2.5 py-1 text-[11.5px] font-medium", actionFilter === a ? "border-transparent bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground")}
            onClick={() => setActionFilter(a)}
          >
            {a}
          </button>
        ))}
      </div>

      {events.length === 0 ? (
        <EmptyState title="No audit events match" hint="Adjust the action filter or search query." />
      ) : (
        <div className="overflow-x-auto rounded-[4px] border bg-card">
          <table className="w-full min-w-[820px] text-left text-[12px]">
            <thead>
              <tr className="border-b bg-muted/40 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                <th className="px-3 py-2 font-semibold">Timestamp</th>
                <th className="px-3 py-2 font-semibold">Actor</th>
                <th className="px-3 py-2 font-semibold">Action</th>
                <th className="px-3 py-2 font-semibold">Reason / evidence</th>
                <th className="px-3 py-2 font-semibold">Risk</th>
                <th className="px-3 py-2 font-semibold">Workflow</th>
                <th className="px-3 py-2 font-semibold">Approval state</th>
                <th className="px-3 py-2 font-semibold">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => {
                const evidence = e.evidence ?? [];
                return (
                <tr key={e.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
                  <td className="tnum whitespace-nowrap px-3 py-2 font-mono text-[11px] text-muted-foreground">{formatDateTime(e.at)}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span className="font-semibold">{e.actor}</span>
                    <span className="block text-[10.5px] text-muted-foreground">{e.role}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded-[3px] border bg-muted/40 px-1.5 py-[1px] font-mono text-[10px] text-foreground">{e.action}</span>
                  </td>
                  <td className="max-w-[260px] px-3 py-2">
                    <div className="truncate text-muted-foreground">{e.reason ?? "—"}</div>
                    {evidence.length > 0 && (
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {evidence.slice(0, 3).map((ev) => (
                          <span key={ev.id} className="font-mono text-[10px] text-brand">{ev.id}</span>
                        ))}
                        {evidence.length > 3 && <span className="text-[10px] text-muted-foreground">+{evidence.length - 3}</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{e.riskId ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{e.workflowId ?? "—"}</td>
                  <td className="px-3 py-2">
                    {e.approvalState ? (
                      <span className={cn("rounded-[3px] border px-1.5 py-[1px] text-[10px] font-semibold", e.approvalState === "Approved" || e.approvalState === "Executed" ? "border-positive/30 bg-positive/10 text-positive" : "border-warn/30 bg-warn/10 text-warn")}>
                        {e.approvalState}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="max-w-[180px] px-3 py-2">
                    <span className="line-clamp-1 text-muted-foreground">{e.outcome ?? "—"}</span>
                    {e.amount !== undefined && <span className="tnum block text-[11px] font-semibold">{inrCompact(e.amount)}</span>}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
        <SourceTag kind="Calculated" />
        {events.length} event(s) · every mutation on workflows, risks, leaks and simulations appends an entry.
      </div>
    </div>
  );
}
