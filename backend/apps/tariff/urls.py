from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.tariff.views import (
    ActiveTariffView,
    PlatformDentalTariffViewSet,
    TariffItemClinicPriceView,
    TariffItemListView,
    TariffSyncProceduresView,
    TariffViolationsView,
)

router = DefaultRouter()
router.register(r"tariffs", PlatformDentalTariffViewSet, basename="platform-tariff")

urlpatterns = [
    path("platform/", include(router.urls)),
    path("tariff/", ActiveTariffView.as_view(), name="tariff-active"),
    path("tariff/items/", TariffItemListView.as_view(), name="tariff-items"),
    path(
        "tariff/items/<int:item_id>/clinic-price/",
        TariffItemClinicPriceView.as_view(),
        name="tariff-item-clinic-price",
    ),
    path("tariff/sync-procedures/", TariffSyncProceduresView.as_view(), name="tariff-sync-procedures"),
    path("tariff/violations/", TariffViolationsView.as_view(), name="tariff-violations"),
]
