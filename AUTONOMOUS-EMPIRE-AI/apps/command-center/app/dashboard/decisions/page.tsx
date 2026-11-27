import { q, n } from "@/lib/queries";
import { Badge, Section, Table, dt, money } from "@/components/ui";
import { currentUser } from "@/lib/server";
import { decide, recordExpenseAction, requestSpendAction } from "../actions";
export const dynamic = "force-dynamic";
export default async function Decisions() {
  const me = await currentUser();
  const approvals = await q<{ id: string; action: string; requested_by: string; reason: string; amount_cents: string | null; status: string; decided_by: string | null; decided_at: string | null; result: string | null; created_at: string; payload: Record<string, string> }>(
    "select * from approvals order by (status='pending') desc, created_at desc limit 200");
  const decisions = await q<{ made_by: string; title: string; rationale: string; created_at: string }>("select * from decisions order by created_at desc limit 100");
  const units = await q<{ id: string; name: string }>("select id, name from business_units order by phase");
  const isOwner = me?.role === "owner";
  return (<><h1>Decisiones y autorizaciones (NIVEL ROJO)</h1>
    <p className="muted">Gastar, contratar, comprar publicidad, mover fondos, cambiar credenciales o aceptar obligaciones legales requiere autorización del propietario. Cada decisión queda con fecha, usuario, acción y resultado.</p>
    <Section title="Autorizaciones">
      <Table rows={approvals} empty="Sin solicitudes." cols={[
        { h: "Solicitada", c: (r) => dt(r.created_at) }, { h: "Acción", c: (r) => <span className="mono">{r.action}</span> },
        { h: "Por", c: (r) => <span className="mono">{r.requested_by}</span> }, { h: "Motivo", c: (r) => <>{r.reason}{r.payload?.vendor && <div className="muted">Proveedor: {r.payload.vendor}</div>}</> },
        { h: "Monto", c: (r) => (r.amount_cents ? money(n(r.amount_cents)) : "—"), num: true },
        { h: "Estado", c: (r) => <><Badge v={r.status} />{r.decided_by && <div className="muted" style={{ fontSize: ".75rem" }}>{r.decided_by} · {dt(r.decided_at)}</div>}</> },
        { h: "", c: (r) => !isOwner ? null : r.status === "pending" ? (
          <form action={decide} className="row"><input type="hidden" name="id" value={r.id} /><input name="note" placeholder="Nota" style={{ width: 120 }} />
            <button className="btn ghost" name="decision" value="approve">Aprobar</button><button className="btn danger" name="decision" value="reject">Rechazar</button></form>
        ) : r.status === "approved" && r.action === "money.spend" ? (
          <form action={recordExpenseAction} className="row"><input type="hidden" name="id" value={r.id} /><input name="receipt" placeholder="Folio/recibo" style={{ width: 120 }} /><button className="btn ghost">Registrar gasto realizado</button></form>
        ) : null },
      ]} />
    </Section>
    <div className="grid cols-2">
      <Section title="Solicitar un gasto">
        <form action={requestSpendAction}>
          <div className="field"><label>Unidad</label><select name="unit">{units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
          <div className="row"><div className="field"><label>Monto (MXN)</label><input name="amountMxn" type="number" step="0.01" min="0.01" required /></div><div className="field"><label>Proveedor</label><input name="vendor" required /></div></div>
          <div className="field"><label>Justificación comercial</label><textarea name="reason" required rows={2} /></div>
          <button className="btn">Crear solicitud</button>
          <p className="muted" style={{ fontSize: ".8rem", marginTop: ".5rem" }}>Se bloquea si supera el presupuesto disponible.</p>
        </form>
      </Section>
      <Section title="Historial de decisiones">
        <Table rows={decisions} empty="Sin decisiones registradas." cols={[
          { h: "Fecha", c: (r) => dt(r.created_at) }, { h: "Decisión", c: (r) => <><strong>{r.title}</strong><div className="muted">{r.rationale}</div></> }, { h: "Por", c: (r) => <span className="mono">{r.made_by}</span> },
        ]} />
      </Section>
    </div>
  </>);
}
