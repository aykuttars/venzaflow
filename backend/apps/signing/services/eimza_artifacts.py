"""Resolve latest released e-imza installers from the private OCI artifact registry."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any

import requests
from django.conf import settings
from django.core.cache import cache

MANIFEST_ACCEPT = (
    "application/vnd.oci.image.manifest.v1+json,"
    " application/vnd.oci.image.index.v1+json"
)

SEMVER_PREFIX = re.compile(r"^(\d+)\.(\d+)\.(\d+)-")
FILENAME_SUFFIX = re.compile(r"-(?:mac|win|linux)-(?:x64|arm64)-(.+)$", re.I)
APP_VERSION_IN_TAG = re.compile(r"venzaflow-eimza-(\d+\.\d+\.\d+)", re.I)
CREATED_ANNOTATION = "org.opencontainers.image.created"


@dataclass(frozen=True)
class Platform:
    slug: str
    label: str
    hint: str
    pattern: re.Pattern[str]


PLATFORMS: tuple[Platform, ...] = (
    Platform("windows", "Windows (64-bit)", "Windows 10+", re.compile(r"-win-x64-.*\.exe$", re.I)),
    Platform(
        "windows-arm64",
        "Windows (ARM64)",
        "Windows 10+",
        re.compile(r"-win-arm64-.*\.exe$", re.I),
    ),
    Platform("mac-silicon", "macOS (Apple Silicon)", "macOS 11+", re.compile(r"-mac-arm64-.*\.dmg$", re.I)),
    Platform("mac-intel", "macOS (Intel)", "macOS 11+", re.compile(r"-mac-x64-.*\.dmg$", re.I)),
    Platform("linux", "Linux (64-bit)", "Ubuntu 22.04+ · AppImage", re.compile(r"-linux-x64-.*\.AppImage$", re.I)),
    Platform(
        "linux-deb",
        "Linux (64-bit, .deb)",
        "Ubuntu 22.04+",
        re.compile(r"-linux-x64-.*\.deb$", re.I),
    ),
    Platform(
        "linux-arm64",
        "Linux (ARM64)",
        "Ubuntu 22.04+ · AppImage",
        re.compile(r"-linux-arm64-.*\.AppImage$", re.I),
    ),
)

PLATFORM_BY_SLUG = {platform.slug: platform for platform in PLATFORMS}


class ArtifactRegistryError(Exception):
    pass


class ArtifactRegistryNotConfigured(ArtifactRegistryError):
    pass


def registry_configured() -> bool:
    return bool(settings.ARTIFACT_REGISTRY_USER and settings.ARTIFACT_REGISTRY_PASSWORD)


def _registry_url() -> str:
    return settings.ARTIFACT_REGISTRY_URL.rstrip("/")


def _auth() -> tuple[str, str]:
    user = settings.ARTIFACT_REGISTRY_USER
    password = settings.ARTIFACT_REGISTRY_PASSWORD
    if not user or not password:
        raise ArtifactRegistryNotConfigured("Artifact registry credentials are not configured.")
    return user, password


def _semver_key(tag: str) -> tuple[int, int, int]:
    match = SEMVER_PREFIX.match(tag)
    if not match:
        return (0, 0, 0)
    return (int(match.group(1)), int(match.group(2)), int(match.group(3)))


def _release_tags(tags: list[str]) -> list[str]:
    return [tag for tag in tags if SEMVER_PREFIX.match(tag)]


def _latest_release_version(tags: list[str]) -> str | None:
    release_tags = _release_tags(tags)
    if not release_tags:
        return None
    return max(release_tags, key=_semver_key).split("-", 1)[0]


def _run_sort_key(tag: str) -> tuple[int, int, str]:
    semver = SEMVER_PREFIX.match(tag)
    if semver:
        return (
            2,
            int(semver.group(1)) * 1_000_000 + int(semver.group(2)) * 1_000 + int(semver.group(3)),
            tag,
        )
    develop = re.match(r"^develop-(\d+)-", tag)
    if develop:
        return (1, int(develop.group(1)), tag)
    branch = re.match(r"^([a-zA-Z0-9._-]+)-(\d+)-(?:mac|win|linux)-", tag)
    if branch:
        return (1, int(branch.group(2)), tag)
    return (0, 0, tag)


def version_label_from_tag(tag: str) -> str | None:
    match = APP_VERSION_IN_TAG.search(tag)
    return match.group(1) if match else None


def filename_from_tag(tag: str) -> str:
    match = FILENAME_SUFFIX.search(tag)
    return match.group(1) if match else tag


def fetch_tags(*, session: requests.Session | None = None) -> list[str]:
    client = session or requests.Session()
    response = client.get(
        f"{_registry_url()}/v2/{settings.ARTIFACT_REGISTRY_REPO}/tags/list",
        auth=_auth(),
        timeout=30,
    )
    response.raise_for_status()
    tags = response.json().get("tags") or []
    skip_suffixes = (".blockmap", ".yml", ".yaml")
    return [tag for tag in tags if not tag.endswith(skip_suffixes)]


def pick_tag_for_platform(tags: list[str], platform: Platform, *, version: str | None = None) -> str | None:
    release_tags = _release_tags(tags)
    matches = [tag for tag in release_tags if platform.pattern.search(tag)]
    if version:
        prefix = f"{version}-"
        matches = [tag for tag in matches if tag.startswith(prefix)]
    if not matches:
        return None
    return max(matches, key=_semver_key)


def pick_latest_tag_for_platform(tags: list[str], platform: Platform) -> str | None:
    """Latest semver release for the platform, else newest CI build."""
    release_version = _latest_release_version(tags)
    if release_version:
        tag = pick_tag_for_platform(tags, platform, version=release_version)
        if tag:
            return tag
    matches = [tag for tag in tags if platform.pattern.search(tag)]
    if not matches:
        return None
    return max(matches, key=_run_sort_key)


def resolve_catalog(tags: list[str]) -> tuple[str | None, str]:
    """Return (display version, status: ok | preview | unavailable)."""
    release_version = _latest_release_version(tags)
    if release_version:
        return release_version, "ok"

    platform_tags = [pick_latest_tag_for_platform(tags, platform) for platform in PLATFORMS]
    platform_tags = [tag for tag in platform_tags if tag]
    if not platform_tags:
        return None, "unavailable"

    for tag in platform_tags:
        label = version_label_from_tag(tag)
        if label:
            return label, "preview"
    return None, "preview"


def _to_utc_iso(value: str) -> str:
    normalized = value.replace("Z", "+00:00")
    dt = datetime.fromisoformat(normalized)
    if dt.tzinfo is None:
        dt = dt.replace(tinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def published_at_from_manifest(manifest: dict[str, Any], response: requests.Response) -> str | None:
    """Return registry publish time as UTC ISO-8601 (annotation or Last-Modified)."""
    annotations = manifest.get("annotations") or {}
    created = annotations.get(CREATED_ANNOTATION)
    if isinstance(created, str) and created.strip():
        try:
            return _to_utc_iso(created.strip())
        except ValueError:
            pass

    last_modified = response.headers.get("Last-Modified")
    if last_modified:
        try:
            dt = parsedate_to_datetime(last_modified)
            if dt.tzinfo is None:
                dt = dt.replace(tinfo=timezone.utc)
            return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        except (TypeError, ValueError, OverflowError):
            pass
    return None


def resolve_manifest(client: requests.Session, tag: str) -> tuple[dict[str, Any], requests.Response]:
    response = client.get(
        f"{_registry_url()}/v2/{settings.ARTIFACT_REGISTRY_REPO}/manifests/{tag}",
        headers={"Accept": MANIFEST_ACCEPT},
        auth=_auth(),
        timeout=60,
    )
    response.raise_for_status()
    manifest = response.json()
    content_type = response.headers.get("Content-Type", "")
    if "index" in content_type or manifest.get("manifests"):
        for entry in manifest.get("manifests", []):
            digest = entry.get("digest")
            if not digest:
                continue
            ref_response = client.get(
                f"{_registry_url()}/v2/{settings.ARTIFACT_REGISTRY_REPO}/manifests/{digest}",
                headers={"Accept": MANIFEST_ACCEPT},
                auth=_auth(),
                timeout=60,
            )
            ref_response.raise_for_status()
            return ref_response.json(), ref_response
    return manifest, response


def layer_digest(manifest: dict[str, Any]) -> str:
    layers = manifest.get("layers") or []
    if not layers:
        raise ArtifactRegistryError("Installer layer not found in manifest.")
    for layer in layers:
        media_type = layer.get("mediaType", "")
        if media_type.startswith("application/") and "json" not in media_type:
            return layer["digest"]
    return layers[0]["digest"]


def resolve_download(platform_slug: str) -> tuple[str, str, str]:
    """Return (tag, blob_digest, filename) for the latest installer on a platform."""
    platform = PLATFORM_BY_SLUG.get(platform_slug)
    if not platform:
        raise ArtifactRegistryError("Unknown platform.")
    with requests.Session() as client:
        tags = fetch_tags(session=client)
        tag = pick_latest_tag_for_platform(tags, platform)
        if not tag:
            raise ArtifactRegistryError("No installer for this platform.")
        manifest, _response = resolve_manifest(client, tag)
        digest = layer_digest(manifest)
        return tag, digest, filename_from_tag(tag)


def stream_blob(digest: str):
    with requests.get(
        f"{_registry_url()}/v2/{settings.ARTIFACT_REGISTRY_REPO}/blobs/{digest}",
        auth=_auth(),
        stream=True,
        timeout=120,
    ) as response:
        response.raise_for_status()
        yield from response.iter_content(chunk_size=256 * 1024)


def build_releases_payload(*, download_url_builder) -> dict[str, Any]:
    if not registry_configured():
        return {
            "configured": False,
            "status": "not_configured",
            "version": None,
            "platforms": [],
        }

    cache_key = "signing:eimza:releases:v3"
    cached = cache.get(cache_key)
    if cached is not None:
        payload = dict(cached)
        for item in payload.get("platforms", []):
            item["download_url"] = download_url_builder(item["slug"])
        return payload

    with requests.Session() as client:
        tags = fetch_tags(session=client)
        version, status = resolve_catalog(tags)
        if status == "unavailable":
            payload = {
                "configured": True,
                "status": "unavailable",
                "version": None,
                "platforms": [],
            }
            cache.set(cache_key, payload, settings.ARTIFACT_REGISTRY_CACHE_TTL)
            return payload

        platforms: list[dict[str, Any]] = []
        for platform in PLATFORMS:
            tag = pick_latest_tag_for_platform(tags, platform)
            if not tag:
                continue
            manifest, response = resolve_manifest(client, tag)
            platforms.append(
                {
                    "slug": platform.slug,
                    "label": platform.label,
                    "hint": platform.hint,
                    "filename": filename_from_tag(tag),
                    "tag": tag,
                    "published_at": published_at_from_manifest(manifest, response),
                }
            )

        payload = {
            "configured": True,
            "status": status,
            "version": version,
            "platforms": platforms,
        }
        cache.set(cache_key, payload, settings.ARTIFACT_REGISTRY_CACHE_TTL)
        for item in payload["platforms"]:
            item["download_url"] = download_url_builder(item["slug"])
        return payload
