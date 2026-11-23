"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { requestPasswordResetAction, signInAction, signUpAction, updatePasswordAction } from "@/lib/actions/auth";
import { Field, FormMessage, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

function PasswordInput({ id, name, autoComplete, invalid }: { id: string; name: string; autoComplete: string; invalid?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} name={name} type={show ? "text" : "password"} autoComplete={autoComplete} required minLength={name === "current" ? 1 : 8} className="pr-12" aria-invalid={invalid || undefined} />
      <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-mist-400 hover:text-white" aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}>
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(signInAction, null);
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />
      <Field label="Correo electrónico" htmlFor="email" error={state?.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required inputMode="email" defaultValue={state?.values?.email} aria-invalid={Boolean(state?.fieldErrors?.email) || undefined} />
      </Field>
      <Field label="Contraseña" htmlFor="password" error={state?.fieldErrors?.password}>
        <PasswordInput id="password" name="password" autoComplete="current-password" />
      </Field>
      <div className="flex justify-end">
        <Link href="/recuperar" className="text-sm text-electric-300 hover:text-white">¿Olvidaste tu contraseña?</Link>
      </div>
      <FormMessage state={state?.error ? { error: state.error } : null} />
      <SubmitButton size="lg" className="w-full" pendingLabel="Entrando…">Iniciar sesión</SubmitButton>
    </form>
  );
}

export function SignUpForm({ next }: { next: string }) {
  const [state, action] = useActionState(signUpAction, null);
  if (state?.success) {
    return <FormMessage state={{ success: state.success }} />;
  }
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />
      <Field label="Nombre completo" htmlFor="fullName" error={state?.fieldErrors?.fullName} hint="Aparecerá en tus certificados.">
        <Input id="fullName" name="fullName" autoComplete="name" required maxLength={120} defaultValue={state?.values?.fullName} />
      </Field>
      <Field label="Correo electrónico" htmlFor="email" error={state?.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={state?.values?.email} />
      </Field>
      <Field label="Contraseña" htmlFor="password" error={state?.fieldErrors?.password} hint="Mínimo 8 caracteres, con letras y números.">
        <PasswordInput id="password" name="password" autoComplete="new-password" />
      </Field>
      <label className="flex items-start gap-3 text-sm text-mist-300">
        <input type="checkbox" name="terms" className="mt-0.5 size-4 accent-electric-500" required defaultChecked={state?.values?.terms === "on"} />
        <span>
          Acepto los <Link href="/terminos" className="text-electric-300 hover:text-white">términos y condiciones</Link> y el{" "}
          <Link href="/privacidad" className="text-electric-300 hover:text-white">aviso de privacidad</Link>.
        </span>
      </label>
      {state?.fieldErrors?.terms && <p className="text-sm text-red-300" role="alert">{state.fieldErrors.terms}</p>}
      <FormMessage state={state?.error ? { error: state.error } : null} />
      <SubmitButton size="lg" className="w-full" pendingLabel="Creando cuenta…">Crear cuenta gratis</SubmitButton>
    </form>
  );
}

export function RecoverForm() {
  const [state, action] = useActionState(requestPasswordResetAction, null);
  if (state?.success) return <FormMessage state={{ success: state.success }} />;
  return (
    <form action={action} className="space-y-5" noValidate>
      <Field label="Correo electrónico" htmlFor="email" error={state?.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={state?.values?.email} />
      </Field>
      <FormMessage state={state?.error && !state.fieldErrors ? { error: state.error } : null} />
      <SubmitButton size="lg" className="w-full" pendingLabel="Enviando…">Enviar enlace</SubmitButton>
    </form>
  );
}

export function NewPasswordForm({ requireCurrent = false }: { requireCurrent?: boolean }) {
  const [state, action] = useActionState(updatePasswordAction, null);
  return (
    <form action={action} className="space-y-5" noValidate>
      {requireCurrent && (
        <Field label="Contraseña actual" htmlFor="current" error={state?.fieldErrors?.current}>
          <PasswordInput id="current" name="current" autoComplete="current-password" />
        </Field>
      )}
      <Field label="Nueva contraseña" htmlFor="password" error={state?.fieldErrors?.password} hint="Mínimo 8 caracteres, con letras y números.">
        <PasswordInput id="password" name="password" autoComplete="new-password" />
      </Field>
      <Field label="Confirmar contraseña" htmlFor="confirm" error={state?.fieldErrors?.confirm}>
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" />
      </Field>
      <FormMessage state={state} />
      <SubmitButton size="lg" className="w-full" pendingLabel="Guardando…">Guardar contraseña</SubmitButton>
    </form>
  );
}
