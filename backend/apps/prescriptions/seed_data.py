from __future__ import annotations

from decimal import Decimal

from apps.customers.models import Customer
from apps.prescriptions.models import DrugCatalog, Prescription, PrescriptionLine
from apps.prescriptions.services.prescription import finalize_prescription
from apps.tenants.models import Tenant

DEFAULT_DRUGS: list[dict] = [
    {"barkod": "8699523090011", "name": "Parol 500 mg Tablet", "form": "Tablet", "strength": "500 mg"},
    {"barkod": "8699532091234", "name": "Augmentin Bid 875/125 mg", "form": "Tablet", "strength": "875/125 mg"},
    {"barkod": "8699540012345", "name": "Ibuprofen 400 mg", "form": "Tablet", "strength": "400 mg"},
    {"barkod": "8699550023456", "name": "Amoksisilin 1000 mg", "form": "Tablet", "strength": "1000 mg"},
    {"barkod": "8699560034567", "name": "Klamoks 875 mg", "form": "Tablet", "strength": "875 mg"},
    {"barkod": "8699570045678", "name": "Nurofen 200 mg", "form": "Tablet", "strength": "200 mg"},
    {"barkod": "8699580056789", "name": "Calpol 120 mg/5 ml", "form": "Şurup", "strength": "120 mg/5 ml"},
    {"barkod": "8699590067890", "name": "Bactrim Fort Tablet", "form": "Tablet", "strength": "800/160 mg"},
    {"barkod": "8699600078901", "name": "Majezik 25 mg", "form": "Tablet", "strength": "25 mg"},
    {"barkod": "8699610089012", "name": "Klorhex Gargara", "form": "Gargara", "strength": "0.2%"},
]

DEMO_PRESCRIPTION_NO = "DEMO-RX-ELIF-1"


def ensure_drug_catalog(tenant: Tenant) -> dict[str, DrugCatalog]:
    index: dict[str, DrugCatalog] = {}
    for row in DEFAULT_DRUGS:
        obj, _ = DrugCatalog.all_tenants.update_or_create(
            tenant=tenant,
            barkod=row["barkod"],
            defaults={
                "name": row["name"],
                "form": row["form"],
                "strength": row["strength"],
                "unit": "adet",
                "is_active": True,
            },
        )
        index[row["barkod"]] = obj
    return index


def ensure_prescription_demo(tenant: Tenant, *, doctor) -> dict[str, int]:
    drugs = ensure_drug_catalog(tenant)
    stats = {"drugs": len(drugs), "prescriptions": 0, "sign_tasks": 0}

    patient = Customer.all_tenants.filter(tenant=tenant, tckn="22222222220").first()
    if not patient:
        return stats

    if Prescription.all_tenants.filter(tenant=tenant, prescription_no=DEMO_PRESCRIPTION_NO).exists():
        from apps.signing.models import SignTask

        stats["prescriptions"] = 1
        stats["sign_tasks"] = SignTask.objects.filter(
            tenant=tenant, document_type=SignTask.DocumentType.ERECETE
        ).count()
        return stats

    amox = drugs["8699550023456"]
    ibu = drugs["8699540012345"]
    rx = Prescription.all_tenants.create(
        tenant=tenant,
        prescription_no="",
        patient=patient,
        doctor=doctor,
        diagnosis_code="K02.1",
        diagnosis_text="Diş çürüğü",
        prescription_type=Prescription.PrescriptionType.NORMAL,
        provision_type=Prescription.ProvisionType.SGK,
        status=Prescription.Status.DRAFT,
        notes="Demo SGK e-Reçete — tenant 1000",
    )
    PrescriptionLine.all_tenants.create(
        tenant=tenant,
        prescription=rx,
        drug=amox,
        drug_barkod=amox.barkod,
        drug_name=amox.name,
        box_count=1,
        quantity_per_box=14,
        dose="1x1",
        frequency="Günde 2",
        period_days=7,
        route=PrescriptionLine.Route.ORAL,
        usage_instruction="Tok karnına, bol su ile",
        sort_order=0,
    )
    PrescriptionLine.all_tenants.create(
        tenant=tenant,
        prescription=rx,
        drug=ibu,
        drug_barkod=ibu.barkod,
        drug_name=ibu.name,
        box_count=1,
        quantity_per_box=20,
        dose="1x1",
        frequency="Günde 3",
        period_days=5,
        route=PrescriptionLine.Route.ORAL,
        usage_instruction="Ağrı halinde, yemekten sonra",
        sort_order=1,
    )
    finalize_prescription(rx, actor=doctor)
    rx.prescription_no = DEMO_PRESCRIPTION_NO
    rx.save(update_fields=["prescription_no"])

    from apps.signing.models import SignTask

    stats["prescriptions"] = 1
    stats["sign_tasks"] = SignTask.objects.filter(
        tenant=tenant,
        document_type=SignTask.DocumentType.ERECETE,
        content_type__model="prescription",
    ).count()
    return stats
