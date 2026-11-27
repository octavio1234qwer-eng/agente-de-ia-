"use client";

import { useActionState } from "react";
import { Button, Card, Field, Notice, inputClass } from "@/components/ui";
import { CONTENT_RATINGS, LANGUAGES, LANGUAGE_LABELS, MIN_FICTIONAL_AGE, RATING_LABELS, type ModelInput } from "@/lib/model-schema";
import type { ModelFormState } from "./actions";

type Props = {
  action: (prev: ModelFormState, form: FormData) => Promise<ModelFormState>;
  initial?: ModelInput;
  submitLabel: string;
};

const EMPTY: ModelInput = {
  slug: "", stageName: "", bio: "", fictionalAge: 25,
  aiDisclosure: "Personaje virtual creado con inteligencia artificial. No es una persona real.",
  contentRating: "sfw", targetAudience: "", commercialPositioning: "", languages: ["es"], timezone: "UTC",
  visualIdentity: { primaryColor: "#8b5cf6", secondaryColor: "#3b82f6", aesthetic: "", styleNotes: "" },
  personality: {
    traits: [], tone: "", communicationStyle: "", backstory: "", interests: [],
    boundaries: [
      "No afirmar ser una persona humana; reconocer que es un personaje de IA.",
      "No pedir ni compartir datos personales.",
      "No presionar emocionalmente para comprar.",
      "Derivar a una persona ante temas sensibles.",
    ],
    samplePhrases: [], conversationHistoryLimit: 20, escalationKeywords: ["menor", "suicidio", "reembolso", "denuncia"],
  },
  likenessAttestation: false,
};

export function ModelForm({ action, initial = EMPTY, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState<ModelFormState, FormData>(action, {});
  const err = (k: string) => state.fieldErrors?.[k];
  const aria = (k: string) => (err(k) ? { "aria-invalid": true, "aria-describedby": `${k}-error` } : {});
  const p = initial.personality;

  return (
    <form action={formAction} className="space-y-6">
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}

      <Card className="space-y-4">
        <h2 className="font-semibold text-white">Identidad</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre artístico" name="stageName" error={err("stageName")}>
            <input id="stageName" name="stageName" required maxLength={80} defaultValue={initial.stageName} className={inputClass} {...aria("stageName")} />
          </Field>
          <Field label="Identificador (slug)" name="slug" hint="Minúsculas y guiones, p. ej. nova-reyes." error={err("slug")}>
            <input id="slug" name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={60} defaultValue={initial.slug} className={inputClass} {...aria("slug")} />
          </Field>
          <Field label="Edad ficticia" name="fictionalAge" hint={`Mínimo ${MIN_FICTIONAL_AGE} años. Siempre un personaje inequívocamente adulto.`} error={err("fictionalAge")}>
            <input id="fictionalAge" name="fictionalAge" type="number" inputMode="numeric" min={MIN_FICTIONAL_AGE} max={99} required defaultValue={initial.fictionalAge} className={inputClass} {...aria("fictionalAge")} />
          </Field>
          <Field label="Clasificación de contenido" name="contentRating" error={err("contentRating")}>
            <select id="contentRating" name="contentRating" defaultValue={initial.contentRating} className={inputClass}>
              {CONTENT_RATINGS.map((r) => <option key={r} value={r}>{RATING_LABELS[r]}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Biografía" name="bio" error={err("bio")}>
          <textarea id="bio" name="bio" rows={3} maxLength={2000} defaultValue={initial.bio} className={inputClass} />
        </Field>
        <Field label="Divulgación de IA" name="aiDisclosure" hint="Texto visible en perfiles y conversaciones. Obligatorio." error={err("aiDisclosure")}>
          <input id="aiDisclosure" name="aiDisclosure" required minLength={10} maxLength={500} defaultValue={initial.aiDisclosure} className={inputClass} {...aria("aiDisclosure")} />
        </Field>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-200">Idiomas</legend>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((l) => (
              <label key={l} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm has-[:checked]:border-violet-400/60 has-[:checked]:bg-violet-500/15">
                <input type="checkbox" name="languages" value={l} defaultChecked={initial.languages.includes(l)} className="accent-violet-500" />
                {LANGUAGE_LABELS[l]}
              </label>
            ))}
          </div>
          {err("languages") ? <p className="mt-1 text-xs text-rose-300">{err("languages")}</p> : null}
        </fieldset>
        <Field label="Zona horaria (IANA)" name="timezone" hint="Para el calendario de publicaciones, p. ej. America/Mexico_City.">
          <input id="timezone" name="timezone" defaultValue={initial.timezone} maxLength={64} className={inputClass} />
        </Field>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold text-white">Posicionamiento comercial</h2>
        <Field label="Público objetivo" name="targetAudience">
          <textarea id="targetAudience" name="targetAudience" rows={2} maxLength={1000} defaultValue={initial.targetAudience} className={inputClass} />
        </Field>
        <Field label="Propuesta comercial" name="commercialPositioning">
          <textarea id="commercialPositioning" name="commercialPositioning" rows={2} maxLength={1000} defaultValue={initial.commercialPositioning} className={inputClass} />
        </Field>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold text-white">Identidad visual</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Color principal" name="primaryColor" error={err("visualIdentity.primaryColor")}>
            <input id="primaryColor" name="primaryColor" type="color" defaultValue={initial.visualIdentity.primaryColor} className="h-11 w-full cursor-pointer rounded-xl border border-white/10 bg-ink-900" />
          </Field>
          <Field label="Color secundario" name="secondaryColor" error={err("visualIdentity.secondaryColor")}>
            <input id="secondaryColor" name="secondaryColor" type="color" defaultValue={initial.visualIdentity.secondaryColor} className="h-11 w-full cursor-pointer rounded-xl border border-white/10 bg-ink-900" />
          </Field>
        </div>
        <Field label="Estética" name="aesthetic">
          <input id="aesthetic" name="aesthetic" maxLength={300} defaultValue={initial.visualIdentity.aesthetic} className={inputClass} />
        </Field>
        <Field label="Notas de estilo (coherencia visual)" name="styleNotes">
          <textarea id="styleNotes" name="styleNotes" rows={2} maxLength={1000} defaultValue={initial.visualIdentity.styleNotes} className={inputClass} />
        </Field>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold text-white">Personalidad y estilo de comunicación</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Rasgos" name="traits" hint="Separados por comas.">
            <input id="traits" name="traits" defaultValue={p.traits.join(", ")} className={inputClass} />
          </Field>
          <Field label="Intereses" name="interests" hint="Separados por comas.">
            <input id="interests" name="interests" defaultValue={p.interests.join(", ")} className={inputClass} />
          </Field>
          <Field label="Tono" name="tone">
            <input id="tone" name="tone" maxLength={500} defaultValue={p.tone} className={inputClass} />
          </Field>
          <Field label="Historial de conversación (mensajes)" name="conversationHistoryLimit" error={err("personality.conversationHistoryLimit")}>
            <input id="conversationHistoryLimit" name="conversationHistoryLimit" type="number" min={0} max={200} defaultValue={p.conversationHistoryLimit} className={inputClass} />
          </Field>
        </div>
        <Field label="Estilo de comunicación" name="communicationStyle">
          <textarea id="communicationStyle" name="communicationStyle" rows={2} maxLength={2000} defaultValue={p.communicationStyle} className={inputClass} />
        </Field>
        <Field label="Historia ficticia" name="backstory">
          <textarea id="backstory" name="backstory" rows={3} maxLength={4000} defaultValue={p.backstory} className={inputClass} />
        </Field>
        <Field label="Límites de conversación" name="boundaries" hint="Uno por línea. Obligatorios para activar el modelo.">
          <textarea id="boundaries" name="boundaries" rows={4} defaultValue={p.boundaries.join("\n")} className={inputClass} />
        </Field>
        <Field label="Frases de ejemplo" name="samplePhrases" hint="Una por línea.">
          <textarea id="samplePhrases" name="samplePhrases" rows={2} defaultValue={p.samplePhrases.join("\n")} className={inputClass} />
        </Field>
        <Field label="Palabras que derivan a una persona" name="escalationKeywords" hint="Separadas por comas.">
          <input id="escalationKeywords" name="escalationKeywords" defaultValue={p.escalationKeywords.join(", ")} className={inputClass} />
        </Field>
      </Card>

      <Card>
        <label className="flex cursor-pointer gap-3 text-sm text-slate-200">
          <input type="checkbox" name="likenessAttestation" defaultChecked={initial.likenessAttestation} className="mt-1 size-5 shrink-0 accent-violet-500" />
          <span>
            Declaro que este personaje es <strong>ficticio y adulto</strong>, que <strong>no reproduce el rostro, la voz ni la identidad de una persona real</strong> sin
            autorización verificable, y que se identificará siempre como personaje virtual creado con IA. Requisito para activarlo; queda registrado con tu usuario.
          </span>
        </label>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Guardando…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
