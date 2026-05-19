from apps.common.viewsets import TenantScopedViewSet
from apps.appointments.models import Appointment, Schedule
from apps.appointments.serializers import AppointmentSerializer, ScheduleSerializer


class ScheduleViewSet(TenantScopedViewSet):
    queryset = Schedule.objects.all()
    serializer_class = ScheduleSerializer
    required_module = "appointments"
    action_permission_map = {
        "list": "appointments.read",
        "retrieve": "appointments.read",
        "create": "appointments.write",
        "update": "appointments.write",
        "partial_update": "appointments.write",
        "destroy": "appointments.write",
    }
    search_fields = ("name", "resource")


class AppointmentViewSet(TenantScopedViewSet):
    queryset = Appointment.objects.select_related("customer", "tenant")
    serializer_class = AppointmentSerializer
    required_module = "appointments"
    action_permission_map = {
        "list": "appointments.read",
        "retrieve": "appointments.read",
        "create": "appointments.write",
        "update": "appointments.write",
        "partial_update": "appointments.write",
        "destroy": "appointments.write",
    }
    filterset_fields = ("customer", "status")
    search_fields = ("notes", "customer__first_name", "customer__last_name")
    ordering_fields = ("start_at", "end_at")
