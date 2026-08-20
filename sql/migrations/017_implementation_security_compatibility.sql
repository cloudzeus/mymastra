ALTER TABLE app.implementation_candidates
  ADD COLUMN IF NOT EXISTS security_status text
    NOT NULL DEFAULT 'UNKNOWN'
    CHECK (
      security_status IN (
        'UNKNOWN',
        'PASS',
        'WARNING',
        'BLOCKED'
      )
    ),

  ADD COLUMN IF NOT EXISTS vulnerability_summary jsonb
    NOT NULL DEFAULT '{}'::jsonb,

  ADD COLUMN IF NOT EXISTS security_score integer
    NOT NULL DEFAULT 0
    CHECK (
      security_score BETWEEN 0 AND 5
    ),

  ADD COLUMN IF NOT EXISTS version_compatibility_score integer
    NOT NULL DEFAULT 0
    CHECK (
      version_compatibility_score BETWEEN 0 AND 5
    );

ALTER TABLE app.implementation_candidates
  DROP COLUMN IF EXISTS overall_score;

ALTER TABLE app.implementation_candidates
  ADD COLUMN overall_score integer
    GENERATED ALWAYS AS (
      completeness_score +
      isolation_score +
      production_score +
      portability_score +
      maintainability_score +
      security_score +
      version_compatibility_score
    ) STORED;

DROP INDEX IF EXISTS
  app.implementation_candidates_overall_score_idx;

CREATE INDEX IF NOT EXISTS
  implementation_candidates_security_status_idx
ON app.implementation_candidates(
  security_status
);

CREATE INDEX IF NOT EXISTS
  implementation_candidates_overall_score_v2_idx
ON app.implementation_candidates(
  overall_score DESC
);
