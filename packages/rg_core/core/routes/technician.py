import uuid

from flask import Blueprint, g, jsonify, request

from core.services.blb_uav_inference import ModelNotAvailable as BlbModelNotAvailable
from core.services.field_staff_service import (
    crop_field_cover,
    get_field_for_staff,
    list_fields_board,
    rerun_field_blb_segment,
    set_field_cover,
    set_field_cover_outline,
)
from core.services.rice_leaf_inference import ModelNotAvailable
from core.services.disease_plan_service import append_disease_actions
from core.services.technician_service import (
    get_disease_plans_for_staff,
    list_alerts,
    list_photos,
    rescan_photo,
    review_photo,
    submit_alert_feedback,
)
from core.utils.staff_decorators import require_admin, require_staff, require_technician

technician_bp = Blueprint("technician", __name__, url_prefix="/api/technician")


def _page_limit():
    page = max(1, int(request.args.get("page", 1)))
    limit = min(100, max(1, int(request.args.get("limit", 20))))
    return page, limit


def _org_ids():
    values = request.args.getlist("orgId")
    if not values:
        raw = request.args.get("orgIds", "")
        values = [item.strip() for item in raw.split(",") if item.strip()]
    return values


def _reviewed_filter():
    raw = request.args.get("reviewed")
    if raw is None or raw == "":
        return None
    return str(raw).lower() in ("1", "true", "yes")


@technician_bp.get("/fields")
@require_staff
def fields_board_route():
    return jsonify(list_fields_board(g.user, _org_ids()))


@technician_bp.get("/fields/<field_id>")
@require_staff
def field_detail_route(field_id):
    result = get_field_for_staff(g.user, field_id)
    if not result:
        return jsonify({"error": "Không tìm thấy thửa."}), 404
    return jsonify(result)


@technician_bp.post("/fields/<field_id>/cover")
@require_technician
def field_cover_upload_route(field_id):
    if "image" not in request.files:
        return jsonify({"error": "Thiếu file ảnh."}), 400
    source = (request.form.get("source") or "upload").strip().lower()
    try:
        result = set_field_cover(g.user, field_id, request.files["image"], source=source)
    except BlbModelNotAvailable as err:
        return jsonify({"error": err.message}), err.status
    except ValueError as err:
        return jsonify({"error": str(err)}), 400
    except Exception as err:
        return jsonify({"error": f"Không thể lưu ảnh: {err}"}), 500
    if not result:
        return jsonify({"error": "Không tìm thấy thửa."}), 404
    return jsonify(result)


@technician_bp.post("/fields/<field_id>/cover/crop")
@require_technician
def field_cover_crop_route(field_id):
    if "image" not in request.files:
        return jsonify({"error": "Không có vùng cắt."}), 400
    image = request.files["image"]
    hint = image.filename or "crop-cover.jpg"
    if not str(hint).startswith("crop-"):
        hint = f"crop-{hint}"
    try:
        result = crop_field_cover(
            g.user, field_id, image, rect=request.form.get("rect"), filename_hint=hint
        )
    except BlbModelNotAvailable as err:
        return jsonify({"error": err.message}), err.status
    except ValueError as err:
        return jsonify({"error": str(err)}), 400
    except Exception as err:
        return jsonify({"error": f"Không thể lưu ảnh: {err}"}), 500
    if not result:
        return jsonify({"error": "Không tìm thấy thửa."}), 404
    return jsonify(result)


@technician_bp.put("/fields/<field_id>/cover/outline")
@require_technician
def field_cover_outline_route(field_id):
    data = request.get_json(silent=True) or {}
    try:
        result = set_field_cover_outline(g.user, field_id, data.get("points"))
    except ValueError as err:
        return jsonify({"error": str(err)}), 400
    if not result:
        return jsonify({"error": "Không tìm thấy thửa."}), 404
    return jsonify(result)


@technician_bp.post("/fields/<field_id>/blb-segment")
@require_technician
def field_blb_segment_route(field_id):
    try:
        result = rerun_field_blb_segment(g.user, field_id)
    except BlbModelNotAvailable as err:
        return jsonify({"error": err.message}), err.status
    except ValueError as err:
        return jsonify({"error": str(err)}), 400
    except Exception as err:
        return jsonify({"error": f"Không thể phân tích BLB: {err}"}), 500
    if not result:
        return jsonify({"error": "Không tìm thấy thửa."}), 404
    return jsonify(result)


@technician_bp.get("/alerts")
@require_technician
def alerts_list_route():
    page, limit = _page_limit()
    return jsonify(
        list_alerts(
            g.user,
            _org_ids(),
            alert_type=request.args.get("type") or None,
            status=request.args.get("status") or None,
            page=page,
            limit=limit,
        )
    )


@technician_bp.post("/alerts/<alert_id>/feedback")
@require_technician
def alerts_feedback_route(alert_id):
    try:
        uid = uuid.UUID(alert_id)
    except ValueError:
        return jsonify({"error": "Không tìm thấy cảnh báo."}), 404
    data = request.get_json(silent=True) or {}
    try:
        result = submit_alert_feedback(
            g.user,
            uid,
            data.get("status"),
            reason=data.get("reason"),
            photo_name=data.get("photoName"),
            disease_code=data.get("diseaseCode"),
            actions=data.get("actions"),
        )
    except ValueError as err:
        return jsonify({"error": str(err)}), 400
    if not result:
        return jsonify({"error": "Không tìm thấy cảnh báo."}), 404
    farmer_id = result.pop("farmerId", None)
    if farmer_id and result.get("notificationId"):
        from core.realtime import emit_farmer_event

        emit_farmer_event(uuid.UUID(farmer_id), "notification:new", {})
    return jsonify(result)


@technician_bp.get("/disease-plans")
@require_staff
def disease_plans_list_route():
    return jsonify(get_disease_plans_for_staff())


@technician_bp.post("/disease-plans/actions")
@require_admin
def disease_plans_append_route():
    data = request.get_json(silent=True) or {}
    updates = data.get("updates") or {}
    if not isinstance(updates, dict):
        return jsonify({"error": "Payload updates không hợp lệ."}), 400
    result = append_disease_actions(updates, user=g.user)
    return jsonify(result)


@technician_bp.get("/photos")
@require_technician
def photos_list_route():
    page, limit = _page_limit()
    return jsonify(
        list_photos(
            g.user,
            _org_ids(),
            reviewed=_reviewed_filter(),
            page=page,
            limit=limit,
        )
    )


@technician_bp.post("/photos/<photo_id>/rescan")
@require_technician
def photos_rescan_route(photo_id):
    try:
        uid = uuid.UUID(photo_id)
    except ValueError:
        return jsonify({"error": "Không tìm thấy ảnh."}), 404
    try:
        result = rescan_photo(g.user, uid)
    except ModelNotAvailable as err:
        return jsonify({"error": err.message}), err.status
    except ValueError as err:
        return jsonify({"error": str(err)}), 400
    if not result:
        return jsonify({"error": "Không tìm thấy ảnh."}), 404
    return jsonify(result)


@technician_bp.post("/photos/<photo_id>/review")
@require_technician
def photos_review_route(photo_id):
    try:
        uid = uuid.UUID(photo_id)
    except ValueError:
        return jsonify({"error": "Không tìm thấy ảnh."}), 404
    result = review_photo(g.user, uid)
    if not result:
        return jsonify({"error": "Không tìm thấy ảnh."}), 404
    return jsonify(result)
