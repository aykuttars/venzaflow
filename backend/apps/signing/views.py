from __future__ import annotations

import base64

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.viewsets import TenantScopedViewSet
from apps.integrations.authority import AuthorityError, submit_to_authority
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
from apps.signing.services.integration_config import supplier_dict
from apps.signing.services.task_factory import sync_tasks
from apps.signing.services.ubl import build_invoice_ubl
from apps.signing.services.verifier import SignatureVerificationError, verify_signature
from apps.signing.services.xades import inject_signature, prepare_xades

# Document families that are signed as XAdES-BES over UBL-TR XML.
GIB_XADES_DOCS = {SignTask.DocumentType.EFATURA, SignTask.DocumentType.EARSIV}


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

    def _is_xades(self, task: SignTask) -> bool:
        """e-Fatura/e-Arşiv tasks backed by a real Invoice are signed as XAdES."""
        return (
            task.document_type in GIB_XADES_DOCS
            and task.content_type is not None
            and task.content_type.model == "invoice"
        )

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

        metadata = dict(task.metadata or {})

        if self._is_xades(task):
            cert_b64 = ser.validated_data.get("certificate_der_base64") or ""
            if not cert_b64:
                return Response(
                    {"detail": "e-Fatura/e-Arşiv imzası için sertifika (certificate_der_base64) zorunludur."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                cert_der = base64.b64decode(cert_b64)
            except Exception:
                return Response(
                    {"detail": "Geçersiz sertifika base64 verisi."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            xml_bytes, doc_meta = build_invoice_ubl(
                task.source, task.document_type, supplier=supplier_dict(task.tenant)
            )
            prepared = prepare_xades(
                xml_bytes, cert_der, signing_time=timezone.now().isoformat()
            )
            task.data_to_sign = base64.b64encode(prepared.signed_info_c14n).decode("ascii")
            task.signed_document = prepared.signed_document_template.decode("utf-8")
            metadata.update(doc_meta)
            metadata["xades"] = True
        else:
            payload = build_payload(task)
            task.data_to_sign = base64.b64encode(payload).decode("ascii")
            metadata["xades"] = False

        task.metadata = metadata
        task.algorithm = "SHA256_RSA_PKCS"
        task.status = SignTask.Status.PREPARED
        task.prepared_at = timezone.now()
        task.error_message = ""
        task.save(
            update_fields=[
                "data_to_sign",
                "signed_document",
                "metadata",
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

        # For XAdES documents, embed the signature value into the UBL template
        # so the stored artifact is the final signed XML submitted to GİB.
        signed_document_bytes: bytes | None = None
        if (task.metadata or {}).get("xades") and task.signed_document:
            try:
                signature_bytes = base64.b64decode(data["signature_base64"])
                final_xml = inject_signature(
                    task.signed_document.encode("utf-8"), signature_bytes
                )
                task.signed_document = final_xml.decode("utf-8")
                signed_document_bytes = final_xml
            except Exception as exc:
                task.status = SignTask.Status.FAILED
                task.error_message = f"İmzalı belge oluşturulamadı: {exc}"
                task.save(update_fields=["status", "error_message", "updated_at"])
                return Response({"detail": task.error_message}, status=status.HTTP_400_BAD_REQUEST)

        task.save(
            update_fields=[
                "signature",
                "certificate_der",
                "signer",
                "status",
                "signed_at",
                "signed_document",
                "updated_at",
            ]
        )

        try:
            result = submit_to_authority(task, signed_document=signed_document_bytes)
        except AuthorityError as exc:
            task.status = SignTask.Status.FAILED
            task.error_message = f"Otorite gönderimi başarısız: {exc}"
            task.provider_payload = exc.payload or {}
            task.save(
                update_fields=["status", "error_message", "provider_payload", "updated_at"]
            )
            return Response({"detail": task.error_message}, status=status.HTTP_502_BAD_GATEWAY)
        except Exception as exc:  # defensive: never leak a 500 on submission
            task.status = SignTask.Status.FAILED
            task.error_message = f"Otorite gönderimi başarısız: {exc}"
            task.save(update_fields=["status", "error_message", "updated_at"])
            return Response({"detail": task.error_message}, status=status.HTTP_502_BAD_GATEWAY)

        task.external_reference = result.external_reference
        task.provider = result.provider
        task.provider_status = result.status
        task.provider_payload = result.payload or {}
        task.status = SignTask.Status.SUBMITTED
        task.submitted_at = timezone.now()
        task.error_message = ""
        task.save(
            update_fields=[
                "external_reference",
                "provider",
                "provider_status",
                "provider_payload",
                "status",
                "submitted_at",
                "error_message",
                "updated_at",
            ]
        )

        out = SignCompleteResponseSerializer(task)
        return Response(out.data)
