const configuredBase = import.meta.env.VITE_API_URL?.replace(/\/$/, '');

/** @returns {string} */
export function getApiBase() {
  if (configuredBase) return configuredBase;
  if (import.meta.env.DEV) return '/api';
  return '';
}

export function isApiConfigured() {
  return Boolean(getApiBase());
}

export function getApiConfigError() {
  if (isApiConfigured()) return null;
  return (
    'Backend URL is not configured. Set VITE_API_URL in Vercel to your Render API ' +
    '(e.g. https://your-app.onrender.com/api), then redeploy.'
  );
}

async function parseResponseBody(response) {
  const text = await response.text();
  if (!text) return null;

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('Server returned invalid JSON.');
    }
  }

  if (text.trimStart().startsWith('<!DOCTYPE') || text.trimStart().startsWith('<html')) {
    throw new Error(
      'API returned HTML instead of JSON. Set VITE_API_URL on Vercel to your Render ' +
      'backend URL (e.g. https://your-app.onrender.com/api) and redeploy.'
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text.slice(0, 120) || 'Unexpected server response.');
  }
}

async function request(path, options = {}) {
  const base = getApiBase();
  if (!base) {
    throw new Error(getApiConfigError());
  }

  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  if (response.status === 204) return null;

  const body = await parseResponseBody(response);

  if (!response.ok) {
    const detail = body?.detail;
    throw new Error(
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d) => d.msg).join(', ')
          : 'Request failed'
    );
  }

  return body;
}

export const api = {
  getTasks: (status = 'all', search = '', sort = 'newest') => {
    const params = new URLSearchParams({ status, sort });
    if (search) params.set('search', search);
    return request(`/tasks?${params}`);
  },

  getCounts: () => request('/tasks/counts'),

  createTask: (data) =>
    request('/tasks', { method: 'POST', body: JSON.stringify(data) }),

  updateTask: (id, data) =>
    request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  toggleTask: (id) =>
    request(`/tasks/${id}/toggle`, { method: 'PATCH' }),

  deleteTask: (id) =>
    request(`/tasks/${id}`, { method: 'DELETE' }),

  reorderTasks: (taskIds) =>
    request('/tasks/reorder', {
      method: 'PUT',
      body: JSON.stringify({ task_ids: taskIds }),
    }),
};
