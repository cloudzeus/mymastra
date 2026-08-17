BEGIN;

INSERT INTO app.integration_providers (
    code,
    category,
    name,
    description,
    capabilities,
    config_schema,
    secret_schema,
    is_active
)
VALUES

-- ============================================================
-- COMPANY DATA
-- ============================================================

(
    'company.aade',
    'COMPANY_DATA',
    'AADE Company Data',
    'Greek company lookup by VAT number.',
    '[
      "COMPANY_LOOKUP_BY_VAT"
    ]'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb,
    true
),

(
    'company.gemi',
    'COMPANY_DATA',
    'GEMI Company Data',
    'Greek company-data enrichment provider.',
    '[
      "COMPANY_ENRICHMENT"
    ]'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb,
    true
),

-- ============================================================
-- GEODATA
-- ============================================================

(
    'geodata.google-maps',
    'GEODATA',
    'Google Maps Platform',
    'Google geodata and mapping provider.',
    '[
      "GEOCODE",
      "REVERSE_GEOCODE",
      "MAPS"
    ]'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb,
    true
),

(
    'geodata.maptiler',
    'GEODATA',
    'MapTiler',
    'Map and geodata provider.',
    '[
      "GEOCODE",
      "REVERSE_GEOCODE",
      "MAPS",
      "PLACE_SEARCH"
    ]'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb,
    true
),

-- ============================================================
-- AI PROVIDERS
-- ============================================================

(
    'ai.deepseek',
    'AI_PROVIDER',
    'DeepSeek',
    'Tenant-scoped DeepSeek AI provider. Translation policy uses this provider together with cache and glossary.',
    '[
      "CHAT_COMPLETION",
      "STRUCTURED_OUTPUT",
      "TRANSLATE_TEXT"
    ]'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb,
    true
),

(
    'ai.openai',
    'AI_PROVIDER',
    'OpenAI',
    'Tenant-scoped OpenAI provider.',
    '[
      "CHAT_COMPLETION",
      "STRUCTURED_OUTPUT",
      "EMBEDDINGS",
      "VISION",
      "IMAGE_GENERATION"
    ]'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb,
    true
),

(
    'ai.openrouter',
    'AI_PROVIDER',
    'OpenRouter',
    'Tenant-scoped OpenRouter provider.',
    '[
      "CHAT_COMPLETION",
      "STRUCTURED_OUTPUT"
    ]'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb,
    true
),

(
    'ai.anthropic',
    'AI_PROVIDER',
    'Anthropic',
    'Tenant-scoped Anthropic provider.',
    '[
      "CHAT_COMPLETION",
      "STRUCTURED_OUTPUT",
      "VISION"
    ]'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb,
    true
),

(
    'ai.google',
    'AI_PROVIDER',
    'Google AI',
    'Tenant-scoped Google AI provider.',
    '[
      "CHAT_COMPLETION",
      "STRUCTURED_OUTPUT",
      "VISION"
    ]'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb,
    true
),

-- ============================================================
-- PAYMENT
-- ============================================================

(
    'payment.viva',
    'PAYMENT',
    'Viva.com',
    'Tenant-scoped payment provider.',
    '[]'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb,
    true
),

-- ============================================================
-- COURIERS
-- ============================================================

(
    'courier.acs',
    'COURIER',
    'ACS Courier',
    'Tenant-scoped courier provider.',
    '[]'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb,
    true
),

(
    'courier.general-postal',
    'COURIER',
    'General Postal',
    'Tenant-scoped courier provider.',
    '[]'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb,
    true
),

-- ============================================================
-- STORAGE / CDN
-- ============================================================

(
    'storage.bunny',
    'STORAGE',
    'Bunny Storage / CDN',
    'Tenant-scoped object storage and CDN provider.',
    '[
      "OBJECT_UPLOAD",
      "OBJECT_DOWNLOAD",
      "OBJECT_DELETE",
      "CDN_STORAGE"
    ]'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb,
    true
),

-- ============================================================
-- EMAIL
-- ============================================================

(
    'email.mailgun',
    'EMAIL',
    'Mailgun',
    'Tenant-scoped transactional email provider.',
    '[
      "SEND_EMAIL"
    ]'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb,
    true
),

-- ============================================================
-- IMAGE PROCESSING
-- ============================================================

(
    'image.claid',
    'IMAGE_PROCESSING',
    'Claid',
    'Tenant-scoped image processing provider.',
    '[
      "REMOVE_BACKGROUND"
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
    capabilities = EXCLUDED.capabilities,
    config_schema = EXCLUDED.config_schema,
    secret_schema = EXCLUDED.secret_schema,
    is_active = EXCLUDED.is_active,
    updated_at = now();


-- ============================================================
-- Remove obsolete DeepSeek translation provider identity.
--
-- Translation is now a policy/service layer using ai.deepseek.
-- We already verified there are no connections referencing it.
-- ============================================================

DELETE FROM app.integration_providers
WHERE code = 'translation.deepseek'
  AND NOT EXISTS (
      SELECT 1
      FROM app.integration_connections ic
      WHERE ic.provider_id =
        app.integration_providers.id
  );

COMMIT;
