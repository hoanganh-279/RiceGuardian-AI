"""Flask-SocketIO helpers for farmer real-time signals."""

socketio = None


def init_socketio(app):
    global socketio
    from flask_socketio import SocketIO

    socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")
    _register_handlers()
    return socketio


def _register_handlers():
    from flask import request
    from flask_socketio import join_room

    from core.services.auth_service import AuthError, get_user_from_token_payload
    from core.utils.jwt_util import decode_token

    @socketio.on("connect")
    def on_connect(auth):
        token = None
        if isinstance(auth, dict):
            token = auth.get("token")
        if not token:
            return False
        try:
            payload = decode_token(token)
            user = get_user_from_token_payload(payload)
            if user.role != "farmer":
                return False
            join_room(f"farmer:{user.id}")
            return True
        except (AuthError, Exception):
            return False


def emit_farmer_event(user_id, event, data=None):
    if socketio is None:
        return
    socketio.emit(event, data or {}, room=f"farmer:{user_id}")
