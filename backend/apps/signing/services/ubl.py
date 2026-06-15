"""UBL-TR 1.2 invoice builder for e-Fatura / e-Arşiv.

Produces a GİB UBL-TR compatible Invoice document with an empty
``ext:UBLExtensions/ext:UBLExtension/ext:ExtensionContent`` placeholder where
the XAdES signature is later inserted (see services/xades.py).

The shape follows the UBL-TR 1.2 guide. Schematron-level validation must be
confirmed against a GİB/integrator sandbox before go-live; the structure here
is correct enough to be signed and round-tripped in tests.
"""

from __future__ import annotations

import uuid
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from django.conf import settings
from django.utils import timezone
from lxml import etree

NSMAP = {
    None: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
    "cac": "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
    "cbc": "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
    "ext": "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2",
    "ds": "http://www.w3.org/2000/09/xmldsig#",
    "xades": "http://uri.etsi.org/01903/v1.3.2#",
}

CAC = NSMAP["cac"]
CBC = NSMAP["cbc"]
EXT = NSMAP["ext"]
INV = NSMAP[None]

#: GİB profile per document family.
PROFILE_IDS = {
    "efatura": "TICARIFATURA",
    "earsiv": "EARSIVFATURA",
}

CURRENCY = "TRY"


def _q(value: Decimal | int | str) -> str:
    return str(Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _el(parent, tag: str, ns: str, text: str | None = None, **attrs) -> etree._Element:
    node = etree.SubElement(parent, f"{{{ns}}}{tag}", **attrs)
    if text is not None:
        node.text = text
    return node


def _amount(parent, tag: str, ns: str, value: Decimal | int | str) -> etree._Element:
    return _el(parent, tag, ns, _q(value), currencyID=CURRENCY)


def _party(parent, tag: str, *, vkn: str, title: str, tax_office: str,
           city: str, district: str, street: str, country: str,
           person_name: tuple[str, str] | None = None) -> None:
    wrap = _el(parent, tag, CAC)
    party = _el(wrap, "Party", CAC)

    ident = _el(party, "PartyIdentification", CAC)
    scheme = "TCKN" if person_name and len(vkn) == 11 else "VKN"
    _el(ident, "ID", CBC, vkn, schemeID=scheme)

    name = _el(party, "PartyName", CAC)
    _el(name, "Name", CBC, title)

    addr = _el(party, "PostalAddress", CAC)
    _el(addr, "StreetName", CBC, street or "-")
    _el(addr, "CitySubdivisionName", CBC, district or "-")
    _el(addr, "CityName", CBC, city or "-")
    country_el = _el(addr, "Country", CAC)
    _el(country_el, "Name", CBC, country or "Türkiye")

    tax = _el(party, "PartyTaxScheme", CAC)
    scheme_el = _el(tax, "TaxScheme", CAC)
    _el(scheme_el, "Name", CBC, tax_office or "-")

    if person_name:
        person = _el(party, "Person", CAC)
        _el(person, "FirstName", CBC, person_name[0] or "-")
        _el(person, "FamilyName", CBC, person_name[1] or "-")


def build_invoice_ubl(
    invoice, document_type: str, supplier: dict[str, Any] | None = None
) -> tuple[bytes, dict[str, Any]]:
    """Return (xml_bytes, meta) for an Invoice model instance.

    ``supplier`` is the tenant's legal sender identity (from its signing
    profile). ``meta`` carries the generated ETTN/UUID and computed totals so
    they can be persisted on the SignTask for later submission and display.
    """
    ettn = str(uuid.uuid4())
    profile = PROFILE_IDS.get(document_type, PROFILE_IDS["efatura"])
    now = timezone.localtime()

    vat_rate = Decimal(str(getattr(settings, "AUTHORITY_DEFAULT_VAT_RATE", "20")))

    root = etree.Element(f"{{{INV}}}Invoice", nsmap=NSMAP)

    # Empty signature placeholder — XAdES is inserted here at assemble time.
    extensions = _el(root, "UBLExtensions", EXT)
    extension = _el(extensions, "UBLExtension", EXT)
    _el(extension, "ExtensionContent", EXT)

    _el(root, "UBLVersionID", CBC, "2.1")
    _el(root, "CustomizationID", CBC, "TR1.2")
    _el(root, "ProfileID", CBC, profile)
    _el(root, "ID", CBC, invoice.number)
    _el(root, "CopyIndicator", CBC, "false")
    _el(root, "UUID", CBC, ettn)
    _el(root, "IssueDate", CBC, invoice.issued_at.isoformat())
    _el(root, "IssueTime", CBC, now.strftime("%H:%M:%S"))
    _el(root, "InvoiceTypeCode", CBC, "SATIS")
    _el(root, "DocumentCurrencyCode", CBC, CURRENCY)

    lines = list(invoice.lines.select_related("product").all())
    _el(root, "LineCountNumeric", CBC, str(len(lines)))

    supplier = supplier or {}
    _party(
        root,
        "AccountingSupplierParty",
        vkn=supplier.get("vkn", "") or "1111111111",
        title=supplier.get("title", "") or "Tedarikçi",
        tax_office=supplier.get("tax_office", ""),
        city=supplier.get("city", ""),
        district=supplier.get("district", ""),
        street=supplier.get("street", ""),
        country=supplier.get("country", "Türkiye"),
    )

    customer = invoice.customer
    cust_title = f"{customer.first_name} {customer.last_name}".strip() or "Müşteri"
    _party(
        root,
        "AccountingCustomerParty",
        vkn=(getattr(customer, "tckn", "") or "11111111111"),
        title=cust_title,
        tax_office="-",
        city="-",
        district="-",
        street="-",
        country="Türkiye",
        person_name=(customer.first_name, customer.last_name),
    )

    line_extension_total = Decimal("0.00")
    tax_total_amount = Decimal("0.00")
    for idx, line in enumerate(lines, start=1):
        line_total = Decimal(str(line.line_total))
        line_extension_total += line_total
        line_tax = (line_total * vat_rate / Decimal("100")).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        tax_total_amount += line_tax
        _invoice_line(root, idx, line, line_total, line_tax, vat_rate)

    discount_amount = Decimal(str(getattr(invoice, "discount_amount", 0) or 0))
    if discount_amount > 0:
        allowance = _el(root, "AllowanceCharge", CAC)
        _el(allowance, "ChargeIndicator", CBC, "false")
        _amount(allowance, "Amount", CBC, discount_amount)
        line_extension_total -= discount_amount
        if line_extension_total < 0:
            line_extension_total = Decimal("0.00")
        tax_total_amount = (line_extension_total * vat_rate / Decimal("100")).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

    # Document-level tax total.
    tax_total = _el(root, "TaxTotal", CAC)
    _amount(tax_total, "TaxAmount", CBC, tax_total_amount)
    subtotal = _el(tax_total, "TaxSubtotal", CAC)
    _amount(subtotal, "TaxableAmount", CBC, line_extension_total)
    _amount(subtotal, "TaxAmount", CBC, tax_total_amount)
    _el(subtotal, "Percent", CBC, _q(vat_rate))
    category = _el(subtotal, "TaxCategory", CAC)
    scheme = _el(category, "TaxScheme", CAC)
    _el(scheme, "Name", CBC, "KDV")
    _el(scheme, "TaxTypeCode", CBC, "0015")

    payable = (line_extension_total + tax_total_amount).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    monetary = _el(root, "LegalMonetaryTotal", CAC)
    _amount(monetary, "LineExtensionAmount", CBC, line_extension_total)
    _amount(monetary, "TaxExclusiveAmount", CBC, line_extension_total)
    _amount(monetary, "TaxInclusiveAmount", CBC, payable)
    _amount(monetary, "PayableAmount", CBC, payable)

    xml_bytes = etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=False)
    meta = {
        "ettn": ettn,
        "profile_id": profile,
        "line_extension_total": _q(line_extension_total),
        "tax_total": _q(tax_total_amount),
        "payable_total": _q(payable),
        "vat_rate": _q(vat_rate),
    }
    return xml_bytes, meta


def _invoice_line(root, idx: int, line, line_total: Decimal, line_tax: Decimal,
                  vat_rate: Decimal) -> None:
    node = _el(root, "InvoiceLine", CAC)
    _el(node, "ID", CBC, str(idx))
    _el(node, "InvoicedQuantity", CBC, str(line.quantity), unitCode="C62")
    _amount(node, "LineExtensionAmount", CBC, line_total)

    line_tax_total = _el(node, "TaxTotal", CAC)
    _amount(line_tax_total, "TaxAmount", CBC, line_tax)
    subtotal = _el(line_tax_total, "TaxSubtotal", CAC)
    _amount(subtotal, "TaxableAmount", CBC, line_total)
    _amount(subtotal, "TaxAmount", CBC, line_tax)
    _el(subtotal, "Percent", CBC, _q(vat_rate))
    category = _el(subtotal, "TaxCategory", CAC)
    scheme = _el(category, "TaxScheme", CAC)
    _el(scheme, "Name", CBC, "KDV")
    _el(scheme, "TaxTypeCode", CBC, "0015")

    item = _el(node, "Item", CAC)
    item_name = line.description or getattr(line.product, "name", None) or f"Ürün {idx}"
    _el(item, "Name", CBC, item_name)

    price = _el(node, "Price", CAC)
    _amount(price, "PriceAmount", CBC, line.unit_price)
