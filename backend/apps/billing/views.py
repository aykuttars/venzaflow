from apps.common.viewsets import TenantScopedViewSet
from apps.billing.models import Invoice, Payment
from apps.billing.serializers import InvoiceSerializer, PaymentSerializer


class InvoiceViewSet(TenantScopedViewSet):
    queryset = Invoice.objects.prefetch_related("lines").select_related("customer", "tenant")
    serializer_class = InvoiceSerializer
    required_module = "billing"
    action_permission_map = {
        "list": "billing.read",
        "retrieve": "billing.read",
        "create": "billing.write",
        "update": "billing.write",
        "partial_update": "billing.write",
        "destroy": "billing.write",
    }
    filterset_fields = ("customer", "status")
    search_fields = ("number",)
    ordering_fields = ("issued_at", "due_date", "total")


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
