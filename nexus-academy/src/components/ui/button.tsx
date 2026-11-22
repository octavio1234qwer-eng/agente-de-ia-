import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

const base =
  "relative inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 select-none disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary:
    "text-white bg-gradient-to-r from-electric-500 via-electric-600 to-violet-600 shadow-[0_8px_30px_-8px_rgb(59_116_255_/_0.65)] hover:shadow-[0_10px_40px_-6px_rgb(139_92_246_/_0.7)] hover:brightness-110",
  secondary: "glass text-mist-100 hover:bg-white/[0.08] hover:border-white/15",
  outline: "border border-white/15 text-mist-100 hover:border-electric-400/60 hover:text-white hover:bg-electric-500/10",
  ghost: "text-mist-300 hover:text-white hover:bg-white/[0.06]",
  danger: "text-white bg-red-500/85 hover:bg-red-500",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-[15px]",
  lg: "h-13 px-7 text-base",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = ComponentProps<"button"> & { variant?: Variant; size?: Size };

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  return <button className={buttonClasses(variant, size, className)} {...props} />;
}

type LinkButtonProps = Omit<ComponentProps<typeof Link>, "className"> & {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
};

export function LinkButton({ variant = "primary", size = "md", className, ...props }: LinkButtonProps) {
  return <Link className={buttonClasses(variant, size, className)} {...props} />;
}
