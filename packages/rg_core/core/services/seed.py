"""Seed demo users and farmer business data for RiceGuardian."""

import uuid
from datetime import date, datetime, timezone

from core.extensions import db
from core.models import (
    Alert,
    Article,
    FarmerField,
    Field,
    IotStation,
    Notification,
    Organization,
    Photo,
    Season,
    SensorReading,
    User,
    UserOrganization,
    UserSettings,
)
from core.services.auth_service import hash_password
from core.services import supabase_auth

DEMO_PASSWORD = "123456@"

ORG_AG = uuid.UUID("11111111-1111-4111-8111-111111111001")
ORG_MK = uuid.UUID("11111111-1111-4111-8111-111111111002")
ORG_DT = uuid.UUID("11111111-1111-4111-8111-111111111003")

USR_ADMIN = uuid.UUID("22222222-2222-4222-8222-222222222001")
USR_MANAGER = uuid.UUID("22222222-2222-4222-8222-222222222002")
USR_KTV = uuid.UUID("22222222-2222-4222-8222-222222222003")
USR_FARMER = uuid.UUID("22222222-2222-4222-8222-222222222004")
USR_FARMER_UT = uuid.UUID("22222222-2222-4222-8222-222222222005")
USR_FARMER_HUNG = uuid.UUID("22222222-2222-4222-8222-222222222006")
USR_FARMER_TAM = uuid.UUID("22222222-2222-4222-8222-222222222007")

FLD_AG_01 = uuid.UUID("33333333-3333-4333-8333-333333333001")
FLD_DT_02 = uuid.UUID("33333333-3333-4333-8333-333333333002")
FLD_DT_01 = uuid.UUID("33333333-3333-4333-8333-333333333003")
FLD_MK_12 = uuid.UUID("33333333-3333-4333-8333-333333333004")

PHOTO_DT_01 = uuid.UUID("44444444-4444-4444-8444-444444444001")
PHOTO_AG_04 = uuid.UUID("44444444-4444-4444-8444-444444444002")
PHOTO_DT_04 = uuid.UUID("44444444-4444-4444-8444-444444444003")
PHOTO_MK_01 = uuid.UUID("44444444-4444-4444-8444-444444444004")

ALERT_IMG_DT_01 = uuid.UUID("55555555-5555-4555-8555-555555555001")
ALERT_IMG_AG_04 = uuid.UUID("55555555-5555-4555-8555-555555555002")
ALERT_IMG_DT_04 = uuid.UUID("55555555-5555-4555-8555-555555555003")
ALERT_IMG_MK_01 = uuid.UUID("55555555-5555-4555-8555-555555555004")

ART_DEMO_01 = uuid.UUID("66666666-6666-4666-8666-666666666001")
ART_DEMO_02 = uuid.UUID("66666666-6666-4666-8666-666666666002")

_RICE_IMG = "https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?auto=format&fit=crop&w=800&q=80"
_LEAF_IMG = "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=800&q=80"
_FIELD_IMG = "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80"
_PANICLE_IMG = "https://images.unsplash.com/photo-1598514983318-2f64f8f4796c?auto=format&fit=crop&w=800&q=80"


def _demo_password_hash():
    """SQLite demo DBs may still enforce NOT NULL on password_hash."""
    return hash_password(DEMO_PASSWORD)


def _parse_demo_dt(value):
    return datetime.fromisoformat(value)


def _sync_auth_user(user, password=DEMO_PASSWORD):
    if not supabase_auth.configured():
        return
    supabase_auth.ensure_user(
        user_id=user.id,
        email=user.email,
        password=password,
        full_name=user.full_name,
        role=user.role,
        phone=user.phone,
    )
    user.password_hash = None


def seed_demo_data():
    if db.session.get(User, USR_ADMIN):
        return False

    use_auth = supabase_auth.configured()
    password_hash = None if use_auth else hash_password(DEMO_PASSWORD)
    orgs = [
        Organization(id=ORG_AG, name="HTX Lúa Vàng An Giang"),
        Organization(id=ORG_MK, name="Doanh nghiệp Gạo Mekong"),
        Organization(id=ORG_DT, name="HTX Phước Thành Đồng Tháp"),
    ]
    users = [
        User(
            id=USR_ADMIN,
            email="admin@riceguardian.vn",
            phone="0901000001",
            full_name="Nguyễn Minh Trí",
            role="admin",
            password_hash=password_hash,
            password_display=DEMO_PASSWORD,
        ),
        User(
            id=USR_MANAGER,
            email="manager@gmail.vn",
            phone="0901000002",
            full_name="Trần Thị Hồng",
            role="manager",
            password_hash=password_hash,
            password_display=DEMO_PASSWORD,
        ),
        User(
            id=USR_KTV,
            email="ktv@gmail.vn",
            phone="0901000003",
            full_name="Lê Văn Khoa",
            role="technician",
            password_hash=password_hash,
            password_display=DEMO_PASSWORD,
        ),
        User(
            id=USR_FARMER,
            email="farmer@demo.vn",
            phone="0901234567",
            full_name="Phạm Văn Đạt",
            role="farmer",
            password_hash=password_hash,
            password_display=DEMO_PASSWORD,
        ),
    ]
    links = [
        UserOrganization(user_id=USR_MANAGER, org_id=ORG_MK),
        UserOrganization(user_id=USR_KTV, org_id=ORG_AG),
        UserOrganization(user_id=USR_KTV, org_id=ORG_DT),
        UserOrganization(user_id=USR_FARMER, org_id=ORG_DT),
    ]

    fields = [
        Field(
            id=FLD_AG_01,
            org_id=ORG_AG,
            name="Thửa A1 — kênh 7",
            area_ha=1.6,
            variety="OM 18",
            lat=10.389,
            lng=105.432,
        ),
        Field(
            id=FLD_DT_02,
            org_id=ORG_DT,
            name="Thửa P3 — bờ tây",
            area_ha=2.1,
            variety="Đài Thơm 8",
            lat=10.512,
            lng=105.631,
        ),
        Field(
            id=FLD_DT_01,
            org_id=ORG_DT,
            name="Thửa P1 — giồng cát",
            area_ha=1.8,
            variety="OM 5451",
            lat=10.498,
            lng=105.612,
        ),
    ]

    farmer_links = [
        FarmerField(farmer_id=USR_FARMER, field_id=FLD_DT_02),
        FarmerField(farmer_id=USR_FARMER, field_id=FLD_DT_01),
    ]

    seasons = [
        Season(
            field_id=FLD_DT_02,
            name="Vụ Hè Thu 2026",
            start_date=date(2026, 6, 1),
            status="active",
        ),
        Season(
            field_id=FLD_DT_01,
            name="Vụ Hè Thu 2026",
            start_date=date(2026, 6, 1),
            status="active",
        ),
    ]

    stations = [
        IotStation(id=uuid.uuid4(), field_id=FLD_DT_02, code="DT-02", status="online", battery_pct=88),
        IotStation(id=uuid.uuid4(), field_id=FLD_DT_01, code="DT-01", status="online", battery_pct=72),
    ]

    now = datetime.now(timezone.utc)
    readings = [
        SensorReading(
            station_id=stations[0].id,
            temperature=28.5,
            humidity=92.0,
            water_level=4.2,
            recorded_at=now,
        ),
        SensorReading(
            station_id=stations[1].id,
            temperature=27.0,
            humidity=78.0,
            water_level=6.5,
            recorded_at=now,
        ),
    ]

    alerts = [
        Alert(
            field_id=FLD_DT_02,
            type="environment",
            risk_level="high",
            title="Ẩm lá kéo dài — nguy cơ đạo ôn",
            summary="Nhiệt độ đêm 22–24°C, ẩm lá > 90% trong 18 giờ.",
            source="iot",
            status="open",
        ),
        Alert(
            field_id=FLD_DT_01,
            type="environment",
            risk_level="medium",
            title="Mực nước thấp hơn ngưỡng đẻ nhánh",
            summary="Cảm biến trạm DT-01: mực nước 2.1 cm trong 6 giờ liên tục.",
            source="iot",
            status="open",
        ),
    ]

    db.session.add_all(orgs)
    db.session.add_all(users)
    db.session.add_all(links)
    db.session.add_all(fields)
    db.session.add_all(farmer_links)
    db.session.add_all(seasons)
    db.session.add_all(stations)
    db.session.add_all(readings)
    db.session.add_all(alerts)
    db.session.flush()

    notifications = [
        Notification(
            user_id=USR_FARMER,
            type="alert",
            title=alerts[0].title,
            body=alerts[0].summary,
            related_alert_id=alerts[0].id,
        ),
        Notification(
            user_id=USR_FARMER,
            type="info",
            title="HTX Phước Thành nhắc lịch phun thuốc",
            body="Tuần này theo dõi sâu cuốn lá non tại khu vực giồng cát.",
        ),
    ]

    settings = UserSettings(user_id=USR_FARMER)

    db.session.add_all(notifications)
    db.session.add(settings)
    db.session.flush()

    now = datetime.now(timezone.utc)
    db.session.add_all(
        [
            Article(
                id=ART_DEMO_01,
                title="Cách nhận biết sớm cháy lá khi ẩm cao",
                summary="Hướng dẫn ngắn khi độ ẩm kéo dài — khi nào nên chụp ảnh kiểm bệnh.",
                body=(
                    "Khi ẩm không khí cao kéo dài nhiều ngày, lá lúa dễ phát sinh đốm bệnh.\n\n"
                    "Nên quan sát mặt dưới lá vào buổi sáng, tránh ngược sáng khi chụp ảnh.\n"
                    "Nếu App cảnh báo nguy cơ môi trường, hãy kiểm tra thực địa và chụp ảnh rõ nét gửi kỹ thuật viên."
                ),
                cover_url=_LEAF_IMG,
                category="ky_thuat",
                status="published",
                author_id=USR_ADMIN,
                published_at=now,
                reviewed_by_id=USR_ADMIN,
                reviewed_at=now,
            ),
            Article(
                id=ART_DEMO_02,
                title="Cập nhật lịch bảo trì trạm IoT tuần này",
                summary="Kiểm tra pin/năng lượng mặt trời và cảm biến gió tại các thửa demo.",
                body=(
                    "Kỹ thuật viên sẽ rà soát trạm giám sát tại các thửa demo.\n"
                    "Nông dân không cần thao tác gì trên App; dữ liệu cảm biến có thể gián đoạn ngắn trong lúc bảo trì."
                ),
                cover_url=_FIELD_IMG,
                category="he_thong",
                status="published",
                author_id=USR_KTV,
                published_at=now,
                reviewed_by_id=USR_ADMIN,
                reviewed_at=now,
            ),
        ]
    )

    if use_auth:
        for user in users:
            try:
                _sync_auth_user(user)
                if db.engine.dialect.name == "sqlite":
                    user.password_hash = _demo_password_hash()
            except Exception:
                user.password_hash = hash_password(DEMO_PASSWORD)
    db.session.commit()
    return True


def _ensure_farmer(*, user_id, email, phone, full_name, org_id, field_ids, use_auth):
    user = db.session.get(User, user_id)
    created = False
    if not user:
        user = User(
            id=user_id,
            email=email,
            phone=phone,
            full_name=full_name,
            role="farmer",
            password_hash=_demo_password_hash(),
            password_display=DEMO_PASSWORD,
            status="active",
        )
        db.session.add(user)
        created = True
    if not UserOrganization.query.filter_by(user_id=user_id, org_id=org_id).first():
        db.session.add(UserOrganization(user_id=user_id, org_id=org_id))
    for field_id in field_ids:
        if not FarmerField.query.filter_by(farmer_id=user_id, field_id=field_id).first():
            db.session.add(FarmerField(farmer_id=user_id, field_id=field_id))
    if not db.session.get(UserSettings, user_id) and not UserSettings.query.filter_by(user_id=user_id).first():
        db.session.add(UserSettings(user_id=user_id))
    db.session.flush()
    if created and use_auth:
        try:
            _sync_auth_user(user)
            if db.engine.dialect.name == "sqlite":
                user.password_hash = _demo_password_hash()
        except Exception:
            user.password_hash = _demo_password_hash()
    return user


def ensure_demo_customer_data():
    """Idempotent: extra demo farmers, M12 field, photos + image alerts for admin menus."""
    if not db.session.get(Organization, ORG_DT):
        return False

    use_auth = supabase_auth.configured()
    changed = False

    if not db.session.get(Field, FLD_MK_12):
        db.session.add(
            Field(
                id=FLD_MK_12,
                org_id=ORG_MK,
                name="Thửa M12 — cụm 2",
                area_ha=2.4,
                variety="OM 5451",
                lat=10.045,
                lng=105.778,
            )
        )
        changed = True
        db.session.flush()

    if not Season.query.filter_by(field_id=FLD_MK_12, name="Vụ Hè Thu 2026").first():
        db.session.add(
            Season(
                field_id=FLD_MK_12,
                name="Vụ Hè Thu 2026",
                start_date=date(2026, 6, 1),
                status="active",
            )
        )
        changed = True

    # Ensure Đạt stays linked to P3/P1 (seed already does this on fresh DB).
    for field_id in (FLD_DT_02, FLD_DT_01):
        if (
            db.session.get(User, USR_FARMER)
            and not FarmerField.query.filter_by(farmer_id=USR_FARMER, field_id=field_id).first()
        ):
            db.session.add(FarmerField(farmer_id=USR_FARMER, field_id=field_id))
            changed = True

    farmers = [
        dict(
            user_id=USR_FARMER_UT,
            email="farmer.ut@demo.vn",
            phone="0902000101",
            full_name="Nguyễn Thị Út",
            org_id=ORG_AG,
            field_ids=[FLD_AG_01],
        ),
        dict(
            user_id=USR_FARMER_HUNG,
            email="farmer.hung@demo.vn",
            phone="0902000301",
            full_name="Trần Văn Hùng",
            org_id=ORG_MK,
            field_ids=[FLD_MK_12],
        ),
        dict(
            user_id=USR_FARMER_TAM,
            email="farmer.tam@demo.vn",
            phone="0902000203",
            full_name="Lê Minh Tâm",
            org_id=ORG_DT,
            field_ids=[FLD_DT_01],
        ),
    ]
    for spec in farmers:
        before = db.session.get(User, spec["user_id"])
        _ensure_farmer(**spec, use_auth=use_auth)
        if not before:
            changed = True

    demo_photos = [
        dict(
            id=PHOTO_DT_01,
            field_id=FLD_DT_02,
            farmer_id=USR_FARMER,
            image_url=_RICE_IMG,
            disease="Bạc lá",
            confidence=0.86,
            lat=10.512,
            lng=105.631,
            captured_at=_parse_demo_dt("2026-08-18T06:42:00+07:00"),
            reviewed=False,
            alert_id=ALERT_IMG_DT_01,
            alert_title="Nhận diện bạc lá từ ảnh nông dân",
            alert_summary="Ảnh gửi lúc 06:42, GPS khớp thửa P3. AI đề xuất Xanthomonas oryzae.",
            alert_status="open",
            risk_level="high",
        ),
        dict(
            id=PHOTO_AG_04,
            field_id=FLD_AG_01,
            farmer_id=USR_FARMER_UT,
            image_url=_LEAF_IMG,
            disease="Đốm nâu",
            confidence=0.72,
            lat=10.389,
            lng=105.432,
            captured_at=_parse_demo_dt("2026-08-16T18:12:00+07:00"),
            reviewed=False,
            alert_id=ALERT_IMG_AG_04,
            alert_title="Ảnh nghi khô vằn — cần xác nhận",
            alert_summary="Nông dân chụp bẹ lá gần mặt nước. Mô hình đề xuất Rhizoctonia solani.",
            alert_status="open",
            risk_level="medium",
        ),
        dict(
            id=PHOTO_DT_04,
            field_id=FLD_DT_01,
            farmer_id=USR_FARMER_TAM,
            image_url=_FIELD_IMG,
            disease="Đạo ôn lá",
            confidence=0.41,
            lat=10.498,
            lng=105.612,
            captured_at=_parse_demo_dt("2026-08-15T11:48:00+07:00"),
            reviewed=True,
            rescan_disease="Đốm nâu",
            rescan_class="Rice__BrownSpot",
            rescan_confidence=0.68,
            rescan_at=_parse_demo_dt("2026-08-15T12:10:00+07:00"),
            alert_id=ALERT_IMG_DT_04,
            alert_title="Ảnh lá vàng — có thể thiếu dinh dưỡng",
            alert_summary="AI đề xuất bệnh nhưng mẫu thiếu tương phản. Cần phản hồi chuyên gia.",
            alert_status="incorrect",
            risk_level="low",
        ),
        dict(
            id=PHOTO_MK_01,
            field_id=FLD_MK_12,
            farmer_id=USR_FARMER_HUNG,
            image_url=_PANICLE_IMG,
            disease="Đạo ôn cổ bông",
            confidence=0.79,
            lat=10.045,
            lng=105.778,
            captured_at=_parse_demo_dt("2026-08-17T13:50:00+07:00"),
            reviewed=False,
            alert_id=ALERT_IMG_MK_01,
            alert_title="Nhận diện đạo ôn cổ bông từ ảnh nông dân",
            alert_summary="Ảnh gửi lúc 13:50, cụm 2 có dấu hiệu lép bất thường.",
            alert_status="open",
            risk_level="high",
        ),
    ]

    for row in demo_photos:
        if db.session.get(Photo, row["id"]):
            continue
        if not db.session.get(User, row["farmer_id"]) or not db.session.get(Field, row["field_id"]):
            continue
        photo = Photo(
            id=row["id"],
            field_id=row["field_id"],
            farmer_id=row["farmer_id"],
            image_url=row["image_url"],
            disease=row["disease"],
            confidence=row["confidence"],
            lat=row["lat"],
            lng=row["lng"],
            captured_at=row["captured_at"],
            reviewed=row["reviewed"],
            rescan_disease=row.get("rescan_disease"),
            rescan_class=row.get("rescan_class"),
            rescan_confidence=row.get("rescan_confidence"),
            rescan_at=row.get("rescan_at"),
        )
        db.session.add(photo)
        db.session.flush()
        if not db.session.get(Alert, row["alert_id"]):
            db.session.add(
                Alert(
                    id=row["alert_id"],
                    field_id=row["field_id"],
                    photo_id=photo.id,
                    type="image",
                    risk_level=row["risk_level"],
                    title=row["alert_title"],
                    summary=row["alert_summary"],
                    source="app",
                    confidence=row["confidence"],
                    status=row["alert_status"],
                    created_at=row["captured_at"],
                )
            )
        changed = True

    if not db.session.get(Article, ART_DEMO_01):
        now = datetime.now(timezone.utc)
        db.session.add(
            Article(
                id=ART_DEMO_01,
                title="Cách nhận biết sớm cháy lá khi ẩm cao",
                summary="Hướng dẫn ngắn khi độ ẩm kéo dài — khi nào nên chụp ảnh kiểm bệnh.",
                body=(
                    "Khi ẩm không khí cao kéo dài nhiều ngày, lá lúa dễ phát sinh đốm bệnh.\n\n"
                    "Nên quan sát mặt dưới lá vào buổi sáng, tránh ngược sáng khi chụp ảnh."
                ),
                cover_url=_LEAF_IMG,
                category="ky_thuat",
                status="published",
                author_id=USR_ADMIN,
                published_at=now,
                reviewed_by_id=USR_ADMIN,
                reviewed_at=now,
            )
        )
        changed = True
    if not db.session.get(Article, ART_DEMO_02):
        now = datetime.now(timezone.utc)
        db.session.add(
            Article(
                id=ART_DEMO_02,
                title="Cập nhật lịch bảo trì trạm IoT tuần này",
                summary="Kiểm tra pin/năng lượng mặt trời và cảm biến gió tại các thửa demo.",
                body="Kỹ thuật viên sẽ rà soát trạm giám sát tại các thửa demo.",
                cover_url=_FIELD_IMG,
                category="he_thong",
                status="published",
                author_id=USR_KTV,
                published_at=now,
                reviewed_by_id=USR_ADMIN,
                reviewed_at=now,
            )
        )
        changed = True

    if changed:
        db.session.commit()
    return changed
