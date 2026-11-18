import { api, logout } from './api.js';
import { columnChart, hbarChart } from './charts.js';
import { $, applyBrand, busy, fmt, h, mount, toast } from './dom.js';

const state = { user: null, plans: [] };
const view = $('#view');

const NAV = [
  { href: '#/', label: 'Resumen', match: /^#\/?$/ },
  { href: '#/usuarios', label: 'Usuarios', match: /^#\/usuarios/ },
  { href: '#/pagos', label: 'Pagos', match: /^#\/pagos/ },
  { href: '#/auditoria', label: 'Auditoría', match: /^#\/auditoria/ },
];

function pageHead(title, subtitle, ...actions) {
  return h('div', { class: 'page-head' },
    h('div', {}, h('h1', { text: title }), subtitle ? h('p', { text: subtitle }) : null),
    actions.length ? h('div', { class: 'btn-row' }, actions) : null);
}

function table(columns, rows, { onRowClick, empty = 'Sin registros.' } = {}) {
  if (!rows.length) return h('div', { class: 'card empty', text: empty });
  return h('div', { class: 'table-wrap' }, h('table', {},
    h('thead', {}, h('tr', {}, columns.map((c) => h('th', { class: c.num ? 'num' : null, text: c.label })))),
    h('tbody', {}, rows.map((row) => {
      const tr = h('tr', { class: onRowClick ? 'clickable' : null, tabindex: onRowClick ? 0 : null },
        columns.map((c) => {
          const value = c.render(row);
          return h('td', { class: c.num ? 'num' : null }, value instanceof Node ? value : String(value ?? '—'));
        }));
      if (onRowClick) {
        tr.addEventListener('click', () => onRowClick(row));
        tr.addEventListener('keydown', (event) => { if (event.key === 'Enter') onRowClick(row); });
      }
      return tr;
    }))));
}

/** Importes separados por moneda: "$11,860 MXN · $480 USD" (nunca se suman monedas distintas). */
function byCurrency(map, pick) {
  const entries = Object.entries(map ?? {}).filter(([, value]) => pick(value) > 0);
  if (!entries.length) return fmt.cents(0, 'mxn');
  return entries.map(([currency, value]) => `${fmt.cents(pick(value), currency)} ${currency.toUpperCase()}`).join(' · ');
}

const LOCALE_NAMES = { es: 'Español', en: 'Inglés' };

function kpi(label, value, sub) {
  return h('div', { class: 'card kpi' }, h('div', { class: 'kpi-label', text: label }), h('div', { class: 'kpi-value', text: value }), sub ? h('div', { class: 'kpi-sub', text: sub }) : null);
}

function planBadge(plan) {
  const cls = plan.id === 'free' ? 'badge' : 'badge badge-brand';
  return h('span', { class: cls, text: `${plan.name}${plan.source === 'manual' ? ' (manual)' : ''}` });
}

function statusBadge(status) {
  return h('span', { class: `badge ${status === 'active' ? 'badge-success' : 'badge-danger'}`, text: status === 'active' ? 'Activo' : 'Suspendido' });
}

function renderChrome() {
  const hash = window.location.hash || '#/';
  mount($('#nav'),
    NAV.map((item) => h('a', { href: item.href, class: item.match.test(hash) ? 'active' : null, text: item.label })),
    h('a', { href: '/app', text: '← Volver a la app' }));
  mount($('#who'), `${state.user.name} · `, h('span', { class: 'badge badge-accent', text: 'Administrador' }));
  const out = h('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Cerrar sesión');
  out.addEventListener('click', logout);
  mount($('#top-actions'), out);
}

/* ---------- Resumen ---------- */

async function overview() {
  const [stats, system] = await Promise.all([api('/admin/stats'), api('/admin/system')]);
  const u = stats.usage30d;
  const warnings = system.warnings.map((w) => h('div', { class: 'alert alert-warning', text: w }));
  const refresh = h('button', { class: 'btn btn-secondary btn-sm', type: 'button' }, 'Actualizar');
  refresh.addEventListener('click', () => busy(refresh, 'Actualizando…', overview));

  mount(view,
    pageHead('Resumen', `Actualizado ${fmt.dateTime(stats.generatedAt)}`, refresh),
    warnings,
    h('div', { class: 'kpis' },
      kpi('Ingreso recurrente mensual (MRR)', byCurrency(stats.subscriptions.mrrByCurrency, (v) => v), `${fmt.num(stats.subscriptions.active)} suscripciones activas`),
      kpi('Cobrado últimos 30 días', byCurrency(stats.revenue.byCurrency, (v) => v.paid30dCents),
        `Histórico: ${byCurrency(stats.revenue.byCurrency, (v) => v.paidTotalCents)}`),
      kpi('Usuarios', fmt.num(stats.users.total), `+${fmt.num(stats.users.new7d)} en 7 días · +${fmt.num(stats.users.new30d)} en 30`),
      kpi('Conversión a pago', `${stats.conversionRate.toLocaleString('es-MX')}%`, `${fmt.num(stats.subscriptions.canceled30d)} cancelaciones en 30 días`),
      kpi('Generaciones (30 días)', fmt.num(u.generations), `${fmt.num(u.failed)} fallidas · ${fmt.num(u.activeUsers)} ${u.activeUsers === 1 ? 'usuario activo' : 'usuarios activos'}`),
      kpi('Costo de IA estimado (30 días)', u.costConfigured ? `US$${u.estimatedAiCostUsd.toLocaleString('es-MX')}` : '—',
        u.costConfigured ? `${fmt.num(u.inputTokens + u.outputTokens)} tokens` : 'Define AI_COST_* para estimarlo')),
    stats.subscriptions.pastDue ? h('div', { class: 'alert alert-warning', text: `${stats.subscriptions.pastDue} suscripciones con pago pendiente.` }) : null,
    h('div', { class: 'grid grid-2' },
      h('div', { class: 'card chart-card' }, h('h3', { text: 'Generaciones por día' }), h('div', { class: 'chart-sub', text: 'Últimos 30 días, hora del centro de México' }),
        columnChart({ data: stats.daily.map((d) => ({ label: d.day, value: d.generations })), name: 'Generaciones' })),
      h('div', { class: 'card chart-card' }, h('h3', { text: 'Registros por día' }), h('div', { class: 'chart-sub', text: 'Cuentas nuevas, últimos 30 días' }),
        columnChart({ data: stats.daily.map((d) => ({ label: d.day, value: d.signups })), name: 'Registros' }))),
    h('div', { class: 'grid grid-2 stack' },
      h('div', { class: 'card chart-card' }, h('h3', { text: 'Herramientas más usadas' }), h('div', { class: 'chart-sub', text: 'Usos en los últimos 30 días' }),
        hbarChart({ data: stats.topTools.map((t) => ({ label: t.name, value: t.uses })) })),
      h('div', { class: 'card chart-card' }, h('h3', { text: 'Usuarios por plan' }), h('div', { class: 'chart-sub', text: 'Plan vigente hoy' }),
        hbarChart({ data: stats.plans.map((p) => ({ label: p.name, value: p.users })) }),
        h('h3', { class: 'stack', text: 'Usuarios por idioma' }),
        hbarChart({ data: (stats.usersByLocale ?? []).map((row) => ({ label: LOCALE_NAMES[row.locale] ?? row.locale, value: row.users })) }))),
    h('div', { class: 'card stack' }, h('h3', { text: 'Sistema' }),
      h('dl', { class: 'kv' },
        h('dt', { text: 'Entorno' }), h('dd', { text: system.environment }),
        h('dt', { text: 'Base de datos' }), h('dd', { text: system.database }),
        h('dt', { text: 'IA' }), h('dd', { text: `${system.ai.provider} · ${system.ai.model}` }),
        h('dt', { text: 'Pagos (Stripe)' }), h('dd', { text: system.billingEnabled ? 'Habilitados' : 'Deshabilitados' }),
        h('dt', { text: 'Correo (SMTP)' }), h('dd', { text: system.emailEnabled ? 'Configurado' : 'Sin configurar' }),
        h('dt', { text: 'Latencia media de IA' }), h('dd', { text: `${fmt.num(u.avgLatencyMs)} ms` }))));
}

/* ---------- Usuarios ---------- */

async function usersView() {
  const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  const search = h('input', { type: 'search', placeholder: 'Buscar por correo, nombre o negocio', value: params.get('q') ?? '', 'aria-label': 'Buscar usuarios' });
  const plan = h('select', { 'aria-label': 'Plan' }, h('option', { value: '', text: 'Todos los planes' }), state.plans.map((p) => h('option', { value: p.id, text: p.name })));
  const status = h('select', { 'aria-label': 'Estado' }, h('option', { value: '', text: 'Todos los estados' }), h('option', { value: 'active', text: 'Activos' }), h('option', { value: 'suspended', text: 'Suspendidos' }));
  plan.value = params.get('plan') ?? '';
  status.value = params.get('status') ?? '';
  const results = h('div');
  const pager = h('div', { class: 'btn-row stack' });
  let page = 1;

  const load = async () => {
    const query = new URLSearchParams({ page: String(page) });
    if (search.value.trim()) query.set('q', search.value.trim());
    if (plan.value) query.set('plan', plan.value);
    if (status.value) query.set('status', status.value);
    const data = await api(`/admin/users?${query}`);
    mount(results, table([
      { label: 'Correo', render: (r) => r.email },
      { label: 'Nombre', render: (r) => r.name },
      { label: 'Negocio', render: (r) => r.businessName },
      { label: 'Plan', render: (r) => planBadge(r.plan) },
      { label: 'Créditos usados (mes)', num: true, render: (r) => fmt.num(r.usedThisMonth) },
      { label: 'Estado', render: (r) => statusBadge(r.status) },
      { label: 'Alta', render: (r) => fmt.date(r.createdAt) },
    ], data.items, { onRowClick: (r) => { window.location.hash = `#/usuarios/${r.id}`; }, empty: 'No hay usuarios con esos filtros.' }));
    const prev = h('button', { class: 'btn btn-secondary btn-sm', type: 'button', disabled: page === 1 }, '← Anterior');
    const next = h('button', { class: 'btn btn-secondary btn-sm', type: 'button', disabled: !data.hasMore }, 'Siguiente →');
    prev.addEventListener('click', () => { page -= 1; load(); });
    next.addEventListener('click', () => { page += 1; load(); });
    mount(pager, prev, h('span', { class: 'hint', text: `Página ${page}` }), next);
  };

  let timer;
  search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { page = 1; load(); }, 300); });
  plan.addEventListener('change', () => { page = 1; load(); });
  status.addEventListener('change', () => { page = 1; load(); });
  mount(view, pageHead('Usuarios', 'Busca una cuenta para ver su uso, cambiar su plan o suspenderla.'), h('div', { class: 'filters' }, search, plan, status), results, pager);
  await load();
}

async function userDetail(id) {
  const data = await api(`/admin/users/${id}`);
  const u = data.user;

  const act = (label, cls, fn) => {
    const button = h('button', { class: `btn btn-sm ${cls}`, type: 'button' }, label);
    button.addEventListener('click', () => busy(button, 'Guardando…', async () => {
      try {
        await fn();
        toast('Cambios guardados', 'success');
        await userDetail(id);
      } catch (error) {
        if (error.message !== 'Cancelado') toast(error.message, 'error');
      }
    }));
    return button;
  };
  const patch = (body) => api(`/admin/users/${id}`, { method: 'PATCH', body });

  const planSelect = h('select', { 'aria-label': 'Plan' }, state.plans.map((p) => h('option', { value: p.id, text: p.name })));
  planSelect.value = u.plan.id;
  const expires = h('input', { type: 'date', 'aria-label': 'Vence' });
  if (u.plan.expiresAt) expires.value = u.plan.expiresAt.slice(0, 10);

  const actions = [
    u.status === 'active'
      ? act('Suspender cuenta', 'btn-danger', () => {
        if (!window.confirm(`¿Suspender a ${u.email}? Se cerrarán sus sesiones.`)) throw new Error('Cancelado');
        return patch({ status: 'suspended' });
      })
      : act('Reactivar cuenta', 'btn-secondary', () => patch({ status: 'active' })),
    u.role === 'admin'
      ? act('Quitar administrador', 'btn-secondary', () => patch({ role: 'user' }))
      : act('Hacer administrador', 'btn-secondary', () => {
        if (!window.confirm(`¿Dar acceso de administrador a ${u.email}?`)) throw new Error('Cancelado');
        return patch({ role: 'admin' });
      }),
    act('Reiniciar créditos del mes', 'btn-secondary', () => api(`/admin/users/${id}/reset-usage`, { method: 'POST' })),
    u.emailVerified ? null : act('Marcar correo como confirmado', 'btn-secondary', () => api(`/admin/users/${id}/verify-email`, { method: 'POST' })),
  ];

  mount(view,
    h('a', { class: 'back', href: '#/usuarios' }, '← Usuarios'),
    pageHead(u.name, u.email),
    h('div', { class: 'grid grid-2' },
      h('div', { class: 'card' }, h('h3', { text: 'Cuenta' }),
        h('dl', { class: 'kv' },
          h('dt', { text: 'Negocio' }), h('dd', { text: u.businessName ?? '—' }),
          h('dt', { text: 'Estado' }), h('dd', {}, statusBadge(u.status)),
          h('dt', { text: 'Rol' }), h('dd', { text: u.role === 'admin' ? 'Administrador' : 'Usuario' }),
          h('dt', { text: 'Correo' }), h('dd', { text: u.emailVerified ? 'Confirmado' : 'Sin confirmar' }),
          h('dt', { text: 'Plan' }), h('dd', {}, planBadge(u.plan), u.plan.expiresAt ? ` vence ${fmt.date(u.plan.expiresAt)}` : ''),
          h('dt', { text: 'Créditos' }), h('dd', { text: `${fmt.num(data.usage.used)} de ${fmt.num(data.usage.limit)} (${data.usage.period})` }),
          h('dt', { text: 'Cliente en Stripe' }), h('dd', { text: u.stripeCustomer ? 'Sí' : 'No' }),
          h('dt', { text: 'Sesiones activas' }), h('dd', { text: fmt.num(u.activeSessions) }),
          h('dt', { text: 'Intentos fallidos' }), h('dd', { text: fmt.num(u.failedLogins) }),
          h('dt', { text: 'Alta' }), h('dd', { text: fmt.dateTime(u.createdAt) }),
          h('dt', { text: 'Último acceso' }), h('dd', { text: fmt.dateTime(u.lastLoginAt) })),
        h('div', { class: 'btn-row stack' }, actions)),
      h('div', { class: 'card' }, h('h3', { text: 'Asignar plan manualmente' }),
        h('p', { class: 'hint', text: 'Útil para pagos por transferencia u OXXO, cortesías o pruebas. Si el usuario tiene una suscripción en Stripe, el siguiente evento de Stripe puede reemplazar este cambio.' }),
        h('div', { class: 'field' }, h('label', { class: 'label', text: 'Plan' }), planSelect),
        h('div', { class: 'field' }, h('label', { class: 'label', text: 'Vence (opcional)' }), expires, h('span', { class: 'help', text: 'Al vencer, la cuenta regresa automáticamente a Gratis.' })),
        act('Guardar plan', '', () => patch({ planId: planSelect.value, planExpiresAt: expires.value || null })))),
    h('h3', { class: 'stack', text: 'Actividad reciente' }),
    h('p', { class: 'hint', text: 'Solo metadatos: el contenido que escribe cada usuario es privado.' }),
    table([
      { label: 'Fecha', render: (r) => fmt.dateTime(r.created_at) },
      { label: 'Herramienta', render: (r) => r.toolName },
      { label: 'Estado', render: (r) => (r.status === 'succeeded' ? 'Correcta' : `Fallida (${r.error_code ?? 'error'})`) },
      { label: 'Créditos', num: true, render: (r) => r.credits },
      { label: 'Tokens', num: true, render: (r) => fmt.num(r.input_tokens + r.output_tokens) },
      { label: 'Latencia', num: true, render: (r) => `${fmt.num(r.latency_ms)} ms` },
    ], data.recentGenerations, { empty: 'Todavía no usa herramientas.' }),
    h('div', { class: 'grid grid-2 stack' },
      h('div', {}, h('h3', { text: 'Suscripciones' }), table([
        { label: 'Plan', render: (r) => r.plan_id },
        { label: 'Estado', render: (r) => r.status },
        { label: 'Monto mensual', num: true, render: (r) => fmt.cents(r.amount_cents, r.currency) },
        { label: 'Periodo hasta', render: (r) => fmt.date(r.current_period_end) },
      ], data.subscriptions, { empty: 'Sin suscripciones.' })),
      h('div', {}, h('h3', { text: 'Pagos' }), table([
        { label: 'Fecha', render: (r) => fmt.date(r.paid_at) },
        { label: 'Monto', num: true, render: (r) => fmt.cents(r.amount_cents, r.currency) },
      ], data.payments, { empty: 'Sin pagos.' }))));
}

/* ---------- Pagos y auditoría ---------- */

async function paymentsView() {
  const data = await api('/admin/payments');
  mount(view, pageHead('Pagos', 'Cobros confirmados por Stripe (eventos invoice.paid).'), table([
    { label: 'Fecha', render: (r) => fmt.dateTime(r.paid_at) },
    { label: 'Usuario', render: (r) => r.email ?? '(cuenta eliminada)' },
    { label: 'Monto', num: true, render: (r) => fmt.cents(r.amount_cents, r.currency) },
    { label: 'Moneda', render: (r) => r.currency.toUpperCase() },
    { label: 'Factura Stripe', render: (r) => r.provider_invoice_id },
  ], data.items, { onRowClick: (r) => { if (r.user_id) window.location.hash = `#/usuarios/${r.user_id}`; }, empty: 'Aún no hay pagos.' }));
}

const ACTIONS = {
  'admin.user_updated': 'Usuario modificado',
  'admin.usage_reset': 'Créditos reiniciados',
  'admin.email_verified': 'Correo confirmado manualmente',
  'account.deleted': 'Cuenta eliminada por el usuario',
  'cli.admin_promoted': 'Administrador creado por consola',
};

async function auditView() {
  const data = await api('/admin/audit');
  mount(view, pageHead('Auditoría', 'Registro de acciones administrativas y eliminaciones de cuenta.'), table([
    { label: 'Fecha', render: (r) => fmt.dateTime(r.created_at) },
    { label: 'Acción', render: (r) => ACTIONS[r.action] ?? r.action },
    { label: 'Quién', render: (r) => r.actor_email ?? 'Sistema / usuario' },
    { label: 'Cuenta', render: (r) => r.target_email },
    { label: 'Detalle', render: (r) => (Object.keys(r.details ?? {}).length ? JSON.stringify(r.details) : '—') },
  ], data.items, { empty: 'Sin acciones registradas.' }));
}

/* ---------- Enrutador ---------- */

const routes = [
  [/^#?\/?$/, overview],
  [/^#\/usuarios(\?.*)?$/, usersView],
  [/^#\/usuarios\/([0-9a-f-]{36})$/, userDetail],
  [/^#\/pagos$/, paymentsView],
  [/^#\/auditoria$/, auditView],
];

async function router() {
  const hash = window.location.hash || '#/';
  renderChrome();
  const route = routes.find(([pattern]) => pattern.test(hash));
  if (!route) return mount(view, h('div', { class: 'card empty', text: 'Sección no encontrada.' }));
  try {
    const match = hash.match(route[0]);
    await route[1](...match.slice(1).filter((part) => part && !part.startsWith('?')));
  } catch (error) {
    if (error.status === 401) return window.location.assign('/entrar?next=%2Fadmin');
    if (error.message !== 'Cancelado') mount(view, h('div', { class: 'alert alert-error', text: error.message }));
  }
  window.scrollTo(0, 0);
}

async function start() {
  try {
    const [me, plans] = await Promise.all([api('/auth/me'), api('/plans')]);
    if (me.user.role !== 'admin') return window.location.replace('/app');
    state.user = me.user;
    state.plans = plans.plans;
    applyBrand(plans.appName);
  } catch (error) {
    if (error.status === 401) return window.location.assign('/entrar?next=%2Fadmin');
    return mount(view, h('div', { class: 'alert alert-error', text: error.message }));
  }
  window.addEventListener('hashchange', router);
  router();
}

start();
