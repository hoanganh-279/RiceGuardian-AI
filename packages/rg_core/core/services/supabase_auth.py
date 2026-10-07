"""Supabase Auth (GoTrue) admin + password sign-in via service role."""

import os

import requests

from core.utils.auth_emails import is_phone_auth_email, phone_auth_email

BAN_DURATION = "876000h"


class SupabaseAuthError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.message = message
        self.status = status


def configured():
    url = (os.getenv("SUPABASE_URL") or "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_KEY") or ""
    return bool(url and key and "your-project" not in url and key != "your-service-role-key")


def _base():
    return (os.getenv("SUPABASE_URL") or "").rstrip("/")


def _key():
    return os.getenv("SUPABASE_SERVICE_KEY") or ""


def _headers():
    key = _key()
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def _message(payload, fallback):
    if not isinstance(payload, dict):
        return fallback
    return (
        payload.get("msg")
        or payload.get("message")
        or payload.get("error_description")
        or payload.get("error")
        or fallback
    )


def _request(method, path, json=None, params=None):
    if not configured():
        raise SupabaseAuthError("Chưa cấu hình SUPABASE_URL / SUPABASE_SERVICE_KEY.", status=503)
    url = f"{_base()}{path}"
    try:
        response = requests.request(
            method,
            url,
            headers=_headers(),
            json=json,
            params=params,
            timeout=30,
        )
    except requests.RequestException as err:
        raise SupabaseAuthError(f"Không kết nối được Supabase Auth: {err}", status=502) from err

    payload = None
    if response.content:
        try:
            payload = response.json()
        except ValueError:
            payload = {"message": response.text}

    if response.status_code >= 400:
        raise SupabaseAuthError(_message(payload, "Supabase Auth từ chối yêu cầu."), status=response.status_code)
    return payload


def auth_email_for(user):
    return user.email


def resolve_auth_email(email, phone, role):
    trimmed = str(email or "").strip().lower()
    if trimmed and not is_phone_auth_email(trimmed):
        return trimmed
    if role == "farmer" and phone:
        return phone_auth_email(phone)
    if trimmed:
        return trimmed
    raise ValueError("Cần email hoặc số điện thoại.")


def sign_in_with_password(email, password):
    key = os.getenv("SUPABASE_ANON_KEY") or _key()
    url = f"{_base()}/auth/v1/token"
    try:
        response = requests.post(
            url,
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            },
            params={"grant_type": "password"},
            json={"email": email, "password": password},
            timeout=30,
        )
    except requests.RequestException as err:
        raise SupabaseAuthError(f"Không kết nối được Supabase Auth: {err}", status=502) from err

    payload = None
    if response.content:
        try:
            payload = response.json()
        except ValueError:
            payload = {"message": response.text}
    if response.status_code >= 400:
        raise SupabaseAuthError(_message(payload, "Email hoặc mật khẩu không đúng."), status=response.status_code)
    return payload


def _auth_payload(*, user_id, email, password, full_name, role, phone=None):
    """Build Admin create/update body. Role/phone live in app_metadata (not user_metadata)."""
    return {
        "id": str(user_id),
        "email": email,
        "password": password,
        "email_confirm": True,
        "app_metadata": {
            "role": role,
            "phone": phone or "",
        },
        "user_metadata": {
            "full_name": full_name,
        },
    }


def create_user(*, user_id, email, password, full_name, role, phone=None):
    body = _auth_payload(
        user_id=user_id,
        email=email,
        password=password,
        full_name=full_name,
        role=role,
        phone=phone,
    )
    return _request("POST", "/auth/v1/admin/users", json=body)


def get_user(user_id):
    try:
        return _request("GET", f"/auth/v1/admin/users/{user_id}")
    except SupabaseAuthError as err:
        if err.status in (404, 422):
            return None
        raise


def update_user_credentials(user_id, *, email=None, password=None, full_name=None, role=None, phone=None):
    body = {}
    if email is not None:
        body["email"] = email
        body["email_confirm"] = True
    if password is not None:
        body["password"] = password
    if full_name is not None:
        body["user_metadata"] = {"full_name": full_name}
    if role is not None or phone is not None:
        app_meta = {}
        if role is not None:
            app_meta["role"] = role
        if phone is not None:
            app_meta["phone"] = phone or ""
        body["app_metadata"] = app_meta
    if not body:
        return get_user(user_id)
    return _request("PUT", f"/auth/v1/admin/users/{user_id}", json=body)


def update_password(user_id, password):
    return update_user_credentials(user_id, password=password)


def request_password_recovery(email):
    """Trigger Supabase Auth recovery email (best-effort; app also issues its own token)."""
    key = os.getenv("SUPABASE_ANON_KEY") or _key()
    url = f"{_base()}/auth/v1/recover"
    try:
        response = requests.post(
            url,
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            },
            json={"email": str(email or "").strip().lower()},
            timeout=30,
        )
    except requests.RequestException as err:
        raise SupabaseAuthError(f"Không gửi được email khôi phục: {err}", status=502) from err

    payload = None
    if response.content:
        try:
            payload = response.json()
        except ValueError:
            payload = {"message": response.text}
    if response.status_code >= 400:
        raise SupabaseAuthError(_message(payload, "Không gửi được email khôi phục."), status=response.status_code)
    return payload


def set_banned(user_id, banned):
    return _request(
        "PUT",
        f"/auth/v1/admin/users/{user_id}",
        json={"ban_duration": BAN_DURATION if banned else "none"},
    )


def delete_user(user_id):
    _request("DELETE", f"/auth/v1/admin/users/{user_id}")
    return True


def find_user_by_email(email):
    payload = _request("GET", "/auth/v1/admin/users", params={"page": 1, "per_page": 200})
    users = payload.get("users") if isinstance(payload, dict) else payload
    target = str(email or "").strip().lower()
    for item in users or []:
        if str(item.get("email") or "").lower() == target:
            return item
        identities = item.get("identities") or []
        for identity in identities:
            if str(identity.get("identity_data", {}).get("email") or "").lower() == target:
                return item
    return None


def ensure_user(*, user_id, email, password, full_name, role, phone=None):
    """Create Auth user with matching UUID, or refresh credentials if that UUID already exists.

    Refuses to silently attach a password to an Auth user whose id differs from public.users.id.
    """
    target_id = str(user_id)
    auth_email = resolve_auth_email(email, phone, role)

    existing_by_id = get_user(target_id)
    if existing_by_id:
        return update_user_credentials(
            target_id,
            email=auth_email,
            password=password,
            full_name=full_name,
            role=role,
            phone=phone,
        )

    existing_by_email = find_user_by_email(auth_email)
    if existing_by_email:
        other_id = str(existing_by_email.get("id") or "")
        if other_id and other_id != target_id:
            raise SupabaseAuthError(
                f"Email Auth '{auth_email}' đã gắn user {other_id}, không khớp public.users.id={target_id}. "
                "Hãy xóa Auth user cũ hoặc chỉnh UUID cho khớp trước khi đồng bộ.",
                status=409,
            )
        return update_user_credentials(
            other_id or target_id,
            email=auth_email,
            password=password,
            full_name=full_name,
            role=role,
            phone=phone,
        )

    try:
        return create_user(
            user_id=user_id,
            email=auth_email,
            password=password,
            full_name=full_name,
            role=role,
            phone=phone,
        )
    except SupabaseAuthError as err:
        # Race: user appeared between checks
        again = get_user(target_id) or find_user_by_email(auth_email)
        if again and str(again.get("id")) == target_id:
            return update_user_credentials(
                target_id,
                email=auth_email,
                password=password,
                full_name=full_name,
                role=role,
                phone=phone,
            )
        if again and str(again.get("id")) != target_id:
            raise SupabaseAuthError(
                f"Email Auth '{auth_email}' đã gắn user {again.get('id')}, không khớp public.users.id={target_id}.",
                status=409,
            ) from err
        raise
