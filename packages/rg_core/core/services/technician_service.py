"""Technician photo list, rescan, review, and alerts."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import false
from sqlalchemy.orm import joinedload

from core.data.disease_catalog import names_match
from core.extensions import db
from core.models import Alert, Field, Notification, Photo
from core.services.disease_plan_service import list_disease_plans, solution_with_extras
from core.services.rice_leaf_inference import infer_image_url


def _utcnow():
    return datetime.now(timezone.utc)


def _parse_uuid(value):
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError, AttributeError):
        return None


def resolve_org_ids(user, requested):
    requested_ids = [_parse_uuid(item) for item in (requested or [])]
    requested_ids = [item for item in requested_ids if item]
    if user.role == "admin":
        return requested_ids or None
    allowed = {org.id for org in user.organizations}
    if not requested_ids:
        return list(allowed)
    return [oid for oid in requested_ids if oid in allowed]


def _photo_query(org_ids):
    query = Photo.query.options(
        joinedload(Photo.field).joinedload(Field.organization),
        joinedload(Photo.farmer),
    ).join(Field, Photo.field_id == Field.id)
    if org_ids is not None:
        if not org_ids:
            return query.filter(false())
        query = query.filter(Field.org_id.in_(org_ids))
    return query


def to_technician_photo(photo):
    data = photo.to_public()
    field = photo.field
    org = field.organization if field else None
    data.update(
        {
            "orgId": str(field.org_id) if field else "",
            "orgName": org.name if org else "",
            "farmerName": photo.farmer.full_name if photo.farmer else "",
            "solution": solution_with_extras(photo.rescan_class or photo.rescan_disease),
            "match": names_match(photo.disease, photo.rescan_disease or photo.rescan_class),
        }
    )
    return data


def list_photos(user, org_ids, reviewed=None, page=1, limit=20):
    scoped = resolve_org_ids(user, org_ids)
    query = _photo_query(scoped).order_by(Photo.captured_at.desc())
    if reviewed is True:
        query = query.filter(Photo.reviewed.is_(True))
    elif reviewed is False:
        query = query.filter(Photo.reviewed.is_(False))
    total = query.count()
    rows = query.offset((page - 1) * limit).limit(limit).all()
    return {
        "items": [to_technician_photo(row) for row in rows],
        "page": page,
        "limit": limit,
        "total": total,
    }


def get_photo_for_user(user, photo_id):
    scoped = resolve_org_ids(user, None)
    return _photo_query(scoped).filter(Photo.id == photo_id).first()


def rescan_photo(user, photo_id):
    photo = get_photo_for_user(user, photo_id)
    if not photo:
        return None
    result = infer_image_url(photo.image_url)
    photo.rescan_class = result["class"]
    photo.rescan_disease = result["nameVi"]
    photo.rescan_confidence = result["confidence"]
    photo.rescan_at = _utcnow()
    db.session.commit()
    payload = to_technician_photo(photo)
    payload["boxes"] = result.get("boxes") or []
    if result.get("class"):
        payload["solution"] = solution_with_extras(result["class"]) or result.get("solution")
    else:
        payload["solution"] = result.get("solution") or payload.get("solution")
    return payload


def review_photo(user, photo_id):
    photo = get_photo_for_user(user, photo_id)
    if not photo:
        return None
    photo.reviewed = True
    db.session.commit()
    return to_technician_photo(photo)


_RISK_ORDER = {"high": 0, "medium": 1, "low": 2}


def _alert_query(org_ids):
    query = Alert.query.options(
        joinedload(Alert.field).joinedload(Field.organization),
        joinedload(Alert.photo).joinedload(Photo.farmer),
    ).join(Field, Alert.field_id == Field.id)
    if org_ids is not None:
        if not org_ids:
            return query.filter(false())
        query = query.filter(Field.org_id.in_(org_ids))
    return query


def to_technician_alert(alert):
    data = alert.to_public()
    field = alert.field
    org = field.organization if field else None
    farmer = alert.photo.farmer if alert.photo else None
    photo = alert.photo
    suggested = None
    if photo:
        suggested = solution_with_extras(
            photo.rescan_class or photo.rescan_disease or photo.disease
        )
    data.update(
        {
            "orgId": str(field.org_id) if field else "",
            "orgName": org.name if org else "",
            "farmerName": farmer.full_name if farmer else "",
            "feedbackReason": alert.feedback_reason,
            "photoName": None,
            "suggestedDisease": photo.disease if photo else "",
            "suggestedSolution": suggested,
            "photoDisease": photo.disease if photo else "",
            "rescanDisease": (photo.rescan_disease or "") if photo else "",
        }
    )
    return data


def list_alerts(user, org_ids, alert_type=None, status=None, page=1, limit=20):
    scoped = resolve_org_ids(user, org_ids)
    query = _alert_query(scoped)
    if alert_type:
        query = query.filter(Alert.type == alert_type)
    if status:
        query = query.filter(Alert.status == status)
    rows = query.all()
    rows.sort(
        key=lambda row: (
            _RISK_ORDER.get(row.risk_level, 9),
            -(row.created_at.timestamp() if row.created_at else 0),
        )
    )
    total = len(rows)
    start = (page - 1) * limit
    page_rows = rows[start : start + limit]
    return {
        "items": [to_technician_alert(row) for row in page_rows],
        "page": page,
        "limit": limit,
        "total": total,
    }


def _format_treatment_body(title, actions):
    lines = [f"Phương án điều trị: {title}"]
    for idx, action in enumerate(actions or [], start=1):
        lines.append(f"{idx}. {action}")
    return "\n".join(lines)


def submit_alert_feedback(
    user,
    alert_id,
    status,
    reason=None,
    photo_name=None,
    disease_code=None,
    actions=None,
):
    if status not in ("confirmed", "incorrect", "watch"):
        raise ValueError("Trạng thái phản hồi không hợp lệ.")
    if status == "incorrect" and not str(reason or "").strip():
        raise ValueError("Cần nhập lý do khi chọn Sai.")

    treatment = None
    selected_actions = None
    scoped = resolve_org_ids(user, None)
    alert = _alert_query(scoped).filter(Alert.id == alert_id).first()
    if not alert:
        return None

    needs_treatment = status == "confirmed" and (
        alert.type == "image" or alert.photo_id is not None
    )
    if needs_treatment:
        if not disease_code:
            raise ValueError("Cần chọn phương án điều trị (mã bệnh) khi xác nhận.")
        treatment = solution_with_extras(disease_code)
        if not treatment:
            raise ValueError("Không tìm thấy phương án điều trị cho bệnh đã chọn.")
        if actions is not None:
            selected_actions = [str(a).strip() for a in actions if str(a).strip()]
            if not selected_actions:
                raise ValueError("Cần chọn ít nhất một bước điều trị.")
        else:
            selected_actions = list(treatment["actions"])

    alert.status = status
    alert.feedback_reason = (
        str(reason).strip() if status == "incorrect" else (reason or None)
    )

    notif = None
    farmer_id = None
    if needs_treatment and treatment:
        alert.treatment_disease_code = treatment["code"]
        alert.treatment_title = treatment["nameVi"]
        alert.treatment_actions = selected_actions
        alert.treated_by = user.id
        alert.treated_at = _utcnow()
        if alert.photo_id and alert.photo:
            alert.photo.reviewed = True
            farmer_id = alert.photo.farmer_id
        if farmer_id:
            notif = Notification(
                user_id=farmer_id,
                type="treatment",
                title=f"Phương án điều trị: {treatment['nameVi']}",
                body=_format_treatment_body(treatment["nameVi"], selected_actions),
                related_alert_id=alert.id,
            )
            db.session.add(notif)
    elif status in ("incorrect", "watch"):
        alert.treatment_disease_code = None
        alert.treatment_title = None
        alert.treatment_actions = None
        alert.treated_by = user.id
        alert.treated_at = _utcnow()
    elif status == "confirmed":
        alert.treated_by = user.id
        alert.treated_at = _utcnow()

    db.session.commit()
    payload = to_technician_alert(alert)
    payload["feedbackReason"] = alert.feedback_reason
    payload["photoName"] = photo_name or None
    if notif and farmer_id:
        payload["notificationId"] = str(notif.id)
        payload["farmerId"] = str(farmer_id)
    return payload


def get_disease_plans_for_staff():
    return {"items": list_disease_plans(include_healthy=True)}
