from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from apps.billing.models import Invoice, InvoiceLine, Payment


class InvoiceLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceLine
        fields = ("id", "product", "quantity", "unit_price", "line_total")


class InvoiceSerializer(serializers.ModelSerializer):
    lines = InvoiceLineSerializer(many=True, required=False)

    class Meta:
        model = Invoice
        fields = (
            "id",
            "number",
            "customer",
            "issued_at",
            "due_date",
            "status",
            "total",
            "lines",
        )
        read_only_fields = ("total",)

    def create(self, validated_data):
        lines = validated_data.pop("lines", [])
        tenant_id = validated_data.pop("tenant_id")
        with transaction.atomic():
            inv = Invoice.objects.create(tenant_id=tenant_id, total=Decimal("0.00"), **validated_data)
            total = Decimal("0.00")
            for line in lines:
                product = line["product"]
                qty = line["quantity"]
                unit_price = line["unit_price"]
                line_total = line.get("line_total") or (Decimal(qty) * Decimal(unit_price))
                InvoiceLine.objects.create(
                    tenant_id=tenant_id,
                    invoice=inv,
                    product=product,
                    quantity=qty,
                    unit_price=unit_price,
                    line_total=line_total,
                )
                total += Decimal(line_total)
            inv.total = total
            inv.save(update_fields=["total"])
        return inv

    def update(self, instance, validated_data):
        validated_data.pop("lines", None)
        return super().update(instance, validated_data)


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ("id", "invoice", "amount", "paid_at", "method")
