function trimTrailingSlash(value) {
  return value ? value.replace(/\/+$/, '') : value;
}

function getWindowOrigin() {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

function inferApiBaseUrl() {
  const explicit = trimTrailingSlash(import.meta.env.VITE_API_BASE_URL);
  if (explicit) return explicit;

  if (typeof window !== 'undefined') {
    const { protocol, hostname, origin } = window.location;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    if (isLocal) return `${protocol}//${hostname}:8000`;
    return origin;
  }

  return '';
}

function inferWsBaseUrl(apiBaseUrl) {
  const explicit = trimTrailingSlash(import.meta.env.VITE_WS_BASE_URL);
  if (explicit) return explicit;

  if (apiBaseUrl) {
    if (apiBaseUrl.startsWith('https://')) return `wss://${apiBaseUrl.slice(8)}`;
    if (apiBaseUrl.startsWith('http://')) return `ws://${apiBaseUrl.slice(7)}`;
  }

  const origin = getWindowOrigin();
  if (origin.startsWith('https://')) return `wss://${origin.slice(8)}`;
  if (origin.startsWith('http://')) return `ws://${origin.slice(7)}`;
  return '';
}

export const API_BASE_URL = inferApiBaseUrl();
export const WS_BASE_URL = inferWsBaseUrl(API_BASE_URL);

export function apiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

export function wsUrl(pathWithQuery) {
  const normalizedPath = pathWithQuery.startsWith('/') ? pathWithQuery : `/${pathWithQuery}`;
  return `${WS_BASE_URL}${normalizedPath}`;
}

export function backendLabel() {
  return API_BASE_URL || 'Not configured';
}
