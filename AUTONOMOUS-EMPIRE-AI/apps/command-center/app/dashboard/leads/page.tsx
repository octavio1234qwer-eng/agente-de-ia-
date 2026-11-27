import { q, n } from "@/lib/queries";
import { Badge, Section, Table, dt, money } from "@/components/ui";
import { LEAD_STATUSES } from "@empire/businesses/cotizafacil-mx/leads";
import { approveEmail, setLeadStatus } from "../actions";
export const dynamic = "force-dynamic";
export default async function Leads() {
  const leads = await q<{ id: string; name: string; email: string; phone: string | null; trade: string | null; quotes_per_month: number | null; willingness_to_pay_cents: string | null; need: string; status: string; score: number; consent_marketing: boolean; created_at: string; next_follow_up_at: string | null; business_unit_id: string }>(
    "select * from leads order by score desc, created_at desc limit 500");
  const outbox = await q<{ id: string; to_email: string; subject: string; body: string; status: string; created_at: string }>(
    "select id, to_email, subject, body, status, created_at from email_outbox order by created_at desc limit 100");
  const funnel = LEAD_STATUSES.map((s) => ({ s, c: leads.filter((l) => l.status === s).length }));
  return (<>
    <h1>Clientes potenciales (CRM)</h1>
    <div className="row" style={{ marginBottom: "1rem" }}>{funnel.map((f) => <span key={f.s} className="badge info">{f.s}: {f.c}</span>)}</div>
    <Section title={`Leads (${leads.length})`}>
      <Table rows={leads} empty="Todavía no hay leads. Comparte /cotizafacil." cols={[
        { h: "Fecha", c: (r) => dt(r.created_at) },
        { h: "Contacto", c: (r) => <><strong>{r.name}</strong><div className="muted mono">{r.email}{r.phone ? ` · ${r.phone}` : ""}</div></> },
        { h: "Giro", c: (r) => r.trade ?? "—" }, { h: "Cotiz./mes", c: (r) => r.quotes_per_month ?? "—", num: true },
        { h: "Pagaría", c: (r) => (r.willingness_to_pay_cents == null ? "—" : money(r.willingness_to_pay_cents)), num: true },
        { h: "Score", c: (r) => n(r.score), num: true },
        { h: "Necesidad", c: (r) => <span className="muted" style={{ fontSize: ".82rem" }}>{r.need.slice(0, 160)}</span> },
        { h: "Seguimiento", c: (r) => dt(r.next_follow_up_at) },
        { h: "Estado", c: (r) => (
          <form action={setLeadStatus} className="row"><input type="hidden" name="id" value={r.id} />
            <select name="status" defaultValue={r.status} style={{ width: 120 }}>{LEAD_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
            <button className="btn ghost">OK</button></form>) },
      ]} />
    </Section>
    <Section title="Correos de seguimiento (borradores → aprobación → envío)">
      <p className="muted" style={{ fontSize: ".85rem" }}>NIVEL AMARILLO: solo se envían los aprobados, a leads con consentimiento y con tope diario. Sin SMTP configurado no sale ningún correo.</p>
      <Table rows={outbox} empty="Sin correos." cols={[
        { h: "Para", c: (r) => <span className="mono">{r.to_email}</span> },
        { h: "Mensaje", c: (r) => <details><summary>{r.subject}</summary><pre style={{ whiteSpace: "pre-wrap" }}>{r.body}</pre></details> },
        { h: "Estado", c: (r) => <Badge v={r.status} /> },
        { h: "", c: (r) => r.status === "draft" ? (<div className="row">
          <form action={approveEmail}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="decision" value="approve" /><button className="btn ghost">Aprobar</button></form>
          <form action={approveEmail}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="decision" value="block" /><button className="btn danger">Descartar</button></form></div>) : null },
      ]} />
    </Section>
  </>);
}
