"use client";
import { useState } from "react";

export function LeadForm({ utm }: { utm: Record<string, string> }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sending");
    const f = new FormData(e.currentTarget);
    const num = (k: string) => (f.get(k) ? Number(f.get(k)) : undefined);
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: f.get("name"), email: f.get("email"), phone: f.get("phone") || "", company: f.get("company") || undefined,
        trade: f.get("trade") || undefined, quotesPerMonth: num("quotesPerMonth"), willingnessToPayMxn: num("willingnessToPayMxn"),
        need: f.get("need") || "", consentContact: f.get("consentContact") === "on", consentMarketing: f.get("consentMarketing") === "on",
        website: f.get("website") || "", utm,
      }),
    });
    if (res.ok) { setState("done"); return; }
    const j = await res.json().catch(() => ({ error: "Error" }));
    setError(j.error ?? "No se pudo enviar"); setState("error");
  }

  if (state === "done")
    return <div className="card"><h2>¡Listo! Ya estás en la lista del piloto.</h2><p className="muted">Te escribiremos al correo que dejaste. Sin spam: solo sobre el piloto.</p></div>;

  return (
    <form className="card" onSubmit={onSubmit} noValidate={false}>
      <h2>Únete al piloto gratuito</h2>
      <p className="muted">Lugares limitados para negocios en México. Te tomará 1 minuto.</p>
      <div className="row">
        <div className="field"><label htmlFor="name">Nombre *</label><input id="name" name="name" required minLength={2} maxLength={120} autoComplete="name" /></div>
        <div className="field"><label htmlFor="email">Correo *</label><input id="email" name="email" type="email" required maxLength={200} autoComplete="email" /></div>
      </div>
      <div className="row">
        <div className="field"><label htmlFor="phone">WhatsApp (opcional)</label><input id="phone" name="phone" inputMode="tel" maxLength={20} autoComplete="tel" /></div>
        <div className="field"><label htmlFor="trade">Giro u oficio</label><input id="trade" name="trade" maxLength={80} placeholder="Ej. plomería, imprenta, taller" /></div>
      </div>
      <div className="row">
        <div className="field"><label htmlFor="company">Negocio (opcional)</label><input id="company" name="company" maxLength={120} autoComplete="organization" /></div>
        <div className="field"><label htmlFor="quotesPerMonth">¿Cuántas cotizaciones haces al mes?</label><input id="quotesPerMonth" name="quotesPerMonth" type="number" min={0} max={10000} /></div>
      </div>
      <div className="field">
        <label htmlFor="willingnessToPayMxn">Si resolviera tu problema, ¿cuánto pagarías al mes? (MXN)</label>
        <select id="willingnessToPayMxn" name="willingnessToPayMxn" defaultValue="">
          <option value="">Prefiero no decir</option>
          <option value="0">Nada, solo lo usaría gratis</option>
          <option value="49">$49</option>
          <option value="99">$99</option>
          <option value="149">$149</option>
          <option value="249">$249</option>
          <option value="399">$399 o más</option>
        </select>
      </div>
      <div className="field"><label htmlFor="need">¿Cómo cotizas hoy y qué es lo que más te cuesta?</label><textarea id="need" name="need" rows={3} maxLength={2000} /></div>
      <div style={{ position: "absolute", left: "-10000px" }} aria-hidden="true"><label htmlFor="website">No llenar</label><input id="website" name="website" tabIndex={-1} autoComplete="off" /></div>
      <div className="field"><label><input type="checkbox" name="consentContact" required />Acepto el <a href="/privacidad" target="_blank">aviso de privacidad</a> y que me contacten sobre el piloto. *</label></div>
      <div className="field"><label><input type="checkbox" name="consentMarketing" />Quiero recibir consejos y novedades por correo (opcional).</label></div>
      {state === "error" && <p className="notice">{error}</p>}
      <button className="btn" disabled={state === "sending"}>{state === "sending" ? "Enviando…" : "Quiero participar"}</button>
    </form>
  );
}
