import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  FinSightState,
  ScenarioInputs,
  ScenarioResult,
  Workflow,
} from "@/domain/types";
import { backend } from "@/services/data";

const stateKey = ["finsight", "state"] as const;

export function useFinSightState() {
  return useQuery({
    queryKey: stateKey,
    queryFn: () => backend.getState(),
    staleTime: 5_000,
    placeholderData: undefined,
  });
}

export function useApproveWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approver }: { id: string; approver: { name: string; role: string } }) =>
      backend.approveWorkflow(id, approver),
    onSuccess: (s: FinSightState) => qc.setQueryData(stateKey, s),
  });
}

export function useAdvanceWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, actor, note }: { id: string; actor: string; note?: string }) =>
      backend.advanceWorkflow(id, actor, note),
    onSuccess: (s: FinSightState) => qc.setQueryData(stateKey, s),
  });
}

export function useExecuteWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, actor, note }: { id: string; actor: string; note?: string }) =>
      backend.executeWorkflow(id, actor, note),
    onSuccess: (s: FinSightState) => qc.setQueryData(stateKey, s),
  });
}

export function useCreateWorkflowFromLeak() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leakId: string) => backend.createWorkflowFromLeak(leakId),
    onSuccess: (s: FinSightState) => qc.setQueryData(stateKey, s),
  });
}

export function useCreateWorkflowFromRisk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (riskId: string) => backend.createWorkflowFromRisk(riskId),
    onSuccess: (s: FinSightState) => qc.setQueryData(stateKey, s),
  });
}

export function useAcknowledgeRisk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (riskId: string) => backend.acknowledgeRisk(riskId),
    onSuccess: (s: FinSightState) => qc.setQueryData(stateKey, s),
  });
}

export function useRecordRiskTrace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (riskId: string) => backend.recordRiskTrace(riskId),
    onSuccess: (s: FinSightState) => qc.setQueryData(stateKey, s),
  });
}

export function useAskAnalyst() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (question: string) => backend.askAnalyst(question),
    onSuccess: (s) => {
      qc.setQueryData(stateKey, s);
      void qc.invalidateQueries({ queryKey: ["finsight", "analyst"] });
    },
  });
}

export function useAnalystHistory() {
  return useQuery({
    queryKey: ["finsight", "analyst"],
    queryFn: () => backend.getAnalystHistory(),
  });
}

export function useRunSimulation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inputs: ScenarioInputs) => backend.runSimulation(inputs),
    onSuccess: ({ state }: { state: FinSightState }) => qc.setQueryData(stateKey, state),
  });
}

export function useResetDemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => backend.resetDemo(),
    onSuccess: (s: FinSightState) => {
      qc.setQueryData(stateKey, s);
      void qc.invalidateQueries({ queryKey: ["finsight", "analyst"] });
    },
  });
}

export type { Workflow };
export { backend };
