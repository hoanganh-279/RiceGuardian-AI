import uuid
from datetime import datetime, timezone

import jwt
from flask import current_app


def _utcnow():
    return datetime.now(timezone.utc)


def sign_token(*, user_id, role, org_ids, jti=None):
    jti = jti or str(uuid.uuid4())
    expires = _utcnow() + current_app.config["JWT_EXPIRES"]
    payload = {
        "sub": str(user_id),
        "role": role,
        "org_ids": [str(org_id) for org_id in org_ids],
        "jti": jti,
        "exp": expires,
        "iat": _utcnow(),
    }
    token = jwt.encode(payload, current_app.config["SECRET_KEY"], algorithm="HS256")
    return token, jti, expires


def decode_token(token):
    return jwt.decode(token, current_app.config["SECRET_KEY"], algorithms=["HS256"])
