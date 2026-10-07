from flask import Blueprint, g, jsonify, request

from core.services.auth_service import AuthError
from core.services.mailer import MailError
from core.services.site_contact_service import (
    begin_google_login,
    decode_site_token,
    resend_code,
    send_contact_message,
    verify_code,
)
from core.utils.auth_decorators import get_bearer_token

site_contact_bp = Blueprint("site_contact", __name__, url_prefix="/api/site")


def _error(err):
    return jsonify({"error": err.message}), err.status


def _require_site_identity():
    token = get_bearer_token()
    if not token:
        raise AuthError("Đăng nhập Google trước khi gửi.", status=401)
    return decode_site_token(token)


@site_contact_bp.post("/auth/google")
def site_google_login():
    data = request.get_json(silent=True) or {}
    try:
        return jsonify(
            begin_google_login(
                id_token=data.get("idToken") or data.get("id_token") or "",
                access_token=data.get("accessToken") or data.get("access_token") or "",
            )
        )
    except (AuthError, MailError) as err:
        return _error(err)


@site_contact_bp.post("/auth/verify")
def site_verify_code():
    data = request.get_json(silent=True) or {}
    try:
        return jsonify(verify_code(data.get("email", ""), data.get("code", "")))
    except (AuthError, MailError) as err:
        return _error(err)


@site_contact_bp.post("/auth/resend")
def site_resend_code():
    data = request.get_json(silent=True) or {}
    try:
        return jsonify(resend_code(data.get("email", "")))
    except (AuthError, MailError) as err:
        return _error(err)


@site_contact_bp.post("/contact")
def site_send_contact():
    data = request.get_json(silent=True) or {}
    try:
        identity = _require_site_identity()
        g.site_identity = identity
        return jsonify(
            send_contact_message(
                identity,
                name=data.get("name", ""),
                role=data.get("role", ""),
                phone=data.get("phone", ""),
                org=data.get("org", ""),
                message=data.get("message", ""),
            )
        )
    except (AuthError, MailError) as err:
        return _error(err)
