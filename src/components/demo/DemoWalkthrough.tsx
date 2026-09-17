import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEMO_STEPS, useDemo } from "./DemoContext";

export function DemoWalkthrough() {
  const { active, stepIndex, next, prev, close } = useDemo();
  const navigate = useNavigate();
  const step = DEMO_STEPS[stepIndex];
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (active && step) {
      setVisible(true);
      navigate(step.route);
    }
  }, [active, stepIndex, step?.route, navigate]);

  if (!active || !step || !visible) return null;

  const last = stepIndex === DEMO_STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-foreground/20 backdrop-blur-[1px]">
      {/* Step panel */}
      <div className="flex h-full w-[360px] flex-col border-l border-panel-border bg-panel text-panel-foreground shadow-2xl">
        <div className="flex items-center justify-between border-b border-panel-border px-4 py-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand">
            Demo scenario · {stepIndex + 1}/{DEMO_STEPS.length}
          </span>
          <button onClick={close} className="text-panel-foreground/50 hover:text-panel-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <h3 className="text-[17px] font-semibold tracking-tight">{step.title}</h3>
          <p className="mt-2 text-[12.5px] leading-relaxed text-panel-foreground/70">{step.detail}</p>

          <div className="mt-5 space-y-1">
            {DEMO_STEPS.map((s, i) => (
              <div
                key={s.title}
                className={`flex items-center gap-2 rounded-[3px] px-2 py-1.5 text-[11.5px] ${
                  i === stepIndex ? "bg-panel-foreground/10 text-panel-foreground" : i < stepIndex ? "text-panel-foreground/50" : "text-panel-foreground/30"
                }`}
              >
                {i < stepIndex ? <Check className="h-3 w-3 text-positive" /> : <span className="tnum w-3 font-mono">{i + 1}</span>}
                {s.title}
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 border-t border-panel-border px-4 py-3">
          {stepIndex > 0 && (
            <Button variant="ghost" size="sm" className="h-8 border border-panel-border text-[11px] text-panel-foreground/60" onClick={prev}>
              <ChevronLeft className="mr-1 h-3 w-3" /> Back
            </Button>
          )}
          <Button size="sm" className="h-8 flex-1 bg-brand text-[11px] font-semibold text-brand-foreground hover:bg-brand" onClick={next}>
            {last ? "Finish" : "Next step"}
            <ChevronRight className="ml-1 h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function useDemoIntent() {
  const { intent, next } = useDemo();
  return { intent, next };
}
