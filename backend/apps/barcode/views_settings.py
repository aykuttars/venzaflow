from __future__ import annotations

from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import HasModule, HasViewPermission
from apps.barcode.serializers_settings import BarcodeSettingsSerializer
from apps.barcode.services.settings import effective_settings_payload, get_or_create_settings


class BarcodeSettingsView(APIView):
    permission_classes = [HasModule, HasViewPermission]
    required_module = "barcode"
    required_permission = "barcode.labels"
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get(self, request):
        settings = get_or_create_settings(request.user.tenant_id)
        return Response(BarcodeSettingsSerializer(settings, context={"request": request}).data)

    def patch(self, request):
        settings = get_or_create_settings(request.user.tenant_id)
        ser = BarcodeSettingsSerializer(
            settings,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)


class BarcodeSettingsEffectiveView(APIView):
    """Settings subset for e-barcode desktop sync (any barcode user)."""

    permission_classes = [HasModule, HasViewPermission]
    required_module = "barcode"
    required_permission = "barcode.scan"

    def get(self, request):
        settings = get_or_create_settings(request.user.tenant_id)
        return Response(effective_settings_payload(settings))
