from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.signing.views import SignTaskViewSet
from apps.signing.views_eimza import EimzaDownloadView, EimzaReleasesView
from apps.signing.views_integration import (
    IntegrationConnectionViewSet,
    SigningProfileView,
    SigningRoutingView,
)

router = DefaultRouter()
router.register(r"tasks", SignTaskViewSet, basename="sign-task")
router.register(
    r"integration/connections", IntegrationConnectionViewSet, basename="sign-connection"
)

urlpatterns = [
    path("eimza/releases/", EimzaReleasesView.as_view(), name="sign-eimza-releases"),
    path("eimza/download/<slug:slug>/", EimzaDownloadView.as_view(), name="sign-eimza-download"),
    path("integration/", SigningProfileView.as_view(), name="sign-integration"),
    path("integration/routing/", SigningRoutingView.as_view(), name="sign-routing"),
    path("", include(router.urls)),
]
