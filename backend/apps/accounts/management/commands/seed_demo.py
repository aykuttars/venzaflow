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
from apps.products.models import Category, Product
from apps.tenants.models import Tenant
from apps.tenants.subscription_service import set_module_subscriptions
from apps.oral.seed_data import ensure_clinic_demo_patients
from apps.oral.services.cleanup_legacy import cleanup_legacy_demo_procedures
from apps.oral.services.tariff_procedure_sync import sync_tdb_procedures_for_tenant
from apps.tariff.services.validation import get_active_tariff
from apps.billing.seed_clinic_demo import ensure_clinic_billing_signing_demo
from apps.prescriptions.seed_data import ensure_prescription_demo
from apps.products.seed_hardware_retail import seed_hardware_retail_tenant

User = get_user_model()

# Demo dental clinic: patients + oral stack; no CRM customers, retail barcode, or service desk.
CLINIC_1000_MODULES = [
    "settings",
    "employees",
    "products",
    "inventory",
    "patients",
    "oral",
    "appointments",
    "billing",
    "accounting",
    "dashboard",
    "audit",
    "signing",
]


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
    dental_tax, _ = TaxType.objects.get_or_create(
        code="KDV10",
        defaults={"name": "KDV %10 (Diş Hekimliği)", "description": "TDB rehber tarife KDV oranı"},
    )
    TaxRate.objects.get_or_create(
        tax_type=dental_tax,
        rate_percent=Decimal("10"),
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
                "name": "Demo Özel Diş Kliniği 1000",
                "default_language": Tenant.Language.TR,
                "is_active": True,
                "enabled_modules": CLINIC_1000_MODULES,
                "max_users": 15,
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
        set_module_subscriptions(
            t1000,
            CLINIC_1000_MODULES,
            extra_modules=set(),
            module_parents={"oral": "patients"},
        )
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
            "oral.read",
            "prescriptions.read",
            "signing.read",
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
            "prescriptions.read",
            "prescriptions.write",
            "oral.read",
            "oral.write",
            "appointments.read",
            "appointments.write",
            "dashboard.read",
        ]
        dentist_codes = [
            "patients.read",
            "patients.write",
            "prescriptions.read",
            "prescriptions.write",
            "oral.read",
            "oral.write",
            "appointments.read",
            "appointments.write",
            "dashboard.read",
        ]

        d1000_admin = mk_department(t1000, "admin", "Admin", admin_codes, perm_index)
        d1000_tech = mk_department(t1000, "technician", "Technician", tech_codes, perm_index)
        d1000_cash = mk_department(t1000, "cashier", "Cashier", clinic_cashier_codes, perm_index)
        d1000_dentist = mk_department(t1000, "dentist", "Dentist", dentist_codes, perm_index)

        d3000_admin = mk_department(t3000, "admin", "Admin", admin_codes, perm_index)
        d3000_acc = mk_department(t3000, "accounting", "Accounting", accounting_codes, perm_index)
        d3000_sec = mk_department(t3000, "security", "Security", security_codes, perm_index)
        d3000_doc = mk_department(t3000, "doctor", "Doctor", doctor_codes, perm_index)

        for tenant in (t1000, t3000):
            ensure_product_categories(tenant)

        legacy_stats = cleanup_legacy_demo_procedures(t1000.pk)
        self.stdout.write(
            self.style.SUCCESS(
                f"tenant 1000 legacy oral cleanup: "
                f"{legacy_stats['procedures_deleted']} procedure(s), "
                f"{legacy_stats['products_deleted']} product(s)"
            )
        )
        if get_active_tariff():
            tdb_stats = sync_tdb_procedures_for_tenant(t1000.pk)
            self.stdout.write(
                self.style.SUCCESS(
                    f"tenant 1000 TDB sync: {tdb_stats['synced']} item(s), "
                    f"+{tdb_stats['created']} created"
                )
            )
        ensure_clinic_demo_patients(t1000)
        demo_stats = ensure_clinic_billing_signing_demo(t1000)
        self.stdout.write(
            self.style.SUCCESS(
                f"tenant 1000 billing/signing demo: "
                f"{demo_stats['invoices']} invoice(s), "
                f"{demo_stats['payments']} payment(s), "
                f"{demo_stats['sign_tasks']} sign task(s)"
            )
        )

        demo_pw = "X7@qL9#vT2!mZ4$k"
        users: list[tuple] = [
            (t1000, d1000_admin, "admin@admin.com", demo_pw, "", "", ""),
            (t1000, d1000_tech, "tech@admin.com", demo_pw, "", "", ""),
            (t1000, d1000_cash, "cash@admin.com", demo_pw, "", "", ""),
            (t3000, d3000_admin, "admin@admin.com", demo_pw, "", "", ""),
            (t3000, d3000_acc, "accounting@admin.com", demo_pw, "", "", ""),
            (t3000, d3000_sec, "security@admin.com", demo_pw, "", "", ""),
            (t3000, d3000_doc, "doctor@admin.com", demo_pw, "", "", ""),
        ]
        for email, first, last, tckn in (
            ("doctor@admin.com", "Demo", "Hekim", "99999999990"),
            ("dr.ali@admin.com", "Ali", "Yılmaz", "88888888880"),
            ("dr.ayse@admin.com", "Ayşe", "Demir", "77777777770"),
            ("dr.mehmet@admin.com", "Mehmet", "Kaya", "66666666660"),
        ):
            users.append((t1000, d1000_dentist, email, demo_pw, first, last, tckn))

        for tenant, dept, email, password, first_name, last_name, tckn in users:
            u, created = User.all_tenants.get_or_create(
                tenant=tenant,
                email=email.lower(),
                defaults={
                    "department": dept,
                    "is_active": True,
                    "first_name": first_name,
                    "last_name": last_name,
                    "tckn": tckn,
                },
            )
            u.department = dept
            u.is_active = True
            u.first_name = first_name or u.first_name
            u.last_name = last_name or u.last_name
            u.tckn = tckn or u.tckn
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

        demo_doctor = User.all_tenants.filter(tenant=t1000, email="doctor@admin.com").first()
        if demo_doctor:
            rx_stats = ensure_prescription_demo(t1000, doctor=demo_doctor)
            self.stdout.write(
                self.style.SUCCESS(
                    f"tenant 1000 prescription demo: "
                    f"{rx_stats['drugs']} drug(s), "
                    f"{rx_stats['prescriptions']} prescription(s), "
                    f"{rx_stats['sign_tasks']} e-Reçete task(s)"
                )
            )

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

        hw = seed_hardware_retail_tenant(payment_currency=currencies.get("TRY"))
        self.stdout.write(
            self.style.SUCCESS(
                f"hardware retail tenant {hw.customer_code} ({hw.name}) — "
                f"{Product.objects.filter(tenant=hw).count()} products"
            )
        )

        self.stdout.write(self.style.SUCCESS("seed_demo completed."))
