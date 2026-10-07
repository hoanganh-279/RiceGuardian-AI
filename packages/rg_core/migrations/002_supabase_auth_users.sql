-- Align public.users with Supabase Auth (auth.users).
-- Apply in Supabase SQL editor or at API startup via schema_patches.

ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role = ANY (ARRAY['admin'::text, 'manager'::text, 'technician'::text, 'farmer'::text]));

CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_email VARCHAR,
    action VARCHAR NOT NULL,
    target VARCHAR,
    detail VARCHAR,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- public.users.id should match auth.users.id for newly created accounts.
-- Existing rows are linked by email via backend/scripts/migrate_users_to_supabase_auth.py
