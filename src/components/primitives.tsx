import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { EvidenceRef, RiskLevel, WorkflowStatus } from "@/domain/types";
import { inrCompact } from "@/domain/format";
import { Loader2, Inbox } from "lucide-react";

// ---------------------------------------------------------------------------
// FinSight shared primitives — dense, evidence-first, enterprise terminal.
// ---------------------------------------------------------------------------

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground", className)}>
      {children}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  sub,
  delta,
  tone = "neutral",
  mono = true,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  delta?: { value: number; suffix?: string; positiveIsGood?: boolean };
  tone?: "neutral" | "positive" | "warn" | "danger" | "brand";
  mono?: boolean;
  className?: string;
}) {
  const deltaGood = delta ? (delta.positiveIsGood === false ? delta.value < 0 : delta.value >= 0) : null;
  const deltaColor = deltaGood ? "text-positive" : "text-danger";
  return (
    <div className={cn("rounded-[4px] border bg-card p-4", className)}>
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-2 text-[26px] font-semibold leading-none tracking-tight",
          mono && "tnum",
          tone === "positive" && "text-positive",
          tone === "warn" && "text-warn",
          tone === "danger" && "text-danger",
          tone === "brand" && "text-brand",
        )}
      >
        {value}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[12px] text-muted-foreground">
        {delta && (
          <span className={cn("tnum shrink-0 font-medium", deltaColor)}>
            {delta.value >= 0 ? "+" : "−"}
            {inrCompact(Math.abs(delta.value))}
            {delta.suffix ?? ""}
          </span>
        )}
        {sub && <span className="min-w-0">{sub}</span>}
      </div>
    </div>
  );
}

export function RiskLevelBadge({ level }: { level: RiskLevel }) {
  const map: Record<RiskLevel, { label: string; cls: string }> = {
    critical: { label: "CRITICAL", cls: "bg-danger/10 text-danger border-danger/30" },
    high: { label: "HIGH", cls: "bg-warn/10 text-warn border-warn/30" },
    medium: { label: "MEDIUM", cls: "bg-muted text-muted-foreground border-border" },
    low: { label: "LOW", cls: "bg-muted text-muted-foreground border-border" },
  };
  const m = map[level];
  return (
    <span className={cn("inline-flex items-center rounded-[3px] border px-1.5 py-[1px] text-[10px] font-bold tracking-[0.1em]", m.cls)}>
      {m.label}
    </span>
  );
}

export function StatusBadge({ status }: { status: WorkflowStatus }) {
  const map: Record<WorkflowStatus, string> = {
    Detected: "bg-muted text-muted-foreground border-border",
    Investigating: "bg-brand-soft text-brand border-brand/30",
    "Awaiting Approval": "bg-warn/10 text-warn border-warn/30",
    Approved: "bg-positive/10 text-positive border-positive/30",
    Executed: "bg-positive/10 text-positive border-positive/30",
  };
  return (
    <span className={cn("inline-flex items-center rounded-[3px] border px-1.5 py-[1px] text-[10px] font-semibold tracking-wide", map[status])}>
      {status}
    </span>
  );
}

export function ConfidenceBar({ value, label }: { value: number; label?: string }) {
  const pct = Math.round(value * 100);
  const color = pct >= 75 ? "bg-positive" : pct >= 45 ? "bg-warn" : "bg-danger";
  return (
    <div className="flex items-center gap-2">
      <div className="h-[5px] w-16 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="tnum text-[11px] text-muted-foreground">
        {label ?? "confidence"} {pct}%
      </span>
    </div>
  );
}

const EVIDENCE_TYPE_LABEL: Record<EvidenceRef["type"], string> = {
  invoice: "INV",
  vendor: "VND",
  po: "PO",
  payment: "PAY",
  expense: "EXP",
  subscription: "SUB",
  customer: "CUS",
  budget: "BDG",
  loan: "LOAN",
};

export function EvidenceList({ items, className }: { items: EvidenceRef[]; className?: string }) {
  const list = items ?? [];
  if (list.length === 0) return <span className="text-[11px] italic text-muted-foreground">No direct evidence linked</span>;
  return (
    <ul className={cn("space-y-1", className)}>
      {list.map((e, i) => (
        <li key={`${e.type}-${e.id}-${i}`} className="flex items-baseline gap-2 text-[12px]">
          <span className="tnum inline-flex shrink-0 rounded-[3px] border bg-muted px-1 font-mono text-[10px] text-muted-foreground">
            {EVIDENCE_TYPE_LABEL[e.type]}
          </span>
          <span className="font-mono font-medium text-foreground">{e.id}</span>
          {e.amount !== undefined && <span className="tnum text-muted-foreground">{inrCompact(e.amount)}</span>}
          {e.note && <span className="truncate text-muted-foreground">{e.note}</span>}
        </li>
      ))}
    </ul>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-10 text-[13px] text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-[4px] border border-danger/30 bg-danger/5 p-4 text-[13px] text-danger">
      <div className="font-medium">{message}</div>
      {onRetry && (
        <button onClick={onRetry} className="text-[12px] font-semibold underline underline-offset-2 hover:opacity-80">
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <Inbox className="h-6 w-6 text-muted-foreground/50" />
      <div className="text-[13px] font-medium text-foreground">{title}</div>
      {hint && <div className="max-w-sm text-[12px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function SourceTag({ kind }: { kind: "Observed" | "Calculated" | "Forecast" | "AI-recommendation" }) {
  const map = {
    Observed: "border-border text-muted-foreground",
    Calculated: "border-brand/40 text-brand",
    Forecast: "border-warn/40 text-warn",
    "AI-recommendation": "border-foreground/40 text-foreground",
  };
  return (
    <span className={cn("inline-flex items-center rounded-[3px] border px-1.5 py-[1px] text-[10px] font-semibold tracking-wide", map[kind])}>
      {kind}
    </span>
  );
}
