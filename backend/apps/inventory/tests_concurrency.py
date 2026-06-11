"""Movement service concurrency: parallel updates must not oversell stock."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed

from django.db import connections
from django.test import TransactionTestCase

from apps.inventory.models import MovementType, Stock, Warehouse
from apps.inventory.services.movement import MovementInput, MovementService, MovementServiceError
from apps.products.models import Category, Product
from apps.tenants.models import Tenant


class MovementConcurrencyTests(TransactionTestCase):
    """TransactionTestCase so each thread gets its own DB connection."""

    def setUp(self):
        self.tenant = Tenant.objects.create(customer_code="CONC", name="Concurrency", max_users=5)
        cat = Category.objects.create(tenant=self.tenant, name="C", slug="c")
        self.product = Product.objects.create(
            tenant=self.tenant,
            sku="CONC-SKU",
            name="Item",
            category=cat,
            unit_price="10.00",
        )
        wh = Warehouse.objects.create(tenant=self.tenant, code="W1", name="W")
        self.stock = Stock.objects.create(
            tenant=self.tenant,
            product=self.product,
            warehouse=wh,
            quantity=10,
        )

    def _sale_once(self, errors: list) -> None:
        connections.close_all()
        try:
            MovementService.apply_movement(
                MovementInput(
                    stock=self.stock,
                    movement_type=MovementType.SALE.value,
                    quantity=8,
                    tenant_id=self.tenant.id,
                )
            )
        except MovementServiceError as exc:
            errors.append(str(exc))

    def test_parallel_sales_only_one_succeeds(self):
        errors: list[str] = []
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(self._sale_once, errors) for _ in range(2)]
            for f in as_completed(futures):
                f.result()

        self.stock.refresh_from_db()
        self.assertEqual(len(errors), 1, errors)
        self.assertEqual(self.stock.quantity, 2)
