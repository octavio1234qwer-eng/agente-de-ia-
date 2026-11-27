import type { ReactNode } from "react";

export const money = (cents: number | string | null | undefined, currency = "MXN") =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(Number(cents ?? 0) / 100);
export const dt = (d: string | Date | null | undefined) =>
  d ? new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" }).format(new Date(d)) : "—";

export function Kpi({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return <div className="card kpi"><div className="label">{label}</div><div className="value">{value}</div>{sub && <div className="sub">{sub}</div>}</div>;
}

const tone: Record<string, string> = {
  succeeded: "ok", active: "ok", approved: "ok", won: "ok", published: "ok", sent: "ok", idle: "ok", ok: "ok", executed: "ok", validated: "ok",
  running: "info", validating: "info", new: "info", queued: "info", draft: "info", contacted: "info", info: "info", research: "info", scheduled: "info",
  pending: "warn", warning: "warn", awaiting_approval: "warn", proposal: "warn", qualified: "warn", paused: "warn", skipped: "warn", estimated: "warn",
  failed: "bad", blocked: "bad", critical: "bad", rejected: "bad", lost: "bad", broken: "bad", error: "bad", killed: "bad",
};
export const Badge = ({ v }: { v: string | null | undefined }) => <span className={`badge ${tone[v ?? ""] ?? ""}`}>{v ?? "—"}</span>;

export function Table<T>({ rows, cols, empty = "Sin datos todavía." }: {
  rows: T[]; empty?: string;
  cols: { h: string; c: (r: T) => ReactNode; num?: boolean }[];
}) {
  if (!rows.length) return <div className="empty">{empty}</div>;
  return (
    <div className="table-wrap"><table>
      <thead><tr>{cols.map((c) => <th key={c.h} className={c.num ? "num" : ""}>{c.h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c.h} className={c.num ? "num" : ""}>{c.c(r)}</td>)}</tr>)}</tbody>
    </table></div>
  );
}

export function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return <section className="card" style={{ marginBottom: "1rem" }}><div className="topbar" style={{ marginBottom: ".6rem" }}><h2 style={{ margin: 0 }}>{title}</h2>{actions}</div>{children}</section>;
}
