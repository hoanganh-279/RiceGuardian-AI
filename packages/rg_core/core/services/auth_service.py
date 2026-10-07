import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
from sqlalchemy import func, or_

from core.extensions import db
from core.models import AuthSession, LoginAttempt, User
from core.services import supabase_auth
from core.utils.jwt_util import sign_token


class AuthError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.message = message
        self.status = status


def normalize_identifier(value):
    trimmed = str(value or "").strip()
    if re.fullmatch(r"[0-9+\s]+", trimmed):
        return re.sub(r"\s+", "", trimmed)
    return trimmed.lower()


def hash_password(password):
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password, password_hash):
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def _utcnow():
    return datetime.now(timezone.utc)


def _remaining_lock_minutes(locked_until):
    return max(1, int((_aware(locked_until) - _utcnow()).total_seconds() // 60) + 1)


def _aware(dt):
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _as_uuid(value):
    if isinstance(value, uuid.UUID):
        return value
    return uuid.UUID(str(value))


def get_lockout(identifier):
    key = normalize_identifier(identifier)
    attempt = db.session.get(LoginAttempt, key)
    if not attempt:
        return {"locked": False, "attempts": 0, "lockedUntil": None}

    if attempt.locked_until and _aware(attempt.locked_until) <= _utcnow():
        db.session.delete(attempt)
        db.session.commit()
        return {"locked": False, "attempts": 0, "lockedUntil": None}

    locked = bool(attempt.locked_until and _aware(attempt.locked_until) > _utcnow())
    return {
        "locked": locked,
        "attempts": attempt.fail_count,
        "lockedUntil": attempt.locked_until.isoformat() if attempt.locked_until else None,
    }


def record_failed_login(identifier):
    from flask import current_app

    key = normalize_identifier(identifier)
    attempt = db.session.get(LoginAttempt, key)
    if not attempt:
        attempt = LoginAttempt(identifier=key, fail_count=0)
        db.session.add(attempt)

    attempt.fail_count += 1
    attempt.updated_at = _utcnow()
    max_attempts = current_app.config["MAX_LOGIN_ATTEMPTS"]
    lockout_minutes = current_app.config["LOCKOUT_MINUTES"]

    if attempt.fail_count >= max_attempts:
        attempt.locked_until = _utcnow() + timedelta(minutes=lockout_minutes)
        attempt.fail_count = max_attempts

    db.session.commit()
    locked = bool(attempt.locked_until and _aware(attempt.locked_until) > _utcnow())
    return {
        "locked": locked,
        "remaining": max(0, max_attempts - attempt.fail_count),
    }


def clear_lockout(identifier):
    key = normalize_identifier(identifier)
    attempt = db.session.get(LoginAttempt, key)
    if attempt:
        db.session.delete(attempt)
        db.session.commit()


def find_user_by_identifier(identifier):
    key = normalize_identifier(identifier)
    return User.query.filter(
        or_(func.lower(User.email) == key, User.phone == key)
    ).first()


def _password_matches(user, password):
    if supabase_auth.configured():
        try:
            supabase_auth.sign_in_with_password(supabase_auth.auth_email_for(user), password)
            return True
        except supabase_auth.SupabaseAuthError:
            return False

    if not user.password_hash:
        return False
    return verify_password(password, user.password_hash)


def organizations_for_user(user):
    if user.role == "admin":
        return []
    return [org.to_card() for org in user.organizations if org.status == "active"]


def login(identifier, password):
    lock = get_lockout(identifier)
    if lock["locked"]:
        minutes = _remaining_lock_minutes(
            db.session.get(LoginAttempt, normalize_identifier(identifier)).locked_until
        )
        raise AuthError(
            f"Tài khoản bị khóa tạm {minutes} phút sau nhiều lần đăng nhập sai.",
            status=423,
        )

    user = find_user_by_identifier(identifier)
    if not user:
        result = record_failed_login(identifier)
        if result["locked"]:
            raise AuthError("Sai quá 5 lần. Tài khoản bị khóa 15 phút.", status=401)
        raise AuthError(
            f"Email/số điện thoại hoặc mật khẩu không đúng. Còn {result['remaining']} lần thử.",
            status=401,
        )

    if user.status != "active":
        raise AuthError("Tài khoản đã bị khóa hoặc vô hiệu hóa.", status=403)

    if not _password_matches(user, password):
        result = record_failed_login(identifier)
        if result["locked"]:
            raise AuthError("Sai quá 5 lần. Tài khoản bị khóa 15 phút.", status=401)
        raise AuthError(
            f"Email/số điện thoại hoặc mật khẩu không đúng. Còn {result['remaining']} lần thử.",
            status=401,
        )

    clear_lockout(identifier)
    return _issue_session(user)


def logout(jti):
    session = db.session.get(AuthSession, _as_uuid(jti))
    if session and not session.revoked_at:
        session.revoked_at = _utcnow()
        db.session.commit()
    return {"ok": True}


def get_user_from_token_payload(payload):
    session = db.session.get(AuthSession, _as_uuid(payload["jti"]))
    if not session or session.revoked_at or _aware(session.expires_at) <= _utcnow():
        raise AuthError("Phiên đăng nhập đã hết hạn.", status=401)

    user = db.session.get(User, _as_uuid(payload["sub"]))
    if not user or user.status != "active":
        raise AuthError("Tài khoản không hợp lệ.", status=401)
    return user


def profile_payload(user):
    return {
        "user": user.to_public(),
        "organizations": organizations_for_user(user),
    }


def update_profile(user, patch):
    if "fullName" in patch and patch["fullName"]:
        user.full_name = patch["fullName"].strip()
    if "phone" in patch:
        phone = str(patch["phone"] or "").strip()
        user.phone = phone or None
    user.updated_at = _utcnow()
    db.session.commit()
    return user.to_public()


def change_password(user, old_password, new_password):
    if not _password_matches(user, old_password):
        raise AuthError("Mật khẩu cũ không đúng.", status=400)
    _set_password(user, new_password)
    db.session.commit()
    return {"ok": True}


def _issue_session(user):
    org_ids = [org.id for org in user.organizations]
    token, jti, expires = sign_token(user_id=user.id, role=user.role, org_ids=org_ids)
    session = AuthSession(jti=uuid.UUID(jti), user_id=user.id, expires_at=expires)
    db.session.add(session)
    db.session.commit()
    return {
        "access_token": token,
        "user": user.to_public(),
        "organizations": organizations_for_user(user),
    }


def _set_password(user, new_password):
    password = str(new_password or "").strip()
    if len(password) < 6:
        raise AuthError("Mật khẩu phải có ít nhất 6 ký tự.", status=400)
    if supabase_auth.configured():
        try:
            supabase_auth.update_password(user.id, password)
        except supabase_auth.SupabaseAuthError as err:
            raise AuthError(err.message, status=err.status) from err
        user.password_hash = None
    else:
        user.password_hash = hash_password(password)
    user.password_display = password
    user.updated_at = _utcnow()


def _revoke_user_sessions(user_id):
    now = _utcnow()
    AuthSession.query.filter(
        AuthSession.user_id == user_id,
        AuthSession.revoked_at.is_(None),
    ).update({"revoked_at": now}, synchronize_session=False)


def register_farmer(*, full_name, email, phone, password):
    from core.services.user_admin_service import create_user

    full_name = str(full_name or "").strip()
    email = str(email or "").strip().lower()
    phone = normalize_identifier(phone) if phone else ""
    password = str(password or "").strip()

    if not full_name:
        raise AuthError("Vui lòng nhập họ tên.", status=400)
    if not email or "@" not in email or email.endswith("@phone.riceguardian.vn"):
        raise AuthError("Vui lòng nhập email hợp lệ.", status=400)
    if not phone:
        raise AuthError("Vui lòng nhập số điện thoại.", status=400)
    if len(password) < 6:
        raise AuthError("Mật khẩu phải có ít nhất 6 ký tự.", status=400)

    create_user(
        None,
        full_name=full_name,
        email=email,
        phone=phone,
        role="farmer",
        password=password,
    )
    return login(phone, password)


def _google_client_ids():
    import os

    raw = os.getenv("GOOGLE_CLIENT_IDS") or os.getenv("GOOGLE_CLIENT_ID") or ""
    return {part.strip() for part in raw.split(",") if part.strip()}


def _verify_google_id_token(id_token):
    import requests

    token = str(id_token or "").strip()
    if not token:
        raise AuthError("Thiếu Google id_token.", status=400)

    allowed = _google_client_ids()
    if not allowed:
        raise AuthError("Chưa cấu hình GOOGLE_CLIENT_ID / GOOGLE_CLIENT_IDS.", status=503)

    try:
        response = requests.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": token},
            timeout=15,
        )
    except requests.RequestException as err:
        raise AuthError(f"Không xác minh được Google token: {err}", status=502) from err

    if response.status_code >= 400:
        raise AuthError("Google token không hợp lệ.", status=401)

    try:
        payload = response.json()
    except ValueError as err:
        raise AuthError("Phản hồi Google token không hợp lệ.", status=502) from err

    audience = str(payload.get("aud") or "").strip()
    if audience not in allowed:
        raise AuthError("Google token không thuộc ứng dụng này.", status=401)

    email = str(payload.get("email") or "").strip().lower()
    if not email:
        raise AuthError("Tài khoản Google không có email.", status=400)
    if str(payload.get("email_verified") or "").lower() not in ("true", "1"):
        raise AuthError("Email Google chưa được xác minh.", status=400)

    return {
        "email": email,
        "full_name": str(payload.get("name") or email.split("@")[0]).strip() or email,
        "sub": str(payload.get("sub") or "").strip(),
    }


def login_with_google(id_token):
    info = _verify_google_id_token(id_token)
    email = info["email"]
    user = User.query.filter(func.lower(User.email) == email).first()

    if user:
        if user.role != "farmer":
            raise AuthError("Tài khoản này không dùng được trên app nông dân.", status=403)
        if user.status != "active":
            raise AuthError("Tài khoản đã bị khóa hoặc vô hiệu hóa.", status=403)
        return _issue_session(user)

    user_id = uuid.uuid4()
    random_password = secrets.token_urlsafe(24)
    if supabase_auth.configured():
        try:
            supabase_auth.ensure_user(
                user_id=user_id,
                email=email,
                password=random_password,
                full_name=info["full_name"],
                role="farmer",
                phone=None,
            )
        except supabase_auth.SupabaseAuthError as err:
            status = 409 if err.status == 409 else (min(err.status, 409) if err.status < 500 else 502)
            raise AuthError(err.message, status=status) from err

    user = User(
        id=user_id,
        email=email,
        phone=None,
        full_name=info["full_name"],
        role="farmer",
        status="active",
        password_hash=None if supabase_auth.configured() else hash_password(random_password),
        password_display=None,
    )
    db.session.add(user)
    db.session.commit()
    return _issue_session(user)


def _hash_reset_token(token):
    import hashlib

    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def request_password_reset(identifier):
    from flask import current_app

    from core.models import PasswordResetToken
    from core.utils.auth_emails import is_phone_auth_email

    generic = {
        "ok": True,
        "message": "Nếu tài khoản tồn tại và có email, mã đặt lại mật khẩu đã được tạo.",
    }
    user = find_user_by_identifier(identifier)
    if not user or user.status != "active":
        return generic

    if is_phone_auth_email(user.email) or not user.display_email():
        return {
            **generic,
            "message": "Tài khoản này chưa có email thật. Vui lòng dùng email đã đăng ký hoặc liên hệ quản trị viên.",
        }

    raw_token = secrets.token_urlsafe(32)
    db.session.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=_hash_reset_token(raw_token),
            expires_at=_utcnow() + timedelta(hours=1),
        )
    )
    db.session.commit()

    if supabase_auth.configured():
        try:
            supabase_auth.request_password_recovery(user.email)
        except Exception:
            pass

    result = dict(generic)
    if current_app.debug or current_app.config.get("EXPOSE_RESET_TOKEN"):
        result["resetToken"] = raw_token
        result["email"] = user.display_email()
    return result


def reset_password_with_token(token, new_password):
    from core.models import PasswordResetToken

    raw = str(token or "").strip()
    if not raw:
        raise AuthError("Thiếu mã đặt lại mật khẩu.", status=400)

    row = PasswordResetToken.query.filter_by(token_hash=_hash_reset_token(raw)).first()
    if not row or row.used_at or _aware(row.expires_at) <= _utcnow():
        raise AuthError("Mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.", status=400)

    user = db.session.get(User, row.user_id)
    if not user or user.status != "active":
        raise AuthError("Tài khoản không hợp lệ.", status=400)

    _set_password(user, new_password)
    row.used_at = _utcnow()
    _revoke_user_sessions(user.id)
    db.session.commit()
    return {"ok": True}
