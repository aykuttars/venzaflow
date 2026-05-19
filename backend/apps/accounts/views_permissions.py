from __future__ import annotations

from django.utils.translation import gettext as _
from rest_framework.exceptions import PermissionDenied
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated

from apps.accounts.models import Permission
from apps.accounts.serializers import PermissionSerializer


class PermissionListView(ListAPIView):
    """Global permission catalog for department/user assignment UIs."""

    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def check_permissions(self, request):
        super().check_permissions(request)
        user = request.user
        if not (
            user.has_permission_codename("settings.read")
            or user.has_permission_codename("employees.write")
        ):
            raise PermissionDenied(_("You do not have permission to list permissions."))
