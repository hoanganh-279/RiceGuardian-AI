"""Article CMS + Q&A: KTV review gate, farmer published-only, reply notifications."""

from uuid import UUID

import pytest

from core import create_app
from core.config import Config
from core.extensions import db
from core.models import Article, Notification, User
from core.services import article_service
from core.services.article_service import ArticleError
from core.services.seed import USR_ADMIN, USR_FARMER, USR_KTV


@pytest.fixture()
def app_ctx(tmp_path):
    db_file = tmp_path / "articles.db"

    class TestConfig(Config):
        TESTING = True
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{db_file.as_posix()}"
        SQLALCHEMY_ENGINE_OPTIONS = {}

    app = create_app(TestConfig)
    with app.app_context():
        admin = db.session.get(User, USR_ADMIN)
        ktv = db.session.get(User, USR_KTV)
        farmer = db.session.get(User, USR_FARMER)
        assert admin and ktv and farmer
        yield app, admin, ktv, farmer
        db.session.remove()


def test_ktv_cannot_publish_directly(app_ctx):
    _, admin, ktv, _farmer = app_ctx
    created = article_service.create_article(
        ktv,
        title="Hướng dẫn ẩm cao",
        summary="Tóm tắt",
        body="Nội dung chi tiết về độ ẩm.",
        category="ky_thuat",
    )
    article_id = created["id"]
    with pytest.raises(ArticleError) as exc:
        article_service.publish_article(ktv, article_id)
    assert exc.value.status == 403

    submitted = article_service.submit_for_review(ktv, article_id)
    assert submitted["status"] == "pending_review"

    published = article_service.approve_article(admin, article_id)
    assert published["status"] == "published"
    assert published["publishedAt"]


def test_admin_publish_own_draft(app_ctx):
    _, admin, _ktv, _farmer = app_ctx
    created = article_service.create_article(
        admin,
        title="Cập nhật hệ thống",
        body="Bảo trì tối nay.",
        category="he_thong",
    )
    published = article_service.publish_article(admin, created["id"])
    assert published["status"] == "published"


def test_farmer_only_sees_published(app_ctx):
    _, admin, ktv, farmer = app_ctx
    draft = article_service.create_article(ktv, title="Nháp KTV", body="Chưa duyệt.")
    pub = article_service.create_article(admin, title="Tin đã xuất bản", body="Nội dung công khai.")
    article_service.publish_article(admin, pub["id"])

    listed = article_service.list_published_articles()
    ids = {item["id"] for item in listed["items"]}
    assert pub["id"] in ids
    assert draft["id"] not in ids

    with pytest.raises(ArticleError) as exc:
        article_service.get_published_article(draft["id"])
    assert exc.value.status == 404

    detail = article_service.get_published_article(pub["id"])
    assert detail["title"] == "Tin đã xuất bản"


def test_reply_creates_article_reply_notification(app_ctx):
    _, admin, _ktv, farmer = app_ctx
    created = article_service.create_article(
        admin,
        title="Cháy lá sớm",
        body="Cách nhận biết cháy lá.",
        category="canh_bao",
    )
    article_service.publish_article(admin, created["id"])
    question = article_service.create_question(
        farmer,
        created["id"],
        "Ruộng tôi có đốm lá nâu thì có phải cháy lá không ạ?",
    )
    answered = article_service.reply_question(
        admin,
        question["id"],
        answer_body="Cần xem thêm ảnh lá bệnh qua App để xác nhận.",
        is_public=True,
        notify=True,
    )
    assert answered["status"] == "answered"
    assert answered["isPublic"] is True

    notif = Notification.query.filter_by(
        user_id=farmer.id,
        type="article_reply",
        related_question_id=UUID(question["id"]),
    ).first()
    assert notif is not None
    assert notif.related_article_id == UUID(created["id"])
    assert "Cháy lá sớm" in (notif.body or "")


def test_reject_returns_to_draft(app_ctx):
    _, admin, ktv, _farmer = app_ctx
    created = article_service.create_article(ktv, title="Bài cần sửa", body="Nội dung sơ sài.")
    article_service.submit_for_review(ktv, created["id"])
    rejected = article_service.reject_article(admin, created["id"], note="Bổ sung ảnh minh họa.")
    assert rejected["status"] == "draft"
    assert "ảnh" in rejected["reviewNote"].lower() or "Bổ sung" in rejected["reviewNote"]


def test_http_farmer_articles_and_ktv_forbidden_publish(app_ctx):
    app, admin, ktv, farmer = app_ctx
    client = app.test_client()

    from core.services.auth_service import login
    from core.services.seed import DEMO_PASSWORD

    admin_token = login(admin.email, DEMO_PASSWORD)["access_token"]
    ktv_token = login(ktv.email, DEMO_PASSWORD)["access_token"]
    farmer_token = login(farmer.phone or farmer.email, DEMO_PASSWORD)["access_token"]

    create_resp = client.post(
        "/api/technician/articles",
        json={"title": "HTTP bài KTV", "body": "Nội dung đủ dài."},
        headers={"Authorization": f"Bearer {ktv_token}"},
    )
    assert create_resp.status_code == 201
    article_id = create_resp.get_json()["id"]

    pub_forbidden = client.post(
        f"/api/admin/articles/{article_id}/publish",
        headers={"Authorization": f"Bearer {ktv_token}"},
    )
    assert pub_forbidden.status_code == 403

    submit = client.post(
        f"/api/technician/articles/{article_id}/submit-review",
        headers={"Authorization": f"Bearer {ktv_token}"},
    )
    assert submit.status_code == 200
    assert submit.get_json()["status"] == "pending_review"

    approve = client.post(
        f"/api/admin/articles/{article_id}/approve",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert approve.status_code == 200
    assert approve.get_json()["status"] == "published"

    listed = client.get(
        "/api/farmer/articles",
        headers={"Authorization": f"Bearer {farmer_token}"},
    )
    assert listed.status_code == 200
    assert any(item["id"] == article_id for item in listed.get_json()["items"])
