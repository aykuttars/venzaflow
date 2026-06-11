from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.signing.views import SignTaskViewSet

router = DefaultRouter()
router.register(r"tasks", SignTaskViewSet, basename="sign-task")

urlpatterns = [
    path("", include(router.urls)),
]
