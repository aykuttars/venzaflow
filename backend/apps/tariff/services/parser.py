from __future__ import annotations

import re
import subprocess
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from pathlib import Path


SECTION_RE = re.compile(
    r"^\s*(\d+)\s{2,}([A-ZÇĞİÖŞÜa-zçğıöşü0-9\-/\(\)\.\,\+\*\s]+?)\s{2,}KDV\s+Hari",
    re.MULTILINE,
)
ITEM_RE = re.compile(
    r"^\s*(\d+-\d+)\s+(.+?)\s+([\d.,]+)\s+([\d.,]+)\s*$",
    re.MULTILINE,
)


@dataclass(frozen=True)
class ParsedTariffItem:
    section_no: int
    section_name: str
    code: str
    name: str
    price_excl_vat: Decimal
    price_incl_vat: Decimal


def _parse_decimal(value: str) -> Decimal:
    cleaned = value.strip().replace(".", "").replace(",", ".")
    try:
        return Decimal(cleaned)
    except InvalidOperation as exc:
        raise ValueError(f"Invalid decimal: {value!r}") from exc


def extract_text_from_pdf(pdf_path: Path) -> str:
    try:
        result = subprocess.run(
            ["pdftotext", "-layout", str(pdf_path), "-"],
            check=True,
            capture_output=True,
            text=True,
        )
        return result.stdout
    except FileNotFoundError:
        pass
    except subprocess.CalledProcessError:
        pass

    try:
        from pypdf import PdfReader
    except ImportError as exc:
        raise RuntimeError(
            "Install poppler-utils (pdftotext) or pypdf to import PDF tariffs."
        ) from exc

    reader = PdfReader(str(pdf_path))
    parts: list[str] = []
    for page in reader.pages:
        parts.append(page.extract_text() or "")
    text = "\n".join(parts)
    if not text.strip():
        raise RuntimeError("Could not extract text from PDF.")
    return text


def parse_tariff_text(text: str) -> list[ParsedTariffItem]:
    """Parse pdftotext -layout output from TDB rehber tarife kitapçığı."""
    section_starts: list[tuple[int, str, int]] = []
    for match in SECTION_RE.finditer(text):
        section_starts.append((match.start(), match.group(1), match.group(2).strip()))

    if not section_starts:
        raise ValueError("No tariff sections found in document.")

    items: list[ParsedTariffItem] = []
    for idx, (start, section_no_str, section_name) in enumerate(section_starts):
        end = section_starts[idx + 1][0] if idx + 1 < len(section_starts) else len(text)
        block = text[start:end]
        section_no = int(section_no_str)
        for item_match in ITEM_RE.finditer(block):
            code, name, excl, incl = item_match.groups()
            name = re.sub(r"\s+", " ", name.strip())
            items.append(
                ParsedTariffItem(
                    section_no=section_no,
                    section_name=section_name,
                    code=code.strip(),
                    name=name,
                    price_excl_vat=_parse_decimal(excl),
                    price_incl_vat=_parse_decimal(incl),
                )
            )
    if not items:
        raise ValueError("No tariff line items found in document.")
    return items


def parse_tariff_pdf(pdf_path: Path) -> list[ParsedTariffItem]:
    return parse_tariff_text(extract_text_from_pdf(pdf_path))
