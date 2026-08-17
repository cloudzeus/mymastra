BEGIN;

-- ============================================================
-- Expand provider categories
-- ============================================================

ALTER TABLE app.integration_providers
DROP CONSTRAINT IF EXISTS integration_providers_category_check;

ALTER TABLE app.integration_providers
ADD CONSTRAINT integration_providers_category_check
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
        'OTHER'
    )
);


-- ============================================================
-- Translation policy uses the generic DeepSeek AI provider.
--
-- DeepSeek credentials belong to ai.deepseek tenant connection.
-- Translation itself remains a policy/service layer with cache
-- and glossary, not a second independent API provider.
-- ============================================================

ALTER TABLE app.translation_cache
ALTER COLUMN provider_code
SET DEFAULT 'ai.deepseek';


COMMIT;
