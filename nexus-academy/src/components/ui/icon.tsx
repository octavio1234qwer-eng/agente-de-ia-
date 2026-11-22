import {
  BarChart3, Brain, Code, PenTool, Shield, Sparkles, TrendingUp, Globe, Layers, Rocket, type LucideIcon,
} from "lucide-react";

const icons: Record<string, LucideIcon> = {
  code: Code,
  brain: Brain,
  "bar-chart-3": BarChart3,
  "pen-tool": PenTool,
  "trending-up": TrendingUp,
  shield: Shield,
  sparkles: Sparkles,
  globe: Globe,
  layers: Layers,
  rocket: Rocket,
};

export const categoryIconOptions = Object.keys(icons);

export function CategoryIcon({ name, className }: { name: string | null | undefined; className?: string }) {
  const Icon = icons[name ?? ""] ?? Sparkles;
  return <Icon className={className} aria-hidden />;
}
