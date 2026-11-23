"use client";
import type { ReactNode } from "react";
import { useActionState } from "react";
import type { ActionState } from "@/lib/actions/types";
import { FormMessage } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

/** Formulario genérico con estado (éxito/error) para acciones del panel. */
export function ActionForm({ action, children, submitLabel, pendingLabel, variant = "primary", className }: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children?: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={className ?? "space-y-4"}>
      {children}
      <FormMessage state={state} />
      <SubmitButton variant={variant} pendingLabel={pendingLabel ?? "Guardando…"}>{submitLabel}</SubmitButton>
    </form>
  );
}
