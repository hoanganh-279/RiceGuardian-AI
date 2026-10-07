"""Site contact Google login does not create farmer users."""

from unittest.mock import patch

import pytest

from core import create_app
from core.config import Config
from core.extensions import db
from core.models import SiteContactIdentity, User
from core.services.auth_service import AuthError


@pytest.fixture()
def client(tmp_path):
    db_file = tmp_path / "site_contact.db"

    class TestConfig(Config):
        TESTING = True
        DEBUG = True
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{db_file.as_posix()}"
        SQLALCHEMY_ENGINE_OPTIONS = {}
        SITE_GOOGLE_CLIENT_ID = "site-client.apps.googleusercontent.com"
        SMTP_USER = "riceguardianai@gmail.com"
        SMTP_PASSWORD = "app-password"
        CONTACT_INBOX = "riceguardianai@gmail.com"

    app = create_app(TestConfig)
    with app.app_context():
        yield app.test_client()
        db.session.remove()


def test_contact_requires_site_session(client):
    res = client.post("/api/site/contact", json={"name": "A", "message": "xin chao ban"})
    assert res.status_code == 401


def test_first_google_login_sends_code_without_farmer_user(client):
    profile = {"email": "guest@gmail.com", "full_name": "Guest", "sub": "sub-1"}
    with patch("core.services.site_contact_service._google_profile", return_value=profile), patch(
        "core.services.site_contact_service.send_mail"
    ) as send_mail:
        res = client.post("/api/site/auth/google", json={"accessToken": "token"})

    assert res.status_code == 200
    assert res.get_json()["needsVerification"] is True
    assert res.get_json()["email"] == "guest@gmail.com"
    send_mail.assert_called_once()
    assert User.query.filter_by(email="guest@gmail.com").first() is None
    assert SiteContactIdentity.query.filter_by(email="guest@gmail.com").first() is not None


def test_verify_code_then_contact_uses_verified_gmail(client):
    profile = {"email": "guest@gmail.com", "full_name": "Guest", "sub": "sub-1"}
    sent = {}

    def capture_mail(**kwargs):
        sent["kwargs"] = kwargs

    with patch("core.services.site_contact_service._google_profile", return_value=profile), patch(
        "core.services.site_contact_service.send_mail", side_effect=capture_mail
    ):
        client.post("/api/site/auth/google", json={"accessToken": "token"})
        body = sent["kwargs"]["body"]
        code = body.split(":")[-1].strip().split()[0]
        verified = client.post("/api/site/auth/verify", json={"email": "guest@gmail.com", "code": code})
        token = verified.get_json()["accessToken"]
        sent.clear()
        contact = client.post(
            "/api/site/contact",
            json={"name": "Guest", "message": "Toi muon hoi ve giai phap"},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert verified.status_code == 200
    assert contact.status_code == 200
    assert sent["kwargs"]["to"] == "riceguardianai@gmail.com"
    assert sent["kwargs"]["reply_to"] == "guest@gmail.com"


def test_google_profile_rejected_without_client(client):
    with patch("core.services.site_contact_service._google_profile", side_effect=AuthError("no", status=503)):
        res = client.post("/api/site/auth/google", json={"accessToken": "token"})
    assert res.status_code == 503
