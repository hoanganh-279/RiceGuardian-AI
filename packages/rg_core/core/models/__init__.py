from datetime import datetime, timezone
import uuid

from core.extensions import db


def utcnow():
    return datetime.now(timezone.utc)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Uuid, primary_key=True, default=uuid.uuid4)
    email = db.Column(db.String, unique=True, nullable=False)
    phone = db.Column(db.String, unique=True, nullable=True)
    password_hash = db.Column(db.String, nullable=True)
    # Last known password for admin UI (create/reset). Not used for auth.
    password_display = db.Column(db.String, nullable=True)
    full_name = db.Column(db.String, nullable=False)
    role = db.Column(db.String, nullable=False)
    status = db.Column(db.String, nullable=False, default="active")
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    organizations = db.relationship(
        "Organization",
        secondary="user_organization",
        back_populates="users",
        lazy="joined",
    )

    def display_email(self):
        from core.utils.auth_emails import is_phone_auth_email

        if is_phone_auth_email(self.email):
            return ""
        return self.email

    def to_public(self):
        return {
            "id": str(self.id),
            "fullName": self.full_name,
            "email": self.display_email(),
            "phone": self.phone or "",
            "role": self.role,
            "status": self.status,
            "organizationIds": [str(org.id) for org in self.organizations],
        }

    def to_admin(self):
        data = self.to_public()
        data["email"] = self.display_email()
        data["authEmail"] = self.email
        data["password"] = self.password_display or ""
        return data


class Organization(db.Model):
    __tablename__ = "organizations"

    id = db.Column(db.Uuid, primary_key=True, default=uuid.uuid4)
    name = db.Column(db.String, nullable=False)
    status = db.Column(db.String, nullable=False, default="active")
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    users = db.relationship(
        "User",
        secondary="user_organization",
        back_populates="organizations",
    )

    def to_card(self):
        return {
            "id": str(self.id),
            "name": self.name,
            "fieldCount": 0,
            "unreadAlerts": 0,
            "unreadNotifications": 0,
        }


class UserOrganization(db.Model):
    __tablename__ = "user_organization"

    user_id = db.Column(db.Uuid, db.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    org_id = db.Column(db.Uuid, db.ForeignKey("organizations.id", ondelete="CASCADE"), primary_key=True)
    assigned_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)


class AuthSession(db.Model):
    __tablename__ = "auth_sessions"

    jti = db.Column(db.Uuid, primary_key=True, default=uuid.uuid4)
    user_id = db.Column(db.Uuid, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    revoked_at = db.Column(db.DateTime(timezone=True), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)


class AdminAuditLog(db.Model):
    __tablename__ = "admin_audit_logs"

    id = db.Column(db.Uuid, primary_key=True, default=uuid.uuid4)
    actor_id = db.Column(db.Uuid, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    actor_email = db.Column(db.String, nullable=True)
    action = db.Column(db.String, nullable=False)
    target = db.Column(db.String, nullable=True)
    detail = db.Column(db.String, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)


class LoginAttempt(db.Model):
    __tablename__ = "login_attempts"

    identifier = db.Column(db.String, primary_key=True)
    fail_count = db.Column(db.Integer, nullable=False, default=0)
    locked_until = db.Column(db.DateTime(timezone=True), nullable=True)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)


class SiteContactIdentity(db.Model):
    __tablename__ = "site_contact_identities"

    id = db.Column(db.Uuid, primary_key=True, default=uuid.uuid4)
    email = db.Column(db.String, unique=True, nullable=False)
    google_sub = db.Column(db.String, nullable=False)
    full_name = db.Column(db.String, nullable=False)
    verified_at = db.Column(db.DateTime(timezone=True), nullable=True)
    last_contact_at = db.Column(db.DateTime(timezone=True), nullable=True)
    contact_count = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)


class SiteContactCode(db.Model):
    __tablename__ = "site_contact_codes"

    id = db.Column(db.Uuid, primary_key=True, default=uuid.uuid4)
    identity_id = db.Column(
        db.Uuid, db.ForeignKey("site_contact_identities.id", ondelete="CASCADE"), nullable=False
    )
    code_hash = db.Column(db.String, nullable=False)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    used_at = db.Column(db.DateTime(timezone=True), nullable=True)
    attempts = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)


class PasswordResetToken(db.Model):
    __tablename__ = "password_reset_tokens"

    id = db.Column(db.Uuid, primary_key=True, default=uuid.uuid4)
    user_id = db.Column(db.Uuid, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = db.Column(db.String, unique=True, nullable=False)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    used_at = db.Column(db.DateTime(timezone=True), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)


from core.models.business import (  # noqa: E402, F401
    Alert,
    Article,
    ArticleQuestion,
    DiseasePlanAction,
    FarmerField,
    Field,
    FieldLog,
    IotStation,
    Notification,
    Photo,
    Season,
    SensorReading,
    UserSettings,
)
