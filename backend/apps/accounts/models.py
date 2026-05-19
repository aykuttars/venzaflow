from __future__ import annotations

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models

from apps.tenants.context import get_current_tenant_id
from apps.tenants.models import Tenant, TenantOwnedModel


class Permission(models.Model):
    """Global permission codenames (not tenant-specific)."""

    codename = models.CharField(max_length=128, unique=True)
    name = models.CharField(max_length=128)

    class Meta:
        ordering = ["codename"]

    def __str__(self) -> str:
        return self.codename


class Department(TenantOwnedModel):
    key = models.SlugField(max_length=64, help_text="Stable key e.g. admin, cashier.")
    name = models.CharField(max_length=128)
    permissions = models.ManyToManyField(Permission, related_name="departments", blank=True)

    class Meta:
        unique_together = [("tenant", "key")]
        ordering = ["tenant_id", "key"]

    def __str__(self) -> str:
        return f"{self.tenant.customer_code}:{self.name}"


class UserManager(BaseUserManager):
    def get_queryset(self):
        qs = super().get_queryset()
        tid = get_current_tenant_id()
        if tid is not None:
            return qs.filter(tenant_id=tid)
        return qs

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        # username filled in save usually
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(email, password, **extra_fields)


class AllUsersManager(BaseUserManager):
    """Unfiltered queryset (login, token refresh)."""

    def get_queryset(self):
        return super().get_queryset()


class User(AbstractBaseUser, PermissionsMixin):
    """Tenant-scoped user. Emails may duplicate across tenants."""

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="users")
    department = models.ForeignKey(
        Department,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="users",
    )
    email = models.EmailField()
    username = models.CharField(
        max_length=191,
        unique=True,
        db_index=True,
        help_text="Opaque unique login identifier (tenant-bound composite).",
    )
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)
    extra_permissions = models.ManyToManyField(
        Permission,
        related_name="users_with_extra",
        blank=True,
        help_text="Additional permissions on top of the user's department.",
    )

    objects = UserManager()
    all_tenants = AllUsersManager()

    USERNAME_FIELD = "username"
    REQUIRED_FIELDS: list[str] = ["email", "tenant_id"]

    class Meta:
        unique_together = [("tenant", "email")]
        indexes = [
            models.Index(fields=["tenant", "email"]),
        ]

    def save(self, *args, **kwargs):
        if self.email:
            self.email = BaseUserManager.normalize_email(self.email)
        # Deterministic unique username for Django auth
        if self.tenant_id and self.email:
            self.username = f"{self.tenant_id}_{self.email}"
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.email} @ {self.tenant.customer_code}"

    def effective_permission_codenames(self) -> set[str]:
        codes: set[str] = set()
        if self.department_id:
            codes.update(
                self.department.permissions.values_list("codename", flat=True)
            )
        codes.update(self.extra_permissions.values_list("codename", flat=True))
        return codes

    def has_permission_codename(self, codename: str) -> bool:
        if not self.is_active:
            return False
        if self.is_superuser:
            return True
        return codename in self.effective_permission_codenames()
