from flask import Blueprint, g, jsonify, request

from core.services.auth_service import (
    AuthError,
    change_password,
    login,
    login_with_google,
    logout,
    organizations_for_user,
    profile_payload,
    register_farmer,
    request_password_reset,
    reset_password_with_token,
    update_profile,
)
from core.utils.auth_decorators import get_bearer_token, require_auth
from core.utils.jwt_util import decode_token

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")
me_bp = Blueprint("me", __name__, url_prefix="/api/me")


def _error_response(err):
    return jsonify({"error": err.message}), err.status


@auth_bp.post("/login")
def login_route():
    data = request.get_json(silent=True) or {}
    identifier = data.get("identifier", "")
    password = data.get("password", "")
    if not identifier or not password:
        return jsonify({"error": "Vui lòng nhập email/số điện thoại và mật khẩu."}), 400
    try:
        return jsonify(login(identifier, password))
    except AuthError as err:
        return _error_response(err)


@auth_bp.post("/register")
def register_route():
    data = request.get_json(silent=True) or {}
    try:
        return jsonify(
            register_farmer(
                full_name=data.get("fullName", ""),
                email=data.get("email", ""),
                phone=data.get("phone", ""),
                password=data.get("password", ""),
            )
        )
    except AuthError as err:
        return _error_response(err)


@auth_bp.post("/google")
def google_login_route():
    data = request.get_json(silent=True) or {}
    id_token = data.get("idToken") or data.get("id_token") or ""
    try:
        return jsonify(login_with_google(id_token))
    except AuthError as err:
        return _error_response(err)


@auth_bp.post("/forgot-password")
def forgot_password_route():
    data = request.get_json(silent=True) or {}
    identifier = data.get("identifier", "")
    if not identifier:
        return jsonify({"error": "Vui lòng nhập email hoặc số điện thoại."}), 400
    return jsonify(request_password_reset(identifier))


@auth_bp.post("/reset-password")
def reset_password_route():
    data = request.get_json(silent=True) or {}
    token = data.get("token", "")
    password = data.get("password") or data.get("newPassword") or ""
    try:
        return jsonify(reset_password_with_token(token, password))
    except AuthError as err:
        return _error_response(err)


@auth_bp.post("/logout")
def logout_route():
    token = get_bearer_token()
    if not token:
        return jsonify({"ok": True})
    try:
        payload = decode_token(token)
        logout(payload["jti"])
    except Exception:
        pass
    return jsonify({"ok": True})


@auth_bp.get("/me")
@require_auth
def me_route():
    return jsonify(profile_payload(g.user))


@auth_bp.patch("/profile")
@require_auth
def profile_update_route():
    data = request.get_json(silent=True) or {}
    user = update_profile(g.user, data)
    return jsonify(user)


@auth_bp.post("/change-password")
@require_auth
def change_password_route():
    data = request.get_json(silent=True) or {}
    old_password = data.get("oldPassword", "")
    new_password = data.get("newPassword", "")
    if not old_password or not new_password:
        return jsonify({"error": "Thiếu mật khẩu."}), 400
    try:
        return jsonify(change_password(g.user, old_password, new_password))
    except AuthError as err:
        return _error_response(err)


@me_bp.get("/organizations")
@require_auth
def my_organizations_route():
    return jsonify(organizations_for_user(g.user))
