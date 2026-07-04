from __future__ import annotations

from decimal import Decimal

from django.db import migrations

BARCODE_PERMISSIONS = [
    ("barcode.scan", "Scan barcodes and lookup products"),
    ("barcode.print", "Print labels from templates"),
    ("barcode.labels", "Design and manage label templates"),
    ("barcode.generate", "Generate missing barcodes"),
]
BARCODE_MODULE_SLUG = "barcode"
DEFAULT_PRICE = Decimal("30.00")


def seed_barcode_module(apps, schema_editor):
    Permission = apps.get_model("accounts", "Permission")
    for codename, name in BARCODE_PERMISSIONS:
        Permission.objects.get_or_create(codename=codename, defaults={"name": name})

    ModulePrice = apps.get_model("platform_billing", "ModulePrice")
    ModulePrice.objects.get_or_create(
        module_slug=BARCODE_MODULE_SLUG,
        defaults={"price_per_user_monthly": DEFAULT_PRICE, "is_active": True},
    )


def unseed_barcode_module(apps, schema_editor):
    Permission = apps.get_model("accounts", "Permission")
    Permission.objects.filter(codename__in=[c for c, _ in BARCODE_PERMISSIONS]).delete()

    ModulePrice = apps.get_model("platform_billing", "ModulePrice")
    ModulePrice.objects.filter(module_slug=BARCODE_MODULE_SLUG).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("barcode", "0001_initial"),
        ("accounts", "0002_initial"),
        ("platform_billing", "0002_initial"),
    ]

    operations = [
        migrations.RunPython(seed_barcode_module, unseed_barcode_module),
    ]
