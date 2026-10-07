"""B1 farmer account CRUD syncs with Supabase Auth (mocked)."""

from uuid import UUID

import pytest

from core import create_app
from core.config import Config
from core.extensions import db
from core.models import User
from core.services import user_admin_service
from core.services.auth_service import AuthError
from core.services.seed import USR_ADMIN
from unittest.mock import patch


USR_FARMER_NEW = UUID("22222222-2222-4222-8222-222222222099")


@pytest.fixture()
def app_ctx(tmp_path):
    db_file = tmp_path / "farmer_admin.db"

    class TestConfig(Config):
        TESTING = True
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{db_file.as_posix()}"
        SQLALCHEMY_ENGINE_OPTIONS = {}

    app = create_app(TestConfig)
    with app.app_context():
        admin = db.session.get(User, USR_ADMIN)
        assert admin is not None
        yield app, admin
        db.session.remove()


def test_create_farmer_calls_ensure_user_with_matching_uuid(app_ctx):
    _, admin = app_ctx
    auth_payload = {"id": str(USR_FARMER_NEW)}

    with (
        patch("core.services.user_admin_service.supabase_auth.configured", return_value=True),
        patch(
            "core.services.user_admin_service.supabase_auth.resolve_auth_email",
            return_value="newfarmer@demo.vn",
        ),
        patch(
            "core.services.user_admin_service.supabase_auth.ensure_user",
            return_value=auth_payload,
        ) as ensure,
        patch("core.services.user_admin_service.uuid.uuid4", return_value=USR_FARMER_NEW),
    ):
        item = user_admin_service.create_user(
            admin,
            full_name="Pham Van Dat",
            email="newfarmer@demo.vn",
            phone="0909999999",
            role="farmer",
            password="Demo@123",
        )

    ensure.assert_called_once()
    assert ensure.call_args.kwargs["user_id"] == USR_FARMER_NEW
    assert ensure.call_args.kwargs["role"] == "farmer"
    assert item["id"] == str(USR_FARMER_NEW)
    assert item["role"] == "farmer"
    assert db.session.get(User, USR_FARMER_NEW) is not None


def test_create_farmer_rejects_auth_uuid_mismatch(app_ctx):
    _, admin = app_ctx
    with (
        patch("core.services.user_admin_service.supabase_auth.configured", return_value=True),
        patch(
            "core.services.user_admin_service.supabase_auth.resolve_auth_email",
            return_value="mismatch@demo.vn",
        ),
        patch(
            "core.services.user_admin_service.supabase_auth.ensure_user",
            return_value={"id": "11111111-1111-4111-8111-111111111001"},
        ),
        patch("core.services.user_admin_service.uuid.uuid4", return_value=USR_FARMER_NEW),
    ):
        with pytest.raises(AuthError) as exc:
            user_admin_service.create_user(
                admin,
                full_name="X",
                email="mismatch@demo.vn",
                phone="0908888888",
                role="farmer",
            )
    assert exc.value.status == 409


def test_lock_reset_delete_call_supabase(app_ctx):
    _, admin = app_ctx
    farmer = User(
        id=USR_FARMER_NEW,
        email="tempfarmer@demo.vn",
        phone="0907777777",
        full_name="Farmer",
        role="farmer",
        status="active",
        password_hash=None,
    )
    db.session.add(farmer)
    db.session.commit()

    with (
        patch("core.services.user_admin_service.supabase_auth.configured", return_value=True),
        patch("core.services.user_admin_service.supabase_auth.set_banned") as ban,
        patch("core.services.user_admin_service.supabase_auth.update_password") as reset,
        patch("core.services.user_admin_service.supabase_auth.delete_user") as delete,
    ):
        locked = user_admin_service.lock_user(admin, USR_FARMER_NEW)
        assert locked["status"] == "locked"
        ban.assert_called_with(USR_FARMER_NEW, True)

        result = user_admin_service.reset_password(admin, USR_FARMER_NEW, "Temp@1234")
        assert result["temporaryPassword"] == "Temp@1234"
        reset.assert_called_with(USR_FARMER_NEW, "Temp@1234")
        refreshed = db.session.get(User, USR_FARMER_NEW)
        assert refreshed.password_display == "Temp@1234"

        user_admin_service.delete_user(admin, USR_FARMER_NEW)
        delete.assert_called_with(USR_FARMER_NEW)

    assert db.session.get(User, USR_FARMER_NEW) is None
