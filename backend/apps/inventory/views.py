from django.db import transaction
from apps.common.viewsets import TenantScopedViewSet
from apps.inventory.models import Stock, StockMovement, Warehouse
from apps.inventory.serializers import StockMovementSerializer, StockSerializer, WarehouseSerializer


class WarehouseViewSet(TenantScopedViewSet):
    queryset = Warehouse.objects.all()
    serializer_class = WarehouseSerializer
    required_module = "inventory"
    action_permission_map = {
        "list": "inventory.read",
        "retrieve": "inventory.read",
        "create": "inventory.write",
        "update": "inventory.write",
        "partial_update": "inventory.write",
        "destroy": "inventory.write",
    }
    search_fields = ("code", "name")
    ordering_fields = ("code",)


class StockViewSet(TenantScopedViewSet):
    queryset = Stock.objects.select_related("product", "warehouse", "tenant")
    serializer_class = StockSerializer
    required_module = "inventory"
    action_permission_map = {
        "list": "inventory.read",
        "retrieve": "inventory.read",
        "create": "inventory.write",
        "update": "inventory.write",
        "partial_update": "inventory.write",
        "destroy": "inventory.write",
    }
    filterset_fields = ("warehouse", "product")
    search_fields = ("product__sku", "warehouse__code")
    ordering_fields = ("quantity",)


class StockMovementViewSet(TenantScopedViewSet):
    queryset = StockMovement.objects.select_related("stock", "tenant")
    serializer_class = StockMovementSerializer
    required_module = "inventory"
    action_permission_map = {
        "list": "inventory.read",
        "retrieve": "inventory.read",
        "create": "inventory.write",
        "update": "inventory.write",
        "partial_update": "inventory.write",
        "destroy": "inventory.write",
    }
    ordering_fields = ("created_at",)

    def perform_create(self, serializer):
        with transaction.atomic():
            movement = serializer.save(tenant_id=self.request.user.tenant_id)
            st = movement.stock
            st.quantity += movement.delta
            st.save(update_fields=["quantity"])
