import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { requireEnv } from "@/lib/env";

/**
 * Cliente con service_role: OMITE RLS. Úsalo solo en el servidor para tareas
 * de sistema ya autorizadas (webhooks verificados, envío de correos, órdenes).
 * Nunca lo importes desde un componente de cliente.
 */
let cached: ReturnType<typeof createSupabaseClient<Database>> | null = null;

export function createAdminClient() {
  if (!cached) {
    cached = createSupabaseClient<Database>(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return cached;
}
