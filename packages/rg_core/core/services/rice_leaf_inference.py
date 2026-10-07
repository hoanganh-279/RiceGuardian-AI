"""Lazy YOLOv8 singleton for rice-leaf rescan. CPU by default."""

from __future__ import annotations

import io
import os
import threading

import requests
from flask import current_app

from core.data.disease_catalog import get_disease, solution_payload

_LOCK = threading.Lock()
_MODEL = None


class ModelNotAvailable(Exception):
    status = 503

    def __init__(self, message=None):
        self.message = message or (
            "Chưa gắn model nhận diện (thiếu best.pt). "
            "Đặt file vào web/backend/ml/model_rice_leaf_v2/best.pt."
        )
        super().__init__(self.message)


def _product_backend_root():
    configured = (current_app.config.get("BACKEND_ROOT") or "").strip()
    if configured:
        return os.path.abspath(configured)
    return os.path.abspath(os.path.join(current_app.root_path, ".."))


def default_weights_path():
    override = (current_app.config.get("RICE_LEAF_MODEL_PATH") or "").strip()
    if override:
        return override
    return os.path.abspath(
        os.path.join(_product_backend_root(), "ml", "model_rice_leaf_v2", "best.pt")
    )


def _yaml_names():
    path = os.path.abspath(
        os.path.join(_product_backend_root(), "ml", "model_rice_leaf_v2", "det_data.yaml")
    )
    names = []
    if not os.path.isfile(path):
        return names
    in_names = False
    with open(path, encoding="utf-8") as handle:
        for raw in handle:
            line = raw.rstrip()
            if line.startswith("names:"):
                in_names = True
                continue
            if in_names:
                if line.startswith("- "):
                    names.append(line[2:].strip())
                elif line and not line.startswith(" "):
                    break
    return names


def _normalize_class(raw_name, class_id):
    entry = get_disease(raw_name)
    if entry:
        return entry
    yaml_names = _yaml_names()
    if 0 <= class_id < len(yaml_names):
        entry = get_disease(yaml_names[class_id])
        if entry:
            return entry
    return None


def _load_model():
    path = default_weights_path()
    if not os.path.isfile(path):
        raise ModelNotAvailable()
    try:
        from ultralytics import YOLO
    except ImportError as err:
        raise ModelNotAvailable(
            "Thiếu thư viện ultralytics. Cài: pip install ultralytics"
        ) from err
    return YOLO(path)


def get_model():
    global _MODEL
    if _MODEL is not None:
        return _MODEL
    with _LOCK:
        if _MODEL is None:
            _MODEL = _load_model()
    return _MODEL


def fetch_image_bytes(image_url):
    if not image_url:
        raise ValueError("Ảnh không có đường dẫn.")
    uploads_root = os.path.abspath(os.path.join(current_app.root_path, "..", "uploads", "photos"))
    marker = "/uploads/photos/"
    if marker in image_url:
        filename = image_url.split(marker, 1)[1]
        local_path = os.path.join(uploads_root, filename.replace("/", os.sep))
        if os.path.isfile(local_path):
            with open(local_path, "rb") as handle:
                return handle.read()
    response = requests.get(image_url, timeout=30)
    response.raise_for_status()
    return response.content


def _healthy_result():
    entry = get_disease("Rice__Healthy")
    return {
        "class": entry["code"],
        "nameVi": entry["nameVi"],
        "confidence": 0.0,
        "boxes": [],
        "solution": solution_payload(entry["code"]),
    }


def infer_image_bytes(content, conf_threshold=None):
    if conf_threshold is None:
        conf_threshold = float(current_app.config.get("RICE_LEAF_CONF_THRESHOLD") or 0.5)
    from PIL import Image

    model = get_model()
    image = Image.open(io.BytesIO(content)).convert("RGB")
    results = model.predict(image, imgsz=640, conf=conf_threshold, device="cpu", verbose=False)
    result = results[0]
    boxes_out = []
    best = None
    names = result.names or {}
    if result.boxes is not None:
        for box in result.boxes:
            class_id = int(box.cls[0])
            confidence = float(box.conf[0])
            if confidence < conf_threshold:
                continue
            if isinstance(names, dict):
                raw_name = names.get(class_id) or names.get(str(class_id)) or str(class_id)
            elif isinstance(names, (list, tuple)) and 0 <= class_id < len(names):
                raw_name = names[class_id]
            else:
                raw_name = str(class_id)
            entry = _normalize_class(raw_name, class_id)
            code = entry["code"] if entry else str(raw_name)
            name_vi = entry["nameVi"] if entry else str(raw_name)
            xyxy = [float(v) for v in box.xyxy[0].tolist()]
            item = {
                "class": code,
                "nameVi": name_vi,
                "confidence": confidence,
                "xyxy": xyxy,
            }
            boxes_out.append(item)
            if best is None or confidence > best["confidence"]:
                best = item
    if best is None:
        payload = _healthy_result()
        payload["boxes"] = boxes_out
        return payload
    return {
        "class": best["class"],
        "nameVi": best["nameVi"],
        "confidence": best["confidence"],
        "boxes": boxes_out,
        "solution": solution_payload(best["class"]) or solution_payload(best["nameVi"]),
    }


def infer_image_url(image_url):
    return infer_image_bytes(fetch_image_bytes(image_url))
