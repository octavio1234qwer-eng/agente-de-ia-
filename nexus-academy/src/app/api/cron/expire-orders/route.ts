import { isAuthorizedCron } from "@/lib/cron";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Marca como expirados los pedidos pendientes de más de 48 h (sin tocar los pagados). */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return Response.json({ error: "No autorizado" }, { status: 401 });
  const cutoff = new Date(Date.now() - 48 * 3600_000).toISOString();
  const { data, error } = await createAdminClient()
    .from("orders")
    .update({ status: "expired", failure_reason: "Sin confirmación del proveedor en 48 h" })
    .eq("status", "pending")
    .lt("created_at", cutoff)
    .select("id");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ job: "expire_orders", expired: data?.length ?? 0 });
}
