FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=300 \
    PIP_INDEX_URL=https://pypi.org/simple
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates curl libpq-dev gcc gettext \
        libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf-2.0-0 libcairo2 libffi-dev shared-mime-info \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY requirements.txt .
# Pin pip<26: pip 26 + slow PyPI can yield "django (from versions: none)" on flaky networks.
RUN python -m pip install --upgrade "pip>=24,<26" wheel setuptools \
    && python -m pip install --retries 5 -r requirements.txt

COPY . .
RUN python manage.py compilemessages
RUN chmod +x /app/docker-entrypoint.sh

ENV DJANGO_SETTINGS_MODULE=config.settings.prod

EXPOSE 8000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
