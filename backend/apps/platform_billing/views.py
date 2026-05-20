from __future__ import annotations

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsPlatformAdmin
from apps.platform_billing.models import (
    Currency,
    ExchangeRate,
    ModulePrice,
    PlatformBillingSettings,
    TaxRate,
    TaxType,
    TenantSubscriptionInvoice,
)
from apps.platform_billing.serializers import (
    CurrencySerializer,
    ExchangeRateSerializer,
    GenerateInvoiceSerializer,
    ManualExchangeRateSerializer,
    MarkPaidSerializer,
    ModulePriceSerializer,
    PlatformBillingSettingsSerializer,
    TaxRateSerializer,
    TaxTypeSerializer,
    TenantSubscriptionInvoiceDetailSerializer,
    TenantSubscriptionInvoiceListSerializer,
    TenantSubscriptionInvoiceSerializer,
)
from apps.platform_billing.services.fx_service import get_latest_rate, save_manual_rate
from apps.platform_billing.services.invoice_service import (
    can_generate_subscription_invoice,
    generate_subscription_invoice,
    invoice_generation_status,
    mark_invoice_paid,
)
from apps.platform_billing.services.pdf_service import render_invoice_pdf
from apps.tenants.models import Tenant


class PlatformBillingPermissionMixin:
    permission_classes = [IsPlatformAdmin]


class CurrencyViewSet(PlatformBillingPermissionMixin, viewsets.ModelViewSet):
    queryset = Currency.objects.all().order_by("code")
    serializer_class = CurrencySerializer
    lookup_field = "code"


class ExchangeRateLatestView(PlatformBillingPermissionMixin, APIView):
    def get(self, request):
        codes = Currency.objects.filter(is_active=True).values_list("code", flat=True)
        data = []
        for code in codes:
            try:
                rate = get_latest_rate(code)
                data.append(ExchangeRateSerializer(rate).data)
            except (Currency.DoesNotExist, ValueError):
                continue
        return Response(data)


class ExchangeRateManualView(PlatformBillingPermissionMixin, APIView):
    def post(self, request):
        ser = ManualExchangeRateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        rate = save_manual_rate(
            ser.validated_data["currency_code"],
            ser.validated_data["rate_to_try"],
        )
        return Response(ExchangeRateSerializer(rate).data, status=status.HTTP_201_CREATED)


class TaxTypeViewSet(PlatformBillingPermissionMixin, viewsets.ModelViewSet):
    queryset = TaxType.objects.all().order_by("code")
    serializer_class = TaxTypeSerializer


class TaxRateViewSet(PlatformBillingPermissionMixin, viewsets.ModelViewSet):
    queryset = TaxRate.objects.select_related("tax_type").all()
    serializer_class = TaxRateSerializer


class ModulePriceViewSet(PlatformBillingPermissionMixin, viewsets.ModelViewSet):
    queryset = ModulePrice.objects.all().order_by("module_slug")
    serializer_class = ModulePriceSerializer


class PlatformBillingSettingsView(PlatformBillingPermissionMixin, APIView):
    def get(self, request):
        return Response(PlatformBillingSettingsSerializer(PlatformBillingSettings.get_solo()).data)

    def patch(self, request):
        obj = PlatformBillingSettings.get_solo()
        ser = PlatformBillingSettingsSerializer(obj, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)


class TenantSubscriptionInvoiceViewSet(
    PlatformBillingPermissionMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = TenantSubscriptionInvoiceSerializer

    def get_serializer_class(self):
        if self.action in ("retrieve", "create", "mark_paid"):
            return TenantSubscriptionInvoiceDetailSerializer
        if self.action == "list":
            return TenantSubscriptionInvoiceListSerializer
        return TenantSubscriptionInvoiceSerializer

    def get_tenant(self) -> Tenant:
        return get_object_or_404(Tenant, pk=self.kwargs["tenant_pk"])

    def get_queryset(self):
        return (
            TenantSubscriptionInvoice.objects.filter(tenant_id=self.kwargs["tenant_pk"])
            .select_related("tenant", "currency")
            .prefetch_related("lines")
            .order_by("-period_end", "-number")
        )

    @action(detail=False, methods=["get"], url_path="can-generate")
    def can_generate(self, request, tenant_pk=None):
        tenant = self.get_tenant()
        return Response(invoice_generation_status(tenant))

    def create(self, request, *args, **kwargs):
        ser = GenerateInvoiceSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        tenant = self.get_tenant()
        if not can_generate_subscription_invoice(tenant):
            status_data = invoice_generation_status(tenant)
            return Response(
                {
                    "detail": "An invoice already exists for the current billing period.",
                    **status_data,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            invoice = generate_subscription_invoice(
                tenant,
                period_start=ser.validated_data.get("period_start"),
                period_end=ser.validated_data.get("period_end"),
                issue=ser.validated_data.get("issue", True),
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        invoice = self.get_queryset().get(pk=invoice.pk)
        return Response(
            TenantSubscriptionInvoiceDetailSerializer(invoice).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="mark-paid")
    def mark_paid(self, request, tenant_pk=None, pk=None):
        invoice = self.get_object()
        ser = MarkPaidSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            mark_invoice_paid(
                invoice,
                method=ser.validated_data["method"],
                reference=ser.validated_data.get("reference", ""),
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        invoice = self.get_queryset().get(pk=invoice.pk)
        return Response(TenantSubscriptionInvoiceDetailSerializer(invoice).data)

    @action(detail=True, methods=["get"], url_path="pdf")
    def pdf(self, request, tenant_pk=None, pk=None):
        invoice = self.get_object()
        content = render_invoice_pdf(invoice)
        response = HttpResponse(content, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{invoice.number}.pdf"'
        return response
