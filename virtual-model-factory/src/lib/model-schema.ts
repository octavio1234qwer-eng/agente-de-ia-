import { z } from "zod";

/** Esquemas compartidos (cliente y servidor) del gestor de modelos virtuales. */

export const MODEL_STATUSES = ["draft", "active", "paused", "archived"] as const;
export const CONTENT_RATINGS = ["sfw", "suggestive", "adult"] as const;
export const LANGUAGES = ["es", "en", "pt", "it", "fr", "de"] as const;

export const STATUS_LABELS: Record<(typeof MODEL_STATUSES)[number], string> = {
  draft: "Borrador",
  active: "Activo",
  paused: "Pausado",
  archived: "Archivado",
};
export const RATING_LABELS: Record<(typeof CONTENT_RATINGS)[number], string> = {
  sfw: "Apto para todo público",
  suggestive: "Sugerente",
  adult: "Adulto (+18)",
};
export const LANGUAGE_LABELS: Record<(typeof LANGUAGES)[number], string> = {
  es: "Español", en: "Inglés", pt: "Portugués", it: "Italiano", fr: "Francés", de: "Alemán",
};

export const MIN_FICTIONAL_AGE = 25;

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color hexadecimal no válido (#RRGGBB).");
const list = (max: number, itemMax = 120) =>
  z.array(z.string().trim().min(1).max(itemMax)).max(max);

export const visualIdentitySchema = z.object({
  primaryColor: hexColor,
  secondaryColor: hexColor,
  aesthetic: z.string().trim().max(300).default(""),
  styleNotes: z.string().trim().max(1000).default(""),
});

export const personalitySchema = z.object({
  traits: list(12, 60),
  tone: z.string().trim().max(500).default(""),
  communicationStyle: z.string().trim().max(2000).default(""),
  backstory: z.string().trim().max(4000).default(""),
  interests: list(20, 80),
  boundaries: list(30, 200),
  samplePhrases: list(20, 300),
  conversationHistoryLimit: z.coerce.number().int().min(0).max(200).default(20),
  escalationKeywords: list(50, 80),
});

export const modelInputSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Solo minúsculas, números y guiones.")
    .min(3)
    .max(60),
  stageName: z.string().trim().min(2, "El nombre artístico es obligatorio.").max(80),
  bio: z.string().trim().max(2000).default(""),
  fictionalAge: z.coerce
    .number({ message: "Indica una edad." })
    .int()
    .min(MIN_FICTIONAL_AGE, `La edad ficticia mínima es ${MIN_FICTIONAL_AGE} años.`)
    .max(99),
  aiDisclosure: z.string().trim().min(10, "La divulgación de IA es obligatoria (mínimo 10 caracteres).").max(500),
  contentRating: z.enum(CONTENT_RATINGS),
  targetAudience: z.string().trim().max(1000).default(""),
  commercialPositioning: z.string().trim().max(1000).default(""),
  languages: z.array(z.enum(LANGUAGES)).min(1, "Selecciona al menos un idioma.").max(10),
  timezone: z.string().trim().min(1).max(64).default("UTC"),
  visualIdentity: visualIdentitySchema,
  personality: personalitySchema,
  likenessAttestation: z.boolean(),
});

export type ModelInput = z.infer<typeof modelInputSchema>;

/** Convierte un texto con un elemento por línea (o separado por comas) en lista. */
export function splitList(value: FormDataEntryValue | null, separator: RegExp = /\r?\n|,/): string[] {
  return String(value ?? "")
    .split(separator)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function modelInputFromForm(form: FormData): unknown {
  return {
    slug: form.get("slug"),
    stageName: form.get("stageName"),
    bio: form.get("bio") ?? "",
    fictionalAge: form.get("fictionalAge"),
    aiDisclosure: form.get("aiDisclosure"),
    contentRating: form.get("contentRating"),
    targetAudience: form.get("targetAudience") ?? "",
    commercialPositioning: form.get("commercialPositioning") ?? "",
    languages: form.getAll("languages").map(String),
    timezone: form.get("timezone") || "UTC",
    visualIdentity: {
      primaryColor: form.get("primaryColor"),
      secondaryColor: form.get("secondaryColor"),
      aesthetic: form.get("aesthetic") ?? "",
      styleNotes: form.get("styleNotes") ?? "",
    },
    personality: {
      traits: splitList(form.get("traits")),
      tone: form.get("tone") ?? "",
      communicationStyle: form.get("communicationStyle") ?? "",
      backstory: form.get("backstory") ?? "",
      interests: splitList(form.get("interests")),
      boundaries: splitList(form.get("boundaries"), /\r?\n/),
      samplePhrases: splitList(form.get("samplePhrases"), /\r?\n/),
      conversationHistoryLimit: form.get("conversationHistoryLimit") ?? 20,
      escalationKeywords: splitList(form.get("escalationKeywords")),
    },
    likenessAttestation: form.get("likenessAttestation") === "on",
  };
}
