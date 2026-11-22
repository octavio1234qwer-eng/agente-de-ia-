import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "blue" | "violet" | "green" | "amber" | "red" | "cyan";

const tones: Record<Tone, string> = {
  neutral: "bg-white/[0.06] text-mist-200 border-white/10",
  blue: "bg-electric-500/12 text-electric-300 border-electric-400/25",
  violet: "bg-violet-500/12 text-violet-300 border-violet-400/25",
  green: "bg-emerald-500/12 text-emerald-300 border-emerald-400/25",
  amber: "bg-amber-500/12 text-amber-300 border-amber-400/25",
  red: "bg-red-500/12 text-red-300 border-red-400/25",
  cyan: "bg-cyan-500/12 text-cyan-300 border-cyan-400/25",
};

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}
