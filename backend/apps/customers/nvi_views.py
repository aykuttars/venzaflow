from __future__ import annotations

import logging
import threading
import uuid
from collections.abc import Callable
from datetime import date
from typing import Any

from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import HasModule, HasViewPermission
from apps.integrations.nvi import NviHandler
from apps.integrations.nvi_identity import NviIdentityHandler

_handler: NviHandler | None = None
_handler_lock = threading.Lock()
_RATE_WINDOW_KEY = "nvi:rate:minute"


def _address_cache_ttl() -> int:
    return int(getattr(settings, "NVI_ADDRESS_CACHE_TTL", 60 * 60 * 24 * 7))


def _cache_get(key: str, default: Any = None) -> Any:
    try:
        return cache.get(key, default)
    except Exception:
        logger.warning("NVI cache get failed for %s", key, exc_info=True)
        return default


def _cache_set(key: str, value: Any, *, timeout: int) -> None:
    try:
        cache.set(key, value, timeout=timeout)
    except Exception:
        logger.warning("NVI cache set failed for %s", key, exc_info=True)


def _rate_limit_nvi_call() -> None:
    limit = int(getattr(settings, "NVI_RATE_LIMIT_PER_MINUTE", 20))
    if limit <= 0:
        return
    try:
        count = cache.incr(_RATE_WINDOW_KEY)
    except ValueError:
        _cache_set(_RATE_WINDOW_KEY, 1, timeout=60)
        count = 1
    except Exception:
        logger.warning("NVI rate limit cache unavailable", exc_info=True)
        return
    if count > limit:
        raise NviError(
            "NVI istek limiti aşıldı; kısa süre sonra tekrar deneyin veya cache dolana kadar bekleyin."
        )


def _cached_list(cache_key: str, fetch: Callable[[], dict[str, Any]]) -> list[dict[str, int | str]]:
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached
    _rate_limit_nvi_call()
    rows = _parse_result(fetch())
    _cache_set(cache_key, rows, timeout=_address_cache_ttl())
    return rows


def _get_handler() -> NviHandler:
    global _handler
    if _handler is not None:
        return _handler
    with _handler_lock:
        if _handler is None:
            _handler = NviHandler()
        return _handler


class NviError(Exception):
    pass


class NviIdentityMismatch(NviError):
    pass


class NviAddressMismatch(NviError):
    pass


class NviVerificationError(NviError):
    def __init__(self, step: str, message: str) -> None:
        self.step = step
        super().__init__(message)


_IDENTITY_FIELDS = ("first_name", "last_name", "birth_date", "nationality", "tckn")
_HOME_NVI_FIELDS = (
    "province_code",
    "district_code",
    "neighborhood_code",
    "street_code",
    "building_code",
    "unit_code",
    "address_code",
    "full_address",
)


def _parse_result(result: dict[str, Any]) -> list[dict[str, int | str]]:
    if not result.get("success"):
        raise NviError(result.get("reason") or result.get("message") or "NVI error")
    data = result.get("data", [])
    if isinstance(data, dict):
        raise NviError(data.get("message") or "NVI error")
    return [
        {
            "code": int(row["kimlikNo"]),
            "name": str(row.get("bilesenAdi") or row.get("adi")).strip(),
        }
        for row in data
        if row.get("kimlikNo") and (row.get("bilesenAdi") or row.get("adi"))
    ]


def list_provinces() -> list[dict[str, int | str]]:
    from apps.customers.models import TurkishProvince

    rows = TurkishProvince.objects.order_by("name").values("plate_code", "name")
    return [{"code": row["plate_code"], "name": row["name"]} for row in rows]


def list_districts(il_kimlik_no: int) -> list[dict[str, int | str]]:
    return _cached_list(
        f"nvi:address:districts:{il_kimlik_no}",
        lambda: _get_handler().ilce_list(il_kimlik_no),
    )


def list_neighborhoods(ilce_kimlik_no: int) -> list[dict[str, int | str]]:
    return _cached_list(
        f"nvi:address:neighborhoods:{ilce_kimlik_no}",
        lambda: _get_handler().mahalle_list(ilce_kimlik_no),
    )


def list_streets(mahalle_kimlik_no: int) -> list[dict[str, int | str]]:
    return _cached_list(
        f"nvi:address:streets:{mahalle_kimlik_no}",
        lambda: _get_handler().yol_list(mahalle_kimlik_no),
    )


def list_buildings(mahalle_kimlik_no: int, yol_kimlik_no: int) -> list[dict[str, int | str]]:
    return _cached_list(
        f"nvi:address:buildings:{mahalle_kimlik_no}:{yol_kimlik_no}",
        lambda: _get_handler().bina_list(mahalle_kimlik_no, yol_kimlik_no),
    )


def list_units(mahalle_kimlik_no: int, bina_kimlik_no: int) -> list[dict[str, int | str]]:
    return _cached_list(
        f"nvi:address:units:{mahalle_kimlik_no}:{bina_kimlik_no}",
        lambda: _get_handler().bagimsizbolum_list(mahalle_kimlik_no, bina_kimlik_no),
    )


def _format_open_address(data: dict) -> dict[str, int | str]:
    model = data.get("acikAdresModel") or {}
    full = (model.get("acikAdresAciklama") or "").strip()
    if not full:
        raise NviError(data.get("message") or "Open address not found")
    address_code = int(data.get("adresNo") or model.get("adresNo") or 0)
    if not address_code:
        raise NviError("Open address not found")
    return {
        "address_code": address_code,
        "full_address": full,
        "building_no": str(
            data.get("disKapiNo")
            or model.get("disKapiNoFormatted")
            or model.get("disKapiNo1")
            or ""
        ).strip(),
        "apartment_no": str(data.get("icKapiNo") or model.get("icKapiNo") or "").strip(),
        "block_name": str(data.get("blokAdi") or model.get("blokAdi") or "").strip(),
        "resolved_at": "unit" if data.get("icKapiNo") or model.get("icKapiNo") else "building",
    }


def get_open_address(
    mahalle_kimlik_no: int,
    *,
    unit_kimlik_no: int | None = None,
    bina_kimlik_no: int | None = None,
) -> dict[str, int | str]:
    attempts: list[int] = []
    if unit_kimlik_no:
        attempts.append(unit_kimlik_no)
    if bina_kimlik_no and bina_kimlik_no not in attempts:
        attempts.append(bina_kimlik_no)
    if not attempts:
        raise NviError("Query parameter 'unit' or 'bina' is required.")

    cache_key = f"nvi:address:open:{mahalle_kimlik_no}:{attempts[0]}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    _rate_limit_nvi_call()
    last_error = "Open address not found"
    for kayit_no in attempts:
        result = _get_handler().acik_adres(mahalle_kimlik_no, kayit_no)
        if not result.get("success"):
            last_error = result.get("reason") or result.get("message") or last_error
            continue
        data = result.get("data")
        if not isinstance(data, dict):
            continue
        try:
            row = _format_open_address(data)
            _cache_set(cache_key, row, timeout=_address_cache_ttl())
            return row
        except NviError as exc:
            last_error = str(exc)
    raise NviError(last_error)


def _residence_query_no(address: dict[str, Any]) -> int | None:
    """NVI KisiAdresOturuyormuAra expects AcikAdres ``adresNo`` as bagimsizBolumKimlikNo."""
    code = address.get("address_code")
    if code in (None, ""):
        return None
    return int(code)


def _parse_residence_result(result: dict[str, Any]) -> dict[str, bool]:
    if not result.get("success"):
        raise NviError(result.get("reason") or result.get("message") or "NVI error")
    data = result.get("data")
    if not isinstance(data, dict):
        raise NviError("NVI address residency check failed.")
    if data.get("success") is False:
        raise NviError(data.get("message") or "NVI address residency check failed.")
    payload = data.get("result")
    if not isinstance(payload, dict):
        raise NviError("NVI address residency check failed.")
    return {
        "verified": bool(payload.get("verilenAdresDogru")),
        "address_correct": bool(payload.get("verilenAdresDogru")),
        "has_registered_address": bool(payload.get("kisininOturduguAdresVar")),
        "address_incorrect": bool(payload.get("verilenAdresDogruDegil")),
        "no_registered_address": bool(payload.get("kisininOturduguAdresYok")),
    }


def verify_residence_address(*, tckn: str, home_address: dict[str, Any]) -> dict[str, Any]:
    from django.core.exceptions import ValidationError

    from apps.customers.validators import validate_tckn

    try:
        tckn_clean = validate_tckn(tckn)
    except ValidationError as exc:
        raise NviAddressMismatch(str(exc.messages[0])) from exc

    query_no = _residence_query_no(home_address or {})
    if not query_no:
        raise NviAddressMismatch("Open address code (adresNo) is required.")

    _rate_limit_nvi_call()
    result = _get_handler().kisi_adres_oturuyormu(tckn_clean, query_no)
    parsed = _parse_residence_result(result)
    if not parsed["verified"]:
        if parsed["no_registered_address"]:
            raise NviAddressMismatch("Person has no registered address at NVI.")
        raise NviAddressMismatch("Given address does not match NVI records.")
    return parsed


def _foreign_ok(payload: Any) -> bool:
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


def verify_identity(
    *,
    nationality: str,
    first_name: str,
    last_name: str,
    birth_date: date,
    tckn: str = "",
) -> dict[str, Any]:
    from django.core.exceptions import ValidationError

    from apps.customers.validators import validate_foreign_kimlik_no, validate_tckn

    first = (first_name or "").strip()
    last = (last_name or "").strip()
    if not first or not last or not birth_date:
        raise NviIdentityMismatch("Identity fields are incomplete.")

    if nationality == "tc":
        try:
            tckn_clean = validate_tckn(tckn)
        except ValidationError as exc:
            raise NviIdentityMismatch(str(exc.messages[0])) from exc

        result = NviIdentityHandler.confirm_tckn(first, last, tckn_clean, birth_date)
        if not result.get("success"):
            raise NviIdentityMismatch(result.get("reason") or "NVI verification failed.")
        if not result["response"].get("success"):
            raise NviIdentityMismatch("Identity does not match NVI records.")
        return {
            "verified": True,
            "reference": f"kps-tckn-{tckn_clean}-{uuid.uuid4().hex[:8]}",
            "normalized_first_name": first.upper(),
            "normalized_last_name": last.upper(),
        }

    if nationality == "foreign":
        try:
            kimlik_no = validate_foreign_kimlik_no(tckn)
        except ValidationError as exc:
            raise NviIdentityMismatch(str(exc.messages[0])) from exc

        result = NviIdentityHandler.confirm_foreign(
            first, last, kimlik_no, birth_date.strftime("%d.%m.%Y")
        )
        if not result.get("success"):
            raise NviIdentityMismatch(result.get("reason") or "NVI verification failed.")
        if not _foreign_ok(result["response"]):
            raise NviIdentityMismatch("Identity does not match NVI records.")
        return {
            "verified": True,
            "reference": f"kps-foreign-{kimlik_no}-{uuid.uuid4().hex[:8]}",
            "normalized_first_name": first.upper(),
            "normalized_last_name": last.upper(),
        }

    raise NviIdentityMismatch("Invalid nationality.")


def _identity_verification_needed(instance: Any, attrs: dict[str, Any]) -> bool:
    if instance is None or not instance.nvi_verified:
        return True
    for field in _IDENTITY_FIELDS:
        if field in attrs and attrs[field] != getattr(instance, field):
            return True
    return False


def _home_residence_verification_needed(instance: Any, home: dict[str, Any]) -> bool:
    if not home.get("address_code"):
        return False
    if instance is None:
        return True
    old = instance.home_address or {}
    if not old.get("nvi_residence_verified"):
        return True
    for field in _HOME_NVI_FIELDS:
        if home.get(field) != old.get(field):
            return True
    return False


def verify_patient_nvi(*, instance: Any, attrs: dict[str, Any]) -> None:
    """Kimlik ve (TC ise) ev adresi teyidini sırayla çalıştırır; attrs güncellenir."""
    nationality = attrs.get(
        "nationality",
        getattr(instance, "nationality", "") if instance else "",
    )
    first = attrs.get("first_name", getattr(instance, "first_name", ""))
    last = attrs.get("last_name", getattr(instance, "last_name", ""))
    birth = attrs.get("birth_date", getattr(instance, "birth_date", None))
    tckn = attrs.get("tckn", getattr(instance, "tckn", ""))
    home = dict(attrs.get("home_address") or {})

    if _identity_verification_needed(instance, attrs):
        try:
            result = verify_identity(
                nationality=nationality,
                first_name=first,
                last_name=last,
                birth_date=birth,
                tckn=tckn,
            )
        except NviIdentityMismatch as exc:
            raise NviVerificationError("identity", str(exc)) from exc

        attrs.pop("nvi_reference", None)
        attrs["nvi_verified"] = True
        attrs["nvi_verified_at"] = timezone.now()
        attrs["nvi_reference"] = result["reference"]
        if result["normalized_first_name"]:
            attrs["first_name"] = result["normalized_first_name"]
        if result["normalized_last_name"]:
            attrs["last_name"] = result["normalized_last_name"]

    if nationality == "tc" and _home_residence_verification_needed(instance, home):
        try:
            verify_residence_address(tckn=attrs.get("tckn", tckn), home_address=home)
        except NviAddressMismatch as exc:
            raise NviVerificationError("address_residence", str(exc)) from exc

        home["nvi_residence_verified"] = True
        home["nvi_residence_verified_at"] = timezone.now().isoformat()
        attrs["home_address"] = home


class NviAddressBaseView(APIView):
    permission_classes = [IsAuthenticated, HasModule, HasViewPermission]
    required_module = "patients"
    required_permission = "patients.read"

    def handle_exception(self, exc):
        if isinstance(exc, NviError):
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        return super().handle_exception(exc)


class NviAddressProvincesView(NviAddressBaseView):
    def get(self, request):
        return Response(list_provinces())


class NviAddressDistrictsView(NviAddressBaseView):
    def get(self, request):
        il = request.query_params.get("il")
        if not il or not str(il).isdigit():
            return Response({"detail": "Query parameter 'il' is required."}, status=400)
        return Response(list_districts(int(il)))


class NviAddressNeighborhoodsView(NviAddressBaseView):
    def get(self, request):
        ilce = request.query_params.get("ilce")
        if not ilce or not str(ilce).isdigit():
            return Response({"detail": "Query parameter 'ilce' is required."}, status=400)
        return Response(list_neighborhoods(int(ilce)))


class NviAddressStreetsView(NviAddressBaseView):
    def get(self, request):
        mahalle = request.query_params.get("mahalle")
        if not mahalle or not str(mahalle).isdigit():
            return Response({"detail": "Query parameter 'mahalle' is required."}, status=400)
        return Response(list_streets(int(mahalle)))


class NviAddressBuildingsView(NviAddressBaseView):
    def get(self, request):
        mahalle = request.query_params.get("mahalle")
        yol = request.query_params.get("yol")
        if not mahalle or not str(mahalle).isdigit():
            return Response({"detail": "Query parameter 'mahalle' is required."}, status=400)
        if not yol or not str(yol).isdigit():
            return Response({"detail": "Query parameter 'yol' is required."}, status=400)
        return Response(list_buildings(int(mahalle), int(yol)))


class NviAddressUnitsView(NviAddressBaseView):
    def get(self, request):
        mahalle = request.query_params.get("mahalle")
        bina = request.query_params.get("bina")
        if not mahalle or not str(mahalle).isdigit():
            return Response({"detail": "Query parameter 'mahalle' is required."}, status=400)
        if not bina or not str(bina).isdigit():
            return Response({"detail": "Query parameter 'bina' is required."}, status=400)
        return Response(list_units(int(mahalle), int(bina)))


class NviAddressOpenAddressView(NviAddressBaseView):
    def get(self, request):
        mahalle = request.query_params.get("mahalle")
        unit = request.query_params.get("unit")
        bina = request.query_params.get("bina")
        if not mahalle or not str(mahalle).isdigit():
            return Response({"detail": "Query parameter 'mahalle' is required."}, status=400)
        if (not unit or not str(unit).isdigit()) and (not bina or not str(bina).isdigit()):
            return Response({"detail": "Query parameter 'unit' or 'bina' is required."}, status=400)
        return Response(
            get_open_address(
                int(mahalle),
                unit_kimlik_no=int(unit) if unit and str(unit).isdigit() else None,
                bina_kimlik_no=int(bina) if bina and str(bina).isdigit() else None,
            )
        )


class NviIdentityVerifyView(APIView):
    permission_classes = [IsAuthenticated, HasModule, HasViewPermission]
    required_module = "patients"
    required_permission = "patients.write"

    def post(self, request):
        data = request.data
        nationality = (data.get("nationality") or "").strip()
        first_name = (data.get("first_name") or "").strip()
        last_name = (data.get("last_name") or "").strip()
        birth_date_raw = data.get("birth_date")
        tckn = (data.get("tckn") or "").strip()

        if not birth_date_raw:
            return Response({"detail": "birth_date is required."}, status=400)
        try:
            birth_date = date.fromisoformat(str(birth_date_raw)[:10])
        except ValueError:
            return Response({"detail": "Invalid birth_date."}, status=400)

        try:
            result = verify_identity(
                nationality=nationality,
                first_name=first_name,
                last_name=last_name,
                birth_date=birth_date,
                tckn=tckn,
            )
        except Exception as exc:
            return Response({"detail": str(exc)}, status=400)

        return Response(
            {
                "verified": result["verified"],
                "reference": result["reference"],
                "normalized_first_name": result["normalized_first_name"],
                "normalized_last_name": result["normalized_last_name"],
                "verified_at": timezone.now().isoformat(),
            }
        )


class NviAddressVerifyResidenceView(APIView):
    permission_classes = [IsAuthenticated, HasModule, HasViewPermission]
    required_module = "patients"
    required_permission = "patients.write"

    def post(self, request):
        data = request.data
        tckn = (data.get("tckn") or "").strip()
        home_address = data.get("home_address") or {}

        if not isinstance(home_address, dict):
            return Response({"detail": "home_address must be an object."}, status=400)

        try:
            result = verify_residence_address(tckn=tckn, home_address=home_address)
        except NviAddressMismatch as exc:
            return Response({"detail": str(exc)}, status=400)
        except NviError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        return Response(
            {
                "verified": result["verified"],
                "address_correct": result["address_correct"],
                "has_registered_address": result["has_registered_address"],
                "verified_at": timezone.now().isoformat(),
            }
        )
