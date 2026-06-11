#!/usr/bin/env python3
"""Apply signing app patches to shared backend on VM."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path("/home/aykutt/Projects/shared/backend")


def patch_installed_apps() -> None:
    path = ROOT / "config/settings/base.py"
    text = path.read_text()
    if '"apps.signing"' in text:
        return
    text = text.replace(
        '    "apps.dashboard",\n]',
        '    "apps.dashboard",\n    "apps.signing",\n]',
    )
    path.write_text(text)


def patch_api_urls() -> None:
    path = ROOT / "config/api_urls.py"
    text = path.read_text()
    if "apps.signing.urls" in text:
        return
    text = text.replace(
        '    path("v1/oral/", include("apps.oral.urls")),\n',
        '    path("v1/oral/", include("apps.oral.urls")),\n'
        '    path("v1/sign/", include("apps.signing.urls")),\n',
    )
    path.write_text(text)


def patch_permission_codes() -> None:
    path = ROOT / "apps/common/permission_codes.py"
    text = path.read_text()
    if '"signing.read"' in text:
        return
    text = text.replace(
        '    ("audit.read", "View audit logs"),\n]',
        '    ("audit.read", "View audit logs"),\n'
        '    ("signing.read", "View signing tasks"),\n'
        '    ("signing.write", "Manage signing tasks"),\n]',
    )
    text = text.replace(
        '    "audit",\n]',
        '    "audit",\n    "signing",\n]',
    )
    path.write_text(text)


def patch_requirements() -> None:
    path = ROOT / "requirements.txt"
    text = path.read_text()
    if "cryptography" in text:
        return
    if not text.endswith("\n"):
        text += "\n"
    text += "cryptography>=42.0\n"
    path.write_text(text)


def main() -> None:
    patch_installed_apps()
    patch_api_urls()
    patch_permission_codes()
    patch_requirements()
    print("Patches applied.")


if __name__ == "__main__":
    main()
