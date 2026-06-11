from django.db.models import Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import HasModule, HasViewPermission
from apps.common.viewsets import TenantScopedViewSet
from apps.inventory.models import Stock
from apps.products.models import (
    Category,
    Product,
    ProductDetailConfig,
    ProductFieldDefinition,
    ProductFieldValue,
    ProductFormConfig,
    ProductListColumnConfig,
)
from apps.products.serializers import (
    CategorySerializer,
    ProductDetailConfigSerializer,
    ProductFieldDefinitionSerializer,
    ProductFieldValueSerializer,
    ProductFormConfigSerializer,
    ProductListColumnConfigSerializer,
    ProductSerializer,
)
from apps.products.ui_defaults import seed_ui_config_for_tenant


class CategoryViewSet(TenantScopedViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    required_module = "products"
    action_permission_map = {
        "list": "products.read",
        "retrieve": "products.read",
        "create": "products.write",
        "update": "products.write",
        "partial_update": "products.write",
        "destroy": "products.write",
    }
    search_fields = ("name", "slug")
    ordering_fields = ("name",)


class ProductViewSet(TenantScopedViewSet):
    queryset = Product.objects.select_related("category", "tenant")
    serializer_class = ProductSerializer
    required_module = "products"
    action_permission_map = {
        "list": "products.read",
        "retrieve": "products.read",
        "create": "products.write",
        "update": "products.write",
        "partial_update": "products.write",
        "destroy": "products.write",
        "export": "products.read",
        "import_data": "products.write",
    }
    filterset_fields = ("category", "is_active")
    search_fields = ("sku", "name", "barcode")
    ordering_fields = ("sku", "unit_price", "name", "barcode")

    def get_queryset(self):
        qs = super().get_queryset()
        if "fields" in self.request.query_params.get("include", ""):
            qs = qs.prefetch_related("field_values__field_definition")
        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        include = self.request.query_params.get("include", "")
        ctx["include_fields"] = (
            "fields" in include
            or self.action in ("retrieve", "create", "update", "partial_update")
        )
        return ctx

    @action(detail=False, methods=["get"], url_path="export")
    def export(self, request):
        from apps.products.import_export import export_products_csv, export_products_xlsx

        tenant_id = request.user.tenant_id
        fmt = (request.query_params.get("format") or "csv").lower()
        if fmt == "xlsx":
            content = export_products_xlsx(tenant_id)
            return Response(
                content,
                content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": 'attachment; filename="products.xlsx"'},
            )
        content = export_products_csv(tenant_id)
        return Response(
            content,
            content_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="products.csv"'},
        )

    @action(detail=False, methods=["post"], url_path="import")
    def import_data(self, request):
        from apps.products.import_export import import_products_csv, import_products_xlsx

        file = request.FILES.get("file")
        if not file:
            return Response({"detail": "file is required"}, status=status.HTTP_400_BAD_REQUEST)
        name = (file.name or "").lower()
        if name.endswith(".xlsx"):
            result = import_products_xlsx(request.user.tenant_id, file.read())
        else:
            result = import_products_csv(request.user.tenant_id, file.read())
        return Response(result)


class ProductFieldDefinitionViewSet(TenantScopedViewSet):
    queryset = ProductFieldDefinition.objects.all()
    serializer_class = ProductFieldDefinitionSerializer
    required_module = "products"
    action_permission_map = {
        "list": "products.read",
        "retrieve": "products.read",
        "create": "products.write",
        "update": "products.write",
        "partial_update": "products.write",
        "destroy": "products.write",
    }
    search_fields = ("key", "label")
    ordering_fields = ("form_order", "key")
    filterset_fields = ("field_type", "is_active")

    def perform_destroy(self, instance):
        instance.deleted_at = timezone.now()
        instance.is_active = False
        instance.save(update_fields=["deleted_at", "is_active"])


class ProductFieldValueViewSet(TenantScopedViewSet):
    queryset = ProductFieldValue.objects.select_related("field_definition", "product")
    serializer_class = ProductFieldValueSerializer
    required_module = "products"
    action_permission_map = {
        "list": "products.read",
        "retrieve": "products.read",
        "create": "products.write",
        "update": "products.write",
        "partial_update": "products.write",
        "destroy": "products.write",
    }
    filterset_fields = ("product", "field_definition")


class ProductListColumnConfigViewSet(TenantScopedViewSet):
    queryset = ProductListColumnConfig.objects.all()
    serializer_class = ProductListColumnConfigSerializer
    required_module = "products"
    action_permission_map = {
        "list": "products.read",
        "retrieve": "products.read",
        "create": "products.write",
        "update": "products.write",
        "partial_update": "products.write",
        "destroy": "products.write",
        "reseed": "products.write",
    }
    ordering_fields = ("order",)

    def list(self, request, *args, **kwargs):
        tenant_id = request.user.tenant_id
        seed_ui_config_for_tenant(tenant_id)
        return super().list(request, *args, **kwargs)

    @action(detail=False, methods=["post"], url_path="reseed")
    def reseed(self, request):
        tenant_id = request.user.tenant_id
        ProductListColumnConfig.objects.filter(tenant_id=tenant_id).delete()
        ProductFormConfig.objects.filter(tenant_id=tenant_id).delete()
        ProductDetailConfig.objects.filter(tenant_id=tenant_id).delete()
        seed_ui_config_for_tenant(tenant_id)
        return Response({"detail": "UI configuration reset to defaults."})


class ProductFormConfigViewSet(TenantScopedViewSet):
    queryset = ProductFormConfig.objects.all()
    serializer_class = ProductFormConfigSerializer
    required_module = "products"
    action_permission_map = {
        "list": "products.read",
        "retrieve": "products.read",
        "create": "products.write",
        "update": "products.write",
        "partial_update": "products.write",
        "destroy": "products.write",
    }
    ordering_fields = ("order", "section")

    def list(self, request, *args, **kwargs):
        seed_ui_config_for_tenant(request.user.tenant_id)
        return super().list(request, *args, **kwargs)


class ProductDetailConfigViewSet(TenantScopedViewSet):
    queryset = ProductDetailConfig.objects.all()
    serializer_class = ProductDetailConfigSerializer
    required_module = "products"
    action_permission_map = {
        "list": "products.read",
        "retrieve": "products.read",
        "create": "products.write",
        "update": "products.write",
        "partial_update": "products.write",
        "destroy": "products.write",
    }
    ordering_fields = ("order", "section")

    def list(self, request, *args, **kwargs):
        seed_ui_config_for_tenant(request.user.tenant_id)
        return super().list(request, *args, **kwargs)


class InventoryDashboardView(APIView):
    permission_classes = [HasModule, HasViewPermission]
    required_module = "inventory"
    required_permission = "inventory.read"

    def get(self, request):
        tenant_id = request.user.tenant_id
        products_qs = Product.objects.filter(tenant_id=tenant_id, is_active=True)
        stock_qs = Stock.objects.filter(tenant_id=tenant_id).select_related("product")
        total_products = products_qs.count()
        agg = stock_qs.aggregate(total_qty=Sum("quantity"))
        total_stock = int(agg["total_qty"] or 0)
        critical = []
        for s in stock_qs.filter(reorder_level__gt=0):
            if s.quantity <= s.reorder_level:
                critical.append(
                    {
                        "product_sku": s.product.sku,
                        "warehouse_code": s.warehouse.code,
                        "quantity": s.quantity,
                        "reorder_level": s.reorder_level,
                    }
                )
        total_cost = 0
        total_sale_value = 0
        for s in stock_qs:
            cost = s.product.cost_price or 0
            total_cost += float(cost) * s.quantity
            total_sale_value += float(s.product.unit_price) * s.quantity
        return Response(
            {
                "total_products": total_products,
                "total_stock": total_stock,
                "critical_stock_count": len(critical),
                "critical_stock": critical[:50],
                "total_cost": round(total_cost, 2),
                "total_sale_value": round(total_sale_value, 2),
            }
        )
