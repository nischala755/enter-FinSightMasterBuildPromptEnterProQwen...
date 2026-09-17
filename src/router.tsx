import { AppShell } from "@/components/AppShell";
import { Overview } from "@/pages/Overview";
import { RiskRadar } from "@/pages/RiskRadar";
import { MoneyLeaks } from "@/pages/MoneyLeaks";
import { CashForecast } from "@/pages/CashForecast";
import { Simulator } from "@/pages/Simulator";
import { Transactions } from "@/pages/Transactions";
import { Vendors } from "@/pages/Vendors";
import { Workflows } from "@/pages/Workflows";
import { Analyst } from "@/pages/Analyst";
import { AuditTrail } from "@/pages/AuditTrail";
import NotFound from "@/pages/NotFound";

export const routers = [
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, name: "overview", element: <Overview /> },
      { path: "risk-radar", name: "risk-radar", element: <RiskRadar /> },
      { path: "money-leaks", name: "money-leaks", element: <MoneyLeaks /> },
      { path: "cash-forecast", name: "cash-forecast", element: <CashForecast /> },
      { path: "simulator", name: "simulator", element: <Simulator /> },
      { path: "transactions", name: "transactions", element: <Transactions /> },
      { path: "vendors", name: "vendors", element: <Vendors /> },
      { path: "workflows", name: "workflows", element: <Workflows /> },
      { path: "ai-analyst", name: "ai-analyst", element: <Analyst /> },
      { path: "audit-trail", name: "audit-trail", element: <AuditTrail /> },
    ],
  },
  /* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */
  {
    path: "*",
    name: "404",
    element: <NotFound />,
  },
];

declare global {
  interface Window {
    __routers__: typeof routers;
  }
}

window.__routers__ = routers;
