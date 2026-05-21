from __future__ import annotations

from django.db.models import F, Sum
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import HasModule, HasViewPermission
from apps.appointments.models import Appointment
from apps.billing.models import Invoice, Payment
from apps.customers.models import Customer
from apps.inventory.models import Stock
from apps.accounting.models import Transaction
from apps.tenants.subscription_service import tenant_has_module


class DashboardSummaryView(APIView):
    permission_classes = [IsAuthenticated, HasModule, HasViewPermission]
    required_module = "dashboard"
    required_permission = "dashboard.read"

    def get(self, request):
        tenant = request.user.tenant
        tenant_id = request.user.tenant_id
        today = timezone.now().date()
        now = timezone.now()

        daily_sales = 0
        recent_payments: list[dict] = []
        open_invoices = 0
        if tenant_has_module(tenant, "billing"):
            daily_sales = (
                Payment.objects.filter(tenant_id=tenant_id, paid_at__date=today).aggregate(
                    total=Sum("amount")
                )["total"]
                or 0
            )
            recent_payments = list(
                Payment.objects.filter(tenant_id=tenant_id)
                .order_by("-paid_at")[:10]
                .values("id", "amount", "paid_at", "method", invoice_number=F("invoice__number"))
            )
            open_invoices = (
                Invoice.objects.filter(tenant_id=tenant_id)
                .exclude(status=Invoice.Status.PAID)
                .count()
            )

        customer_count = 0
        if tenant_has_module(tenant, "customers"):
            customer_count = Customer.objects.filter(
                tenant_id=tenant_id, kind=Customer.Kind.CUSTOMER
            ).count()

        patient_count = 0
        if tenant_has_module(tenant, "patients"):
            patient_count = Customer.objects.filter(
                tenant_id=tenant_id, kind=Customer.Kind.PATIENT
            ).count()

        critical_stock: list[dict] = []
        if tenant_has_module(tenant, "inventory"):
            critical_stock = list(
                Stock.objects.filter(tenant_id=tenant_id)
                .filter(quantity__lte=F("reorder_level"))
                .select_related("product", "warehouse")[:10]
                .values(
                    "id",
                    "quantity",
                    "reorder_level",
                    sku=F("product__sku"),
                    product_name=F("product__name"),
                    warehouse_code=F("warehouse__code"),
                )
            )

        upcoming_appointments: list[dict] = []
        if tenant_has_module(tenant, "appointments"):
            upcoming_appointments = list(
                Appointment.objects.filter(tenant_id=tenant_id, start_at__gte=now)
                .exclude(status=Appointment.Status.CANCELLED)
                .order_by("start_at")[:10]
                .values("id", "start_at", "end_at", "status", "notes")
            )

        recent_transactions: list[dict] = []
        if tenant_has_module(tenant, "accounting"):
            recent_transactions = list(
                Transaction.objects.filter(tenant_id=tenant_id)
                .order_by("-occurred_at")[:10]
                .values("id", "kind", "amount", "description", "occurred_at")
            )

        return Response(
            {
                "daily_sales": daily_sales,
                "customer_count": customer_count,
                "patient_count": patient_count,
                "critical_stock": critical_stock,
                "upcoming_appointments": upcoming_appointments,
                "recent_payments": recent_payments,
                "recent_transactions": recent_transactions,
                "open_invoices_count": open_invoices,
            }
        )
