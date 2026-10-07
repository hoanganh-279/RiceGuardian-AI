"""Clip BLB predictions to a percent polygon and paint disease onto the photo."""

from io import BytesIO

import numpy as np
from PIL import Image

from core.services.blb_uav_inference import clip_mask_to_outline, paint_disease


def _png_bytes(array):
    buf = BytesIO()
    Image.fromarray(array, mode="RGB").save(buf, format="PNG")
    return buf.getvalue()


def test_clip_mask_keeps_inside_and_unlabels_outside():
    mask = np.full((20, 20), 4, dtype=np.uint8)
    mask[2:6, 2:6] = 3
    mask[14:18, 14:18] = 2
    # Square covering the top-left quarter, including the high-severity patch.
    clipped = clip_mask_to_outline(mask, "0,0 50,0 50,50 0,50")
    assert clipped[4, 4] == 3
    assert clipped[16, 16] == 0
    assert clipped[0, 19] == 0
    assert clipped[10, 4] == 4


def test_paint_disease_leaves_pixels_outside_polygon():
    original = np.zeros((20, 20, 3), dtype=np.uint8)
    original[..., 1] = 40
    mask = np.zeros((20, 20), dtype=np.uint8)
    mask[4, 4] = 3
    mask[16, 16] = 3
    mask[16, 4] = 2
    inside = clip_mask_to_outline(np.ones_like(mask), "0,0 50,0 50,50 0,50") > 0
    painted = np.asarray(
        Image.open(BytesIO(paint_disease(_png_bytes(original), mask, inside=inside)))
    )
    assert tuple(painted[4, 4]) == (255, 0, 0)
    assert tuple(painted[16, 16]) == (0, 40, 0)
    assert tuple(painted[16, 4]) == (0, 40, 0)


def test_paint_disease_colors_only_disease_pixels():
    original = np.zeros((8, 8, 3), dtype=np.uint8)
    original[..., 1] = 80
    original[1, 1] = (10, 20, 30)
    mask = np.zeros((8, 8), dtype=np.uint8)
    mask[0, 0] = 3
    mask[0, 1] = 2
    mask[1, 1] = 4

    painted = np.asarray(Image.open(BytesIO(paint_disease(_png_bytes(original), mask))))
    assert tuple(painted[0, 0]) == (255, 0, 0)
    assert tuple(painted[0, 1]) == (255, 255, 0)
    assert tuple(painted[1, 1]) == (10, 20, 30)
    assert tuple(painted[2, 2]) == (0, 80, 0)
