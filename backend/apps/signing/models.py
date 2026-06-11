from __future__ import annotations

from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models

from apps.tenants.models import TenantOwnedModel


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
