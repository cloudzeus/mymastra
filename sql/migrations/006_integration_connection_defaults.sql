BEGIN;


-- ============================================================
-- Deterministic tenant integration connection defaults
--
-- A tenant may have multiple connections for the same provider
-- and environment, but at most one ACTIVE connection may be
-- designated as the default.
--
-- No existing connection is promoted automatically.
-- Automatic runtime resolution must remain BLOCKED until an
-- explicit default has been configured.
-- ============================================================


ALTER TABLE app.integration_connections
ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;


COMMENT ON COLUMN app.integration_connections.is_default IS
'Explicit default connection for deterministic tenant/provider/environment resolution. No implicit first/only connection fallback is allowed.';


-- ============================================================
-- Invariant:
--
-- tenant + provider + environment
--     -> at most one ACTIVE default connection
--
-- Multiple inactive historical/default-marked rows may coexist,
-- but activating more than one for the same identity is rejected
-- by PostgreSQL.
-- ============================================================


CREATE UNIQUE INDEX IF NOT EXISTS
    integration_connections_active_default_unique
ON app.integration_connections (
    tenant_id,
    provider_id,
    environment
)
WHERE
    is_default = true
    AND is_active = true;


-- Useful for deterministic runtime default lookups.
CREATE INDEX IF NOT EXISTS
    integration_connections_default_lookup_idx
ON app.integration_connections (
    tenant_id,
    provider_id,
    environment,
    is_default,
    is_active
);


COMMIT;
