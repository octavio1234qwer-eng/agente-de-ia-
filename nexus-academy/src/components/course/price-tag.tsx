import { cn, discountPercent, formatPrice } from "@/lib/utils";

export function PriceTag({ price, compareAt, currency = "MXN", size = "md", className }: {
  price: number;
  compareAt?: number | null;
  currency?: string;
  size?: "md" | "lg";
  className?: string;
}) {
  const off = discountPercent(price, compareAt);
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-1", className)}>
      <span className={cn("font-semibold tracking-tight", price === 0 ? "text-emerald-300" : "text-white", size === "lg" ? "text-3xl" : "text-lg")}>
        {formatPrice(price, currency)}
      </span>
      {off > 0 && compareAt && (
        <>
          <span className={cn("text-mist-400 line-through", size === "lg" ? "text-base" : "text-sm")}>{formatPrice(compareAt, currency)}</span>
          <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-xs font-semibold text-emerald-300">−{off}%</span>
        </>
      )}
    </div>
  );
}
