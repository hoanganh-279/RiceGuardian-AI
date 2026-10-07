from flask import Blueprint, g, jsonify, request

from core.services.auth_service import AuthError
from core.services.user_admin_service import (
    create_user,
    delete_user,
    list_users,
    lock_user,
    reset_password,
)
from core.utils.staff_decorators import require_admin

admin_users_bp = Blueprint("admin_users", __name__, url_prefix="/api/admin")


def _error_response(err):
    return jsonify({"error": err.message}), err.status


@admin_users_bp.get("/users")
@require_admin
def list_users_route():
    return jsonify(
        list_users(
            page=request.args.get("page", 1),
            limit=request.args.get("limit", 20),
            q=request.args.get("q", ""),
            role=request.args.get("role", ""),
            status=request.args.get("status", ""),
            exclude_role=request.args.get("exclude_role", ""),
        )
    )


@admin_users_bp.post("/users")
@require_admin
def create_user_route():
    data = request.get_json(silent=True) or {}
    try:
        return jsonify(
            create_user(
                g.user,
                full_name=data.get("fullName"),
                email=data.get("email"),
                phone=data.get("phone"),
                role=data.get("role"),
                password=data.get("password"),
            )
        ), 201
    except AuthError as err:
        return _error_response(err)


@admin_users_bp.post("/users/<user_id>/lock")
@require_admin
def lock_user_route(user_id):
    try:
        return jsonify(lock_user(g.user, user_id))
    except AuthError as err:
        return _error_response(err)


@admin_users_bp.post("/users/<user_id>/reset-password")
@require_admin
def reset_password_route(user_id):
    data = request.get_json(silent=True) or {}
    try:
        return jsonify(reset_password(g.user, user_id, data.get("password")))
    except AuthError as err:
        return _error_response(err)


@admin_users_bp.delete("/users/<user_id>")
@require_admin
def delete_user_route(user_id):
    try:
        return jsonify(delete_user(g.user, user_id))
    except AuthError as err:
        return _error_response(err)
