from __future__ import annotations

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.barcode.services.seed_templates import seed_default_templates
from apps.tenants.models import TenantModuleSubscription


@receiver(post_save, sender=TenantModuleSubscription)
def seed_barcode_templates_on_subscribe(sender, instance, created, **kwargs):
    if not instance.is_active or instance.module_slug != "barcode":
        return
    seed_default_templates(instance.tenant_id, skip_existing=True)
