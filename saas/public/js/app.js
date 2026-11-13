import { api, logout } from './api.js';
import { $, applyBrand, busy, clearErrors, copyText, fmt, h, mount, showErrors, toast } from './dom.js';
import { planCard } from './landing.js';

const state = { user: null, tools: [], config: null };
const view = $('#view');
const params = new URLSearchParams(window.location.search);

/* ---------- Utilidades de interfaz ---------- */

function firstName(name) {
  return String(name ?? '').trim().split(/\s+/)[0] || 'de nuevo';
}

function meter(used, limit) {
  const pct = limit ? Math.min((used / limit) * 100, 100) : 100;
  const fill = h('span');
  fill.style.width = `${pct}%`;
  return h('div', { class: `meter${pct >= 80 ? ' warn' : ''}`, role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': limit, 'aria-valuenow': used, 'aria-label': 'Créditos usados' }, fill);
}

function pageHead(title, subtitle, ...actions) {
  return h('div', { class: 'page-head' },
    h('div', {}, h('h1', { text: title }), subtitle ? h('p', { text: subtitle }) : null),
    actions.length ? h('div', { class: 'btn-row' }, actions) : null);
}

function field({ name, label, type = 'text', required, help, placeholder, maxLength, options, autocomplete, value }) {
  const id = `f-${name}`;
  let control;
  if (type === 'textarea') {
    control = h('textarea', { id, name, placeholder, maxlength: maxLength, required, class: maxLength > 5000 ? 'tall' : null });
  } else if (type === 'select') {
    control = h('select', { id, name, required },
      required ? null : h('option', { value: '', text: '— Opcional —' }),
      options.map((option) => h('option', { value: option, text: option })));
  } else {
    control = h('input', { id, name, type, placeholder, maxlength: maxLength, required, autocomplete });
  }
  if (value !== undefined && value !== null) control.value = value;
  const counter = maxLength && type !== 'select' ? h('span', { class: 'counter' }) : null;
  if (counter) {
    const update = () => {
      counter.textContent = `${fmt.num(control.value.length)} / ${fmt.num(maxLength)}`;
      counter.classList.toggle('over', control.value.length > maxLength);
    };
    control.addEventListener('input', update);
    update();
  }
  return h('div', { class: 'field' },
    h('label', { for: id, text: label }),
    control,
    (help || counter) ? h('div', { class: 'field-meta' }, h('span', { class: 'help', text: help ?? '' }), counter) : null,
    h('div', { class: 'field-error', 'data-error-for': name }));
}

function formValues(form) {
  return Object.fromEntries([...form.elements].filter((el) => el.name).map((el) => [el.name, el.value]));
}

function errorBox() {
  return h('div', { class: 'alert alert-error hidden', 'data-form-error': '', role: 'alert' });
}

function verifyBanner() {
  if (state.user.emailVerified || !state.config?.requireEmailVerification) return null;
  const button = h('button', { class: 'btn btn-sm btn-secondary', type: 'button' }, 'Reenviar enlace');
  button.addEventListener('click', () => busy(button, 'Enviando…', async () => {
    try {
      await api('/auth/resend-verification', { method: 'POST' });
      toast(`Te enviamos un nuevo enlace a ${state.user.email}.`, 'success');
    } catch (error) {
      toast(error.message, 'error');
    }
  }));
  return h('div', { class: 'alert alert-warning' },
    h('div', {}, h('strong', { text: 'Confirma tu correo para usar las herramientas. ' }),
      `Enviamos un enlace a ${state.user.email}. Revisa también tu carpeta de spam.`),
    button);
}

/* ---------- Estructura (menú, créditos, sesión) ---------- */

const NAV = [
  { href: '#/', label: 'Herramientas', match: /^#\/(herramienta\/.*)?$/ },
  { href: '#/historial', label: 'Historial', match: /^#\/historial/ },
  { href: '#/planes', label: 'Planes y pagos', match: /^#\/planes/ },
  { href: '#/cuenta', label: 'Mi cuenta', match: /^#\/cuenta/ },
];

function renderChrome() {
  const hash = window.location.hash || '#/';
  const user = state.user;
  mount($('#nav'),
    NAV.map((item) => h('a', { href: item.href, class: item.match.test(hash) ? 'active' : null, 'aria-current': item.match.test(hash) ? 'page' : null, text: item.label })),
    user.role === 'admin' ? h('a', { href: '/admin', text: 'Administración' }) : null);
  const { usage, plan } = user;
  mount($('#sidebar-bottom'),
    h('div', { class: 'credits-mini' },
      h('div', {}, h('strong', { text: `${fmt.num(usage.remaining)} créditos` }), ' disponibles'),
      meter(usage.used, usage.limit),
      h('div', { class: 'hint', text: `Plan ${plan.name} · se renuevan el ${fmt.date(`${usage.resetsOn}T12:00:00`)}` })),
    plan.id === 'free' ? h('a', { class: 'btn btn-accent btn-sm', href: '#/planes' }, 'Mejorar plan') : null);
  mount($('#who'), `${user.name} · `, h('span', { class: 'badge badge-brand', text: `Plan ${plan.name}` }));
  const out = h('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Cerrar sesión');
  out.addEventListener('click', logout);
  mount($('#top-actions'), out);
}

async function refreshUser() {
  const previousPlan = state.user?.plan.id;
  state.user = (await api('/auth/me')).user;
  // Si cambió el plan, cambian las herramientas desbloqueadas y los límites de texto.
  if (previousPlan !== state.user.plan.id) state.tools = (await api('/tools')).tools;
  renderChrome();
}

/* ---------- Vistas ---------- */

async function home() {
  const { user } = state;
  const welcome = params.get('bienvenida') ? h('div', { class: 'alert alert-success' },
    h('strong', { text: '¡Bienvenido! ' }), 'Elige una herramienta y usa el botón "Probar con un ejemplo" para ver cómo funciona.') : null;
  const groups = state.tools.map((tool) => h('a', {
    class: `card tool-card${tool.locked ? ' locked' : ''}`, href: `#/herramienta/${tool.id}`,
  },
  h('div', { class: 'meta' },
    h('span', { class: 'badge', text: tool.category }),
    tool.premium ? h('span', { class: 'badge badge-accent', text: tool.locked ? 'Pro · bloqueada' : 'Pro' }) : null,
    h('span', { class: 'hint', text: `${tool.credits} crédito${tool.credits > 1 ? 's' : ''}` })),
  h('h3', { text: tool.name }),
  h('p', { text: tool.description })));

  mount(view,
    pageHead(`Hola, ${firstName(user.name)}`, '¿Qué necesitas resolver hoy?'),
    verifyBanner(),
    welcome,
    h('div', { class: 'card' }, h('div', { class: 'field-meta' },
      h('strong', { text: `Créditos de este mes: ${fmt.num(user.usage.used)} de ${fmt.num(user.usage.limit)} usados` }),
      h('span', { class: 'hint', text: `Se renuevan el ${fmt.date(`${user.usage.resetsOn}T12:00:00`)}` })),
    h('div', { class: 'stack' }, meter(user.usage.used, user.usage.limit)),
    user.plan.id === 'free' ? h('p', { class: 'hint' }, '¿Necesitas más créditos o las herramientas Pro? ', h('a', { href: '#/planes', text: 'Mira los planes' })) : null),
    h('h2', { class: 'sr-only', text: 'Herramientas' }),
    h('div', { class: 'grid grid-3 stack' }, groups));
}

async function toolView(id) {
  const tool = state.tools.find((item) => item.id === id);
  if (!tool) return notFound();
  const back = h('a', { class: 'back', href: '#/' }, '← Todas las herramientas');
  const head = pageHead(tool.name, tool.description);

  if (tool.locked) {
    return mount(view, back, head, h('div', { class: 'card' },
      h('h3', { text: 'Disponible en los planes de pago' }),
      h('p', { class: 'muted', text: `Mejora a Pro para usar "${tool.name}" y todas las herramientas, con más créditos al mes.` }),
      h('a', { class: 'btn btn-accent', href: '#/planes' }, 'Ver planes')));
  }

  const prefill = JSON.parse(sessionStorage.getItem(`prefill:${tool.id}`) ?? 'null');
  sessionStorage.removeItem(`prefill:${tool.id}`);
  const form = h('form', { novalidate: true }, errorBox(),
    tool.fields.map((f) => field({ ...f, value: prefill?.[f.name] })));
  const totalHint = h('p', { class: 'hint' });
  const updateTotal = () => {
    const total = Object.values(formValues(form)).reduce((sum, value) => sum + value.length, 0);
    totalHint.textContent = `${fmt.num(total)} de ${fmt.num(state.user.plan.maxInputChars)} caracteres permitidos por solicitud en tu plan.`;
  };
  form.addEventListener('input', updateTotal);
  updateTotal();

  const submit = h('button', { class: 'btn', type: 'submit' }, 'Generar');
  const example = h('button', { class: 'btn btn-secondary', type: 'button' }, 'Probar con un ejemplo');
  example.addEventListener('click', () => {
    for (const [name, value] of Object.entries(tool.example ?? {})) {
      const el = form.elements.namedItem(name);
      if (el) {
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  });
  form.append(totalHint, h('div', { class: 'btn-row' }, submit, example,
    h('span', { class: 'hint', text: `Usa ${tool.credits} crédito${tool.credits > 1 ? 's' : ''}` })));

  const output = h('div', { class: 'card', 'aria-live': 'polite' },
    h('h3', { text: 'Resultado' }),
    h('div', { class: 'output-empty' }, 'Llena el formulario y presiona "Generar". Tu resultado aparecerá aquí y se guardará en tu historial.'));

  const showResult = (generation) => {
    const copy = h('button', { class: 'btn btn-sm', type: 'button' }, 'Copiar');
    copy.addEventListener('click', () => copyText(generation.output));
    const again = h('button', { class: 'btn btn-sm btn-secondary', type: 'button' }, 'Generar otra versión');
    again.addEventListener('click', () => form.requestSubmit());
    mount(output,
      h('div', { class: 'field-meta' }, h('h3', { text: 'Resultado' }), h('span', { class: 'hint', text: `${generation.credits} crédito${generation.credits > 1 ? 's' : ''} usado${generation.credits > 1 ? 's' : ''}` })),
      h('div', { class: 'output', tabindex: 0, text: generation.output }),
      h('p', { class: 'hint', text: 'Revisa cifras, fechas y los datos entre corchetes antes de enviarlo.' }),
      h('div', { class: 'btn-row' }, copy, again, h('a', { class: 'btn btn-sm btn-ghost', href: '#/historial' }, 'Ver historial')));
  };

  const showProblem = (error) => {
    const actions = [];
    if (['quota_exceeded', 'upgrade_required'].includes(error.code)) actions.push(h('a', { class: 'btn btn-accent btn-sm', href: '#/planes' }, 'Ver planes'));
    mount(output, h('h3', { text: 'Resultado' }), h('div', { class: `alert ${error.status === 402 || error.status === 403 ? 'alert-warning' : 'alert-error'}` },
      h('div', { text: error.message }), actions.length ? h('div', { class: 'btn-row' }, actions) : null));
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors(form);
    mount(output, h('h3', { text: 'Resultado' }), h('div', { class: 'loading output-empty' }, h('span', { class: 'spinner dark' }), 'Generando, suele tardar de 5 a 30 segundos…'));
    try {
      const result = await busy(submit, 'Generando…', () => api(`/tools/${tool.id}/run`, { method: 'POST', body: { input: formValues(form) } }));
      showResult(result.generation);
      state.user.usage = result.usage;
      renderChrome();
    } catch (error) {
      if (error.status === 401) return redirectToLogin();
      if (error.fields) {
        showErrors(form, error);
        mount(output, h('h3', { text: 'Resultado' }), h('div', { class: 'output-empty', text: 'Corrige los campos marcados.' }));
      } else {
        showProblem(error);
      }
    }
  });

  mount(view, back, head, verifyBanner(), h('div', { class: 'tool-layout' }, h('div', { class: 'card' }, form), output));
}

async function historyView() {
  const filter = h('select', { 'aria-label': 'Filtrar por herramienta' },
    h('option', { value: '', text: 'Todas las herramientas' }),
    state.tools.map((tool) => h('option', { value: tool.id, text: tool.name })));
  filter.value = params.get('tool') ?? '';
  const list = h('div', { class: 'list' });
  const more = h('button', { class: 'btn btn-secondary hidden', type: 'button' }, 'Cargar más');
  const note = h('p', { class: 'hint' });
  let page = 1;

  const load = async (reset) => {
    if (reset) {
      page = 1;
      list.replaceChildren();
    }
    const query = new URLSearchParams({ page: String(page) });
    if (filter.value) query.set('tool', filter.value);
    const data = await api(`/generations?${query}`);
    note.textContent = `Tu plan guarda el historial ${fmt.num(data.historyDays)} días. Después se borra el contenido automáticamente.`;
    if (reset && !data.items.length) {
      list.append(h('div', { class: 'card empty' }, h('p', { text: 'Aún no hay resultados guardados.' }), h('a', { class: 'btn', href: '#/' }, 'Usar una herramienta')));
    }
    for (const item of data.items) {
      list.append(h('a', { class: 'list-item', href: `#/historial/${item.id}` },
        h('div', {}, h('div', { class: 'title', text: item.title || item.toolName }), h('div', { class: 'sub', text: `${item.toolName} · ${fmt.dateTime(item.createdAt)}` })),
        h('span', { class: 'hint', text: '→' })));
    }
    more.classList.toggle('hidden', !data.hasMore);
  };
  filter.addEventListener('change', () => load(true));
  more.addEventListener('click', () => {
    page += 1;
    busy(more, 'Cargando…', () => load(false));
  });

  const clearAll = h('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Borrar todo el historial');
  clearAll.addEventListener('click', async () => {
    if (!window.confirm('¿Borrar todo tu historial? Esta acción no se puede deshacer.')) return;
    await api('/generations', { method: 'DELETE' });
    toast('Historial borrado', 'success');
    load(true);
  });

  mount(view, pageHead('Historial', 'Tus resultados anteriores, listos para copiar o reutilizar.', clearAll),
    h('div', { class: 'filters' }, filter), note, list, h('div', { class: 'stack' }, more));
  await load(true);
}

async function historyItem(id) {
  const { generation } = await api(`/generations/${id}`);
  const tool = state.tools.find((item) => item.id === generation.toolId);
  const copy = h('button', { class: 'btn btn-sm', type: 'button' }, 'Copiar');
  copy.addEventListener('click', () => copyText(generation.output));
  const reuse = h('button', { class: 'btn btn-sm btn-secondary', type: 'button' }, 'Usar de nuevo');
  reuse.addEventListener('click', () => {
    sessionStorage.setItem(`prefill:${generation.toolId}`, JSON.stringify(generation.input));
    window.location.hash = `#/herramienta/${generation.toolId}`;
  });
  const remove = h('button', { class: 'btn btn-sm btn-ghost', type: 'button' }, 'Eliminar');
  remove.addEventListener('click', async () => {
    if (!window.confirm('¿Eliminar este resultado?')) return;
    await api(`/generations/${id}`, { method: 'DELETE' });
    toast('Resultado eliminado', 'success');
    window.location.hash = '#/historial';
  });
  const inputs = (tool?.fields ?? []).filter((f) => generation.input[f.name]);
  mount(view,
    h('a', { class: 'back', href: '#/historial' }, '← Historial'),
    pageHead(generation.toolName, fmt.dateTime(generation.createdAt), reuse, remove),
    h('div', { class: 'tool-layout' },
      h('div', { class: 'card' }, h('h3', { text: 'Lo que escribiste' }),
        h('dl', { class: 'kv' }, inputs.flatMap((f) => [h('dt', { text: f.label }), h('dd', { class: 'output', text: generation.input[f.name] })]))),
      h('div', { class: 'card' }, h('div', { class: 'field-meta' }, h('h3', { text: 'Resultado' }), copy),
        h('div', { class: 'output', tabindex: 0, text: generation.output }))));
}

const SUB_STATUS = {
  active: ['Activa', 'badge-success'],
  trialing: ['Periodo de prueba', 'badge-brand'],
  past_due: ['Pago pendiente', 'badge-warning'],
  incomplete: ['Pago por confirmar', 'badge-warning'],
};

async function plansView() {
  const { user } = state;
  const notices = [];
  if (params.get('pago') === 'ok') {
    notices.push(h('div', { class: 'alert alert-success' }, '¡Gracias por tu pago! Tu plan se activa en cuanto Stripe nos confirma el cobro, normalmente en unos segundos.'));
    if (user.plan.id === 'free') pollPlanActivation();
  }
  if (params.get('pago') === 'cancelado') notices.push(h('div', { class: 'alert alert-info' }, 'No se realizó ningún cargo. Puedes elegir un plan cuando quieras.'));
  if (params.has('pago')) window.history.replaceState(null, '', `/app${window.location.hash}`);

  const portalButton = (label = 'Administrar suscripción') => {
    const button = h('button', { class: 'btn btn-secondary', type: 'button' }, label);
    button.addEventListener('click', () => busy(button, 'Abriendo…', async () => {
      try {
        window.location.assign((await api('/billing/portal', { method: 'POST' })).url);
      } catch (error) {
        toast(error.message, 'error');
      }
    }));
    return button;
  };

  let current = null;
  if (user.subscription) {
    const [label, badge] = SUB_STATUS[user.subscription.status] ?? [user.subscription.status, 'badge'];
    current = h('div', { class: 'card' },
      h('div', { class: 'field-meta' }, h('h3', { text: `Suscripción ${user.plan.name}` }), h('span', { class: `badge ${badge}`, text: label })),
      user.subscription.status === 'past_due' ? h('div', { class: 'alert alert-warning', text: 'Tu banco rechazó el último cobro. Actualiza tu método de pago para no perder tu plan.' }) : null,
      h('p', { class: 'muted', text: user.subscription.cancelAtPeriodEnd
        ? `Se cancelará el ${fmt.date(user.subscription.currentPeriodEnd)}. Hasta entonces conservas tu plan.`
        : `Se renueva el ${fmt.date(user.subscription.currentPeriodEnd)}.` }),
      h('p', { class: 'hint', text: 'Desde el portal de Stripe puedes cambiar de plan, actualizar tu tarjeta, descargar recibos o cancelar.' }),
      portalButton());
  } else if (user.plan.source === 'manual') {
    current = h('div', { class: 'card' }, h('h3', { text: `Plan ${user.plan.name}` }),
      h('p', { class: 'muted', text: user.plan.expiresAt ? `Asignado por nuestro equipo, vigente hasta el ${fmt.date(user.plan.expiresAt)}.` : 'Asignado por nuestro equipo.' }));
  }

  const cards = state.config.plans.map((plan) => {
    const isCurrent = plan.id === user.plan.id;
    let action;
    if (isCurrent) {
      action = h('button', { class: 'btn btn-secondary btn-block', type: 'button', disabled: true }, 'Tu plan actual');
    } else if (plan.priceMxn === 0) {
      action = user.subscription ? h('p', { class: 'hint', text: 'Para volver a Gratis, cancela desde "Administrar suscripción".' }) : null;
    } else if (user.subscription) {
      action = portalButton(`Cambiar a ${plan.name}`);
      action.classList.add('btn-block');
    } else if (!state.config.billingEnabled) {
      action = h('button', { class: 'btn btn-block', type: 'button', disabled: true }, 'Pagos próximamente');
    } else {
      action = h('button', { class: `btn btn-block${plan.id === 'pro' ? '' : ' btn-secondary'}`, type: 'button' }, `Elegir ${plan.name}`);
      action.addEventListener('click', () => busy(action, 'Abriendo pago seguro…', async () => {
        try {
          window.location.assign((await api('/billing/checkout', { method: 'POST', body: { planId: plan.id } })).url);
        } catch (error) {
          toast(error.message, 'error', 7000);
        }
      }));
    }
    return planCard(plan, { action, current: isCurrent });
  });

  mount(view,
    pageHead('Planes y pagos', 'Precios en pesos mexicanos con IVA incluido. Pagos procesados por Stripe; no guardamos los datos de tu tarjeta.'),
    notices, current, h('div', { class: 'pricing stack' }, cards),
    state.config.supportEmail ? h('p', { class: 'hint stack' }, '¿Necesitas factura (CFDI)? Escríbenos a ', h('a', { href: `mailto:${state.config.supportEmail}`, text: state.config.supportEmail }), ' con tu constancia de situación fiscal.') : null);
}

function pollPlanActivation(attempt = 0) {
  if (attempt >= 10) return;
  setTimeout(async () => {
    await refreshUser().catch(() => {});
    if (state.user.plan.id !== 'free') {
      toast(`¡Tu plan ${state.user.plan.name} está activo!`, 'success');
      if ((window.location.hash || '#/') === '#/planes') plansView();
    } else {
      pollPlanActivation(attempt + 1);
    }
  }, 2000);
}

async function accountView() {
  const { user } = state;
  const profile = h('form', { novalidate: true }, errorBox(),
    field({ name: 'name', label: 'Nombre', value: user.name, maxLength: 100, required: true, autocomplete: 'name' }),
    field({ name: 'businessName', label: 'Negocio', value: user.businessName ?? '', maxLength: 150, autocomplete: 'organization' }),
    h('button', { class: 'btn', type: 'submit' }, 'Guardar'));
  profile.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors(profile);
    try {
      await busy(profile.querySelector('button'), 'Guardando…', async () => {
        state.user = (await api('/account', { method: 'PATCH', body: formValues(profile) })).user;
      });
      renderChrome();
      toast('Datos actualizados', 'success');
    } catch (error) {
      showErrors(profile, error);
    }
  });

  const password = h('form', { novalidate: true }, errorBox(),
    field({ name: 'currentPassword', label: 'Contraseña actual', type: 'password', required: true, autocomplete: 'current-password' }),
    field({ name: 'newPassword', label: 'Nueva contraseña', type: 'password', required: true, autocomplete: 'new-password', help: 'Mínimo 10 caracteres.' }),
    h('button', { class: 'btn', type: 'submit' }, 'Cambiar contraseña'));
  password.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors(password);
    try {
      await busy(password.querySelector('button'), 'Guardando…', () => api('/account/password', { method: 'POST', body: formValues(password) }));
      password.reset();
      toast('Contraseña actualizada. Cerramos tus otras sesiones.', 'success');
    } catch (error) {
      showErrors(password, error);
    }
  });

  const removeForm = h('form', { novalidate: true }, errorBox(),
    h('p', { class: 'muted', text: 'Se borran tu cuenta, tu historial y tus datos. Si tienes una suscripción, se cancela de inmediato y sin reembolso del periodo en curso.' }),
    field({ name: 'password', label: 'Tu contraseña', type: 'password', required: true, autocomplete: 'current-password' }),
    field({ name: 'confirm', label: 'Escribe ELIMINAR para confirmar', required: true }),
    h('button', { class: 'btn btn-danger', type: 'submit' }, 'Eliminar mi cuenta'));
  removeForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors(removeForm);
    try {
      await busy(removeForm.querySelector('button'), 'Eliminando…', () => api('/account', { method: 'DELETE', body: formValues(removeForm) }));
      window.location.assign('/?cuenta=eliminada');
    } catch (error) {
      showErrors(removeForm, error);
    }
  });

  mount(view, pageHead('Mi cuenta', null),
    h('div', { class: 'grid grid-2' },
      h('div', { class: 'card' }, h('h3', { text: 'Perfil' }),
        h('dl', { class: 'kv stack' }, h('dt', { text: 'Correo' }), h('dd', {}, user.email, ' ',
          h('span', { class: `badge ${user.emailVerified ? 'badge-success' : 'badge-warning'}`, text: user.emailVerified ? 'Confirmado' : 'Sin confirmar' })),
        h('dt', { text: 'Cliente desde' }), h('dd', { text: fmt.date(user.createdAt) })),
        h('div', { class: 'stack' }, profile)),
      h('div', { class: 'card' }, h('h3', { text: 'Seguridad' }), password)),
    h('div', { class: 'grid grid-2 stack' },
      h('div', { class: 'card' }, h('h3', { text: 'Tus datos' }),
        h('p', { class: 'muted', text: 'Descarga en un archivo JSON tu perfil, pagos e historial (derecho de acceso).' }),
        h('a', { class: 'btn btn-secondary', href: '/api/account/export', download: 'mis-datos.json' }, 'Descargar mis datos')),
      h('div', { class: 'card' }, h('h3', { text: 'Eliminar cuenta' }), removeForm)));
}

function notFound() {
  mount(view, h('div', { class: 'card empty' }, h('p', { text: 'No encontramos esta sección.' }), h('a', { class: 'btn', href: '#/' }, 'Ir al inicio')));
}

/* ---------- Enrutador ---------- */

const routes = [
  [/^#?\/?$/, home],
  [/^#\/herramienta\/([\w-]+)$/, toolView],
  [/^#\/historial$/, historyView],
  [/^#\/historial\/([0-9a-f-]{36})$/, historyItem],
  [/^#\/planes$/, plansView],
  [/^#\/cuenta$/, accountView],
];

function redirectToLogin() {
  window.location.assign(`/entrar?next=${encodeURIComponent('/app')}`);
}

async function router() {
  const hash = window.location.hash || '#/';
  renderChrome();
  for (const [pattern, render] of routes) {
    const match = hash.match(pattern);
    if (!match) continue;
    try {
      await render(...match.slice(1));
    } catch (error) {
      if (error.status === 401) return redirectToLogin();
      mount(view, h('div', { class: 'alert alert-error', text: error.message }));
    }
    window.scrollTo(0, 0);
    return;
  }
  notFound();
}

async function start() {
  try {
    const [me, tools, config] = await Promise.all([api('/auth/me'), api('/tools'), api('/plans')]);
    state.user = me.user;
    state.tools = tools.tools;
    state.config = config;
    applyBrand(config.appName);
  } catch (error) {
    if (error.status === 401) return redirectToLogin();
    mount(view, h('div', { class: 'alert alert-error', text: error.message }));
    return;
  }
  window.addEventListener('hashchange', router);
  router();
}

start();
