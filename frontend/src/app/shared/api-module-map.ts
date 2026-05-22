import { API_BASE } from '../core/api';

/** API path prefix → tenant module slug (must match backend required_module). */
const API_MODULE_PREFIXES: readonly { prefix: string; module: string }[] = [
  { prefix: 'departments', module: 'settings' },
  { prefix: 'employees', module: 'employees' },
  { prefix: 'products/categories', module: 'products' },
  { prefix: 'products', module: 'products' },
  { prefix: 'inventory/', module: 'inventory' },
  { prefix: 'customers', module: 'customers' },
  { prefix: 'patients', module: 'patients' },
  { prefix: 'medical-records', module: 'patients' },
  { prefix: 'oral/', module: 'oral' },
  { prefix: 'nvi/', module: 'patients' },
  { prefix: 'address/', module: 'patients' },
  { prefix: 'appointments', module: 'appointments' },
  { prefix: 'schedules', module: 'appointments' },
  { prefix: 'billing/', module: 'billing' },
  { prefix: 'accounting/', module: 'accounting' },
  { prefix: 'dashboard/', module: 'dashboard' },
  { prefix: 'audit', module: 'audit' },
];

/** Paths that skip module checks (auth, tenant profile, permission catalog). */
const EXEMPT_PREFIXES = ['auth/', 'tenant/', 'permissions/'];

/** Normalize URL or path to a relative API segment after /api/v1/. */
export function normalizeApiPath(pathOrUrl: string): string {
  let path = pathOrUrl;
  if (path.startsWith('http://') || path.startsWith('https://')) {
    try {
      path = new URL(path).pathname;
    } catch {
      return pathOrUrl;
    }
  }
  const base = API_BASE.replace(/\/$/, '');
  if (path.startsWith(base)) {
    path = path.slice(base.length);
  }
  return path.replace(/^\//, '');
}

export function isExemptApiPath(pathOrUrl: string): boolean {
  const path = normalizeApiPath(pathOrUrl);
  return EXEMPT_PREFIXES.some((p) => path.startsWith(p));
}

/** Return module slug required for this API path, or null if exempt / unknown. */
export function requiredModuleForApiPath(pathOrUrl: string): string | null {
  const path = normalizeApiPath(pathOrUrl);
  if (isExemptApiPath(path)) {
    return null;
  }
  for (const { prefix, module } of API_MODULE_PREFIXES) {
    if (path.startsWith(prefix)) {
      return module;
    }
  }
  return null;
}
