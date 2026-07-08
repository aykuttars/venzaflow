from __future__ import annotations

from django.core.management.base import BaseCommand

from apps.oral.services.tariff_procedure_sync import (
    sync_tdb_procedures_all_tenants,
    sync_tdb_procedures_for_tenant,
)
from apps.tariff.services.tenant_prices import ensure_tenant_tariff_prices
from apps.tariff.services.tenant_year_sync import oral_tenant_ids


class Command(BaseCommand):
    help = "Sync TDB tariff items to tenant ProcedureCatalog + products."

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
            ensure_tenant_tariff_prices(options["tenant_id"])
            stats = sync_tdb_procedures_for_tenant(options["tenant_id"])
            self.stdout.write(self.style.SUCCESS(f"Tenant {options['tenant_id']}: {stats}"))
            return
        if options["all_tenants"]:
            for tenant_id in oral_tenant_ids():
                ensure_tenant_tariff_prices(tenant_id)
                stats = sync_tdb_procedures_for_tenant(tenant_id)
                self.stdout.write(self.style.SUCCESS(f"Tenant {tenant_id}: {stats}"))
            return
        self.stderr.write("Specify --all-tenants or --tenant-id")
