from __future__ import annotations

import base64

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.viewsets import TenantScopedViewSet
from apps.integrations.authority import submit_to_authority
from apps.signing.models import SignTask
from apps.signing.serializers import (
    SignCompleteRequestSerializer,
    SignCompleteResponseSerializer,
    SignPrepareRequestSerializer,
    SignPrepareResponseSerializer,
    SignTaskCreateSerializer,
    SignTaskSerializer,
)
from apps.signing.services.document_builder import build_payload
from apps.signing.services.task_factory import sync_tasks
from apps.signing.services.verifier import SignatureVerificationError, verify_signature


class SignTaskViewSet(TenantScopedViewSet):
    queryset = SignTask.objects.all()
    serializer_class = SignTaskSerializer
    required_module = "signing"
    action_permission_map = {
        "list": "signing.read",
        "retrieve": "signing.read",
        "create": "signing.write",
        "prepare": "signing.write",
        "complete": "signing.write",
    }
    filterset_fields = ("document_type", "status")
    ordering_fields = ("created_at", "status")

    def get_queryset(self):
        qs = super().get_queryset().select_related("signer")
        document_type = self.request.query_params.get("document_type")
        if document_type:
            qs = qs.filter(document_type=document_type)
        return qs

    def list(self, request, *args, **kwargs):
        document_type = request.query_params.get("document_type")
        sync_tasks(request.user.tenant, document_type=document_type)
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        ser = SignTaskCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        title = data.get("title") or f"Manuel imza — {data['document_type']}"
        task = SignTask.objects.create(
            tenant=request.user.tenant,
            document_type=data["document_type"],
            title=title,
            description=data.get("description", ""),
            metadata=data.get("metadata") or {},
            status=SignTask.Status.PENDING,
        )
        out = SignTaskSerializer(task)
        return Response(out.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="prepare")
    def prepare(self, request, pk=None):
        task: SignTask = self.get_object()
        ser = SignPrepareRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        if task.status in (SignTask.Status.SUBMITTED, SignTask.Status.SIGNED):
            return Response(
                {"detail": "Bu görev zaten imzalanmış veya gönderilmiş."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        payload = build_payload(task)
        task.data_to_sign = base64.b64encode(payload).decode("ascii")
        task.algorithm = "SHA256_RSA_PKCS"
        task.status = SignTask.Status.PREPARED
        task.prepared_at = timezone.now()
        task.error_message = ""
        task.save(
            update_fields=[
                "data_to_sign",
                "algorithm",
                "status",
                "prepared_at",
                "error_message",
                "updated_at",
            ]
        )

        out = SignPrepareResponseSerializer(task)
        return Response(out.data)

    @action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, pk=None):
        task: SignTask = self.get_object()
        ser = SignCompleteRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        if not task.data_to_sign:
            return Response(
                {"detail": "Görev hazırlanmadan imza tamamlanamaz. Önce prepare çağırın."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if task.status == SignTask.Status.SUBMITTED:
            out = SignCompleteResponseSerializer(task)
            return Response(out.data)

        data = ser.validated_data
        payload = base64.b64decode(task.data_to_sign)

        try:
            verify_signature(
                data["certificate_der_base64"],
                payload,
                data["signature_base64"],
                algorithm=task.algorithm,
            )
        except SignatureVerificationError as exc:
            task.status = SignTask.Status.FAILED
            task.error_message = str(exc)
            task.save(update_fields=["status", "error_message", "updated_at"])
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        task.signature = data["signature_base64"]
        task.certificate_der = data["certificate_der_base64"]
        task.signer = request.user
        task.status = SignTask.Status.SIGNED
        task.signed_at = timezone.now()
        task.save(
            update_fields=[
                "signature",
                "certificate_der",
                "signer",
                "status",
                "signed_at",
                "updated_at",
            ]
        )

        try:
            external_ref = submit_to_authority(task)
            task.external_reference = external_ref
            task.status = SignTask.Status.SUBMITTED
            task.submitted_at = timezone.now()
            task.error_message = ""
            task.save(
                update_fields=[
                    "external_reference",
                    "status",
                    "submitted_at",
                    "error_message",
                    "updated_at",
                ]
            )
        except Exception as exc:
            task.status = SignTask.Status.FAILED
            task.error_message = f"Otorite gönderimi başarısız: {exc}"
            task.save(update_fields=["status", "error_message", "updated_at"])
            return Response({"detail": task.error_message}, status=status.HTTP_502_BAD_GATEWAY)

        out = SignCompleteResponseSerializer(task)
        return Response(out.data)
