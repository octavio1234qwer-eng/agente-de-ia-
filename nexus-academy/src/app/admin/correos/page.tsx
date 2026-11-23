import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminHeader, Panel, Table, Td } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/action-form";
import { sendCampaignAction } from "@/lib/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Textarea } from "@/components/ui/field";
import { integrations, siteUrl } from "@/lib/env";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Correos" };

const templateLabel: Record<string, string> = {
  welcome: "Bienvenida", purchase_confirmation: "Compra confirmada", password_reset: "Recuperar contraseña", learning_reminder: "Recordatorio",
  abandoned_cart: "Carrito abandonado", new_course: "Nuevo curso", promotion: "Promoción", certificate_issued: "Certificado",
};

export default async function AdminEmails() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: log }, { count: subscribers }, { count: optIn }] = await Promise.all([
    supabase.from("email_log").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("newsletter_subscribers").select("id", { count: "exact", head: true }).is("unsubscribed_at", null),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("marketing_opt_in", true),
  ]);
  return (
    <>
      <AdminHeader title="Correos y automatizaciones" description="Registro real de envíos. Si el proveedor no está configurado, los correos se marcan como «omitidos», nunca como enviados." />
      {!integrations.email() && <p className="mb-4 rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">Resend no está configurado: agrega RESEND_API_KEY y EMAIL_FROM para enviar correos reales.</p>}
      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <Table head={["Fecha", "Plantilla", "Destinatario", "Estado"]} empty={log?.length ? undefined : "Aún no hay correos."}>
          {(log ?? []).map((e) => (
            <tr key={e.id}>
              <Td className="text-xs">{formatDate(e.created_at, { dateStyle: "short", timeStyle: "short" })}</Td>
              <Td>{templateLabel[e.template] ?? e.template}</Td>
              <Td className="text-xs">{e.to_email}</Td>
              <Td><Badge tone={e.status === "sent" ? "green" : e.status === "failed" ? "red" : "amber"}>{e.status === "sent" ? "Enviado" : e.status === "failed" ? "Falló" : "Omitido"}</Badge>{e.error && <span className="block max-w-56 truncate text-[11px] text-mist-400" title={e.error}>{e.error}</span>}</Td>
            </tr>
          ))}
        </Table>
        <div className="space-y-4">
          <Panel title="Audiencia de marketing" subtitle="Solo personas que aceptaron recibir promociones">
            <p className="text-sm text-mist-200">{optIn ?? 0} alumnos con aceptación · {subscribers ?? 0} suscriptores del boletín</p>
          </Panel>
          <Panel title="Enviar promoción" subtitle="Cada correo incluye enlace de baja firmado.">
            <ActionForm action={sendCampaignAction} submitLabel="Enviar campaña" pendingLabel="Enviando…">
              <Field label="Asunto" htmlFor="subject"><Input id="subject" name="subject" required maxLength={140} /></Field>
              <Field label="Mensaje" htmlFor="message"><Textarea id="message" name="message" rows={6} required /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Texto del botón" htmlFor="ctaLabel"><Input id="ctaLabel" name="ctaLabel" defaultValue="Ver cursos" /></Field>
                <Field label="Enlace del botón" htmlFor="ctaUrl"><Input id="ctaUrl" name="ctaUrl" type="url" defaultValue={`${siteUrl}/cursos`} /></Field>
              </div>
              <label className="flex items-start gap-2 text-xs text-mist-300"><input type="checkbox" name="confirm" className="mt-0.5 size-4 accent-electric-500" /> Confirmo que el contenido es veraz (sin descuentos ni plazos inventados).</label>
            </ActionForm>
          </Panel>
          <Panel title="Automatizaciones programadas">
            <ul className="space-y-1 text-sm text-mist-300">
              <li>• Recordatorios de aprendizaje: diario (7 días sin actividad).</li>
              <li>• Carritos abandonados: cada hora (más de 3 h sin completar).</li>
              <li>• Bienvenida, compra, acceso, certificado y recuperación: al instante.</li>
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
