"""Add columns that create_all does not ALTER on existing tables."""

from sqlalchemy import inspect, text

from core.extensions import db

COLUMNS = (
    ("rescan_disease", "VARCHAR"),
    ("rescan_class", "VARCHAR"),
    ("rescan_confidence", "FLOAT"),
    ("rescan_at", "TIMESTAMP"),
)

FIELD_COVER_COLUMNS = (
    ("cover_image_url", "VARCHAR"),
    ("cover_file_name", "VARCHAR"),
    ("cover_outline", "TEXT"),
    ("cover_source", "VARCHAR"),
)

FIELD_BLB_COLUMNS = (
    ("cover_ms_url", "VARCHAR"),
    ("cover_ms_file_name", "VARCHAR"),
    ("blb_mask_url", "VARCHAR"),
    ("blb_disease_pct", "FLOAT"),
    ("blb_stats", "TEXT"),
    ("blb_inferred_at", "TIMESTAMP"),
)


def _add_missing_columns(table_name, columns, pg_types):
    inspector = inspect(db.engine)
    if table_name not in inspector.get_table_names():
        return
    existing = {col["name"] for col in inspector.get_columns(table_name)}
    dialect = db.engine.dialect.name
    missing = [item for item in columns if item[0] not in existing]
    if not missing:
        return

    with db.engine.begin() as conn:
        for name, sqlite_type in missing:
            col_type = pg_types[name] if dialect == "postgresql" else sqlite_type
            if dialect == "postgresql":
                conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {name} {col_type}"))
            else:
                conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {name} {col_type}"))


def ensure_photo_rescan_columns():
    _add_missing_columns(
        "photos",
        COLUMNS,
        {
            "rescan_disease": "VARCHAR",
            "rescan_class": "VARCHAR",
            "rescan_confidence": "DOUBLE PRECISION",
            "rescan_at": "TIMESTAMPTZ",
        },
    )


def ensure_field_cover_columns():
    _add_missing_columns(
        "fields",
        FIELD_COVER_COLUMNS,
        {
            "cover_image_url": "VARCHAR",
            "cover_file_name": "VARCHAR",
            "cover_outline": "JSONB",
            "cover_source": "VARCHAR",
        },
    )


def ensure_field_blb_columns():
    _add_missing_columns(
        "fields",
        FIELD_BLB_COLUMNS,
        {
            "cover_ms_url": "VARCHAR",
            "cover_ms_file_name": "VARCHAR",
            "blb_mask_url": "VARCHAR",
            "blb_disease_pct": "DOUBLE PRECISION",
            "blb_stats": "JSONB",
            "blb_inferred_at": "TIMESTAMPTZ",
        },
    )


def ensure_users_password_nullable():
    inspector = inspect(db.engine)
    if "users" not in inspector.get_table_names():
        return
    if db.engine.dialect.name != "postgresql":
        return
    with db.engine.begin() as conn:
        conn.execute(text("ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL"))


def ensure_users_password_display_column():
    """Admin-visible last password for user management UI."""
    _add_missing_columns(
        "users",
        (("password_display", "VARCHAR"),),
        {"password_display": "VARCHAR"},
    )
    inspector = inspect(db.engine)
    if "users" not in inspector.get_table_names():
        return
    try:
        inspector.clear_cache()
    except Exception:
        pass
    existing = {col["name"] for col in inspect(db.engine).get_columns("users")}
    if "password_display" not in existing:
        return
    with db.engine.begin() as conn:
        conn.execute(
            text(
                "UPDATE users SET password_display = :pwd "
                "WHERE password_display IS NULL OR TRIM(password_display) = ''"
            ),
            {"pwd": "123456@"},
        )


def ensure_farmer_role_allowed():
    """Widen users_role_check to include farmer (Supabase seed may omit it)."""
    inspector = inspect(db.engine)
    if "users" not in inspector.get_table_names():
        return
    if db.engine.dialect.name != "postgresql":
        return
    with db.engine.begin() as conn:
        conn.execute(text("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check"))
        conn.execute(
            text(
                "ALTER TABLE users ADD CONSTRAINT users_role_check "
                "CHECK (role = ANY (ARRAY['admin'::text, 'manager'::text, "
                "'technician'::text, 'farmer'::text]))"
            )
        )


def ensure_admin_audit_table():
    inspector = inspect(db.engine)
    if "admin_audit_logs" in inspector.get_table_names():
        return
    from core.models import AdminAuditLog  # noqa: F401

    AdminAuditLog.__table__.create(bind=db.engine, checkfirst=True)


ALERT_TREATMENT_COLUMNS = (
    ("treatment_disease_code", "VARCHAR"),
    ("treatment_title", "VARCHAR"),
    ("treatment_actions", "TEXT"),
    ("treated_by", "VARCHAR"),
    ("treated_at", "TIMESTAMP"),
    ("feedback_reason", "TEXT"),
)


def ensure_alert_treatment_columns():
    _add_missing_columns(
        "alerts",
        ALERT_TREATMENT_COLUMNS,
        {
            "treatment_disease_code": "VARCHAR",
            "treatment_title": "VARCHAR",
            "treatment_actions": "JSONB",
            "treated_by": "UUID",
            "treated_at": "TIMESTAMPTZ",
            "feedback_reason": "TEXT",
        },
    )


def ensure_disease_plan_actions_table():
    inspector = inspect(db.engine)
    if "disease_plan_actions" in inspector.get_table_names():
        return
    from core.models import DiseasePlanAction  # noqa: F401

    DiseasePlanAction.__table__.create(bind=db.engine, checkfirst=True)


def ensure_articles_tables():
    from core.models import Article, ArticleQuestion  # noqa: F401

    inspector = inspect(db.engine)
    tables = inspector.get_table_names()
    if "articles" not in tables:
        Article.__table__.create(bind=db.engine, checkfirst=True)
    if "article_questions" not in tables:
        ArticleQuestion.__table__.create(bind=db.engine, checkfirst=True)


NOTIFICATION_ARTICLE_COLUMNS = (
    ("related_article_id", "VARCHAR"),
    ("related_question_id", "VARCHAR"),
)


def ensure_notification_article_columns():
    ensure_articles_tables()
    _add_missing_columns(
        "notifications",
        NOTIFICATION_ARTICLE_COLUMNS,
        {
            "related_article_id": "UUID",
            "related_question_id": "UUID",
        },
    )


def ensure_site_contact_tables():
    inspector = inspect(db.engine)
    names = set(inspector.get_table_names())
    from core.models import SiteContactCode, SiteContactIdentity  # noqa: F401

    if "site_contact_identities" not in names:
        SiteContactIdentity.__table__.create(bind=db.engine, checkfirst=True)
    if "site_contact_codes" not in names:
        SiteContactCode.__table__.create(bind=db.engine, checkfirst=True)


def ensure_password_reset_tokens_table():
    inspector = inspect(db.engine)
    if "password_reset_tokens" in inspector.get_table_names():
        return
    from core.models import PasswordResetToken  # noqa: F401

    PasswordResetToken.__table__.create(bind=db.engine, checkfirst=True)
