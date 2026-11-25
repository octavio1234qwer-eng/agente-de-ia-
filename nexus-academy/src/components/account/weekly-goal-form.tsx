"use client";
import { useActionState } from "react";
import { updateWeeklyGoalAction } from "@/lib/actions/profile";
import { GOAL_MAX, GOAL_MIN } from "@/lib/learning-stats";
import { Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function WeeklyGoalForm({ goal }: { goal: number }) {
  const [state, action] = useActionState(updateWeeklyGoalAction, null);
  return (
    <form action={action} className="shrink-0">
      <label htmlFor="weekly-goal" className="mb-1.5 block text-xs font-medium text-mist-300">Meta semanal (lecciones)</label>
      <div className="flex gap-2">
        <div className="w-20 shrink-0">
          <Input id="weekly-goal" name="goal" type="number" inputMode="numeric" min={GOAL_MIN} max={GOAL_MAX} step={1} required defaultValue={goal} key={goal} className="h-11 px-3 text-center" />
        </div>
        <SubmitButton variant="secondary" size="sm" className="h-11" pendingLabel="Guardando…">Guardar meta</SubmitButton>
      </div>
      {state?.error && <p role="alert" className="mt-1.5 text-xs text-red-300">{state.error}</p>}
      {state?.success && <p role="status" className="mt-1.5 text-xs text-emerald-300">{state.success}</p>}
    </form>
  );
}
