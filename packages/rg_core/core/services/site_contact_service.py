import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import jwt
import requests
from flask import current_app
from sqlalchemy import func

from core.extensions import db
from core.models import SiteContactCode, SiteContactIdentity
from core.services.auth_service import AuthError
from core.services.mailer import MailError, contact_inbox_email, send_mail, verification_email

CODE_MINUTES = 10
MAX_CODES_PER_HOUR = 5
MAX_VERIFY_ATTEMPTS = 5
MAX_CONTACTS_PER_HOUR = 5
CONTACT_WINDOW = timedelta(hours=1)


def _utcnow():
    return datetime.now(timezone.utc)


def _aware(value):
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _hash_code(code):
    return hashlib.sha256(str(code).encode("utf-8")).hexdigest()


def _site_client_id():
    client_id = (current_app.config.get("SITE_GOOGLE_CLIENT_ID") or "").strip()
    if not client_id:
        raise AuthError("Chưa cấu hình SITE_GOOGLE_CLIENT_ID.", status=503)
    return client_id


def _google_profile(*, id_token="", access_token=""):
    client_id = _site_client_id()
    token = str(id_token or "").strip()
    access = str(access_token or "").strip()
    if not token and not access:
        raise AuthError("Thiếu Google token.", status=400)

    try:
        if token:
            response = requests.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": token},
                timeout=15,
            )
        else:
            response = requests.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"access_token": access},
                timeout=15,
            )
    except requests.RequestException as err:
        raise AuthError("Không xác minh được Google token.", status=502) from err

    if response.status_code >= 400:
        raise AuthError("Google token không hợp lệ.", status=401)

    try:
        payload = response.json()
    except ValueError as err:
        raise AuthError("Phản hồi Google token không hợp lệ.", status=502) from err

    audience = str(
        payload.get("aud") or payload.get("azp") or payload.get("audience") or payload.get("issued_to") or ""
    ).strip()
    if audience != client_id:
        raise AuthError("Google token không thuộc website này.", status=401)

    email = str(payload.get("email") or "").strip().lower()
    verified = str(payload.get("email_verified") or payload.get("verified_email") or "").lower()
    if not email and access:
        email, name, sub = _userinfo(access)
        return {"email": email, "full_name": name, "sub": sub}

    if verified not in ("true", "1"):
        raise AuthError("Email Google chưa được xác minh.", status=400)
    if not email:
        raise AuthError("Tài khoản Google không có email.", status=400)

    return {
        "email": email,
        "full_name": str(payload.get("name") or email.split("@")[0]).strip() or email,
        "sub": str(payload.get("sub") or payload.get("user_id") or "").strip(),
    }


def _userinfo(access_token):
    try:
        response = requests.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=15,
        )
    except requests.RequestException as err:
        raise AuthError("Không đọc được hồ sơ Google.", status=502) from err
    if response.status_code >= 400:
        raise AuthError("Không đọc được hồ sơ Google.", status=401)
    payload = response.json()
    email = str(payload.get("email") or "").strip().lower()
    if not email:
        raise AuthError("Tài khoản Google không có email.", status=400)
    if payload.get("email_verified") is False:
        raise AuthError("Email Google chưa được xác minh.", status=400)
    return (
        email,
        str(payload.get("name") or email.split("@")[0]).strip() or email,
        str(payload.get("sub") or "").strip(),
    )


def _issue_site_token(identity):
    expires = _utcnow() + current_app.config["JWT_EXPIRES"]
    payload = {
        "sub": str(identity.id),
        "email": identity.email,
        "name": identity.full_name,
        "scope": "site_contact",
        "exp": expires,
        "iat": _utcnow(),
    }
    token = jwt.encode(payload, current_app.config["SECRET_KEY"], algorithm="HS256")
    return {
        "needsVerification": False,
        "accessToken": token,
        "user": {"name": identity.full_name, "email": identity.email},
    }


def decode_site_token(token):
    try:
        payload = jwt.decode(token, current_app.config["SECRET_KEY"], algorithms=["HS256"])
    except jwt.PyJWTError as err:
        raise AuthError("Phiên đăng nhập không hợp lệ.", status=401) from err
    if payload.get("scope") != "site_contact":
        raise AuthError("Phiên không dùng được cho form liên hệ.", status=401)
    identity = db.session.get(SiteContactIdentity, uuid.UUID(str(payload.get("sub"))))
    if not identity or not identity.verified_at:
        raise AuthError("Email chưa xác minh.", status=401)
    return identity


def _recent_code_count(identity_id):
    since = _utcnow() - timedelta(hours=1)
    return (
        SiteContactCode.query.filter(
            SiteContactCode.identity_id == identity_id,
            SiteContactCode.created_at >= since,
        ).count()
    )


def _send_code(identity):
    if _recent_code_count(identity.id) >= MAX_CODES_PER_HOUR:
        raise AuthError("Đã gửi quá nhiều mã. Thử lại sau.", status=429)

    code = f"{secrets.randbelow(1_000_000):06d}"
    row = SiteContactCode(
        identity_id=identity.id,
        code_hash=_hash_code(code),
        expires_at=_utcnow() + timedelta(minutes=CODE_MINUTES),
    )
    db.session.add(row)
    db.session.commit()
    try:
        plain, html_body = verification_email(
            name=identity.full_name,
            code=code,
            minutes=CODE_MINUTES,
        )
        send_mail(
            to=identity.email,
            subject="Mã xác nhận RiceGuardian AI",
            body=plain,
            html_body=html_body,
            inline_logo=True,
        )
    except MailError:
        db.session.delete(row)
        db.session.commit()
        raise
    return {"needsVerification": True, "email": identity.email}


def begin_google_login(*, id_token="", access_token=""):
    info = _google_profile(id_token=id_token, access_token=access_token)
    identity = SiteContactIdentity.query.filter(func.lower(SiteContactIdentity.email) == info["email"]).first()
    if not identity:
        identity = SiteContactIdentity(
            email=info["email"],
            google_sub=info["sub"] or info["email"],
            full_name=info["full_name"],
        )
        db.session.add(identity)
        db.session.commit()
    else:
        identity.google_sub = info["sub"] or identity.google_sub
        identity.full_name = info["full_name"] or identity.full_name
        db.session.commit()

    if identity.verified_at:
        return _issue_site_token(identity)
    return _send_code(identity)


def resend_code(email):
    email = str(email or "").strip().lower()
    identity = SiteContactIdentity.query.filter(func.lower(SiteContactIdentity.email) == email).first()
    if not identity or identity.verified_at:
        raise AuthError("Không có lượt xác minh đang chờ.", status=400)
    return _send_code(identity)


def verify_code(email, code):
    email = str(email or "").strip().lower()
    submitted = str(code or "").strip()
    if not email or not submitted:
        raise AuthError("Vui lòng nhập mã xác nhận.", status=400)

    identity = SiteContactIdentity.query.filter(func.lower(SiteContactIdentity.email) == email).first()
    if not identity:
        raise AuthError("Mã xác nhận không đúng.", status=400)
    if identity.verified_at:
        return _issue_site_token(identity)

    row = (
        SiteContactCode.query.filter(
            SiteContactCode.identity_id == identity.id,
            SiteContactCode.used_at.is_(None),
        )
        .order_by(SiteContactCode.created_at.desc())
        .first()
    )
    if not row or _aware(row.expires_at) < _utcnow():
        raise AuthError("Mã đã hết hạn. Gửi lại mã mới.", status=400)
    if row.attempts >= MAX_VERIFY_ATTEMPTS:
        raise AuthError("Nhập sai quá nhiều lần. Gửi lại mã mới.", status=429)
    if row.code_hash != _hash_code(submitted):
        row.attempts += 1
        db.session.commit()
        raise AuthError("Mã xác nhận không đúng.", status=400)

    row.used_at = _utcnow()
    identity.verified_at = _utcnow()
    db.session.commit()
    return _issue_site_token(identity)


def send_contact_message(identity, *, name, role, phone, org, message):
    text = str(message or "").strip()
    if len(text) < 10:
        raise AuthError("Nội dung cần ít nhất 10 ký tự.", status=400)
    if len(text) > 2000:
        raise AuthError("Nội dung tối đa 2000 ký tự.", status=400)

    now = _utcnow()
    last = _aware(identity.last_contact_at)
    if last and now - last < CONTACT_WINDOW and identity.contact_count >= MAX_CONTACTS_PER_HOUR:
        raise AuthError("Bạn đã gửi quá nhiều tin. Thử lại sau.", status=429)
    if not last or now - last >= CONTACT_WINDOW:
        identity.contact_count = 0

    display_name = str(name or identity.full_name).strip() or identity.full_name
    inbox = (current_app.config.get("CONTACT_INBOX") or "").strip()
    if not inbox:
        raise AuthError("Chưa cấu hình CONTACT_INBOX.", status=503)

    plain, html_body = contact_inbox_email(
        name=display_name,
        email=identity.email,
        role=role,
        phone=phone,
        org=org,
        message=text,
    )
    send_mail(
        to=inbox,
        subject=f"[RiceGuardian] Liên hệ từ {display_name}",
        body=plain,
        html_body=html_body,
        reply_to=identity.email,
        inline_logo=True,
    )
    identity.last_contact_at = now
    identity.contact_count = (identity.contact_count or 0) + 1
    db.session.commit()
    return {"ok": True}
