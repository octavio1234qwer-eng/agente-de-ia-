"use client";
import { useActionState } from "react";
import { subscribeNewsletterAction } from "@/lib/actions/profile";
import { SubmitButton } from "@/components/ui/submit-button";

export function NewsletterForm() {
  const [state, action] = useActionState(subscribeNewsletterAction, null);
  return (
    <form action={action} className="max-w-sm space-y-2" noValidate>
      <label htmlFor="newsletter-email" className="text-sm font-medium text-mist-200">Recibe nuevos cursos y promociones</label>
      <div className="flex gap-2">
        <input
          id="newsletter-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="tu@correo.com"
          className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-sm text-white placeholder:text-mist-400/70 focus:border-electric-400/70 focus:outline-none"
        />
        <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
        <SubmitButton size="md" className="h-11">Suscribirme</SubmitButton>
      </div>
      {state?.error && <p className="text-xs text-red-300" role="alert">{state.error}</p>}
      {state?.success && <p className="text-xs text-emerald-300" role="status">{state.success}</p>}
    </form>
  );
}
