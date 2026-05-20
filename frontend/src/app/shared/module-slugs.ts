/** Module slugs enabled per tenant — must match backend ALL_MODULES. */
export const ALL_MODULE_SLUGS = [
  'settings',
  'employees',
  'products',
  'inventory',
  'customers',
  'patients',
  'appointments',
  'billing',
  'accounting',
  'dashboard',
  'audit',
] as const;

export type ModuleSlug = (typeof ALL_MODULE_SLUGS)[number];
