from functools import wraps

from flask import g, jsonify, request

from core.services.auth_service import AuthError, get_user_from_token_payload
from core.utils.jwt_util import decode_token


def get_bearer_token():
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        return header[7:].strip()
    return None


def require_auth(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        token = get_bearer_token()
        if not token:
            return jsonify({"error": "Chưa đăng nhập."}), 401
        try:
            payload = decode_token(token)
            g.user = get_user_from_token_payload(payload)
            g.token_payload = payload
        except AuthError as err:
            return jsonify({"error": err.message}), err.status
        except Exception:
            return jsonify({"error": "Phiên đăng nhập không hợp lệ."}), 401
        return view(*args, **kwargs)

    return wrapped
