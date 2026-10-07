from flask import Blueprint, g, jsonify, request

from core.services.article_service import (
    ArticleError,
    approve_article,
    archive_article,
    create_article,
    get_staff_article,
    get_staff_question,
    hide_question,
    list_staff_articles,
    list_staff_questions,
    publish_article,
    reject_article,
    reply_question,
    submit_for_review,
    update_article,
    upload_article_cover,
)
from core.utils.staff_decorators import require_admin, require_technician

admin_articles_bp = Blueprint("admin_articles", __name__, url_prefix="/api/admin")
tech_articles_bp = Blueprint("tech_articles", __name__, url_prefix="/api/technician")


def _err(exc):
    return jsonify({"error": exc.message}), exc.status


def _page_limit():
    page = max(1, int(request.args.get("page", 1)))
    limit = min(100, max(1, int(request.args.get("limit", 20))))
    return page, limit


def _json():
    return request.get_json(silent=True) or {}


# --- Admin articles ---


@admin_articles_bp.get("/articles")
@require_admin
def admin_list_articles():
    page, limit = _page_limit()
    pending_only = request.args.get("pendingOnly", "").lower() in ("1", "true", "yes")
    return jsonify(
        list_staff_articles(
            g.user,
            page=page,
            limit=limit,
            status=request.args.get("status", ""),
            category=request.args.get("category", ""),
            q=request.args.get("q", ""),
            pending_only=pending_only,
        )
    )


@admin_articles_bp.post("/articles")
@require_admin
def admin_create_article():
    data = _json()
    try:
        return jsonify(
            create_article(
                g.user,
                title=data.get("title"),
                summary=data.get("summary", ""),
                body=data.get("body", ""),
                cover_url=data.get("coverUrl"),
                category=data.get("category", "ky_thuat"),
            )
        ), 201
    except ArticleError as err:
        return _err(err)


@admin_articles_bp.get("/articles/<article_id>")
@require_admin
def admin_get_article(article_id):
    try:
        return jsonify(get_staff_article(g.user, article_id))
    except ArticleError as err:
        return _err(err)


@admin_articles_bp.patch("/articles/<article_id>")
@require_admin
def admin_patch_article(article_id):
    try:
        return jsonify(update_article(g.user, article_id, _json()))
    except ArticleError as err:
        return _err(err)


@admin_articles_bp.post("/articles/<article_id>/publish")
@require_admin
def admin_publish_article(article_id):
    try:
        return jsonify(publish_article(g.user, article_id))
    except ArticleError as err:
        return _err(err)


@admin_articles_bp.post("/articles/<article_id>/archive")
@require_admin
def admin_archive_article(article_id):
    try:
        return jsonify(archive_article(g.user, article_id))
    except ArticleError as err:
        return _err(err)


@admin_articles_bp.post("/articles/<article_id>/approve")
@require_admin
def admin_approve_article(article_id):
    try:
        return jsonify(approve_article(g.user, article_id))
    except ArticleError as err:
        return _err(err)


@admin_articles_bp.post("/articles/<article_id>/reject")
@require_admin
def admin_reject_article(article_id):
    data = _json()
    try:
        return jsonify(reject_article(g.user, article_id, note=data.get("note", "")))
    except ArticleError as err:
        return _err(err)


@admin_articles_bp.post("/articles/cover")
@require_admin
def admin_upload_cover():
    try:
        url = upload_article_cover(request.files.get("file") or request.files.get("image"))
        return jsonify({"coverUrl": url})
    except ArticleError as err:
        return _err(err)


@admin_articles_bp.get("/article-questions")
@require_admin
def admin_list_questions():
    page, limit = _page_limit()
    return jsonify(
        list_staff_questions(
            g.user,
            page=page,
            limit=limit,
            status=request.args.get("status", ""),
            article_id=request.args.get("articleId", ""),
            q=request.args.get("q", ""),
        )
    )


@admin_articles_bp.get("/article-questions/<question_id>")
@require_admin
def admin_get_question(question_id):
    try:
        return jsonify(get_staff_question(g.user, question_id))
    except ArticleError as err:
        return _err(err)


@admin_articles_bp.post("/article-questions/<question_id>/reply")
@require_admin
def admin_reply_question(question_id):
    data = _json()
    try:
        return jsonify(
            reply_question(
                g.user,
                question_id,
                answer_body=data.get("answerBody", ""),
                is_public=bool(data.get("isPublic")),
                notify=data.get("notify", True) is not False,
            )
        )
    except ArticleError as err:
        return _err(err)


@admin_articles_bp.post("/article-questions/<question_id>/hide")
@require_admin
def admin_hide_question(question_id):
    try:
        return jsonify(hide_question(g.user, question_id))
    except ArticleError as err:
        return _err(err)


# --- Technician articles ---


@tech_articles_bp.get("/articles")
@require_technician
def tech_list_articles():
    page, limit = _page_limit()
    return jsonify(
        list_staff_articles(
            g.user,
            page=page,
            limit=limit,
            status=request.args.get("status", ""),
            category=request.args.get("category", ""),
            q=request.args.get("q", ""),
        )
    )


@tech_articles_bp.post("/articles")
@require_technician
def tech_create_article():
    data = _json()
    try:
        return jsonify(
            create_article(
                g.user,
                title=data.get("title"),
                summary=data.get("summary", ""),
                body=data.get("body", ""),
                cover_url=data.get("coverUrl"),
                category=data.get("category", "ky_thuat"),
            )
        ), 201
    except ArticleError as err:
        return _err(err)


@tech_articles_bp.get("/articles/<article_id>")
@require_technician
def tech_get_article(article_id):
    try:
        return jsonify(get_staff_article(g.user, article_id))
    except ArticleError as err:
        return _err(err)


@tech_articles_bp.patch("/articles/<article_id>")
@require_technician
def tech_patch_article(article_id):
    try:
        return jsonify(update_article(g.user, article_id, _json()))
    except ArticleError as err:
        return _err(err)


@tech_articles_bp.post("/articles/<article_id>/submit-review")
@require_technician
def tech_submit_review(article_id):
    try:
        return jsonify(submit_for_review(g.user, article_id))
    except ArticleError as err:
        return _err(err)


@tech_articles_bp.post("/articles/cover")
@require_technician
def tech_upload_cover():
    try:
        url = upload_article_cover(request.files.get("file") or request.files.get("image"))
        return jsonify({"coverUrl": url})
    except ArticleError as err:
        return _err(err)


@tech_articles_bp.get("/article-questions")
@require_technician
def tech_list_questions():
    page, limit = _page_limit()
    return jsonify(
        list_staff_questions(
            g.user,
            page=page,
            limit=limit,
            status=request.args.get("status", ""),
            article_id=request.args.get("articleId", ""),
            q=request.args.get("q", ""),
        )
    )


@tech_articles_bp.get("/article-questions/<question_id>")
@require_technician
def tech_get_question(question_id):
    try:
        return jsonify(get_staff_question(g.user, question_id))
    except ArticleError as err:
        return _err(err)


@tech_articles_bp.post("/article-questions/<question_id>/reply")
@require_technician
def tech_reply_question(question_id):
    data = _json()
    try:
        return jsonify(
            reply_question(
                g.user,
                question_id,
                answer_body=data.get("answerBody", ""),
                is_public=bool(data.get("isPublic")),
                notify=data.get("notify", True) is not False,
            )
        )
    except ArticleError as err:
        return _err(err)


@tech_articles_bp.post("/article-questions/<question_id>/hide")
@require_technician
def tech_hide_question(question_id):
    try:
        return jsonify(hide_question(g.user, question_id))
    except ArticleError as err:
        return _err(err)
