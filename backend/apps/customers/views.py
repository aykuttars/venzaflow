from apps.common.viewsets import TenantScopedViewSet
from apps.customers.models import Customer, MedicalRecord
from apps.customers.serializers import CustomerSerializer, MedicalRecordSerializer


class CustomerViewSet(TenantScopedViewSet):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    required_module = "customers"
    action_permission_map = {
        "list": "customers.read",
        "retrieve": "customers.read",
        "create": "customers.write",
        "update": "customers.write",
        "partial_update": "customers.write",
        "destroy": "customers.write",
    }
    filterset_fields = ("kind",)
    search_fields = ("first_name", "last_name", "email", "phone")
    ordering_fields = ("last_name", "first_name")


class MedicalRecordViewSet(TenantScopedViewSet):
    queryset = MedicalRecord.objects.select_related("patient", "tenant")
    serializer_class = MedicalRecordSerializer
    required_module = "patients"
    action_permission_map = {
        "list": "patients.read",
        "retrieve": "patients.read",
        "create": "patients.write",
        "update": "patients.write",
        "partial_update": "patients.write",
        "destroy": "patients.write",
    }
    filterset_fields = ("patient",)
    search_fields = ("summary",)
    ordering_fields = ("updated_at",)
