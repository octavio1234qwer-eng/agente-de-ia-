import { api, currentUser } from './api.js';
import { $, applyBrand, fmt, h, mount } from './dom.js';

export function planCard(plan, { action, current = false } = {}) {
  const featured = plan.id === 'pro';
  return h('article', { class: `card plan-card${featured ? ' featured' : ''}` },
    h('div', { class: 'plan-head' },
      h('h3', { text: plan.name }),
      current ? h('span', { class: 'badge badge-brand', text: 'Tu plan' }) : featured ? h('span', { class: 'badge badge-accent', text: 'Más popular' }) : null),
    h('p', { class: 'price' }, plan.priceMxn ? fmt.mxn(plan.priceMxn) : '$0', h('small', { class: 'muted', text: plan.priceMxn ? ' /mes' : ' para siempre' })),
    h('p', { class: 'hint', text: plan.priceMxn ? 'IVA incluido. Cancela cuando quieras.' : 'Sin tarjeta.' }),
    h('ul', {}, plan.highlights.map((item) => h('li', { text: item }))),
    action);
}

async function init() {
  $('#year').textContent = String(new Date().getFullYear());
  const [plansData, toolsData, user] = await Promise.all([
    api('/plans'),
    api('/tools'),
    currentUser().catch(() => null),
  ]);
  applyBrand(plansData.appName);

  if (user) {
    mount($('#header-actions'), h('a', { class: 'btn btn-sm', href: '/app' }, 'Ir a mi panel'));
  }

  mount($('#tools-list'), toolsData.tools.map((tool) => h('article', { class: 'card tool-card' },
    h('div', { class: 'meta' },
      h('span', { class: 'badge', text: tool.category }),
      tool.premium ? h('span', { class: 'badge badge-accent', text: 'Pro' }) : null),
    h('h3', { text: tool.name }),
    h('p', { text: tool.description }))));

  mount($('#pricing'), plansData.plans.map((plan) => planCard(plan, {
    action: h('a', { class: `btn btn-block${plan.id === 'pro' ? '' : ' btn-secondary'}`, href: user ? '/app#/planes' : '/registro' },
      plan.priceMxn ? `Elegir ${plan.name}` : 'Empezar gratis'),
  })));
}

if (document.body.dataset.page === 'landing') {
  init().catch(() => {
    mount($('#pricing'), h('p', { class: 'muted', text: 'No pudimos cargar los precios. Recarga la página.' }));
  });
}
