import uuid

from flask import Blueprint, g, jsonify, request

from core.services.article_service import (
    ArticleError,
    create_question,
    get_my_question,
    get_published_article,
    list_my_questions,
    list_published_articles,
)
from core.services.farmer_service import (
    create_field_log,
    create_photo,
    dashboard_payload,
    get_field_detail,
    get_or_create_settings,
    latest_sensor_for_field,
    list_alerts,
    list_field_logs,
    list_fields,
    list_notifications,
    list_photos,
    map_features,
    mark_notification_read,
)
from core.services.storage_service import upload_photo_file
from core.utils.farmer_decorators import require_farmer

farmer_bp = Blueprint("farmer", __name__, url_prefix="/api/farmer")


def _page_limit():
    page = max(1, int(request.args.get("page", 1)))
    limit = min(100, max(1, int(request.args.get("limit", 20))))
    return page, limit


def _article_err(err):
    return jsonify({"error": err.message}), err.status


@farmer_bp.get("/articles")
@require_farmer
def articles_list_route():
    page, limit = _page_limit()
    return jsonify(
        list_published_articles(
            page=page,
            limit=limit,
            category=request.args.get("category", ""),
            q=request.args.get("q", ""),
        )
    )


@farmer_bp.get("/articles/<article_id>")
@require_farmer
def article_detail_route(article_id):
    try:
        return jsonify(get_published_article(article_id))
    except ArticleError as err:
        return _article_err(err)


@farmer_bp.post("/articles/<article_id>/questions")
@require_farmer
def article_ask_route(article_id):
    data = request.get_json(silent=True) or {}
    try:
        return jsonify(create_question(g.user, article_id, data.get("body", ""))), 201
    except ArticleError as err:
        return _article_err(err)


@farmer_bp.get("/article-questions/me")
@require_farmer
def my_questions_route():
    page, limit = _page_limit()
    return jsonify(
        list_my_questions(
            g.user,
            page=page,
            limit=limit,
            status=request.args.get("status", ""),
        )
    )


@farmer_bp.get("/article-questions/<question_id>")
@require_farmer
def my_question_detail_route(question_id):
    try:
        return jsonify(get_my_question(g.user, question_id))
    except ArticleError as err:
        return _article_err(err)


@farmer_bp.get("/dashboard")
@require_farmer
def dashboard_route():
    return jsonify(dashboard_payload(g.user))


@farmer_bp.get("/fields")
@require_farmer
def fields_list_route():
    page, limit = _page_limit()
    return jsonify(list_fields(g.user, page, limit))


@farmer_bp.get("/fields/map")
@require_farmer
def fields_map_route():
    return jsonify(map_features(g.user))


@farmer_bp.get("/fields/<field_id>")
@require_farmer
def field_detail_route(field_id):
    detail = get_field_detail(g.user, uuid.UUID(field_id))
    if not detail:
        return jsonify({"error": "Không tìm thấy thửa ruộng."}), 404
    return jsonify(detail)


@farmer_bp.get("/photos")
@require_farmer
def photos_list_route():
    page, limit = _page_limit()
    return jsonify(list_photos(g.user, page, limit))


@farmer_bp.post("/photos")
@require_farmer
def photos_upload_route():
    if "image" not in request.files:
        return jsonify({"error": "Thiếu file ảnh."}), 400
    field_id = request.form.get("fieldId")
    if not field_id:
        return jsonify({"error": "Thiếu fieldId."}), 400
    try:
        image_url = upload_photo_file(request.files["image"], g.user.id)
        disease = request.form.get("disease")
        confidence_raw = request.form.get("confidence")
        confidence = float(confidence_raw) if confidence_raw else None
        lat = float(request.form.get("lat")) if request.form.get("lat") else None
        lng = float(request.form.get("lng")) if request.form.get("lng") else None
        result = create_photo(
            g.user,
            uuid.UUID(field_id),
            image_url,
            disease,
            confidence,
            lat,
            lng,
        )
        if result.get("alertId"):
            from core.realtime import emit_farmer_event

            emit_farmer_event(g.user.id, "alert:new", {"fieldId": field_id})
            emit_farmer_event(g.user.id, "notification:new", {})
        return jsonify(result), 201
    except ValueError as err:
        return jsonify({"error": str(err)}), 400
    except Exception as err:
        return jsonify({"error": f"Không thể lưu ảnh: {err}"}), 500


@farmer_bp.get("/alerts")
@require_farmer
def alerts_list_route():
    page, limit = _page_limit()
    return jsonify(list_alerts(g.user, page, limit))


@farmer_bp.get("/stations/<field_id>/latest")
@require_farmer
def sensor_latest_route(field_id):
    data = latest_sensor_for_field(g.user, uuid.UUID(field_id))
    if data is None:
        return jsonify({"error": "Không tìm thấy thửa ruộng."}), 404
    return jsonify(data)


@farmer_bp.get("/field-logs")
@require_farmer
def field_logs_list_route():
    field_id = request.args.get("fieldId")
    if not field_id:
        return jsonify({"error": "Thiếu fieldId."}), 400
    page, limit = _page_limit()
    return jsonify(list_field_logs(g.user, uuid.UUID(field_id), page, limit))


@farmer_bp.post("/field-logs")
@require_farmer
def field_logs_create_route():
    data = request.get_json(silent=True) or {}
    field_id = data.get("fieldId")
    log_type = data.get("type")
    if not field_id or not log_type:
        return jsonify({"error": "Thiếu fieldId hoặc type."}), 400
    try:
        result = create_field_log(
            g.user,
            uuid.UUID(field_id),
            log_type,
            data.get("title"),
            data.get("note"),
            data.get("loggedAt"),
        )
        return jsonify(result), 201
    except ValueError as err:
        return jsonify({"error": str(err)}), 400


@farmer_bp.get("/notifications")
@require_farmer
def notifications_list_route():
    page, limit = _page_limit()
    return jsonify(list_notifications(g.user, page, limit))


@farmer_bp.patch("/notifications/<notification_id>/read")
@require_farmer
def notification_read_route(notification_id):
    result = mark_notification_read(g.user, notification_id)
    if not result:
        return jsonify({"error": "Không tìm thấy thông báo."}), 404
    return jsonify(result)


@farmer_bp.get("/settings")
@require_farmer
def settings_get_route():
    settings = get_or_create_settings(g.user.id)
    return jsonify(settings.to_public())


@farmer_bp.patch("/settings")
@require_farmer
def settings_patch_route():
    data = request.get_json(silent=True) or {}
    settings = get_or_create_settings(g.user.id)
    if "language" in data:
        settings.language = data["language"]
    if "notificationsEnabled" in data:
        settings.notifications_enabled = bool(data["notificationsEnabled"])
    from core.extensions import db

    db.session.commit()
    return jsonify(settings.to_public())
