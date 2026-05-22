from __future__ import annotations

from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _

PERMANENT_TEETH = frozenset(
    list(range(11, 19))
    + list(range(21, 29))
    + list(range(31, 39))
    + list(range(41, 49))
)
PRIMARY_TEETH = frozenset(
    list(range(51, 56))
    + list(range(61, 66))
    + list(range(71, 76))
    + list(range(81, 86))
)
ALL_FDI_TEETH = PERMANENT_TEETH | PRIMARY_TEETH


def validate_fdi_tooth_numbers(value: list[int] | None) -> list[int]:
    if not value:
        raise ValidationError(_("At least one tooth number is required."))
    invalid = [n for n in value if n not in ALL_FDI_TEETH]
    if invalid:
        raise ValidationError(
            _("Invalid FDI tooth number(s): %(nums)s") % {"nums": ", ".join(map(str, invalid))}
        )
    return sorted(set(value))
