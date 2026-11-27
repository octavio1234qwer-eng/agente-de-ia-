"use client";

import { useActionState } from "react";
import { setupAction, type SetupState } from "./actions";
import { Button, Field, Notice, inputClass } from "@/components/ui";

export function SetupForm() {
  const [state, action, pending] = useActionState<SetupState, FormData>(setupAction, {});
  return (
    <form action={action} className="space-y-4">
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <Field label="Token de configuración" name="setupToken" hint="El valor de SETUP_TOKEN en el servidor.">
        <input id="setupToken" name="setupToken" type="password" autoComplete="off" required className={inputClass} />
      </Field>
      <Field label="Nombre" name="displayName">
        <input id="displayName" name="displayName" required maxLength={80} className={inputClass} />
      </Field>
      <Field label="Correo electrónico" name="email">
        <input id="email" name="email" type="email" autoComplete="username" required className={inputClass} />
      </Field>
      <Field label="Contraseña" name="password" hint="Mínimo 12 caracteres. Usa una frase única.">
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={12} className={inputClass} />
      </Field>
      <Field label="Repite la contraseña" name="passwordConfirm">
        <input id="passwordConfirm" name="passwordConfirm" type="password" autoComplete="new-password" required minLength={12} className={inputClass} />
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creando…" : "Crear propietario"}
      </Button>
    </form>
  );
}
