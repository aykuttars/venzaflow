from rest_framework import serializers

from apps.appointments.models import Appointment, Schedule


class ScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Schedule
        fields = ("id", "name", "resource")


class AppointmentSerializer(serializers.ModelSerializer):
    customer_name = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = (
            "id",
            "customer",
            "customer_name",
            "start_at",
            "end_at",
            "status",
            "notes",
        )

    def get_customer_name(self, obj):
        c = obj.customer
        return f"{c.first_name} {c.last_name}"
