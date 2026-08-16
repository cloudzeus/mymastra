BEGIN;

CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE IF NOT EXISTS app.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    code TEXT NOT NULL,
    name TEXT NOT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT tenants_code_unique
        UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS app.softone_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id UUID NOT NULL
        REFERENCES app.tenants(id)
        ON DELETE CASCADE,

    name TEXT NOT NULL,

    environment TEXT NOT NULL DEFAULT 'PRODUCTION'
        CHECK (
            environment IN (
                'PRODUCTION',
                'TEST',
                'DEVELOPMENT'
            )
        ),

    -- Operational connection metadata
    url TEXT NOT NULL,

    company TEXT NOT NULL,
    branch TEXT NOT NULL,
    module TEXT NOT NULL DEFAULT '0',

    -- AES-256-GCM encrypted values.
    -- Stored as encoded envelopes, never plaintext.
    username_encrypted TEXT NOT NULL,
    password_encrypted TEXT NOT NULL,
    app_id_encrypted TEXT NOT NULL,
    refid_encrypted TEXT NOT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT softone_connections_tenant_name_unique
        UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS
    idx_softone_connections_tenant
ON app.softone_connections(tenant_id);

CREATE INDEX IF NOT EXISTS
    idx_softone_connections_active
ON app.softone_connections(tenant_id, is_active);

COMMIT;
