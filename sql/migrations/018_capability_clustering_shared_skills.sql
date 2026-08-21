BEGIN;

ALTER TABLE app.implementation_candidates
  ADD COLUMN IF NOT EXISTS source_commit text;

UPDATE app.implementation_candidates c
SET source_commit = r.scanned_commit
FROM app.implementation_repositories r
WHERE r.id = c.repository_id
  AND c.source_commit IS NULL;

ALTER TABLE app.implementation_capabilities
  ADD COLUMN IF NOT EXISTS canonical_key text,
  ADD COLUMN IF NOT EXISTS admin_status text NOT NULL DEFAULT 'CANDIDATE',
  ADD COLUMN IF NOT EXISTS confidence integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cluster_method text NOT NULL DEFAULT 'SEMANTIC',
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS security_review_status text NOT NULL DEFAULT 'UNREVIEWED';

ALTER TABLE app.implementation_capabilities
  DROP CONSTRAINT IF EXISTS implementation_capabilities_admin_status_check;

ALTER TABLE app.implementation_capabilities
  ADD CONSTRAINT implementation_capabilities_admin_status_check
  CHECK (
    admin_status IN (
      'CANDIDATE',
      'APPROVED',
      'IGNORED'
    )
  );

ALTER TABLE app.implementation_capabilities
  DROP CONSTRAINT IF EXISTS implementation_capabilities_security_review_status_check;

ALTER TABLE app.implementation_capabilities
  ADD CONSTRAINT implementation_capabilities_security_review_status_check
  CHECK (
    security_review_status IN (
      'UNREVIEWED',
      'PASS',
      'PASS_WITH_NOTES',
      'REJECTED'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS implementation_capabilities_canonical_key_uidx
  ON app.implementation_capabilities (canonical_key)
  WHERE canonical_key IS NOT NULL;


CREATE TABLE IF NOT EXISTS app.shared_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  capability_id uuid NOT NULL UNIQUE
    REFERENCES app.implementation_capabilities(id)
    ON DELETE RESTRICT,

  preferred_candidate_id uuid NOT NULL
    REFERENCES app.implementation_candidates(id)
    ON DELETE RESTRICT,

  slug text NOT NULL UNIQUE,

  name text NOT NULL,

  description text NOT NULL,

  status text NOT NULL DEFAULT 'DRAFT'
    CHECK (
      status IN (
        'DRAFT',
        'APPROVED',
        'DEPRECATED'
      )
    ),

  supported_stacks jsonb NOT NULL DEFAULT '[]'::jsonb,

  source_package_versions jsonb NOT NULL DEFAULT '{}'::jsonb,

  dependencies jsonb NOT NULL DEFAULT '[]'::jsonb,

  usage_instructions jsonb NOT NULL DEFAULT '[]'::jsonb,

  examples jsonb NOT NULL DEFAULT '[]'::jsonb,

  security_review_status text NOT NULL
    CHECK (
      security_review_status IN (
        'PASS',
        'PASS_WITH_NOTES'
      )
    ),

  created_at timestamptz NOT NULL DEFAULT now(),

  updated_at timestamptz NOT NULL DEFAULT now()
);


CREATE TABLE IF NOT EXISTS app.shared_skill_sources (
  shared_skill_id uuid NOT NULL
    REFERENCES app.shared_skills(id)
    ON DELETE CASCADE,

  candidate_id uuid NOT NULL
    REFERENCES app.implementation_candidates(id)
    ON DELETE RESTRICT,

  source_commit text NOT NULL,

  source_role text NOT NULL
    CHECK (
      source_role IN (
        'PRIMARY',
        'SUPPORTING'
      )
    ),

  created_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (
    shared_skill_id,
    candidate_id
  )
);


CREATE INDEX IF NOT EXISTS shared_skills_status_idx
  ON app.shared_skills(status);

CREATE INDEX IF NOT EXISTS implementation_capabilities_admin_status_idx
  ON app.implementation_capabilities(admin_status);

CREATE INDEX IF NOT EXISTS implementation_capability_members_candidate_idx
  ON app.implementation_capability_members(candidate_id);

COMMIT;
