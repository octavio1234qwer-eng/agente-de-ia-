import { requireUser } from "@/lib/server";
import { Badge, Section, Table } from "@/components/ui";
export const dynamic = "force-dynamic";
const VARS: [string, string, string][] = [
  ["DATABASE_URL", "Base de datos (Supabase)", "Obligatoria en producción"],
  ["SESSION_SECRET", "Secreto de sesiones/hashes", "Obligatoria"],
  ["CRON_SECRET", "Autenticación de rutinas", "Obligatoria para cron"],
  ["ANALYTICS_SALT", "Sal para anonimizar visitas", "Recomendada"],
  ["MP_ACCESS_TOKEN", "Mercado Pago — cobros", "Requiere autorización del propietario"],
  ["MP_WEBHOOK_SECRET", "Mercado Pago — firma de webhooks", "Con MP"],
  ["GUMROAD_ACCESS_TOKEN", "Gumroad — lectura de ventas", "Opcional"],
  ["MAIL_HOST", "SMTP — envío de correos", "Opcional"],
  ["ANTHROPIC_API_KEY", "Claude API (servicio de pago)", "ROJO: requiere autorización"],
  ["NEXT_PUBLIC_GA_ID", "Google Analytics 4", "Opcional"],
];
export default async function Settings() {
  await requireUser();
  return (<><h1>Configuración</h1>
    <Section title="Integraciones (solo se muestra si están configuradas, nunca su valor)">
      <Table rows={VARS} cols={[
        { h: "Variable", c: ([k]) => <span className="mono">{k}</span> }, { h: "Para qué", c: ([, d]) => d }, { h: "Nota", c: ([, , n]) => <span className="muted">{n}</span> },
        { h: "Estado", c: ([k]) => <Badge v={process.env[k] ? "ok" : "pending"} /> },
      ]} />
    </Section>
    <Section title="Política financiera"><p>Presupuesto inicial $500 MXN. Sin reinversión automática. Ver <span className="mono">FINANCIAL_RULES.md</span>.</p></Section></>);
}
