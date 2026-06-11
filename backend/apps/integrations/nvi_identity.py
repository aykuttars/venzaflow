from __future__ import annotations

import json
import threading
from datetime import date
from typing import Any

import requests

from apps.integrations.nvi import TcKimlikHandler, YabanciKimlikHandler

_tc_handler: TcKimlikHandler | None = None
_foreign_handler: YabanciKimlikHandler | None = None
_handler_lock = threading.Lock()


def _get_tc_handler() -> TcKimlikHandler:
    global _tc_handler
    if _tc_handler is not None:
        return _tc_handler
    with _handler_lock:
        if _tc_handler is None:
            _tc_handler = TcKimlikHandler()
        return _tc_handler


def _get_foreign_handler() -> YabanciKimlikHandler:
    global _foreign_handler
    if _foreign_handler is not None:
        return _foreign_handler
    with _handler_lock:
        if _foreign_handler is None:
            _foreign_handler = YabanciKimlikHandler()
        return _foreign_handler


def _identity_payload_ok(payload: Any) -> bool:
    if isinstance(payload, bool):
        return payload
    if isinstance(payload, dict):
        if "HataAciklama" in payload:
            err = payload.get("HataAciklama")
            return err in (None, "")
        for key in ("success", "Success", "basarili", "Basarili"):
            if key in payload:
                return bool(payload[key])
    return str(payload).lower() == "true"


def _normalize_handler_result(result: dict[str, Any]) -> dict[str, Any]:
    if not result.get("success"):
        return {
            "success": False,
            "reason": result.get("reason") or result.get("message") or "NVI verification failed.",
        }
    return {"success": True, "response": result.get("data")}


class NviIdentityHandler:
    """Kimlik doğrulama — TcKimlikHandler / YabanciKimlikHandler üzerinden."""

    @staticmethod
    def confirm_tckn(
        name: str,
        surname: str,
        tcno: str,
        birth_date: date | int,
    ) -> dict[str, Any]:
        if isinstance(birth_date, date):
            day, month, year = birth_date.day, birth_date.month, birth_date.year
        else:
            day, month, year = 1, 1, int(birth_date)

        result = _get_tc_handler().tc_kimlik_dogrula(
            tckn=str(tcno),
            ad=name,
            soyad=surname,
            dogum_gun=day,
            dogum_ay=month,
            dogum_yil=year,
        )
        normalized = _normalize_handler_result(result)
        if normalized.get("success"):
            normalized["response"] = {"success": _identity_payload_ok(normalized["response"])}
        return normalized

    @staticmethod
    def confirm_foreign(name: str, surname: str, foreign_id: str, birth_date: str) -> dict[str, Any]:
        day, month, year = birth_date.split(".")
        result = _get_foreign_handler().yabanci_kimlik_dogrula(
            yb_kimlik_no=str(foreign_id),
            ad=name,
            soyad=surname,
            dogum_gun=day,
            dogum_ay=month,
            dogum_yil=year,
        )
        normalized = _normalize_handler_result(result)
        if normalized.get("success"):
            normalized["response"] = {"success": _identity_payload_ok(normalized["response"])}
        return normalized

    @staticmethod
    def tax_no_confirm(tax_office, tax_no, kimlik_no):
        api_url = "https://intvrg.gib.gov.tr/intvrg_server/dispatch"
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/74.0.3729.131 Safari/537.36"
            ),
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Accept-Encoding": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
            "accept-language": "gzip, deflate",
        }
        jp = {
            "vergidaireleri": str(tax_office).rjust(6, "0"),
            "vkn1": tax_no,
            "tckn": "",
            "tckn1": kimlik_no,
        }
        payload = (
            'cmd=vergiNoIslemleri_vergiNumarasiSorgulama&callid=fd11433f1e007-14&token=d1078f5e3dc646b78d5d4e5842f21e97feb48d366bc7617458b6679dec12675154a01fccc42292bb04d926bc259dbc75e39dd8e202535fd70a7098396c74a6f7&jp={"dogrulama":'
            ' {"iller": "", "vergidaireleri": "%s", "vkn1": "%s",  "tckn1": "%s","tckn": ""}}'
            % (jp["vergidaireleri"], jp["vkn1"], jp["tckn1"])
        )
        r = requests.post(api_url, data=payload, headers=headers, timeout=30)
        if r.ok:
            return {"success": True, "response": json.loads(r.content)}
        return {"success": False, "reason": r.reason}


taxNoConfirm = NviIdentityHandler.tax_no_confirm
nviConfirm = NviIdentityHandler.confirm_tckn
foreingNviConfirm = NviIdentityHandler.confirm_foreign
