from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.viewsets import TenantScopedViewSet
from apps.inventory.models import Location, Stock, StockMovement, Warehouse
from apps.inventory.serializers import (
    LocationSerializer,
    StockMovementSerializer,
    StockSerializer,
    WarehouseSerializer,
)


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
    filterset_fields = ("is_active",)


class LocationViewSet(TenantScopedViewSet):
    queryset = Location.objects.select_related("warehouse", "tenant")
    serializer_class = LocationSerializer
    required_module = "inventory"
    action_permission_map = {
        "list": "inventory.read",
        "retrieve": "inventory.read",
        "create": "inventory.write",
        "update": "inventory.write",
        "partial_update": "inventory.write",
        "destroy": "inventory.write",
    }
    search_fields = ("code", "name", "warehouse__code")
    ordering_fields = ("code", "name")
    filterset_fields = ("warehouse", "is_active")


class StockViewSet(TenantScopedViewSet):
    queryset = Stock.objects.select_related(
        "product", "warehouse", "location", "tenant"
    )
    serializer_class = StockSerializer
    required_module = "inventory"
    action_permission_map = {
        "list": "inventory.read",
        "retrieve": "inventory.read",
        "create": "inventory.write",
        "update": "inventory.write",
        "partial_update": "inventory.write",
        "destroy": "inventory.write",
        "export": "inventory.read",
        "import_data": "inventory.write",
    }
    filterset_fields = ("warehouse", "product", "location")
    search_fields = ("product__sku", "product__name", "warehouse__code", "location__code")
    ordering_fields = ("quantity", "updated_at")

    @action(detail=False, methods=["get"], url_path="export")
    def export(self, request):
        from apps.inventory.import_export import export_stock_csv, export_stock_xlsx

        fmt = (request.query_params.get("format") or "csv").lower()
        tenant_id = request.user.tenant_id
        if fmt == "xlsx":
            content = export_stock_xlsx(tenant_id)
            return Response(
                content,
                content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": 'attachment; filename="stock.xlsx"'},
            )
        content = export_stock_csv(tenant_id)
        return Response(
            content,
            content_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="stock.csv"'},
        )

    @action(detail=False, methods=["post"], url_path="import")
    def import_data(self, request):
        from apps.inventory.import_export import import_stock_csv, import_stock_xlsx

        file = request.FILES.get("file")
        if not file:
            return Response({"detail": "file is required"}, status=status.HTTP_400_BAD_REQUEST)
        name = (file.name or "").lower()
        if name.endswith(".xlsx"):
            return Response(import_stock_xlsx(request.user.tenant_id, file.read()))
        return Response(import_stock_csv(request.user.tenant_id, file.read()))


class StockMovementViewSet(TenantScopedViewSet):
    queryset = StockMovement.objects.select_related(
        "stock",
        "product",
        "warehouse",
        "location",
        "created_by",
        "tenant",
    )
    serializer_class = StockMovementSerializer
    required_module = "inventory"
    action_permission_map = {
        "list": "inventory.read",
        "retrieve": "inventory.read",
        "create": "inventory.write",
    }
    http_method_names = ["get", "post", "head", "options"]
    filterset_fields = ("stock", "movement_type", "warehouse", "product")
    search_fields = ("product__sku", "reference", "note", "reason")
    ordering_fields = ("created_at",)

    def perform_create(self, serializer):
        serializer.save()

    def update(self, request, *args, **kwargs):
        return Response(
            {"detail": "Stock movements cannot be updated."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def destroy(self, request, *args, **kwargs):
        return Response(
            {"detail": "Stock movements cannot be deleted."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )
