import { z } from "zod";
import { discountSchema, quoteLineSchema, taxConfigSchema } from "./engine";

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal("").transform(() => undefined));

export const businessProfileSchema = z.object({
  name: z.string().trim().min(1, "Escribe el nombre de tu negocio").max(120),
  owner: optionalText(120),
  rfc: optionalText(13),
  phone: optionalText(30),
  email: optionalText(254),
  address: optionalText(300),
  website: optionalText(200),
  /** Solo Pro: logotipo como data URL PNG/JPEG (máx. ~300 KB). */
  logoDataUrl: z.string().max(420_000).regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/).optional(),
  /** Solo Pro: color de acento #RRGGBB. */
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const clientSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().trim().min(1, "Escribe el nombre del cliente").max(160),
  company: optionalText(160),
  email: optionalText(254),
  phone: optionalText(30),
  rfc: optionalText(13),
  address: optionalText(300),
});

export const QUOTE_STATUSES = ["borrador", "enviada", "aceptada", "rechazada"] as const;

export const quoteSchema = z.object({
  id: z.string().min(1).max(40),
  folio: z.string().trim().min(1).max(30),
  status: z.enum(QUOTE_STATUSES),
  issuedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  validDays: z.number().int().min(1).max(365),
  client: clientSchema,
  lines: z.array(quoteLineSchema).min(1, "Agrega al menos un concepto").max(200),
  tax: taxConfigSchema,
  discount: discountSchema,
  notes: optionalText(2000),
  terms: optionalText(2000),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type BusinessProfile = z.infer<typeof businessProfileSchema>;
export type Client = z.infer<typeof clientSchema>;
export type Quote = z.infer<typeof quoteSchema>;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

/** Cotización que se comparte en línea (Nube). Los costos internos se eliminan. */
export const sharedSnapshotSchema = z.object({
  business: businessProfileSchema.omit({ logoDataUrl: true }),
  quote: quoteSchema.extend({
    lines: z.array(quoteLineSchema.omit({ unitCostCents: true })).min(1).max(200),
  }),
});
export type SharedSnapshot = z.infer<typeof sharedSnapshotSchema>;

export function stripInternal(business: BusinessProfile, quote: Quote): SharedSnapshot {
  const { logoDataUrl: _logo, ...publicBusiness } = business;
  return {
    business: publicBusiness,
    quote: { ...quote, lines: quote.lines.map(({ unitCostCents: _c, ...rest }) => rest) },
  };
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatDateMx(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
