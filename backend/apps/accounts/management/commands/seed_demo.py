from __future__ import annotations

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import Department, Permission
from apps.common.permission_codes import ALL_MODULES, PERMISSION_CODENAMES
from apps.products.models import Category
from apps.tenants.models import Tenant

User = get_user_model()


def ensure_permissions() -> dict[str, Permission]:
    perms = {}
    for codename, name in PERMISSION_CODENAMES:
        obj, _ = Permission.objects.get_or_create(codename=codename, defaults={"name": name})
        perms[codename] = obj
    return perms


def ensure_product_categories(tenant: Tenant) -> None:
    for name, slug in (
        ("Genel", "general"),
        ("Sarf malzeme", "supplies"),
        ("Cihaz", "equipment"),
    ):
        Category.objects.get_or_create(
            tenant=tenant,
            slug=slug,
            defaults={"name": name},
        )


def mk_department(
    tenant: Tenant,
    key: str,
    name: str,
    codenames: list[str],
    perm_index: dict[str, Permission],
):
    dept, _ = Department.objects.get_or_create(
        tenant=tenant,
        key=key,
        defaults={"name": name},
    )
    dept.name = name
    dept.save()
    dept.permissions.set([perm_index[c] for c in codenames if c in perm_index])
    return dept


class Command(BaseCommand):
    help = "Seed demo tenants (1000, 3000), RBAC, and staff users."

    @transaction.atomic
    def handle(self, *args, **options):
        perm_index = ensure_permissions()

        t1000, _ = Tenant.objects.update_or_create(
            customer_code="1000",
            defaults={
                "name": "Demo Clinic 1000",
                "default_language": Tenant.Language.TR,
                "is_active": True,
                "enabled_modules": ALL_MODULES,
            },
        )
        t3000, _ = Tenant.objects.update_or_create(
            customer_code="3000",
            defaults={
                "name": "Demo Enterprise 3000",
                "default_language": Tenant.Language.TR,
                "is_active": True,
                "enabled_modules": ALL_MODULES,
            },
        )

        admin_codes = [c[0] for c in PERMISSION_CODENAMES]
        tech_codes = [
            "products.read",
            "products.write",
            "inventory.read",
            "inventory.write",
            "dashboard.read",
        ]
        cashier_codes = ["billing.read", "billing.write", "customers.read", "dashboard.read"]
        accounting_codes = [
            "accounting.read",
            "accounting.write",
            "billing.read",
            "dashboard.read",
        ]
        security_codes = ["audit.read", "dashboard.read", "settings.read"]
        doctor_codes = [
            "patients.read",
            "patients.write",
            "appointments.read",
            "appointments.write",
            "customers.read",
            "dashboard.read",
        ]

        d1000_admin = mk_department(t1000, "admin", "Admin", admin_codes, perm_index)
        d1000_tech = mk_department(t1000, "technician", "Technician", tech_codes, perm_index)
        d1000_cash = mk_department(t1000, "cashier", "Cashier", cashier_codes, perm_index)

        d3000_admin = mk_department(t3000, "admin", "Admin", admin_codes, perm_index)
        d3000_acc = mk_department(t3000, "accounting", "Accounting", accounting_codes, perm_index)
        d3000_sec = mk_department(t3000, "security", "Security", security_codes, perm_index)
        d3000_doc = mk_department(t3000, "doctor", "Doctor", doctor_codes, perm_index)

        for tenant in (t1000, t3000):
            ensure_product_categories(tenant)

        demo_pw = "X7@qL9#vT2!mZ4$k"
        users = [
            (t1000, d1000_admin, "admin@admin.com", demo_pw),
            (t1000, d1000_tech, "tech@admin.com", demo_pw),
            (t1000, d1000_cash, "cash@admin.com", demo_pw),
            (t3000, d3000_admin, "admin@admin.com", demo_pw),
            (t3000, d3000_acc, "accounting@admin.com", demo_pw),
            (t3000, d3000_sec, "security@admin.com", demo_pw),
            (t3000, d3000_doc, "doctor@admin.com", demo_pw),
        ]

        for tenant, dept, email, password in users:
            u, created = User.all_tenants.get_or_create(
                tenant=tenant,
                email=email.lower(),
                defaults={
                    "department": dept,
                    "is_active": True,
                },
            )
            u.department = dept
            u.is_active = True
            u.set_password(password)
            u.save()
            status = "created" if created else "updated"
            self.stdout.write(self.style.SUCCESS(f"{status} user {email} @ {tenant.customer_code}"))

        self.stdout.write(self.style.SUCCESS("seed_demo completed."))
