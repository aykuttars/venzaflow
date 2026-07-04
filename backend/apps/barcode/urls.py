from django.urls import path

from apps.barcode.views_ebarcode import EbarcodeDownloadView, EbarcodeReleasesView
from apps.barcode.views_scan_miss import ScanMissAssignView, ScanMissCreateView
from apps.barcode.views_settings import BarcodeSettingsEffectiveView, BarcodeSettingsView
from apps.barcode.views_stock import ManualStockDeductionView

urlpatterns = [
    path("settings/", BarcodeSettingsView.as_view(), name="barcode-settings"),
    path(
        "settings/effective/",
        BarcodeSettingsEffectiveView.as_view(),
        name="barcode-settings-effective",
    ),
    path("scan-miss/assign/", ScanMissAssignView.as_view(), name="barcode-scan-miss-assign"),
    path("scan-miss/create/", ScanMissCreateView.as_view(), name="barcode-scan-miss-create"),
    path("stock/manual-deduct/", ManualStockDeductionView.as_view(), name="barcode-manual-deduct"),
    path("ebarcode/releases/", EbarcodeReleasesView.as_view(), name="barcode-ebarcode-releases"),
    path(
        "ebarcode/download/<slug:slug>/",
        EbarcodeDownloadView.as_view(),
        name="barcode-ebarcode-download",
    ),
]
