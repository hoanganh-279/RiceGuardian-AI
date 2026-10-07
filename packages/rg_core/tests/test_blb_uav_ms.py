"""6-channel multispectral BLB helpers without loading torch."""

from io import BytesIO

import numpy as np
import pytest
from flask import Flask
from PIL import Image

from core.services import blb_uav_inference as blb
from core.services.blb_uav_inference import (
    MAX_EDGE,
    NOT_TIFF_MESSAGE,
    _normalize_patch,
    compute_stats,
    crop_ms6,
    encode_ms6_tiff,
    preview_bands,
    read_ms6_bytes,
    render_preview_png,
    to_chw6,
)

tifffile = pytest.importorskip("tifffile")


def _tiff_bytes(array):
    buf = BytesIO()
    tifffile.imwrite(buf, array, photometric="minisblack", planarconfig="separate")
    return buf.getvalue()


def _raster_bytes(fmt):
    buf = BytesIO()
    Image.fromarray(np.full((8, 8, 3), 50, dtype=np.uint8)).save(buf, format=fmt)
    return buf.getvalue()


def test_read_ms6_rejects_png_and_jpeg():
    for fmt in ("PNG", "JPEG"):
        with pytest.raises(ValueError) as err:
            read_ms6_bytes(_raster_bytes(fmt))
        assert str(err.value) == NOT_TIFF_MESSAGE


def test_read_ms6_rejects_empty():
    with pytest.raises(ValueError, match="trống"):
        read_ms6_bytes(b"")


@pytest.mark.parametrize("channels", [3, 5])
def test_read_ms6_rejects_wrong_channel_count(channels):
    data = _tiff_bytes(np.zeros((channels, 16, 16), dtype=np.uint16))
    with pytest.raises(ValueError, match="6 kênh"):
        read_ms6_bytes(data)


def test_read_ms6_accepts_chw_and_keeps_dtype():
    chw = np.arange(6 * 10 * 12, dtype=np.uint16).reshape(6, 10, 12)
    decoded = read_ms6_bytes(_tiff_bytes(chw))
    assert decoded.shape == (6, 10, 12)
    assert decoded.dtype == np.uint16
    assert np.array_equal(decoded, chw)


def test_to_chw6_accepts_hwc_and_rejects_oversized():
    chw = np.arange(6 * 4 * 5, dtype=np.float32).reshape(6, 4, 5)
    hwc = np.transpose(chw, (1, 2, 0))
    assert np.array_equal(to_chw6(hwc), chw)
    with pytest.raises(ValueError, match="1 kênh"):
        to_chw6(np.zeros((8, 8)))
    with pytest.raises(ValueError, match=str(MAX_EDGE)):
        to_chw6(np.zeros((6, MAX_EDGE + 1, 4), dtype=np.uint8))


def test_encode_ms6_tiff_roundtrip():
    chw = (np.random.rand(6, 9, 7) * 1000).astype(np.float32)
    assert np.array_equal(read_ms6_bytes(encode_ms6_tiff(chw)), chw)


def test_normalize_patch_is_per_channel_min_max():
    patch = np.zeros((6, 2, 2), dtype=np.float32)
    patch[0] = [[0, 10], [5, 10]]
    patch[1] = 7
    out = _normalize_patch(patch)
    assert out.dtype == np.float32
    assert np.allclose(out[0], np.array([[0, 10], [5, 10]]) / (10 + 1e-6))
    assert np.allclose(out[1], 0.0)


def test_preview_bands_reads_config_and_default():
    app = Flask(__name__)
    with app.app_context():
        assert preview_bands() == (0, 1, 2)
        app.config["BLB_MS_PREVIEW_BANDS"] = (2, 1, 0)
        assert preview_bands() == (2, 1, 0)


def test_render_preview_png_uses_selected_bands():
    chw = np.zeros((6, 8, 8), dtype=np.float32)
    chw[3, :, 4:] = 100
    png = render_preview_png(chw, (3, 0, 0))
    rgb = np.asarray(Image.open(BytesIO(png)).convert("RGB"))
    assert rgb.shape == (8, 8, 3)
    assert rgb[0, 0, 0] == 0
    assert rgb[0, 7, 0] == 255
    assert rgb[0, 7, 1] == 0


def test_crop_ms6_by_percent_rect():
    chw = np.arange(6 * 100 * 200, dtype=np.uint16).reshape(6, 100, 200)
    out = crop_ms6(chw, {"x": 10, "y": 20, "w": 50, "h": 30})
    assert out.shape == (6, 30, 100)
    assert np.array_equal(out, chw[:, 20:50, 20:120])
    with pytest.raises(ValueError, match="quá nhỏ"):
        crop_ms6(chw, {"x": 0, "y": 0, "w": 1, "h": 1})
    with pytest.raises(ValueError, match="không hợp lệ"):
        crop_ms6(chw, {"x": 0})


def test_compute_stats_reports_healthy_pct(monkeypatch):
    monkeypatch.setattr(
        blb,
        "load_config",
        lambda: {
            "class_names": list(blb.DEFAULT_CLASS_NAMES),
            "rice_class_ids": list(blb.DEFAULT_RICE_IDS),
            "disease_class_ids": list(blb.DEFAULT_DISEASE_IDS),
        },
    )
    mask = np.zeros((10, 10), dtype=np.uint8)
    mask[:2] = 2
    mask[2:3] = 3
    mask[3:8] = 4
    metrics = compute_stats(mask)
    assert metrics["diseasePct"] == 37.5
    assert metrics["stats"]["lowSeverityPct"] == 25.0
    assert metrics["stats"]["highSeverityPct"] == 12.5
    assert metrics["stats"]["healthyPct"] == 62.5
