const API_BASE = '/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  if (response.status === 204) return null;

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Request failed');
  }

  return response.json();
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
