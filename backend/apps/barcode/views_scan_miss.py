from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import HasModule, HasViewPermission
from apps.barcode.models import BarcodeAssignment
from apps.barcode.serializers_settings import (
    ScanMissAssignSerializer,
    ScanMissCreateStep1Serializer,
    ScanMissCreateStep2Serializer,
)
from apps.barcode.services.settings import get_or_create_settings
from apps.products.models import Category, Product


class ScanMissAssignView(APIView):
    permission_classes = [HasModule, HasViewPermission]
    required_module = "barcode"
    required_permission = "barcode.scan"

    @transaction.atomic
    def post(self, request):
        ser = ScanMissAssignSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        code = ser.validated_data["code"].strip()
        tenant_id = request.user.tenant_id

        if Product.objects.filter(tenant_id=tenant_id, barcode=code).exists():
            return Response(
                {"detail": "Barcode already assigned."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        product = Product.objects.filter(
            tenant_id=tenant_id, pk=ser.validated_data["product_id"], is_active=True
        ).first()
        if not product:
            return Response({"detail": "Product not found."}, status=status.HTTP_404_NOT_FOUND)

        product.barcode = code
        product.save(update_fields=["barcode"])
        BarcodeAssignment.objects.update_or_create(
            tenant_id=tenant_id,
            product=product,
            defaults={"symbology": "EAN13"},
        )
        from apps.barcode.services.lookup import lookup_barcode

        return Response(lookup_barcode(tenant_id, code))


class ScanMissCreateView(APIView):
    permission_classes = [HasModule, HasViewPermission]
    required_module = "barcode"
    required_permission = "barcode.scan"

    @transaction.atomic
    def post(self, request):
        step = request.data.get("step", 1)
        tenant_id = request.user.tenant_id

        if step == 1:
            ser = ScanMissCreateStep1Serializer(data=request.data)
            ser.is_valid(raise_exception=True)
            code = ser.validated_data["code"].strip()
            if Product.objects.filter(tenant_id=tenant_id, barcode=code).exists():
                return Response(
                    {"detail": "Barcode already exists."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            category = Category.objects.filter(tenant_id=tenant_id).first()
            if not category:
                return Response(
                    {"detail": "No category available."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            sku_base = code[-8:] if len(code) >= 8 else code
            sku = sku_base
            n = 1
            while Product.objects.filter(tenant_id=tenant_id, sku=sku).exists():
                sku = f"{sku_base}-{n}"
                n += 1
            product = Product.objects.create(
                tenant_id=tenant_id,
                category=category,
                sku=sku,
                name=ser.validated_data["name"],
                barcode=code,
                unit_price=Decimal("0"),
                cost_price=Decimal("0"),
            )
            BarcodeAssignment.objects.create(
                tenant_id=tenant_id,
                product=product,
                symbology="EAN13",
            )
            return Response(
                {
                    "step": 1,
                    "product_id": product.id,
                    "sku": product.sku,
                    "barcode": product.barcode,
                    "name": product.name,
                },
                status=status.HTTP_201_CREATED,
            )

        ser = ScanMissCreateStep2Serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        product = Product.objects.filter(
            tenant_id=tenant_id, pk=ser.validated_data["product_id"], is_active=True
        ).first()
        if not product:
            return Response({"detail": "Product not found."}, status=status.HTTP_404_NOT_FOUND)

        updates = []
        if ser.validated_data.get("category_id"):
            cat = Category.objects.filter(
                tenant_id=tenant_id, pk=ser.validated_data["category_id"]
            ).first()
            if cat:
                product.category = cat
                updates.append("category")
        if ser.validated_data.get("unit_price") is not None:
            product.unit_price = ser.validated_data["unit_price"]
            updates.append("unit_price")
        if ser.validated_data.get("cost_price") is not None:
            product.cost_price = ser.validated_data["cost_price"]
            updates.append("cost_price")
        if updates:
            product.save(update_fields=updates)

        from apps.barcode.services.lookup import lookup_barcode

        return Response(
            {
                "step": 2,
                "product": lookup_barcode(tenant_id, product.barcode),
            }
        )
