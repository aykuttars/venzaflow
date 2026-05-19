from __future__ import annotations

from django.contrib.auth import get_user_model
from django.utils.translation import gettext as _
from rest_framework import serializers

from apps.accounts.models import Department, Permission
from apps.common.password_policy import validate_password_policy

User = get_user_model()


def _tenant_departments(request):
    if request and getattr(request.user, "tenant_id", None):
        return Department.objects.filter(tenant_id=request.user.tenant_id)
    return Department.objects.none()


def _active_admin_count(tenant_id: int, exclude_user_id: int | None = None) -> int:
    qs = User.all_tenants.filter(
        tenant_id=tenant_id,
        is_active=True,
        department__key="admin",
    )
    if exclude_user_id:
        qs = qs.exclude(pk=exclude_user_id)
    return qs.count()


def _set_extra_permissions(user: User, codes: list[str] | None) -> None:
    if codes is None:
        return
    user.extra_permissions.set(Permission.objects.filter(codename__in=codes))


class EmployeeUserSerializer(serializers.ModelSerializer):
    """Tenant staff user exposed via /api/v1/employees/."""

    department_name = serializers.CharField(source="department.name", read_only=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    password_confirm = serializers.CharField(write_only=True, required=False, allow_blank=True)
    extra_permission_codenames = serializers.ListField(
        child=serializers.CharField(),
        required=False,
    )
    department = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.none(),
        allow_null=True,
        required=False,
    )

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "is_active",
            "department",
            "department_name",
            "extra_permission_codenames",
            "password",
            "password_confirm",
        )
        read_only_fields = ("id",)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        self.fields["department"].queryset = _tenant_departments(request)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["extra_permission_codenames"] = list(
            instance.extra_permissions.order_by("codename").values_list("codename", flat=True)
        )
        return data

    def _validate_passwords(self, attrs):
        password = attrs.get("password") or ""
        password_confirm = attrs.get("password_confirm") or ""
        creating = self.instance is None

        if creating:
            if not password:
                raise serializers.ValidationError({"password": _("Password is required.")})
            if not password_confirm:
                raise serializers.ValidationError(
                    {"password_confirm": _("Password confirmation is required.")}
                )
        elif password or password_confirm:
            if password != password_confirm:
                raise serializers.ValidationError(
                    {"password_confirm": _("Passwords do not match.")}
                )
        else:
            attrs.pop("password", None)
            attrs.pop("password_confirm", None)
            return attrs

        if password != password_confirm:
            raise serializers.ValidationError({"password_confirm": _("Passwords do not match.")})
        validate_password_policy(password)
        attrs["password"] = password
        attrs.pop("password_confirm", None)
        return attrs

    def validate(self, attrs):
        attrs = self._validate_passwords(attrs)
        if self.instance is None and attrs.get("department") is None:
            raise serializers.ValidationError({"department": _("Department is required.")})
        return attrs

    def validate_email(self, value):
        return value.strip().lower()

    def validate_department(self, dept):
        if dept is None:
            return dept
        request = self.context.get("request")
        tenant_id = getattr(request.user, "tenant_id", None) if request else None
        if tenant_id and dept.tenant_id != tenant_id:
            raise serializers.ValidationError(_("Department must belong to your tenant."))
        return dept

    def _check_last_admin(self, instance: User, *, deactivating: bool, new_dept: Department | None):
        was_admin = (
            instance.department_id
            and instance.department.key == "admin"
            and instance.is_active
        )
        if not was_admin:
            return
        will_stay_admin = (
            not deactivating
            and new_dept is not None
            and new_dept.key == "admin"
        )
        if will_stay_admin:
            return
        remaining = _active_admin_count(instance.tenant_id, exclude_user_id=instance.pk)
        if remaining == 0:
            raise serializers.ValidationError(
                {"detail": _("Cannot remove or deactivate the last admin for this tenant.")}
            )

    def create(self, validated_data):
        password = validated_data.pop("password")
        extra_codes = validated_data.pop("extra_permission_codenames", [])
        tenant_id = validated_data.pop("tenant_id")
        user = User(tenant_id=tenant_id, **validated_data)
        user.set_password(password)
        user.save()
        _set_extra_permissions(user, extra_codes)
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        extra_codes = validated_data.pop("extra_permission_codenames", None)
        new_active = validated_data.get("is_active", instance.is_active)
        new_dept = validated_data.get("department", instance.department)

        deactivating = instance.is_active and not new_active
        demoting_admin = (
            instance.department_id
            and instance.department.key == "admin"
            and (new_dept is None or new_dept.key != "admin")
        )
        if deactivating or demoting_admin:
            self._check_last_admin(
                instance,
                deactivating=deactivating or not new_active,
                new_dept=new_dept if new_dept and new_dept.key == "admin" else None,
            )

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        _set_extra_permissions(instance, extra_codes)
        return instance
