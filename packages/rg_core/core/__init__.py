import os

from flask import Flask, jsonify, request, send_from_directory
from flask_compress import Compress
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

from core.config import Config
from core.extensions import db

PROFILES = frozenset({"site", "web", "app", "all"})


def _backend_root(app):
    configured = (app.config.get("BACKEND_ROOT") or "").strip()
    if configured:
        return os.path.abspath(configured)
    # Fallback: packages/rg_core/core -> product backend is two levels up only when
    # create_app is invoked from a product backend that set BACKEND_ROOT.
    return os.path.abspath(os.path.join(app.root_path, ".."))


def create_app(config_class=Config, profile="all", backend_root=None):
    """Create Flask app for a product profile.

    Profiles:
      site — /api/site + health
      web  — auth, me, technician, admin, articles (staff)
      app  — auth, me, farmer + Socket.IO
      all  — legacy combined (tests / local debug)
    """
    profile = (profile or "all").strip().lower()
    if profile not in PROFILES:
        raise ValueError(f"Unknown API profile: {profile}")

    app = Flask(__name__)
    app.config.from_object(config_class)
    if backend_root:
        app.config["BACKEND_ROOT"] = os.path.abspath(backend_root)
    app.config["API_PROFILE"] = profile

    db.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": app.config.get("CORS_ORIGINS") or "*"}})
    Compress(app)

    if profile in ("web", "app", "all"):
        from core.routes.auth import auth_bp, me_bp

        app.register_blueprint(auth_bp)
        app.register_blueprint(me_bp)

    if profile in ("web", "all"):
        from core.routes.admin_users import admin_users_bp
        from core.routes.articles import admin_articles_bp, tech_articles_bp
        from core.routes.technician import technician_bp

        app.register_blueprint(admin_users_bp)
        app.register_blueprint(admin_articles_bp)
        app.register_blueprint(technician_bp)
        app.register_blueprint(tech_articles_bp)

    if profile in ("app", "all"):
        from core.routes.farmer import farmer_bp

        app.register_blueprint(farmer_bp)

    if profile in ("site", "all"):
        from core.routes.site_contact import site_contact_bp

        app.register_blueprint(site_contact_bp)

    @app.errorhandler(Exception)
    def handle_unexpected_error(err):
        if isinstance(err, HTTPException):
            return err
        app.logger.exception("Unhandled API error")
        return jsonify({"error": "Máy chủ tạm thời không xử lý được yêu cầu. Thử lại sau."}), 500

    _run_boot_patches(app, profile)

    uploads_root = os.path.join(_backend_root(app), "uploads", "photos")
    os.makedirs(uploads_root, exist_ok=True)

    @app.get("/uploads/photos/<path:filename>")
    def serve_upload(filename):
        response = send_from_directory(uploads_root, filename)
        origins = app.config.get("CORS_ORIGINS") or ["*"]
        if origins == "*" or origins == ["*"]:
            response.headers["Access-Control-Allow-Origin"] = "*"
        else:
            request_origin = request.headers.get("Origin")
            if request_origin and request_origin in origins:
                response.headers["Access-Control-Allow-Origin"] = request_origin
            elif origins:
                response.headers["Access-Control-Allow-Origin"] = origins[0]
        response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
        response.headers.setdefault("Vary", "Origin")
        return response

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok", "profile": profile})

    # Socket.IO only on farmer app (cross-service emit from web is deferred).
    if profile in ("app", "all"):
        from core.realtime import init_socketio

        init_socketio(app)

    return app


def _run_boot_patches(app, profile):
    """Schema patches: web owns full migrate; site/app run audience-relevant patches."""
    if str(app.config.get("SQLALCHEMY_DATABASE_URI", "")).startswith("sqlite"):
        with app.app_context():
            from core import models as _models  # noqa: F401
            from core.services.seed import ensure_demo_customer_data, seed_demo_data

            db.create_all()
            if profile in ("web", "app", "all"):
                try:
                    seed_demo_data()
                except Exception:
                    db.session.rollback()
                    app.logger.exception("Could not seed demo data")
                try:
                    ensure_demo_customer_data()
                except Exception:
                    db.session.rollback()
                    app.logger.exception("Could not ensure demo customer data")

    with app.app_context():
        from core.services.schema_patches import (
            ensure_admin_audit_table,
            ensure_alert_treatment_columns,
            ensure_articles_tables,
            ensure_disease_plan_actions_table,
            ensure_farmer_role_allowed,
            ensure_field_blb_columns,
            ensure_field_cover_columns,
            ensure_notification_article_columns,
            ensure_password_reset_tokens_table,
            ensure_photo_rescan_columns,
            ensure_site_contact_tables,
            ensure_users_password_display_column,
            ensure_users_password_nullable,
        )

        if profile in ("site", "all"):
            try:
                ensure_site_contact_tables()
            except Exception:
                app.logger.exception("Could not patch site contact tables")

        if profile in ("web", "all"):
            try:
                ensure_photo_rescan_columns()
            except Exception:
                app.logger.exception("Could not patch photos rescan columns")
            try:
                ensure_field_cover_columns()
                ensure_field_blb_columns()
            except Exception:
                app.logger.exception("Could not patch fields cover / BLB columns")
            try:
                ensure_alert_treatment_columns()
                ensure_disease_plan_actions_table()
            except Exception:
                app.logger.exception("Could not patch alert treatment / disease plans")
            try:
                ensure_users_password_nullable()
                ensure_users_password_display_column()
                ensure_farmer_role_allowed()
                ensure_admin_audit_table()
                ensure_password_reset_tokens_table()
                ensure_site_contact_tables()
            except Exception:
                app.logger.exception("Could not patch auth user columns")
            try:
                ensure_articles_tables()
                ensure_notification_article_columns()
            except Exception:
                app.logger.exception("Could not patch articles / notification article columns")

        if profile == "app":
            # App reads same schema; apply safe additive patches without owning migrate.
            try:
                ensure_users_password_nullable()
                ensure_users_password_display_column()
                ensure_farmer_role_allowed()
                ensure_password_reset_tokens_table()
                ensure_articles_tables()
                ensure_notification_article_columns()
                ensure_photo_rescan_columns()
            except Exception:
                app.logger.exception("Could not patch farmer-facing schema")

        if profile in ("web", "app", "all") and not str(
            app.config.get("SQLALCHEMY_DATABASE_URI", "")
        ).startswith("sqlite"):
            try:
                from core.services.seed import ensure_demo_customer_data

                ensure_demo_customer_data()
            except Exception:
                db.session.rollback()
                app.logger.exception("Could not ensure demo customer data")
