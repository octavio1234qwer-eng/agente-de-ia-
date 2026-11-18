import { numberLocale, t } from './i18n.js';

// Utilidades de DOM. Todo el texto se inserta con textContent: nunca innerHTML con datos.
const SVG_NS = 'http://www.w3.org/2000/svg';

function applyAttrs(el, attrs) {
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.setAttribute('class', value);
    else if (key === 'text') el.textContent = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'value' && 'value' in el) el.value = value;
    else el.setAttribute(key, value === true ? '' : String(value));
  }
}

function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  applyAttrs(el, attrs);
  append(el, children);
  return el;
}

export function s(tag, attrs, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  applyAttrs(el, attrs);
  append(el, children);
  return el;
}

export function mount(target, ...children) {
  target.replaceChildren();
  append(target, children);
}

export const $ = (selector, root = document) => root.querySelector(selector);

const fmtDate = (options) => new Intl.DateTimeFormat(numberLocale, options);
export const fmt = {
  /** Precio entero en la moneda indicada (199 -> $199 / MX$199 según idioma). */
  money: (amount, currency = 'mxn') => new Intl.NumberFormat(numberLocale, { style: 'currency', currency: currency.toUpperCase(), currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0 }).format(amount),
  cents: (cents, currency = 'mxn') => new Intl.NumberFormat(numberLocale, { style: 'currency', currency: currency.toUpperCase(), currencyDisplay: 'narrowSymbol' }).format(Number(cents) / 100),
  mxn: (amount) => fmt.money(amount, 'mxn'),
  num: (value) => Number(value ?? 0).toLocaleString(numberLocale),
  date: (iso) => (iso ? fmtDate({ dateStyle: 'medium' }).format(new Date(iso)) : '—'),
  dateTime: (iso) => (iso ? fmtDate({ dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) : '—'),
  day: (ymd) => {
    const [year, month, day] = ymd.split('-').map(Number);
    return fmtDate({ day: 'numeric', month: 'short', timeZone: 'UTC' }).format(Date.UTC(year, month - 1, day));
  },
};

let toastRoot;
export function toast(message, type = 'info', ms = 4500) {
  toastRoot ??= document.body.appendChild(h('div', { class: 'toast-root', role: 'status', 'aria-live': 'polite' }));
  const el = h('div', { class: `toast ${type}` }, message);
  toastRoot.append(el);
  setTimeout(() => el.remove(), ms);
}

/** Muestra errores de validación del servidor junto a cada campo del formulario. */
export function showErrors(form, error) {
  clearErrors(form);
  const fields = error?.fields ?? {};
  let shownInline = false;
  for (const [name, message] of Object.entries(fields)) {
    const slot = form.querySelector(`[data-error-for="${CSS.escape(name)}"]`);
    if (slot) {
      slot.textContent = message;
      slot.closest('.field')?.classList.add('invalid');
      shownInline = true;
    }
  }
  const general = form.querySelector('[data-form-error]');
  if (general && (!shownInline || !Object.keys(fields).length)) {
    general.textContent = error?.message ?? t('common.error');
    general.classList.remove('hidden');
  }
}

export function clearErrors(form) {
  form.querySelectorAll('[data-error-for]').forEach((el) => { el.textContent = ''; });
  form.querySelectorAll('.field.invalid').forEach((el) => el.classList.remove('invalid'));
  const general = form.querySelector('[data-form-error]');
  if (general) {
    general.textContent = '';
    general.classList.add('hidden');
  }
}

/** Deshabilita el botón mientras corre una acción asíncrona. */
export async function busy(button, label, fn) {
  const original = [...button.childNodes];
  button.disabled = true;
  button.replaceChildren(h('span', { class: 'spinner' }), label);
  try {
    return await fn();
  } finally {
    button.disabled = false;
    button.replaceChildren(...original);
  }
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast(t('common.copied'), 'success', 2000);
  } catch {
    toast(t('common.copy_failed'), 'error');
  }
}

/** Solo permite redirecciones internas (evita redirecciones abiertas). */
export function safeNext(value, fallback = '/app') {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\') ? value : fallback;
}

/** Aplica el nombre comercial configurado en APP_NAME. */
export function applyBrand(appName) {
  if (!appName) return;
  document.querySelectorAll('[data-app-name]').forEach((el) => { el.textContent = appName; });
  document.title = document.title.replace('ImpulsaIA', appName);
}
