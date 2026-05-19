from __future__ import annotations

from django.test import TestCase

from apps.tenants.models import Tenant
from apps.tenants.serializers import TenantProfileSerializer


class ModuleLabelsSerializerTests(TestCase):
    def test_valid_module_labels(self):
        tenant = Tenant.objects.create(customer_code="ML1", name="Test", enabled_modules=["customers"])
        ser = TenantProfileSerializer(
            tenant,
            data={"module_labels": {"customers": "Hastalar"}},
            partial=True,
        )
        self.assertTrue(ser.is_valid(), ser.errors)
        ser.save()
        tenant.refresh_from_db()
        self.assertEqual(tenant.module_labels, {"customers": "Hastalar"})

    def test_rejects_unknown_slug(self):
        tenant = Tenant.objects.create(customer_code="ML2", name="Test")
        ser = TenantProfileSerializer(tenant, data={"module_labels": {"foo": "Bar"}}, partial=True)
        self.assertFalse(ser.is_valid())
        self.assertIn("foo", ser.errors["module_labels"])
