"""Bản tin nông dân + hỏi–đáp (tách khỏi D4 alert feedback)."""

from __future__ import annotations

import uuid

from core.extensions import db
from core.models import Article, ArticleQuestion, Notification, User
from core.models.business import utcnow
from core.services.storage_service import upload_image_file
from core.services.user_admin_service import write_audit

ARTICLE_CATEGORIES = frozenset({"ky_thuat", "canh_bao", "he_thong"})
ARTICLE_STATUSES = frozenset({"draft", "pending_review", "published", "archived"})
QUESTION_STATUSES = frozenset({"open", "answered", "hidden"})


class ArticleError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.message = message
        self.status = status


def _parse_uuid(value, label="id"):
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError) as err:
        raise ArticleError(f"{label} không hợp lệ.", status=400) from err


def _paginate(query, page, limit):
    page = max(1, int(page or 1))
    limit = min(100, max(1, int(limit or 20)))
    total = query.count()
    items = query.offset((page - 1) * limit).limit(limit).all()
    return items, page, limit, total


def _normalize_category(category):
    value = (category or "ky_thuat").strip().lower()
    if value not in ARTICLE_CATEGORIES:
        raise ArticleError("Chuyên mục không hợp lệ.", status=400)
    return value


def _get_article(article_id):
    article = db.session.get(Article, _parse_uuid(article_id, "articleId"))
    if not article:
        raise ArticleError("Không tìm thấy bài viết.", status=404)
    return article


def _get_question(question_id):
    question = db.session.get(ArticleQuestion, _parse_uuid(question_id, "questionId"))
    if not question:
        raise ArticleError("Không tìm thấy câu hỏi.", status=404)
    return question


def _assert_staff_can_edit_article(user, article):
    if user.role == "admin":
        return
    if user.role == "technician" and article.author_id == user.id:
        if article.status in ("draft", "pending_review"):
            return
        raise ArticleError("Chỉ sửa được bài nháp hoặc đang chờ duyệt của bạn.", status=403)
    raise ArticleError("Không có quyền sửa bài này.", status=403)


def upload_article_cover(file_storage, filename_hint=None):
    if not file_storage:
        raise ArticleError("Thiếu tệp ảnh bìa.", status=400)
    content_type = (getattr(file_storage, "content_type", None) or "").lower()
    if content_type and not content_type.startswith("image/"):
        raise ArticleError("Chỉ chấp nhận tệp ảnh.", status=400)
    try:
        return upload_image_file(file_storage, "articles", filename_hint=filename_hint)
    except ValueError as err:
        raise ArticleError(str(err), status=400) from err


def list_staff_articles(user, *, page=1, limit=20, status="", category="", q="", pending_only=False):
    query = Article.query
    if pending_only:
        if user.role != "admin":
            raise ArticleError("Chỉ Admin xem hàng đợi duyệt.", status=403)
        query = query.filter(Article.status == "pending_review")
    elif user.role == "technician":
        query = query.filter(Article.author_id == user.id)
    if status and status in ARTICLE_STATUSES:
        query = query.filter(Article.status == status)
    if category and category in ARTICLE_CATEGORIES:
        query = query.filter(Article.category == category)
    q = (q or "").strip()
    if q:
        like = f"%{q}%"
        query = query.filter(db.or_(Article.title.ilike(like), Article.summary.ilike(like)))
    query = query.order_by(Article.updated_at.desc())
    items, page, limit, total = _paginate(query, page, limit)
    return {"items": [a.to_list_item() for a in items], "page": page, "limit": limit, "total": total}


def get_staff_article(user, article_id):
    article = _get_article(article_id)
    if user.role == "technician" and article.author_id != user.id and article.status != "published":
        raise ArticleError("Không có quyền xem bài này.", status=403)
    return article.to_detail()


def create_article(user, *, title, summary="", body="", cover_url=None, category="ky_thuat"):
    title = (title or "").strip()
    if not title:
        raise ArticleError("Tiêu đề bắt buộc.", status=400)
    article = Article(
        title=title,
        summary=(summary or "").strip(),
        body=(body or "").strip(),
        cover_url=cover_url or None,
        category=_normalize_category(category),
        status="draft",
        author_id=user.id,
    )
    db.session.add(article)
    db.session.commit()
    write_audit(user, "article_create", str(article.id), article.title)
    return article.to_detail()


def update_article(user, article_id, data):
    article = _get_article(article_id)
    _assert_staff_can_edit_article(user, article)
    if "title" in data:
        title = (data.get("title") or "").strip()
        if not title:
            raise ArticleError("Tiêu đề bắt buộc.", status=400)
        article.title = title
    if "summary" in data:
        article.summary = (data.get("summary") or "").strip()
    if "body" in data:
        article.body = (data.get("body") or "").strip()
    if "coverUrl" in data:
        article.cover_url = data.get("coverUrl") or None
    if "category" in data:
        article.category = _normalize_category(data.get("category"))
    if user.role == "technician" and article.status == "pending_review":
        # Editing while pending keeps pending; author may still tweak before admin acts.
        pass
    article.updated_at = utcnow()
    db.session.commit()
    return article.to_detail()


def submit_for_review(user, article_id):
    article = _get_article(article_id)
    if user.role not in ("technician", "admin"):
        raise ArticleError("Không có quyền gửi duyệt.", status=403)
    if user.role == "technician" and article.author_id != user.id:
        raise ArticleError("Chỉ gửi duyệt bài của bạn.", status=403)
    if article.status not in ("draft",):
        raise ArticleError("Chỉ gửi duyệt từ trạng thái nháp.", status=400)
    if not (article.title or "").strip() or not (article.body or "").strip():
        raise ArticleError("Bài cần có tiêu đề và nội dung trước khi gửi duyệt.", status=400)
    if user.role == "admin":
        return publish_article(user, article_id)
    article.status = "pending_review"
    article.review_note = None
    article.updated_at = utcnow()
    db.session.commit()
    write_audit(user, "article_submit_review", str(article.id), article.title)
    return article.to_detail()


def publish_article(user, article_id):
    if user.role != "admin":
        raise ArticleError("Chỉ Admin được xuất bản trực tiếp.", status=403)
    article = _get_article(article_id)
    if article.status == "archived":
        raise ArticleError("Bài đã lưu trữ — không xuất bản lại từ đây. Tạo bản mới nếu cần.", status=400)
    if not (article.title or "").strip() or not (article.body or "").strip():
        raise ArticleError("Bài cần có tiêu đề và nội dung.", status=400)
    now = utcnow()
    article.status = "published"
    article.published_at = article.published_at or now
    article.reviewed_by_id = user.id
    article.reviewed_at = now
    article.review_note = None
    article.updated_at = now
    db.session.commit()
    write_audit(user, "article_publish", str(article.id), article.title)
    return article.to_detail()


def approve_article(user, article_id):
    if user.role != "admin":
        raise ArticleError("Chỉ Admin duyệt bài.", status=403)
    article = _get_article(article_id)
    if article.status != "pending_review":
        raise ArticleError("Bài không ở trạng thái chờ duyệt.", status=400)
    return publish_article(user, article_id)


def reject_article(user, article_id, note=""):
    if user.role != "admin":
        raise ArticleError("Chỉ Admin từ chối duyệt.", status=403)
    article = _get_article(article_id)
    if article.status != "pending_review":
        raise ArticleError("Bài không ở trạng thái chờ duyệt.", status=400)
    article.status = "draft"
    article.review_note = (note or "").strip() or "Cần chỉnh sửa trước khi xuất bản."
    article.reviewed_by_id = user.id
    article.reviewed_at = utcnow()
    article.updated_at = utcnow()
    db.session.commit()
    write_audit(user, "article_reject", str(article.id), article.review_note)
    return article.to_detail()


def archive_article(user, article_id):
    if user.role != "admin":
        raise ArticleError("Chỉ Admin lưu trữ bài.", status=403)
    article = _get_article(article_id)
    article.status = "archived"
    article.updated_at = utcnow()
    db.session.commit()
    write_audit(user, "article_archive", str(article.id), article.title)
    return article.to_detail()


def list_published_articles(*, page=1, limit=20, category="", q=""):
    query = Article.query.filter(Article.status == "published")
    if category and category in ARTICLE_CATEGORIES:
        query = query.filter(Article.category == category)
    q = (q or "").strip()
    if q:
        like = f"%{q}%"
        query = query.filter(db.or_(Article.title.ilike(like), Article.summary.ilike(like)))
    query = query.order_by(Article.published_at.desc(), Article.created_at.desc())
    items, page, limit, total = _paginate(query, page, limit)
    return {"items": [a.to_list_item() for a in items], "page": page, "limit": limit, "total": total}


def get_published_article(article_id):
    article = _get_article(article_id)
    if article.status != "published":
        raise ArticleError("Bài viết không khả dụng.", status=404)
    return article.to_detail(include_public_faq=True)


def create_question(farmer, article_id, body):
    article = _get_article(article_id)
    if article.status != "published":
        raise ArticleError("Chỉ hỏi trên bài đã xuất bản.", status=400)
    text = (body or "").strip()
    if len(text) < 10:
        raise ArticleError("Câu hỏi cần ít nhất 10 ký tự.", status=400)
    if len(text) > 2000:
        raise ArticleError("Câu hỏi tối đa 2000 ký tự.", status=400)
    question = ArticleQuestion(
        article_id=article.id,
        farmer_id=farmer.id,
        body=text,
        status="open",
    )
    db.session.add(question)
    db.session.commit()
    return question.to_public()


def list_staff_questions(user, *, page=1, limit=20, status="", article_id="", q=""):
    query = ArticleQuestion.query.join(Article)
    if status and status in QUESTION_STATUSES:
        query = query.filter(ArticleQuestion.status == status)
    if article_id:
        query = query.filter(ArticleQuestion.article_id == _parse_uuid(article_id, "articleId"))
    q = (q or "").strip()
    if q:
        like = f"%{q}%"
        query = query.join(User, User.id == ArticleQuestion.farmer_id).filter(
            db.or_(ArticleQuestion.body.ilike(like), Article.title.ilike(like), User.full_name.ilike(like))
        )
    query = query.order_by(ArticleQuestion.created_at.desc())
    items, page, limit, total = _paginate(query, page, limit)
    return {"items": [row.to_public() for row in items], "page": page, "limit": limit, "total": total}


def get_staff_question(user, question_id):
    return _get_question(question_id).to_public()


def reply_question(user, question_id, *, answer_body, is_public=False, notify=True):
    if user.role not in ("admin", "technician"):
        raise ArticleError("Không có quyền trả lời.", status=403)
    question = _get_question(question_id)
    if question.status == "hidden":
        raise ArticleError("Câu hỏi đã bị ẩn.", status=400)
    text = (answer_body or "").strip()
    if len(text) < 5:
        raise ArticleError("Câu trả lời quá ngắn.", status=400)
    question.answer_body = text
    question.answered_by_id = user.id
    question.answered_at = utcnow()
    question.status = "answered"
    question.is_public = bool(is_public)
    db.session.add(question)

    notif = None
    if notify:
        article_title = question.article.title if question.article else ""
        notif = Notification(
            user_id=question.farmer_id,
            type="article_reply",
            title="Có câu trả lời mới",
            body=f"Đã trả lời thắc mắc về: {article_title}",
            related_article_id=question.article_id,
            related_question_id=question.id,
        )
        db.session.add(notif)

    db.session.commit()

    if notif is not None:
        try:
            from core.realtime import emit_farmer_event

            emit_farmer_event(question.farmer_id, "notification:new", {})
        except Exception:
            pass

    return question.to_public()


def hide_question(user, question_id):
    if user.role not in ("admin", "technician"):
        raise ArticleError("Không có quyền ẩn câu hỏi.", status=403)
    question = _get_question(question_id)
    question.status = "hidden"
    question.is_public = False
    db.session.commit()
    return question.to_public()


def list_my_questions(farmer, *, page=1, limit=20, status=""):
    query = ArticleQuestion.query.filter(ArticleQuestion.farmer_id == farmer.id)
    if status and status in QUESTION_STATUSES:
        query = query.filter(ArticleQuestion.status == status)
    query = query.order_by(ArticleQuestion.created_at.desc())
    items, page, limit, total = _paginate(query, page, limit)
    return {"items": [q.to_public() for q in items], "page": page, "limit": limit, "total": total}


def get_my_question(farmer, question_id):
    question = _get_question(question_id)
    if question.farmer_id != farmer.id:
        raise ArticleError("Không có quyền xem câu hỏi này.", status=403)
    if question.status == "hidden":
        raise ArticleError("Câu hỏi không khả dụng.", status=404)
    return question.to_public()
