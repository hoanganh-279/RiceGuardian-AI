"""Admin CRUD for public.users + Supabase Auth."""

import secrets
import string
import uuid
from datetime import datetime, timezone

from sqlalchemy import func, or_

from core.extensions import db
from core.models import AdminAuditLog, AuthSession, User
from core.services import supabase_auth
from core.services.auth_service import AuthError, hash_password, normalize_identifier
from core.utils.auth_emails import is_phone_auth_email

ALLOWED_ROLES = ("admin", "manager", "technician", "farmer")
DEFAULT_PASSWORD = "123456@"


def _utcnow():
    return datetime.now(timezone.utc)


def generate_temporary_password():
    alphabet = string.ascii_letters + string.digits
    return "Rg@" + "".join(secrets.choice(alphabet) for _ in range(8))


def _as_uuid(value):
    return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))


def write_audit(actor, action, target, detail):
    db.session.add(
        AdminAuditLog(
            actor_id=actor.id if actor else None,
            actor_email=actor.email if actor else None,
            action=action,
            target=target,
            detail=detail,
        )
    )


def to_admin_item(user):
    return user.to_admin()


def list_users(*, page=1, limit=20, q="", role="", status="", exclude_role=""):
    query = User.query
    if role:
        query = query.filter(User.role == role)
    exclude = str(exclude_role or "").strip()
    if exclude:
        query = query.filter(User.role != exclude)
    if status:
        query = query.filter(User.status == status)
    term = str(q or "").strip()
    if term:
        like = f"%{term}%"
        query = query.filter(
            or_(
                User.full_name.ilike(like),
                User.email.ilike(like),
                User.phone.ilike(like),
            )
        )
    total = query.count()
    try:
        page = max(1, int(page or 1))
    except (TypeError, ValueError):
        page = 1
    try:
        limit = min(100, max(1, int(limit or 20)))
    except (TypeError, ValueError):
        limit = 20
    rows = query.order_by(User.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return {
        "items": [to_admin_item(row) for row in rows],
        "page": page,
        "limit": limit,
        "total": total,
    }


def _ensure_unique(email, phone, exclude_id=None):
    email_q = User.query.filter(func.lower(User.email) == email.lower())
    if exclude_id:
        email_q = email_q.filter(User.id != exclude_id)
    if email_q.first():
        raise AuthError("Email đã được sử dụng.", status=409)

    if phone:
        phone_q = User.query.filter(User.phone == phone)
        if exclude_id:
            phone_q = phone_q.filter(User.id != exclude_id)
        if phone_q.first():
            raise AuthError("Số điện thoại đã được sử dụng.", status=409)


def create_user(actor, *, full_name, email, phone, role, password=None):
    role = str(role or "").strip()
    if role not in ALLOWED_ROLES:
        raise AuthError("Vai trò không hợp lệ.", status=400)

    full_name = str(full_name or "").strip()
    if not full_name:
        raise AuthError("Vui lòng nhập họ tên.", status=400)

    phone = normalize_identifier(phone) if phone else None
    try:
        auth_email = supabase_auth.resolve_auth_email(email, phone, role)
    except ValueError as err:
        raise AuthError(str(err), status=400) from err

    if role != "farmer" and (not email or is_phone_auth_email(auth_email)):
        raise AuthError("Tài khoản nhân sự cần email.", status=400)
    if role == "farmer" and not phone:
        raise AuthError("Tài khoản nông dân cần số điện thoại.", status=400)

    _ensure_unique(auth_email, phone)
    temporary = str(password or "").strip() or DEFAULT_PASSWORD
    user_id = uuid.uuid4()

    if supabase_auth.configured():
        try:
            created = supabase_auth.ensure_user(
                user_id=user_id,
                email=auth_email,
                password=temporary,
                full_name=full_name,
                role=role,
                phone=phone,
            )
            auth_id = created.get("id") if isinstance(created, dict) else None
            if auth_id and str(auth_id) != str(user_id):
                raise AuthError(
                    f"Auth user id ({auth_id}) không khớp public.users.id ({user_id}).",
                    status=409,
                )
        except supabase_auth.SupabaseAuthError as err:
            status = 409 if err.status == 409 else (min(err.status, 409) if err.status < 500 else 502)
            raise AuthError(err.message, status=status) from err

    user = User(
        id=user_id,
        email=auth_email,
        phone=phone,
        full_name=full_name,
        role=role,
        status="active",
        password_hash=None if supabase_auth.configured() else hash_password(temporary),
        password_display=temporary,
    )
    db.session.add(user)
    write_audit(actor, "create_user", auth_email, f"Tạo tài khoản {role}.")
    db.session.commit()
    item = to_admin_item(user)
    item["temporaryPassword"] = temporary
    return item


def get_user(user_id):
    user = db.session.get(User, _as_uuid(user_id))
    if not user:
        raise AuthError("Không tìm thấy tài khoản.", status=404)
    return user


def lock_user(actor, user_id):
    user = get_user(user_id)
    if actor and user.id == actor.id:
        raise AuthError("Không thể khóa tài khoản đang đăng nhập.", status=400)
    next_status = "active" if user.status == "locked" else "locked"
    if supabase_auth.configured():
        try:
            supabase_auth.set_banned(user.id, next_status == "locked")
        except supabase_auth.SupabaseAuthError as err:
            raise AuthError(err.message, status=502) from err
    user.status = next_status
    user.updated_at = _utcnow()
    if next_status == "locked":
        AuthSession.query.filter_by(user_id=user.id, revoked_at=None).update({"revoked_at": _utcnow()})
    write_audit(actor, "lock_user" if next_status == "locked" else "unlock_user", user.email, f"Trạng thái {next_status}.")
    db.session.commit()
    return to_admin_item(user)


def reset_password(actor, user_id, password=None):
    user = get_user(user_id)
    temporary = str(password or "").strip() or generate_temporary_password()
    if supabase_auth.configured():
        try:
            supabase_auth.update_password(user.id, temporary)
        except supabase_auth.SupabaseAuthError as err:
            raise AuthError(err.message, status=502) from err
        user.password_hash = None
    else:
        user.password_hash = hash_password(temporary)
    user.password_display = temporary
    user.updated_at = _utcnow()
    write_audit(actor, "reset_password", user.email, "Đặt lại mật khẩu.")
    db.session.commit()
    return {"ok": True, "temporaryPassword": temporary}


def delete_user(actor, user_id):
    user = get_user(user_id)
    if actor and user.id == actor.id:
        raise AuthError("Không thể xóa tài khoản đang đăng nhập.", status=400)
    email = user.email
    name = user.full_name
    if supabase_auth.configured():
        try:
            supabase_auth.delete_user(user.id)
        except supabase_auth.SupabaseAuthError as err:
            if err.status not in (404, 422):
                raise AuthError(err.message, status=502) from err
    write_audit(actor, "delete_user", email, f"Xóa tài khoản {name}.")
    db.session.delete(user)
    db.session.commit()
    return {"ok": True}
