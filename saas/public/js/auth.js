import { api, currentUser } from './api.js';
import { $, applyBrand, busy, clearErrors, safeNext, showErrors } from './dom.js';

const page = document.body.dataset.page;
const params = new URLSearchParams(window.location.search);

function formData(form) {
  const data = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    data[el.name] = el.type === 'checkbox' ? el.checked : el.value;
  }
  return data;
}

function onSubmit(handler) {
  const form = $('#form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors(form);
    const button = form.querySelector('button[type="submit"]');
    try {
      await busy(button, 'Un momento…', () => handler(formData(form), form));
    } catch (error) {
      showErrors(form, error);
    }
  });
}

/** Lee el token del enlace y lo quita de la barra de direcciones (no queda en el historial). */
function takeToken() {
  const token = params.get('token');
  if (token) window.history.replaceState(null, '', window.location.pathname);
  return token;
}

const handlers = {
  async entrar() {
    if (await currentUser().catch(() => null)) return window.location.replace(safeNext(params.get('next')));
    onSubmit(async (data) => {
      await api('/auth/login', { method: 'POST', body: data });
      window.location.assign(safeNext(params.get('next')));
    });
  },

  async registro() {
    if (await currentUser().catch(() => null)) return window.location.replace('/app');
    onSubmit(async (data) => {
      await api('/auth/register', { method: 'POST', body: data });
      window.location.assign('/app?bienvenida=1');
    });
  },

  async recuperar() {
    onSubmit(async (data, form) => {
      const result = await api('/auth/forgot-password', { method: 'POST', body: data });
      $('#done').textContent = result.message;
      $('#done').classList.remove('hidden');
      form.classList.add('hidden');
    });
  },

  async restablecer() {
    const token = takeToken();
    if (!token) {
      showErrors($('#form'), { message: 'El enlace está incompleto. Ábrelo de nuevo desde tu correo o solicita otro.' });
      return;
    }
    onSubmit(async (data, form) => {
      await api('/auth/reset-password', { method: 'POST', body: { token, password: data.password } });
      $('#done').classList.remove('hidden');
      form.classList.add('hidden');
    });
  },

  async verificar() {
    const token = takeToken();
    $('#status').classList.add('hidden');
    try {
      if (!token) throw new Error('El enlace está incompleto. Ábrelo de nuevo desde tu correo.');
      // La confirmación se hace con POST desde la página: los antivirus de correo que abren enlaces no la consumen.
      await api('/auth/verify-email', { method: 'POST', body: { token } });
      $('#done').classList.remove('hidden');
    } catch (error) {
      $('#failed').textContent = error.message;
      $('#failed').classList.remove('hidden');
    }
    $('#go').classList.remove('hidden');
  },
};

api('/plans').then((data) => applyBrand(data.appName)).catch(() => {});
handlers[page]?.();
