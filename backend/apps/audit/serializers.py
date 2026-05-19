from rest_framework import serializers
from auditlog.models import LogEntry


class LogEntrySerializer(serializers.ModelSerializer):
    actor_email = serializers.EmailField(source="actor.email", read_only=True)
    model = serializers.CharField(source="content_type.model", read_only=True)

    class Meta:
        model = LogEntry
        fields = (
            "id",
            "timestamp",
            "action",
            "object_repr",
            "object_pk",
            "changes",
            "actor",
            "actor_email",
            "model",
        )
