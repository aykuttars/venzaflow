#!/usr/bin/env bash
# Run backend tests with explicit module labels (avoids Django discover issues).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-config.settings.dev}"

LABELS=(
  apps.tenants.tests
  apps.tenants.tests_subscription
  apps.tenants.test_module_labels
  apps.platform_billing.tests
  apps.accounts.tests_platform
  apps.accounts.tests_permissions_tenant
  apps.accounts.tests_rbac
  apps.products.tests_extension
  apps.products.tests_api_extension
  apps.inventory.tests_extension
  apps.inventory.tests_api_extension
  apps.inventory.tests_concurrency
  apps.customers.tests
  apps.customers.tests_nvi
  apps.customers.tests_patient_photo
  apps.oral.tests
  apps.billing.tests_oral_invoice
  apps.dashboard.tests
  apps.signing.tests
  apps.signing.tests_eimza_download
  apps.prescriptions.tests
  apps.prescriptions.tests_signing
  apps.barcode.tests_api
  apps.barcode.tests_barcode_settings
  apps.barcode.tests_ebarcode_download
  apps.barcode.tests_template_resolve
  apps.integrations.authority.tests_medula
  apps.tariff.tests
)

python manage.py test "${LABELS[@]}" "$@"
