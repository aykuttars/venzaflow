from django.core.management.base import BaseCommand

from apps.products.seed_hardware_retail import (
    CUSTOMER_CODE,
    DEFAULT_PASSWORD,
    EMAIL_DOMAIN,
    TENANT_NAME,
    seed_hardware_retail_tenant,
)


class Command(BaseCommand):
    help = f"Seed hardware retail demo tenant ({CUSTOMER_CODE} — {TENANT_NAME})."

    def handle(self, *args, **options):
        tenant = seed_hardware_retail_tenant()
        self.stdout.write(self.style.SUCCESS(f"Tenant {tenant.customer_code} — {tenant.name}"))
        from apps.inventory.models import Stock
        from apps.products.models import Product

        n_products = Product.objects.filter(tenant=tenant).count()
        n_stock = Stock.objects.filter(tenant=tenant).count()
        from apps.products.models import Category

        self.stdout.write(f"  Products: {n_products}")
        self.stdout.write(f"  Categories: {Category.objects.filter(tenant=tenant).count()}")
        self.stdout.write(f"  Stock lines: {n_stock}")
        self.stdout.write("")
        self.stdout.write("Login:")
        self.stdout.write(f"  Customer code: {CUSTOMER_CODE}")
        self.stdout.write(f"  Email: yonetici@{EMAIL_DOMAIN}  (or satis@ / depo@)")
        self.stdout.write(f"  Password: {DEFAULT_PASSWORD}")
