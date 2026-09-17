import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/primitives";
import { useFinSightState } from "@/hooks/useFinSight";
import { inrCompact } from "@/domain/format";
import { cn } from "@/lib/utils";

type RowKind = "invoice" | "payment" | "po" | "ap";

interface Row {
  kind: RowKind;
  id: string;
  counterparty: string;
  amount: number;
  date: string;
  status: string;
  evidence: string;
  statusTone: "paid" | "open" | "overdue" | "muted" | "danger";
}

const KIND_LABEL: Record<RowKind, string> = {
  invoice: "AR invoice",
  payment: "Payment",
  po: "Purchase order",
  ap: "AP invoice",
};

export function Transactions() {
  const { data: state } = useFinSightState();
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = useMemo<Row[]>(() => {
    if (!state) return [];
    const customerName = (id: string) => state.customers.find((c) => c.id === id)?.name ?? id;
    const vendorName = (id: string) => state.vendors.find((v) => v.id === id)?.name ?? id;

    const invoiceRows: Row[] = state.invoices.map((inv) => ({
      kind: "invoice" as const,
      id: inv.id,
      counterparty: customerName(inv.customerId),
      amount: inv.amount,
      date: inv.issuedAt,
      status: inv.status,
      evidence: inv.poRef ? `PO ${inv.poRef}` : "—",
      statusTone: inv.status === "paid" ? "paid" : inv.status === "overdue" || inv.status === "disputed" ? "overdue" : "open",
    }));
    const paymentRows: Row[] = state.payments.map((p) => ({
      kind: "payment" as const,
      id: p.id,
      counterparty: customerName(p.customerId),
      amount: p.amount,
      date: p.receivedAt,
      status: "received",
      evidence: p.invoiceId ?? "—",
      statusTone: "paid" as const,
    }));
    const poRows: Row[] = state.purchaseOrders.map((po) => ({
      kind: "po" as const,
      id: po.id,
      counterparty: vendorName(po.vendorId),
      amount: po.amount,
      date: po.issuedAt,
      status: po.status,
      evidence: po.expectedDelivery,
      statusTone: po.status === "fulfilled" ? "paid" : po.status === "approved" ? "open" : "muted",
    }));
    const apRows: Row[] = state.apInvoices.map((a) => ({
      kind: "ap" as const,
      id: a.id,
      counterparty: vendorName(a.vendorId),
      amount: a.amount,
      date: a.receivedAt,
      status: a.duplicateOf ? "duplicate" : a.status,
      evidence: a.poRef ?? "—",
      statusTone: a.duplicateOf ? "danger" : a.status === "paid" ? "paid" : "open",
    }));

    return [...invoiceRows, ...paymentRows, ...poRows, ...apRows]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .filter((r) => (kindFilter === "all" ? true : r.kind === kindFilter))
      .filter((r) => {
        if (statusFilter === "all") return true;
        if (statusFilter === "duplicate") return r.status === "duplicate";
        if (statusFilter === "overdue") return r.status === "overdue" || r.status === "disputed";
        return r.status === statusFilter;
      })
      .filter((r) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return r.id.toLowerCase().includes(q) || r.counterparty.toLowerCase().includes(q);
      });
  }, [state, kindFilter, statusFilter, search]);

  if (!state) return <div className="p-6 text-[13px] text-muted-foreground">Loading…</div>;

  const statusToneCls: Record<Row["statusTone"], string> = {
    paid: "bg-positive/10 text-positive border-positive/30",
    open: "bg-muted text-muted-foreground border-border",
    overdue: "bg-warn/10 text-warn border-warn/30",
    muted: "bg-muted text-muted-foreground border-border",
    danger: "bg-danger/10 text-danger border-danger/30",
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Transactions"
        subtitle="The seeded ledger behind every figure — invoices, receipts, purchase orders and vendor payables, with linked evidence."
        actions={
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ID or counterparty…"
              className="h-8 w-56 rounded-[3px] border bg-card pl-8 pr-3 text-[12px] outline-none placeholder:text-muted-foreground focus:border-brand"
            />
          </div>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <FilterPills
          options={[["all", "All"], ["invoice", "AR invoices"], ["payment", "Payments"], ["po", "Purchase orders"], ["ap", "AP invoices"]]}
          value={kindFilter}
          onChange={setKindFilter}
        />
        <FilterPills
          options={[["all", "Any status"], ["paid", "Paid"], ["open", "Open"], ["overdue", "Overdue"], ["duplicate", "Duplicates"]]}
          value={statusFilter}
          onChange={setStatusFilter}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No transactions match" hint="Adjust the filters or search query." />
      ) : (
        <div className="overflow-hidden rounded-[4px] border bg-card">
          <table className="w-full text-left text-[12.5px]">
            <thead>
              <tr className="border-b bg-muted/40 text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">
                <th className="px-3 py-2 font-semibold">ID</th>
                <th className="px-3 py-2 font-semibold">Type</th>
                <th className="px-3 py-2 font-semibold">Counterparty</th>
                <th className="px-3 py-2 text-right font-semibold">Amount</th>
                <th className="px-3 py-2 font-semibold">Date</th>
                <th className="px-3 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={cn("cursor-pointer border-b border-border/50 transition-colors hover:bg-muted/30", expanded === r.id && "bg-muted/20")} onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                  <td className="px-3 py-2 font-mono text-[11.5px]">{r.id}</td>
                  <td className="px-3 py-2 text-muted-foreground">{KIND_LABEL[r.kind]}</td>
                  <td className="px-3 py-2 font-medium">{r.counterparty}</td>
                  <td className="tnum px-3 py-2 text-right font-semibold">{inrCompact(r.amount)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{new Date(r.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</td>
                  <td className="px-3 py-2">
                    <span className={cn("rounded-[3px] border px-1.5 py-[1px] text-[10px] font-semibold capitalize tracking-wide", statusToneCls[r.statusTone])}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {expanded && (
            <div className="border-t bg-muted/20 px-4 py-3 text-[12px] text-muted-foreground">
              Linked evidence: <span className="font-mono text-foreground">{rows.find((r) => r.id === expanded)?.evidence ?? "—"}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FilterPills({ options, value, onChange }: { options: [string, string][]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex overflow-hidden rounded-[3px] border bg-card">
      {options.map(([v, label]) => (
        <button
          key={v}
          className={cn("px-2.5 py-1.5 text-[11.5px] font-medium transition-colors", value === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
          onClick={() => onChange(v)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
