"""Farmer-scoped business logic for mobile app APIs."""

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import desc, func

from core.extensions import db
from core.models import (
    Alert,
    FarmerField,
    Field,
    FieldLog,
    IotStation,
    Notification,
    Photo,
    Season,
    SensorReading,
    UserSettings,
)

RISK_ORDER = {"high": 0, "medium": 1, "low": 2, "watch": 3}

THRESHOLDS = {
    "tempC": {"min": 22, "max": 34},
    "humidityPct": {"min": 60, "max": 90},
    "waterCm": {"min": 3, "max": 12},
}


def _utcnow():
    return datetime.now(timezone.utc)


def _field_ids_for_farmer(farmer_id):
    rows = FarmerField.query.filter_by(farmer_id=farmer_id).all()
    return [row.field_id for row in rows]


def _current_season(field_id):
    return (
        Season.query.filter_by(field_id=field_id, status="active")
        .order_by(desc(Season.start_date))
        .first()
    )


def get_or_create_settings(user_id):
    settings = db.session.get(UserSettings, user_id)
    if not settings:
        settings = UserSettings(user_id=user_id)
        db.session.add(settings)
        db.session.commit()
    return settings


def dashboard_payload(farmer):
    field_ids = _field_ids_for_farmer(farmer.id)
    field_count = len(field_ids)
    latest_alerts = []
    if field_ids:
        latest_alerts = (
            Alert.query.filter(Alert.field_id.in_(field_ids))
            .order_by(desc(Alert.created_at))
            .limit(3)
            .all()
        )
    unread = Notification.query.filter_by(user_id=farmer.id, read_at=None).count()
    return {
        "fieldCount": field_count,
        "latestAlerts": [a.to_public() for a in latest_alerts],
        "unreadNotifications": unread,
    }


def list_fields(farmer, page=1, limit=20):
    field_ids = _field_ids_for_farmer(farmer.id)
    query = Field.query.filter(Field.id.in_(field_ids)).order_by(Field.name)
    total = query.count()
    rows = query.offset((page - 1) * limit).limit(limit).all()
    items = []
    for field in rows:
        season = _current_season(field.id)
        items.append(field.to_list_item(season.name if season else None))
    return {"items": items, "page": page, "limit": limit, "total": total}


def get_field_detail(farmer, field_id):
    link = FarmerField.query.filter_by(farmer_id=farmer.id, field_id=field_id).first()
    if not link:
        return None
    field = db.session.get(Field, field_id)
    if not field:
        return None
    season = _current_season(field.id)
    return field.to_detail(season)


def map_features(farmer):
    field_ids = _field_ids_for_farmer(farmer.id)
    fields = Field.query.filter(Field.id.in_(field_ids)).all()
    features = []
    for field in fields:
        if field.lat is None or field.lng is None:
            continue
        features.append(
            {
                "type": "Feature",
                "properties": {"id": str(field.id), "name": field.name},
                "geometry": field.boundary_geojson
                or {"type": "Point", "coordinates": [field.lng, field.lat]},
            }
        )
    return {"type": "FeatureCollection", "features": features}


def list_photos(farmer, page=1, limit=20):
    query = Photo.query.filter_by(farmer_id=farmer.id).order_by(desc(Photo.captured_at))
    total = query.count()
    rows = query.offset((page - 1) * limit).limit(limit).all()
    return {
        "items": [p.to_public() for p in rows],
        "page": page,
        "limit": limit,
        "total": total,
    }


def create_photo(farmer, field_id, image_url, disease, confidence, lat, lng):
    link = FarmerField.query.filter_by(farmer_id=farmer.id, field_id=field_id).first()
    if not link:
        raise ValueError("Thửa ruộng không thuộc quyền quản lý của bạn.")

    photo = Photo(
        field_id=field_id,
        farmer_id=farmer.id,
        image_url=image_url,
        disease=disease,
        confidence=confidence,
        lat=lat,
        lng=lng,
    )
    db.session.add(photo)
    db.session.flush()

    alert = None
    if disease and disease != "Khỏe mạnh" and confidence and confidence >= 0.5:
        alert = Alert(
            field_id=field_id,
            photo_id=photo.id,
            type="image",
            risk_level="high" if confidence >= 0.75 else "medium",
            title=f"Phát hiện: {disease}",
            summary=f"Ảnh chụp từ app, độ tin cậy {int(confidence * 100)}%.",
            source="app",
            confidence=confidence,
        )
        db.session.add(alert)
        db.session.flush()
        notif = Notification(
            user_id=farmer.id,
            type="alert",
            title=alert.title,
            body=alert.summary,
            related_alert_id=alert.id,
        )
        db.session.add(notif)

    db.session.commit()
    result = photo.to_public()
    if alert:
        result["alertId"] = str(alert.id)
    return result


def list_alerts(farmer, page=1, limit=20):
    field_ids = _field_ids_for_farmer(farmer.id)
    if not field_ids:
        return {"items": [], "page": page, "limit": limit, "total": 0}
    rows = Alert.query.filter(Alert.field_id.in_(field_ids)).all()
    rows.sort(
        key=lambda a: (
            RISK_ORDER.get(a.risk_level, 9),
            -a.created_at.timestamp(),
        )
    )
    total = len(rows)
    start = (page - 1) * limit
    page_rows = rows[start : start + limit]
    return {
        "items": [a.to_public() for a in page_rows],
        "page": page,
        "limit": limit,
        "total": total,
    }


def _friendly_sensor_text(reading):
    hints = []
    if reading.temperature is not None:
        if reading.temperature > THRESHOLDS["tempC"]["max"]:
            hints.append("Nhiệt độ đang cao hơn bình thường")
        elif reading.temperature < THRESHOLDS["tempC"]["min"]:
            hints.append("Nhiệt độ đang thấp hơn bình thường")
        else:
            hints.append("Nhiệt độ trong ngưỡng an toàn")
    if reading.humidity is not None:
        if reading.humidity > THRESHOLDS["humidityPct"]["max"]:
            hints.append("Độ ẩm đang cao — tăng nguy cơ bệnh")
        elif reading.humidity < THRESHOLDS["humidityPct"]["min"]:
            hints.append("Độ ẩm thấp — cần theo dõi tưới nước")
        else:
            hints.append("Độ ẩm ổn định")
    if reading.water_level is not None:
        if reading.water_level < THRESHOLDS["waterCm"]["min"]:
            hints.append("Mực nước thấp — nên bơm/tưới thêm")
        elif reading.water_level > THRESHOLDS["waterCm"]["max"]:
            hints.append("Mực nước cao — theo dõi thoát nước")
        else:
            hints.append("Mực nước phù hợp giai đoạn canh tác")
    return hints


def latest_sensor_for_field(farmer, field_id):
    link = FarmerField.query.filter_by(farmer_id=farmer.id, field_id=field_id).first()
    if not link:
        return None
    station = IotStation.query.filter_by(field_id=field_id).first()
    if not station:
        return {"station": None, "reading": None, "hints": [], "thresholds": THRESHOLDS}
    reading = (
        SensorReading.query.filter_by(station_id=station.id)
        .order_by(desc(SensorReading.recorded_at))
        .first()
    )
    payload = reading.to_public() if reading else None
    hints = _friendly_sensor_text(reading) if reading else []
    return {
        "station": station.to_public(),
        "reading": payload,
        "hints": hints,
        "thresholds": THRESHOLDS,
    }


def list_field_logs(farmer, field_id, page=1, limit=20):
    link = FarmerField.query.filter_by(farmer_id=farmer.id, field_id=field_id).first()
    if not link:
        return {"items": [], "page": page, "limit": limit, "total": 0}
    query = FieldLog.query.filter_by(field_id=field_id).order_by(desc(FieldLog.logged_at))
    total = query.count()
    rows = query.offset((page - 1) * limit).limit(limit).all()
    return {
        "items": [r.to_public() for r in rows],
        "page": page,
        "limit": limit,
        "total": total,
    }


def create_field_log(farmer, field_id, log_type, title, note, logged_at=None):
    link = FarmerField.query.filter_by(farmer_id=farmer.id, field_id=field_id).first()
    if not link:
        raise ValueError("Thửa ruộng không thuộc quyền quản lý của bạn.")
    season = _current_season(field_id)
    when = logged_at or _utcnow()
    if isinstance(when, str):
        when = datetime.fromisoformat(when.replace("Z", "+00:00"))
    row = FieldLog(
        field_id=field_id,
        season_id=season.id if season else None,
        farmer_id=farmer.id,
        type=log_type,
        title=title or log_type,
        note=note,
        logged_at=when,
    )
    db.session.add(row)
    db.session.commit()
    return row.to_public()


def list_notifications(farmer, page=1, limit=20):
    query = Notification.query.filter_by(user_id=farmer.id).order_by(desc(Notification.created_at))
    total = query.count()
    rows = query.offset((page - 1) * limit).limit(limit).all()
    return {
        "items": [n.to_public() for n in rows],
        "page": page,
        "limit": limit,
        "total": total,
    }


def mark_notification_read(farmer, notification_id):
    notif = db.session.get(Notification, uuid.UUID(str(notification_id)))
    if not notif or notif.user_id != farmer.id:
        return None
    if not notif.read_at:
        notif.read_at = _utcnow()
        db.session.commit()
    return notif.to_public()
