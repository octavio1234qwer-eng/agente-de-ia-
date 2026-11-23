"use client";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

// Paleta validada (scripts de dataviz, superficie #0a0c16): azul de marca para series únicas;
// categórica azul / naranja / verde para proveedores.
export const SERIES = "#3b74ff";
export const SERIES_ALT = "#8b5cf6";
export const CATEGORICAL = ["#3b74ff", "#e0702f", "#2aa676"];
/** El color sigue a la entidad, nunca a su posición en la lista. */
export const PROVIDER_COLOR: Record<string, string> = { stripe: "#3b74ff", mercadopago: "#e0702f", paypal: "#2aa676", free: "#5b6386" };
const GRID = "#1a1f35";
const AXIS = "#8b93b8";

const money = (cents: number, currency: string, compact = false) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency, notation: compact ? "compact" : "standard", maximumFractionDigits: compact ? 1 : 0 }).format(cents / 100);

function TooltipBox({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-ink-900/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <p className="text-mist-400">{title}</p>
      <p className="mt-0.5 font-semibold text-white">{value}</p>
    </div>
  );
}

export function RevenueArea({ data, currency }: { data: { label: string; cents: number; orders: number }[]; currency: string }) {
  return (
    <div className="h-64" role="img" aria-label="Ingresos por día">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES} stopOpacity={0.22} />
              <stop offset="100%" stopColor={SERIES} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={24} />
          <YAxis tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => money(v, currency, true)} allowDecimals={false} />
          <Tooltip
            cursor={{ stroke: AXIS, strokeWidth: 1 }}
            content={({ active, payload, label }) =>
              active && payload?.length ? <TooltipBox title={String(label)} value={`${money(Number(payload[0].value), currency)} · ${payload[0].payload.orders} pedidos`} /> : null
            }
          />
          <Area type="linear" dataKey="cents" stroke={SERIES} strokeWidth={2} fill="url(#rev)" activeDot={{ r: 5, stroke: "#0a0c16", strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MonthlyBars({ data, currency }: { data: { label: string; cents: number }[]; currency: string }) {
  return (
    <div className="h-64" role="img" aria-label="Ingresos por mes">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" minTickGap={16} />
          <YAxis tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => money(v, currency, true)} />
          <Tooltip cursor={{ fill: "rgb(255 255 255 / 0.04)" }} content={({ active, payload, label }) => (active && payload?.length ? <TooltipBox title={String(label)} value={money(Number(payload[0].value), currency)} /> : null)} />
          <Bar dataKey="cents" fill={SERIES} radius={[4, 4, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StudentsLine({ data }: { data: { label: string; students: number }[] }) {
  return (
    <div className="h-56" role="img" aria-label="Alumnos nuevos por mes">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" minTickGap={16} />
          <YAxis tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
          <Tooltip cursor={{ stroke: AXIS, strokeWidth: 1 }} content={({ active, payload, label }) => (active && payload?.length ? <TooltipBox title={String(label)} value={`${payload[0].value} alumnos nuevos`} /> : null)} />
          <Line type="linear" dataKey="students" stroke={SERIES_ALT} strokeWidth={2} dot={{ r: 4, fill: SERIES_ALT, stroke: "#0a0c16", strokeWidth: 2 }} activeDot={{ r: 6, stroke: "#0a0c16", strokeWidth: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TopCoursesBars({ data, currency }: { data: { title: string; cents: number; sales: number }[]; currency: string }) {
  return (
    <div style={{ height: Math.max(120, data.length * 44) }} role="img" aria-label="Cursos más vendidos por ingresos">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 72, left: 0, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="title" width={170} tick={{ fill: "#c9cee6", fontSize: 12 }} tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: "rgb(255 255 255 / 0.04)" }} content={({ active, payload }) => (active && payload?.length ? <TooltipBox title={String(payload[0].payload.title)} value={`${money(Number(payload[0].value), currency)} · ${payload[0].payload.sales} ventas`} /> : null)} />
          <Bar dataKey="cents" fill={SERIES} radius={[0, 4, 4, 0]} maxBarSize={20} label={{ position: "right", fill: "#c9cee6", fontSize: 11, formatter: (v: unknown) => money(Number(v), currency, true) }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
