/** Parent modules that can host child module routes/tabs. */
export const MODULE_CHILD_HOSTS: Readonly<
  Record<string, { route: string; children: readonly string[] }>
> = {
  customers: { route: '/customers', children: ['patients'] },
};

export interface ModuleNavItem {
  path: string;
  labelKey: string;
  icon: string;
  module: string;
  labelSlug?: string;
  permission: string;
}

export const MODULE_NAV: readonly ModuleNavItem[] = [
  { path: '/dashboard', labelKey: 'nav.dashboard', icon: 'dashboard', module: 'dashboard', permission: 'dashboard.read' },
  { path: '/products', labelKey: 'nav.products', icon: 'inventory_2', module: 'products', permission: 'products.read' },
  { path: '/inventory', labelKey: 'nav.inventory', icon: 'warehouse', module: 'inventory', permission: 'inventory.read' },
  { path: '/employees', labelKey: 'nav.employees', icon: 'badge', module: 'employees', permission: 'employees.read' },
  { path: '/customers', labelKey: 'nav.customers', icon: 'people', module: 'customers', permission: 'customers.read' },
  { path: '/patients', labelKey: 'nav.patients', icon: 'medical_services', module: 'patients', permission: 'patients.read' },
  { path: '/appointments', labelKey: 'nav.appointments', icon: 'event', module: 'appointments', permission: 'appointments.read' },
  { path: '/billing', labelKey: 'nav.billing', icon: 'receipt_long', module: 'billing', permission: 'billing.read' },
  { path: '/accounting', labelKey: 'nav.accounting', icon: 'savings', module: 'accounting', permission: 'accounting.read' },
  { path: '/audit-logs', labelKey: 'nav.auditLogs', icon: 'history', module: 'audit', permission: 'audit.read' },
  {
    path: '/departments',
    labelKey: 'nav.departments',
    labelSlug: 'departments',
    icon: 'admin_panel_settings',
    module: 'settings',
    permission: 'settings.read',
  },
  { path: '/settings', labelKey: 'nav.settings', icon: 'settings', module: 'settings', permission: 'settings.read' },
];

export function parentHostsChild(parentModule: string, childModule: string): boolean {
  const host = MODULE_CHILD_HOSTS[parentModule];
  return !!host?.children.includes(childModule);
}

export function nestedChildRoute(parentModule: string, childModule: string): string | null {
  const host = MODULE_CHILD_HOSTS[parentModule];
  if (!host?.children.includes(childModule)) {
    return null;
  }
  return `${host.route}/${childModule}`;
}

export interface NavPlacementInput {
  module: string;
  enabledModules: string[];
  moduleParents: Record<string, string>;
}

/** True when module should appear as a top-level sidebar item. */
export function isTopLevelNavModule(input: NavPlacementInput): boolean {
  const { module, enabledModules, moduleParents } = input;
  if (!enabledModules.includes(module)) {
    return false;
  }
  const parent = moduleParents[module];
  if (!parent) {
    return true;
  }
  if (!enabledModules.includes(parent)) {
    return true;
  }
  if (!parentHostsChild(parent, module)) {
    return true;
  }
  return false;
}

export function nestedModulesForParent(
  parentModule: string,
  enabledModules: string[],
  moduleParents: Record<string, string>
): string[] {
  const host = MODULE_CHILD_HOSTS[parentModule];
  if (!host) {
    return [];
  }
  return host.children.filter(
    (child) =>
      enabledModules.includes(child) &&
      moduleParents[child] === parentModule
  );
}

export function isModuleNested(
  module: string,
  enabledModules: string[],
  moduleParents: Record<string, string>
): boolean {
  return !isTopLevelNavModule({ module, enabledModules, moduleParents });
}
