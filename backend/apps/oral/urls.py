from django.urls import path

from apps.oral.views import PatientOralChartView

urlpatterns = [
    path("charts/<int:patient_id>/", PatientOralChartView.as_view(), name="oral-chart"),
]
