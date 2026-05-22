from __future__ import annotations

from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _


def validate_tckn(value: str) -> str:
    text = (value or "").strip()
    if len(text) != 11 or not text.isdigit():
        raise ValidationError(_("TCKN must be 11 digits."))
    if text[0] == "0":
        raise ValidationError(_("Invalid TCKN."))
    digits = [int(c) for c in text]
    tenth = ((sum(digits[0:9:2]) * 7) - sum(digits[1:8:2])) % 10
    if tenth != digits[9]:
        raise ValidationError(_("Invalid TCKN."))
    eleventh = sum(digits[:10]) % 10
    if eleventh != digits[10]:
        raise ValidationError(_("Invalid TCKN."))
    return text


def is_valid_tckn(value: str) -> bool:
    try:
        validate_tckn(value)
        return True
    except ValidationError:
        return False
