// ---------------------------------------------------------------------------
// Qwen client — calls the `qwen-ask` backend function with evidence the
// deterministic engine already computed. Returns null on any failure so the
// caller falls back to deterministic templates (Demo Intelligence Mode).
// ---------------------------------------------------------------------------

import { supabase } from "@/integrations/supabase/client";
import type { EvidenceRef, FinSightState } from "@/domain/types";
import {
  citeEvidence,
  computeAtRiskCapital,
  forecastCash,
  totalLeakage,
  weightedAverageDso,
} from "@/domain/engine";

// Cold-start latency for the deployed function can exceed 25s, so the client
// timeout must be generous or live answers get aborted and the app falls back.
const TIMEOUT_MS = 60_000;

export interface QwenContext {
  question: string;
  metrics: string[];
  evidence: EvidenceRef[];
  state: {
    currentCash: number;
    minSafeCash: number;
    day90Balance: number;
    breachDay: number | null;
    totalLeakage: number;
    atRiskCapital: number;
  };
}

export async function askQwen(context: QwenContext): Promise<{ answer: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const { data, error } = await supabase.functions.invoke("qwen-ask", {
      body: context,
      signal: controller.signal,
    });
    if (error) {
      console.warn("[finsight] qwen-ask failed:", error.message ?? error);
      return null;
    }
    if (data?.ok && typeof data.answer === "string" && data.answer.length > 0) {
      return { answer: data.answer };
    }
    if (data?.error?.message) {
      console.warn("[finsight] qwen-ask error:", data.error.message);
    }
    return null;
  } catch (err) {
    console.warn("[finsight] qwen-ask unreachable:", err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function buildQwenContext(state: FinSightState, question: string): QwenContext {
  const base = forecastCash(state, "base");
  return {
    question,
    metrics: [
      `Current cash: ${state.currentCash}`,
      `90-day forecast: ${base.day90Balance}`,
      `Breach day: ${base.breachDay ?? "none"}`,
      `DSO days: ${Math.round(weightedAverageDso(state))}`,
      `Recoverable leakage: ${totalLeakage(state)}`,
      `At-risk capital: ${computeAtRiskCapital(state).total}`,
    ],
    evidence: citeEvidence(state, question),
    state: {
      currentCash: state.currentCash,
      minSafeCash: state.minSafeCash,
      day90Balance: base.day90Balance,
      breachDay: base.breachDay,
      totalLeakage: totalLeakage(state),
      atRiskCapital: computeAtRiskCapital(state).total,
    },
  };
}
