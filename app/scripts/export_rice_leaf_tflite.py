#!/usr/bin/env python3
"""Export YOLOv8 best.pt to TFLite for the Flutter farmer app.

Usage (from repo root or app/):
  python app/scripts/export_rice_leaf_tflite.py

Requires: ultralytics==8.3.x (classic TFLite path), torch, tensorflow.
  Note: ultralytics>=8.4 LiteRT export is Linux/macOS-only — pin 8.3 on Windows.

Output: app/assets/models/rice_disease.tflite
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parents[1]
WEIGHTS = APP_ROOT / "model_rice_leaf_v2" / "best.pt"
OUT_DIR = APP_ROOT / "assets" / "models"
OUT_NAME = "rice_disease.tflite"
IMGSZ = 640


def main() -> int:
    if not WEIGHTS.is_file():
        print(f"Missing weights: {WEIGHTS}", file=sys.stderr)
        return 1

    try:
        from ultralytics import YOLO
        import ultralytics
    except ImportError:
        print(
            "Missing ultralytics. Install: pip install 'ultralytics==8.3.185'",
            file=sys.stderr,
        )
        return 1

    ver = getattr(ultralytics, "__version__", "?")
    print(f"ultralytics {ver}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    model = YOLO(str(WEIGHTS))
    # Classic TFLite (8.3): ONNX → SavedModel → .tflite.
    # Raw output shape ~ (1, 13, 8400); Flutter YoloTfliteHelper parses top score.
    exported = model.export(
        format="tflite",
        imgsz=IMGSZ,
        half=False,
        int8=False,
    )
    exported_path = Path(exported)

    candidates: list[Path] = []
    if exported_path.is_file() and exported_path.suffix == ".tflite":
        candidates = [exported_path]
    elif exported_path.is_dir():
        candidates = list(exported_path.rglob("*.tflite"))
    else:
        # Ultralytics may return the float32 path string under *_saved_model/
        saved = WEIGHTS.parent / "best_saved_model"
        if saved.is_dir():
            candidates = list(saved.rglob("*.tflite"))

    if not candidates:
        print(f"No .tflite found from export: {exported}", file=sys.stderr)
        return 1

    # Prefer float32 — float16 onnx2tf artifacts often fail AllocateTensors.
    preferred = [p for p in candidates if "float32" in p.name.lower()]
    chosen = preferred[0] if preferred else candidates[0]

    dest = OUT_DIR / OUT_NAME
    shutil.copy2(chosen, dest)
    size_mb = dest.stat().st_size / (1024 * 1024)
    print(f"Wrote {dest} ({size_mb:.1f} MB)")
    print(f"Source export: {chosen}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
