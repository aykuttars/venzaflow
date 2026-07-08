from __future__ import annotations

from django.core.management.base import BaseCommand

from apps.oral.services.cleanup_legacy import cleanup_legacy_demo_procedures
from apps.oral.services.tariff_procedure_sync import sync_tdb_procedures_for_tenant
from apps.tariff.services.tenant_year_sync import oral_tenant_ids
from apps.tariff.services.validation import get_active_tariff


class Command(BaseCommand):
    help = "Remove pre-TDB demo oral procedures and optionally re-sync TDB catalog."

    def add_arguments(self, parser):
        parser.add_argument("--tenant-id", type=int, help="Single tenant id")
        parser.add_argument(
            "--all-tenants",
            action="store_true",
            help="All tenants with oral module enabled",
        )
        parser.add_argument(
            "--sync-tdb",
            action="store_true",
            help="Re-sync TDB procedures after cleanup when an active tariff exists",
        )

    def handle(self, *args, **options):
        if options["tenant_id"]:
            tenant_ids = [options["tenant_id"]]
        elif options["all_tenants"]:
            tenant_ids = list(oral_tenant_ids())
        else:
            self.stderr.write("Provide --tenant-id or --all-tenants")
            return

        tariff = get_active_tariff()
        for tenant_id in tenant_ids:
            stats = cleanup_legacy_demo_procedures(tenant_id)
            self.stdout.write(
                self.style.SUCCESS(
                    f"tenant {tenant_id}: removed {stats['procedures_deleted']} legacy procedure(s), "
                    f"{stats['treatments_deleted']} treatment(s), {stats['products_deleted']} product(s)"
                )
            )
            if options["sync_tdb"] and tariff:
                sync_stats = sync_tdb_procedures_for_tenant(tenant_id)
                self.stdout.write(
                    self.style.SUCCESS(
                        f"tenant {tenant_id}: TDB sync {sync_stats['synced']} item(s)"
                    )
                )
