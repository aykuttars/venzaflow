from __future__ import annotations

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import HasModule, HasViewPermission
from apps.barcode.serializers_settings import ManualStockDeductionSerializer
from apps.barcode.services.stock_deduction import manual_stock_deduction


class ManualStockDeductionView(APIView):
    permission_classes = [HasModule, HasViewPermission]
    required_module = "barcode"
    required_permission = "barcode.print"

    def post(self, request):
        ser = ManualStockDeductionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        result = manual_stock_deduction(
            tenant_id=request.user.tenant_id,
            product_id=ser.validated_data["product_id"],
            quantity=ser.validated_data["quantity"],
            warehouse_code=ser.validated_data.get("warehouse_code", "MAGAZA"),
            note=ser.validated_data.get("note", ""),
            created_by=request.user,
        )
        if "error" in result:
            return Response({"detail": result["error"]}, status=status.HTTP_400_BAD_REQUEST)
        return Response(result)
