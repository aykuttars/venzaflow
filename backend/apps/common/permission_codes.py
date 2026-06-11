PERMISSION_CODENAMES = [
    ("settings.read", "View settings / departments"),
    ("settings.write", "Manage settings / departments"),
    ("employees.read", "View employees"),
    ("employees.write", "Manage employees"),
    ("products.read", "View products"),
    ("products.write", "Manage products"),
    ("inventory.read", "View inventory"),
    ("inventory.write", "Manage inventory"),
    ("customers.read", "View customers"),
    ("customers.write", "Manage customers"),
    ("patients.read", "View patient records"),
    ("patients.write", "Manage patient records"),
    ("oral.read", "View oral / dental records"),
    ("oral.write", "Manage oral / dental records"),
    ("appointments.read", "View appointments"),
    ("appointments.write", "Manage appointments"),
    ("billing.read", "View billing"),
    ("billing.write", "Manage billing"),
    ("accounting.read", "View accounting"),
    ("accounting.write", "Manage accounting"),
    ("dashboard.read", "View dashboard"),
    ("audit.read", "View audit logs"),
    ("signing.read", "View signing tasks"),
    ("signing.write", "Manage signing tasks"),
]

ALL_MODULES = [
    "settings",
    "employees",
    "products",
    "inventory",
    "customers",
    "patients",
    "oral",
    "appointments",
    "billing",
    "accounting",
    "dashboard",
    "audit",
    "signing",
]

# Default (English) display labels per module slug. The UI may override these
# with localized translations; these act as the fallback for unknown locales
# and keep the backend the single source of truth for the module list.
MODULE_LABELS = {
    "settings": "Settings",
    "employees": "Employees",
    "products": "Products",
    "inventory": "Inventory",
    "customers": "Customers",
    "patients": "Patients",
    "oral": "Oral / Dental",
    "appointments": "Appointments",
    "billing": "Billing",
    "accounting": "Accounting",
    "dashboard": "Dashboard",
    "audit": "Audit Logs",
    "signing": "e-Signature",
}

# Always included for every tenant by default; default is_billable=False on subscription row.
NON_BILLABLE_MODULES = [
    "dashboard",
    "settings",
]

BILLABLE_MODULES = [m for m in ALL_MODULES if m not in NON_BILLABLE_MODULES]


def is_billable_module(module_slug: str) -> bool:
    return module_slug in BILLABLE_MODULES


def merge_tenant_modules(modules: list[str]) -> list[str]:
    """Return deduplicated module list with non-billable modules always included."""
    merged = list(NON_BILLABLE_MODULES)
    for slug in modules:
        if slug in ALL_MODULES and slug not in merged:
            merged.append(slug)
    return merged


def module_catalog() -> list[dict]:
    """Static module catalog (slug, label, billable flags) — the single source
    of truth consumed by the platform admin UI. Pricing is layered on by the
    catalog endpoint from ModulePrice rows."""
    return [
        {
            "slug": slug,
            "label": MODULE_LABELS.get(slug, slug),
            "is_billable": slug in BILLABLE_MODULES,
            "is_default_non_billable": slug in NON_BILLABLE_MODULES,
        }
        for slug in ALL_MODULES
    ]


def permission_module_slug(codename: str) -> str:
    return codename.split(".", 1)[0]


def tenant_allowed_permission_modules(enabled_modules: list[str] | None) -> set[str]:
    allowed = set(enabled_modules or [])
    allowed.update(NON_BILLABLE_MODULES)
    return allowed


def codename_allowed_for_tenant(codename: str, enabled_modules: list[str] | None) -> bool:
    return permission_module_slug(codename) in tenant_allowed_permission_modules(enabled_modules)


def filter_codenames_for_tenant(
    codenames: list[str],
    enabled_modules: list[str] | None,
) -> list[str]:
    allowed = tenant_allowed_permission_modules(enabled_modules)
    return [c for c in codenames if permission_module_slug(c) in allowed]
