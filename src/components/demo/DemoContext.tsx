import { createContext, useContext, useState, type ReactNode } from "react";

export interface DemoIntent {
  type: "open-risk" | "ask" | "simulate" | "create-workflow" | "recover" | "none";
  riskId?: string;
  question?: string;
  inputs?: {
    revenueChangePct: number;
    receivablesDelayDays: number;
    vendorCostChangePct: number;
    discretionarySpendChangePct: number;
    inventorySpendChangePct: number;
  };
  leakId?: string;
  ref?: string; // consume-once key so re-visits don't re-trigger
}

export interface DemoStep {
  title: string;
  detail: string;
  route: string;
  intent: DemoIntent;
}

export const DEMO_STEPS: DemoStep[] = [
  {
    title: "The problem at a glance",
    detail:
      "Northstar's cash sits at ₹4.82 Cr and is projected to breach the ₹1.25 Cr minimum-safe floor in ~52 days. Health is 78/100 — stable on the surface, deteriorating underneath.",
    route: "/",
    intent: { type: "none", ref: "d1" },
  },
  {
    title: "Trace the cause",
    detail:
      "Open the Liquidity pressure risk and trace its causal chain — delayed payments from Aster Retail → ageing receivables → a stalled cash reserve → exposed payables.",
    route: "/risk-radar",
    intent: { type: "open-risk", riskId: "R-01", ref: "d2" },
  },
  {
    title: "Ask the analyst",
    detail: "Ask the AI Analyst why cash is dropping. The answer cites real invoices, the loan and PO-1184 — evidence, not prose.",
    route: "/ai-analyst",
    intent: { type: "ask", question: "Why is cash dropping and when do we breach?", ref: "d3" },
  },
  {
    title: "Simulate the stress",
    detail:
      "Revenue −15%, receivables +10 days, vendor cost +8%, inventory +25%. The simulator shows baseline vs scenario, then finds the optimal intervention deterministically.",
    route: "/simulator",
    intent: {
      type: "simulate",
      ref: "d4",
      inputs: { revenueChangePct: -15, receivablesDelayDays: 10, vendorCostChangePct: 8, discretionarySpendChangePct: 0, inventorySpendChangePct: 25 },
    },
  },
  {
    title: "Turn the recommendation into action",
    detail:
      "The optimal intervention becomes a real EnterPro workflow with a persisted status. Watch it appear in Workflows.",
    route: "/workflows",
    intent: { type: "create-workflow", riskId: "R-01", ref: "d5" },
  },
  {
    title: "Recover a leak",
    detail: "On Money Leaks, recover the confirmed duplicate payment (AP-INV-48294) — it creates another tracked workflow.",
    route: "/money-leaks",
    intent: { type: "recover", leakId: "LK-03", ref: "d6" },
  },
  {
    title: "Audit every step",
    detail: "Every action above produced an audit entry — actor, action, reason, evidence, approval state. Nothing happened off the record.",
    route: "/audit-trail",
    intent: { type: "none", ref: "d7" },
  },
];

interface DemoContextValue {
  active: boolean;
  stepIndex: number;
  intent: DemoIntent;
  start(): void;
  next(): void;
  prev(): void;
  close(): void;
}

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const value: DemoContextValue = {
    active,
    stepIndex,
    intent: active ? DEMO_STEPS[stepIndex].intent : { type: "none" },
    start: () => {
      setStepIndex(0);
      setActive(true);
    },
    next: () => {
      setStepIndex((i) => {
        if (i >= DEMO_STEPS.length - 1) {
          setActive(false);
          return i;
        }
        return i + 1;
      });
    },
    prev: () => setStepIndex((i) => Math.max(0, i - 1)),
    close: () => setActive(false),
  };

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used within DemoProvider");
  return ctx;
}
