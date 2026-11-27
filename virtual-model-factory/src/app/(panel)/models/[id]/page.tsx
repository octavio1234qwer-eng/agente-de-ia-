import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Badge, ButtonLink, Card, EmptyState, Notice, PageHeader, formatDateTime } from "@/components/ui";
import { LANGUAGE_LABELS, RATING_LABELS } from "@/lib/model-schema";
import { asCurrentUser } from "@/server/auth/dal";
import { can } from "@/server/auth/permissions";
import { getModel } from "@/server/modules/models/repository";
import { activationBlockers } from "@/server/modules/models/service";
import { changeStatusAction } from "../actions";
import { ModelAvatar, StatusBadge } from "../../model-ui";
import { StatusControls } from "./status-controls";

export const metadata: Metadata = { title: "Modelo" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-200">{children || <span className="text-slate-500">—</span>}</dd>
    </div>
  );
}

function Chips({ items }: { items: string[] }) {
  return items.length ? <div className="flex flex-wrap gap-1.5">{items.map((i) => <Badge key={i}>{i}</Badge>)}</div> : null;
}

export default async function ModelPage({ params, searchParams }: PageProps<"/models/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  if (!UUID.test(id)) notFound();
  const { model, role } = await asCurrentUser(async (db, user) => ({ model: await getModel(db, id), role: user.role }));
  if (!model) notFound();
  const blockers = activationBlockers(model);
  const p = model.personality;

  return (
    <>
      <PageHeader
        title={model.stageName}
        description={<span className="inline-flex flex-wrap items-center gap-2"><StatusBadge status={model.status} />{model.isDemo ? <Badge tone="violet">DEMO</Badge> : null}<span>{model.slug}</span></span>}
        actions={can(role, "models.update") ? <ButtonLink href={`/models/${model.id}/edit`} variant="secondary">Editar</ButtonLink> : null}
      />
      <div className="mb-4 space-y-2">
        {sp.created ? <Notice tone="success">Modelo creado como borrador.</Notice> : null}
        {sp.saved ? <Notice tone="success">Cambios guardados.</Notice> : null}
        {model.isDemo ? <Notice tone="info">Modelo de demostración: nunca publica ni conversa en plataformas reales.</Notice> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <div className="flex items-start gap-4">
              <ModelAvatar name={model.stageName} primary={model.primaryColor} secondary={model.secondaryColor} size="lg" />
              <div className="min-w-0">
                <p className="text-sm text-slate-300">{model.bio}</p>
                <p className="mt-3 rounded-lg border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-xs text-violet-100">{model.aiDisclosure}</p>
              </div>
            </div>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <Detail label="Edad ficticia">{model.fictionalAge} años</Detail>
              <Detail label="Clasificación">{RATING_LABELS[model.contentRating as keyof typeof RATING_LABELS]}</Detail>
              <Detail label="Idiomas">{model.languages.map((l) => LANGUAGE_LABELS[l as keyof typeof LANGUAGE_LABELS] ?? l).join(", ")}</Detail>
              <Detail label="Zona horaria">{model.timezone}</Detail>
              <Detail label="Público objetivo">{model.targetAudience}</Detail>
              <Detail label="Propuesta comercial">{model.commercialPositioning}</Detail>
            </dl>
          </Card>

          <Card>
            <h2 className="mb-4 font-semibold text-white">Identidad visual</h2>
            <div className="mb-4 flex gap-3">
              {[model.primaryColor, model.secondaryColor].map((c) => (
                <div key={c} className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="size-8 rounded-lg ring-1 ring-white/20" style={{ background: c }} />
                  {c}
                </div>
              ))}
            </div>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Detail label="Estética">{model.aesthetic}</Detail>
              <Detail label="Notas de estilo">{model.styleNotes}</Detail>
            </dl>
          </Card>

          <Card>
            <h2 className="mb-4 font-semibold text-white">Personalidad {p ? <span className="text-xs font-normal text-slate-500">v{p.version}</span> : null}</h2>
            {p ? (
              <dl className="grid gap-4 sm:grid-cols-2">
                <Detail label="Rasgos"><Chips items={p.traits} /></Detail>
                <Detail label="Intereses"><Chips items={p.interests} /></Detail>
                <Detail label="Tono">{p.tone}</Detail>
                <Detail label="Historial de conversación">{p.conversationHistoryLimit} mensajes</Detail>
                <div className="sm:col-span-2"><Detail label="Estilo de comunicación">{p.communicationStyle}</Detail></div>
                <div className="sm:col-span-2"><Detail label="Historia ficticia">{p.backstory}</Detail></div>
                <div className="sm:col-span-2">
                  <Detail label="Límites de conversación">
                    {p.boundaries.length ? <ul className="list-disc space-y-1 pl-5">{p.boundaries.map((b) => <li key={b}>{b}</li>)}</ul> : null}
                  </Detail>
                </div>
                <div className="sm:col-span-2"><Detail label="Derivación a una persona"><Chips items={p.escalationKeywords} /></Detail></div>
              </dl>
            ) : (
              <EmptyState title="Sin personalidad definida" />
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 font-semibold text-white">Estado</h2>
            {blockers.length && model.status !== "active" ? (
              <div className="mb-3">
                <Notice tone="warning">
                  <p className="font-medium">Para activar falta:</p>
                  <ul className="mt-1 list-disc pl-5">{blockers.map((b) => <li key={b}>{b}</li>)}</ul>
                </Notice>
              </div>
            ) : null}
            {can(role, "models.change_status") ? (
              <StatusControls status={model.status} action={changeStatusAction.bind(null, model.id)} />
            ) : (
              <p className="text-sm text-slate-400">Solo administradores pueden cambiar el estado.</p>
            )}
          </Card>
          <Card>
            <h2 className="mb-3 font-semibold text-white">Declaración de identidad</h2>
            <p className="text-sm text-slate-300">
              {model.likenessAttestation ? `Confirmada el ${formatDateTime(model.likenessAttestedAt)}.` : "Pendiente: el modelo no puede activarse."}
            </p>
          </Card>
          <Card>
            <h2 className="mb-3 font-semibold text-white">Redes conectadas</h2>
            {model.socialAccounts.length ? (
              <ul className="space-y-2 text-sm">
                {model.socialAccounts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2">
                    <span className="text-slate-300">{a.platform} · @{a.handle}</span>
                    <Badge tone={a.status === "connected" ? "green" : a.status === "disabled" ? "red" : "gray"}>{a.status}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">Ninguna. Los conectores llegan en la Fase 5.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
