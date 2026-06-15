"""Medula (SGK) e-Reçete constants from the official web service guide."""

from __future__ import annotations

NS = "http://servisler.ws.eczane.gss.sgk.gov.tr"

WSDL_URLS = {
    "test": "https://sgkt.sgk.gov.tr/medula/eczane/saglikTesisiReceteIslemleriWS?wsdl",
    "prod": "https://medeczane.sgk.gov.tr/medula/eczane/saglikTesisiReceteIslemleriWS?wsdl",
}

SERVICE_URLS = {
    "test": "https://sgkt.sgk.gov.tr/medula/eczane/saglikTesisiReceteIslemleriWS",
    "prod": "https://medeczane.sgk.gov.tr/medula/eczane/saglikTesisiReceteIslemleriWS",
}

# SGK test credentials — sağlık tesisi (özel klinik / diş merkezi senaryosu).
MEDULA_TEST_TESIS_KODU = 11068891
MEDULA_TEST_USERNAME = "99999999990"
MEDULA_TEST_PASSWORD = "99999999990"
MEDULA_TEST_DOKTOR_TC = "99999999990"

DENTAL_BRANCH_CODE = 9999
DEFAULT_CERTIFICATE_CODE = 0

PROVISION_TYPE_MAP = {
    "sgk": 1,
    "ucretli": 1,
    "yesil_kart": 1,
    "emekli": 1,
}

PRESCRIPTION_TYPE_MAP = {
    "normal": 1,
    "kirmizi": 2,
    "turuncu": 3,
    "mor": 4,
    "yesil": 5,
}

ROUTE_USAGE_MAP = {
    "oral": 1,
    "topical": 2,
    "iv": 15,
    "im": 9,
    "sc": 14,
    "other": 99,
}
