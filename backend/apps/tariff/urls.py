from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.tariff.views import (
    ActiveTariffView,
    PlatformDentalTariffViewSet,
    TariffItemSearchView,
    TariffViolationsView,
)

router = DefaultRouter()
router.register(r"tariffs", PlatformDentalTariffViewSet, basename="platform-tariff")

urlpatterns = [
    path("platform/", include(router.urls)),
    path("tariff/", ActiveTariffView.as_view(), name="tariff-active"),
    path("tariff/items/", TariffItemSearchView.as_view(), name="tariff-items"),
    path("tariff/violations/", TariffViolationsView.as_view(), name="tariff-violations"),
]
