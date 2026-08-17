BEGIN;

CREATE TABLE IF NOT EXISTS app.integration_providers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    code text NOT NULL,
    category text NOT NULL,

    name text NOT NULL,
    description text,

    adapter_version text,
    api_version text,

    capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,

    config_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
    secret_schema jsonb NOT NULL DEFAULT '{}'::jsonb,

    is_active boolean NOT NULL DEFAULT true,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT integration_providers_code_unique
        UNIQUE (code),

    CONSTRAINT integration_providers_category_check
        CHECK (
            category IN (
                'COMPANY_DATA',
                'GEODATA',
                'TRANSLATION',
                'PAYMENT',
                'COURIER',
                'NOTIFICATION',
                'OTHER'
            )
        ),

    CONSTRAINT integration_providers_capabilities_array_check
        CHECK (
            jsonb_typeof(capabilities) = 'array'
        ),

    CONSTRAINT integration_providers_config_schema_object_check
        CHECK (
            jsonb_typeof(config_schema) = 'object'
        ),

    CONSTRAINT integration_providers_secret_schema_object_check
        CHECK (
            jsonb_typeof(secret_schema) = 'object'
        )
);


CREATE TABLE IF NOT EXISTS app.integration_connections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id uuid NOT NULL
        REFERENCES app.tenants(id),

    provider_id uuid NOT NULL
        REFERENCES app.integration_providers(id),

    name text NOT NULL,

    environment text NOT NULL DEFAULT 'PRODUCTION',

    /*
     * Non-secret provider configuration.
     *
     * Examples:
     * merchant id
     * account identifier
     * API base URL
     * locale
     * provider-specific options
     */
    config jsonb NOT NULL DEFAULT '{}'::jsonb,

    /*
     * AES-256-GCM encrypted JSON envelope.
     *
     * The plaintext JSON is encrypted by the application before
     * persistence. No API keys, passwords or tokens are stored
     * as plaintext JSONB columns.
     */
    secrets_encrypted text,

    is_active boolean NOT NULL DEFAULT true,

    last_verified_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT integration_connections_environment_check
        CHECK (
            environment IN (
                'PRODUCTION',
                'TEST',
                'DEVELOPMENT'
            )
        ),

    CONSTRAINT integration_connections_config_object_check
        CHECK (
            jsonb_typeof(config) = 'object'
        ),

    CONSTRAINT integration_connections_identity_unique
        UNIQUE (
            tenant_id,
            provider_id,
            name,
            environment
        )
);


CREATE INDEX IF NOT EXISTS
    integration_connections_tenant_idx
ON app.integration_connections (
    tenant_id
);


CREATE INDEX IF NOT EXISTS
    integration_connections_provider_idx
ON app.integration_connections (
    provider_id
);


CREATE TABLE IF NOT EXISTS app.translation_cache (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    /*
     * NULL = globally reusable translation.
     * Non-NULL = tenant-specific translation.
     */
    tenant_id uuid
        REFERENCES app.tenants(id),

    source_hash text NOT NULL,
    source_text text NOT NULL,

    source_language text NOT NULL,
    target_language text NOT NULL,

    /*
     * Examples:
     * GENERAL
     * ECOMMERCE
     * ERP
     * LOGISTICS
     * HOSPITALITY
     * LEGAL
     */
    profile text NOT NULL DEFAULT 'GENERAL',

    /*
     * Changes whenever the effective glossary changes.
     * This prevents an old cached translation from silently
     * overriding newer terminology.
     */
    glossary_version integer NOT NULL DEFAULT 1,

    translated_text text NOT NULL,

    /*
     * Translation provider is deliberately recorded even though
     * the current policy is DeepSeek-only.
     */
    provider_code text NOT NULL DEFAULT 'translation.deepseek',

    model text NOT NULL,

    hit_count bigint NOT NULL DEFAULT 0,

    created_at timestamptz NOT NULL DEFAULT now(),
    last_used_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT translation_cache_languages_check
        CHECK (
            source_language <> target_language
        ),

    CONSTRAINT translation_cache_glossary_version_check
        CHECK (
            glossary_version >= 1
        ),

    CONSTRAINT translation_cache_hit_count_check
        CHECK (
            hit_count >= 0
        )
);


/*
 * PostgreSQL UNIQUE treats NULLs as distinct, therefore global
 * and tenant cache identities are enforced with separate indexes.
 */
CREATE UNIQUE INDEX IF NOT EXISTS
    translation_cache_global_identity_unique
ON app.translation_cache (
    source_hash,
    source_language,
    target_language,
    profile,
    glossary_version,
    provider_code,
    model
)
WHERE tenant_id IS NULL;


CREATE UNIQUE INDEX IF NOT EXISTS
    translation_cache_tenant_identity_unique
ON app.translation_cache (
    tenant_id,
    source_hash,
    source_language,
    target_language,
    profile,
    glossary_version,
    provider_code,
    model
)
WHERE tenant_id IS NOT NULL;


CREATE INDEX IF NOT EXISTS
    translation_cache_lookup_idx
ON app.translation_cache (
    source_hash,
    source_language,
    target_language,
    profile
);


CREATE TABLE IF NOT EXISTS app.translation_glossary (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    /*
     * NULL = global terminology.
     * Non-NULL = tenant-specific override.
     */
    tenant_id uuid
        REFERENCES app.tenants(id),

    source_language text NOT NULL,
    target_language text NOT NULL,

    profile text NOT NULL DEFAULT 'GENERAL',

    source_term text NOT NULL,
    target_term text NOT NULL,

    case_sensitive boolean NOT NULL DEFAULT false,

    version integer NOT NULL DEFAULT 1,

    is_active boolean NOT NULL DEFAULT true,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT translation_glossary_languages_check
        CHECK (
            source_language <> target_language
        ),

    CONSTRAINT translation_glossary_version_check
        CHECK (
            version >= 1
        )
);


/*
 * Separate global and tenant indexes avoid the NULL uniqueness
 * ambiguity and allow tenant terminology to coexist with global
 * terminology.
 */
CREATE UNIQUE INDEX IF NOT EXISTS
    translation_glossary_global_identity_unique
ON app.translation_glossary (
    source_language,
    target_language,
    profile,
    source_term,
    case_sensitive,
    version
)
WHERE tenant_id IS NULL;


CREATE UNIQUE INDEX IF NOT EXISTS
    translation_glossary_tenant_identity_unique
ON app.translation_glossary (
    tenant_id,
    source_language,
    target_language,
    profile,
    source_term,
    case_sensitive,
    version
)
WHERE tenant_id IS NOT NULL;


CREATE INDEX IF NOT EXISTS
    translation_glossary_lookup_idx
ON app.translation_glossary (
    source_language,
    target_language,
    profile,
    is_active
);


COMMIT;
