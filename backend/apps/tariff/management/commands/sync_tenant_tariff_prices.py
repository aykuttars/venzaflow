from __future__ import annotations

from django.core.management.base import BaseCommand

from apps.tariff.services.tenant_prices import ensure_tenant_tariff_prices
from apps.tariff.services.tenant_year_sync import oral_tenant_ids


class Command(BaseCommand):
    help = "Ensure tenant TDB tariff price rows exist at reference floor for active tariff."

    def add_arguments(self, parser):
        parser.add_argument(
            "--all-tenants",
            action="store_true",
            help="Sync all oral-enabled tenants",
        )
        parser.add_argument(
            "--tenant-id",
            type=int,
            help="Single tenant id",
        )

    def handle(self, *args, **options):
        if options["tenant_id"]:
            tenant_ids = [options["tenant_id"]]
        elif options["all_tenants"]:
            tenant_ids = oral_tenant_ids()
        else:
            self.stderr.write("Specify --all-tenants or --tenant-id")
            return

        for tenant_id in tenant_ids:
            stats = ensure_tenant_tariff_prices(tenant_id)
            self.stdout.write(self.style.SUCCESS(f"Tenant {tenant_id}: {stats}"))
