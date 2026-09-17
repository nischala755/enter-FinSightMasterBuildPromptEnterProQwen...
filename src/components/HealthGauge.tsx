import type { FinancialHealth } from "@/domain/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Semicircular gauge, score → arc. Top-left to top-right sweep. */
export function HealthGauge({ score, size = 168 }: { score: number; size?: number }) {
  const f = Math.max(0, Math.min(1, score / 100));
  const stroke = 11;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2 + stroke; // arc baseline sits low in the svg box
  const svgH = size / 2 + stroke + 12;
  const color = score >= 85 ? "hsl(var(--positive))" : score >= 70 ? "hsl(var(--brand))" : score >= 55 ? "hsl(var(--warn))" : "hsl(var(--danger))";
  const px = cx - r * Math.cos(f * Math.PI);
  const py = cy - r * Math.sin(f * Math.PI);

  return (
    <svg width={size} height={svgH} viewBox={`0 0 ${size} ${svgH}`} className="block">
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="hsl(var(--muted))"
        strokeWidth={stroke}
        strokeLinecap="round"
      />
      {f > 0.005 && (
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${px} ${py}`}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
        />
      )}
      <text x={cx} y={cy - 14} textAnchor="middle" className="tnum fill-foreground" fontSize={40} fontWeight={700}>
        {score}
      </text>
      <text x={cx} y={cy + 6} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={11} letterSpacing={2}>
        / 100
      </text>
    </svg>
  );
}

export function HealthPanel({ health, onExplain }: { health: FinancialHealth; onExplain?: () => void }) {
  return (
    <div className="flex flex-col rounded-[4px] border bg-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Financial health</div>
          <div className="mt-0.5 text-[12px] font-semibold text-brand">{health.grade}</div>
        </div>
        {onExplain && (
          <Button variant="ghost" size="sm" className="h-7 text-[11px] text-muted-foreground" onClick={onExplain}>
            Explain ▸
          </Button>
        )}
      </div>
      <div className="mt-3 flex justify-center">
        <HealthGauge score={health.score} />
      </div>
      <div className="mt-1 space-y-1.5">
        {health.components.map((c) => (
          <div key={c.key} className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">{c.label}</span>
            <span className={cn("tnum font-semibold", c.score >= 80 ? "text-positive" : c.score >= 55 ? "text-warn" : "text-danger")}>
              {c.score}
              <span className="text-muted-foreground/60">/100</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
