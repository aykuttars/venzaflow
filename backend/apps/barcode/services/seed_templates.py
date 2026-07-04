from __future__ import annotations

import json
from decimal import Decimal
from pathlib import Path

from django.db import transaction

from apps.barcode.models import LabelTemplate, LabelTemplateSource

DEFAULTS_PATH = Path(__file__).resolve().parent.parent / "default_label_templates.json"


def load_default_catalog() -> list[dict]:
    with DEFAULTS_PATH.open(encoding="utf-8") as f:
        return json.load(f)


@transaction.atomic
def seed_default_templates(tenant_id: int, *, skip_existing: bool = True) -> list[LabelTemplate]:
    """Copy system default label templates into tenant. Skips keys already present."""
    catalog = load_default_catalog()
    created: list[LabelTemplate] = []
    for item in catalog:
        key = item["default_key"]
        if skip_existing and LabelTemplate.objects.filter(
            tenant_id=tenant_id, default_key=key
        ).exists():
            continue
        tpl = LabelTemplate.objects.create(
            tenant_id=tenant_id,
            name=item["name"],
            description=item.get("description", ""),
            width_mm=Decimal(str(item["width_mm"])),
            height_mm=Decimal(str(item["height_mm"])),
            gap_mm=Decimal(str(item.get("gap_mm", 2))),
            layout_json=item.get("layout_json", []),
            source=LabelTemplateSource.DEFAULT,
            default_key=key,
        )
        created.append(tpl)
    return created
