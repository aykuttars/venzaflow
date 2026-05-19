// API base is resolved at runtime from `window.__APP_CONFIG__`,
// allowing the same image to be deployed against different API hosts.

declare global {
  interface Window {
    __APP_CONFIG__?: { apiBase?: string };
  }
}

export const API_BASE: string =
  (typeof window !== 'undefined' && window.__APP_CONFIG__?.apiBase) ||
  '/api/v1';
