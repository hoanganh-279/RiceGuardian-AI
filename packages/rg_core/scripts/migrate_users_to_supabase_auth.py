"""Ensure demo farmer exists and sync public.users → Supabase Auth (matching UUIDs)."""

import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core import create_app
from core.extensions import db
from core.models import User, UserOrganization
from core.services import supabase_auth
from core.services.seed import DEMO_PASSWORD, ORG_DT, USR_FARMER
from core.services.user_admin_service import DEFAULT_PASSWORD

DEMO_FARMER = {
    "id": USR_FARMER,
    "email": "farmer@demo.vn",
    "phone": "0901234567",
    "full_name": "Phạm Văn Đạt",
    "role": "farmer",
}


def _utcnow():
    return datetime.now(timezone.utc)


def ensure_demo_farmer():
    """Insert seed farmer if missing (by id or phone)."""
    existing = db.session.get(User, USR_FARMER)
    if existing:
        print(f"farmer exists id={existing.id} email={existing.email}")
        return existing

    by_phone = User.query.filter_by(phone=DEMO_FARMER["phone"]).first()
    if by_phone:
        print(f"farmer exists by phone id={by_phone.id} email={by_phone.email}")
        return by_phone

    user = User(
        id=DEMO_FARMER["id"],
        email=DEMO_FARMER["email"],
        phone=DEMO_FARMER["phone"],
        full_name=DEMO_FARMER["full_name"],
        role=DEMO_FARMER["role"],
        status="active",
        password_hash=None,
        created_at=_utcnow(),
        updated_at=_utcnow(),
    )
    db.session.add(user)
    if ORG_DT and not UserOrganization.query.filter_by(user_id=USR_FARMER, org_id=ORG_DT).first():
        # Only link if org row exists
        from core.models import Organization

        if db.session.get(Organization, ORG_DT):
            db.session.add(UserOrganization(user_id=USR_FARMER, org_id=ORG_DT))
    db.session.commit()
    print(f"created demo farmer {user.email} phone={user.phone}")
    return user


def verify_auth_alignment(users):
    mismatched = []
    for user in users:
        auth_user = supabase_auth.get_user(user.id)
        if not auth_user:
            mismatched.append((user.email, "missing_in_auth"))
            continue
        auth_email = str(auth_user.get("email") or "").lower()
        if auth_email != str(user.email or "").lower():
            mismatched.append((user.email, f"auth_email={auth_email}"))
    return mismatched


app = create_app()

with app.app_context():
    if not supabase_auth.configured():
        raise SystemExit("Set SUPABASE_URL and SUPABASE_SERVICE_KEY before migrating.")

    password = os.getenv("DEFAULT_USER_PASSWORD", DEFAULT_PASSWORD or DEMO_PASSWORD)
    ensure_demo_farmer()

    ok = 0
    failed = 0
    users = User.query.order_by(User.created_at.asc()).all()
    for user in users:
        try:
            created = supabase_auth.ensure_user(
                user_id=user.id,
                email=user.email,
                password=password,
                full_name=user.full_name,
                role=user.role,
                phone=user.phone,
            )
            auth_id = str(created.get("id") or "") if isinstance(created, dict) else ""
            if auth_id and auth_id != str(user.id):
                raise RuntimeError(f"UUID mismatch public={user.id} auth={auth_id}")
            # Auth owns passwords when configured. SQLite demo DBs may still enforce
            # NOT NULL on password_hash — keep the local hash there.
            if db.engine.dialect.name != "sqlite":
                user.password_hash = None
            user.updated_at = _utcnow()
            db.session.commit()
            ok += 1
            print(f"ok  {user.email} ({user.role})")
        except Exception as err:
            db.session.rollback()
            failed += 1
            print(f"fail {user.email}: {err}")

    mismatches = verify_auth_alignment(User.query.all()) if failed == 0 else []
    if mismatches:
        print("VERIFY FAIL:")
        for email, reason in mismatches:
            print(f"  {email}: {reason}")
        raise SystemExit(1)

    print(f"Done. synced={ok} failed={failed} password={password}")
    if failed:
        raise SystemExit(1)
