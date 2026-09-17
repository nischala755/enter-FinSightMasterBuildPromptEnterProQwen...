import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemo } from "./DemoContext";

export function DemoTrigger() {
  const { start, active } = useDemo();
  return (
    <Button
      size="sm"
      className="h-7 flex-1 border border-brand/50 bg-brand/90 text-[11px] font-semibold text-brand-foreground hover:bg-brand"
      onClick={start}
    >
      <Play className="mr-1 h-3 w-3" />
      {active ? "Demo running" : "Run demo"}
    </Button>
  );
}
