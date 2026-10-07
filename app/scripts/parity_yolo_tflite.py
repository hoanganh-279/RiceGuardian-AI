#!/usr/bin/env python3
"""Compare Ultralytics yolo_best.pt vs the on-device detector TFLite.

Usage (from repo root):
  py app/scripts/parity_yolo_tflite.py path/to/image.jpg [more.jpg ...]

Requires: ultralytics, torch, ai-edge-litert (or tensorflow).
Paths / class names / thresholds come from app/assets/models/pipeline_config.json.
Prints boxes per side and a PASS/FAIL line per image
(match = same count, IoU >= 0.9 and |conf diff| <= 0.05 for every .pt box).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

APP_ROOT = Path(__file__).resolve().parents[1]
WEIGHTS = APP_ROOT / "session_b_checkpoint" / "yolo_best.pt"
MODELS = APP_ROOT / "assets" / "models"
CONFIG = MODELS / "pipeline_config.json"
PAD = 114
IOU_MATCH = 0.9
CONF_TOL = 0.05


def load_detector_config() -> dict:
    cfg = json.loads(CONFIG.read_text(encoding="utf-8"))
    det = cfg.get("detector")
    if not isinstance(det, dict) or "model_file" not in det:
        raise SystemExit(f"No 'detector' block in {CONFIG}")
    return det


def letterbox(img: Image.Image, size: int):
    """Match Flutter YoloTfliteHelper letterbox (pad RGB 114)."""
    w, h = img.size
    scale = min(size / w, size / h)
    new_w = max(1, int(round(w * scale)))
    new_h = max(1, int(round(h * scale)))
    resized = img.resize((new_w, new_h), Image.BILINEAR)
    canvas = Image.new("RGB", (size, size), (PAD, PAD, PAD))
    pad_x = (size - new_w) // 2
    pad_y = (size - new_h) // 2
    canvas.paste(resized, (pad_x, pad_y))
    meta = {"orig_w": w, "orig_h": h, "pad_x": pad_x, "pad_y": pad_y, "scale": scale}
    return canvas, meta


def map_to_original(xyxy, meta):
    x1, y1, x2, y2 = xyxy
    to_x = lambda x: (x - meta["pad_x"]) / meta["scale"]
    to_y = lambda y: (y - meta["pad_y"]) / meta["scale"]
    ox1, ox2 = sorted((to_x(x1), to_x(x2)))
    oy1, oy2 = sorted((to_y(y1), to_y(y2)))
    return [
        float(np.clip(ox1, 0, meta["orig_w"])),
        float(np.clip(oy1, 0, meta["orig_h"])),
        float(np.clip(ox2, 0, meta["orig_w"])),
        float(np.clip(oy2, 0, meta["orig_h"])),
    ]


def iou(a, b):
    ix1, iy1 = max(a[0], b[0]), max(a[1], b[1])
    ix2, iy2 = min(a[2], b[2]), min(a[3], b[3])
    inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
    if inter <= 0:
        return 0.0
    area = lambda r: max(0.0, r[2] - r[0]) * max(0.0, r[3] - r[1])
    union = area(a) + area(b) - inter
    return inter / union if union > 0 else 0.0


def nms(cands, iou_thr, top_k):
    cands = sorted(cands, key=lambda c: c["conf"], reverse=True)
    kept = []
    for c in cands:
        if all(iou(c["xyxy"], k["xyxy"]) < iou_thr for k in kept):
            kept.append(c)
        if len(kept) >= top_k:
            break
    return kept


def run_ultralytics(image_path: Path, det: dict, top_k: int):
    from ultralytics import YOLO

    size = int(det.get("imgsz", 640))
    # Feed the same square letterbox as the app; predict() would otherwise use
    # rect (stride-32) padding and the two sides would see different inputs.
    boxed, meta = letterbox(Image.open(image_path).convert("RGB"), size)
    bgr = np.asarray(boxed)[:, :, ::-1].copy()
    model = YOLO(str(WEIGHTS))
    r0 = model.predict(
        bgr,
        imgsz=size,
        conf=float(det.get("conf_thresh", 0.15)),
        iou=float(det.get("nms_iou", 0.7)),
        agnostic_nms=True,
        device="cpu",
        verbose=False,
        save=False,
    )[0]
    names = r0.names or {}
    boxes = []
    if r0.boxes is not None:
        for box in r0.boxes:
            cid = int(box.cls[0])
            boxes.append(
                {
                    "class_id": cid,
                    "label": names.get(cid, str(cid)),
                    "conf": float(box.conf[0]),
                    "xyxy": map_to_original(box.xyxy[0].tolist(), meta),
                }
            )
    boxes.sort(key=lambda b: b["conf"], reverse=True)
    return boxes[:top_k]


def make_interpreter(model_path: Path):
    try:
        from ai_edge_litert.interpreter import Interpreter
    except ImportError:
        import tensorflow as tf

        Interpreter = tf.lite.Interpreter
    interp = Interpreter(model_path=str(model_path))
    interp.allocate_tensors()
    return interp


def run_tflite(image_path: Path, det: dict, labels: list[str], top_k: int):
    size = int(det.get("imgsz", 640))
    conf_thr = float(det.get("conf_thresh", 0.15))
    normalized = bool(det.get("coords_normalized", True))
    img = Image.open(image_path).convert("RGB")
    boxed, meta = letterbox(img, size)
    inp = (np.asarray(boxed, dtype=np.float32) / 255.0)[np.newaxis, ...]

    interp = make_interpreter(MODELS / det["model_file"])
    in_d = interp.get_input_details()[0]
    out_d = interp.get_output_details()[0]
    interp.set_tensor(in_d["index"], inp)
    interp.invoke()
    out = interp.get_tensor(out_d["index"])[0]  # [4+nc, anchors]

    scores = out[4:, :]
    best_cls = scores.argmax(axis=0)
    best = scores.max(axis=0)
    s = float(size) if normalized else 1.0
    cands = []
    for a in np.nonzero(best >= conf_thr)[0]:
        cx, cy, w, h = (float(out[i, a]) for i in range(4))
        xyxy = [(cx - w / 2) * s, (cy - h / 2) * s, (cx + w / 2) * s, (cy + h / 2) * s]
        cid = int(best_cls[a])
        cands.append(
            {
                "class_id": cid,
                "label": labels[cid] if cid < len(labels) else str(cid),
                "conf": float(best[a]),
                "xyxy": map_to_original(xyxy, meta),
            }
        )
    return nms(cands, float(det.get("nms_iou", 0.7)), top_k), list(out_d["shape"])


def compare(pt_boxes, tf_boxes) -> bool:
    if len(pt_boxes) != len(tf_boxes):
        return False
    used = set()
    for p in pt_boxes:
        match = None
        for j, t in enumerate(tf_boxes):
            if j in used:
                continue
            if iou(p["xyxy"], t["xyxy"]) >= IOU_MATCH and abs(p["conf"] - t["conf"]) <= CONF_TOL:
                match = j
                break
        if match is None:
            return False
        used.add(match)
    return True


def _print(title, boxes):
    print(f"  {title}: {len(boxes)} box")
    for b in boxes:
        print(
            f"    {b['label']:<28} conf={b['conf']:.3f} "
            f"xyxy={[round(v, 1) for v in b['xyxy']]}"
        )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("images", type=Path, nargs="+")
    parser.add_argument("--top-k", type=int, default=3, help="Same as YoloTfliteHelper.topK")
    args = parser.parse_args()

    if not WEIGHTS.is_file():
        print(f"Missing weights: {WEIGHTS}", file=sys.stderr)
        return 1
    det = load_detector_config()
    labels = list(det.get("class_names") or [])
    print(f"pt: {WEIGHTS}\ntflite: {MODELS / det['model_file']}")

    failed = 0
    for image in args.images:
        if not image.is_file():
            print(f"Missing image: {image}", file=sys.stderr)
            failed += 1
            continue
        pt_boxes = run_ultralytics(image, det, args.top_k)
        tf_boxes, shape = run_tflite(image, det, labels, args.top_k)
        ok = compare(pt_boxes, tf_boxes)
        failed += 0 if ok else 1
        print(f"\n{image.name}  (tflite output {shape})  {'PASS' if ok else 'FAIL'}")
        _print(".pt", pt_boxes)
        _print("tflite", tf_boxes)

    print(f"\n{len(args.images) - failed}/{len(args.images)} images match")
    return 0 if failed == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
