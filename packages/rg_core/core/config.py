import os
from datetime import timedelta

from dotenv import load_dotenv

load_dotenv()


def _cors_origins():
    raw = os.getenv("CORS_ORIGINS", "http://localhost:5173")
    origins = [origin.strip() for origin in raw.split(",") if origin.strip()]
    for extra in (
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "https://riceguardianai.io.vn",
        "https://www.riceguardianai.io.vn",
    ):
        if extra not in origins:
            origins.append(extra)
    return origins


def _ms_preview_bands():
    raw = (os.getenv("BLB_MS_PREVIEW_BANDS") or "0,1,2").strip()
    try:
        bands = tuple(int(part.strip()) for part in raw.split(",") if part.strip())
    except ValueError as err:
        raise ValueError(f"BLB_MS_PREVIEW_BANDS không hợp lệ: {raw!r}") from err
    if len(bands) != 3 or any(band < 0 or band > 5 for band in bands):
        raise ValueError(
            f"BLB_MS_PREVIEW_BANDS cần đúng 3 chỉ số kênh trong khoảng 0–5, nhận {raw!r}."
        )
    return bands


def _database_uri():
    raw = (os.getenv("DATABASE_URL") or "").strip()
    if not raw or "[YOUR_PASSWORD]" in raw or "[PROJECT_REF]" in raw:
        return "sqlite:///riceguardian.db"
    return raw


class Config:
    SECRET_KEY = os.getenv("JWT_SECRET", "dev-insecure-change-me")
    SQLALCHEMY_DATABASE_URI = _database_uri()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}
    JWT_EXPIRES = timedelta(hours=int(os.getenv("JWT_EXPIRES_HOURS", "8")))
    CORS_ORIGINS = _cors_origins()
    MAX_LOGIN_ATTEMPTS = 5
    LOCKOUT_MINUTES = 15
    DEBUG = os.getenv("FLASK_DEBUG", "0") == "1"
    EXPOSE_RESET_TOKEN = os.getenv("EXPOSE_RESET_TOKEN", "0") == "1"
    DEFAULT_USER_PASSWORD = os.getenv("DEFAULT_USER_PASSWORD", "123456@")
    SUPABASE_URL = (os.getenv("SUPABASE_URL") or "").rstrip("/")
    SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
    RICE_LEAF_MODEL_PATH = os.getenv("RICE_LEAF_MODEL_PATH", "")
    RICE_LEAF_CONF_THRESHOLD = float(os.getenv("RICE_LEAF_CONF_THRESHOLD", "0.5"))
    BLB_UAV_SEG_MODEL_PATH = os.getenv("BLB_UAV_SEG_MODEL_PATH", "")
    BLB_MS_PREVIEW_BANDS = _ms_preview_bands()
    SITE_GOOGLE_CLIENT_ID = (os.getenv("SITE_GOOGLE_CLIENT_ID") or "").strip()
    SMTP_HOST = (os.getenv("SMTP_HOST") or "smtp.gmail.com").strip()
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER = (os.getenv("SMTP_USER") or "").strip()
    SMTP_PASSWORD = (os.getenv("SMTP_PASSWORD") or "").replace(" ", "")
    CONTACT_INBOX = (os.getenv("CONTACT_INBOX") or os.getenv("SMTP_USER") or "").strip()
