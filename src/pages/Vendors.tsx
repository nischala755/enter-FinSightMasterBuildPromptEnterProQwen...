import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Flag, ExternalLink } from "lucide-react";
import { PageHeader, SectionLabel } from "@/components/primitives";
import { useFinSightState } from "@/hooks/useFinSight";
import { inrCompact } from "@/domain/format";
import { cn } from "@/lib/utils";

const FLAG_LABEL: Record<string, string> = {
  "price-creep": "Price creep",
  "bank-detail-change": "Bank-detail change",
  "duplicate-payment-risk": "Duplicate-payment risk",
  "single-source": "Single source",
};

function Sparkline({ points, tone }: { points: number[]; tone: "brand" | "danger" | "neutral" }) {
  const w = 120;
  const h = 30;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = w / (points.length - 1);
  const coords = points.map((p, i) => `${(i * step).toFixed(1)},${(h - 4 - ((p - min) / span) * (h - 8)).toFixed(1)}`);
  const color = tone === "brand" ? "hsl(var(--brand))" : tone === "danger" ? "hsl(var(--danger))" : "hsl(var(--muted-foreground))";
  const rising = points[points.length - 1] > points[0];
  const fillColor = tone === "danger" ? "hsl(var(--danger))" : tone === "brand" ? "hsl(var(--brand))" : "hsl(var(--muted-foreground))";
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={coords.join(" ")} fill="none" stroke={rising ? color : "hsl(var(--muted-foreground))"} strokeWidth={1.6} />
      <polygon points={`0,${h} ${coords.join(" ")} ${w},${h}`} fill={fillColor} opacity={0.1} />
    </svg>
  );
}

export function Vendors() {
  const { data: state } = useFinSightState();

  const view = useMemo(() => {
    if (!state) return null;
    return state.vendors
      .slice()
      .sort((a, b) => b.monthlySpend - a.monthlySpend)
      .map((v) => {
        const first = v.priceTrend[0].index;
        const last = v.priceTrend[v.priceTrend.length - 1].index;
        const drift = ((last - first) / first) * 100;
        const creep = v.flags.includes("price-creep");
        return { vendor: v, drift, creep, indices: v.priceTrend.map((p) => p.index) };
      });
  }, [state]);

  if (!state || !view) return <div className="p-6 text-[13px] text-muted-foreground">Loading…</div>;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Vendors"
        subtitle="Pricing history, risk flags and their links back into risks and leaks. Vendor cost stability is a weighted component of financial health."
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {view.map(({ vendor, drift, creep, indices }) => (
          <div key={vendor.id} className="rounded-[4px] border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10.5px] text-muted-foreground">{vendor.id}</span>
                </div>
                <div className="mt-0.5 truncate text-[14px] font-semibold">{vendor.name}</div>
                <div className="text-[11px] text-muted-foreground">{vendor.category}</div>
              </div>
              <div className="text-right">
                <div className="tnum text-[15px] font-semibold">{inrCompact(vendor.monthlySpend)}</div>
                <div className="text-[10px] text-muted-foreground">/month</div>
              </div>
            </div>

            <div className="mt-3 flex items-end justify-between gap-3">
              <div>
                <SectionLabel>Price index</SectionLabel>
                <div className={cn("tnum mt-1 text-[13px] font-semibold", creep ? "text-danger" : drift > 3 ? "text-warn" : "text-foreground")}>
                  {drift > 0 ? "+" : ""}{drift.toFixed(1)}% (Q1 26 → Q1 27)
                </div>
              </div>
              <Sparkline points={indices} tone={creep ? "danger" : drift > 3 ? "brand" : "neutral"} />
            </div>

            {vendor.flags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {vendor.flags.map((f) => (
                  <span key={f} className="flex items-center gap-1 rounded-[3px] border border-warn/30 bg-warn/10 px-1.5 py-[1px] text-[10px] font-semibold text-warn">
                    <Flag className="h-2.5 w-2.5" /> {FLAG_LABEL[f] ?? f}
                  </span>
                ))}
              </div>
            )}

            {(vendor.riskIds.length > 0 || vendor.leakIds.length > 0) && (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t pt-2.5 text-[11px]">
                {vendor.riskIds.map((rid) => (
                  <Link key={rid} to={`/risk-radar?risk=${rid}`} className="flex items-center gap-1 font-semibold text-brand hover:underline">
                    {rid} <ExternalLink className="h-2.5 w-2.5" />
                  </Link>
                ))}
                {vendor.leakIds.map((lid) => (
                  <Link key={lid} to="/money-leaks" className="flex items-center gap-1 font-semibold text-warn hover:underline">
                    {lid} <ExternalLink className="h-2.5 w-2.5" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
