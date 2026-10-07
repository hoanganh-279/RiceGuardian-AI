"""Ensure `packages/rg_core` is on sys.path so `import core` works from product backends."""

from __future__ import annotations

import sys
from pathlib import Path

_RG_CORE_ROOT = Path(__file__).resolve().parent


def ensure_rg_core_on_path() -> Path:
    root = str(_RG_CORE_ROOT)
    if root not in sys.path:
        sys.path.insert(0, root)
    return _RG_CORE_ROOT
