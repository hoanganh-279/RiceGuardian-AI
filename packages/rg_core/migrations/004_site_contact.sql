-- Website giới thiệu: danh tính Google và mã xác nhận lần đầu.
-- Không gắn vào bảng users.

CREATE TABLE IF NOT EXISTS site_contact_identities (
    id UUID PRIMARY KEY,
    email VARCHAR NOT NULL UNIQUE,
    google_sub VARCHAR NOT NULL,
    full_name VARCHAR NOT NULL,
    verified_at TIMESTAMPTZ,
    last_contact_at TIMESTAMPTZ,
    contact_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_contact_codes (
    id UUID PRIMARY KEY,
    identity_id UUID NOT NULL REFERENCES site_contact_identities(id) ON DELETE CASCADE,
    code_hash VARCHAR NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_site_contact_codes_identity_id
    ON site_contact_codes (identity_id);
