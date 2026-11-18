import { api, logout } from './api.js';
import { $, applyBrand, busy, clearErrors, copyText, fmt, h, mount, showErrors, toast } from './dom.js';
import { LOCALES, credits, languageSelect, locale, setPreferredCurrency, t } from './i18n.js';
import { currencyToggle, planCard } from './landing.js';

const state = { user: null, tools: [], config: null };
const view = $('#view');
const params = new URLSearchParams(window.location.search);
const resetsOn = (usage) => fmt.date(`${usage.resetsOn}T12:00:00`);

/* ---------- Utilidades de interfaz ---------- */

function firstName(name) {
  return String(name ?? '').trim().split(/\s+/)[0];
}

function meter(used, limit) {
  const pct = limit ? Math.min((used / limit) * 100, 100) : 100;
  const fill = h('span');
  fill.style.width = `${pct}%`;
  return h('div', { class: `meter${pct >= 80 ? ' warn' : ''}`, role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': limit, 'aria-valuenow': used, 'aria-label': t('chrome.credits_used') }, fill);
}

function pageHead(title, subtitle, ...actions) {
  return h('div', { class: 'page-head' },
    h('div', {}, h('h1', { text: title }), subtitle ? h('p', { text: subtitle }) : null),
    actions.length ? h('div', { class: 'btn-row' }, actions) : null);
}

/** Campo de formulario. `options` es una lista de { value, label } (o de textos). */
function field({ name, label, type = 'text', required, help, placeholder, maxLength, options, autocomplete, value }) {
  const id = `f-${name}`;
  let control;
  if (type === 'textarea') {
    control = h('textarea', { id, name, placeholder, maxlength: maxLength, required, class: maxLength > 5000 ? 'tall' : null });
  } else if (type === 'select') {
    control = h('select', { id, name, required },
      required ? null : h('option', { value: '', text: t('common.optional') }),
      options.map((option) => (typeof option === 'string'
        ? h('option', { value: option, text: option })
        : h('option', { value: option.value, text: option.label }))));
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
  const button = h('button', { class: 'btn btn-sm btn-secondary', type: 'button' }, t('verify.resend'));
  button.addEventListener('click', () => busy(button, t('common.sending'), async () => {
    try {
      await api('/auth/resend-verification', { method: 'POST' });
      toast(t('verify.sent', { email: state.user.email }), 'success');
    } catch (error) {
      toast(error.message, 'error');
    }
  }));
  return h('div', { class: 'alert alert-warning' },
    h('div', {}, h('strong', { text: t('verify.title') }), t('verify.body', { email: state.user.email })),
    button);
}

/* ---------- Estructura (menú, créditos, sesión) ---------- */

const NAV = [
  { href: '#/', key: 'nav.tools', match: /^#\/(herramienta\/.*)?$/ },
  { href: '#/historial', key: 'nav.history', match: /^#\/historial/ },
  { href: '#/planes', key: 'nav.plans', match: /^#\/planes/ },
  { href: '#/cuenta', key: 'nav.account', match: /^#\/cuenta/ },
];

/** Cambiar el idioma también lo guarda en la cuenta (correos y respuestas por defecto). */
const saveLocale = (code) => api('/account', { method: 'PATCH', body: { locale: code } }).catch(() => {});

function renderChrome() {
  const hash = window.location.hash || '#/';
  const { user } = state;
  mount($('#nav'),
    NAV.map((item) => h('a', { href: item.href, class: item.match.test(hash) ? 'active' : null, 'aria-current': item.match.test(hash) ? 'page' : null, text: t(item.key) })),
    user.role === 'admin' ? h('a', { href: '/admin', text: t('nav.admin') }) : null);
  const { usage, plan } = user;
  mount($('#sidebar-bottom'),
    h('div', { class: 'credits-mini' },
      h('div', {}, h('strong', { text: credits(usage.remaining) }), t('chrome.available')),
      meter(usage.used, usage.limit),
      h('div', { class: 'hint', text: t('chrome.plan_renews', { plan: plan.name, date: resetsOn(usage) }) })),
    plan.id === 'free' ? h('a', { class: 'btn btn-accent btn-sm', href: '#/planes' }, t('chrome.upgrade')) : null);
  mount($('#who'), `${user.name} · `, h('span', { class: 'badge badge-brand', text: t('chrome.plan', { plan: plan.name }) }));
  const out = h('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, t('common.signout'));
  out.addEventListener('click', logout);
  mount($('#top-actions'), languageSelect({ onChange: saveLocale }), out);
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
  const welcome = params.get('bienvenida')
    ? h('div', { class: 'alert alert-success' }, h('strong', { text: t('home.welcome_title') }), t('home.welcome'))
    : null;
  const cards = state.tools.map((tool) => h('a', { class: `card tool-card${tool.locked ? ' locked' : ''}`, href: `#/herramienta/${tool.id}` },
    h('div', { class: 'meta' },
      h('span', { class: 'badge', text: tool.category }),
      tool.premium ? h('span', { class: 'badge badge-accent', text: tool.locked ? t('home.locked') : 'Pro' }) : null,
      h('span', { class: 'hint', text: credits(tool.credits) })),
    h('h3', { text: tool.name }),
    h('p', { text: tool.description })));

  const name = firstName(user.name);
  mount(view,
    pageHead(name ? t('home.hello', { name }) : t('home.hello_anon'), t('home.subtitle')),
    verifyBanner(),
    welcome,
    h('div', { class: 'card' },
      h('div', { class: 'field-meta' },
        h('strong', { text: t('home.credits', { used: fmt.num(user.usage.used), limit: fmt.num(user.usage.limit) }) }),
        h('span', { class: 'hint', text: t('home.renews', { date: resetsOn(user.usage) }) })),
      h('div', { class: 'stack' }, meter(user.usage.used, user.usage.limit)),
      user.plan.id === 'free' ? h('p', { class: 'hint' }, t('home.need_more'), h('a', { href: '#/planes', text: t('home.see_plans') })) : null),
    h('h2', { class: 'sr-only', text: t('nav.tools') }),
    h('div', { class: 'grid grid-3 stack' }, cards));
}

async function toolView(id) {
  const tool = state.tools.find((item) => item.id === id);
  if (!tool) return notFound();
  const back = h('a', { class: 'back', href: '#/' }, t('tool.back'));
  const head = pageHead(tool.name, tool.description);

  if (tool.locked) {
    return mount(view, back, head, h('div', { class: 'card' },
      h('h3', { text: t('tool.locked_title') }),
      h('p', { class: 'muted', text: t('tool.locked_body', { tool: tool.name }) }),
      h('a', { class: 'btn btn-accent', href: '#/planes' }, t('tool.see_plans'))));
  }

  const prefill = JSON.parse(sessionStorage.getItem(`prefill:${tool.id}`) ?? 'null');
  sessionStorage.removeItem(`prefill:${tool.id}`);
  const form = h('form', { novalidate: true }, errorBox(),
    tool.fields.map((f) => field({ ...f, value: prefill?.[f.name] ?? tool.defaults?.[f.name] })));
  const totalHint = h('p', { class: 'hint' });
  const textNames = new Set(tool.fields.filter((f) => f.type !== 'select').map((f) => f.name));
  const updateTotal = () => {
    const total = Object.entries(formValues(form)).reduce((sum, [name, value]) => sum + (textNames.has(name) ? value.length : 0), 0);
    totalHint.textContent = t('tool.chars_total', { used: fmt.num(total), max: fmt.num(state.user.plan.maxInputChars) });
  };
  form.addEventListener('input', updateTotal);
  updateTotal();

  const submit = h('button', { class: 'btn', type: 'submit' }, t('tool.generate'));
  const example = h('button', { class: 'btn btn-secondary', type: 'button' }, t('tool.example'));
  example.addEventListener('click', () => {
    for (const [name, value] of Object.entries(tool.example ?? {})) {
      const el = form.elements.namedItem(name);
      if (el) {
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  });
  form.append(totalHint, h('div', { class: 'btn-row' }, submit, example, h('span', { class: 'hint', text: t('tool.uses', { credits: credits(tool.credits) }) })));

  const resultTitle = () => h('h3', { text: t('tool.result') });
  const output = h('div', { class: 'card', 'aria-live': 'polite' }, resultTitle(), h('div', { class: 'output-empty', text: t('tool.empty') }));

  const showResult = (generation) => {
    const copy = h('button', { class: 'btn btn-sm', type: 'button' }, t('tool.copy'));
    copy.addEventListener('click', () => copyText(generation.output));
    const again = h('button', { class: 'btn btn-sm btn-secondary', type: 'button' }, t('tool.again'));
    again.addEventListener('click', () => form.requestSubmit());
    mount(output,
      h('div', { class: 'field-meta' }, resultTitle(), h('span', { class: 'hint', text: t('tool.used', { credits: credits(generation.credits) }) })),
      h('div', { class: 'output', tabindex: 0, text: generation.output }),
      h('p', { class: 'hint', text: t('tool.review') }),
      h('div', { class: 'btn-row' }, copy, again, h('a', { class: 'btn btn-sm btn-ghost', href: '#/historial' }, t('tool.history'))));
  };

  const showProblem = (error) => {
    const upgrade = ['quota_exceeded', 'upgrade_required'].includes(error.code)
      ? h('div', { class: 'btn-row' }, h('a', { class: 'btn btn-accent btn-sm', href: '#/planes' }, t('tool.see_plans')))
      : null;
    mount(output, resultTitle(), h('div', { class: `alert ${error.status === 402 || error.status === 403 ? 'alert-warning' : 'alert-error'}` },
      h('div', { text: error.message }), upgrade));
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors(form);
    mount(output, resultTitle(), h('div', { class: 'loading output-empty' }, h('span', { class: 'spinner dark' }), t('tool.generating_long')));
    try {
      const result = await busy(submit, t('tool.generating'), () => api(`/tools/${tool.id}/run`, { method: 'POST', body: { input: formValues(form) } }));
      showResult(result.generation);
      state.user.usage = result.usage;
      renderChrome();
    } catch (error) {
      if (error.status === 401) return redirectToLogin();
      if (error.fields) {
        showErrors(form, error);
        mount(output, resultTitle(), h('div', { class: 'output-empty', text: t('tool.fix_fields') }));
      } else {
        showProblem(error);
      }
    }
  });

  mount(view, back, head, verifyBanner(), h('div', { class: 'tool-layout' }, h('div', { class: 'card' }, form), output));
}

async function historyView() {
  const filter = h('select', { 'aria-label': t('history.filter') },
    h('option', { value: '', text: t('history.all_tools') }),
    state.tools.map((tool) => h('option', { value: tool.id, text: tool.name })));
  const list = h('div', { class: 'list' });
  const more = h('button', { class: 'btn btn-secondary hidden', type: 'button' }, t('history.more'));
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
    note.textContent = t('history.retention', { days: fmt.num(data.historyDays) });
    if (reset && !data.items.length) {
      list.append(h('div', { class: 'card empty' }, h('p', { text: t('history.empty') }), h('a', { class: 'btn', href: '#/' }, t('history.use_tool'))));
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
    busy(more, t('history.loading'), () => load(false));
  });

  const clearAll = h('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, t('history.clear'));
  clearAll.addEventListener('click', async () => {
    if (!window.confirm(t('history.clear_confirm'))) return;
    await api('/generations', { method: 'DELETE' });
    toast(t('history.cleared'), 'success');
    load(true);
  });

  mount(view, pageHead(t('history.title'), t('history.subtitle'), clearAll), h('div', { class: 'filters' }, filter), note, list, h('div', { class: 'stack' }, more));
  await load(true);
}

async function historyItem(id) {
  const { generation } = await api(`/generations/${id}`);
  const tool = state.tools.find((item) => item.id === generation.toolId);
  const copy = h('button', { class: 'btn btn-sm', type: 'button' }, t('tool.copy'));
  copy.addEventListener('click', () => copyText(generation.output));
  const reuse = h('button', { class: 'btn btn-sm btn-secondary', type: 'button' }, t('history.reuse'));
  reuse.addEventListener('click', () => {
    sessionStorage.setItem(`prefill:${generation.toolId}`, JSON.stringify(generation.input));
    window.location.hash = `#/herramienta/${generation.toolId}`;
  });
  const remove = h('button', { class: 'btn btn-sm btn-ghost', type: 'button' }, t('history.delete'));
  remove.addEventListener('click', async () => {
    if (!window.confirm(t('history.delete_confirm'))) return;
    await api(`/generations/${id}`, { method: 'DELETE' });
    toast(t('history.deleted'), 'success');
    window.location.hash = '#/historial';
  });
  // Las opciones se guardan como valores (p. ej. "formal"); se muestran con su etiqueta traducida.
  const display = (f, value) => f.options?.find((option) => option.value === value)?.label ?? value;
  const inputs = (tool?.fields ?? []).filter((f) => generation.input[f.name]);
  mount(view,
    h('a', { class: 'back', href: '#/historial' }, t('history.back')),
    pageHead(generation.toolName, fmt.dateTime(generation.createdAt), reuse, remove),
    h('div', { class: 'tool-layout' },
      h('div', { class: 'card' }, h('h3', { text: t('history.you_wrote') }),
        h('dl', { class: 'kv' }, inputs.flatMap((f) => [h('dt', { text: f.label }), h('dd', { class: 'output', text: display(f, generation.input[f.name]) })]))),
      h('div', { class: 'card' }, h('div', { class: 'field-meta' }, h('h3', { text: t('tool.result') }), copy),
        h('div', { class: 'output', tabindex: 0, text: generation.output }))));
}

const SUB_BADGE = { active: 'badge-success', trialing: 'badge-brand', past_due: 'badge-warning', incomplete: 'badge-warning' };

async function plansView() {
  const { user } = state;
  const notices = [];
  if (params.get('pago') === 'ok') {
    notices.push(h('div', { class: 'alert alert-success', text: t('plans.paid_ok') }));
    if (user.plan.id === 'free') pollPlanActivation();
  }
  if (params.get('pago') === 'cancelado') notices.push(h('div', { class: 'alert alert-info', text: t('plans.paid_cancel') }));
  if (params.has('pago')) window.history.replaceState(null, '', `/app${window.location.hash}`);

  const portalButton = (label = t('plans.manage')) => {
    const button = h('button', { class: 'btn btn-secondary', type: 'button' }, label);
    button.addEventListener('click', () => busy(button, t('plans.opening'), async () => {
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
    const status = user.subscription.status;
    current = h('div', { class: 'card' },
      h('div', { class: 'field-meta' }, h('h3', { text: t('plans.subscription', { plan: user.plan.name }) }),
        h('span', { class: `badge ${SUB_BADGE[status] ?? ''}`, text: t(`status.${status}`) })),
      status === 'past_due' ? h('div', { class: 'alert alert-warning', text: t('plans.past_due') }) : null,
      h('p', { class: 'muted', text: user.subscription.cancelAtPeriodEnd
        ? t('plans.cancels_on', { date: fmt.date(user.subscription.currentPeriodEnd) })
        : t('plans.renews_on', { date: fmt.date(user.subscription.currentPeriodEnd) }) }),
      h('p', { class: 'hint', text: t('plans.portal_hint') }),
      portalButton());
  } else if (user.plan.source === 'manual') {
    current = h('div', { class: 'card' }, h('h3', { text: t('chrome.plan', { plan: user.plan.name }) }),
      h('p', { class: 'muted', text: user.plan.expiresAt ? t('plans.manual_until', { date: fmt.date(user.plan.expiresAt) }) : t('plans.manual') }));
  }

  // Con suscripción activa la moneda queda fija (Stripe cobra a cada cliente en una sola moneda).
  let currency = user.currency;
  const pricing = h('div', { class: 'pricing stack' });
  const renderCards = () => mount(pricing, state.config.plans.map((plan) => {
    const isCurrent = plan.id === user.plan.id;
    let action;
    if (isCurrent) {
      action = h('button', { class: 'btn btn-secondary btn-block', type: 'button', disabled: true }, t('plans.current'));
    } else if (plan.id === 'free') {
      action = user.subscription ? h('p', { class: 'hint', text: t('plans.back_to_free') }) : null;
    } else if (user.subscription) {
      action = portalButton(t('plans.change_to', { plan: plan.name }));
      action.classList.add('btn-block');
    } else if (!state.config.billingEnabled) {
      action = h('button', { class: 'btn btn-block', type: 'button', disabled: true }, t('plans.soon'));
    } else {
      action = h('button', { class: `btn btn-block${plan.id === 'pro' ? '' : ' btn-secondary'}`, type: 'button' }, t('plans.choose', { plan: plan.name }));
      action.addEventListener('click', () => busy(action, t('plans.checkout'), async () => {
        try {
          window.location.assign((await api('/billing/checkout', { method: 'POST', body: { planId: plan.id, currency } })).url);
        } catch (error) {
          toast(error.message, 'error', 7000);
        }
      }));
    }
    return planCard(plan, { action, current: isCurrent, currency });
  }));
  const toggle = h('div', { class: 'currency-toggle' }, h('span', { text: t('plans.currency') }));
  if (!user.subscription) currencyToggle(toggle, state.config.currencies, currency, (code) => { currency = code; renderCards(); });
  renderCards();

  mount(view,
    pageHead(t('plans.title'), t('plans.subtitle')),
    notices, current, user.subscription ? null : toggle, pricing,
    state.config.supportEmail ? h('p', { class: 'hint stack' }, t('plans.invoice'), h('a', { href: `mailto:${state.config.supportEmail}`, text: state.config.supportEmail }), t('plans.invoice_tail')) : null);
}

function pollPlanActivation(attempt = 0) {
  if (attempt >= 10) return;
  setTimeout(async () => {
    await refreshUser().catch(() => {});
    if (state.user.plan.id !== 'free') {
      toast(t('plans.activated', { plan: state.user.plan.name }), 'success');
      if ((window.location.hash || '#/') === '#/planes') plansView();
    } else {
      pollPlanActivation(attempt + 1);
    }
  }, 2000);
}

async function accountView() {
  const { user } = state;
  const profile = h('form', { novalidate: true }, errorBox(),
    field({ name: 'name', label: t('account.name'), value: user.name, maxLength: 100, required: true, autocomplete: 'name' }),
    field({ name: 'businessName', label: t('account.business'), value: user.businessName ?? '', maxLength: 150, autocomplete: 'organization' }),
    field({ name: 'country', label: t('account.country'), value: user.country ?? '', maxLength: 60, autocomplete: 'country-name', help: t('account.country_help') }),
    field({ name: 'locale', label: t('account.language'), type: 'select', required: true, value: user.locale, options: Object.entries(LOCALES).map(([value, label]) => ({ value, label })) }),
    field({ name: 'currency', label: t('account.currency'), type: 'select', required: true, value: user.currency, help: t('account.currency_help'), options: state.config.currencies.map((code) => ({ value: code, label: code.toUpperCase() })) }),
    h('button', { class: 'btn', type: 'submit' }, t('common.save')));
  profile.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors(profile);
    try {
      const values = formValues(profile);
      await busy(profile.querySelector('button'), t('common.saving'), async () => {
        state.user = (await api('/account', { method: 'PATCH', body: values })).user;
      });
      setPreferredCurrency(state.user.currency);
      if (values.locale !== locale) {
        localStorage.setItem('locale', values.locale);
        window.location.reload();
        return;
      }
      renderChrome();
      toast(t('account.updated'), 'success');
    } catch (error) {
      showErrors(profile, error);
    }
  });

  const password = h('form', { novalidate: true }, errorBox(),
    field({ name: 'currentPassword', label: t('account.current_password'), type: 'password', required: true, autocomplete: 'current-password' }),
    field({ name: 'newPassword', label: t('account.new_password'), type: 'password', required: true, autocomplete: 'new-password', help: t('account.password_help') }),
    h('button', { class: 'btn', type: 'submit' }, t('account.change_password')));
  password.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors(password);
    try {
      await busy(password.querySelector('button'), t('common.saving'), () => api('/account/password', { method: 'POST', body: formValues(password) }));
      password.reset();
      toast(t('account.password_changed'), 'success');
    } catch (error) {
      showErrors(password, error);
    }
  });

  const removeForm = h('form', { novalidate: true }, errorBox(),
    h('p', { class: 'muted', text: t('account.delete_body') }),
    field({ name: 'password', label: t('account.your_password'), type: 'password', required: true, autocomplete: 'current-password' }),
    field({ name: 'confirm', label: t('account.confirm_label'), required: true, placeholder: t('account.confirm_word') }),
    h('button', { class: 'btn btn-danger', type: 'submit' }, t('account.delete_button')));
  removeForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors(removeForm);
    try {
      await busy(removeForm.querySelector('button'), t('account.deleting'), () => api('/account', { method: 'DELETE', body: formValues(removeForm) }));
      window.location.assign('/');
    } catch (error) {
      showErrors(removeForm, error);
    }
  });

  mount(view, pageHead(t('account.title'), null),
    h('div', { class: 'grid grid-2' },
      h('div', { class: 'card' }, h('h3', { text: t('account.profile') }),
        h('dl', { class: 'kv stack' },
          h('dt', { text: t('account.email') }), h('dd', {}, user.email, ' ',
            h('span', { class: `badge ${user.emailVerified ? 'badge-success' : 'badge-warning'}`, text: user.emailVerified ? t('account.confirmed') : t('account.unconfirmed') })),
          h('dt', { text: t('account.since') }), h('dd', { text: fmt.date(user.createdAt) })),
        h('div', { class: 'stack' }, profile)),
      h('div', { class: 'card' }, h('h3', { text: t('account.security') }), password)),
    h('div', { class: 'grid grid-2 stack' },
      h('div', { class: 'card' }, h('h3', { text: t('account.data') }),
        h('p', { class: 'muted', text: t('account.data_body') }),
        h('a', { class: 'btn btn-secondary', href: '/api/account/export', download: 'my-data.json' }, t('account.download'))),
      h('div', { class: 'card' }, h('h3', { text: t('account.delete') }), removeForm)));
}

function notFound() {
  mount(view, h('div', { class: 'card empty' }, h('p', { text: t('common.not_found') }), h('a', { class: 'btn', href: '#/' }, t('common.go_home'))));
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
