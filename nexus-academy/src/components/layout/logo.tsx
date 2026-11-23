import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("group inline-flex items-center gap-2.5", className)}>
      <span className="relative grid size-8 place-items-center rounded-[10px] bg-gradient-to-br from-electric-500 to-violet-600 shadow-[0_0_24px_-4px_rgb(107_149_255_/_0.8)]">
        <svg viewBox="0 0 24 24" className="size-4.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 19V5l14 14V5" />
        </svg>
      </span>
      <span className="text-[15px] font-semibold tracking-[0.18em] text-white">
        NEXUS <span className="font-normal text-mist-300">ACADEMY</span>
      </span>
      <span className="sr-only">, inicio</span>
    </Link>
  );
}
