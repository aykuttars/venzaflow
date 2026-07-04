from __future__ import annotations

from rest_framework import serializers

from apps.barcode.models import BarcodeSettings


class BarcodeSettingsSerializer(serializers.ModelSerializer):
    label_logo_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = BarcodeSettings
        fields = [
            "scan_miss_action",
            "normalize_tr_scan",
            "qr_content_mode",
            "qr_max_length",
            "ean_prefix",
            "auto_generate_on_create",
            "operation_flags",
            "stock_deduction_mode",
            "print_mode",
            "default_copies",
            "default_transfer_qty",
            "printer_model",
            "printer_profile_json",
            "label_logo",
            "label_logo_url",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at", "label_logo_url"]

    def get_label_logo_url(self, obj: BarcodeSettings) -> str | None:
        if obj.label_logo:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.label_logo.url)
            return obj.label_logo.url
        return None


class ScanMissAssignSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=128)
    product_id = serializers.IntegerField()


class ScanMissCreateStep1Serializer(serializers.Serializer):
    code = serializers.CharField(max_length=128)
    name = serializers.CharField(max_length=255)


class ScanMissCreateStep2Serializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    category_id = serializers.IntegerField(required=False, allow_null=True)
    unit_price = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, allow_null=True
    )
    cost_price = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, allow_null=True
    )


class PrintJobBatchItemSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    copies = serializers.IntegerField(min_value=1, max_value=100, default=1)


class PrintJobBatchSerializer(serializers.Serializer):
    template_id = serializers.IntegerField()
    items = PrintJobBatchItemSerializer(many=True, min_length=1, max_length=500)
    immediate = serializers.BooleanField(default=False)


class ManualStockDeductionSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1, default=1)
    warehouse_code = serializers.CharField(max_length=32, default="MAGAZA")
    note = serializers.CharField(required=False, allow_blank=True, default="")
