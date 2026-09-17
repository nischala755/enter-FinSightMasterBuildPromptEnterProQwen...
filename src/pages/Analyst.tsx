import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, CircleDollarSign, Crosshair, Lightbulb, AlertTriangle, FileSearch } from "lucide-react";
import { PageHeader, EvidenceList, SourceTag, ConfidenceBar, LoadingState, EmptyState } from "@/components/primitives";
import { useAskAnalyst, useAnalystHistory, useFinSightState } from "@/hooks/useFinSight";
import { useDemoIntent } from "@/components/demo/DemoWalkthrough";
import { cn } from "@/lib/utils";

const PRESETS = [
  "Why is cash dropping and when do we breach?",
  "Why is vendor spend rising?",
  "Is AP-INV-48291 a duplicate payment?",
  "Which subscriptions are wasting money?",
  "What is our financial health and why?",
  "What happens in the downside case?",
];

export function Analyst() {
  const { data: state } = useFinSightState();
  const [input, setInput] = useState("");
  const ask = useAskAnalyst();
  const { data: history } = useAnalystHistory();
  const { intent } = useDemoIntent();
  const didAskDemo = useRef(false);

  const submit = (question: string) => {
    if (!question.trim()) return;
    ask.mutate(question.trim());
  };

  // Demo intent: ask the preset question automatically
  useEffect(() => {
    if (intent.type === "ask" && intent.question && !didAskDemo.current) {
      didAskDemo.current = true;
      submit(intent.question);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent.ref]);

  const latest = history?.[0];
  const mode = state?.aiMode ?? "fallback";

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="AI Analyst"
        subtitle="An analyst workstation, not a chat bubble. Qwen reasons over evidence the deterministic engine hands it — it explains numbers, it never invents them."
        actions={
          <span className={cn("rounded-[3px] border px-2 py-1 text-[11px] font-semibold", mode === "live" ? "border-positive/40 bg-positive/10 text-positive" : "border-warn/40 bg-warn/10 text-warn")}>
            {mode === "live" ? "Qwen · live" : "Demo intelligence mode"}
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-3">
          {/* Composer */}
          <div className="rounded-[4px] border bg-card p-3">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-brand/50 hover:text-brand"
                  onClick={() => submit(p)}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit(input);
                  }
                }}
                rows={2}
                placeholder="Ask about liquidity, receivables, vendors, duplicates, subscriptions, inventory or health…"
                className="flex-1 resize-none rounded-[3px] border bg-background p-2.5 text-[13px] outline-none placeholder:text-muted-foreground focus:border-brand"
              />
              <button
                className="flex h-auto items-center gap-1.5 rounded-[3px] bg-brand px-3.5 text-[12px] font-semibold text-brand-foreground hover:bg-brand/90"
                onClick={() => submit(input)}
              >
                <Send className="h-3.5 w-3.5" /> Ask
              </button>
            </div>
          </div>

          {ask.isPending && <LoadingState label="Reasoning over the ledger…" />}

          {!ask.isPending && latest && (
            <div className="rounded-[4px] border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
                  <FileSearch className="h-3.5 w-3.5 text-brand" />
                  <span className="font-medium text-foreground">Q: {latest.question}</span>
                </div>
                <div className="flex items-center gap-2">
                  <SourceTag kind="AI-recommendation" />
                  <span className="rounded-[3px] border border-border px-1.5 py-[1px] text-[10px] text-muted-foreground">
                    {latest.mode === "live" ? "Qwen live" : "fallback template"}
                  </span>
                </div>
              </div>

              <p className="mt-3 text-[13.5px] leading-relaxed">{latest.answer}</p>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-[3px] border border-border bg-muted/20 p-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    <CircleDollarSign className="h-3.5 w-3.5" /> Metrics used
                  </div>
                  <ul className="mt-2 space-y-1">
                    {latest.metricsUsed.map((m) => (
                      <li key={m} className="text-[12px]">{m}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-[3px] border border-border bg-muted/20 p-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    <Crosshair className="h-3.5 w-3.5" /> Evidence citations
                  </div>
                  <div className="mt-2">
                    <EvidenceList items={latest.evidence} />
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-[3px] border border-positive/30 bg-positive/5 p-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-positive">
                    <Lightbulb className="h-3.5 w-3.5" /> Recommended actions
                  </div>
                  <ul className="mt-2 list-inside space-y-1">
                    {latest.recommendedActions.map((a, i) => (
                      <li key={i} className="text-[12px]">{a}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-[3px] border border-warn/30 bg-warn/5 p-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-warn">
                    <AlertTriangle className="h-3.5 w-3.5" /> Limitations
                  </div>
                  <ul className="mt-2 list-inside space-y-1">
                    {latest.limitations.map((l, i) => (
                      <li key={i} className="text-[12px]">{l}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t pt-3">
                <ConfidenceBar value={latest.confidence} label="answer confidence" />
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Sparkles className="h-3 w-3 text-brand" />
                  {latest.confidence < 0.3 ? "Insufficient evidence — the analyst said so rather than guessing." : "Evidence-cited"}
                </span>
              </div>
            </div>
          )}

          {!ask.isPending && history && history.length === 0 && (
            <EmptyState title="No questions yet" hint="Use a preset above or ask your own question. Every answer cites real ledger IDs." />
          )}
        </div>

        {/* History rail */}
        <div className="rounded-[4px] border bg-card p-3">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Session history</div>
          {!history || history.length === 0 ? (
            <div className="text-[12px] text-muted-foreground">Nothing asked yet this session.</div>
          ) : (
            <div className="space-y-1.5">
              {history.slice(0, 10).map((h) => (
                <div key={h.id} className="border-b border-border/50 pb-1.5 last:border-0">
                  <div className="truncate text-[12px] font-medium">{h.question}</div>
                  <div className="mt-0.5 text-[10.5px] text-muted-foreground">
                    {new Date(h.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} · {h.evidence.length} citations · {Math.round(h.confidence * 100)}% conf
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
