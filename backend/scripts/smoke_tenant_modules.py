#!/usr/bin/env python
"""Smoke-check module API access for tenant 1000 and 4500 profiles."""

from __future__ import annotations

import json
import os
import sys
from dataclasses import dataclass

import requests

API_BASE = os.environ.get("SMOKE_API_BASE", "http://127.0.0.1:8001/api/v1").rstrip("/")


@dataclass(frozen=True)
class TenantProfile:
    code: str
    email: str
    password: str
    expect_ok: tuple[str, ...]
    expect_forbidden: tuple[str, ...]


PROFILES: tuple[TenantProfile, ...] = (
    TenantProfile(
        code="1000",
        email=os.environ.get("SMOKE_T1000_EMAIL", "admin@admin.com"),
        password=os.environ.get("SMOKE_T1000_PASSWORD", "X7@qL9#vT2!mZ4$k"),
        expect_ok=(
            "/dashboard/summary/",
            "/products/",
            "/inventory/stock/",
            "/barcode/templates/",
            "/service/tickets/",
            "/billing/invoices/",
            "/accounting/transactions/",
            "/patients/",
            "/appointments/",
            "/sign/tasks/",
            "/sign/eimza/releases/",
            "/employees/",
            "/audit/",
        ),
        expect_forbidden=(
            "/customers/",
        ),
    ),
    TenantProfile(
        code="4500",
        email=os.environ.get("SMOKE_T4500_EMAIL", "yonetici@lens.local"),
        password=os.environ.get("SMOKE_T4500_PASSWORD", "X7@qL9#vT2!mZ4$k"),
        expect_ok=(
            "/dashboard/summary/",
            "/products/",
            "/inventory/stock/",
            "/barcode/templates/",
            "/barcode/print-jobs/",
            "/customers/",
            "/service/tickets/",
            "/billing/invoices/",
            "/employees/",
            "/audit/",
            "/barcode/ebarcode/releases/",
        ),
        expect_forbidden=(
            "/patients/",
            "/appointments/",
            "/accounting/transactions/",
            "/sign/tasks/",
        ),
    ),
)


def login(profile: TenantProfile) -> dict:
    response = requests.post(
        f"{API_BASE}/auth/login/",
        json={
            "customer_code": profile.code,
            "email": profile.email,
            "password": profile.password,
        },
        timeout=30,
    )
    if response.status_code != 200:
        raise RuntimeError(
            f"Login failed for tenant {profile.code}: {response.status_code} {response.text}"
        )
    return response.json()


def check_path(token: str, path: str) -> int:
    response = requests.get(
        f"{API_BASE}{path}",
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    return response.status_code


def run_profile(profile: TenantProfile) -> list[str]:
    errors: list[str] = []
    payload = login(profile)
    token = payload["access"]
    enabled = set(payload.get("enabled_modules") or [])
    print(f"\n== Tenant {profile.code} ({profile.email}) ==")
    print("enabled_modules:", sorted(enabled))

    for path in profile.expect_ok:
        status = check_path(token, path)
        ok = status in (200, 201)
        print(f"  OK? {path} -> {status}")
        if not ok:
            errors.append(f"{profile.code} expected 200 for {path}, got {status}")

    for path in profile.expect_forbidden:
        status = check_path(token, path)
        ok = status in (403, 404)
        print(f"  DENY? {path} -> {status}")
        if not ok:
            errors.append(f"{profile.code} expected 403/404 for {path}, got {status}")

    return errors


def main() -> int:
    all_errors: list[str] = []
    for profile in PROFILES:
        try:
            all_errors.extend(run_profile(profile))
        except Exception as exc:
            all_errors.append(f"{profile.code}: {exc}")

    if all_errors:
        print("\nFAILED:")
        for item in all_errors:
            print(" -", item)
        return 1

    print("\nAll tenant module smoke checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
