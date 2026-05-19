"""Uvicorn launcher that loads a `config` dict from a Python config file.

Usage:
    python run_uvicorn.py --config uvicorn.conf.py
"""

from __future__ import annotations

import argparse
import runpy
import sys
from pathlib import Path

import uvicorn


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--config",
        default="uvicorn.conf.py",
        help="Path to a Python file exposing a `config` dict",
    )
    args = parser.parse_args()
    path = Path(args.config).resolve()
    if not path.exists():
        print(f"Config not found: {path}", file=sys.stderr)
        return 2
    ns = runpy.run_path(str(path))
    cfg = ns.get("config")
    if not isinstance(cfg, dict):
        print(f"`config` dict missing in {path}", file=sys.stderr)
        return 2
    uvicorn.run(**cfg)
    return 0


if __name__ == "__main__":
    sys.exit(main())
