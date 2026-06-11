from __future__ import annotations

from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models

from apps.tenants.models import Tenant, TenantOwnedModel


class SignTask(TenantOwnedModel):
    class DocumentType(models.TextChoices):
        ERECETE = "erecete", "e-Reçete"
        EARSIV = "earsiv", "e-Arşiv"
        EFATURA = "efatura", "e-Fatura"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PREPARED = "prepared", "Prepared"
        SIGNED = "signed", "Signed"
        SUBMITTED = "submitted", "Submitted"
        FAILED = "failed", "Failed"

    document_type = models.CharField(max_length=16, choices=DocumentType.choices)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)

    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sign_tasks",
    )
    object_id = models.PositiveBigIntegerField(null=True, blank=True)
    source = GenericForeignKey("content_type", "object_id")

    data_to_sign = models.TextField(blank=True, help_text="Base64-encoded payload bytes")
    algorithm = models.CharField(max_length=64, default="SHA256_RSA_PKCS")
    signature = models.TextField(blank=True, help_text="Base64-encoded signature")
    certificate_der = models.TextField(blank=True, help_text="Base64-encoded signer certificate DER")
    metadata = models.JSONField(default=dict, blank=True)

    signer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sign_tasks",
    )
    external_reference = models.CharField(max_length=255, blank=True)
    error_message = models.TextField(blank=True)

    # Final signed artifact (e.g. XAdES-signed UBL-TR XML for GİB documents).
    signed_document = models.TextField(blank=True)
    # Authority/integrator that handled submission + its normalized status.
    provider = models.CharField(max_length=32, blank=True)
    provider_status = models.CharField(max_length=64, blank=True)
    provider_payload = models.JSONField(default=dict, blank=True)

    prepared_at = models.DateTimeField(null=True, blank=True)
    signed_at = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "sign_task"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["tenant", "document_type", "status"]),
            models.Index(fields=["tenant", "content_type", "object_id"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "content_type", "object_id", "document_type"],
                condition=models.Q(content_type__isnull=False, object_id__isnull=False),
                name="uniq_sign_task_source_per_type",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.get_document_type_display()} — {self.title} ({self.status})"


class CertificateType(models.TextChoices):
    MALI_MUHUR = "mali_muhur", "Mali Mühür (kurumsal)"
    PERSONAL = "personal", "Kişisel e-imza"


class DocumentFamily(models.TextChoices):
    EFATURA = "efatura", "e-Fatura"
    EARSIV = "earsiv", "e-Arşiv"
    ERECETE = "erecete", "e-Reçete"


class SigningMode(models.TextChoices):
    # We build the XAdES signature locally (eimza personal cert / Mali Mühür).
    CLIENT_XADES = "client_xades", "İmza bizde (XAdES)"
    # The integrator seals the document on submission (their Mali Mühür).
    PROVIDER_SEAL = "provider_seal", "İmza entegratörde (mali mühür)"


class Environment(models.TextChoices):
    TEST = "test", "Test / Sandbox"
    PROD = "prod", "Canlı"


class TenantSigningProfile(models.Model):
    """Per-tenant legal sender identity used when building UBL-TR documents."""

    tenant = models.OneToOneField(
        Tenant, on_delete=models.CASCADE, related_name="signing_profile"
    )
    supplier_vkn = models.CharField(max_length=11, blank=True)
    supplier_title = models.CharField(max_length=255, blank=True)
    supplier_tax_office = models.CharField(max_length=128, blank=True)
    supplier_city = models.CharField(max_length=128, blank=True)
    supplier_district = models.CharField(max_length=128, blank=True)
    supplier_street = models.CharField(max_length=255, blank=True)
    supplier_country = models.CharField(max_length=64, default="Türkiye")
    certificate_type = models.CharField(
        max_length=16, choices=CertificateType.choices, default=CertificateType.PERSONAL
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "tenant_signing_profile"

    def __str__(self) -> str:
        return f"SigningProfile<{self.tenant_id}>"


class IntegrationConnection(TenantOwnedModel):
    """A configured integrator account for a tenant (Nilvera, Medula, ...).

    Credentials are stored encrypted (Fernet) and never returned to clients.
    A single connection can serve multiple document families via routing.
    """

    class Status(models.TextChoices):
        UNTESTED = "untested", "Test edilmedi"
        OK = "ok", "Bağlantı başarılı"
        ERROR = "error", "Bağlantı hatası"

    display_name = models.CharField(max_length=128, blank=True)
    provider_key = models.CharField(max_length=32)
    environment = models.CharField(
        max_length=8, choices=Environment.choices, default=Environment.TEST
    )
    signing_mode = models.CharField(
        max_length=16, choices=SigningMode.choices, default=SigningMode.CLIENT_XADES
    )
    credentials_encrypted = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.UNTESTED)
    status_message = models.CharField(max_length=255, blank=True)
    last_checked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "integration_connection"
        ordering = ["provider_key", "id"]
        indexes = [models.Index(fields=["tenant", "provider_key"])]

    def __str__(self) -> str:
        return f"{self.provider_key} ({self.environment})"


class DocumentRouting(TenantOwnedModel):
    """Maps a document family to the connection that handles it for a tenant."""

    document_family = models.CharField(max_length=16, choices=DocumentFamily.choices)
    connection = models.ForeignKey(
        IntegrationConnection, on_delete=models.CASCADE, related_name="routings"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "document_routing"
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "document_family"], name="uniq_routing_per_family"
            )
        ]

    def __str__(self) -> str:
        return f"{self.document_family} -> {self.connection_id}"
