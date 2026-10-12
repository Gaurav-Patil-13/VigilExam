/**
 * VigilExam - Centralized API & Socket Configuration
 *
 * Defines the unified port, base endpoints, and resilient HTTP request wrappers.
 */

export const BACKEND_PORT = 4000;

export const API_BASE_URL = (
  typeof window !== 'undefined' && window.__VIGIL_API_URL__
) || (
  typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL
) || `http://localhost:${BACKEND_PORT}`;

export const SOCKET_URL = (
  typeof window !== 'undefined' && window.__VIGIL_SOCKET_URL__
) || (
  typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SOCKET_URL
) || `http://localhost:${BACKEND_PORT}`;

/**
 * Generates authorization headers with optional JWT token.
 */
export function getAuthHeaders(extraHeaders = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...extraHeaders
  };

  try {
    const savedUser = localStorage.getItem('vigil_user');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      if (user?.token) {
        headers['Authorization'] = `Bearer ${user.token}`;
      }
      if (user?.id) {
        headers['x-user-id'] = user.id;
      }
    }
  } catch (e) {
    // Ignore localStorage parse errors
  }

  return headers;
}

/**
 * Standardized API client with timeout, network error diagnostics, and JSON parsing.
 */
export async function fetchApi(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  
  const timeoutMs = options.timeoutMs || 10000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const mergedHeaders = getAuthHeaders(options.headers || {});
  if (options.body && typeof options.body !== 'string' && !(options.body instanceof FormData)) {
    options.body = JSON.stringify(options.body);
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers: mergedHeaders,
      signal: controller.signal
    });

    clearTimeout(timer);

    let data = null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      data = { message: text };
    }

    if (!res.ok) {
      const errorMsg = data?.error || data?.message || `HTTP ${res.status}: ${res.statusText}`;
      const err = new Error(errorMsg);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  } catch (err) {
    clearTimeout(timer);

    if (err.name === 'AbortError') {
      const timeoutErr = new Error(`Connection to security server timed out after ${timeoutMs / 1000}s. Please check if server is responsive.`);
      timeoutErr.code = 'ETIMEDOUT';
      throw timeoutErr;
    }

    if (err.name === 'TypeError' || err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
      const connErr = new Error(`Unable to connect to VigilExam Security Server at ${API_BASE_URL}. Please ensure the backend service is running.`);
      connErr.code = 'ECONNREFUSED';
      throw connErr;
    }

    throw err;
  }
}

/**
 * Health check probe to determine if backend is ready.
 */
export async function checkServerHealth(timeoutMs = 3000) {
  try {
    const res = await fetchApi('/api/health', { timeoutMs });
    return { ok: true, data: res };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
