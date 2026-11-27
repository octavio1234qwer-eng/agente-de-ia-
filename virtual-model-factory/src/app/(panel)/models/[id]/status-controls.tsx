"use client";

import { useActionState } from "react";
import { Button, Notice } from "@/components/ui";
import { STATUS_LABELS } from "@/lib/model-schema";
import type { StatusState } from "../actions";

type Status = keyof typeof STATUS_LABELS;
const NEXT: Record<Status, Status[]> = { draft: ["active", "archived"], active: ["paused", "archived"], paused: ["active", "archived"], archived: ["draft"] };
const VERB: Record<Status, string> = { active: "Activar", paused: "Pausar", archived: "Archivar", draft: "Restaurar como borrador" };

export function StatusControls({ status, action }: { status: Status; action: (prev: StatusState, form: FormData) => Promise<StatusState> }) {
  const [state, formAction, pending] = useActionState<StatusState, FormData>(action, {});
  return (
    <div className="space-y-3">
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      {state.ok ? <Notice tone="success">{state.ok}</Notice> : null}
      <form action={formAction} className="flex flex-wrap gap-2">
        {NEXT[status].map((s) => (
          <Button key={s} type="submit" name="status" value={s} disabled={pending} variant={s === "active" ? "primary" : s === "archived" ? "danger" : "secondary"}>
            {VERB[s]}
          </Button>
        ))}
      </form>
    </div>
  );
}
