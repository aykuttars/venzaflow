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

/** Default for every tenant; not toggled or billed in platform admin. */
export const NON_BILLABLE_MODULE_SLUGS = ['dashboard', 'settings'] as const;

/** Modules platform admin can subscribe/unsubscribe and bill per tenant. */
export const BILLABLE_MODULE_SLUGS = ALL_MODULE_SLUGS.filter(
  (slug) => !(NON_BILLABLE_MODULE_SLUGS as readonly string[]).includes(slug)
);

export type ModuleSlug = (typeof ALL_MODULE_SLUGS)[number];

export type NonBillableModuleSlug = (typeof NON_BILLABLE_MODULE_SLUGS)[number];

export function isBillableModule(slug: string): boolean {
  return (BILLABLE_MODULE_SLUGS as readonly string[]).includes(slug);
}

export function mergeTenantModules(modules: string[]): string[] {
  const merged: string[] = [...NON_BILLABLE_MODULE_SLUGS];
  for (const slug of modules) {
    if ((ALL_MODULE_SLUGS as readonly string[]).includes(slug) && !merged.includes(slug)) {
      merged.push(slug);
    }
  }
  return merged;
}
