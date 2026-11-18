import { api, currentUser } from './api.js';
import { $, applyBrand, fmt, h, mount } from './dom.js';
import { languageSelect, preferredCurrency, setPreferredCurrency, t } from './i18n.js';

/** Tarjeta de plan reutilizada en la página principal y en "Planes y pagos". */
export function planCard(plan, { action, current = false, currency = 'mxn' } = {}) {
  const featured = plan.id === 'pro';
  const price = plan.prices[currency] ?? 0;
  return h('article', { class: `card plan-card${featured ? ' featured' : ''}` },
    h('div', { class: 'plan-head' },
      h('h3', { text: plan.name }),
      current ? h('span', { class: 'badge badge-brand', text: t('plans.badge_current') })
        : featured ? h('span', { class: 'badge badge-accent', text: t('plans.badge_popular') }) : null),
    h('p', { class: 'price' }, fmt.money(price, currency),
      h('small', { class: 'muted', text: price ? ` ${currency.toUpperCase()}${t('common.month')}` : t('common.forever') })),
    h('p', { class: 'hint', text: price ? t(currency === 'mxn' ? 'plans.tax_mxn' : 'plans.tax_usd') : t('plans.no_card') }),
    h('ul', {}, plan.highlights.map((item) => h('li', { text: item }))),
    action);
}

/** Botones MXN / USD. `onChange(currency)` vuelve a dibujar los precios. */
export function currencyToggle(container, currencies, current, onChange) {
  const buttons = currencies.map((code) => {
    const button = h('button', { type: 'button', class: `chip${code === current ? ' active' : ''}`, 'aria-pressed': String(code === current), text: code.toUpperCase() });
    button.addEventListener('click', () => {
      setPreferredCurrency(code);
      buttons.forEach((b) => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', String(b === button)); });
      onChange(code);
    });
    return button;
  });
  container.append(...buttons);
}

async function init() {
  $('#year').textContent = String(new Date().getFullYear());
  $('#lang-slot').append(languageSelect());
  const [plansData, toolsData, user] = await Promise.all([api('/plans'), api('/tools'), currentUser().catch(() => null)]);
  applyBrand(plansData.appName);

  if (user) mount($('#header-actions'), h('a', { class: 'btn btn-sm', href: '/app' }, t('landing.panel')));

  mount($('#tools-list'), toolsData.tools.map((tool) => h('article', { class: 'card tool-card' },
    h('div', { class: 'meta' },
      h('span', { class: 'badge', text: tool.category }),
      tool.premium ? h('span', { class: 'badge badge-accent', text: 'Pro' }) : null),
    h('h3', { text: tool.name }),
    h('p', { text: tool.description }))));

  const renderPricing = (currency) => mount($('#pricing'), plansData.plans.map((plan) => planCard(plan, {
    currency,
    action: h('a', { class: `btn btn-block${plan.id === 'pro' ? '' : ' btn-secondary'}`, href: user ? '/app#/planes' : '/registro' },
      plan.prices[currency] ? t('plans.choose', { plan: plan.name }) : t('plans.start_free')),
  })));
  const currency = preferredCurrency();
  currencyToggle($('#currency-toggle'), plansData.currencies, currency, renderPricing);
  renderPricing(currency);
}

if (document.body.dataset.page === 'landing') {
  init().catch(() => mount($('#pricing'), h('p', { class: 'muted', text: t('landing.pricing_error') })));
}
