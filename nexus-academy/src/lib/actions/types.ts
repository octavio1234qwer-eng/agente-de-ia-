export type ActionState = {
  error?: string | null;
  success?: string | null;
  fieldErrors?: Record<string, string>;
  /** Valores enviados (sin contraseñas) para repoblar el formulario tras un error. */
  values?: Record<string, string>;
} | null;
