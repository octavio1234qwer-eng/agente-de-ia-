/** Gráficos SVG sin dependencias, renderizados en el servidor. */
type Datum = { label: string; value: number };

export function BarChart({ data, format = (n) => String(n), height = 180, color = "var(--accent)" }: { data: Datum[]; format?: (n: number) => string; height?: number; color?: string }) {
  if (!data.length || data.every((d) => d.value === 0)) return <div className="empty">Sin datos reales en el periodo.</div>;
  const w = 600, pad = 28, max = Math.max(...data.map((d) => d.value), 1);
  const bw = (w - pad * 2) / data.length;
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${height}`} width="100%" role="img" aria-label="Gráfico de barras">
      {data.map((d, i) => {
        const h = ((height - 44) * d.value) / max;
        const x = pad + i * bw + bw * 0.15, y = height - 24 - h;
        return (
          <g key={d.label}>
            <rect x={x} y={y} width={bw * 0.7} height={Math.max(h, d.value ? 2 : 0)} rx={4} fill={color} opacity={0.85}><title>{`${d.label}: ${format(d.value)}`}</title></rect>
            {d.value > 0 && <text x={x + bw * 0.35} y={y - 4} textAnchor="middle">{format(d.value)}</text>}
            <text x={x + bw * 0.35} y={height - 8} textAnchor="middle">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function LineChart({ data, height = 180, format = (n) => String(n) }: { data: Datum[]; height?: number; format?: (n: number) => string }) {
  if (!data.length || data.every((d) => d.value === 0)) return <div className="empty">Sin datos reales en el periodo.</div>;
  const w = 600, pad = 28, max = Math.max(...data.map((d) => d.value), 1);
  const step = data.length > 1 ? (w - pad * 2) / (data.length - 1) : 0;
  const pts = data.map((d, i) => [pad + i * step, height - 24 - ((height - 44) * d.value) / max] as const);
  const path = pts.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ");
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${height}`} width="100%" role="img" aria-label="Gráfico de línea">
      <defs><linearGradient id="lg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#5ee6ff" stopOpacity=".35" /><stop offset="1" stopColor="#5ee6ff" stopOpacity="0" /></linearGradient></defs>
      <path d={`${path} L${pts.at(-1)![0]},${height - 24} L${pts[0]![0]},${height - 24} Z`} fill="url(#lg)" />
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2} />
      {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3} fill="var(--accent)"><title>{`${data[i]!.label}: ${format(data[i]!.value)}`}</title></circle>)}
      {data.map((d, i) => (i % Math.ceil(data.length / 8) === 0 ? <text key={d.label} x={pts[i]![0]} y={height - 8} textAnchor="middle">{d.label}</text> : null))}
    </svg>
  );
}
