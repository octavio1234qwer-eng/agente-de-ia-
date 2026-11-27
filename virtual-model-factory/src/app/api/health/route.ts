import { getDb } from "@/server/db";

/** Comprobación de salud sin datos sensibles. */
export async function GET() {
  try {
    const db = await getDb();
    await db.query("select 1");
    return Response.json({ status: "ok", database: db.kind }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ status: "error", database: "unavailable" }, { status: 503 });
  }
}
