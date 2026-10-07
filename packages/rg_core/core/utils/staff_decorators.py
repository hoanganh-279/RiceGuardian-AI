from functools import wraps

from flask import g, jsonify

from core.utils.auth_decorators import require_auth


def require_staff(view):
    @require_auth
    @wraps(view)
    def wrapped(*args, **kwargs):
        if g.user.role not in ("technician", "admin", "manager"):
            return jsonify({"error": "Không có quyền xem mục này."}), 403
        return view(*args, **kwargs)

    return wrapped


def require_technician(view):
    @require_auth
    @wraps(view)
    def wrapped(*args, **kwargs):
        if g.user.role not in ("technician", "admin"):
            return jsonify({"error": "Chỉ kỹ thuật viên hoặc Admin được thao tác mục này."}), 403
        return view(*args, **kwargs)

    return wrapped


def require_admin(view):
    @require_auth
    @wraps(view)
    def wrapped(*args, **kwargs):
        if g.user.role != "admin":
            return jsonify({"error": "Chỉ Admin được thao tác mục này."}), 403
        return view(*args, **kwargs)

    return wrapped
