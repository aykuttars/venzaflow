from __future__ import annotations

from rest_framework import serializers

from apps.signing.models import SignTask


class SignTaskSerializer(serializers.ModelSerializer):
    metadata = serializers.JSONField(required=False)

    class Meta:
        model = SignTask
        fields = (
            "id",
            "document_type",
            "title",
            "description",
            "status",
            "created_at",
            "metadata",
        )
        read_only_fields = fields


class SignTaskCreateSerializer(serializers.Serializer):
    document_type = serializers.ChoiceField(choices=SignTask.DocumentType.choices)
    title = serializers.CharField(max_length=255, required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    metadata = serializers.JSONField(required=False)


class SignPrepareRequestSerializer(serializers.Serializer):
    certificate_der_base64 = serializers.CharField(required=False, allow_blank=True)


class SignPrepareResponseSerializer(serializers.Serializer):
    task_id = serializers.IntegerField(source="id")
    data_to_sign_base64 = serializers.SerializerMethodField()
    algorithm = serializers.CharField()
    document_type = serializers.CharField()

    def get_data_to_sign_base64(self, obj: SignTask) -> str:
        return obj.data_to_sign


class SignCompleteRequestSerializer(serializers.Serializer):
    signature_base64 = serializers.CharField()
    certificate_der_base64 = serializers.CharField()


class SignCompleteResponseSerializer(serializers.Serializer):
    task_id = serializers.IntegerField(source="id")
    status = serializers.CharField()
    message = serializers.SerializerMethodField()
    external_reference = serializers.CharField(allow_blank=True)

    def get_message(self, obj: SignTask) -> str:
        if obj.status == SignTask.Status.FAILED and obj.error_message:
            return obj.error_message
        return "Belge başarıyla imzalandı ve otoriteye iletildi."
