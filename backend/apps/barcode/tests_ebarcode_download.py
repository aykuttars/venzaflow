from __future__ import annotations

from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import Department, Permission
from apps.tenants.models import Tenant
from apps.tenants.subscription_service import set_module_subscriptions

User = get_user_model()

TAGS_RESPONSE = {
    "tags": [
        "develop-34-win-x64-setup.exe",
        "1.0.0-win-x64-venzaflow-ebarcode-1.0.0-setup-x64.exe",
        "1.0.0-mac-arm64-venzaflow-ebarcode-1.0.0-mac-arm64.dmg",
        "1.0.1-win-x64-venzaflow-ebarcode-1.0.1-setup-x64.exe",
    ]
}

MANIFEST_RESPONSE = {
    "layers": [
        {
            "mediaType": "application/octet-stream",
            "digest": "sha256:abc123",
            "size": 123,
        }
    ],
    "annotations": {
        "org.opencontainers.image.created": "2026-06-23T10:15:00Z",
    },
}


def _manifest_response():
    response = Mock()
    response.headers = {"Last-Modified": "Mon, 23 Jun 2026 12:00:00 GMT"}
    return MANIFEST_RESPONSE, response


@override_settings(
    ARTIFACT_REGISTRY_URL="https://artifacts.example.test",
    ARTIFACT_REGISTRY_EBARCODE_REPO="venzaflow/ebarcode",
    ARTIFACT_REGISTRY_USER="registry-user",
    ARTIFACT_REGISTRY_PASSWORD="registry-pass",
    ARTIFACT_REGISTRY_CACHE_TTL=300,
    CACHES={
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        }
    },
)
class EbarcodeDownloadApiTests(TestCase):
    def setUp(self):
        self.tenant = Tenant.objects.create(
            customer_code="EBC",
            name="Ebarcode Test",
            enabled_modules=["products", "inventory", "barcode"],
            max_users=5,
        )
        set_module_subscriptions(
            self.tenant,
            ["products", "inventory", "barcode"],
            module_parents={"barcode": "inventory"},
        )
        Permission.objects.get_or_create(codename="barcode.scan", defaults={"name": "barcode.scan"})
        dept = Department.objects.create(tenant=self.tenant, key="admin", name="Admin")
        dept.permissions.set(Permission.objects.filter(codename="barcode.scan"))
        self.user = User.all_tenants.create(
            tenant=self.tenant,
            email="admin@ebc.test",
            department=dept,
            is_active=True,
        )
        self.user.set_password("TestPass123!@#X")
        self.user.save()

        self.client = APIClient()
        cache.clear()

    @patch("apps.barcode.services.ebarcode_artifacts.resolve_manifest")
    @patch("apps.barcode.services.ebarcode_artifacts.fetch_tags")
    def test_releases_lists_latest_semver_only(self, fetch_tags, resolve_manifest):
        self.client.force_authenticate(user=self.user)
        fetch_tags.return_value = TAGS_RESPONSE["tags"]
        resolve_manifest.return_value = _manifest_response()
        response = self.client.get("/api/v1/barcode/ebarcode/releases/")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["configured"])
        self.assertEqual(body["status"], "ok")
        self.assertEqual(body["version"], "1.0.1")
        slugs = {item["slug"] for item in body["platforms"]}
        self.assertIn("windows", slugs)
        self.assertIn("mac-silicon", slugs)
        self.assertTrue(
            all(item["download_url"].endswith(f"/download/{item['slug']}/") for item in body["platforms"])
        )
        self.assertTrue(all(item["published_at"] == "2026-06-23T10:15:00Z" for item in body["platforms"]))

    @patch("apps.barcode.services.ebarcode_artifacts.stream_blob")
    @patch("apps.barcode.services.ebarcode_artifacts.resolve_download")
    def test_download_streams_installer_without_auth(self, resolve_download, stream_blob):
        resolve_download.return_value = (
            "1.0.1-win-x64-venzaflow-ebarcode-1.0.1-setup-x64.exe",
            "sha256:abc123",
            "venzaflow-ebarcode-1.0.1-setup-x64.exe",
        )
        stream_blob.return_value = iter([b"fake-installer"])

        response = self.client.get("/api/v1/barcode/ebarcode/download/windows/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(b"".join(response.streaming_content), b"fake-installer")
        self.assertIn("attachment", response["Content-Disposition"])

    def test_releases_requires_authentication(self):
        response = self.client.get("/api/v1/barcode/ebarcode/releases/")
        self.assertEqual(response.status_code, 401)

    def test_download_unknown_platform_404(self):
        response = self.client.get("/api/v1/barcode/ebarcode/download/unknown-os/")
        self.assertEqual(response.status_code, 404)

    @override_settings(ARTIFACT_REGISTRY_USER="", ARTIFACT_REGISTRY_PASSWORD="")
    def test_releases_not_configured(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/v1/barcode/ebarcode/releases/")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertFalse(body["configured"])
        self.assertEqual(body["status"], "not_configured")
        self.assertEqual(body["platforms"], [])

    @patch("apps.barcode.services.ebarcode_artifacts.resolve_manifest")
    @patch("apps.barcode.services.ebarcode_artifacts.fetch_tags")
    def test_releases_fallback_to_ci_builds(self, fetch_tags, resolve_manifest):
        self.client.force_authenticate(user=self.user)
        fetch_tags.return_value = [
            "develop-34-win-x64-venzaflow-ebarcode-1.0.0-setup-x64.exe",
            "develop-34-mac-arm64-venzaflow-ebarcode-1.0.0-mac-arm64.dmg",
        ]
        resolve_manifest.return_value = _manifest_response()
        response = self.client.get("/api/v1/barcode/ebarcode/releases/")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["status"], "preview")
        self.assertEqual(body["version"], "1.0.0")
        self.assertEqual(len(body["platforms"]), 2)
