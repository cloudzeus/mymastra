BEGIN;


-- ============================================================
-- Research integration category
-- ============================================================

ALTER TABLE app.integration_providers
DROP CONSTRAINT IF EXISTS
    integration_providers_category_check;


ALTER TABLE app.integration_providers
ADD CONSTRAINT
    integration_providers_category_check
CHECK (
    category IN (
        'COMPANY_DATA',
        'GEODATA',
        'TRANSLATION',
        'PAYMENT',
        'COURIER',
        'NOTIFICATION',
        'STORAGE',
        'EMAIL',
        'IMAGE_PROCESSING',
        'AI_PROVIDER',
        'RESEARCH',
        'OTHER'
    )
);


-- ============================================================
-- Tavily
-- ============================================================

INSERT INTO app.integration_providers (
    code,
    category,
    name,
    description,
    adapter_version,
    api_version,
    capabilities,
    config_schema,
    secret_schema,
    is_active
)
VALUES (
    'research.tavily',
    'RESEARCH',
    'Tavily',
    'Tenant-scoped web search, extraction and research provider.',
    '1',
    'v1',
    '[
      "WEB_SEARCH",
      "WEB_EXTRACT",
      "WEB_RESEARCH"
    ]'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb,
    true
)
ON CONFLICT (code)
DO UPDATE SET
    category = EXCLUDED.category,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    adapter_version = EXCLUDED.adapter_version,
    api_version = EXCLUDED.api_version,
    capabilities = EXCLUDED.capabilities,
    config_schema = EXCLUDED.config_schema,
    secret_schema = EXCLUDED.secret_schema,
    is_active = EXCLUDED.is_active,
    updated_at = now();


COMMIT;
