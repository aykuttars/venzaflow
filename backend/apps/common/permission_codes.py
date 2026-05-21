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
    ("appointments.read", "View appointments"),
    ("appointments.write", "Manage appointments"),
    ("billing.read", "View billing"),
    ("billing.write", "Manage billing"),
    ("accounting.read", "View accounting"),
    ("accounting.write", "Manage accounting"),
    ("dashboard.read", "View dashboard"),
    ("audit.read", "View audit logs"),
]

ALL_MODULES = [
    "settings",
    "employees",
    "products",
    "inventory",
    "customers",
    "patients",
    "appointments",
    "billing",
    "accounting",
    "dashboard",
    "audit",
]

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
