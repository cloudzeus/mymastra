BEGIN;

INSERT INTO app.integration_providers (
    code,
    category,
    name,
    description,
    capabilities,
    config_schema,
    secret_schema
)
VALUES

(
    'company.aade',
    'COMPANY_DATA',
    'AADE Company Data',
    'Greek company lookup by VAT number through AADE integration.',
    '[
      "COMPANY_LOOKUP_BY_VAT"
    ]'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb
),

(
    'company.gemi',
    'COMPANY_DATA',
    'GEMI Company Data',
    'Greek company-data enrichment through GEMI.',
    '[
      "COMPANY_ENRICHMENT"
    ]'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb
),

(
    'geodata.google-maps',
    'GEODATA',
    'Google Maps Platform',
    'Canonical geodata provider for geocoding and map capabilities.',
    '[
      "GEOCODE",
      "REVERSE_GEOCODE",
      "MAPS"
    ]'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb
),

(
    'translation.deepseek',
    'TRANSLATION',
    'DeepSeek Translation',
    'Canonical translation provider. Translation requests must use the shared cache and glossary layer before model execution.',
    '[
      "TRANSLATE_TEXT"
    ]'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb
),

(
    'payment.viva',
    'PAYMENT',
    'Viva.com',
    'Payment provider registry entry. Provider-specific capabilities will be added only after adapter verification.',
    '[]'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb
),

(
    'courier.acs',
    'COURIER',
    'ACS Courier',
    'Courier provider registry entry. Provider-specific capabilities will be added only after adapter verification.',
    '[]'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb
),

(
    'courier.general-postal',
    'COURIER',
    'General Postal',
    'Courier provider registry entry. Provider-specific capabilities will be added only after adapter verification.',
    '[]'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb
)

ON CONFLICT (code)
DO UPDATE SET
    category = EXCLUDED.category,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    capabilities = EXCLUDED.capabilities,
    updated_at = now();

COMMIT;
