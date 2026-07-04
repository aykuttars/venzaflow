from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from apps.customers.models import Customer
from apps.customers.serializers import validate_phone_value
from apps.service.models import PaymentMethod, ServiceTicket, ServiceTicketEvent, ServiceTicketStatus
from apps.service.services.ticket_number import allocate_ticket_number
from apps.service.services.transitions import (
    TransitionError,
    approve_quote,
    deliver_ticket,
    transition_ticket,
)


class ServiceTicketEventSerializer(serializers.ModelSerializer):
    created_by_email = serializers.SerializerMethodField()

    class Meta:
        model = ServiceTicketEvent
        fields = (
            "id",
            "from_status",
            "to_status",
            "note",
            "created_by",
            "created_by_email",
            "created_at",
        )
        read_only_fields = fields

    def get_created_by_email(self, obj: ServiceTicketEvent) -> str:
        if obj.created_by_id and obj.created_by:
            return getattr(obj.created_by, "email", "") or str(obj.created_by)
        return ""


class ServiceTicketSerializer(serializers.ModelSerializer):
    events = ServiceTicketEventSerializer(many=True, read_only=True)
    device_summary = serializers.CharField(read_only=True)
    customer_display = serializers.SerializerMethodField()

    class Meta:
        model = ServiceTicket
        fields = (
            "id",
            "ticket_number",
            "customer",
            "customer_name",
            "customer_phone",
            "customer_display",
            "device_brand",
            "device_model",
            "device_serial",
            "device_summary",
            "complaint",
            "diagnosis",
            "estimated_price",
            "final_price",
            "payment_method",
            "payment_received_at",
            "status",
            "assigned_to",
            "received_at",
            "diagnosed_at",
            "approved_at",
            "completed_at",
            "delivered_at",
            "notes",
            "invoice",
            "events",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "ticket_number",
            "received_at",
            "diagnosed_at",
            "approved_at",
            "completed_at",
            "delivered_at",
            "payment_received_at",
            "created_at",
            "updated_at",
        )

    def get_customer_display(self, obj: ServiceTicket) -> str:
        if obj.customer_id and obj.customer:
            return f"{obj.customer.first_name} {obj.customer.last_name}".strip()
        return obj.customer_name


class ServiceTicketCreateSerializer(serializers.ModelSerializer):
    print_intake = serializers.BooleanField(default=True, write_only=True)

    class Meta:
        model = ServiceTicket
        fields = (
            "customer",
            "customer_name",
            "customer_phone",
            "device_brand",
            "device_model",
            "device_serial",
            "complaint",
            "assigned_to",
            "notes",
            "print_intake",
        )

    def validate(self, attrs):
        customer = attrs.get("customer")
        name = (attrs.get("customer_name") or "").strip()
        phone = (attrs.get("customer_phone") or "").strip()
        if customer:
            attrs["customer_name"] = f"{customer.first_name} {customer.last_name}".strip()
            if not phone and customer.phone:
                attrs["customer_phone"] = customer.phone
        elif not name:
            raise serializers.ValidationError(
                {"customer_name": "Customer or name is required."}
            )
        else:
            attrs["customer_phone"] = validate_phone_value(phone, required=True)
        if not (attrs.get("complaint") or "").strip():
            raise serializers.ValidationError({"complaint": "Complaint is required."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        print_intake = validated_data.pop("print_intake", True)
        request = self.context["request"]
        tenant_id = request.user.tenant_id
        customer = validated_data.get("customer")
        if customer and customer.tenant_id != tenant_id:
            raise serializers.ValidationError({"customer": "Invalid customer."})

        ticket = ServiceTicket.objects.create(
            tenant_id=tenant_id,
            ticket_number=allocate_ticket_number(tenant_id),
            status=ServiceTicketStatus.RECEIVED,
            **validated_data,
        )
        ServiceTicketEvent.objects.create(
            tenant_id=tenant_id,
            ticket=ticket,
            from_status="",
            to_status=ServiceTicketStatus.RECEIVED,
            note="Device received",
            created_by=request.user,
        )
        if print_intake:
            from apps.service.services.intake_print import enqueue_intake_labels

            enqueue_intake_labels(ticket, user=request.user, immediate=True)
        return ticket


class ServiceTicketTransitionSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=ServiceTicketStatus.choices)
    note = serializers.CharField(required=False, allow_blank=True, default="")


class ServiceTicketDiagnosisSerializer(serializers.Serializer):
    diagnosis = serializers.CharField()
    estimated_price = serializers.DecimalField(max_digits=12, decimal_places=2)
    note = serializers.CharField(required=False, allow_blank=True, default="")


class ServiceTicketDeliverSerializer(serializers.Serializer):
    final_price = serializers.DecimalField(max_digits=12, decimal_places=2)
    payment_method = serializers.ChoiceField(choices=PaymentMethod.choices)
    note = serializers.CharField(required=False, allow_blank=True, default="")


class ServiceTicketLookupSerializer(serializers.ModelSerializer):
    device_summary = serializers.CharField(read_only=True)

    class Meta:
        model = ServiceTicket
        fields = (
            "id",
            "ticket_number",
            "customer_name",
            "customer_phone",
            "device_summary",
            "status",
            "estimated_price",
            "final_price",
            "received_at",
        )
