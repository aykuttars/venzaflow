from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from django.http import HttpResponse

from apps.billing.models import Invoice, Payment
from apps.billing.serializers import (
    CreateInvoiceFromOralTreatmentsSerializer,
    InvoiceSerializer,
    PaymentSerializer,
)
from apps.billing.services.preview import DOCUMENT_TYPE_LABELS, render_invoice_preview_html
from apps.common.viewsets import TenantScopedViewSet


class InvoiceViewSet(TenantScopedViewSet):
    queryset = Invoice.objects.prefetch_related("lines__product").select_related("customer", "tenant")
    serializer_class = InvoiceSerializer
    required_module = "billing"
    action_permission_map = {
        "list": "billing.read",
        "retrieve": "billing.read",
        "preview": "billing.read",
        "create": "billing.write",
        "update": "billing.write",
        "partial_update": "billing.write",
        "destroy": "billing.write",
        "from_oral_treatments": "billing.write",
    }
    filterset_fields = ("customer", "status")
    search_fields = ("number",)
    ordering_fields = ("issued_at", "due_date", "total")

    @action(detail=False, methods=["post"], url_path="from-oral-treatments")
    def from_oral_treatments(self, request):
        ser = CreateInvoiceFromOralTreatmentsSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        invoice = ser.save()
        return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="preview")
    def preview(self, request, pk=None):
        invoice = self.get_object()
        doc_type = (request.query_params.get("document_type") or "efatura").strip().lower()
        label = DOCUMENT_TYPE_LABELS.get(doc_type, "Fatura")
        html = render_invoice_preview_html(invoice, document_type_label=label)
        return HttpResponse(html, content_type="text/html; charset=utf-8")


class PaymentViewSet(TenantScopedViewSet):
    queryset = Payment.objects.select_related("invoice", "tenant")
    serializer_class = PaymentSerializer
    required_module = "billing"
    action_permission_map = {
        "list": "billing.read",
        "retrieve": "billing.read",
        "create": "billing.write",
        "update": "billing.write",
        "partial_update": "billing.write",
        "destroy": "billing.write",
    }
    filterset_fields = ("invoice", "method")
    ordering_fields = ("paid_at", "amount")
