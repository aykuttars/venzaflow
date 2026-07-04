from __future__ import annotations

from django.db import transaction
from django.db.models import Q
from rest_framework import serializers

from apps.barcode.models import LabelTemplate, LabelTemplateSource, PrintJob, PrintJobStatus
from apps.barcode.services.tspl import render_tspl_batch
from apps.products.models import Product


class LabelTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = LabelTemplate
        fields = [
            "id",
            "name",
            "description",
            "width_mm",
            "height_mm",
            "gap_mm",
            "dpi",
            "layout_json",
            "source",
            "default_key",
            "allowed_department_keys",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["source", "default_key", "created_at", "updated_at"]


class LabelTemplateDuplicateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=128, required=False, allow_blank=True)


class LabelTemplatePreviewSerializer(serializers.Serializer):
    product_id = serializers.IntegerField(required=False, allow_null=True)


class PrintJobSerializer(serializers.ModelSerializer):
    template_name = serializers.CharField(source="template.name", read_only=True)

    class Meta:
        model = PrintJob
        fields = [
            "id",
            "template",
            "template_name",
            "product_ids",
            "status",
            "copies",
            "error_message",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "status",
            "error_message",
            "created_by",
            "created_at",
            "updated_at",
        ]


class PrintJobCreateSerializer(serializers.Serializer):
    template_id = serializers.IntegerField()
    product_ids = serializers.ListField(
        child=serializers.IntegerField(), min_length=1, max_length=500
    )
    copies = serializers.IntegerField(min_value=1, max_value=100, default=1)

    @transaction.atomic
    def create(self, validated_data):
        request = self.context["request"]
        tenant_id = request.user.tenant_id
        template = LabelTemplate.objects.filter(
            tenant_id=tenant_id, pk=validated_data["template_id"], is_active=True
        ).first()
        if not template:
            raise serializers.ValidationError({"template_id": "Template not found."})

        product_ids = validated_data["product_ids"]
        products = list(
            Product.objects.filter(tenant_id=tenant_id, pk__in=product_ids, is_active=True)
        )
        if len(products) != len(set(product_ids)):
            raise serializers.ValidationError({"product_ids": "Invalid product id(s)."})

        template_snapshot = {
            "width_mm": str(template.width_mm),
            "height_mm": str(template.height_mm),
            "gap_mm": str(template.gap_mm),
            "dpi": template.dpi,
            "name": template.name,
        }
        layout_snapshot = list(template.layout_json or [])

        job = PrintJob.objects.create(
            tenant_id=tenant_id,
            template=template,
            product_ids=product_ids,
            layout_snapshot=layout_snapshot,
            template_snapshot=template_snapshot,
            copies=validated_data.get("copies", 1),
            created_by=request.user,
            status=PrintJobStatus.QUEUED,
        )
        return job


class BarcodeGenerateSerializer(serializers.Serializer):
    limit = serializers.IntegerField(min_value=1, max_value=500, default=100)
    product_id = serializers.IntegerField(required=False, allow_null=True)


class TransferScanItemSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)


class TransferWizardSerializer(serializers.Serializer):
    source_warehouse_code = serializers.CharField(max_length=32, default="DEPO")
    target_warehouse_code = serializers.CharField(max_length=32, default="MAGAZA")
    target_location_code = serializers.CharField(max_length=32, required=False, allow_blank=True)
    note = serializers.CharField(required=False, allow_blank=True, default="")
    items = TransferScanItemSerializer(many=True, min_length=1)

    def validate(self, attrs):
        if attrs["source_warehouse_code"] == attrs["target_warehouse_code"]:
            raise serializers.ValidationError(
                {"target_warehouse_code": "Source and target must differ."}
            )
        return attrs
