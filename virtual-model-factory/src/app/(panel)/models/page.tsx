import type { Metadata } from "next";
import Link from "next/link";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, cx } from "@/components/ui";
import { LANGUAGE_LABELS, MODEL_STATUSES, RATING_LABELS, STATUS_LABELS } from "@/lib/model-schema";
import { asCurrentUser } from "@/server/auth/dal";
import { can } from "@/server/auth/permissions";
import { listModels, type ModelStatus } from "@/server/modules/models/repository";
import { ModelAvatar, StatusBadge } from "../model-ui";

export const metadata: Metadata = { title: "Modelos virtuales" };

export default async function ModelsPage({ searchParams }: PageProps<"/models">) {
  const raw = (await searchParams).status;
  const status = MODEL_STATUSES.includes(raw as ModelStatus) ? (raw as ModelStatus) : undefined;
  const { models, canCreate } = await asCurrentUser(async (db, user) => ({
    models: await listModels(db, status),
    canCreate: can(user.role, "models.create"),
  }));

  const filters: { label: string; value?: ModelStatus }[] = [{ label: "Vigentes" }, ...MODEL_STATUSES.map((s) => ({ label: STATUS_LABELS[s], value: s }))];

  return (
    <>
      <PageHeader
        title="Modelos virtuales"
        description="Identidades ficticias, adultas e identificadas como IA. Cada una con configuración independiente."
        actions={canCreate ? <ButtonLink href="/models/new">Nuevo modelo</ButtonLink> : null}
      />
      <nav aria-label="Filtrar por estado" className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {filters.map((f) => (
          <Link
            key={f.label}
            href={f.value ? `/models?status=${f.value}` : "/models"}
            aria-current={status === f.value ? "page" : undefined}
            className={cx(
              "inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-sm",
              status === f.value ? "bg-violet-600 text-white" : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      {models.length === 0 ? (
        <EmptyState title="No hay modelos con este filtro">
          {canCreate ? "Crea un modelo nuevo o carga los de demostración desde Configuración." : "Pide a un administrador que te asigne modelos."}
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {models.map((m) => (
            <li key={m.id}>
              <Link href={`/models/${m.id}`} className="block h-full">
                <Card className="h-full transition hover:border-violet-400/40 hover:bg-white/[0.05]">
                  <div className="flex items-start gap-3">
                    <ModelAvatar name={m.stageName} primary={m.primaryColor} secondary={m.secondaryColor} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-white">{m.stageName}</p>
                      <p className="text-xs text-slate-400">{m.fictionalAge} años (ficticia) · {RATING_LABELS[m.contentRating as keyof typeof RATING_LABELS]}</p>
                    </div>
                    <StatusBadge status={m.status} />
                  </div>
                  {m.aesthetic ? <p className="mt-3 line-clamp-2 text-sm text-slate-300">{m.aesthetic}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {m.isDemo ? <Badge tone="violet">DEMO</Badge> : null}
                    {m.languages.map((l) => <Badge key={l}>{LANGUAGE_LABELS[l as keyof typeof LANGUAGE_LABELS] ?? l}</Badge>)}
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
