from functools import wraps

from flask import g, jsonify

from core.utils.auth_decorators import require_auth


def require_farmer(view):
    @require_auth
    @wraps(view)
    def wrapped(*args, **kwargs):
        if g.user.role != "farmer":
            return jsonify({"error": "Chỉ tài khoản Nông dân mới truy cập được."}), 403
        return view(*args, **kwargs)

    return wrapped
