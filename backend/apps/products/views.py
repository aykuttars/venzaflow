from apps.common.viewsets import TenantScopedViewSet
from apps.products.models import Category, Product
from apps.products.serializers import CategorySerializer, ProductSerializer


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
    }
    filterset_fields = ("category", "is_active")
    search_fields = ("sku", "name")
    ordering_fields = ("sku", "unit_price", "name")
