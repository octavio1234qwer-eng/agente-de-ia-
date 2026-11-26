import { getCurrentUser } from "@/lib/auth";
import { collectMyData } from "@/lib/data/my-data";

export const dynamic = "force-dynamic";

/** Descarga en JSON todos los datos personales del alumno con sesión. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Inicia sesión para descargar tus datos." }, { status: 401 });
  try {
    const data = await collectMyData(user.id);
    const day = new Date().toISOString().slice(0, 10);
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="mis-datos-${day}.json"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("[export my data]", e);
    return Response.json({ error: "No se pudieron reunir tus datos. Intenta de nuevo." }, { status: 500 });
  }
}
