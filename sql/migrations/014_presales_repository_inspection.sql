BEGIN;

CREATE TABLE IF NOT EXISTS app.presales_sources (
  id uuid PRIMARY KEY,

  tenant_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  opportunity_id uuid NOT NULL,

  source_type text NOT NULL,

  title text NOT NULL,
  reference text,

  repository_provider text,
  repository_url text,
  requested_ref text,

  access_mode text NOT NULL DEFAULT 'READ_ONLY',

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  status text NOT NULL DEFAULT 'PENDING',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT presales_sources_type_check
    CHECK (
      source_type IN (
        'REPOSITORY',
        'WEBSITE',
        'DOCUMENT',
        'API_SPEC',
        'DATABASE_SCHEMA',
        'LOG_EXPORT',
        'OTHER'
      )
    ),

  CONSTRAINT presales_sources_status_check
    CHECK (
      status IN (
        'PENDING',
        'READY',
        'FAILED',
        'REVOKED'
      )
    ),

  CONSTRAINT presales_sources_access_mode_check
    CHECK (
      access_mode = 'READ_ONLY'
    ),

  CONSTRAINT presales_sources_title_not_blank
    CHECK (
      btrim(title) <> ''
    ),

  CONSTRAINT presales_sources_repository_check
    CHECK (
      source_type <> 'REPOSITORY'
      OR (
        repository_provider IN (
          'GITHUB',
          'GITLAB',
          'BITBUCKET',
          'GENERIC_GIT'
        )
        AND repository_url IS NOT NULL
        AND btrim(repository_url) <> ''
      )
    ),

  CONSTRAINT presales_sources_opportunity_fk
    FOREIGN KEY (
      opportunity_id,
      tenant_id,
      customer_id
    )
    REFERENCES app.opportunities (
      id,
      tenant_id,
      customer_id
    )
    ON DELETE CASCADE,

  CONSTRAINT presales_sources_ownership_unique
    UNIQUE (
      id,
      tenant_id,
      customer_id,
      opportunity_id
    )
);


CREATE INDEX IF NOT EXISTS
  presales_sources_opportunity_idx
ON app.presales_sources (
  tenant_id,
  opportunity_id
);


CREATE INDEX IF NOT EXISTS
  presales_sources_type_idx
ON app.presales_sources (
  tenant_id,
  opportunity_id,
  source_type
);


CREATE TABLE IF NOT EXISTS app.repository_inspections (
  id uuid PRIMARY KEY,

  tenant_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  opportunity_id uuid NOT NULL,

  presales_source_id uuid NOT NULL,

  version integer NOT NULL,

  repository_url text NOT NULL,

  requested_ref text,

  resolved_ref text,
  resolved_commit text,

  detected_stack jsonb NOT NULL DEFAULT '[]'::jsonb,
  architecture jsonb NOT NULL DEFAULT '[]'::jsonb,
  modules jsonb NOT NULL DEFAULT '[]'::jsonb,
  integrations jsonb NOT NULL DEFAULT '[]'::jsonb,

  data_layer jsonb NOT NULL DEFAULT '[]'::jsonb,
  authentication jsonb NOT NULL DEFAULT '[]'::jsonb,
  deployment jsonb NOT NULL DEFAULT '[]'::jsonb,
  testing jsonb NOT NULL DEFAULT '[]'::jsonb,

  relevant_files jsonb NOT NULL DEFAULT '[]'::jsonb,
  findings jsonb NOT NULL DEFAULT '[]'::jsonb,

  risks jsonb NOT NULL DEFAULT '[]'::jsonb,
  technical_debt jsonb NOT NULL DEFAULT '[]'::jsonb,
  limitations jsonb NOT NULL DEFAULT '[]'::jsonb,

  status text NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT repository_inspections_version_check
    CHECK (
      version > 0
    ),

  CONSTRAINT repository_inspections_status_check
    CHECK (
      status IN (
        'READY',
        'PARTIAL',
        'BLOCKED',
        'FAILED'
      )
    ),

  CONSTRAINT repository_inspections_repository_not_blank
    CHECK (
      btrim(repository_url) <> ''
    ),

  CONSTRAINT repository_inspections_resolved_check
    CHECK (
      status NOT IN ('READY', 'PARTIAL')
      OR (
        resolved_ref IS NOT NULL
        AND btrim(resolved_ref) <> ''
        AND resolved_commit IS NOT NULL
        AND btrim(resolved_commit) <> ''
      )
    ),

  CONSTRAINT repository_inspections_source_fk
    FOREIGN KEY (
      presales_source_id,
      tenant_id,
      customer_id,
      opportunity_id
    )
    REFERENCES app.presales_sources (
      id,
      tenant_id,
      customer_id,
      opportunity_id
    )
    ON DELETE CASCADE,

  CONSTRAINT repository_inspections_source_version_unique
    UNIQUE (
      presales_source_id,
      version
    )
);


CREATE INDEX IF NOT EXISTS
  repository_inspections_opportunity_idx
ON app.repository_inspections (
  tenant_id,
  opportunity_id
);


CREATE INDEX IF NOT EXISTS
  repository_inspections_source_idx
ON app.repository_inspections (
  presales_source_id,
  version DESC
);

COMMIT;
