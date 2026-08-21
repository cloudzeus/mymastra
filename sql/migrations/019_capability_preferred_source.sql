ALTER TABLE app.implementation_capabilities
ADD COLUMN IF NOT EXISTS preferred_source text NOT NULL DEFAULT 'AUTO'
CHECK (
  preferred_source IN (
    'AUTO',
    'MANUAL'
  )
);

UPDATE app.implementation_capabilities
SET preferred_source = 'MANUAL'
WHERE canonical_key IN (
  'SOFTONE_ERP_SYNCHRONIZATION_ENGINE',
  'SOFTONE_DOCUMENT_AUTOMATION'
);
