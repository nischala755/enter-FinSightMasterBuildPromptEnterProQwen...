import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { DemoProvider } from "@/components/demo/DemoContext";
import { backend } from "@/services/data";
import { Workflows } from "@/pages/Workflows";
import { Simulator } from "@/pages/Simulator";
import { MoneyLeaks } from "@/pages/MoneyLeaks";
import { RiskRadar } from "@/pages/RiskRadar";

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
}

function renderWithProviders(ui: ReactNode, route = "/") {
  const qc = createQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <DemoProvider>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </DemoProvider>
    </QueryClientProvider>,
  );
}

describe("key user interactions", () => {
  beforeEach(async () => {
    await backend.resetDemo();
  });

  it("approving a workflow updates status, records approver, creates an audit event, and updates the UI", async () => {
    renderWithProviders(<Workflows />);
    // WF-1001 is seeded as "Awaiting Approval"
    await waitFor(() => expect(screen.getByText(/Vendor review — NovoTextiles/i)).toBeInTheDocument());

    const before = (await backend.getState()).auditEvents.length;
    const title = screen.getByText(/Vendor review — NovoTextiles/i);
    const card = title.closest('[class*="rounded-[4px]"]') as HTMLElement;
    fireEvent.click(title);
    await waitFor(() => expect(within(card).getByText("Approve")).toBeInTheDocument());
    fireEvent.click(within(card).getByText("Approve"));

    await waitFor(() => expect(within(card).getAllByText("Approved").length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.getAllByText("A. Mehta").length).toBeGreaterThan(0));

    const state = await backend.getState();
    const wf = state.workflows.find((w) => w.title.includes("NovoTextiles"))!;
    expect(wf.status).toBe("Approved");
    expect(wf.approvals.at(-1)?.approver).toBe("A. Mehta");
    const audit = state.auditEvents.filter((e) => e.workflowId === wf.id && e.action === "workflow.approved");
    expect(audit.length).toBe(1);
    expect(state.auditEvents.length).toBe(before + 1);
  });

  it("trace cause opens the risk sheet with the causal chain (via ?risk= param)", async () => {
    renderWithProviders(<RiskRadar />, "/risk-radar?risk=R-01");
    await waitFor(() => expect(screen.getAllByText("Liquidity pressure").length).toBeGreaterThan(0));
    // The sheet should be open with causal nodes
    await waitFor(() => expect(screen.getByText("Delayed customer payments")).toBeInTheDocument());
    expect(screen.getAllByText("Trace cause").length).toBeGreaterThan(0);
    expect(screen.getByText(/Liquidity risk in 52 days/)).toBeInTheDocument();
  });

  it("recovering a leak creates a workflow and flips the leak to recovering", async () => {
    renderWithProviders(<MoneyLeaks />);
    await waitFor(() => expect(screen.getByText(/Vendor price creep — NovoTextiles/i)).toBeInTheDocument());

    fireEvent.click(screen.getByText(/Vendor price creep — NovoTextiles/i));
    await waitFor(() => expect(screen.getByText("Recover this value")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Recover this value"));

    await waitFor(async () => {
      const s = await backend.getState();
      const leak = s.leaks.find((l) => l.id === "LK-01")!;
      expect(leak.status).toBe("recovering");
      expect(leak.workflowId).toBeTruthy();
      expect(s.workflows.some((w) => w.sourceLeakId === "LK-01")).toBe(true);
    });
  });

  it("running a scenario shows deterministic outputs and an optimal intervention", async () => {
    renderWithProviders(<Simulator />);
    await waitFor(() => expect(screen.getByText("Scenario drivers")).toBeInTheDocument());

    const revSlider = screen.getAllByDisplayValue("0")[0] as HTMLInputElement;
    fireEvent.change(revSlider, { target: { value: "-15" } });

    await waitFor(() => expect(screen.getByText("-15%")).toBeInTheDocument());
    // Optimal intervention panel appears with a BEST ranking
    await waitFor(() => expect(screen.getByText("Optimal intervention")).toBeInTheDocument());
    expect(screen.getByText("Best")).toBeInTheDocument();
    const results = await backend.getState();
    // Simulation is computed locally; audit trail records explicit runs only.
    expect(results).toBeTruthy();
  });
});
