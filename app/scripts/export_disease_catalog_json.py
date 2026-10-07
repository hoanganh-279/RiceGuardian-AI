#!/usr/bin/env python3
"""Export backend disease_catalog.py → app/assets/disease_catalog.json."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from core.data.disease_catalog import DISEASE_CATALOG  # noqa: E402

OUT = Path(__file__).resolve().parents[1] / "assets" / "disease_catalog.json"


def main() -> None:
    payload = [
        {
            "code": row["code"],
            "nameVi": row["nameVi"],
            "summary": row["summary"],
            "actions": list(row["actions"]),
        }
        for row in DISEASE_CATALOG
    ]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(payload)} diseases → {OUT}")


if __name__ == "__main__":
    main()
