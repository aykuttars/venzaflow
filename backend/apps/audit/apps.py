from django.apps import AppConfig


class AuditConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.audit"
    verbose_name = "Audit"

    def ready(self) -> None:
        # pylint: disable=import-outside-toplevel
        from apps.audit import registration

        registration.register_models()
