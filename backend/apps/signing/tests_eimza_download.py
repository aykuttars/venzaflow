from __future__ import annotations

from unittest.mock import Mock, patch

from django.test import TestCase, override_settings
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.signing.services import eimza_artifacts


TAGS_RESPONSE = {
    "tags": [
        "develop-34-win-x64-setup.exe",
        "1.0.0-win-x64-venzaflow-eimza-1.0.0-setup-x64.exe",
        "1.0.0-mac-arm64-venzaflow-eimza-1.0.0-mac-arm64.dmg",
        "1.0.1-win-x64-venzaflow-eimza-1.0.1-setup-x64.exe",
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
    ARTIFACT_REGISTRY_REPO="venzaflow/eimza",
    ARTIFACT_REGISTRY_USER="registry-user",
    ARTIFACT_REGISTRY_PASSWORD="registry-pass",
    ARTIFACT_REGISTRY_CACHE_TTL=300,
)
class EimzaDownloadApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        cache.clear()

    @patch("apps.signing.services.eimza_artifacts.resolve_manifest")
    @patch("apps.signing.services.eimza_artifacts.fetch_tags")
    def test_releases_lists_latest_semver_only(self, fetch_tags, resolve_manifest):
        fetch_tags.return_value = TAGS_RESPONSE["tags"]
        resolve_manifest.return_value = _manifest_response()
        response = self.client.get("/api/v1/sign/eimza/releases/")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["configured"])
        self.assertEqual(body["status"], "ok")
        self.assertEqual(body["version"], "1.0.1")
        slugs = {item["slug"] for item in body["platforms"]}
        self.assertIn("windows", slugs)
        self.assertIn("mac-silicon", slugs)
        self.assertTrue(all(item["download_url"].endswith(f"/download/{item['slug']}/") for item in body["platforms"]))
        self.assertTrue(all(item["published_at"] == "2026-06-23T10:15:00Z" for item in body["platforms"]))

    @patch("apps.signing.services.eimza_artifacts.stream_blob")
    @patch("apps.signing.services.eimza_artifacts.resolve_download")
    def test_download_streams_installer(self, resolve_download, stream_blob):
        resolve_download.return_value = (
            "1.0.1-win-x64-venzaflow-eimza-1.0.1-setup-x64.exe",
            "sha256:abc123",
            "venzaflow-eimza-1.0.1-setup-x64.exe",
        )
        stream_blob.return_value = iter([b"fake-installer"])

        response = self.client.get("/api/v1/sign/eimza/download/windows/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(b"".join(response.streaming_content), b"fake-installer")
        self.assertIn("attachment", response["Content-Disposition"])

    def test_download_unknown_platform_404(self):
        response = self.client.get("/api/v1/sign/eimza/download/unknown-os/")
        self.assertEqual(response.status_code, 404)

    @override_settings(ARTIFACT_REGISTRY_USER="", ARTIFACT_REGISTRY_PASSWORD="")
    def test_releases_not_configured(self):
        response = self.client.get("/api/v1/sign/eimza/releases/")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertFalse(body["configured"])
        self.assertEqual(body["status"], "not_configured")
        self.assertEqual(body["platforms"], [])

    @patch("apps.signing.services.eimza_artifacts.resolve_manifest")
    @patch("apps.signing.services.eimza_artifacts.fetch_tags")
    def test_releases_fallback_to_ci_builds(self, fetch_tags, resolve_manifest):
        fetch_tags.return_value = [
            "develop-34-win-x64-venzaflow-eimza-1.0.0-setup-x64.exe",
            "develop-34-mac-arm64-venzaflow-eimza-1.0.0-mac-arm64.dmg",
        ]
        resolve_manifest.return_value = _manifest_response()
        response = self.client.get("/api/v1/sign/eimza/releases/")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["status"], "preview")
        self.assertEqual(body["version"], "1.0.0")
        self.assertEqual(len(body["platforms"]), 2)

    @patch("apps.signing.services.eimza_artifacts.resolve_manifest")
    @patch("apps.signing.services.eimza_artifacts.fetch_tags")
    def test_releases_prefers_newer_ci_build_over_higher_run_number(self, fetch_tags, resolve_manifest):
        fetch_tags.return_value = [
            "develop-44-win-x64-venzaflow-eimza-1.0.0-setup-x64.exe",
            "develop-3-win-x64-venzaflow-eimza-1.0.0-setup-x64.exe",
        ]

        def manifest_for_tag(_client, tag):
            if "develop-3-" in tag:
                created = "2026-07-08T17:23:29Z"
            else:
                created = "2026-07-04T12:52:29Z"
            response = Mock()
            response.headers = {}
            return (
                {
                    "layers": [{"mediaType": "application/octet-stream", "digest": f"sha256:{tag}"}],
                    "annotations": {"org.opencontainers.image.created": created},
                },
                response,
            )

        resolve_manifest.side_effect = manifest_for_tag
        response = self.client.get("/api/v1/sign/eimza/releases/")
        self.assertEqual(response.status_code, 200)
        windows = next(item for item in response.json()["platforms"] if item["slug"] == "windows")
        self.assertIn("develop-3-win-x64", windows["tag"])
        self.assertEqual(windows["published_at"], "2026-07-08T17:23:29Z")


@override_settings(
    ARTIFACT_REGISTRY_URL="https://artifacts.example.test",
    ARTIFACT_REGISTRY_REPO="venzaflow/eimza",
    ARTIFACT_REGISTRY_USER="registry-user",
    ARTIFACT_REGISTRY_PASSWORD="registry-pass",
    ARTIFACT_REGISTRY_CACHE_TTL=300,
)
class EimzaArtifactPickerTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_pick_latest_ci_build_by_publish_date(self):
        platform = eimza_artifacts.PLATFORM_BY_SLUG["windows"]
        tags = [
            "develop-44-win-x64-venzaflow-eimza-1.0.0-setup-x64.exe",
            "develop-3-win-x64-venzaflow-eimza-1.0.0-setup-x64.exe",
        ]
        client = Mock()

        def manifest_for_tag(_client, tag):
            if "develop-3-" in tag:
                created = "2026-07-08T17:23:29Z"
            else:
                created = "2026-07-04T12:52:29Z"
            response = Mock()
            response.headers = {}
            return (
                {"annotations": {"org.opencontainers.image.created": created}, "layers": []},
                response,
            )

        with patch("apps.signing.services.eimza_artifacts.resolve_manifest", side_effect=manifest_for_tag):
            tag = eimza_artifacts.pick_latest_tag_for_platform(tags, platform, client=client)

        self.assertEqual(tag, "develop-3-win-x64-venzaflow-eimza-1.0.0-setup-x64.exe")
