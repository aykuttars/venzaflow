from __future__ import annotations

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import Department, Permission
from apps.common.celery_setup import ensure_periodic_tasks
from apps.common.permission_codes import (
    ALL_MODULES,
    BILLABLE_MODULES,
    PERMISSION_CODENAMES,
    filter_codenames_for_tenant,
)
from datetime import date
from decimal import Decimal

from apps.platform_billing.models import (
    Currency,
    ExchangeRate,
    ModulePrice,
    PlatformBillingSettings,
    TaxRate,
    TaxType,
)
from apps.products.models import Category
from apps.tenants.models import Tenant
from apps.tenants.subscription_service import set_module_subscriptions

User = get_user_model()

# Clinic tenant: patients instead of customers (no CRM customers module).
CLINIC_1000_MODULES = [m for m in ALL_MODULES if m != "customers"]


def ensure_permissions() -> dict[str, Permission]:
    perms = {}
    for codename, name in PERMISSION_CODENAMES:
        obj, _ = Permission.objects.get_or_create(codename=codename, defaults={"name": name})
        perms[codename] = obj
    return perms


def ensure_platform_billing_master() -> dict[str, Currency]:
    currencies = {}
    for code, name, symbol, tcmb in (
        ("TRY", "Turkish Lira", "₺", None),
        ("EUR", "Euro", "€", "EUR"),
        ("GBP", "British Pound", "£", "GBP"),
        ("USD", "US Dollar", "$", "USD"),
    ):
        cur, _ = Currency.objects.update_or_create(
            code=code,
            defaults={"name": name, "symbol": symbol, "tcmb_code": tcmb, "is_active": True},
        )
        currencies[code] = cur
    # Legacy: USDT removed in favour of USD (TCMB)
    usdt = Currency.objects.filter(code="USDT").first()
    if usdt:
        Tenant.objects.filter(payment_currency=usdt).update(payment_currency=currencies["USD"])
        usdt.is_active = False
        usdt.save(update_fields=["is_active"])
    from django.utils import timezone

    now = timezone.now()
    ExchangeRate.objects.create(
        currency=currencies["TRY"], rate_to_try=Decimal("1"), source="manual", fetched_at=now
    )
    ExchangeRate.objects.create(
        currency=currencies["EUR"], rate_to_try=Decimal("52.863100"), source="manual", fetched_at=now
    )
    ExchangeRate.objects.create(
        currency=currencies["GBP"], rate_to_try=Decimal("61.144600"), source="manual", fetched_at=now
    )
    # USD/EUR/GBP: updated hourly from TCMB via Celery (see ensure_periodic_tasks)
    tax_type, _ = TaxType.objects.get_or_create(code="KDV", defaults={"name": "Katma Değer Vergisi"})
    TaxRate.objects.get_or_create(
        tax_type=tax_type,
        rate_percent=Decimal("20"),
        valid_from=date(2020, 1, 1),
        defaults={"is_active": True},
    )
    PlatformBillingSettings.get_solo()
    for slug in BILLABLE_MODULES:
        ModulePrice.objects.get_or_create(
            module_slug=slug,
            defaults={"price_per_user_monthly": Decimal("50.00")},
        )
    return currencies


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
    allowed = filter_codenames_for_tenant(codenames, tenant.enabled_modules)
    dept.permissions.set([perm_index[c] for c in allowed if c in perm_index])
    return dept


class Command(BaseCommand):
    help = "Seed demo tenants (1000, 3000), RBAC, and staff users."

    @transaction.atomic
    def handle(self, *args, **options):
        perm_index = ensure_permissions()
        ensure_periodic_tasks()
        currencies = ensure_platform_billing_master()

        t1000, _ = Tenant.objects.update_or_create(
            customer_code="1000",
            defaults={
                "name": "Demo Clinic 1000",
                "default_language": Tenant.Language.TR,
                "is_active": True,
                "enabled_modules": CLINIC_1000_MODULES,
                "max_users": 10,
                "billing_period": Tenant.BillingPeriod.MONTHLY,
                "payment_currency": currencies["TRY"],
            },
        )
        t3000, _ = Tenant.objects.update_or_create(
            customer_code="3000",
            defaults={
                "name": "Demo Enterprise 3000",
                "default_language": Tenant.Language.TR,
                "is_active": True,
                "enabled_modules": ALL_MODULES,
                "max_users": 10,
                "billing_period": Tenant.BillingPeriod.YEARLY,
                "payment_currency": currencies["EUR"],
                "yearly_discount_percent": Decimal("10"),
            },
        )
        set_module_subscriptions(t1000, CLINIC_1000_MODULES, extra_modules=set())
        set_module_subscriptions(
            t3000,
            list(ALL_MODULES),
            extra_modules=set(),
            module_parents={"patients": "customers"},
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
        clinic_cashier_codes = [
            "billing.read",
            "billing.write",
            "patients.read",
            "dashboard.read",
        ]
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
            "dashboard.read",
        ]

        d1000_admin = mk_department(t1000, "admin", "Admin", admin_codes, perm_index)
        d1000_tech = mk_department(t1000, "technician", "Technician", tech_codes, perm_index)
        d1000_cash = mk_department(t1000, "cashier", "Cashier", clinic_cashier_codes, perm_index)

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

        hr, hr_created = User.all_tenants.get_or_create(
            tenant=t1000,
            email="hr@admin.com",
            defaults={"department": d1000_cash, "is_active": True},
        )
        hr.department = d1000_cash
        hr.is_active = True
        hr.set_password(demo_pw)
        hr.save()
        hr_extra = [perm_index[c] for c in ("employees.read", "employees.write") if c in perm_index]
        hr.extra_permissions.set(hr_extra)
        hr_status = "created" if hr_created else "updated"
        self.stdout.write(self.style.SUCCESS(f"{hr_status} user hr@admin.com @ 1000 (HR extra perms)"))

        platform_email = "aykutt.ars@gmail.com"
        platform_pw = demo_pw
        pu, pcreated = User.all_tenants.get_or_create(
            tenant=None,
            email=platform_email,
            defaults={
                "is_superuser": True,
                "is_staff": True,
                "is_active": True,
            },
        )
        pu.is_superuser = True
        pu.is_staff = True
        pu.is_active = True
        pu.tenant = None
        pu.department = None
        pu.set_password(platform_pw)
        pu.save()
        pstatus = "created" if pcreated else "updated"
        self.stdout.write(
            self.style.SUCCESS(f"{pstatus} platform admin {platform_email}")
        )

        self.stdout.write(self.style.SUCCESS("seed_demo completed."))
