import type { Metadata } from "next";
import { CheckCircle2, XCircle } from "lucide-react";
import { verifyUnsubscribe } from "@/lib/email/tokens";
import { createAdminClient } from "@/lib/supabase/admin";
import { integrations } from "@/lib/env";

export const metadata: Metadata = { title: "Darse de baja", robots: { index: false } };

async function unsubscribe(email: string) {
  const admin = createAdminClient();
  await Promise.all([
    admin.from("profiles").update({ marketing_opt_in: false, reminder_opt_in: false }).eq("email", email),
    admin.from("newsletter_subscribers").update({ unsubscribed_at: new Date().toISOString() }).eq("email", email),
  ]);
}

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ e?: string; t?: string }> }) {
  const { e, t } = await searchParams;
  const email = e && t && integrations.serviceRole() ? verifyUnsubscribe(e, t) : null;
  if (email) await unsubscribe(email);
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      {email ? <CheckCircle2 className="mx-auto size-10 text-emerald-300" /> : <XCircle className="mx-auto size-10 text-red-300" />}
      <h1 className="mt-4 text-2xl font-semibold text-white">{email ? "Listo, ya no recibirás estos correos" : "Enlace no válido"}</h1>
      <p className="mt-3 text-mist-300">
        {email
          ? `Dimos de baja ${email} de promociones y recordatorios. Seguirás recibiendo los correos de compras y seguridad de tu cuenta.`
          : "El enlace de baja está incompleto o alterado. Puedes ajustar tus preferencias en Configuración de tu cuenta."}
      </p>
    </div>
  );
}
