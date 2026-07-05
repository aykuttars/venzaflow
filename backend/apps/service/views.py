from __future__ import annotations

from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.viewsets import TenantScopedViewSet
from apps.service.models import ServiceTicket, ServiceTicketStatus
from apps.service.serializers import (
    ServiceTicketCreateSerializer,
    ServiceTicketDeliverSerializer,
    ServiceTicketDiagnosisSerializer,
    ServiceTicketLookupSerializer,
    ServiceTicketSerializer,
    ServiceTicketTransitionSerializer,
)
from apps.service.services.intake_print import enqueue_intake_labels
from apps.service.services.lookup import lookup_service_tickets
from apps.service.services.transitions import TransitionError, approve_quote, deliver_ticket, transition_ticket


class ServiceTicketViewSet(TenantScopedViewSet):
    queryset = ServiceTicket.objects.select_related("customer", "assigned_to").prefetch_related(
        "events"
    )
    required_module = "service"
    action_permission_map = {
        "list": "service.read",
        "retrieve": "service.read",
        "create": "service.write",
        "update": "service.write",
        "partial_update": "service.write",
        "destroy": "service.write",
        "transition": "service.write",
        "submit_diagnosis": "service.write",
        "approve_quote": "service.write",
        "deliver": "service.write",
        "print_intake": "service.write",
        "dashboard": "service.read",
        "lookup": "service.read",
    }
    search_fields = ("ticket_number", "customer_name", "customer_phone", "device_serial")
    ordering_fields = ("received_at", "status", "ticket_number")
    filterset_fields = ("status", "assigned_to")

    def get_serializer_class(self):
        if self.action == "create":
            return ServiceTicketCreateSerializer
        if self.action == "lookup":
            return ServiceTicketLookupSerializer
        return ServiceTicketSerializer

    def create(self, request, *args, **kwargs):
        ser = ServiceTicketCreateSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        ticket = ser.save()
        return Response(
            ServiceTicketSerializer(ticket).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def transition(self, request, pk=None):
        ticket = self.get_object()
        ser = ServiceTicketTransitionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            transition_ticket(
                ticket,
                to_status=ser.validated_data["status"],
                note=ser.validated_data.get("note", ""),
                user=request.user,
            )
        except TransitionError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        ticket.refresh_from_db()
        return Response(ServiceTicketSerializer(ticket).data)

    @action(detail=True, methods=["post"], url_path="submit-diagnosis")
    def submit_diagnosis(self, request, pk=None):
        ticket = self.get_object()
        ser = ServiceTicketDiagnosisSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ticket.diagnosis = ser.validated_data["diagnosis"]
        ticket.estimated_price = ser.validated_data["estimated_price"]
        ticket.save(update_fields=["diagnosis", "estimated_price", "updated_at"])
        try:
            if ticket.status == ServiceTicketStatus.RECEIVED:
                transition_ticket(
                    ticket,
                    to_status=ServiceTicketStatus.DIAGNOSING,
                    note="Diagnosis started",
                    user=request.user,
                )
            transition_ticket(
                ticket,
                to_status=ServiceTicketStatus.AWAITING_APPROVAL,
                note=ser.validated_data.get("note", ""),
                user=request.user,
            )
        except TransitionError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        ticket.refresh_from_db()
        return Response(ServiceTicketSerializer(ticket).data)

    @action(detail=True, methods=["post"], url_path="approve-quote")
    def approve_quote(self, request, pk=None):
        ticket = self.get_object()
        try:
            approve_quote(ticket, note=request.data.get("note", ""), user=request.user)
        except TransitionError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        ticket.refresh_from_db()
        return Response(ServiceTicketSerializer(ticket).data)

    @action(detail=True, methods=["post"])
    def deliver(self, request, pk=None):
        ticket = self.get_object()
        ser = ServiceTicketDeliverSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            deliver_ticket(
                ticket,
                final_price=ser.validated_data["final_price"],
                payment_method=ser.validated_data["payment_method"],
                note=ser.validated_data.get("note", ""),
                user=request.user,
            )
        except TransitionError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        ticket.refresh_from_db()
        return Response(ServiceTicketSerializer(ticket).data)

    @action(detail=True, methods=["post"], url_path="print-intake")
    def print_intake(self, request, pk=None):
        ticket = self.get_object()
        jobs = enqueue_intake_labels(ticket, user=request.user, immediate=True)
        return Response({"jobs_created": len(jobs), "job_ids": [j.pk for j in jobs]})

    @action(detail=False, methods=["get"])
    def dashboard(self, request):
        qs = self.filter_queryset(self.get_queryset())
        open_statuses = [
            ServiceTicketStatus.RECEIVED,
            ServiceTicketStatus.DIAGNOSING,
            ServiceTicketStatus.AWAITING_APPROVAL,
            ServiceTicketStatus.IN_REPAIR,
            ServiceTicketStatus.READY,
        ]
        return Response(
            {
                "open_count": qs.filter(status__in=open_statuses).count(),
                "awaiting_approval": qs.filter(
                    status=ServiceTicketStatus.AWAITING_APPROVAL
                ).count(),
                "ready_count": qs.filter(status=ServiceTicketStatus.READY).count(),
                "delivered_today": qs.filter(status=ServiceTicketStatus.DELIVERED).count(),
            }
        )

    @action(detail=False, methods=["get"], url_path="lookup")
    def lookup(self, request):
        q = (request.query_params.get("q") or "").strip()
        if not q:
            return Response({"detail": "q is required."}, status=status.HTTP_400_BAD_REQUEST)
        tickets = lookup_service_tickets(request.user.tenant_id, q)
        if not tickets:
            return Response({"found": False, "tickets": [], "count": 0})
        data = ServiceTicketLookupSerializer(tickets, many=True).data
        payload = {"found": True, "tickets": data, "count": len(data)}
        if len(data) == 1:
            payload["ticket"] = data[0]
        return Response(payload)
