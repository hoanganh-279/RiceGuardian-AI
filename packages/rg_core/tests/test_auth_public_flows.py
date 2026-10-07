"""Public auth flows: register, Google audience check, forgot/reset."""

from unittest.mock import patch

import pytest

from core import create_app
from core.config import Config
from core.extensions import db
from core.services.auth_service import AuthError, _verify_google_id_token


@pytest.fixture()
def client(tmp_path):
    db_file = tmp_path / "auth_public.db"

    class TestConfig(Config):
        TESTING = True
        DEBUG = True
        EXPOSE_RESET_TOKEN = True
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{db_file.as_posix()}"
        SQLALCHEMY_ENGINE_OPTIONS = {}

    app = create_app(TestConfig)
    with app.app_context():
        yield app.test_client()
        db.session.remove()


def test_register_farmer_and_login(client):
    with patch("core.services.user_admin_service.supabase_auth.configured", return_value=False), patch(
        "core.services.auth_service.supabase_auth.configured", return_value=False
    ):
        res = client.post(
            "/api/auth/register",
            json={
                "fullName": "Nguyen Van A",
                "email": "a@example.com",
                "phone": "0912345678",
                "password": "Secret1",
            },
        )
    assert res.status_code == 200
    body = res.get_json()
    assert body["access_token"]
    assert body["user"]["role"] == "farmer"
    assert body["user"]["phone"] == "0912345678"


def test_register_duplicate_phone(client):
    with patch("core.services.user_admin_service.supabase_auth.configured", return_value=False), patch(
        "core.services.auth_service.supabase_auth.configured", return_value=False
    ):
        first = client.post(
            "/api/auth/register",
            json={
                "fullName": "One",
                "email": "one@example.com",
                "phone": "0911111111",
                "password": "Secret1",
            },
        )
        assert first.status_code == 200
        res = client.post(
            "/api/auth/register",
            json={
                "fullName": "Two",
                "email": "two@example.com",
                "phone": "0911111111",
                "password": "Secret1",
            },
        )
    assert res.status_code == 409


def test_google_token_rejects_bad_audience(client):
    with patch.dict("os.environ", {"GOOGLE_CLIENT_IDS": "allowed-client"}, clear=False):
        with patch("requests.get") as mock_get:
            mock_get.return_value.status_code = 200
            mock_get.return_value.json.return_value = {
                "aud": "other-client",
                "email": "u@gmail.com",
                "email_verified": "true",
                "name": "U",
                "sub": "1",
            }
            with pytest.raises(AuthError):
                _verify_google_id_token("tok")


def test_forgot_and_reset_password(client):
    with patch("core.services.user_admin_service.supabase_auth.configured", return_value=False), patch(
        "core.services.auth_service.supabase_auth.configured", return_value=False
    ):
        reg = client.post(
            "/api/auth/register",
            json={
                "fullName": "Reset Me",
                "email": "reset@example.com",
                "phone": "0922222222",
                "password": "OldPass1",
            },
        )
        assert reg.status_code == 200

        forgot = client.post(
            "/api/auth/forgot-password",
            json={"identifier": "reset@example.com"},
        )
        assert forgot.status_code == 200
        token = forgot.get_json().get("resetToken")
        assert token

        reset = client.post(
            "/api/auth/reset-password",
            json={"token": token, "password": "NewPass1"},
        )
        assert reset.status_code == 200

        login = client.post(
            "/api/auth/login",
            json={"identifier": "0922222222", "password": "NewPass1"},
        )
        assert login.status_code == 200
