import type { Metadata } from "next";
import Link from "next/link";
import { Award, CreditCard, Percent, ShoppingBag, TrendingUp, UserPlus, Users, Wallet } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { PROVIDER_COLOR, ActivityBars, MonthlyBars, RevenueArea, StudentsLine, TopCoursesBars, WeeklyActiveLine } from "@/components/admin/charts";
import { cn, formatMoney, providerLabel } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

type Stats = {
  currency: string;
  total_revenue_cents: number;
  period_revenue_cents: number;
  paid_orders: number;
  period_paid_orders: number;
  period_checkouts: number;
  conversion_rate: number;
  refunded_cents: number;
  students_total: number;
  students_new: number;
  active_learners: number;
  enrollments_total: number;
  certificates_total: number;
  daily: { day: string; revenue_cents: number; orders: number }[];
  monthly: { month: string; revenue_cents: number; orders: number }[];
  students_monthly: { month: string; students: number }[];
  top_courses: { course_id: string; title: string; sales: number; revenue_cents: number }[];
  providers: { provider: string; orders: number; revenue_cents: number }[];
};

type Activity = {
  today: string;
  active_today: number;
  active_7d: number;
  active_period: number;
  lessons_period: number;
  avg_days: number;
  daily: { day: string; students: number; lessons: number }[];
  weekly: { week: string; students: number }[];
};

const periods = [7, 30, 90] as const;
const dayLabel = (d: string) => new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(d));
const monthLabel = (d: string) => new Intl.DateTimeFormat("es-MX", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(d));

function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="mt-3 text-xs">
      <summary className="cursor-pointer text-mist-400 hover:text-white">Ver datos en tabla</summary>
      <div className="mt-2 max-h-56 overflow-auto rounded-xl border border-white/[0.06]">
        <table className="w-full text-left">
          <thead className="sticky top-0 bg-ink-850 text-mist-400"><tr>{head.map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-white/[0.05] text-mist-200">{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="px-3 py-1.5">{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </details>
  );
}

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  await requireAdmin();
  const { dias } = await searchParams;
  const days = periods.find((p) => String(p) === dias) ?? 30;
  const supabase = await createClient();
  const [{ data, error }, { data: activityData, error: activityError }, { data: pendingQuestions }] = await Promise.all([
    supabase.rpc("admin_dashboard_stats", { p_days: days }),
    supabase.rpc("admin_learning_activity", { p_days: days }),
    supabase.rpc("admin_lesson_questions", { p_filter: "unanswered", p_limit: 500 }),
  ]);
  const unanswered = pendingQuestions?.length ?? 0;
  if (error || !data || activityError || !activityData) return <p className="text-red-300">No se pudieron cargar las métricas.</p>;
  const s = data as unknown as Stats;
  const act = activityData as unknown as Activity;
  const cur = s.currency || "MXN";

  const kpis = [
    { label: "Ingresos totales (netos)", value: formatMoney(s.total_revenue_cents, cur), icon: Wallet, hint: s.refunded_cents > 0 ? `Reembolsado: ${formatMoney(s.refunded_cents, cur)}` : "Sin reembolsos" },
    { label: `Ingresos · ${days} días`, value: formatMoney(s.period_revenue_cents, cur), icon: TrendingUp, hint: `${s.period_paid_orders} pedidos pagados` },
    { label: "Pedidos pagados", value: s.paid_orders.toLocaleString("es-MX"), icon: ShoppingBag, hint: "Histórico" },
    { label: "Tasa de conversión", value: `${s.conversion_rate}%`, icon: Percent, hint: `${s.period_paid_orders} de ${s.period_checkouts} checkouts (${days} días)` },
    { label: "Alumnos", value: s.students_total.toLocaleString("es-MX"), icon: Users, hint: `+${s.students_new} en ${days} días` },
    { label: "Aprendiendo activamente", value: act.active_period.toLocaleString("es-MX"), icon: UserPlus, hint: `Estudiaron en los últimos ${days} días` },
    { label: "Inscripciones activas", value: s.enrollments_total.toLocaleString("es-MX"), icon: CreditCard, hint: "Gratis + pagadas" },
    { label: "Certificados emitidos", value: s.certificates_total.toLocaleString("es-MX"), icon: Award, hint: "Histórico" },
  ];
  const providerTotal = s.providers.reduce((t, p) => t + p.revenue_cents, 0);

  return (
    <>
      <AdminHeader
        title="Dashboard"
        description="Métricas calculadas en tiempo real a partir de pedidos y alumnos reales."
        actions={
          <div className="flex rounded-xl border border-white/10 p-1" role="group" aria-label="Periodo">
            {periods.map((p) => (
              <Link key={p} href={`/admin?dias=${p}`} aria-current={p === days ? "true" : undefined} className={cn("rounded-lg px-3 py-1.5 text-sm", p === days ? "bg-white/[0.08] text-white" : "text-mist-400 hover:text-white")}>
                {p} días
              </Link>
            ))}
          </div>
        }
      />
      {unanswered > 0 && (
        <Link href="/admin/preguntas" className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-amber-400/25 bg-amber-500/10 px-5 py-3 text-sm text-amber-100 hover:bg-amber-500/15">
          <span>{unanswered === 1 ? "1 pregunta de alumno espera respuesta" : `${unanswered >= 500 ? "500+" : unanswered} preguntas de alumnos esperan respuesta`}</span>
          <span className="font-medium text-white">Responder →</span>
        </Link>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(({ label, value, icon: Icon, hint }) => (
          <div key={label} className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between text-mist-400"><p className="text-xs">{label}</p><Icon className="size-4" aria-hidden /></div>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</p>
            <p className="mt-1 text-xs text-mist-400">{hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="Ventas diarias" subtitle={`Ingresos netos por día · últimos ${days} días (hora de CDMX)`}>
          <RevenueArea data={s.daily.map((d) => ({ label: dayLabel(d.day), cents: d.revenue_cents, orders: d.orders }))} currency={cur} />
          <DataTable head={["Día", "Ingresos", "Pedidos"]} rows={s.daily.map((d) => [dayLabel(d.day), formatMoney(d.revenue_cents, cur), d.orders])} />
        </Panel>
        <Panel title="Ventas mensuales" subtitle="Ingresos netos · últimos 12 meses">
          <MonthlyBars data={s.monthly.map((m) => ({ label: monthLabel(m.month), cents: m.revenue_cents }))} currency={cur} />
          <DataTable head={["Mes", "Ingresos", "Pedidos"]} rows={s.monthly.map((m) => [monthLabel(m.month), formatMoney(m.revenue_cents, cur), m.orders])} />
        </Panel>
        <Panel title="Alumnos nuevos" subtitle="Registros por mes · últimos 12 meses">
          <StudentsLine data={s.students_monthly.map((m) => ({ label: monthLabel(m.month), students: m.students }))} />
          <DataTable head={["Mes", "Alumnos nuevos"]} rows={s.students_monthly.map((m) => [monthLabel(m.month), m.students])} />
        </Panel>
        <Panel title="Cursos más vendidos" subtitle="Por ingresos (excluye pedidos reembolsados por completo)">
          {s.top_courses.length ? (
            <>
              <TopCoursesBars data={s.top_courses.map((t) => ({ title: t.title, cents: t.revenue_cents, sales: t.sales }))} currency={cur} />
              <DataTable head={["Curso", "Ventas", "Ingresos"]} rows={s.top_courses.map((t) => [t.title, t.sales, formatMoney(t.revenue_cents, cur)])} />
            </>
          ) : (
            <p className="py-10 text-center text-sm text-mist-400">Aún no hay ventas de cursos.</p>
          )}
        </Panel>
      </div>

      <Panel className="mt-4" title="Actividad de estudio" subtitle={`Alumnos que avanzaron un video, marcaron una lección, presentaron una evaluación o guardaron una nota · hora de CDMX`}>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5" data-testid="activity-summary">
          {[
            ["Hoy", act.active_today.toLocaleString("es-MX")],
            ["Últimos 7 días", act.active_7d.toLocaleString("es-MX")],
            [`Últimos ${days} días`, act.active_period.toLocaleString("es-MX")],
            ["Lecciones completadas", act.lessons_period.toLocaleString("es-MX")],
            ["Días de estudio por alumno", Number(act.avg_days).toLocaleString("es-MX", { maximumFractionDigits: 1 })],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-white/[0.03] px-4 py-3">
              <dt className="text-xs text-mist-400">{k}</dt>
              <dd className="mt-1 text-xl font-semibold text-white">{v}</dd>
            </div>
          ))}
        </dl>
        {act.active_period === 0 && <p className="mt-4 text-sm text-mist-400">Aún no hay actividad de estudio en este periodo.</p>}
        <div className="mt-5 grid gap-6 xl:grid-cols-2">
          <div>
            <h3 className="text-sm font-medium text-white">Alumnos que estudiaron por día</h3>
            <ActivityBars data={act.daily.map((d) => ({ label: dayLabel(d.day), students: d.students, lessons: d.lessons }))} />
            <DataTable head={["Día", "Alumnos", "Lecciones completadas"]} rows={act.daily.map((d) => [dayLabel(d.day), d.students, d.lessons])} />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">Alumnos activos por semana</h3>
            <WeeklyActiveLine data={act.weekly.map((w) => ({ label: dayLabel(w.week), students: w.students }))} />
            <DataTable head={["Semana (desde el lunes)", "Alumnos activos"]} rows={act.weekly.map((w) => [dayLabel(w.week), w.students])} />
          </div>
        </div>
      </Panel>

      <Panel className="mt-4" title="Ingresos por método de pago" subtitle="Histórico, netos de reembolsos">
        {s.providers.length ? (
          <ul className="space-y-3">
            {s.providers.map((p) => {
              const pct = providerTotal ? Math.round((p.revenue_cents / providerTotal) * 100) : 0;
              return (
                <li key={p.provider} className="grid grid-cols-[160px_1fr_auto] items-center gap-3 text-sm">
                  <span className="flex items-center gap-2 text-mist-200"><span className="size-2.5 rounded-sm" style={{ background: PROVIDER_COLOR[p.provider] }} aria-hidden />{providerLabel[p.provider] ?? p.provider}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-white/[0.05]"><span className="block h-full rounded-full" style={{ width: `${pct}%`, background: PROVIDER_COLOR[p.provider] }} /></span>
                  <span className="text-right text-mist-200">{formatMoney(p.revenue_cents, cur)} · {p.orders} pedidos · {pct}%</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="py-6 text-center text-sm text-mist-400">Sin pagos registrados todavía.</p>
        )}
      </Panel>
    </>
  );
}
