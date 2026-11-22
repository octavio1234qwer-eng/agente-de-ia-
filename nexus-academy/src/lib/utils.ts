import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatPrice(cents: number, currency = "MXN") {
  if (cents === 0) return "Gratis";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatMoney(cents: number, currency = "MXN") {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency, minimumFractionDigits: 2 }).format(cents / 100);
}

export function discountPercent(price: number, compareAt: number | null | undefined) {
  if (!compareAt || compareAt <= price || price < 0) return 0;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

export function formatDuration(minutes: number) {
  if (minutes <= 0) return "—";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function formatSeconds(seconds: number) {
  const m = Math.max(1, Math.round(seconds / 60));
  return `${m} min`;
}

export function formatDate(value: string | Date, opts: Intl.DateTimeFormatOptions = { dateStyle: "long" }) {
  return new Intl.DateTimeFormat("es-MX", { timeZone: "America/Mexico_City", ...opts }).format(new Date(value));
}

export function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export const levelLabel: Record<string, string> = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzado",
  all: "Todos los niveles",
};

export const lessonTypeLabel: Record<string, string> = {
  video: "Video",
  article: "Lectura",
  quiz: "Evaluación",
  exercise: "Ejercicio",
};

export const orderStatusLabel: Record<string, string> = {
  pending: "Pendiente",
  paid: "Pagado",
  failed: "Fallido",
  cancelled: "Cancelado",
  expired: "Expirado",
  refunded: "Reembolsado",
  partially_refunded: "Reembolso parcial",
};

export const providerLabel: Record<string, string> = {
  stripe: "Tarjeta (Stripe)",
  mercadopago: "Mercado Pago",
  paypal: "PayPal",
  free: "Gratis",
};

export function initials(name: string | null | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "NX";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Escapa texto para insertarlo en HTML (plantillas de correo). */
export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
