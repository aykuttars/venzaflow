from __future__ import annotations

from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import HasModule, HasViewPermission
from apps.barcode.models import LabelTemplate, LabelTemplateSource, PrintJob, PrintJobStatus, ScanMissAction
from apps.barcode.serializers import (
    BarcodeGenerateSerializer,
    LabelTemplateDuplicateSerializer,
    LabelTemplatePreviewSerializer,
    LabelTemplateSerializer,
    PrintJobCreateSerializer,
    PrintJobSerializer,
    TransferWizardSerializer,
)
from apps.barcode.serializers_settings import PrintJobBatchSerializer
from apps.barcode.services.generate import generate_missing_barcodes
from apps.barcode.services.lookup import lookup_barcode
from apps.barcode.services.preview import render_label_png
from apps.barcode.services.seed_templates import seed_default_templates
from apps.barcode.services.settings import get_or_create_settings
from apps.barcode.services.tspl import render_tspl_batch
from apps.common.viewsets import TenantScopedViewSet
from apps.inventory.models import Stock, Warehouse
from apps.inventory.services.movement import MovementService, MovementServiceError
from apps.products.models import Product


class BarcodeLookupView(APIView):
    permission_classes = [HasModule, HasViewPermission]
    required_module = "barcode"
    required_permission = "barcode.scan"

    def get(self, request):
        code = request.query_params.get("code", "")
        tenant_id = request.user.tenant_id
        settings = get_or_create_settings(tenant_id)
        result = lookup_barcode(tenant_id, code)
        if result:
            return Response(result)

        action = settings.scan_miss_action
        if action == ScanMissAction.IGNORE:
            return Response({"detail": "Product not found.", "found": False}, status=status.HTTP_404_NOT_FOUND)

        return Response(
            {
                "detail": "Product not found.",
                "found": False,
                "code": (code or "").strip(),
                "scan_miss_action": action,
            },
            status=status.HTTP_404_NOT_FOUND,
        )


class BarcodeGenerateView(APIView):
    permission_classes = [HasModule, HasViewPermission]
    required_module = "barcode"
    required_permission = "barcode.generate"

    def post(self, request):
        ser = BarcodeGenerateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        result = generate_missing_barcodes(
            request.user.tenant_id,
            limit=ser.validated_data["limit"],
            product_id=ser.validated_data.get("product_id"),
        )
        return Response(result)


class TransferWizardView(APIView):
    permission_classes = [HasModule, HasViewPermission]
    required_module = "barcode"
    required_permission = "inventory.write"

    def post(self, request):
        ser = TransferWizardSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        tenant_id = request.user.tenant_id

        source_wh = Warehouse.objects.filter(
            tenant_id=tenant_id, code=data["source_warehouse_code"], is_active=True
        ).first()
        target_wh = Warehouse.objects.filter(
            tenant_id=tenant_id, code=data["target_warehouse_code"], is_active=True
        ).first()
        if not source_wh or not target_wh:
            return Response(
                {"detail": "Warehouse not found."}, status=status.HTTP_400_BAD_REQUEST
            )

        target_location = None
        loc_code = (data.get("target_location_code") or "").strip()
        if loc_code:
            target_location = target_wh.locations.filter(code=loc_code, is_active=True).first()

        results = []
        errors = []
        for item in data["items"]:
            product_id = item["product_id"]
            qty = item["quantity"]
            source_stock = Stock.objects.filter(
                tenant_id=tenant_id, product_id=product_id, warehouse=source_wh
            ).first()
            if not source_stock or source_stock.quantity < qty:
                errors.append({"product_id": product_id, "error": "Insufficient source stock."})
                continue

            target_stock, _ = Stock.objects.get_or_create(
                tenant_id=tenant_id,
                product_id=product_id,
                warehouse=target_wh,
                location=target_location,
                defaults={"quantity": 0},
            )
            try:
                out_mv, in_mv = MovementService.transfer(
                    source_stock=source_stock,
                    target_stock=target_stock,
                    quantity=qty,
                    note=data.get("note") or "Barcode transfer",
                    created_by=request.user,
                    tenant_id=tenant_id,
                )
                results.append(
                    {
                        "product_id": product_id,
                        "quantity": qty,
                        "transfer_out_id": out_mv.pk,
                        "transfer_in_id": in_mv.pk,
                    }
                )
            except MovementServiceError as exc:
                errors.append({"product_id": product_id, "error": str(exc)})

        return Response({"transfers": results, "errors": errors})


class LabelTemplateViewSet(TenantScopedViewSet):
    queryset = LabelTemplate.objects.filter(is_active=True)
    serializer_class = LabelTemplateSerializer
    required_module = "barcode"
    action_permission_map = {
        "list": "barcode.print",
        "retrieve": "barcode.print",
        "create": "barcode.labels",
        "update": "barcode.labels",
        "partial_update": "barcode.labels",
        "destroy": "barcode.labels",
        "duplicate": "barcode.labels",
        "preview": "barcode.labels",
        "seed_defaults": "barcode.labels",
        "list_for_print": "barcode.print",
    }
    search_fields = ("name", "description")
    ordering_fields = ("name", "updated_at")

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.has_permission_codename("barcode.labels"):
            return qs
        dept_key = getattr(getattr(user, "department", None), "key", None)
        if not dept_key:
            return qs.none()
        allowed_ids = [
            tpl.pk
            for tpl in qs
            if not tpl.allowed_department_keys or dept_key in tpl.allowed_department_keys
        ]
        return qs.filter(pk__in=allowed_ids)

    @action(detail=False, methods=["get"], url_path="for-print")
    def list_for_print(self, request):
        self.action_permission_map["list_for_print"] = "barcode.print"
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def perform_create(self, serializer):
        serializer.save(
            tenant_id=self.request.user.tenant_id,
            source=LabelTemplateSource.CUSTOM,
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        cancelled = PrintJob.objects.filter(
            template=instance,
            status__in=[PrintJobStatus.QUEUED, PrintJobStatus.SENT],
        ).update(
            status=PrintJobStatus.FAILED,
            error_message="Template deleted",
            updated_at=timezone.now(),
        )
        has_jobs = PrintJob.objects.filter(template=instance).exists()
        if has_jobs:
            instance.is_active = False
            instance.save(update_fields=["is_active", "updated_at"])
            return Response(
                {
                    "detail": "Template archived.",
                    "cancelled_jobs": cancelled,
                    "archived": True,
                },
                status=status.HTTP_200_OK,
            )
        instance.delete()
        return Response(
            {"detail": "Template deleted.", "cancelled_jobs": cancelled},
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="duplicate")
    def duplicate(self, request, pk=None):
        tpl = self.get_object()
        ser = LabelTemplateDuplicateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        name = ser.validated_data.get("name") or f"{tpl.name} (kopya)"
        copy = LabelTemplate.objects.create(
            tenant_id=tpl.tenant_id,
            name=name,
            description=tpl.description,
            width_mm=tpl.width_mm,
            height_mm=tpl.height_mm,
            gap_mm=tpl.gap_mm,
            dpi=tpl.dpi,
            layout_json=list(tpl.layout_json or []),
            source=LabelTemplateSource.DUPLICATE,
            allowed_department_keys=list(tpl.allowed_department_keys or []),
        )
        return Response(LabelTemplateSerializer(copy).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="preview")
    def preview(self, request, pk=None):
        tpl = self.get_object()
        ser = LabelTemplatePreviewSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        product_id = ser.validated_data.get("product_id")
        png = render_label_png(
            width_mm=tpl.width_mm,
            height_mm=tpl.height_mm,
            dpi=tpl.dpi,
            layout_json=list(tpl.layout_json or []),
            tenant_id=tpl.tenant_id,
            product_id=product_id,
            settings=get_or_create_settings(tpl.tenant_id),
        )
        return HttpResponse(png, content_type="image/png")

    @action(detail=False, methods=["post"], url_path="seed-defaults")
    def seed_defaults(self, request):
        created = seed_default_templates(request.user.tenant_id, skip_existing=True)
        return Response({"created": len(created), "templates": LabelTemplateSerializer(created, many=True).data})


class PrintJobViewSet(TenantScopedViewSet):
    queryset = PrintJob.objects.select_related("template", "created_by")
    required_module = "barcode"
    action_permission_map = {
        "list": "barcode.print",
        "retrieve": "barcode.print",
        "create": "barcode.print",
        "tspl": "barcode.print",
        "complete": "barcode.print",
        "batch": "barcode.print",
        "cancel": "barcode.print",
    }
    http_method_names = ["get", "post", "head", "options"]
    filterset_fields = ("status", "template")
    ordering_fields = ("created_at",)

    def get_serializer_class(self):
        if self.action == "create":
            return PrintJobCreateSerializer
        return PrintJobSerializer

    def create(self, request, *args, **kwargs):
        ser = PrintJobCreateSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        job = ser.save()
        return Response(PrintJobSerializer(job).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="batch")
    def batch(self, request):
        ser = PrintJobBatchSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        tenant_id = request.user.tenant_id
        template = LabelTemplate.objects.filter(
            tenant_id=tenant_id,
            pk=ser.validated_data["template_id"],
            is_active=True,
        ).first()
        if not template:
            return Response({"detail": "Template not found."}, status=status.HTTP_404_NOT_FOUND)

        product_ids = [item["product_id"] for item in ser.validated_data["items"]]
        products = {
            p.pk: p
            for p in Product.objects.filter(
                tenant_id=tenant_id, pk__in=product_ids, is_active=True
            )
        }
        jobs = []
        for item in ser.validated_data["items"]:
            if item["product_id"] not in products:
                continue
            job = PrintJob.objects.create(
                tenant_id=tenant_id,
                template=template,
                product_ids=[item["product_id"]],
                layout_snapshot=list(template.layout_json or []),
                template_snapshot={
                    "width_mm": str(template.width_mm),
                    "height_mm": str(template.height_mm),
                    "gap_mm": str(template.gap_mm),
                    "dpi": template.dpi,
                    "name": template.name,
                },
                copies=item["copies"],
                created_by=request.user,
                status=PrintJobStatus.QUEUED,
            )
            jobs.append(job)
        return Response(
            PrintJobSerializer(jobs, many=True).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        job = self.get_object()
        if job.status not in (PrintJobStatus.QUEUED, PrintJobStatus.SENT):
            return Response(
                {"detail": "Job cannot be cancelled."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        job.status = PrintJobStatus.FAILED
        job.error_message = request.data.get("reason") or "Cancelled by user"
        job.updated_at = timezone.now()
        job.save(update_fields=["status", "error_message", "updated_at"])
        return Response(PrintJobSerializer(job).data)

    @action(detail=True, methods=["get"])
    def tspl(self, request, pk=None):
        job = self.get_object()
        products = list(
            Product.objects.filter(
                tenant_id=job.tenant_id, pk__in=job.product_ids, is_active=True
            )
        )
        if not products:
            return Response({"detail": "No products."}, status=status.HTTP_400_BAD_REQUEST)
        tspl = render_tspl_batch(
            template_snapshot=job.template_snapshot,
            layout_json=list(job.layout_snapshot or []),
            products=products,
            copies=job.copies,
        )
        return Response({"tspl": tspl, "job_id": job.pk})

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        job = self.get_object()
        new_status = request.data.get("status", PrintJobStatus.DONE)
        if new_status not in dict(PrintJobStatus.choices):
            return Response({"detail": "Invalid status."}, status=status.HTTP_400_BAD_REQUEST)
        job.status = new_status
        job.error_message = request.data.get("error_message", "")
        job.updated_at = timezone.now()
        job.save(update_fields=["status", "error_message", "updated_at"])
        return Response(PrintJobSerializer(job).data)
