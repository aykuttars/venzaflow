from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation
from typing import Any

from django.core.exceptions import ValidationError

from apps.products.models import FieldType, Product, ProductFieldDefinition, ProductFieldValue


class FieldValidationError(ValidationError):
    pass


def _coerce_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in ("1", "true", "yes", "on")
    return bool(value)


def validate_field_value(
    definition: ProductFieldDefinition,
    raw_value: Any,
    *,
    product: Product | None = None,
    tenant_id: int | None = None,
) -> dict[str, Any]:
    """Validate and normalize a dynamic field value. Returns storage dict for ProductFieldValue."""
    if raw_value is None or raw_value == "":
        if definition.is_required:
            raise FieldValidationError(f"{definition.label} is required")
        return _empty_storage()

    try:
        ft = FieldType(definition.field_type)
    except ValueError as exc:
        raise FieldValidationError("Invalid field type") from exc
    rules = definition.validation_rules or {}

    storage = _empty_storage()

    if ft in (FieldType.TEXT, FieldType.TEXTAREA, FieldType.URL, FieldType.EMAIL, FieldType.PHONE):
        storage["value_text"] = str(raw_value).strip()
        if ft == FieldType.EMAIL and "@" not in storage["value_text"]:
            raise FieldValidationError("Invalid email")
        max_len = rules.get("max_length")
        if max_len and len(storage["value_text"]) > int(max_len):
            raise FieldValidationError(f"Max length {max_len}")

    elif ft == FieldType.NUMBER:
        try:
            storage["value_number"] = int(raw_value)
        except (TypeError, ValueError) as exc:
            raise FieldValidationError("Invalid number") from exc
        _check_min_max(storage["value_number"], rules)

    elif ft in (FieldType.DECIMAL, FieldType.MONEY, FieldType.PERCENT):
        try:
            storage["value_decimal"] = Decimal(str(raw_value))
        except (InvalidOperation, TypeError) as exc:
            raise FieldValidationError("Invalid decimal") from exc
        _check_min_max(float(storage["value_decimal"]), rules)

    elif ft == FieldType.BOOLEAN:
        storage["value_boolean"] = _coerce_bool(raw_value)

    elif ft == FieldType.DATE:
        storage["value_date"] = raw_value

    elif ft == FieldType.DATETIME:
        storage["value_datetime"] = raw_value

    elif ft in (FieldType.SELECT, FieldType.MULTI_SELECT, FieldType.JSON):
        if ft == FieldType.MULTI_SELECT and not isinstance(raw_value, list):
            storage["value_json"] = [raw_value]
        else:
            storage["value_json"] = raw_value
        if ft == FieldType.SELECT:
            allowed = {opt.get("value") if isinstance(opt, dict) else opt for opt in (definition.options or [])}
            if allowed and storage["value_json"] not in allowed:
                raise FieldValidationError("Invalid option")

    else:
        storage["value_text"] = str(raw_value)

    if definition.is_unique and tenant_id and product:
        qs = ProductFieldValue.objects.filter(
            tenant_id=tenant_id,
            field_definition=definition,
        ).exclude(product=product)
        if _storage_matches(qs, storage):
            raise FieldValidationError(f"{definition.label} must be unique")

    pattern = rules.get("pattern")
    if pattern and storage.get("value_text"):
        if not re.match(pattern, storage["value_text"]):
            raise FieldValidationError("Invalid format")

    return storage


def _check_min_max(val: float | int, rules: dict) -> None:
    if "min" in rules and val < rules["min"]:
        raise FieldValidationError(f"Minimum value is {rules['min']}")
    if "max" in rules and val > rules["max"]:
        raise FieldValidationError(f"Maximum value is {rules['max']}")


def _empty_storage() -> dict[str, Any]:
    return {
        "value_text": "",
        "value_number": None,
        "value_decimal": None,
        "value_boolean": None,
        "value_date": None,
        "value_datetime": None,
        "value_json": None,
    }


def _storage_matches(qs, storage: dict) -> bool:
    for key, val in storage.items():
        if val is None or val == "":
            continue
        if qs.filter(**{key: val}).exists():
            return True
    return False


def serialize_field_value(value: ProductFieldValue) -> Any:
    fd = value.field_definition
    ft = FieldType(fd.field_type)
    if ft in (FieldType.TEXT, FieldType.TEXTAREA, FieldType.URL, FieldType.EMAIL, FieldType.PHONE):
        return value.value_text
    if ft == FieldType.NUMBER:
        return value.value_number
    if ft in (FieldType.DECIMAL, FieldType.MONEY, FieldType.PERCENT):
        return str(value.value_decimal) if value.value_decimal is not None else None
    if ft == FieldType.BOOLEAN:
        return value.value_boolean
    if ft == FieldType.DATE:
        return value.value_date.isoformat() if value.value_date else None
    if ft == FieldType.DATETIME:
        return value.value_datetime.isoformat() if value.value_datetime else None
    if ft in (FieldType.SELECT, FieldType.MULTI_SELECT, FieldType.JSON):
        return value.value_json
    return value.value_text or None
