import Image from "next/image";
import { CategoryIcon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

function hash(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Portada del curso: la imagen subida por el administrador o, si no existe,
 * una composición generativa única basada en el slug y el color de la categoría.
 */
export function CourseCover({
  title,
  slug,
  coverUrl,
  color = "#3b74ff",
  icon,
  className,
  priority,
  sizes = "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw",
}: {
  title: string;
  slug: string;
  coverUrl?: string | null;
  color?: string | null;
  icon?: string | null;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  if (coverUrl) {
    return (
      <div className={cn("relative overflow-hidden bg-ink-800", className)}>
        <Image src={coverUrl} alt="" fill sizes={sizes} priority={priority} className="object-cover" />
      </div>
    );
  }
  const h = hash(slug);
  const c = color || "#3b74ff";
  const rot = h % 360;
  const x = 20 + (h % 60);
  const y = 15 + ((h >> 3) % 50);
  const variant = h % 3;
  const id = `g${h % 100000}`;
  return (
    <div className={cn("relative overflow-hidden bg-ink-900", className)} aria-hidden>
      <svg className="absolute inset-0 size-full" viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id={`${id}a`} cx={`${x}%`} cy={`${y}%`} r="75%">
            <stop offset="0%" stopColor={c} stopOpacity="0.75" />
            <stop offset="55%" stopColor={c} stopOpacity="0.12" />
            <stop offset="100%" stopColor="#05060b" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}b`} cx={`${100 - x}%`} cy={`${100 - y / 2}%`} r="65%">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#05060b" stopOpacity="0" />
          </radialGradient>
          <pattern id={`${id}p`} width="22" height="22" patternUnits="userSpaceOnUse" patternTransform={`rotate(${rot % 45})`}>
            <circle cx="1" cy="1" r="1" fill="#fff" fillOpacity="0.09" />
          </pattern>
        </defs>
        <rect width="400" height="225" fill="#070912" />
        <rect width="400" height="225" fill={`url(#${id}a)`} />
        <rect width="400" height="225" fill={`url(#${id}b)`} />
        <rect width="400" height="225" fill={`url(#${id}p)`} />
        {variant === 0 && (
          <g fill="none" stroke="#fff" strokeOpacity="0.14">
            <circle cx={300 - (h % 80)} cy={110} r="70" />
            <circle cx={300 - (h % 80)} cy={110} r="110" />
            <circle cx={300 - (h % 80)} cy={110} r="150" strokeOpacity="0.07" />
          </g>
        )}
        {variant === 1 && (
          <g stroke="#fff" strokeOpacity="0.12">
            {Array.from({ length: 9 }).map((_, i) => (
              <line key={i} x1={i * 50 - 40} y1="225" x2={i * 50 + 80} y2="0" />
            ))}
          </g>
        )}
        {variant === 2 && (
          <g fill="none" stroke="#fff" strokeOpacity="0.13">
            <path d={`M0 ${150 - (h % 40)} C 120 ${60 + (h % 50)}, 240 ${200 - (h % 60)}, 400 ${90 + (h % 30)}`} />
            <path d={`M0 ${175 - (h % 40)} C 120 ${85 + (h % 50)}, 240 ${225 - (h % 60)}, 400 ${115 + (h % 30)}`} strokeOpacity="0.08" />
          </g>
        )}
      </svg>
      <div className="absolute inset-0 bg-gradient-to-t from-ink-950/70 via-transparent to-transparent" />
      <div className="absolute left-4 top-4 grid size-11 place-items-center rounded-xl border border-white/15 bg-white/10 text-white backdrop-blur-md">
        <CategoryIcon name={icon} className="size-5" />
      </div>
      <span className="sr-only">{title}</span>
    </div>
  );
}
