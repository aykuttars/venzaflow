from rest_framework import serializers

from apps.inventory.models import Location, MovementType, Stock, StockMovement, Warehouse
from apps.inventory.services.movement import MovementService, MovementServiceError


class WarehouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Warehouse
        fields = ("id", "code", "name", "description", "is_active")


class LocationSerializer(serializers.ModelSerializer):
    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)

    class Meta:
        model = Location
        fields = (
            "id",
            "warehouse",
            "warehouse_code",
            "name",
            "code",
            "description",
            "is_active",
        )


class StockSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)
    location_code = serializers.CharField(source="location.code", read_only=True, allow_null=True)
    available_quantity = serializers.IntegerField(read_only=True)

    class Meta:
        model = Stock
        fields = (
            "id",
            "product",
            "product_sku",
            "product_name",
            "warehouse",
            "warehouse_code",
            "location",
            "location_code",
            "quantity",
            "reserved_quantity",
            "available_quantity",
            "reorder_level",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at", "available_quantity")


class StockMovementSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    warehouse_code = serializers.CharField(source="warehouse.code", read_only=True)
    location_code = serializers.CharField(source="location.code", read_only=True, allow_null=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = StockMovement
        fields = (
            "id",
            "stock",
            "product",
            "product_sku",
            "warehouse",
            "warehouse_code",
            "location",
            "location_code",
            "movement_type",
            "quantity",
            "delta",
            "previous_quantity",
            "new_quantity",
            "reason",
            "note",
            "reference",
            "reference_type",
            "reference_id",
            "created_by",
            "created_by_name",
            "created_at",
        )
        read_only_fields = (
            "product",
            "warehouse",
            "location",
            "delta",
            "previous_quantity",
            "new_quantity",
            "created_by",
            "created_at",
        )

    def get_created_by_name(self, obj: StockMovement) -> str:
        if obj.created_by_id and obj.created_by:
            return getattr(obj.created_by, "email", "") or str(obj.created_by)
        return ""

    def validate(self, attrs):
        movement_type = attrs.get("movement_type") or MovementType.ADJUSTMENT.value
        if isinstance(movement_type, MovementType):
            movement_type = movement_type.value
        quantity = attrs.get("quantity")
        delta = self.initial_data.get("delta") if hasattr(self, "initial_data") else None
        if self.instance is None and quantity is None and delta is None:
            raise serializers.ValidationError("quantity or delta is required")
        if movement_type not in {v for v, _ in MovementType.choices}:
            raise serializers.ValidationError({"movement_type": "Invalid movement type"})
        attrs["movement_type"] = movement_type
        return attrs

    def create(self, validated_data):
        from apps.inventory.services.movement import MovementInput

        stock = validated_data["stock"]
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        delta_raw = self.initial_data.get("delta")
        try:
            delta_val = int(delta_raw) if delta_raw is not None else None
        except (TypeError, ValueError):
            delta_val = None
        qty_raw = validated_data.get("quantity")
        movement_type = validated_data.get("movement_type", MovementType.ADJUSTMENT.value)
        if isinstance(movement_type, MovementType):
            movement_type = movement_type.value
        try:
            movement = MovementService.apply_movement(
                MovementInput(
                    stock=stock,
                    movement_type=movement_type,
                    quantity=int(qty_raw) if qty_raw is not None else None,
                    delta=delta_val,
                    note=validated_data.get("note", ""),
                    reason=validated_data.get("reason", ""),
                    reference=validated_data.get("reference", ""),
                    reference_type=validated_data.get("reference_type", ""),
                    reference_id=validated_data.get("reference_id", ""),
                    created_by=user if user and user.is_authenticated else None,
                    tenant_id=getattr(user, "tenant_id", None),
                )
            )
        except MovementServiceError as exc:
            raise serializers.ValidationError(str(exc)) from exc
        return movement


class StockMovementCreateSerializer(StockMovementSerializer):
    """Backward-compatible: accepts stock + delta only."""

    class Meta(StockMovementSerializer.Meta):
        extra_kwargs = {
            "movement_type": {"required": False},
            "quantity": {"required": False},
        }
