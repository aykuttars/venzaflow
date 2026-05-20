import environ
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Repo root `.env` (optional)
environ.Env.read_env(BASE_DIR.parent / ".env")

env = environ.Env(
    DEBUG=(bool, False),
)

SECRET_KEY = env("SECRET_KEY", default="dev-insecure-change-me")
DEBUG = env("DEBUG")
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "django.contrib.postgres",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "django_filters",
    "drf_spectacular",
    "auditlog",
    "django_celery_results",
    "django_celery_beat",
    "channels",
    "apps.tenants",
    "apps.platform_billing",
    "apps.accounts",
    "apps.products",
    "apps.inventory",
    "apps.customers",
    "apps.appointments",
    "apps.billing",
    "apps.accounting",
    "apps.audit.apps.AuditConfig",
    "apps.dashboard",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.locale.LocaleMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "apps.tenants.middleware.TenantContextMiddleware",
    "apps.common.locale_middleware.RequestLocaleMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "auditlog.middleware.AuditlogMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("POSTGRES_DB", default="business"),
        "USER": env("POSTGRES_USER", default="app"),
        "PASSWORD": env("POSTGRES_PASSWORD", default="app"),
        "HOST": env("POSTGRES_HOST", default="localhost"),
        "PORT": env("POSTGRES_PORT", default="5432"),
        "CONN_MAX_AGE": 60,
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "tr"
LANGUAGES = [
    ("tr", "Türkçe"),
    ("en", "English"),
]
LOCALE_PATHS = [BASE_DIR / "locale"]
TIME_ZONE = env("TIME_ZONE", default="Europe/Istanbul")
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_USER_MODEL = "accounts.User"

CORS_ALLOWED_ORIGINS = env.list(
    "CORS_ALLOWED_ORIGINS",
    default=["http://localhost:4200", "http://127.0.0.1:4200", "http://localhost"],
)
CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[])

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "apps.accounts.authentication.TenantJWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.LimitOffsetPagination",
    "PAGE_SIZE": 25,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Business Management API",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
}

from datetime import timedelta

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "SIGNING_KEY": env("JWT_SIGNING_KEY", default=SECRET_KEY),
    "AUTH_HEADER_TYPES": ("Bearer",),
}

def _broker_url_from_env() -> str:
    host = env("RABBITMQ_HOST", default="")
    if not host:
        return env("CELERY_BROKER_URL", default="amqp://guest:guest@localhost:5672//")
    user = env("RABBITMQ_USER", default="guest")
    pwd = env("RABBITMQ_PASS", default="guest")
    port = env("RABBITMQ_PORT", default="5672")
    vhost = env("RABBITMQ_VHOST", default="/")
    return f"amqp://{user}:{pwd}@{host}:{port}/{vhost.lstrip('/')}"


# Broker: RabbitMQ via RABBITMQ_* when set.
CELERY_BROKER_URL = _broker_url_from_env()
# Results: django-celery-results (Postgres). Override with e.g. redis://... if needed.
CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND", default="django-db")
CELERY_RESULT_EXTENDED = True
CELERY_CACHE_BACKEND = "django-cache"
CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    }
}

# Deployment environment: image/container suffix + Celery queue isolation (dev vs prod).
ENVIRONMENT = env("ENVIRONMENT", default="prod").lower()
CELERY_QUEUE_PREFIX = ENVIRONMENT
CELERY_TASK_DEFAULT_QUEUE = f"{ENVIRONMENT}_default"


# Channels (WebSocket) — Redis-backed channel layer; routing currently empty.
ASGI_APPLICATION = "config.asgi.application"


def _redis_url_from_env() -> str:
    host = env("REDIS_HOST", default="")
    if not host:
        return "redis://localhost:6379/0"
    pwd = env("REDIS_PASSWORD", default="")
    port = env("REDIS_PORT", default="6379")
    db = env("REDIS_DB", default="0")
    auth = f":{pwd}@" if pwd else ""
    return f"redis://{auth}{host}:{port}/{db}"


REDIS_URL = _redis_url_from_env()

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [REDIS_URL]},
    },
}


# django-auditlog (explicit settings; package conf.py setattr is unreliable on Django 5)
AUDITLOG_INCLUDE_ALL_MODELS = False
AUDITLOG_EXCLUDE_TRACKING_MODELS = ()
AUDITLOG_INCLUDE_TRACKING_MODELS = ()
AUDITLOG_EXCLUDE_TRACKING_FIELDS = ()
AUDITLOG_MASK_TRACKING_FIELDS = ()
AUDITLOG_DISABLE_ON_RAW_SAVE = False
AUDITLOG_CID_HEADER = "x-correlation-id"
AUDITLOG_CID_GETTER = None
AUDITLOG_TWO_STEP_MIGRATION = False
AUDITLOG_USE_TEXT_CHANGES_IF_JSON_IS_NOT_PRESENT = False
AUDITLOG_DISABLE_REMOTE_ADDR = False
AUDITLOG_CHANGE_DISPLAY_TRUNCATE_LENGTH = 140
AUDITLOG_STORE_JSON_CHANGES = False
AUDITLOG_MASK_CALLABLE = None
AUDITLOG_LOGENTRY_MODEL = "auditlog.LogEntry"
AUDITLOG_USE_BASE_MANAGER = False
AUDITLOG_USE_FK_STRING_REPRESENTATION = False
