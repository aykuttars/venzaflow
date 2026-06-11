from __future__ import annotations

from decimal import Decimal

from django.db import migrations

SIGNING_PERMISSIONS = [
    ("signing.read", "View signing tasks"),
    ("signing.write", "Manage signing tasks"),
]
SIGNING_MODULE_SLUG = "signing"
DEFAULT_PRICE = Decimal("50.00")


def seed_signing_module(apps, schema_editor):
    Permission = apps.get_model("accounts", "Permission")
    for codename, name in SIGNING_PERMISSIONS:
        Permission.objects.get_or_create(codename=codename, defaults={"name": name})

    ModulePrice = apps.get_model("platform_billing", "ModulePrice")
    ModulePrice.objects.get_or_create(
        module_slug=SIGNING_MODULE_SLUG,
        defaults={"price_per_user_monthly": DEFAULT_PRICE, "is_active": True},
    )


def unseed_signing_module(apps, schema_editor):
    Permission = apps.get_model("accounts", "Permission")
    Permission.objects.filter(
        codename__in=[c for c, _ in SIGNING_PERMISSIONS]
    ).delete()

    ModulePrice = apps.get_model("platform_billing", "ModulePrice")
    ModulePrice.objects.filter(module_slug=SIGNING_MODULE_SLUG).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("signing", "0001_initial"),
        ("accounts", "0002_initial"),
        ("platform_billing", "0002_initial"),
    ]

    operations = [
        migrations.RunPython(seed_signing_module, unseed_signing_module),
    ]
