from __future__ import annotations

from datetime import date
from decimal import Decimal

from apps.customers.address_fixtures import SAMPLE_HOME_ADDRESS
from apps.customers.models import Customer
from apps.oral.models import OralTreatment, ProcedureCatalog
from apps.tenants.models import Tenant

DEFAULT_PROCEDURES: list[dict] = [
    {"code": "EXAM", "name": "Muayene", "category": "diagnosis", "price": "350", "frequent": True},
    {"code": "XRAY-PAN", "name": "Panoramik Röntgen", "category": "diagnosis", "price": "450", "frequent": True},
    {"code": "CARIES", "name": "Çürük Tespiti", "category": "diagnosis", "price": "200", "condition": "caries"},
    {"code": "PLAN-IMP", "name": "İmplant Planlaması", "category": "planning", "price": "500", "frequent": True},
    {"code": "PLAN-ORT", "name": "Ortodonti Planı", "category": "planning", "price": "750"},
    {"code": "FILL", "name": "Dolgu", "category": "treatment", "price": "850", "frequent": True, "condition": "filled"},
    {"code": "RCT", "name": "Kanal Tedavisi", "category": "treatment", "price": "2200", "frequent": True, "condition": "root_canal"},
    {"code": "EXT", "name": "Diş Çekimi", "category": "treatment", "price": "650", "frequent": True, "condition": "missing"},
    {"code": "IMP", "name": "İmplant", "category": "treatment", "price": "15000", "frequent": True, "condition": "implant"},
    {"code": "CROWN", "name": "Kron", "category": "treatment", "price": "4500", "condition": "crown"},
    {"code": "BRIDGE", "name": "Köprü", "category": "treatment", "price": "5200", "condition": "bridge"},
    {"code": "SCALE", "name": "Detartraj", "category": "treatment", "price": "900", "frequent": True},
    {"code": "WHITEN", "name": "Diş Beyazlatma", "category": "treatment", "price": "3500"},
    {"code": "SEAL", "name": "Fissür Örtücü", "category": "treatment", "price": "550", "condition": "filled"},
    {"code": "WISDOM", "name": "20 Yaş Diş Çekimi", "category": "treatment", "price": "1800", "frequent": True, "condition": "missing"},
]


def ensure_oral_procedures(tenant: Tenant) -> dict[str, ProcedureCatalog]:
    index: dict[str, ProcedureCatalog] = {}
    for i, row in enumerate(DEFAULT_PROCEDURES):
        obj, _ = ProcedureCatalog.all_tenants.update_or_create(
            tenant=tenant,
            code=row["code"],
            defaults={
                "name": row["name"],
                "category": row["category"],
                "default_price": Decimal(row["price"]),
                "is_frequent": row.get("frequent", False),
                "default_tooth_condition": row.get("condition", ""),
                "sort_order": i,
                "is_active": True,
            },
        )
        index[row["code"]] = obj
    return index


def ensure_clinic_demo_patients(tenant: Tenant, procedures: dict[str, ProcedureCatalog]) -> None:
    patients_data = [
        {
            "first_name": "Ragıp",
            "last_name": "Serbez",
            "tckn": "11111111110",
            "email": "ragip.serbez@demo.local",
            "mobile_phone": "5321000001",
            "treatments": [
                ("WISDOM", [46], "completed"),
                ("FILL", [36], "completed"),
                ("IMP", [10], "planned"),
            ],
        },
        {
            "first_name": "Elif",
            "last_name": "Kaya",
            "tckn": "22222222220",
            "email": "elif.kaya@demo.local",
            "mobile_phone": "5321000002",
            "treatments": [
                ("RCT", [46], "in_progress"),
                ("FILL", [46], "planned"),
                ("SCALE", [11, 21], "planned"),
            ],
        },
        {
            "first_name": "Mehmet",
            "last_name": "Yıldız",
            "tckn": "33333333330",
            "email": "mehmet.yildiz@demo.local",
            "mobile_phone": "5321000003",
            "treatments": [
                ("CROWN", [11], "completed"),
                ("PLAN-IMP", [26], "planned"),
            ],
        },
    ]
    today = date.today()
    for pdata in patients_data:
        patient, _ = Customer.all_tenants.update_or_create(
            tenant=tenant,
            kind=Customer.Kind.PATIENT,
            tckn=pdata["tckn"],
            defaults={
                "first_name": pdata["first_name"],
                "last_name": pdata["last_name"],
                "email": pdata["email"],
                "mobile_phone": pdata["mobile_phone"],
                "phone": pdata["mobile_phone"],
                "nationality": Customer.Nationality.TC,
                "birth_date": date(1985, 3, 15),
                "home_address": SAMPLE_HOME_ADDRESS,
                "nvi_verified": True,
            },
        )
        for code, teeth, status in pdata["treatments"]:
            proc = procedures[code]
            for tooth in teeth:
                OralTreatment.all_tenants.update_or_create(
                    tenant=tenant,
                    patient=patient,
                    procedure=proc,
                    tooth_numbers=[tooth],
                    session_date=today,
                    defaults={
                        "status": status,
                        "phase": proc.category,
                        "unit_price": proc.default_price,
                        "performed_at": today if status == "completed" else None,
                    },
                )
                if status == "completed" and proc.default_tooth_condition:
                    from apps.oral.chart_sync import sync_chart_from_treatment

                    t = OralTreatment.all_tenants.filter(
                        tenant=tenant,
                        patient=patient,
                        procedure=proc,
                        tooth_numbers=[tooth],
                    ).first()
                    if t:
                        sync_chart_from_treatment(t)
