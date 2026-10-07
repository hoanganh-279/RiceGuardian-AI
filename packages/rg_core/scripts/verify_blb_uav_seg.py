"""Smoke-check the multispectral BLB bundle (weights + synthetic 6-channel TIFF).

Synthetic noise only proves the pipeline runs; it says nothing about accuracy.
"""

from __future__ import annotations

import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

os.chdir(ROOT)


def main():
    import time

    import numpy as np

    from core import create_app
    from core.services.blb_uav_inference import (
        compute_stats,
        default_weights_path,
        encode_ms6_tiff,
        infer_ms_bytes,
        load_config,
        preview_bands,
        render_preview_png,
    )

    backend_root = os.environ.get("RG_BACKEND_ROOT")
    app = create_app(profile="web", backend_root=backend_root) if backend_root else create_app()
    with app.app_context():
        cfg = load_config()
        print("config", cfg["encoder"], cfg["in_channels"], cfg["num_classes"], cfg.get("band_mode"))
        path = default_weights_path()
        print("weights", path, "exists" if os.path.isfile(path) else "MISSING")
        if not os.path.isfile(path):
            print("SKIP infer — set BLB_UAV_SEG_MODEL_PATH or place blb_uav_seg_ms_d2/best.pth")
            return 0

        mask = np.zeros((32, 32), dtype=np.uint8)
        mask[:8, :] = 2
        mask[8:12, :] = 3
        mask[12:, :] = 4
        metrics = compute_stats(mask)
        expected = (8 * 32 + 4 * 32) / (32 * 32) * 100.0
        assert abs(metrics["diseasePct"] - expected) < 0.01, metrics
        print("stats_ok", metrics["diseasePct"], "healthy", metrics["stats"]["healthyPct"])

        chw6 = (np.random.rand(6, 300, 280) * 4000).astype("uint16")
        ms = encode_ms6_tiff(chw6)
        preview = render_preview_png(chw6, preview_bands())
        started = time.perf_counter()
        result = infer_ms_bytes(ms, preview)
        elapsed = time.perf_counter() - started
        assert result["maskPng"][:8] == b"\x89PNG\r\n\x1a\n"
        assert 0 <= result["diseasePct"] <= 100
        assert result["width"] == 280 and result["height"] == 300
        print(
            "infer_ok",
            result["width"],
            result["height"],
            result["diseasePct"],
            len(result["maskPng"]),
            f"{elapsed:.1f}s",
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
