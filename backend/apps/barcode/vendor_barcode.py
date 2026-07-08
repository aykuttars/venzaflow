"""Import the PyPI python-barcode package without shadowing by apps.barcode."""

from __future__ import annotations

import importlib
import sys
from types import ModuleType
from typing import Any


def _is_local_barcode_module(module: ModuleType | None) -> bool:
    module_file = getattr(module, "__file__", "") or ""
    normalized = module_file.replace("\\", "/")
    return "/apps/barcode/" in normalized


def _clear_barcode_modules() -> None:
    for name in list(sys.modules):
        if name == "barcode" or name.startswith("barcode."):
            del sys.modules[name]


def import_vendor_barcode() -> ModuleType:
    cached = sys.modules.get("barcode")
    if cached is not None and not _is_local_barcode_module(cached):
        return cached
    _clear_barcode_modules()
    return importlib.import_module("barcode")


def import_image_writer() -> type[Any]:
    import_vendor_barcode()
    writer_mod = importlib.import_module("barcode.writer")
    return writer_mod.ImageWriter
