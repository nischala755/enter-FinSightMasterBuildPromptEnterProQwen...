import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Radar,
  Droplets,
  TrendingUp,
  SlidersHorizontal,
  ArrowLeftRight,
  Building2,
  Workflow as WorkflowIcon,
  FileSearch,
  ScrollText,
  CircleDollarSign,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFinSightState, useResetDemo } from "@/hooks/useFinSight";
import { inrCompact } from "@/domain/format";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DemoTrigger } from "@/components/demo/DemoTrigger";
import { DemoProvider } from "@/components/demo/DemoContext";
import { DemoWalkthrough } from "@/components/demo/DemoWalkthrough";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/risk-radar", label: "Risk Radar", icon: Radar },
  { to: "/money-leaks", label: "Money Leaks", icon: Droplets },
  { to: "/cash-forecast", label: "Cash Forecast", icon: TrendingUp },
  { to: "/simulator", label: "Simulator", icon: SlidersHorizontal },
  { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { to: "/vendors", label: "Vendors", icon: Building2 },
  { to: "/workflows", label: "Workflows", icon: WorkflowIcon },
  { to: "/ai-analyst", label: "AI Analyst", icon: FileSearch },
  { to: "/audit-trail", label: "Audit Trail", icon: ScrollText },
];

function Sidebar({ cash, aiMode }: { cash: number; aiMode: "live" | "fallback" }) {
  const reset = useResetDemo();
  return (
    <aside className="flex h-full w-[228px] shrink-0 flex-col bg-panel text-panel-foreground">
      <div className="flex items-center gap-2.5 border-b border-panel-border px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-[3px] border border-brand/60 text-[13px] font-bold text-brand-foreground" style={{ backgroundColor: "hsl(var(--brand))" }}>
          F
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-tight">FinSight</div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-panel-foreground/50">Northstar Commerce</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              cn(
                "mb-[2px] flex items-center gap-2.5 rounded-[3px] px-2.5 py-[7px] text-[12.5px] font-medium transition-colors",
                isActive
                  ? "bg-panel-foreground/10 text-panel-foreground shadow-[inset_2px_0_0_0_hsl(var(--brand))]"
                  : "text-panel-foreground/55 hover:bg-panel-foreground/5 hover:text-panel-foreground",
              )
            }
          >
            <item.icon className="h-[15px] w-[15px] shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-panel-border px-4 py-3 text-[11px] leading-relaxed">
        <div className="flex items-center justify-between">
          <span className="uppercase tracking-[0.12em] text-panel-foreground/40">Cash position</span>
          <span className="tnum font-semibold text-panel-foreground">{inrCompact(cash)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="uppercase tracking-[0.12em] text-panel-foreground/40">Intelligence</span>
          <span className={cn("flex items-center gap-1.5", aiMode === "live" ? "text-positive" : "text-warn")}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {aiMode === "live" ? "Qwen live" : "Demo mode"}
          </span>
        </div>
        <div className="mt-3 flex gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 flex-1 border border-panel-border text-[11px] text-panel-foreground/60 hover:bg-panel-foreground/5 hover:text-panel-foreground"
            onClick={() => {
              reset.mutate();
              toast.success("Demo data reset to seed state");
            }}
          >
            <RotateCcw className="mr-1 h-3 w-3" /> Reset
          </Button>
          <DemoTrigger />
        </div>
      </div>
    </aside>
  );
}

function Header({ cash, minSafe, aiMode }: { cash: number; minSafe: number; aiMode: "live" | "fallback" }) {
  const { pathname } = useLocation();
  const current = NAV.find((n) => (n.to === "/" ? pathname === "/" : pathname.startsWith(n.to)));
  return (
    <header className="flex h-[52px] shrink-0 items-center justify-between border-b bg-card px-5">
      <div className="flex items-baseline gap-3">
        <span className="text-[14px] font-semibold tracking-tight">{current?.label ?? "FinSight"}</span>
        <span className="text-[11px] text-muted-foreground">
          {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-3 text-[11.5px] md:flex">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <CircleDollarSign className="h-3.5 w-3.5 text-brand" />
            Current cash <span className="tnum font-semibold text-foreground">{inrCompact(cash)}</span>
          </span>
          <span className="text-muted-foreground">Min-safe <span className="tnum font-semibold text-foreground">{inrCompact(minSafe)}</span></span>
        </div>
        <div className="h-6 w-px bg-border" />
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">AM</div>
          <div className="hidden leading-tight md:block">
            <div className="text-[11.5px] font-semibold">A. Mehta</div>
            <div className="text-[10px] text-muted-foreground">Finance Manager</div>
          </div>
        </div>
      </div>
    </header>
  );
}

export function AppShell() {
  const { data: state, isLoading, isError, refetch } = useFinSightState();
  const aiMode = state?.aiMode ?? "fallback";

  return (
    <DemoProvider>
      <div className="flex h-full w-full overflow-hidden">
        <Sidebar cash={state?.currentCash ?? 0} aiMode={aiMode} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header cash={state?.currentCash ?? 0} minSafe={state?.minSafeCash ?? 0} aiMode={aiMode} />
          <main className="flex-1 overflow-y-auto bg-background">
            {isLoading ? (
              <div className="p-6 text-[13px] text-muted-foreground">Loading financial state…</div>
            ) : isError ? (
              <div className="p-6">
                <div className="rounded-[4px] border border-danger/30 bg-danger/5 p-4 text-[13px] text-danger">
                  Failed to load financial state.{" "}
                  <button onClick={() => refetch()} className="font-semibold underline underline-offset-2">Retry</button>
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-[1400px] px-6 py-6">
                <Outlet context={{ state }} />
              </div>
            )}
          </main>
        </div>
        <DemoWalkthrough />
      </div>
    </DemoProvider>
  );
}
