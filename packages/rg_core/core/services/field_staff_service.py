"""Staff field board and cover image persistence."""

import json
import os
import uuid

from flask import current_app
from sqlalchemy import false
from sqlalchemy.orm import joinedload

from core.extensions import db
from core.models import Alert, FarmerField, Field
from core.services.blb_uav_inference import (
    ModelNotAvailable,
    crop_ms6,
    encode_ms6_tiff,
    infer_ms_bytes,
    is_tiff,
    preview_bands,
    read_ms6_bytes,
    render_preview_png,
)
from core.services.storage_service import (
    RISK_ORDER,
    resolve_upload_bytes,
    upload_bytes,
)

_COVER_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tif", ".tiff"}
_MS_EXTS = {".tif", ".tiff"}
_RASTER_ONLY_WARNING = "Ảnh JPG/PNG chỉ lưu làm ảnh bìa; phân tích BLB cần TIFF 6 kênh."
_NO_MS_MESSAGE = "Chưa có TIFF đa phổ 6 kênh cho thửa này."
from core.services.technician_service import resolve_org_ids


def _parse_uuid(value):
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError, AttributeError):
        return None


def _field_query(org_ids):
    query = Field.query.options(joinedload(Field.organization))
    if org_ids is not None:
        if not org_ids:
            return query.filter(false())
        query = query.filter(Field.org_id.in_(org_ids))
    return query


def _farmers_by_field(field_ids):
    if not field_ids:
        return {}
    links = (
        FarmerField.query.options(joinedload(FarmerField.farmer))
        .filter(FarmerField.field_id.in_(field_ids))
        .all()
    )
    grouped = {}
    for link in links:
        farmer = link.farmer
        if not farmer:
            continue
        grouped.setdefault(link.field_id, []).append(
            {
                "id": str(farmer.id),
                "fullName": farmer.full_name,
                "phone": farmer.phone or "",
                "appAccount": farmer.role == "farmer",
            }
        )
    return grouped


def _risk_by_field(field_ids):
    if not field_ids:
        return {}
    rows = Alert.query.filter(Alert.field_id.in_(field_ids)).all()
    best = {}
    for alert in rows:
        current = best.get(alert.field_id)
        incoming = (RISK_ORDER.get(alert.risk_level, 9), alert.created_at)
        if current is None or incoming < current[:2]:
            best[alert.field_id] = (incoming[0], incoming[1], alert.risk_level, alert.type)
    return {fid: {"riskLevel": row[2], "riskType": row[3]} for fid, row in best.items()}


def _station_payload(station, org_id):
    if not station:
        return None
    return {
        "id": str(station.id),
        "code": station.code,
        "name": station.name or station.code,
        "fieldId": str(station.field_id),
        "orgId": str(org_id),
        "status": station.status,
        "online": station.status == "online",
        "batteryPct": station.battery_pct,
        "issue": None if station.status == "online" else "Mất kết nối",
    }


def to_staff_field(field, farmers=None, risk_map=None):
    farmers = farmers if farmers is not None else []
    org = field.organization
    station = field.stations.first()
    risk = (risk_map or {}).get(field.id) or {}
    risk_level = risk.get("riskLevel") or "low"
    risk_type = risk.get("riskType") or "environment"

    with_app = [row for row in farmers if row.get("appAccount")]
    source = with_app or farmers
    farmer_label = ", ".join(row["fullName"] for row in source) if source else "Chưa gắn hộ"

    data = field.to_list_item()
    data.update(
        {
            "orgName": org.name if org else "",
            "farmers": farmers,
            "farmerLabel": farmer_label,
            "station": _station_payload(station, field.org_id),
            "riskLevel": risk_level,
            "riskType": risk_type,
        }
    )
    return data


def get_field_for_staff(user, field_id):
    uid = _parse_uuid(field_id)
    if not uid:
        return None
    scoped = resolve_org_ids(user, None)
    field = _field_query(scoped).filter(Field.id == uid).first()
    if not field:
        return None
    farmers = _farmers_by_field([field.id]).get(field.id, [])
    risk_map = _risk_by_field([field.id])
    return to_staff_field(field, farmers, risk_map)


def list_fields_board(user, org_ids):
    scoped = resolve_org_ids(user, org_ids)
    fields = _field_query(scoped).order_by(Field.name).all()
    ids = [row.id for row in fields]
    farmers_map = _farmers_by_field(ids)
    risk_map = _risk_by_field(ids)
    items = [to_staff_field(row, farmers_map.get(row.id, []), risk_map) for row in fields]
    items.sort(key=lambda row: (RISK_ORDER.get(row.get("riskLevel"), 9), row.get("name") or ""))
    return {"items": items}


def _assert_cover_file(file_storage):
    if not file_storage:
        raise ValueError("Thiếu file ảnh.")
    name = (file_storage.filename or "").lower()
    content_type = (file_storage.content_type or "").lower()
    ext = os.path.splitext(name)[1]
    if content_type.startswith("image/") or ext in _COVER_EXTS:
        return file_storage
    raise ValueError("Chọn tệp ảnh (TIFF đa phổ 6 kênh, hoặc JPG/PNG làm ảnh bìa).")


def _cover_ext(hint, content_type):
    ext = os.path.splitext(hint or "")[1].lower()
    if ext in _COVER_EXTS:
        return ext
    ctype = (content_type or "").lower()
    if "png" in ctype:
        return ".png"
    if "webp" in ctype:
        return ".webp"
    if "gif" in ctype:
        return ".gif"
    if "bmp" in ctype:
        return ".bmp"
    if "tif" in ctype or "tiff" in ctype:
        return ".tif"
    return ".jpg"


def _normalize_cover_source(field, source):
    if source is None:
        existing = (field.cover_source or "upload").strip().lower()
        return existing if existing in ("upload", "uav") else "upload"
    normalized = str(source).strip().lower()
    if normalized not in ("upload", "uav"):
        raise ValueError("Nguồn ảnh phải là upload hoặc uav.")
    return normalized


def _clear_blb(field):
    field.blb_mask_url = None
    field.blb_disease_pct = None
    field.blb_stats = None
    field.blb_inferred_at = None


def _with_warning(payload, warning):
    if not payload or not warning:
        return payload
    data = dict(payload)
    data["blbWarning"] = warning
    return data


def _outline_points(field):
    outline = field.cover_outline or {}
    if isinstance(outline, str):
        return outline.strip() or None
    points = str(outline.get("points") or "").strip()
    return points or None


def _infer_cover(field, ms_content, preview_png, outline_points=None):
    try:
        result = infer_ms_bytes(ms_content, preview_png, outline_points=outline_points)
    except ModelNotAvailable as err:
        return err.message
    except ValueError as err:
        return str(err)
    except Exception:
        current_app.logger.exception("BLB infer failed for field %s", field.id)
        return "Không phân tích được ảnh BLB. Ảnh bìa đã lưu — có thể chạy lại sau."
    _apply_blb_result(field, result)
    return None


def _store_ms_cover(field, chw6, file_name):
    ms_content = encode_ms6_tiff(chw6)
    preview_png = render_preview_png(chw6, preview_bands())
    field.cover_ms_url = upload_bytes(
        ms_content,
        f"fields/{field.id}/ms",
        filename_hint="cover-ms.tif",
        content_type="image/tiff",
        allowed_exts=_MS_EXTS,
    )
    field.cover_ms_file_name = file_name
    field.cover_image_url = upload_bytes(
        preview_png,
        f"fields/{field.id}",
        filename_hint="cover-preview.png",
        content_type="image/png",
        allowed_exts={".png"},
    )
    field.cover_file_name = file_name
    return ms_content, preview_png


def _load_ms_inputs(field):
    if not field.cover_ms_url:
        raise ValueError(_NO_MS_MESSAGE)
    if not field.cover_image_url:
        raise ValueError("Chưa có ảnh xem trước cho TIFF đa phổ.")
    return resolve_upload_bytes(field.cover_ms_url), resolve_upload_bytes(field.cover_image_url)


def _parse_crop_rect(rect):
    if rect is None:
        return None
    if isinstance(rect, str):
        text = rect.strip()
        if not text:
            return None
        try:
            rect = json.loads(text)
        except ValueError as err:
            raise ValueError("Vùng cắt không hợp lệ.") from err
    if not isinstance(rect, dict):
        raise ValueError("Vùng cắt không hợp lệ.")
    return rect


def set_field_cover(user, field_id, file_storage, filename_hint=None, source=None):
    uid = _parse_uuid(field_id)
    if not uid:
        return None
    scoped = resolve_org_ids(user, None)
    field = _field_query(scoped).filter(Field.id == uid).first()
    if not field:
        return None
    image = _assert_cover_file(file_storage)
    cover_source = _normalize_cover_source(field, source)
    hint = filename_hint or image.filename or "cover.jpg"
    content = image.read()
    if not content:
        raise ValueError("Tệp ảnh trống.")
    if hasattr(image, "seek"):
        try:
            image.seek(0)
        except (OSError, AttributeError):
            pass
    field.cover_outline = None
    field.cover_source = cover_source
    _clear_blb(field)
    if is_tiff(content):
        chw6 = read_ms6_bytes(content)
        ms_content, preview_png = _store_ms_cover(field, chw6, hint)
        warning = _infer_cover(field, ms_content, preview_png)
    else:
        _store_raster_cover(field, content, hint, getattr(image, "content_type", None))
        warning = _RASTER_ONLY_WARNING
    db.session.commit()
    return _with_warning(get_field_for_staff(user, field.id), warning)


def _store_raster_cover(field, content, hint, content_type):
    ext = _cover_ext(hint, content_type)
    field.cover_image_url = upload_bytes(
        content,
        f"fields/{field.id}",
        filename_hint=f"cover{ext}",
        content_type=content_type or "image/jpeg",
        allowed_exts=_COVER_EXTS,
    )
    field.cover_file_name = hint
    field.cover_ms_url = None
    field.cover_ms_file_name = None


def crop_field_cover(user, field_id, file_storage, rect=None, filename_hint=None):
    """Crop replaces the cover and clears outline/BLB; inference waits for a new outline."""
    uid = _parse_uuid(field_id)
    if not uid:
        return None
    scoped = resolve_org_ids(user, None)
    field = _field_query(scoped).filter(Field.id == uid).first()
    if not field:
        return None
    crop_rect = _parse_crop_rect(rect)
    if field.cover_ms_url:
        if crop_rect is None:
            raise ValueError("Thiếu vùng cắt cho TIFF đa phổ.")
        chw6 = read_ms6_bytes(resolve_upload_bytes(field.cover_ms_url))
        cropped = crop_ms6(chw6, crop_rect)
        _store_ms_cover(field, cropped, field.cover_ms_file_name or "cover-ms.tif")
    else:
        image = _assert_cover_file(file_storage)
        content = image.read()
        if not content:
            raise ValueError("Tệp ảnh trống.")
        hint = filename_hint or image.filename or "crop-cover.jpg"
        _store_raster_cover(field, content, hint, getattr(image, "content_type", None))
    field.cover_outline = None
    _clear_blb(field)
    db.session.commit()
    return get_field_for_staff(user, field.id)


def set_field_cover_outline(user, field_id, points):
    uid = _parse_uuid(field_id)
    if not uid:
        return None
    scoped = resolve_org_ids(user, None)
    field = _field_query(scoped).filter(Field.id == uid).first()
    if not field:
        return None
    vertex_count = len(str(points or "").strip().split())
    if vertex_count < 3:
        raise ValueError("Vẽ ít nhất 3 đỉnh rồi đóng ranh giới.")
    stored = str(points).strip()
    field.cover_outline = {"points": stored}
    _clear_blb(field)
    warning = None
    if not field.cover_ms_url:
        warning = _NO_MS_MESSAGE
    else:
        try:
            ms_content, preview_png = _load_ms_inputs(field)
        except ValueError as err:
            warning = str(err)
        except Exception:
            current_app.logger.exception("Cannot read MS cover for field %s", field.id)
            warning = "Không đọc được TIFF đa phổ để phân tích."
        else:
            warning = _infer_cover(field, ms_content, preview_png, outline_points=stored)
    db.session.commit()
    return _with_warning(get_field_for_staff(user, field.id), warning)


def _apply_blb_result(field, result):
    mask_url = upload_bytes(
        result["maskPng"],
        f"fields/{field.id}/blb-mask",
        filename_hint="blb-mask.png",
        content_type="image/png",
        allowed_exts={".png"},
    )
    field.blb_mask_url = mask_url
    field.blb_disease_pct = float(result["diseasePct"])
    field.blb_stats = result["stats"]
    field.blb_inferred_at = result["inferredAt"]
    return field


def rerun_field_blb_segment(user, field_id):
    uid = _parse_uuid(field_id)
    if not uid:
        return None
    scoped = resolve_org_ids(user, None)
    field = _field_query(scoped).filter(Field.id == uid).first()
    if not field:
        return None
    ms_content, preview_png = _load_ms_inputs(field)
    result = infer_ms_bytes(ms_content, preview_png, outline_points=_outline_points(field))
    _apply_blb_result(field, result)
    db.session.commit()
    return get_field_for_staff(user, field.id)
