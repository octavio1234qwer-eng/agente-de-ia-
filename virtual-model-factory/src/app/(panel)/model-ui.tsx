import { Badge, type BadgeTone } from "@/components/ui";
import { STATUS_LABELS } from "@/lib/model-schema";
import type { ModelStatus } from "@/server/modules/models/repository";

const TONES: Record<ModelStatus, BadgeTone> = { active: "green", paused: "amber", draft: "blue", archived: "gray" };

export function StatusBadge({ status }: { status: ModelStatus }) {
  return <Badge tone={TONES[status]}>{STATUS_LABELS[status]}</Badge>;
}

export function ModelAvatar({ name, primary, secondary, size = "md" }: { name: string; primary: string; secondary: string; size?: "md" | "lg" }) {
  const initials = name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-2xl font-semibold text-white shadow-lg ${size === "lg" ? "size-16 text-xl" : "size-11 text-sm"}`}
      style={{ backgroundImage: `linear-gradient(135deg, ${primary}, ${secondary})` }}
    >
      {initials}
    </span>
  );
}
