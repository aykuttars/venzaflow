from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.prescriptions.views import DrugCatalogViewSet, PrescriptionViewSet

router = DefaultRouter()
router.register(r"drugs", DrugCatalogViewSet, basename="prescription-drug")
router.register(r"", PrescriptionViewSet, basename="prescription")

urlpatterns = [
    path("", include(router.urls)),
]
