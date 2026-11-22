import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { config, integrations, readEnv } from "@/lib/env";
import type { EmailContent } from "./templates";

export type SendResult = { status: "sent" | "skipped" | "failed" | "duplicate"; id?: string; error?: string };

type SendOptions = {
  to: string;
  content: EmailContent;
  template: string;
  userId?: string | null;
  /** Clave única: impide enviar dos veces el mismo correo (p. ej. "purchase:<orderId>"). */
  dedupeKey?: string;
  unsubscribeUrl?: string;
};

/**
 * Envía un correo real mediante la API de Resend y lo registra en email_log.
 * Si Resend no está configurado, NO finge el envío: lo registra como "skipped".
 */
export async function sendEmail(opts: SendOptions): Promise<SendResult> {
  const admin = createAdminClient();

  if (opts.dedupeKey) {
    const { data: existing } = await admin
      .from("email_log")
      .select("status")
      .eq("dedupe_key", opts.dedupeKey)
      .maybeSingle();
    if (existing?.status === "sent") return { status: "duplicate" };
  }

  const log = async (status: "sent" | "skipped" | "failed", extra: { provider_message_id?: string; error?: string }) => {
    const row = {
      to_email: opts.to,
      user_id: opts.userId ?? null,
      template: opts.template,
      subject: opts.content.subject,
      dedupe_key: opts.dedupeKey ?? null,
      status,
      provider_message_id: extra.provider_message_id ?? null,
      error: extra.error ?? null,
    };
    if (opts.dedupeKey) {
      await admin.from("email_log").upsert(row, { onConflict: "dedupe_key" });
    } else {
      await admin.from("email_log").insert(row);
    }
  };

  if (!integrations.email()) {
    await log("skipped", { error: "Proveedor de correo no configurado (RESEND_API_KEY / EMAIL_FROM)" });
    return { status: "skipped", error: "email_not_configured" };
  }

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${readEnv("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    };
    if (opts.dedupeKey) headers["Idempotency-Key"] = opts.dedupeKey.slice(0, 256);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers,
      body: JSON.stringify({
        from: config.emailFrom,
        to: [opts.to],
        subject: opts.content.subject,
        html: opts.content.html,
        text: opts.content.text,
        ...(config.emailReplyTo ? { reply_to: config.emailReplyTo } : {}),
        ...(opts.unsubscribeUrl
          ? { headers: { "List-Unsubscribe": `<${opts.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }
          : {}),
        tags: [{ name: "template", value: opts.template.replace(/[^a-zA-Z0-9_-]/g, "_") }],
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = `Resend ${res.status}: ${JSON.stringify(body).slice(0, 300)}`;
      await log("failed", { error });
      return { status: "failed", error };
    }
    await log("sent", { provider_message_id: body.id });
    return { status: "sent", id: body.id };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await log("failed", { error });
    return { status: "failed", error };
  }
}
