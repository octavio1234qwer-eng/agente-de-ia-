import { q } from "@/lib/queries";
import { Badge, Section, Table, dt } from "@/components/ui";
import { markPublished, reviewContent } from "../actions";
export const dynamic = "force-dynamic";
export default async function Content() {
  const rows = await q<{ id: string; channel: string; title: string; body: string; status: string; created_by: string; created_at: string; published_url: string | null }>(
    "select * from content_items order by created_at desc limit 200");
  return (<><h1>Publicaciones</h1>
    <p className="muted">Content Factory crea borradores (VERDE). Aprobar y publicar es AMARILLO y lo hace una persona. Risk & Compliance rechaza afirmaciones prohibidas.</p>
    <Section title="Contenido">
      <Table rows={rows} empty="Sin borradores. Ejecuta content-factory › draft_posts." cols={[
        { h: "Creado", c: (r) => dt(r.created_at) }, { h: "Canal", c: (r) => r.channel },
        { h: "Contenido", c: (r) => <details><summary>{r.title}</summary><pre style={{ whiteSpace: "pre-wrap" }}>{r.body}</pre></details> },
        { h: "Estado", c: (r) => <><Badge v={r.status} />{r.published_url && <div><a href={r.published_url} target="_blank" rel="noopener noreferrer">ver</a></div>}</> },
        { h: "Acciones", c: (r) => (<div className="row">
          {r.status === "draft" && <form action={reviewContent}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="decision" value="approve" /><button className="btn ghost">Aprobar</button></form>}
          {(r.status === "draft" || r.status === "approved") && <form action={reviewContent}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="decision" value="reject" /><button className="btn danger">Rechazar</button></form>}
          {r.status === "approved" && <form action={markPublished} className="row"><input type="hidden" name="id" value={r.id} /><input name="url" placeholder="URL publicada" required style={{ width: 170 }} /><button className="btn ghost">Marcar publicado</button></form>}
        </div>) },
      ]} />
    </Section></>);
}
