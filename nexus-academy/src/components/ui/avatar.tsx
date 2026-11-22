import Image from "next/image";
import { cn, initials } from "@/lib/utils";

export function Avatar({ name, url, size = 40, className }: { name: string; url?: string | null; size?: number; className?: string }) {
  return (
    <span
      className={cn("relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-electric-500/80 to-violet-600/80 font-semibold text-white ring-1 ring-white/15", className)}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {url ? <Image src={url} alt="" fill sizes={`${size}px`} className="object-cover" /> : initials(name)}
    </span>
  );
}
