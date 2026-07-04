from __future__ import annotations

import re

_TR_CHAR_MAP = str.maketrans(
    {
        "İ": "I",
        "ı": "i",
        "Ş": "S",
        "ş": "s",
        "Ğ": "G",
        "ğ": "g",
        "Ü": "U",
        "ü": "u",
        "Ö": "O",
        "ö": "o",
        "Ç": "C",
        "ç": "c",
    }
)


def normalize_scan_code(raw: str, *, normalize_tr: bool = True) -> str:
    s = (raw or "").strip()
    if not s:
        return s
    if normalize_tr:
        s = s.translate(_TR_CHAR_MAP)
        if len(s) > 8 and s[0] in "@?":
            s = ("8" if s[0] == "@" else "9") + s[1:]
    return re.sub(r"\s+", "", s)


def lookup_code_variants(code: str) -> list[str]:
    """Distinct candidate codes to try against product.barcode (exact match)."""
    seen: set[str] = set()
    out: list[str] = []
    for candidate in (code, re.sub(r"\D", "", code)):
        if candidate and candidate not in seen:
            seen.add(candidate)
            out.append(candidate)
    return out
