import type { Metadata } from "next";
import { db, visitorHash } from "@/lib/server";
import { LeadForm } from "@/components/LeadForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "CotizaFácil MX — cotizaciones profesionales en minutos",
  description: "Haz cotizaciones claras con IVA, anticipo y vigencia, y envíalas por WhatsApp. Piloto gratuito para negocios en México.",
  robots: { index: true, follow: true },
};

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const utm: Record<string, string> = {};
  for (const k of ["utm_source", "utm_medium", "utm_campaign"]) { const v = sp[k]; if (typeof v === "string") utm[k.replace("utm_", "")] = v.slice(0, 100); }
  try {
    const d = await db();
    await d.query("insert into page_views(path, utm_source, visitor_hash) values ('/cotizafacil',$1,$2)", [utm.source ?? null, await visitorHash()]);
  } catch { /* la medición nunca bloquea la página */ }
  const ga = process.env.NEXT_PUBLIC_GA_ID;
  return (
    <main className="public">
      {ga && /^G-[A-Z0-9]+$/.test(ga) && (<>
        <script async src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} />
        <script dangerouslySetInnerHTML={{ __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${ga}',{anonymize_ip:true});` }} />
      </>)}
      <header className="site"><div className="logo">Cotiza<span>Fácil</span> MX</div><a href="#piloto" className="btn ghost">Piloto gratis</a></header>
      <section className="hero">
        <span className="badge info">Piloto 2026 · cupo limitado</span>
        <h1>Cotizaciones profesionales en minutos, no en horas.</h1>
        <p className="lead">Para oficios y pequeños negocios en México: arma una cotización clara con IVA, anticipo y vigencia, y mándala por WhatsApp o correo con tu logo. Sin Excel, sin libreta.</p>
        <p className="muted">Estamos validando el producto con negocios reales. El piloto es gratuito; a cambio te pedimos tu opinión.</p>
      </section>
      <h2 style={{ marginTop: "2.5rem" }}>Lo que estamos construyendo con los participantes del piloto</h2>
      <section className="grid features" style={{ marginTop: "1rem" }}>
        <div className="card"><h3>IVA y totales sin errores</h3><p className="muted">Partidas, materiales y mano de obra por separado; subtotal, IVA 16 % y total calculados solos.</p></div>
        <div className="card"><h3>Anticipo y vigencia</h3><p className="muted">Condiciones de pago y fecha de vigencia por escrito para evitar malentendidos.</p></div>
        <div className="card"><h3>Lista para WhatsApp</h3><p className="muted">Un enlace o PDF con tu marca que el cliente abre en su celular.</p></div>
        <div className="card"><h3>Seguimiento</h3><p className="muted">Recordatorio para dar seguimiento a cada cotización enviada.</p></div>
      </section>
      <section id="piloto" className="grid cols-2" style={{ alignItems: "start" }}>
        <div>
          <h2>¿Cómo funciona el piloto?</h2>
          <ol className="muted">
            <li>Te registras y nos cuentas cómo cotizas hoy.</li>
            <li>Te contactamos para entender tu caso (15 min).</li>
            <li>Usas la herramienta gratis durante el piloto.</li>
          </ol>
          <p className="muted">Precio previsto después del piloto: por definir con base en lo que nos digan los participantes. No se cobra nada sin tu aceptación explícita.</p>
        </div>
        <LeadForm utm={utm} />
      </section>
      <footer className="site">CotizaFácil MX · <a href="/privacidad">Aviso de privacidad</a></footer>
    </main>
  );
}
