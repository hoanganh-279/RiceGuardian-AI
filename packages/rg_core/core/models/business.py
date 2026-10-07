import uuid
from datetime import datetime, timezone

from core.extensions import db


def utcnow():
    return datetime.now(timezone.utc)


class Field(db.Model):
    __tablename__ = "fields"

    id = db.Column(db.Uuid, primary_key=True, default=uuid.uuid4)
    org_id = db.Column(db.Uuid, db.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name = db.Column(db.String, nullable=False)
    area_ha = db.Column(db.Float, nullable=False, default=0)
    variety = db.Column(db.String, nullable=True)
    lat = db.Column(db.Float, nullable=True)
    lng = db.Column(db.Float, nullable=True)
    boundary_geojson = db.Column(db.JSON, nullable=True)
    cover_image_url = db.Column(db.String, nullable=True)
    cover_file_name = db.Column(db.String, nullable=True)
    cover_outline = db.Column(db.JSON, nullable=True)
    cover_source = db.Column(db.String, nullable=True)
    cover_ms_url = db.Column(db.String, nullable=True)
    cover_ms_file_name = db.Column(db.String, nullable=True)
    blb_mask_url = db.Column(db.String, nullable=True)
    blb_disease_pct = db.Column(db.Float, nullable=True)
    blb_stats = db.Column(db.JSON, nullable=True)
    blb_inferred_at = db.Column(db.DateTime(timezone=True), nullable=True)
    status = db.Column(db.String, nullable=False, default="active")
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    organization = db.relationship("Organization", backref="fields")
    farmers = db.relationship("FarmerField", back_populates="field", lazy="dynamic")
    seasons = db.relationship("Season", back_populates="field", lazy="dynamic")
    stations = db.relationship("IotStation", back_populates="field", lazy="dynamic")

    def cover_public(self):
        cover_url = self.cover_image_url or None
        if cover_url:
            source = (self.cover_source or "upload").strip().lower()
            if source not in ("upload", "uav"):
                source = "upload"
        else:
            source = "none"
        inferred = self.blb_inferred_at
        return {
            "coverUrl": cover_url,
            "coverSource": source,
            "coverFileName": self.cover_file_name or None,
            "coverOutline": self.cover_outline or None,
            "coverImageUrl": cover_url,
            "coverMsUrl": self.cover_ms_url or None,
            "coverMsFileName": self.cover_ms_file_name or None,
            "blbMaskUrl": self.blb_mask_url or None,
            "blbDiseasePct": self.blb_disease_pct,
            "blbStats": self.blb_stats or None,
            "blbInferredAt": inferred.isoformat() if inferred else None,
        }

    def to_list_item(self, current_season_name=None):
        data = {
            "id": str(self.id),
            "orgId": str(self.org_id),
            "name": self.name,
            "areaHa": self.area_ha,
            "variety": self.variety or "",
            "currentSeason": current_season_name or "",
            "lat": self.lat,
            "lng": self.lng,
        }
        data.update(self.cover_public())
        return data

    def to_detail(self, current_season=None):
        data = self.to_list_item(current_season.name if current_season else None)
        data["boundaryGeojson"] = self.boundary_geojson
        if current_season:
            data["season"] = current_season.to_public()
        return data


class FarmerField(db.Model):
    __tablename__ = "farmer_fields"

    farmer_id = db.Column(db.Uuid, db.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    field_id = db.Column(db.Uuid, db.ForeignKey("fields.id", ondelete="CASCADE"), primary_key=True)
    assigned_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    farmer = db.relationship("User", backref="assigned_fields")
    field = db.relationship("Field", back_populates="farmers")


class Season(db.Model):
    __tablename__ = "seasons"

    id = db.Column(db.Uuid, primary_key=True, default=uuid.uuid4)
    field_id = db.Column(db.Uuid, db.ForeignKey("fields.id", ondelete="CASCADE"), nullable=False)
    name = db.Column(db.String, nullable=False)
    start_date = db.Column(db.Date, nullable=True)
    end_date = db.Column(db.Date, nullable=True)
    status = db.Column(db.String, nullable=False, default="active")

    field = db.relationship("Field", back_populates="seasons")

    def to_public(self):
        return {
            "id": str(self.id),
            "name": self.name,
            "startDate": self.start_date.isoformat() if self.start_date else None,
            "endDate": self.end_date.isoformat() if self.end_date else None,
            "status": self.status,
        }


class Photo(db.Model):
    __tablename__ = "photos"

    id = db.Column(db.Uuid, primary_key=True, default=uuid.uuid4)
    field_id = db.Column(db.Uuid, db.ForeignKey("fields.id", ondelete="CASCADE"), nullable=False)
    farmer_id = db.Column(db.Uuid, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    image_url = db.Column(db.String, nullable=False)
    disease = db.Column(db.String, nullable=True)
    confidence = db.Column(db.Float, nullable=True)
    lat = db.Column(db.Float, nullable=True)
    lng = db.Column(db.Float, nullable=True)
    captured_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    reviewed = db.Column(db.Boolean, nullable=False, default=False)
    rescan_disease = db.Column(db.String, nullable=True)
    rescan_class = db.Column(db.String, nullable=True)
    rescan_confidence = db.Column(db.Float, nullable=True)
    rescan_at = db.Column(db.DateTime(timezone=True), nullable=True)

    field = db.relationship("Field", backref="photos")
    farmer = db.relationship("User", backref="photos")

    def to_public(self):
        return {
            "id": str(self.id),
            "fieldId": str(self.field_id),
            "fieldName": self.field.name if self.field else "",
            "imageUrl": self.image_url,
            "disease": self.disease or "",
            "confidence": self.confidence,
            "lat": self.lat,
            "lng": self.lng,
            "capturedAt": self.captured_at.isoformat(),
            "reviewed": self.reviewed,
            "rescanDisease": self.rescan_disease or "",
            "rescanClass": self.rescan_class or "",
            "rescanConfidence": self.rescan_confidence,
            "rescanAt": self.rescan_at.isoformat() if self.rescan_at else None,
        }


class Alert(db.Model):
    __tablename__ = "alerts"

    id = db.Column(db.Uuid, primary_key=True, default=uuid.uuid4)
    field_id = db.Column(db.Uuid, db.ForeignKey("fields.id", ondelete="CASCADE"), nullable=False)
    photo_id = db.Column(db.Uuid, db.ForeignKey("photos.id", ondelete="SET NULL"), nullable=True)
    type = db.Column(db.String, nullable=False)  # environment | image
    risk_level = db.Column(db.String, nullable=False, default="medium")
    title = db.Column(db.String, nullable=False)
    summary = db.Column(db.Text, nullable=True)
    source = db.Column(db.String, nullable=False, default="system")
    confidence = db.Column(db.Float, nullable=True)
    status = db.Column(db.String, nullable=False, default="open")
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    treatment_disease_code = db.Column(db.String, nullable=True)
    treatment_title = db.Column(db.String, nullable=True)
    treatment_actions = db.Column(db.JSON, nullable=True)
    treated_by = db.Column(db.Uuid, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    treated_at = db.Column(db.DateTime(timezone=True), nullable=True)
    feedback_reason = db.Column(db.Text, nullable=True)

    field = db.relationship("Field", backref="alerts")
    photo = db.relationship("Photo", backref="alerts")
    treater = db.relationship("User", foreign_keys=[treated_by])

    def to_public(self):
        return {
            "id": str(self.id),
            "fieldId": str(self.field_id),
            "fieldName": self.field.name if self.field else "",
            "type": self.type,
            "riskLevel": self.risk_level,
            "title": self.title,
            "summary": self.summary or "",
            "source": self.source,
            "confidence": self.confidence,
            "status": self.status,
            "createdAt": self.created_at.isoformat(),
            "photoId": str(self.photo_id) if self.photo_id else None,
            "treatmentDiseaseCode": self.treatment_disease_code or "",
            "treatmentTitle": self.treatment_title or "",
            "treatmentActions": list(self.treatment_actions or []),
            "treatedAt": self.treated_at.isoformat() if self.treated_at else None,
            "feedbackReason": self.feedback_reason or None,
        }


class DiseasePlanAction(db.Model):
    """Extra treatment actions beyond the fixed disease catalog (B9 Excel import)."""

    __tablename__ = "disease_plan_actions"

    id = db.Column(db.Uuid, primary_key=True, default=uuid.uuid4)
    disease_code = db.Column(db.String, nullable=False, index=True)
    action_text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    created_by = db.Column(db.Uuid, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    __table_args__ = (
        db.UniqueConstraint("disease_code", "action_text", name="uq_disease_plan_action"),
    )


class IotStation(db.Model):
    __tablename__ = "iot_stations"

    id = db.Column(db.Uuid, primary_key=True, default=uuid.uuid4)
    field_id = db.Column(db.Uuid, db.ForeignKey("fields.id", ondelete="CASCADE"), nullable=False)
    code = db.Column(db.String, nullable=False)
    name = db.Column(db.String, nullable=True)
    status = db.Column(db.String, nullable=False, default="online")
    battery_pct = db.Column(db.Integer, nullable=True)

    field = db.relationship("Field", back_populates="stations")
    readings = db.relationship("SensorReading", back_populates="station", lazy="dynamic")

    def to_public(self):
        return {
            "id": str(self.id),
            "code": self.code,
            "fieldId": str(self.field_id),
            "status": self.status,
            "batteryPct": self.battery_pct,
        }


class SensorReading(db.Model):
    __tablename__ = "sensor_readings"

    id = db.Column(db.Uuid, primary_key=True, default=uuid.uuid4)
    station_id = db.Column(db.Uuid, db.ForeignKey("iot_stations.id", ondelete="CASCADE"), nullable=False)
    temperature = db.Column(db.Float, nullable=True)
    humidity = db.Column(db.Float, nullable=True)
    water_level = db.Column(db.Float, nullable=True)
    recorded_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    station = db.relationship("IotStation", back_populates="readings")

    def to_public(self):
        return {
            "temperature": self.temperature,
            "humidity": self.humidity,
            "waterLevel": self.water_level,
            "recordedAt": self.recorded_at.isoformat(),
        }


class FieldLog(db.Model):
    __tablename__ = "field_logs"

    id = db.Column(db.Uuid, primary_key=True, default=uuid.uuid4)
    field_id = db.Column(db.Uuid, db.ForeignKey("fields.id", ondelete="CASCADE"), nullable=False)
    season_id = db.Column(db.Uuid, db.ForeignKey("seasons.id", ondelete="SET NULL"), nullable=True)
    farmer_id = db.Column(db.Uuid, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = db.Column(db.String, nullable=False)
    title = db.Column(db.String, nullable=True)
    note = db.Column(db.Text, nullable=True)
    logged_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    field = db.relationship("Field", backref="field_logs")
    season = db.relationship("Season")
    farmer = db.relationship("User", backref="field_logs")

    def to_public(self):
        return {
            "id": str(self.id),
            "fieldId": str(self.field_id),
            "type": self.type,
            "title": self.title or "",
            "note": self.note or "",
            "loggedAt": self.logged_at.isoformat(),
        }


class Notification(db.Model):
    __tablename__ = "notifications"

    id = db.Column(db.Uuid, primary_key=True, default=uuid.uuid4)
    user_id = db.Column(db.Uuid, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = db.Column(db.String, nullable=False, default="info")
    title = db.Column(db.String, nullable=False)
    body = db.Column(db.Text, nullable=True)
    related_alert_id = db.Column(db.Uuid, db.ForeignKey("alerts.id", ondelete="SET NULL"), nullable=True)
    related_article_id = db.Column(db.Uuid, db.ForeignKey("articles.id", ondelete="SET NULL"), nullable=True)
    related_question_id = db.Column(
        db.Uuid, db.ForeignKey("article_questions.id", ondelete="SET NULL"), nullable=True
    )
    read_at = db.Column(db.DateTime(timezone=True), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    user = db.relationship("User", backref="notifications")
    alert = db.relationship("Alert")
    article = db.relationship("Article", foreign_keys=[related_article_id])
    question = db.relationship("ArticleQuestion", foreign_keys=[related_question_id])

    def to_public(self):
        return {
            "id": str(self.id),
            "type": self.type,
            "title": self.title,
            "body": self.body or "",
            "read": self.read_at is not None,
            "relatedAlertId": str(self.related_alert_id) if self.related_alert_id else None,
            "relatedArticleId": str(self.related_article_id) if self.related_article_id else None,
            "relatedQuestionId": str(self.related_question_id) if self.related_question_id else None,
            "createdAt": self.created_at.isoformat(),
        }


class Article(db.Model):
    __tablename__ = "articles"

    id = db.Column(db.Uuid, primary_key=True, default=uuid.uuid4)
    title = db.Column(db.String, nullable=False)
    summary = db.Column(db.Text, nullable=True)
    body = db.Column(db.Text, nullable=False, default="")
    cover_url = db.Column(db.String, nullable=True)
    category = db.Column(db.String, nullable=False, default="ky_thuat")
    status = db.Column(db.String, nullable=False, default="draft")
    author_id = db.Column(db.Uuid, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_by_id = db.Column(db.Uuid, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    review_note = db.Column(db.Text, nullable=True)
    reviewed_at = db.Column(db.DateTime(timezone=True), nullable=True)
    published_at = db.Column(db.DateTime(timezone=True), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    author = db.relationship("User", foreign_keys=[author_id])
    reviewer = db.relationship("User", foreign_keys=[reviewed_by_id])
    questions = db.relationship("ArticleQuestion", back_populates="article", lazy="dynamic")

    def open_question_count(self):
        return self.questions.filter_by(status="open").count()

    def to_list_item(self):
        return {
            "id": str(self.id),
            "title": self.title,
            "summary": self.summary or "",
            "coverUrl": self.cover_url,
            "category": self.category,
            "status": self.status,
            "authorId": str(self.author_id) if self.author_id else None,
            "authorName": self.author.full_name if self.author else "",
            "publishedAt": self.published_at.isoformat() if self.published_at else None,
            "createdAt": self.created_at.isoformat(),
            "updatedAt": self.updated_at.isoformat(),
            "openQuestionCount": self.open_question_count(),
            "reviewNote": self.review_note or "",
        }

    def to_detail(self, include_public_faq=False):
        data = self.to_list_item()
        data["body"] = self.body or ""
        data["reviewedById"] = str(self.reviewed_by_id) if self.reviewed_by_id else None
        data["reviewedAt"] = self.reviewed_at.isoformat() if self.reviewed_at else None
        if include_public_faq:
            faq = (
                self.questions.filter_by(status="answered", is_public=True)
                .order_by(ArticleQuestion.answered_at.desc())
                .limit(20)
                .all()
            )
            data["publicFaq"] = [q.to_public(include_answer=True) for q in faq]
        return data


class ArticleQuestion(db.Model):
    __tablename__ = "article_questions"

    id = db.Column(db.Uuid, primary_key=True, default=uuid.uuid4)
    article_id = db.Column(db.Uuid, db.ForeignKey("articles.id", ondelete="CASCADE"), nullable=False)
    farmer_id = db.Column(db.Uuid, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    body = db.Column(db.Text, nullable=False)
    status = db.Column(db.String, nullable=False, default="open")
    answer_body = db.Column(db.Text, nullable=True)
    answered_by_id = db.Column(db.Uuid, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    answered_at = db.Column(db.DateTime(timezone=True), nullable=True)
    is_public = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    article = db.relationship("Article", back_populates="questions")
    farmer = db.relationship("User", foreign_keys=[farmer_id])
    answerer = db.relationship("User", foreign_keys=[answered_by_id])

    def to_public(self, include_answer=True):
        data = {
            "id": str(self.id),
            "articleId": str(self.article_id),
            "articleTitle": self.article.title if self.article else "",
            "farmerId": str(self.farmer_id),
            "farmerName": self.farmer.full_name if self.farmer else "",
            "body": self.body,
            "status": self.status,
            "isPublic": self.is_public,
            "createdAt": self.created_at.isoformat(),
        }
        if include_answer:
            data["answerBody"] = self.answer_body or ""
            data["answeredById"] = str(self.answered_by_id) if self.answered_by_id else None
            data["answeredByName"] = self.answerer.full_name if self.answerer else ""
            data["answeredAt"] = self.answered_at.isoformat() if self.answered_at else None
        return data


class UserSettings(db.Model):
    __tablename__ = "user_settings"

    user_id = db.Column(db.Uuid, db.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    language = db.Column(db.String, nullable=False, default="vi")
    notifications_enabled = db.Column(db.Boolean, nullable=False, default=True)

    user = db.relationship("User", backref="settings", uselist=False)

    def to_public(self):
        return {
            "language": self.language,
            "notificationsEnabled": self.notifications_enabled,
        }
