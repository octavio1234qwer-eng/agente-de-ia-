"use client";
import { useActionState } from "react";
import { updatePreferencesAction } from "@/lib/actions/profile";
import { FormMessage } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function PreferencesForm({ marketing, reminders }: { marketing: boolean; reminders: boolean }) {
  const [state, action] = useActionState(updatePreferencesAction, null);
  return (
    <form action={action} className="space-y-4">
      <label className="flex items-start gap-3">
        <input type="checkbox" name="reminders" defaultChecked={reminders} className="mt-1 size-4 accent-electric-500" />
        <span><span className="block text-sm font-medium text-white">Recordatorios de aprendizaje</span><span className="text-sm text-mist-400">Te avisamos si llevas varios días sin avanzar en un curso.</span></span>
      </label>
      <label className="flex items-start gap-3">
        <input type="checkbox" name="marketing" defaultChecked={marketing} className="mt-1 size-4 accent-electric-500" />
        <span><span className="block text-sm font-medium text-white">Novedades y promociones</span><span className="text-sm text-mist-400">Nuevos cursos, descuentos y recordatorios de tu carrito.</span></span>
      </label>
      <FormMessage state={state} />
      <SubmitButton variant="secondary" pendingLabel="Guardando…">Guardar preferencias</SubmitButton>
    </form>
  );
}
