from apps.common.viewsets import TenantScopedViewSet
from apps.employees.models import Employee
from apps.employees.serializers import EmployeeSerializer


class EmployeeViewSet(TenantScopedViewSet):
    queryset = Employee.objects.select_related("user", "tenant")
    serializer_class = EmployeeSerializer
    required_module = "employees"
    action_permission_map = {
        "list": "employees.read",
        "retrieve": "employees.read",
        "create": "employees.write",
        "update": "employees.write",
        "partial_update": "employees.write",
        "destroy": "employees.write",
    }
    search_fields = ("employee_no", "user__email", "user__first_name", "user__last_name")
    ordering_fields = ("hire_date", "employee_no")
