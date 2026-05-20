from __future__ import annotations

import xml.etree.ElementTree as ET
from decimal import Decimal

import requests

TCMB_TODAY_URL = "https://www.tcmb.gov.tr/kurlar/today.xml"

# TCMB code in XML -> our Currency.code
TCMB_MAP = {
    "USD": "USD",
    "EUR": "EUR",
    "GBP": "GBP",
}


def parse_tcmb_today_xml(content: bytes) -> dict[str, Decimal]:
    """Return {currency_code: rate_to_try} for supported forex codes."""
    root = ET.fromstring(content)
    rates: dict[str, Decimal] = {"TRY": Decimal("1")}
    for currency_node in root.findall("Currency"):
        code = currency_node.get("CurrencyCode") or currency_node.findtext("Isim")
        if not code:
            continue
        code = code.strip().upper()
        our_code = TCMB_MAP.get(code)
        if not our_code:
            continue
        # ForexSelling: how many TRY per 1 unit of foreign currency
        selling = currency_node.findtext("ForexSelling") or currency_node.findtext("BanknoteSelling")
        if not selling or selling.strip() in ("", "0"):
            continue
        selling = selling.strip().replace(",", ".")
        rates[our_code] = Decimal(selling)
    return rates


def fetch_tcmb_rates() -> dict[str, Decimal]:
    response = requests.get(TCMB_TODAY_URL, timeout=30)
    response.raise_for_status()
    return parse_tcmb_today_xml(response.content)
