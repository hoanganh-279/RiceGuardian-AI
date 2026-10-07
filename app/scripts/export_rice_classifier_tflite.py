#!/usr/bin/env python3
"""Export DenseNet rice classifier (.keras) to TFLite for the Flutter farmer app.

Usage (from repo root):
  py -3 app/scripts/export_rice_classifier_tflite.py

Requires: tensorflow / keras able to load the .keras file.

Output:
  app/assets/models/rice_classifier.tflite
  app/assets/classifier_labels.txt

Input contract (baked into the graph):
  float32 NHWC [1, 224, 224, 3] in [0, 1] (RGB), then ImageNet torch normalize.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parents[1]
WEIGHTS = APP_ROOT / "model_rice_leaf_v2" / "classifier_best.keras"
OUT_DIR = APP_ROOT / "assets" / "models"
OUT_NAME = "rice_classifier.tflite"
LABELS_OUT = APP_ROOT / "assets" / "classifier_labels.txt"
IMGSZ = 224

# 8 disease classes = YOLO order minus Healthy (index 2 in det_data.yaml / labels.txt).
DEFAULT_LABELS_VI = [
    "Bạc lá",
    "Đốm nâu",
    "Hispa",
    "Đạo ôn lá",
    "Cháy lá",
    "Than lá",
    "Đốm nâu hẹp",
    "Đạo ôn cổ bông",
]

# ImageNet torch normalize (keras.applications.densenet.preprocess_input mode).
_IMAGENET_MEAN = (0.485, 0.456, 0.406)
_IMAGENET_STD = (0.229, 0.224, 0.225)


def _categorical_focal_loss_stub():
    """Minimal stub so keras.load_model can deserialize compile_config."""
    import keras

    @keras.saving.register_keras_serializable(package="Custom", name="CategoricalFocalLoss")
    class CategoricalFocalLoss(keras.losses.Loss):
        def __init__(self, name="categorical_focal_loss", reduction="sum_over_batch_size", **kwargs):
            super().__init__(name=name, reduction=reduction, **kwargs)

        def call(self, y_true, y_pred):
            y_pred = keras.ops.clip(y_pred, 1e-7, 1.0 - 1e-7)
            return keras.ops.mean(
                -y_true * keras.ops.log(y_pred),
                axis=-1,
            )

        def get_config(self):
            return super().get_config()

    return CategoricalFocalLoss


def _load_classifier(path: Path):
    import keras

    Focal = _categorical_focal_loss_stub()
    try:
        return keras.models.load_model(
            path,
            custom_objects={"CategoricalFocalLoss": Focal},
            compile=False,
            safe_mode=False,
        )
    except Exception as first:
        # Fallback: load without custom loss registration via compile=False only.
        print(f"load_model first attempt: {first}", file=sys.stderr)
        return keras.models.load_model(path, compile=False, safe_mode=False)


def _wrap_for_01_input(base_model):
    """Wrap so TFLite expects RGB float in [0,1]; apply ImageNet torch normalize."""
    import keras
    from keras import layers

    inp = keras.Input(shape=(IMGSZ, IMGSZ, 3), dtype="float32", name="image_01")
    # x in [0,1] → ImageNet normalize
    mean = keras.ops.convert_to_tensor(_IMAGENET_MEAN, dtype="float32")
    std = keras.ops.convert_to_tensor(_IMAGENET_STD, dtype="float32")
    x = (inp - mean) / std
    out = base_model(x)
    return keras.Model(inp, out, name="rice_classifier_01")


def _write_labels(path: Path, labels: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(labels) + "\n", encoding="utf-8")


def main() -> int:
    if not WEIGHTS.is_file():
        print(f"Missing weights: {WEIGHTS}", file=sys.stderr)
        return 1

    try:
        import tensorflow as tf
        import keras
    except ImportError:
        print(
            "Missing tensorflow/keras. Install in your Python env first.",
            file=sys.stderr,
        )
        return 1

    print(f"keras {keras.__version__}  tensorflow {tf.__version__}")
    print(f"Loading {WEIGHTS} ...")
    base = _load_classifier(WEIGHTS)
    print(f"Base inputs={base.inputs} outputs={base.outputs}")
    out_shape = base.output_shape
    print(f"output_shape={out_shape}")

    n_classes = int(out_shape[-1]) if out_shape and out_shape[-1] else 8
    labels = list(DEFAULT_LABELS_VI)
    if len(labels) != n_classes:
        print(
            f"Warning: DEFAULT_LABELS_VI has {len(labels)} entries but model has {n_classes} classes",
            file=sys.stderr,
        )
        if len(labels) > n_classes:
            labels = labels[:n_classes]
        else:
            labels = labels + [f"class_{i}" for i in range(len(labels), n_classes)]

    wrapped = _wrap_for_01_input(base)
    wrapped.trainable = False

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    dest = OUT_DIR / OUT_NAME

    print("Converting to TFLite float32 ...")
    converter = tf.lite.TFLiteConverter.from_keras_model(wrapped)
    converter.optimizations = []
    converter.target_spec.supported_types = [tf.float32]
    tflite_model = converter.convert()
    dest.write_bytes(tflite_model)
    size_mb = dest.stat().st_size / (1024 * 1024)
    print(f"Wrote {dest} ({size_mb:.1f} MB)")

    _write_labels(LABELS_OUT, labels)
    print(f"Wrote {LABELS_OUT} ({len(labels)} labels)")

    # Quick interpreter smoke check
    interpreter = tf.lite.Interpreter(model_path=str(dest))
    interpreter.allocate_tensors()
    inn = interpreter.get_input_details()[0]
    out = interpreter.get_output_details()[0]
    print(f"TFLite input:  name={inn['name']} shape={inn['shape']} dtype={inn['dtype']}")
    print(f"TFLite output: name={out['name']} shape={out['shape']} dtype={out['dtype']}")

    meta = {
        "source": str(WEIGHTS.name),
        "imgsz": IMGSZ,
        "input_range": "[0,1] RGB + ImageNet torch normalize (baked)",
        "num_classes": n_classes,
        "labels_vi": labels,
        "label_order_note": "YOLO disease order excluding Healthy; edit classifier_labels.txt if training order differs",
    }
    meta_path = OUT_DIR / "rice_classifier_export_meta.json"
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {meta_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
