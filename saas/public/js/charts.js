// Gráficas ligeras en SVG/HTML, sin librerías. Una sola serie por gráfica (un solo eje),
// barras de máximo 24px con extremo redondeado de 4px, rejilla discreta, tooltip por barra
// con teclado y ratón, y tabla alternativa para lectores de pantalla.
import { fmt, h, s } from './dom.js';

/** Escala con pasos enteros "redondos" (1, 2, 5, 10, 20, 50…) para que las marcas del eje sean exactas. */
function niceScale(value) {
  const raw = Math.max(value, 1) / 4;
  const exponent = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max([1, 2, 5, 10].map((m) => m * exponent).find((candidate) => candidate >= raw), 1);
  return { step, max: Math.max(Math.ceil(value / step), 1) * step };
}

function roundedTopBar(x, y, width, height) {
  if (height <= 0) return '';
  const r = Math.min(4, height, width / 2);
  const bottom = y + height;
  return `M${x},${bottom}V${y + r}A${r},${r} 0 0 1 ${x + r},${y}H${x + width - r}A${r},${r} 0 0 1 ${x + width},${y + r}V${bottom}Z`;
}

/**
 * Gráfica de columnas para series diarias.
 * data: [{ label: 'AAAA-MM-DD', value }], name: nombre de la medida (para tooltip y tabla).
 */
export function columnChart({ data, name, height = 200 }) {
  const root = h('div', { class: 'viz' });
  const tooltip = h('div', { class: 'viz-tooltip hidden', role: 'presentation' });
  const total = data.reduce((sum, d) => sum + d.value, 0);

  const draw = () => {
    const width = Math.max(root.clientWidth, 280);
    const margin = { top: 12, right: 8, bottom: 26, left: 34 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    const { step, max } = niceScale(Math.max(...data.map((d) => d.value), 0));
    const band = innerW / data.length;
    const barW = Math.max(Math.min(24, band - 2), 2);
    const y = (value) => margin.top + innerH - (value / max) * innerH;

    const svg = s('svg', { width, height, viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': `${name}: ${fmt.num(total)} en ${data.length} días` });
    for (let value = 0; value <= max; value += step) {
      const gy = y(value);
      svg.append(
        s('line', { class: value === 0 ? 'baseline' : 'gridline', x1: margin.left, x2: width - margin.right, y1: gy, y2: gy }),
        s('text', { x: margin.left - 6, y: gy + 4, 'text-anchor': 'end' }, fmt.num(value)),
      );
    }
    const labelEvery = Math.ceil(data.length / Math.max(Math.floor(innerW / 64), 1));
    data.forEach((d, index) => {
      const cx = margin.left + band * index + band / 2;
      const top = y(d.value);
      const hit = s('rect', {
        class: 'hit', x: cx - band / 2, y: margin.top, width: band, height: innerH, tabindex: 0,
        'aria-label': `${fmt.day(d.label)}: ${fmt.num(d.value)} ${name.toLowerCase()}`,
      });
      const show = () => {
        tooltip.replaceChildren(h('strong', { text: fmt.num(d.value) }), h('span', { text: `${name} · ${fmt.day(d.label)}` }));
        tooltip.style.top = `${Math.min(top, margin.top + innerH - 4)}px`;
        tooltip.classList.remove('hidden');
        // Se mantiene dentro de la tarjeta aunque la barra esté en un extremo.
        const half = tooltip.offsetWidth / 2;
        tooltip.style.left = `${Math.min(Math.max(cx, half + 2), width - half - 2)}px`;
      };
      const hide = () => tooltip.classList.add('hidden');
      hit.addEventListener('pointerenter', show);
      hit.addEventListener('focus', show);
      hit.addEventListener('pointerleave', hide);
      hit.addEventListener('blur', hide);
      svg.append(hit, s('path', { class: 'bar', d: roundedTopBar(cx - barW / 2, top, barW, margin.top + innerH - top) }));
      const isLast = index === data.length - 1;
      // La última etiqueta se alinea a la derecha para no salirse; se omite si chocaría con la anterior.
      if (index % labelEvery === 0 && !(isLast && index > 0)) {
        if (data.length - 1 - index < labelEvery / 2 && index !== 0) return;
        svg.append(s('text', { x: cx, y: height - 8, 'text-anchor': 'middle' }, fmt.day(d.label)));
      } else if (isLast) {
        svg.append(s('text', { x: Math.min(cx + barW / 2, width - 2), y: height - 8, 'text-anchor': 'end' }, fmt.day(d.label)));
      }
    });
    root.replaceChildren(svg, tooltip);
  };

  const observer = new ResizeObserver(() => draw());
  observer.observe(root);
  queueMicrotask(draw);

  const table = h('details', { class: 'viz-table' },
    h('summary', { text: 'Ver como tabla' }),
    h('div', { class: 'table-wrap' }, h('table', {},
      h('thead', {}, h('tr', {}, h('th', { text: 'Día' }), h('th', { class: 'num', text: name }))),
      h('tbody', {}, data.map((d) => h('tr', {}, h('td', { text: fmt.day(d.label) }), h('td', { class: 'num', text: fmt.num(d.value) })))))));
  return h('div', {}, root, table);
}

/** Barras horizontales por categoría con el valor escrito al final de cada barra. */
export function hbarChart({ data, format = fmt.num, empty = 'Sin datos todavía.' }) {
  if (!data.length) return h('p', { class: 'muted', text: empty });
  const max = Math.max(...data.map((d) => d.value), 1);
  return h('div', { class: 'hbars', role: 'list' }, data.map((d) => {
    const fill = h('span', { class: 'hbar-fill' });
    fill.style.width = `${Math.max((d.value / max) * 85, d.value ? 1 : 0)}%`;
    return h('div', { class: 'hbar', role: 'listitem', 'aria-label': `${d.label}: ${format(d.value)}` },
      h('span', { class: 'hbar-label', title: d.label, text: d.label }),
      h('span', { class: 'hbar-track' }, fill, h('span', { class: 'hbar-value', text: format(d.value) })));
  }));
}
