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
from apps.oral.views import OralTreatmentViewSet, ProcedureCatalogViewSet
from apps.dashboard.views import DashboardSummaryView
from apps.accounts.views_employees import EmployeeViewSet
from apps.inventory.views import (
    LocationViewSet,
    StockMovementViewSet,
    StockViewSet,
    WarehouseViewSet,
)
from apps.products.views import (
    CategoryViewSet,
    InventoryDashboardView,
    ProductDetailConfigViewSet,
    ProductFieldDefinitionViewSet,
    ProductFieldValueViewSet,
    ProductFormConfigViewSet,
    ProductListColumnConfigViewSet,
    ProductViewSet,
)
from apps.barcode.views import (
    BarcodeGenerateView,
    BarcodeLookupView,
    LabelTemplateViewSet,
    PrintJobViewSet,
    TransferWizardView,
)
from apps.tenants.views_platform import PlatformTenantViewSet
from apps.signing.views_integration import (
    PlatformTenantConnectionTestView,
    PlatformTenantConnectionView,
    PlatformTenantIntegrationView,
    PlatformTenantRoutingView,
)

router = DefaultRouter()
platform_router = DefaultRouter()
platform_router.register(r"tenants", PlatformTenantViewSet, basename="platform-tenant")
router.register(r"departments", DepartmentViewSet, basename="department")
router.register(r"employees", EmployeeViewSet, basename="employee")
router.register(r"products/categories", CategoryViewSet, basename="category")
router.register(r"products/field-definitions", ProductFieldDefinitionViewSet, basename="productfielddefinition")
router.register(r"products/field-values", ProductFieldValueViewSet, basename="productfieldvalue")
router.register(r"products/list-config", ProductListColumnConfigViewSet, basename="productlistconfig")
router.register(r"products/form-config", ProductFormConfigViewSet, basename="productformconfig")
router.register(r"products/detail-config", ProductDetailConfigViewSet, basename="productdetailconfig")
router.register(r"products", ProductViewSet, basename="product")
router.register(r"barcode/templates", LabelTemplateViewSet, basename="barcode-template")
router.register(r"barcode/print-jobs", PrintJobViewSet, basename="barcode-printjob")
router.register(r"inventory/warehouses", WarehouseViewSet, basename="warehouse")
router.register(r"inventory/locations", LocationViewSet, basename="location")
router.register(r"inventory/stock", StockViewSet, basename="stock")
router.register(r"inventory/movements", StockMovementViewSet, basename="stockmovement")
router.register(r"customers", CustomerViewSet, basename="customer")
router.register(r"patients", PatientViewSet, basename="patient")
router.register(r"medical-records", MedicalRecordViewSet, basename="medicalrecord")
router.register(r"oral/procedures", ProcedureCatalogViewSet, basename="oral-procedure")
router.register(r"oral/treatments", OralTreatmentViewSet, basename="oral-treatment")
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
    path(
        "v1/platform/tenants/<int:tenant_pk>/integration/",
        PlatformTenantIntegrationView.as_view(),
        name="platform-tenant-integration",
    ),
    path(
        "v1/platform/tenants/<int:tenant_pk>/integration/routing/",
        PlatformTenantRoutingView.as_view(),
        name="platform-tenant-routing",
    ),
    path(
        "v1/platform/tenants/<int:tenant_pk>/integration/connections/",
        PlatformTenantConnectionView.as_view(),
        name="platform-tenant-connections",
    ),
    path(
        "v1/platform/tenants/<int:tenant_pk>/integration/connections/<int:pk>/",
        PlatformTenantConnectionView.as_view(),
        name="platform-tenant-connection-detail",
    ),
    path(
        "v1/platform/tenants/<int:tenant_pk>/integration/connections/<int:pk>/test/",
        PlatformTenantConnectionTestView.as_view(),
        name="platform-tenant-connection-test",
    ),
    path("v1/", include("apps.accounts.urls_api")),
    path("v1/nvi/", include("apps.customers.nvi_urls")),
    path("v1/oral/", include("apps.oral.urls")),
    path("v1/prescriptions/", include("apps.prescriptions.urls")),
    path("v1/sign/", include("apps.signing.urls")),
    path("v1/dashboard/summary/", DashboardSummaryView.as_view(), name="dashboard-summary"),
    path("v1/inventory/dashboard/", InventoryDashboardView.as_view(), name="inventory-dashboard"),
    path("v1/barcode/lookup/", BarcodeLookupView.as_view(), name="barcode-lookup"),
    path("v1/barcode/generate/", BarcodeGenerateView.as_view(), name="barcode-generate"),
    path("v1/barcode/transfers/", TransferWizardView.as_view(), name="barcode-transfer"),
    path("v1/barcode/", include("apps.barcode.urls")),
    path("v1/audit/", ActivityLogView.as_view(), name="audit-activity"),
    path("schema/", SpectacularAPIView.as_view(), name="schema"),
    path("docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
]
