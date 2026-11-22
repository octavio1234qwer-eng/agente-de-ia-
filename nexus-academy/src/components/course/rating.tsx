import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function Rating({ value, count, size = "sm", className }: { value: number; count?: number; size?: "sm" | "md"; className?: string }) {
  const v = Number(value) || 0;
  if (!count) {
    return <span className={cn("text-xs text-mist-400", className)}>Sin reseñas aún</span>;
  }
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} aria-label={`${v.toFixed(1)} de 5 estrellas, ${count} reseñas`}>
      <span className="flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={cn(size === "sm" ? "size-3.5" : "size-4.5", i <= Math.round(v) ? "fill-amber-400 text-amber-400" : "text-white/20")}
            aria-hidden
          />
        ))}
      </span>
      <span className={cn("font-semibold text-white", size === "sm" ? "text-xs" : "text-sm")}>{v.toFixed(1)}</span>
      <span className={cn("text-mist-400", size === "sm" ? "text-xs" : "text-sm")}>({count})</span>
    </span>
  );
}
