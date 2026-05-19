from __future__ import annotations

from rest_framework import serializers

from apps.tenants.models import Tenant


class TenantProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tenant
        fields = ("id", "customer_code", "name", "is_active", "enabled_modules")
        read_only_fields = ("id", "customer_code", "is_active", "enabled_modules")
