from __future__ import annotations

from rest_framework import serializers

from apps.common.permission_codes import ALL_MODULES
from apps.tenants.models import Tenant


class TenantProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tenant
        fields = (
            "id",
            "customer_code",
            "name",
            "default_language",
            "is_active",
            "enabled_modules",
            "module_labels",
        )
        read_only_fields = ("id", "customer_code", "is_active", "enabled_modules")

    def validate_module_labels(self, value):
        if value is None:
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError("module_labels must be an object.")
        allowed = set(ALL_MODULES)
        cleaned: dict[str, str] = {}
        for key, label in value.items():
            if key not in allowed:
                raise serializers.ValidationError(
                    {key: f"Unknown module slug. Allowed: {', '.join(sorted(allowed))}"}
                )
            if not isinstance(label, str):
                raise serializers.ValidationError({key: "Label must be a string."})
            text = label.strip()
            if not text:
                raise serializers.ValidationError({key: "Label cannot be empty."})
            if len(text) > 64:
                raise serializers.ValidationError({key: "Label must be at most 64 characters."})
            cleaned[key] = text
        return cleaned
