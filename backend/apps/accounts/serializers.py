from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.accounts.models import Department, Permission

User = get_user_model()


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ("id", "codename", "name")


class DepartmentSerializer(serializers.ModelSerializer):
    """Lists permission codenames; writes accept the same list."""

    permission_codenames = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        write_only=False,
    )

    class Meta:
        model = Department
        fields = ("id", "key", "name", "permission_codenames")

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["permission_codenames"] = list(
            instance.permissions.order_by("codename").values_list("codename", flat=True)
        )
        return data

    def create(self, validated_data):
        codes = validated_data.pop("permission_codenames", [])
        tenant_id = validated_data.pop("tenant_id")
        dept = Department.objects.create(tenant_id=tenant_id, **validated_data)
        if codes:
            dept.permissions.set(Permission.objects.filter(codename__in=codes))
        return dept

    def update(self, instance, validated_data):
        codes = validated_data.pop("permission_codenames", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if codes is not None:
            instance.permissions.set(Permission.objects.filter(codename__in=codes))
        return instance


class UserSerializer(serializers.ModelSerializer):
    department = DepartmentSerializer(read_only=True)
    tenant_code = serializers.CharField(source="tenant.customer_code", read_only=True)
    tenant_name = serializers.CharField(source="tenant.name", read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "tenant_code",
            "tenant_name",
            "first_name",
            "last_name",
            "department",
            "is_active",
        )


class LoginSerializer(serializers.Serializer):
    customer_code = serializers.CharField()
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        from apps.tenants.models import Tenant

        code = attrs["customer_code"].strip()
        email = attrs["email"].strip().lower()
        password = attrs["password"]

        tenant = Tenant.objects.filter(customer_code=code, is_active=True).first()
        if not tenant:
            raise serializers.ValidationError({"detail": "Invalid credentials."})

        user = (
            User.all_tenants
            .filter(tenant=tenant, email__iexact=email, is_active=True)
            .first()
        )
        if not user or not user.check_password(password):
            raise serializers.ValidationError({"detail": "Invalid credentials."})
        attrs["user"] = user
        return attrs
