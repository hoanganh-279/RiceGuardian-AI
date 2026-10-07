import os
import uuid
from datetime import datetime, timezone

import requests
from flask import current_app

RISK_ORDER = {"high": 0, "medium": 1, "low": 2, "watch": 3}

_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"}
_MS_EXTS = {".tif", ".tiff"}
_ALLOWED_EXTS = _IMAGE_EXTS | _MS_EXTS


def _utcnow():
    return datetime.now(timezone.utc)


def _normalize_ext(filename_hint, allowed=None):
    allowed = allowed or _ALLOWED_EXTS
    hinted = filename_hint or "file.bin"
    ext = os.path.splitext(hinted)[1].lower()
    if ext not in allowed:
        return None
    return ext


def upload_bytes(content, prefix, filename_hint=None, content_type=None, allowed_exts=None):
    """Upload raw bytes to Supabase Storage or local uploads folder for dev."""
    if not content:
        raise ValueError("Tệp trống.")
    allowed = allowed_exts or _ALLOWED_EXTS
    ext = _normalize_ext(filename_hint, allowed)
    if not ext:
        raise ValueError("Định dạng tệp không được hỗ trợ.")
    filename = f"{str(prefix).strip('/')}/{uuid.uuid4()}{ext}"
    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    service_key = os.getenv("SUPABASE_SERVICE_KEY", "")
    bucket = os.getenv("SUPABASE_STORAGE_BUCKET", "photos")
    ctype = content_type or "application/octet-stream"

    if supabase_url and service_key:
        upload_url = f"{supabase_url}/storage/v1/object/{bucket}/{filename}"
        resp = requests.post(
            upload_url,
            headers={
                "Authorization": f"Bearer {service_key}",
                "Content-Type": ctype,
            },
            data=content,
            timeout=120,
        )
        if resp.status_code in (200, 201):
            return f"{supabase_url}/storage/v1/object/public/{bucket}/{filename}"

    backend_root = (current_app.config.get("BACKEND_ROOT") or "").strip()
    if not backend_root:
        backend_root = os.path.join(current_app.root_path, "..")
    upload_dir = os.path.join(os.path.abspath(backend_root), "uploads", "photos")
    os.makedirs(upload_dir, exist_ok=True)
    local_path = os.path.join(upload_dir, filename.replace("/", "_"))
    with open(local_path, "wb") as handle:
        handle.write(content)

    base = os.getenv("PUBLIC_UPLOAD_BASE_URL", "/uploads/photos").rstrip("/")
    return f"{base}/{filename.replace('/', '_')}"


def upload_image_file(file_storage, prefix, filename_hint=None):
    """Upload image to Supabase Storage or local uploads folder for dev."""
    hinted = filename_hint or getattr(file_storage, "filename", None) or "photo.jpg"
    ext = _normalize_ext(hinted, _IMAGE_EXTS) or ".jpg"
    content = file_storage.read()
    if not content:
        raise ValueError("Tệp ảnh trống.")
    content_type = getattr(file_storage, "content_type", None) or "image/jpeg"
    return upload_bytes(
        content,
        prefix,
        filename_hint=f"file{ext}",
        content_type=content_type,
        allowed_exts=_IMAGE_EXTS,
    )


def upload_multispectral_file(file_storage, prefix, filename_hint=None):
    hinted = filename_hint or getattr(file_storage, "filename", None) or "d2.tif"
    ext = _normalize_ext(hinted, _MS_EXTS)
    if not ext:
        raise ValueError("Chọn tệp GeoTIFF multispectral (.tif / .tiff).")
    content = file_storage.read()
    if not content:
        raise ValueError("Tệp TIFF trống.")
    content_type = getattr(file_storage, "content_type", None) or "image/tiff"
    return upload_bytes(
        content,
        prefix,
        filename_hint=f"ms{ext}",
        content_type=content_type,
        allowed_exts=_MS_EXTS,
    )


def upload_photo_file(file_storage, farmer_id):
    return upload_image_file(file_storage, farmer_id)


def resolve_upload_bytes(file_url):
    """Load bytes from a stored upload URL (local path or remote)."""
    if not file_url:
        raise ValueError("Thiếu đường dẫn tệp.")
    backend_root = (current_app.config.get("BACKEND_ROOT") or "").strip()
    if not backend_root:
        backend_root = os.path.abspath(os.path.join(current_app.root_path, ".."))
    uploads_root = os.path.abspath(os.path.join(backend_root, "uploads", "photos"))
    marker = "/uploads/photos/"
    if marker in file_url:
        filename = file_url.split(marker, 1)[1]
        local_path = os.path.join(uploads_root, filename.replace("/", os.sep))
        if os.path.isfile(local_path):
            with open(local_path, "rb") as handle:
                return handle.read()
        raise ValueError(f"Không tìm thấy tệp ảnh bìa trên máy chủ: {filename}")
    if file_url.startswith("/") and not file_url.startswith("//"):
        raise ValueError(
            "Đường dẫn ảnh không hợp lệ (thiếu http/https). "
            "Tải lại ảnh bìa rồi chạy phân tích."
        )
    response = requests.get(file_url, timeout=120)
    response.raise_for_status()
    return response.content
