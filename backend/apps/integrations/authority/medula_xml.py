"""Build unsigned Medula e-Reçete XML from a Prescription."""

from __future__ import annotations

from datetime import date
from typing import Any

from django.utils import timezone
from lxml import etree

from apps.integrations.authority.medula_constants import (
    DENTAL_BRANCH_CODE,
    DEFAULT_CERTIFICATE_CODE,
    NS,
    PRESCRIPTION_TYPE_MAP,
    PROVISION_TYPE_MAP,
    ROUTE_USAGE_MAP,
)
from apps.prescriptions.models import Prescription, PrescriptionLine

PERIOD_UNIT_DAILY = 3  # Tablo 9.g — Günde


def _parse_dose(dose: str) -> tuple[int, float]:
    """Best-effort parse of values like ``1x1`` or ``2x0.5``."""
    text = (dose or "").strip().replace(",", ".")
    if "x" in text.lower():
        left, _, right = text.lower().partition("x")
        try:
            return int(left.strip() or "1"), float(right.strip() or "1")
        except ValueError:
            pass
    return 1, 1.0


def _doctor_tc(doctor) -> str:
    tc = getattr(doctor, "tckn", "") or ""
    tc = str(tc).strip()
    if tc:
        return tc
    from apps.integrations.authority.medula_constants import MEDULA_TEST_DOKTOR_TC

    return MEDULA_TEST_DOKTOR_TC


def _doctor_name_parts(doctor) -> tuple[str, str]:
    if doctor is None:
        return "Demo", "Hekim"
    first = (getattr(doctor, "first_name", "") or "").strip() or "Demo"
    last = (getattr(doctor, "last_name", "") or "").strip() or "Hekim"
    return first[:30], last[:30]


def build_erecete_xml(
    prescription: Prescription,
    *,
    tesis_kodu: int,
    recete_date: date | None = None,
) -> bytes:
    """Serialize prescription data to Medula ``ereceteDVO`` XML (unsigned)."""
    patient = prescription.patient
    doctor = prescription.doctor
    if not patient.tckn:
        raise ValueError("Hasta TCKN zorunludur.")

    recete_date = recete_date or timezone.localdate()
    protokol = prescription.prescription_no or f"RX-{prescription.pk}"
    doktor_tc = _doctor_tc(doctor)
    doktor_adi, doktor_soyadi = _doctor_name_parts(doctor)

    root = etree.Element(f"{{{NS}}}ereceteDVO", nsmap={None: NS})

    def _add(tag: str, text: str | int | float) -> None:
        node = etree.SubElement(root, f"{{{NS}}}{tag}")
        node.text = str(text)

    _add("protokolNo", protokol[:50])
    _add("provizyonTipi", PROVISION_TYPE_MAP.get(prescription.provision_type, 1))
    _add("receteAltTuru", 1)  # Ayaktan
    _add("receteTarihi", recete_date.strftime("%d.%m.%Y"))
    _add("receteTuru", PRESCRIPTION_TYPE_MAP.get(prescription.prescription_type, 1))
    _add("takipNo", "")
    _add("tcKimlikNo", int(patient.tckn))
    _add("tesisKodu", int(tesis_kodu))
    _add("doktorBransKodu", DENTAL_BRANCH_CODE)
    _add("doktorSertifikaKodu", DEFAULT_CERTIFICATE_CODE)

    lines = list(prescription.lines.all().order_by("sort_order", "id"))
    if not lines:
        raise ValueError("Reçetede en az bir ilaç satırı olmalıdır.")

    for line in lines:
        _append_drug_line(root, line)

    if prescription.diagnosis_code:
        tani = etree.SubElement(root, f"{{{NS}}}ereceteTaniListesi")
        etree.SubElement(tani, f"{{{NS}}}taniKodu").text = prescription.diagnosis_code
        if prescription.diagnosis_text:
            etree.SubElement(tani, f"{{{NS}}}taniAdi").text = prescription.diagnosis_text[:255]

    _add("doktorAdi", doktor_adi)
    _add("doktorSoyadi", doktor_soyadi)
    _add("doktorTcKimlikNo", int(doktor_tc))

    return etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=False)


def _append_drug_line(root: etree._Element, line: PrescriptionLine) -> None:
    barkod = line.drug_barkod or (line.drug.barkod if line.drug_id else "")
    if not barkod:
        raise ValueError(f"İlaç barkodu eksik: {line.drug_name}")

    doz1, doz2 = _parse_dose(line.dose)
    periyot = max(line.period_days, 1)

    drug = etree.SubElement(root, f"{{{NS}}}ereceteIlacListesi")
    etree.SubElement(drug, f"{{{NS}}}adet").text = str(line.box_count or 1)
    etree.SubElement(drug, f"{{{NS}}}barkod").text = str(int(barkod))
    if line.drug_name:
        etree.SubElement(drug, f"{{{NS}}}ilacAdi").text = line.drug_name[:255]
    etree.SubElement(drug, f"{{{NS}}}kullanimDoz1").text = str(doz1)
    etree.SubElement(drug, f"{{{NS}}}kullanimPeriyotBirimi").text = str(PERIOD_UNIT_DAILY)
    etree.SubElement(drug, f"{{{NS}}}kullanimSekli").text = str(
        ROUTE_USAGE_MAP.get(line.route, 1)
    )
    etree.SubElement(drug, f"{{{NS}}}kullanimDoz2").text = str(doz2)
    etree.SubElement(drug, f"{{{NS}}}kullanimPeriyot").text = str(periyot)
    etree.SubElement(drug, f"{{{NS}}}geriOdemeKapsaminda").text = "E"


def medula_context_from_task(task) -> dict[str, Any]:
    """Resolve tesis/doctor TC for a SignTask linked to a prescription."""
    from apps.integrations.authority.medula_constants import (
        MEDULA_TEST_DOKTOR_TC,
        MEDULA_TEST_TESIS_KODU,
    )
    from apps.signing.services.integration_config import resolve_connection

    tesis_kodu = MEDULA_TEST_TESIS_KODU
    connection = resolve_connection(task.tenant, task.document_type)
    if connection and connection.provider_key == "medula":
        from apps.signing.services.integration_config import connection_credentials

        creds = connection_credentials(connection)
        raw = creds.get("tesis_kodu", "")
        if raw:
            tesis_kodu = int(raw)

    prescription = task.source
    doktor_tc = MEDULA_TEST_DOKTOR_TC
    if prescription and getattr(prescription, "doctor", None):
        doktor_tc = _doctor_tc(prescription.doctor)

    return {"tesis_kodu": tesis_kodu, "doktor_tc": doktor_tc}
