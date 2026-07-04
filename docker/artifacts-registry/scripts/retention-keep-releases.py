#!/usr/bin/env python3
"""Keep recent releases in an OCI registry repo; delete older tags + cosign sigs.

Modes:
  global       — keep last N release prefixes repo-wide (develop-43, 1.0.5, …)
  per-platform — keep last N release tag(s) per installer type (linux-x64 AppImage, …)
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys
import urllib.error
import urllib.request

ACCEPT = (
    "application/vnd.oci.image.manifest.v1+json,"
    " application/vnd.oci.image.index.v1+json"
)
SEMVER = re.compile(r"^(\d+\.\d+\.\d+)-")
DEVELOP = re.compile(r"^(develop-\d+)-")
BRANCH = re.compile(r"^([a-zA-Z0-9._-]+-\d+)-(?:mac|win|linux)-")
SIG = re.compile(r"^sha256-([a-f0-9]{64})\.sig$")
# Matches backend/apps/signing/services/eimza_artifacts.py PLATFORMS (download page).
PLATFORM_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("win-x64", re.compile(r"-win-x64-.*\.exe$", re.I)),
    ("win-arm64", re.compile(r"-win-arm64-.*\.exe$", re.I)),
    ("mac-arm64", re.compile(r"-mac-arm64-.*\.dmg$", re.I)),
    ("mac-x64", re.compile(r"-mac-x64-.*\.dmg$", re.I)),
    ("linux-x64-appimage", re.compile(r"-linux-x64-.*\.AppImage$", re.I)),
    ("linux-x64-deb", re.compile(r"-linux-x64-.*\.deb$", re.I)),
    ("linux-arm64-appimage", re.compile(r"-linux-arm64-.*\.AppImage$", re.I)),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default=os.environ.get("ARTIFACT_REGISTRY_URL", "http://127.0.0.1:5099"))
    parser.add_argument("--user", default=os.environ.get("ARTIFACT_REGISTRY_USER", ""))
    parser.add_argument("--password", default=os.environ.get("ARTIFACT_REGISTRY_PASSWORD", ""))
    parser.add_argument("--repo", action="append", dest="repos", default=[])
    parser.add_argument("--keep", type=int, default=int(os.environ.get("KEEP_RELEASES", "2")))
    parser.add_argument(
        "--mode",
        choices=("global", "per-platform"),
        default=os.environ.get("RETENTION_MODE", "global"),
    )
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def request(method: str, url: str, auth: str, headers: dict[str, str] | None = None):
    req_headers = {"Authorization": f"Basic {auth}"}
    if headers:
        req_headers.update(headers)
    req = urllib.request.Request(url, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.status, dict(resp.headers), resp.read()
    except urllib.error.HTTPError as exc:
        body = exc.read()
        raise RuntimeError(f"{method} {url} -> HTTP {exc.code}: {body[:200]!r}") from exc


def list_tags(base: str, repo: str, auth: str) -> list[str]:
    _, _, body = request("GET", f"{base}/v2/{repo}/tags/list", auth)
    payload = json.loads(body)
    return payload.get("tags") or []


def manifest_digest(base: str, repo: str, tag: str, auth: str) -> str:
    _, headers, _ = request(
        "HEAD",
        f"{base}/v2/{repo}/manifests/{tag}",
        auth,
        {"Accept": ACCEPT},
    )
    digest = headers.get("Docker-Content-Digest") or headers.get("docker-content-digest")
    if not digest:
        raise RuntimeError(f"no digest for {repo}:{tag}")
    return digest


def delete_manifest(base: str, repo: str, digest: str, auth: str, *, dry_run: bool) -> None:
    if dry_run:
        return
    request(
        "DELETE",
        f"{base}/v2/{repo}/manifests/{digest}",
        auth,
        {"Accept": ACCEPT},
    )


def release_sort_key(prefix: str) -> tuple:
    semver = SEMVER.match(prefix)
    if semver:
        major, minor, patch = map(int, semver.group(1).split("."))
        return (2, major, minor, patch)

    develop = DEVELOP.match(prefix)
    if develop:
        return (1, int(develop.group(1).split("-")[1]))

    branch = re.match(r"^(.+)-(\d+)-$", prefix)
    if branch:
        return (0, int(branch.group(2)), branch.group(1))

    return (-1, prefix)


def tag_release_prefix(tag: str) -> str | None:
    if tag.endswith(".sig"):
        return None
    semver = SEMVER.match(tag)
    if semver:
        return f"{semver.group(1)}-"
    develop = DEVELOP.match(tag)
    if develop:
        return f"{develop.group(1)}-"
    branch = BRANCH.match(tag)
    if branch:
        return f"{branch.group(1)}-"
    return None


def prefixes_to_keep(tags: list[str], keep: int) -> set[str]:
    prefixes = {prefix for tag in tags if (prefix := tag_release_prefix(tag))}
    ordered = sorted(prefixes, key=release_sort_key, reverse=True)
    return set(ordered[:keep])


def platform_slug(tag: str) -> str | None:
    for slug, pattern in PLATFORM_PATTERNS:
        if pattern.search(tag):
            return slug
    return None


def tags_to_keep_per_platform(tags: list[str], keep: int) -> set[str]:
    buckets: dict[str, list[str]] = {}
    for tag in tags:
        if tag.endswith(".sig"):
            continue
        slug = platform_slug(tag)
        if slug:
            buckets.setdefault(slug, []).append(tag)

    keep_tags: set[str] = set()
    for slug, bucket in sorted(buckets.items()):
        ranked = sorted(
            bucket,
            key=lambda tag: release_sort_key(tag_release_prefix(tag) or ""),
            reverse=True,
        )
        kept = ranked[:keep]
        keep_tags.update(kept)
        print(f"  {slug}: keep {', '.join(kept)}")
    return keep_tags


def purge_repo(
    *,
    base: str,
    repo: str,
    auth: str,
    keep: int,
    mode: str,
    dry_run: bool,
) -> tuple[int, int]:
    tags = list_tags(base, repo, auth)
    if not tags:
        print(f"{repo}: no tags")
        return 0, 0

    if mode == "per-platform":
        print(f"{repo}: keep last {keep} release(s) per platform")
        keep_installer_tags = tags_to_keep_per_platform(tags, keep)
        keep_digests = {manifest_digest(base, repo, tag, auth) for tag in keep_installer_tags}
    else:
        keep_prefixes = prefixes_to_keep(tags, keep)
        print(
            f"{repo}: keep last {keep} release(s): "
            f"{', '.join(sorted(keep_prefixes, key=release_sort_key, reverse=True))}"
        )
        keep_digests = set()
        for tag in tags:
            tag_prefix = tag_release_prefix(tag)
            if tag_prefix and tag_prefix in keep_prefixes:
                keep_digests.add(manifest_digest(base, repo, tag, auth))
        keep_installer_tags = {
            tag for tag in tags if (prefix := tag_release_prefix(tag)) and prefix in keep_prefixes
        }

    deleted = 0
    seen_digests: set[str] = set()
    for tag in tags:
        if tag in keep_installer_tags:
            continue
        match = SIG.match(tag)
        if match and f"sha256:{match.group(1)}" in keep_digests:
            continue

        digest = manifest_digest(base, repo, tag, auth)
        if digest in seen_digests:
            print(f"skip digest already deleted: {repo}:{tag}")
            continue

        action = "WOULD DELETE" if dry_run else "DELETED"
        print(f"{action} {repo}:{tag} ({digest})")
        delete_manifest(base, repo, digest, auth, dry_run=dry_run)
        seen_digests.add(digest)
        deleted += 1

    remaining = list_tags(base, repo, auth)
    print(f"{repo}: {len(remaining)} tag(s) remaining")
    return deleted, len(remaining)


def main() -> int:
    args = parse_args()
    if not args.user or not args.password:
        print("ARTIFACT_REGISTRY_USER and ARTIFACT_REGISTRY_PASSWORD are required", file=sys.stderr)
        return 1

    repos = args.repos or [
        os.environ.get("ARTIFACT_REGISTRY_REPO", "venzaflow/eimza"),
        os.environ.get("ARTIFACT_REGISTRY_EBARCODE_REPO", "venzaflow/ebarcode"),
    ]
    base = args.url.rstrip("/")
    auth = base64.b64encode(f"{args.user}:{args.password}".encode()).decode()

    total_deleted = 0
    for repo in repos:
        try:
            deleted, _ = purge_repo(
                base=base,
                repo=repo,
                auth=auth,
                keep=args.keep,
                mode=args.mode,
                dry_run=args.dry_run,
            )
            total_deleted += deleted
        except RuntimeError as exc:
            if "HTTP 404" in str(exc):
                print(f"{repo}: repo not found, skip")
                continue
            raise

    print(f"Done. {'Would delete' if args.dry_run else 'Deleted'} {total_deleted} manifest(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
