from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter

from apps.accounting.views import AccountViewSet, ExpenseViewSet, TransactionViewSet
from apps.accounts.views_dept import DepartmentViewSet
from apps.appointments.views import AppointmentViewSet, ScheduleViewSet
from apps.audit.views import ActivityLogView
from apps.billing.views import InvoiceViewSet, PaymentViewSet
from apps.common.views import health
from apps.customers.views import CustomerViewSet, MedicalRecordViewSet, PatientViewSet
from apps.dashboard.views import DashboardSummaryView
from apps.accounts.views_employees import EmployeeViewSet
from apps.inventory.views import StockMovementViewSet, StockViewSet, WarehouseViewSet
from apps.products.views import CategoryViewSet, ProductViewSet
from apps.tenants.views_platform import PlatformTenantViewSet

router = DefaultRouter()
platform_router = DefaultRouter()
platform_router.register(r"tenants", PlatformTenantViewSet, basename="platform-tenant")
router.register(r"departments", DepartmentViewSet, basename="department")
router.register(r"employees", EmployeeViewSet, basename="employee")
router.register(r"products/categories", CategoryViewSet, basename="category")
router.register(r"products", ProductViewSet, basename="product")
router.register(r"inventory/warehouses", WarehouseViewSet, basename="warehouse")
router.register(r"inventory/stock", StockViewSet, basename="stock")
router.register(r"inventory/movements", StockMovementViewSet, basename="stockmovement")
router.register(r"customers", CustomerViewSet, basename="customer")
router.register(r"patients", PatientViewSet, basename="patient")
router.register(r"medical-records", MedicalRecordViewSet, basename="medicalrecord")
router.register(r"appointments", AppointmentViewSet, basename="appointment")
router.register(r"schedules", ScheduleViewSet, basename="schedule")
router.register(r"billing/invoices", InvoiceViewSet, basename="invoice")
router.register(r"billing/payments", PaymentViewSet, basename="payment")
router.register(r"accounting/accounts", AccountViewSet, basename="account")
router.register(r"accounting/expenses", ExpenseViewSet, basename="expense")
router.register(r"accounting/transactions", TransactionViewSet, basename="transaction")

urlpatterns = [
    path("v1/health/", health, name="health"),
    path("v1/", include(router.urls)),
    path("v1/platform/", include(platform_router.urls)),
    path("v1/platform/", include("apps.accounts.urls_platform")),
    path("v1/platform/", include("apps.platform_billing.urls")),
    path("v1/", include("apps.accounts.urls_api")),
    path("v1/dashboard/summary/", DashboardSummaryView.as_view(), name="dashboard-summary"),
    path("v1/audit/", ActivityLogView.as_view(), name="audit-activity"),
    path("schema/", SpectacularAPIView.as_view(), name="schema"),
    path("docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
]
