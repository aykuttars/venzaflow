from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from apps.billing.models import Invoice, InvoiceLine, Payment
from apps.billing.services.oral_invoice import compute_invoice_totals, create_invoice_from_treatments, resolve_e_document_type
from apps.customers.models import Customer


class InvoiceLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = InvoiceLine
        fields = (
            "id",
            "product",
            "product_name",
            "description",
            "oral_treatment",
            "quantity",
            "unit_price",
            "discount_percent",
            "line_discount_amount",
            "line_total",
        )
        read_only_fields = ("id", "product_name", "oral_treatment")


class InvoiceSerializer(serializers.ModelSerializer):
    lines = InvoiceLineSerializer(many=True, required=False)
    customer_name = serializers.SerializerMethodField()
    resolved_e_document_type = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = (
            "id",
            "number",
            "customer",
            "customer_name",
            "issued_at",
            "due_date",
            "status",
            "subtotal_before_discount",
            "discount_percent",
            "discount_amount",
            "total",
            "notes",
            "e_document_type",
            "resolved_e_document_type",
            "lines",
        )
        read_only_fields = (
            "id",
            "total",
            "subtotal_before_discount",
            "discount_amount",
            "resolved_e_document_type",
        )

    def get_customer_name(self, obj):
        c = obj.customer
        return f"{c.first_name} {c.last_name}".strip()

    def get_resolved_e_document_type(self, obj):
        return resolve_e_document_type(obj)

    def create(self, validated_data):
        lines = validated_data.pop("lines", [])
        tenant_id = validated_data.pop("tenant_id")
        disc_pct = Decimal(str(validated_data.get("discount_percent") or 0))
        with transaction.atomic():
            line_payloads = []
            for line in lines:
                qty = line["quantity"]
                unit_price = line["unit_price"]
                line_disc_pct = Decimal(str(line.get("discount_percent") or 0))
                line_disc_amt = Decimal(str(line.get("line_discount_amount") or 0))
                gross = Decimal(qty) * Decimal(unit_price)
                if line_disc_pct > 0:
                    gross -= (gross * line_disc_pct / Decimal("100")).quantize(Decimal("0.01"))
                elif line_disc_amt > 0:
                    gross -= Decimal(line_disc_amt)
                line_total = line.get("line_total") or gross.quantize(Decimal("0.01"))
                line_payloads.append({**line, "line_total": line_total})

            subtotal, discount_amount, total, disc_pct = compute_invoice_totals(
                line_payloads, discount_percent=disc_pct
            )
            inv = Invoice.objects.create(
                tenant_id=tenant_id,
                subtotal_before_discount=subtotal,
                discount_amount=discount_amount,
                discount_percent=disc_pct,
                total=total,
                **validated_data,
            )
            for line in line_payloads:
                InvoiceLine.objects.create(
                    tenant_id=tenant_id,
                    invoice=inv,
                    product=line["product"],
                    description=line.get("description", ""),
                    quantity=line["quantity"],
                    unit_price=line["unit_price"],
                    discount_percent=line.get("discount_percent") or 0,
                    line_discount_amount=line.get("line_discount_amount") or 0,
                    line_total=line["line_total"],
                )
        return inv

    def update(self, instance, validated_data):
        validated_data.pop("lines", None)
        disc_pct = validated_data.get("discount_percent", instance.discount_percent)
        if "discount_percent" in validated_data or instance.lines.exists():
            line_payloads = [
                {
                    "quantity": ln.quantity,
                    "unit_price": ln.unit_price,
                    "discount_percent": ln.discount_percent,
                    "line_discount_amount": ln.line_discount_amount,
                }
                for ln in instance.lines.all()
            ]
            subtotal, discount_amount, total, disc_pct = compute_invoice_totals(
                line_payloads, discount_percent=Decimal(str(disc_pct))
            )
            validated_data["subtotal_before_discount"] = subtotal
            validated_data["discount_amount"] = discount_amount
            validated_data["total"] = total
            validated_data["discount_percent"] = disc_pct
        return super().update(instance, validated_data)


class CreateInvoiceFromOralTreatmentsSerializer(serializers.Serializer):
    patient = serializers.PrimaryKeyRelatedField(queryset=Customer.objects.none())
    treatment_ids = serializers.ListField(child=serializers.IntegerField(), min_length=1)
    discount_percent = serializers.DecimalField(max_digits=5, decimal_places=2, default=0, required=False)
    issued_at = serializers.DateField(required=False)
    e_document_type = serializers.ChoiceField(
        choices=Invoice.EDocumentType.choices,
        default=Invoice.EDocumentType.AUTO,
        required=False,
    )
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    number = serializers.CharField(required=False, allow_blank=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.user.tenant_id:
            tid = request.user.tenant_id
            self.fields["patient"].queryset = Customer.objects.filter(
                tenant_id=tid, kind=Customer.Kind.PATIENT
            )

    def create(self, validated_data):
        tenant = self.context["request"].user.tenant
        number = validated_data.get("number") or None
        if number == "":
            number = None
        return create_invoice_from_treatments(
            tenant=tenant,
            patient=validated_data["patient"],
            treatment_ids=validated_data["treatment_ids"],
            discount_percent=validated_data.get("discount_percent") or 0,
            issued_at=validated_data.get("issued_at"),
            e_document_type=validated_data.get("e_document_type", Invoice.EDocumentType.AUTO),
            notes=validated_data.get("notes", ""),
            number=number,
        )


class PaymentSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(source="invoice.number", read_only=True)

    class Meta:
        model = Payment
        fields = ("id", "invoice", "invoice_number", "amount", "paid_at", "method")

    def create(self, validated_data):
        payment = super().create(validated_data)
        invoice = payment.invoice
        paid_total = sum(
            Decimal(str(p.amount)) for p in Payment.objects.filter(invoice=invoice)
        )
        if paid_total >= Decimal(str(invoice.total)):
            invoice.status = Invoice.Status.PAID
            invoice.save(update_fields=["status"])
        return payment
