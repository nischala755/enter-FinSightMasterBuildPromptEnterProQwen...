import {
  Area,
  ComposedChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import type { DayPoint, ForecastResult } from "@/domain/types";
import { inrCompact } from "@/domain/format";

interface SeriesDef {
  name: string;
  color: string;
  points: DayPoint[];
  dashed?: boolean;
}

function mergeSeries(series: SeriesDef[]): { day: number; date: string; [k: string]: string | number }[] {
  const map = new Map<number, { day: number; date: string } & Record<string, number>>();
  for (const s of series) {
    for (const p of s.points) {
      const row = map.get(p.day) ?? { day: p.day, date: p.date };
      row[s.name] = p.balance;
      map.set(p.day, row);
    }
  }
  return [...map.values()].sort((a, b) => a.day - b.day);
}

function axisLabel(day: number): string {
  if (day === -182) return "−26w";
  if (day === 0) return "Today";
  if (day === 90) return "+90d";
  if (day > 0 && day % 15 === 0) return `d${day}`;
  return "";
}

function MinSafeLabel(props: { x?: number; y?: number; value?: string | number; viewBox?: { x?: number; y?: number; width?: number; height?: number } }) {
  const x = (props.x ?? props.viewBox?.x ?? 0) + 2;
  const y = (props.y ?? props.viewBox?.y ?? 0) - 4;
  return (
    <g>
      <rect x={x} y={y - 10} width={86} height={16} rx={2} fill="hsl(var(--card))" stroke="hsl(var(--danger))" strokeOpacity={0.35} />
      <text x={x + 4} y={y + 1} fontSize={10} fill="hsl(var(--danger))">
        Min-safe {String(props.value ?? "")}
      </text>
    </g>
  );
}

export function CashChart({
  series,
  minSafe,
  breachDay,
  height = 300,
}: {
  series: SeriesDef[];
  minSafe: number;
  breachDay?: number | null;
  height?: number;
}) {
  const data = mergeSeries(series);
  const breachPoint = breachDay
    ? series[0]?.points.find((p) => p.day === breachDay)
    : undefined;

  const fmtTick = (v: number) => inrCompact(v);

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.name} id={`grad-${s.name}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="hsl(var(--border))" />
          <XAxis
            dataKey="day"
            tickFormatter={axisLabel}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
            interval={4}
            minTickGap={28}
          />
          <YAxis
            tickFormatter={fmtTick}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            width={58}
            domain={["auto", "auto"]}
          />
          <Tooltip
            labelFormatter={(d) => `Day ${d}`}
            formatter={(value: number, name: string) => [inrCompact(value), name]}
            contentStyle={{
              background: "hsl(var(--panel))",
              border: "1px solid hsl(var(--panel-border))",
              borderRadius: 4,
              fontSize: 12,
              color: "hsl(var(--panel-foreground))",
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} iconType="plainline" />
          <ReferenceLine
            y={minSafe}
            stroke="hsl(var(--danger))"
            strokeDasharray="4 3"
            strokeOpacity={0.7}
            label={<MinSafeLabel value={inrCompact(minSafe)} />}
          />
          {series.map((s) => (
            <Area
              key={s.name}
              type="monotone"
              dataKey={s.name}
              stroke={s.color}
              strokeWidth={s.dashed ? 1.6 : 2}
              strokeDasharray={s.dashed ? "5 4" : undefined}
              fill={`url(#grad-${s.name})`}
              isAnimationActive
              animationDuration={500}
              connectNulls
            />
          ))}
          {breachPoint && (
            <ReferenceDot
              x={breachPoint.day}
              y={breachPoint.balance}
              r={4}
              fill="hsl(var(--danger))"
              stroke="hsl(var(--card))"
              strokeWidth={2}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function baselineSeries(forecast: ForecastResult): SeriesDef {
  return {
    name: "Base",
    color: "hsl(var(--brand))",
    points: [...forecast.history, ...forecast.series],
  };
}
