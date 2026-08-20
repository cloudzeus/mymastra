CREATE TABLE IF NOT EXISTS app.implementation_repositories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  provider text NOT NULL DEFAULT 'GITHUB',

  owner text NOT NULL,
  repository_name text NOT NULL,
  repository_url text NOT NULL,

  default_branch text,
  scanned_commit text,

  status text NOT NULL DEFAULT 'PENDING'
    CHECK (
      status IN (
        'PENDING',
        'SCANNING',
        'READY',
        'FAILED',
        'IGNORED'
      )
    ),

  detected_stack jsonb NOT NULL DEFAULT '[]'::jsonb,

  summary text,

  last_scanned_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(owner, repository_name)
);


CREATE TABLE IF NOT EXISTS app.implementation_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  repository_id uuid NOT NULL
    REFERENCES app.implementation_repositories(id)
    ON DELETE CASCADE,

  name text NOT NULL,

  category text NOT NULL,

  problem_solved text NOT NULL,

  description text,

  tags jsonb NOT NULL DEFAULT '[]'::jsonb,

  technologies jsonb NOT NULL DEFAULT '[]'::jsonb,

  source_files jsonb NOT NULL DEFAULT '[]'::jsonb,

  dependencies jsonb NOT NULL DEFAULT '[]'::jsonb,

  customer_specific_dependencies jsonb
    NOT NULL DEFAULT '[]'::jsonb,

  reusable_parts jsonb NOT NULL DEFAULT '[]'::jsonb,

  non_reusable_parts jsonb NOT NULL DEFAULT '[]'::jsonb,

  reuse_guidance jsonb NOT NULL DEFAULT '[]'::jsonb,

  reuse_mode text NOT NULL DEFAULT 'REFERENCE_ONLY'
    CHECK (
      reuse_mode IN (
        'REUSE_AS_IS',
        'ADAPT',
        'REFERENCE_ONLY',
        'NOT_SUITABLE'
      )
    ),

  completeness_score integer NOT NULL DEFAULT 0
    CHECK (completeness_score BETWEEN 0 AND 5),

  isolation_score integer NOT NULL DEFAULT 0
    CHECK (isolation_score BETWEEN 0 AND 5),

  production_score integer NOT NULL DEFAULT 0
    CHECK (production_score BETWEEN 0 AND 5),

  portability_score integer NOT NULL DEFAULT 0
    CHECK (portability_score BETWEEN 0 AND 5),

  maintainability_score integer NOT NULL DEFAULT 0
    CHECK (maintainability_score BETWEEN 0 AND 5),

  overall_score integer GENERATED ALWAYS AS (
    completeness_score +
    isolation_score +
    production_score +
    portability_score +
    maintainability_score
  ) STORED,

  confidence integer NOT NULL DEFAULT 0
    CHECK (confidence BETWEEN 0 AND 100),

  admin_status text NOT NULL DEFAULT 'CANDIDATE'
    CHECK (
      admin_status IN (
        'CANDIDATE',
        'APPROVED',
        'REFERENCE_ONLY',
        'IGNORED'
      )
    ),

  admin_notes text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);


CREATE TABLE IF NOT EXISTS app.implementation_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  name text NOT NULL UNIQUE,

  description text,

  category text NOT NULL,

  tags jsonb NOT NULL DEFAULT '[]'::jsonb,

  preferred_candidate_id uuid
    REFERENCES app.implementation_candidates(id)
    ON DELETE SET NULL,

  status text NOT NULL DEFAULT 'ACTIVE'
    CHECK (
      status IN (
        'ACTIVE',
        'DEPRECATED'
      )
    ),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);


CREATE TABLE IF NOT EXISTS app.implementation_capability_members (
  capability_id uuid NOT NULL
    REFERENCES app.implementation_capabilities(id)
    ON DELETE CASCADE,

  candidate_id uuid NOT NULL
    REFERENCES app.implementation_candidates(id)
    ON DELETE CASCADE,

  similarity_score numeric(5,4),

  PRIMARY KEY (
    capability_id,
    candidate_id
  )
);


CREATE INDEX IF NOT EXISTS
  implementation_candidates_repository_idx
ON app.implementation_candidates(repository_id);


CREATE INDEX IF NOT EXISTS
  implementation_candidates_admin_status_idx
ON app.implementation_candidates(admin_status);


CREATE INDEX IF NOT EXISTS
  implementation_candidates_category_idx
ON app.implementation_candidates(category);


CREATE INDEX IF NOT EXISTS
  implementation_candidates_overall_score_idx
ON app.implementation_candidates(overall_score DESC);
