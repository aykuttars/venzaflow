from django.test import TestCase

from apps.products.field_validation import FieldValidationError, validate_field_value
from apps.products.models import FieldType, ProductFieldDefinition
from apps.products.ui_defaults import seed_ui_config_for_tenant
from apps.tenants.models import Tenant


class ProductFieldValidationTests(TestCase):
    def setUp(self):
        self.tenant = Tenant.objects.create(customer_code="T2", name="T2")
        self.definition = ProductFieldDefinition.objects.create(
            tenant=self.tenant,
            key="watt",
            label="Watt",
            field_type=FieldType.NUMBER.value,
            is_required=True,
        )

    def test_validate_number(self):
        storage = validate_field_value(self.definition, "120", tenant_id=self.tenant.id)
        self.assertEqual(storage["value_number"], 120)

    def test_required_raises(self):
        with self.assertRaises(FieldValidationError):
            validate_field_value(self.definition, "", tenant_id=self.tenant.id)


class UiConfigSeedTests(TestCase):
    def test_seed_creates_defaults(self):
        tenant = Tenant.objects.create(customer_code="T3", name="T3")
        seed_ui_config_for_tenant(tenant.id)
        from apps.products.models import ProductListColumnConfig

        self.assertTrue(ProductListColumnConfig.objects.filter(tenant=tenant).exists())
