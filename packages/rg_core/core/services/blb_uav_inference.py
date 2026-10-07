"""Lazy U-Net (ResNet-101) singleton for 6-channel multispectral BLB semantic segmentation."""

from __future__ import annotations

import io
import json
import os
import threading
from datetime import datetime, timezone

from flask import current_app

_LOCK = threading.Lock()
_MODEL = None
_CONFIG = None

DEFAULT_CLASS_NAMES = [
    "Unlabeled",
    "Others",
    "Low-severity",
    "High-severity",
    "Healthy",
]
DEFAULT_CLASS_RGB = {
    0: (0, 0, 0),
    1: (204, 204, 204),
    2: (255, 255, 0),
    3: (255, 0, 0),
    4: (85, 255, 0),
}
DEFAULT_DISEASE_IDS = (2, 3)
DEFAULT_RICE_IDS = (2, 3, 4)
MS_CHANNELS = 6
PATCH_SIZE = 256
STRIDE = 224
MAX_EDGE = 4096
MIN_CROP_PX = 8
DEFAULT_PREVIEW_BANDS = (0, 1, 2)
BUNDLE_NAME = "blb_uav_seg_ms_d2"
_TIFF_MAGIC = (b"II*\x00", b"MM\x00*", b"II+\x00", b"MM\x00+")

NOT_TIFF_MESSAGE = (
    "Model BLB đa phổ cần GeoTIFF/TIFF 6 kênh (DJI P4 Multispectral). "
    "Ảnh JPG/PNG không phân tích được."
)


class ModelNotAvailable(Exception):
    status = 503

    def __init__(self, message=None):
        self.message = message or (
            "Chưa gắn model BLB đa phổ (thiếu best.pth). "
            f"Đặt best.pth + config.json 6 kênh vào backend/{BUNDLE_NAME}/ "
            f"hoặc web/{BUNDLE_NAME}/, hoặc set BLB_UAV_SEG_MODEL_PATH."
        )
        super().__init__(self.message)


def _product_backend_root():
    configured = (current_app.config.get("BACKEND_ROOT") or "").strip()
    if configured:
        return os.path.abspath(configured)
    return os.path.abspath(os.path.join(current_app.root_path, ".."))


def _bundle_dir():
    return os.path.abspath(os.path.join(_product_backend_root(), BUNDLE_NAME))


def _monorepo_web_bundle_weights():
    candidate = os.path.abspath(
        os.path.join(_product_backend_root(), "..", "web", BUNDLE_NAME, "best.pth")
    )
    if os.path.isfile(candidate):
        return candidate
    return None


def default_weights_path():
    """Resolve 6-channel weights: env → backend/<bundle> → web/<bundle>."""
    override = (current_app.config.get("BLB_UAV_SEG_MODEL_PATH") or "").strip()
    if override:
        if os.path.isabs(override):
            return override
        from_backend = os.path.abspath(os.path.join(_product_backend_root(), override))
        if os.path.isfile(from_backend):
            return from_backend
        return os.path.abspath(override)
    flat = os.path.join(_bundle_dir(), "best.pth")
    if os.path.isfile(flat):
        return flat
    monorepo = _monorepo_web_bundle_weights()
    if monorepo:
        return monorepo
    return flat


def _config_path_for_weights(weights_path):
    """Prefer config.json next to weights; else backend bundle config."""
    if weights_path:
        sibling = os.path.join(os.path.dirname(os.path.abspath(weights_path)), "config.json")
        if os.path.isfile(sibling):
            return sibling
    return os.path.join(_bundle_dir(), "config.json")


def load_config():
    global _CONFIG
    if _CONFIG is not None:
        return _CONFIG
    path = _config_path_for_weights(default_weights_path())
    cfg = {}
    if os.path.isfile(path):
        with open(path, encoding="utf-8") as handle:
            cfg = json.load(handle)
    class_rgb_raw = cfg.get("class_rgb") or {}
    class_rgb = {}
    for key, value in DEFAULT_CLASS_RGB.items():
        raw = class_rgb_raw.get(str(key), class_rgb_raw.get(key))
        if raw and len(raw) >= 3:
            class_rgb[key] = (int(raw[0]), int(raw[1]), int(raw[2]))
        else:
            class_rgb[key] = value
    _CONFIG = {
        "encoder": cfg.get("encoder") or "resnet101",
        "in_channels": int(cfg.get("in_channels") or MS_CHANNELS),
        "num_classes": int(cfg.get("num_classes") or 5),
        "img_size": int(cfg.get("img_size") or PATCH_SIZE),
        "band_mode": cfg.get("band_mode") or "",
        "class_names": cfg.get("class_names") or list(DEFAULT_CLASS_NAMES),
        "class_rgb": class_rgb,
        "disease_class_ids": tuple(cfg.get("disease_class_ids") or DEFAULT_DISEASE_IDS),
        "rice_class_ids": tuple(cfg.get("rice_class_ids") or DEFAULT_RICE_IDS),
    }
    return _CONFIG


def _validate_ms6_config(cfg):
    encoder = str(cfg.get("encoder") or "")
    in_channels = int(cfg.get("in_channels") or 0)
    num_classes = int(cfg.get("num_classes") or 0)
    if in_channels != MS_CHANNELS:
        raise ModelNotAvailable(
            f"Model BLB đa phổ phải có in_channels={MS_CHANNELS}, nhận {in_channels}. "
            f"Dùng best.pth + config.json của {BUNDLE_NAME} (band_mode D2_MS_NDVI)."
        )
    if num_classes != 5:
        raise ModelNotAvailable(f"Model BLB cần num_classes=5, nhận {num_classes}.")
    if encoder and encoder != "resnet101":
        raise ModelNotAvailable(f"Model BLB kỳ vọng encoder resnet101, nhận {encoder}.")


def _load_model():
    path = default_weights_path()
    if not os.path.isfile(path):
        raise ModelNotAvailable()
    try:
        import torch
        import segmentation_models_pytorch as smp
    except ImportError as err:
        raise ModelNotAvailable(
            "Thiếu torch hoặc segmentation-models-pytorch. "
            "Cài: pip install torch segmentation-models-pytorch tifffile"
        ) from err

    cfg = load_config()
    _validate_ms6_config(cfg)
    try:
        ckpt = torch.load(path, map_location="cpu", weights_only=False)
    except TypeError:
        ckpt = torch.load(path, map_location="cpu")
    if isinstance(ckpt, dict):
        meta = ckpt.get("meta")
        if isinstance(meta, dict) and meta.get("in_channels") is not None:
            if int(meta["in_channels"]) != MS_CHANNELS:
                raise ModelNotAvailable(
                    f"best.pth có meta.in_channels={meta['in_channels']}, cần {MS_CHANNELS}."
                )
    state = ckpt.get("model_state") if isinstance(ckpt, dict) else None
    if state is None and isinstance(ckpt, dict) and all(isinstance(k, str) for k in ckpt.keys()):
        if any(k.startswith("encoder.") or k.startswith("decoder.") for k in ckpt):
            state = ckpt
    if state is None:
        raise ModelNotAvailable("File best.pth không chứa model_state hợp lệ.")

    model = smp.Unet(
        encoder_name=cfg["encoder"],
        encoder_weights=None,
        in_channels=MS_CHANNELS,
        classes=cfg["num_classes"],
        activation=None,
    )
    model.load_state_dict(state, strict=True)
    model.eval()
    return model


def get_model():
    global _MODEL
    if _MODEL is not None:
        return _MODEL
    with _LOCK:
        if _MODEL is None:
            _MODEL = _load_model()
    return _MODEL


def is_tiff(content):
    return bool(content) and len(content) >= 4 and content[:4] in _TIFF_MAGIC


def to_chw6(array):
    """Return a (6, H, W) array from CHW or HWC input; reject other channel counts."""
    import numpy as np

    arr = np.asarray(array)
    if arr.ndim == 2:
        raise ValueError(f"Cần đúng {MS_CHANNELS} kênh, nhận 1 kênh.")
    if arr.ndim != 3:
        raise ValueError(
            f"Cần ảnh {MS_CHANNELS} kênh. Nhận shape {tuple(int(v) for v in arr.shape)}."
        )
    if int(arr.shape[0]) == MS_CHANNELS:
        chw = arr
    elif int(arr.shape[-1]) == MS_CHANNELS:
        chw = np.transpose(arr, (2, 0, 1))
    else:
        channels = min(int(arr.shape[0]), int(arr.shape[-1]))
        raise ValueError(f"Cần đúng {MS_CHANNELS} kênh, nhận {channels} kênh.")
    longest = max(int(chw.shape[1]), int(chw.shape[2]))
    if longest > MAX_EDGE:
        raise ValueError(
            f"Ảnh quá lớn ({longest} px). Cạnh dài nhất không được vượt {MAX_EDGE} px."
        )
    return np.ascontiguousarray(chw)


def read_ms6_bytes(content):
    """Decode a stacked 6-channel TIFF into (6, H, W), keeping the source dtype."""
    if not content:
        raise ValueError("Tệp ảnh trống.")
    if not is_tiff(content):
        raise ValueError(NOT_TIFF_MESSAGE)
    try:
        import tifffile
    except ImportError as err:
        raise ModelNotAvailable("Thiếu thư viện tifffile. Cài: pip install tifffile") from err
    try:
        with tifffile.TiffFile(io.BytesIO(content)) as tif:
            data = tif.asarray()
    except Exception as err:
        raise ValueError("Không đọc được tệp TIFF.") from err
    return to_chw6(data)


def encode_ms6_tiff(chw6):
    import tifffile

    buf = io.BytesIO()
    tifffile.imwrite(buf, chw6, photometric="minisblack", planarconfig="separate")
    return buf.getvalue()


def preview_bands():
    bands = current_app.config.get("BLB_MS_PREVIEW_BANDS") or DEFAULT_PREVIEW_BANDS
    return tuple(int(b) for b in bands)


def render_preview_png(chw6, bands=DEFAULT_PREVIEW_BANDS):
    """Stretch three bands (2–98 percentile) to uint8 RGB PNG for display only."""
    from PIL import Image
    import numpy as np

    picked = []
    for band in bands:
        channel = np.asarray(chw6[int(band)], dtype=np.float32)
        lo = float(np.percentile(channel, 2))
        hi = float(np.percentile(channel, 98))
        if hi <= lo:
            hi = lo + 1e-6
        scaled = np.clip((channel - lo) / (hi - lo), 0.0, 1.0) * 255.0
        picked.append(scaled.astype(np.uint8))
    rgb = np.stack(picked, axis=-1)
    buf = io.BytesIO()
    Image.fromarray(rgb).save(buf, format="PNG")
    return buf.getvalue()


def crop_ms6(chw6, rect):
    """Crop (6, H, W) by a percent rect {x, y, w, h}."""
    try:
        x = float(rect["x"])
        y = float(rect["y"])
        w = float(rect["w"])
        h = float(rect["h"])
    except (KeyError, TypeError, ValueError) as err:
        raise ValueError("Vùng cắt không hợp lệ.") from err
    height, width = int(chw6.shape[1]), int(chw6.shape[2])
    x0 = max(0, min(width, int(round(x / 100.0 * width))))
    y0 = max(0, min(height, int(round(y / 100.0 * height))))
    x1 = max(0, min(width, int(round((x + w) / 100.0 * width))))
    y1 = max(0, min(height, int(round((y + h) / 100.0 * height))))
    if x1 - x0 < MIN_CROP_PX or y1 - y0 < MIN_CROP_PX:
        raise ValueError("Vùng cắt quá nhỏ.")
    return chw6[:, y0:y1, x0:x1].copy()


def _normalize_patch(patch):
    """Per-channel min-max on one tile: (x - min) / (max - min + 1e-6)."""
    import numpy as np

    out = patch.astype("float32", copy=True)
    mn = out.min(axis=(1, 2), keepdims=True)
    mx = out.max(axis=(1, 2), keepdims=True)
    return (out - mn) / (mx - mn + 1e-6)


def _tile_starts(length, patch, stride):
    if length <= patch:
        return [0]
    starts = list(range(0, length - patch + 1, stride))
    last = length - patch
    if starts[-1] != last:
        starts.append(last)
    return starts


def predict_mask(chw6):
    import numpy as np
    import torch

    model = get_model()
    cfg = load_config()
    patch = int(cfg["img_size"] or PATCH_SIZE)
    _, height, width = chw6.shape
    pad_h = max(0, patch - height)
    pad_w = max(0, patch - width)
    data = np.asarray(chw6, dtype=np.float32)
    if pad_h or pad_w:
        data = np.pad(data, ((0, 0), (0, pad_h), (0, pad_w)), mode="edge")
    _, full_h, full_w = data.shape
    logits_sum = np.zeros((cfg["num_classes"], full_h, full_w), dtype=np.float32)
    weight = np.zeros((full_h, full_w), dtype=np.float32)

    with torch.no_grad():
        for y0 in _tile_starts(full_h, patch, STRIDE):
            for x0 in _tile_starts(full_w, patch, STRIDE):
                tile = _normalize_patch(data[:, y0 : y0 + patch, x0 : x0 + patch])
                tensor = torch.from_numpy(tile).unsqueeze(0)
                logits = model(tensor)[0].cpu().numpy()
                logits_sum[:, y0 : y0 + patch, x0 : x0 + patch] += logits
                weight[y0 : y0 + patch, x0 : x0 + patch] += 1.0

    avg = logits_sum / np.maximum(weight, 1e-6)[None, :, :]
    return avg.argmax(axis=0).astype(np.uint8)[:height, :width]


def parse_outline_points(points):
    vertices = []
    for pair in str(points or "").strip().split():
        parts = pair.split(",")
        if len(parts) != 2:
            continue
        try:
            vertices.append((float(parts[0]), float(parts[1])))
        except ValueError:
            continue
    return vertices


def outline_inside_mask(shape, outline_points):
    """True for pixels inside a percent polygon. Outside stays false."""
    from PIL import Image, ImageDraw
    import numpy as np

    vertices = parse_outline_points(outline_points)
    if len(vertices) < 3:
        raise ValueError("Vẽ ít nhất 3 đỉnh rồi đóng ranh giới.")
    height, width = int(shape[0]), int(shape[1])
    polygon = [((x / 100.0) * width, (y / 100.0) * height) for x, y in vertices]
    canvas = Image.new("L", (width, height), 0)
    ImageDraw.Draw(canvas).polygon(polygon, fill=1)
    return np.asarray(canvas) > 0


def clip_mask_to_outline(mask, outline_points):
    """Keep class ids inside a percent polygon; outside becomes Unlabeled (0)."""
    import numpy as np

    inside = outline_inside_mask(mask.shape, outline_points)
    clipped = np.array(mask, copy=True)
    clipped[~inside] = 0
    return clipped


def paint_disease(original_bytes, mask, low_class=2, high_class=3, inside=None):
    """Paint high-severity red and low-severity yellow; other pixels stay original."""
    from PIL import Image
    import numpy as np

    if not original_bytes:
        raise ValueError("Tệp ảnh trống.")
    try:
        with Image.open(io.BytesIO(original_bytes)) as image:
            rgb = image.convert("RGB")
            if rgb.size != (int(mask.shape[1]), int(mask.shape[0])):
                rgb = rgb.resize((int(mask.shape[1]), int(mask.shape[0])), Image.Resampling.BILINEAR)
            painted = np.array(rgb, copy=True)
    except ValueError:
        raise
    except Exception as err:
        raise ValueError("Không đọc được ảnh gốc để tô màu bệnh.") from err

    high = mask == int(high_class)
    low = mask == int(low_class)
    if inside is not None:
        high = high & inside
        low = low & inside
    painted[high] = (255, 0, 0)
    painted[low] = (255, 255, 0)
    buf = io.BytesIO()
    Image.fromarray(painted).save(buf, format="PNG")
    return buf.getvalue()


def colorize_mask(mask):
    from PIL import Image
    import numpy as np

    cfg = load_config()
    height, width = mask.shape
    rgba = np.zeros((height, width, 4), dtype=np.uint8)
    for class_id, rgb in cfg["class_rgb"].items():
        sel = mask == int(class_id)
        if not np.any(sel):
            continue
        rgba[sel, 0] = rgb[0]
        rgba[sel, 1] = rgb[1]
        rgba[sel, 2] = rgb[2]
        rgba[sel, 3] = 0 if int(class_id) == 0 else 160
    image = Image.fromarray(rgba)
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return buf.getvalue()


def compute_stats(mask):
    import numpy as np

    cfg = load_config()
    class_names = cfg["class_names"]
    counts = {}
    total = int(mask.size)
    for idx, name in enumerate(class_names):
        counts[name] = int(np.sum(mask == idx))
    fractions = {name: (counts[name] / total if total else 0.0) for name in class_names}
    rice_ids = set(int(i) for i in cfg["rice_class_ids"])
    disease_ids = set(int(i) for i in cfg["disease_class_ids"])
    rice_count = int(sum(counts[class_names[i]] for i in rice_ids if i < len(class_names)))
    disease_count = int(sum(counts[class_names[i]] for i in disease_ids if i < len(class_names)))

    def pct(name):
        return (counts.get(name, 0) / rice_count * 100.0) if rice_count else 0.0

    disease_pct = (disease_count / rice_count * 100.0) if rice_count else 0.0
    now = datetime.now(timezone.utc)
    return {
        "diseasePct": round(disease_pct, 2),
        "stats": {
            "classCounts": counts,
            "classFractions": {k: round(v, 6) for k, v in fractions.items()},
            "lowSeverityPct": round(pct("Low-severity"), 2),
            "highSeverityPct": round(pct("High-severity"), 2),
            "healthyPct": round(pct("Healthy"), 2),
            "ricePixelCount": rice_count,
            "diseasePixelCount": disease_count,
            "inferredAt": now.isoformat(),
        },
        "inferredAt": now,
    }


def infer_ms_bytes(ms_content, preview_png, outline_points=None):
    """Run the 6-channel model on a stacked TIFF and paint disease onto the preview PNG."""
    cfg = load_config()
    chw6 = read_ms6_bytes(ms_content)
    mask = predict_mask(chw6)
    inside = None
    if outline_points and len(parse_outline_points(outline_points)) >= 3:
        mask = clip_mask_to_outline(mask, outline_points)
        inside = outline_inside_mask(mask.shape, outline_points)
    disease_ids = tuple(cfg.get("disease_class_ids") or DEFAULT_DISEASE_IDS)
    low_class = disease_ids[0] if disease_ids else 2
    high_class = disease_ids[1] if len(disease_ids) > 1 else 3
    png = paint_disease(preview_png, mask, low_class=low_class, high_class=high_class, inside=inside)
    metrics = compute_stats(mask)
    return {
        "maskPng": png,
        "diseasePct": metrics["diseasePct"],
        "stats": metrics["stats"],
        "inferredAt": metrics["inferredAt"],
        "height": int(mask.shape[0]),
        "width": int(mask.shape[1]),
    }
