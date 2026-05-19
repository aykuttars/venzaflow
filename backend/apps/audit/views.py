from __future__ import annotations

from auditlog.models import LogEntry
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated

from apps.accounts.permissions import HasViewPermission
from apps.audit.serializers import LogEntrySerializer


class ActivityLogView(ListAPIView):
    """Recent audit log entries for the current tenant (via actor's tenant)."""

    serializer_class = LogEntrySerializer
    permission_classes = [IsAuthenticated, HasViewPermission]
    required_permission = "audit.read"

    def get_queryset(self):
        tid = self.request.user.tenant_id
        return (
            LogEntry.objects.filter(actor__tenant_id=tid)
            .select_related("actor", "content_type")
            .order_by("-timestamp")[:200]
        )
