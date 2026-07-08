from __future__ import annotations

from datetime import date

from apps.customers.address_fixtures import SAMPLE_HOME_ADDRESS
from apps.customers.models import Customer
from apps.tenants.models import Tenant

DEFAULT_PROCEDURES: list[dict] = [
    # Diagnosis
    {"code": "EXAM", "name": "Muayene", "category": "diagnosis", "price": "350", "frequent": True},
    {"code": "XRAY-PAN", "name": "Panoramik Röntgen", "category": "diagnosis", "price": "450", "frequent": True},
    {"code": "XRAY-PER", "name": "Periapikal Röntgen", "category": "diagnosis", "price": "150", "frequent": True},
    {"code": "XRAY-BW", "name": "Bite-Wing Röntgen", "category": "diagnosis", "price": "120"},
    {"code": "CARIES", "name": "Çürük Tespiti", "category": "diagnosis", "price": "200", "condition": "caries"},
    {"code": "PERIO-CHART", "name": "Periodontal Chart", "category": "diagnosis", "price": "250"},
    {"code": "SENS-TEST", "name": "Sensitivite Testi", "category": "diagnosis", "price": "180"},
    {"code": "OCCL-ANAL", "name": "Oklüzyon Analizi", "category": "diagnosis", "price": "300"},
    # Planning
    {"code": "PLAN-IMP", "name": "İmplant Planlaması", "category": "planning", "price": "500", "frequent": True},
    {"code": "PLAN-ORT", "name": "Ortodonti Planı", "category": "planning", "price": "750"},
    {"code": "PLAN-PROS", "name": "Protez Planlaması", "category": "planning", "price": "400"},
    {"code": "PLAN-QUOTE", "name": "Tedavi Fiyat Teklifi", "category": "planning", "price": "0", "frequent": True},
    {"code": "PLAN-SURG", "name": "Cerrahi Planlama", "category": "planning", "price": "600"},
    # Treatment — restorations
    {"code": "FILL", "name": "Dolgu (Kompozit)", "category": "treatment", "price": "850", "frequent": True, "condition": "filled"},
    {"code": "FILL-AMAL", "name": "Dolgu (Amalgam)", "category": "treatment", "price": "650", "condition": "filled"},
    {"code": "FILL-TEMP", "name": "Geçici Dolgu", "category": "treatment", "price": "350", "condition": "filled"},
    {"code": "INLAY", "name": "İnley / Onley", "category": "treatment", "price": "2800", "condition": "filled"},
    {"code": "SEAL", "name": "Fissür Örtücü", "category": "treatment", "price": "550", "condition": "filled"},
    {"code": "FLUOR", "name": "Flor Uygulaması", "category": "treatment", "price": "400"},
    # Endodontics
    {"code": "RCT", "name": "Kanal Tedavisi", "category": "treatment", "price": "2200", "frequent": True, "condition": "root_canal"},
    {"code": "RCT-1", "name": "Kanal Tedavisi (Tek Kanal)", "category": "treatment", "price": "1800", "condition": "root_canal"},
    {"code": "RCT-M", "name": "Kanal Tedavisi (Çok Kanal)", "category": "treatment", "price": "3200", "condition": "root_canal"},
    {"code": "RCT-RE", "name": "Kanal Tedavisi Revizyonu", "category": "treatment", "price": "3500", "condition": "root_canal"},
    # Surgery / extraction
    {"code": "EXT", "name": "Diş Çekimi (Basit)", "category": "treatment", "price": "650", "frequent": True, "condition": "missing"},
    {"code": "EXT-SURG", "name": "Cerrahi Diş Çekimi", "category": "treatment", "price": "1200", "condition": "missing"},
    {"code": "WISDOM", "name": "20 Yaş Diş Çekimi", "category": "treatment", "price": "1800", "frequent": True, "condition": "missing"},
    {"code": "APICO", "name": "Apikal Rezeksiyon", "category": "treatment", "price": "2500"},
    # Periodontics
    {"code": "SCALE", "name": "Detartraj", "category": "treatment", "price": "900", "frequent": True},
    {"code": "CURETT", "name": "Küretaj", "category": "treatment", "price": "450"},
    {"code": "PERIO-SURG", "name": "Periodontal Cerrahi", "category": "treatment", "price": "3500"},
    # Prosthetics
    {"code": "CROWN-M", "name": "Kron (Metal)", "category": "treatment", "price": "3500", "condition": "crown"},
    {"code": "CROWN", "name": "Kron (Porselen)", "category": "treatment", "price": "4500", "condition": "crown"},
    {"code": "CROWN-Z", "name": "Kron (Zirkonyum)", "category": "treatment", "price": "5500", "condition": "crown", "frequent": True},
    {"code": "BRIDGE", "name": "Köprü", "category": "treatment", "price": "5200", "condition": "bridge"},
    {"code": "VENEER", "name": "Lamina (Veneer)", "category": "treatment", "price": "4800", "condition": "crown"},
    {"code": "PROS-TOT", "name": "Total Protez", "category": "treatment", "price": "8500"},
    {"code": "PROS-PAR", "name": "Parsiyel Protez", "category": "treatment", "price": "6500"},
    # Implants
    {"code": "IMP", "name": "İmplant", "category": "treatment", "price": "15000", "frequent": True, "condition": "implant"},
    {"code": "IMP-ABUT", "name": "İmplant Abutment", "category": "treatment", "price": "4500", "condition": "implant"},
    {"code": "IMP-CROWN", "name": "İmplant Üstü Kron", "category": "treatment", "price": "5500", "condition": "crown"},
    # Aesthetic / other
    {"code": "WHITEN", "name": "Diş Beyazlatma (Office)", "category": "treatment", "price": "3500"},
    {"code": "WHITEN-H", "name": "Diş Beyazlatma (Home)", "category": "treatment", "price": "2200"},
    {"code": "NIGHT-GUARD", "name": "Gece Plağı", "category": "treatment", "price": "2800"},
    {"code": "SPORT-GUARD", "name": "Spor Plağı", "category": "treatment", "price": "1800"},
    {"code": "EMERG", "name": "Acil Müdahale", "category": "treatment", "price": "500", "frequent": True},
    {"code": "PULP-CAP", "name": "Pulpa Kaplama", "category": "treatment", "price": "750", "condition": "filled"},
    {"code": "POST-CORE", "name": "Post ve Core", "category": "treatment", "price": "1200", "condition": "root_canal"},
]

LEGACY_DEMO_PROCEDURE_CODES = frozenset(row["code"] for row in DEFAULT_PROCEDURES)


def ensure_clinic_demo_patients(tenant: Tenant) -> None:
    """Seed demo patients only (treatments use TDB procedures after tariff sync)."""
    patients_data = [
        {
            "first_name": "Ragıp",
            "last_name": "Serbez",
            "tckn": "11111111110",
            "email": "ragip.serbez@demo.local",
            "mobile_phone": "5321000001",
        },
        {
            "first_name": "Elif",
            "last_name": "Kaya",
            "tckn": "22222222220",
            "email": "elif.kaya@demo.local",
            "mobile_phone": "5321000002",
        },
        {
            "first_name": "Mehmet",
            "last_name": "Yıldız",
            "tckn": "33333333330",
            "email": "mehmet.yildiz@demo.local",
            "mobile_phone": "5321000003",
        },
    ]
    for pdata in patients_data:
        Customer.all_tenants.update_or_create(
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
