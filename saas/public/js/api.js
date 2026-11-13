export class ApiError extends Error {
  constructor(status, error) {
    super(error?.message ?? 'Ocurrió un error. Intenta de nuevo.');
    this.status = status;
    this.code = error?.code;
    this.fields = error?.fields;
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, { code: 'network', message: 'No hay conexión con el servidor. Revisa tu internet.' });
  }
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, data.error);
  return data;
}

export async function currentUser() {
  try {
    return (await api('/auth/me')).user;
  } catch (error) {
    if (error.status === 401) return null;
    throw error;
  }
}

export async function logout() {
  await api('/auth/logout', { method: 'POST' }).catch(() => {});
  window.location.assign('/');
}
