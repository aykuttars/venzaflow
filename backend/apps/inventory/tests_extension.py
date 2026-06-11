from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.inventory.models import MovementType, Stock, Warehouse
from apps.inventory.services.movement import MovementInput, MovementService, MovementServiceError
from apps.products.models import Category, Product
from apps.tenants.models import Tenant

User = get_user_model()


class MovementServiceTests(TestCase):
    def setUp(self):
        self.tenant = Tenant.objects.create(customer_code="T1", name="T1")
        self.category = Category.objects.create(tenant=self.tenant, name="Cat", slug="cat")
        self.product = Product.objects.create(
            tenant=self.tenant,
            sku="SKU1",
            name="Product",
            category=self.category,
            unit_price="10.00",
        )
        self.warehouse = Warehouse.objects.create(tenant=self.tenant, code="WH1", name="Main")
        self.stock = Stock.objects.create(
            tenant=self.tenant,
            product=self.product,
            warehouse=self.warehouse,
            quantity=10,
        )

    def test_apply_movement_increases_stock(self):
        mv = MovementService.apply_movement(
            MovementInput(
                stock=self.stock,
                movement_type=MovementType.PURCHASE.value,
                quantity=5,
                tenant_id=self.tenant.id,
            )
        )
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity, 15)
        self.assertEqual(mv.delta, 5)
        self.assertEqual(mv.new_quantity, 15)

    def test_apply_movement_prevents_negative(self):
        with self.assertRaises(MovementServiceError):
            MovementService.apply_movement(
                MovementInput(
                    stock=self.stock,
                    movement_type=MovementType.SALE.value,
                    quantity=100,
                    tenant_id=self.tenant.id,
                )
            )

    def test_backward_compat_delta_only(self):
        mv = MovementService.apply_movement(
            MovementInput(
                stock=self.stock,
                movement_type=MovementType.ADJUSTMENT.value,
                delta=-3,
                tenant_id=self.tenant.id,
            )
        )
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity, 7)
        self.assertEqual(mv.delta, -3)
