from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.viewsets import TenantScopedViewSet
from apps.billing.models import Invoice, Payment
from apps.billing.serializers import (
    CreateInvoiceFromOralTreatmentsSerializer,
    InvoiceSerializer,
    PaymentSerializer,
)


class InvoiceViewSet(TenantScopedViewSet):
    queryset = Invoice.objects.prefetch_related("lines__product").select_related("customer", "tenant")
    serializer_class = InvoiceSerializer
    required_module = "billing"
    action_permission_map = {
        "list": "billing.read",
        "retrieve": "billing.read",
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
