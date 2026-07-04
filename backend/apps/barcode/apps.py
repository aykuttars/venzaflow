from django.apps import AppConfig


class BarcodeConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.barcode"
    verbose_name = "Barcode"

    def ready(self) -> None:
        from apps.barcode import signals  # noqa: F401
