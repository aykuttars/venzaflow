from __future__ import annotations

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.barcode.services.generate import generate_missing_barcodes
from apps.barcode.services.seed_templates import seed_default_templates
from apps.barcode.services.settings import get_or_create_settings
from apps.products.models import Product
from apps.tenants.models import TenantModuleSubscription


@receiver(post_save, sender=TenantModuleSubscription)
def seed_barcode_templates_on_subscribe(sender, instance, created, **kwargs):
    if not instance.is_active or instance.module_slug != "barcode":
        return
    seed_default_templates(instance.tenant_id, skip_existing=True)


@receiver(post_save, sender=Product)
def auto_generate_barcode_on_product_create(sender, instance, created, **kwargs):
    if not created or (instance.barcode or "").strip():
        return
    settings = get_or_create_settings(instance.tenant_id)
    if not settings.auto_generate_on_create:
        return
    generate_missing_barcodes(instance.tenant_id, limit=1, product_id=instance.pk)
