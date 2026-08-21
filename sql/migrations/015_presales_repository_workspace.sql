BEGIN;

CREATE TABLE IF NOT EXISTS app.presales_repository_workspaces (
  presales_source_id uuid PRIMARY KEY,

  tenant_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  opportunity_id uuid NOT NULL,

  workspace_path text NOT NULL,

  requested_ref text,

  resolved_ref text,
  resolved_commit text,

  status text NOT NULL DEFAULT 'PENDING',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT presales_repository_workspaces_status_check
    CHECK (
      status IN (
        'PENDING',
        'PROVISIONING',
        'READY',
        'BLOCKED'
      )
    ),

  CONSTRAINT presales_repository_workspaces_path_not_blank
    CHECK (
      btrim(workspace_path) <> ''
    ),

  CONSTRAINT presales_repository_workspaces_ready_check
    CHECK (
      status <> 'READY'
      OR (
        resolved_ref IS NOT NULL
        AND btrim(resolved_ref) <> ''
        AND resolved_commit IS NOT NULL
        AND btrim(resolved_commit) <> ''
      )
    ),

  CONSTRAINT presales_repository_workspaces_source_fk
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

  CONSTRAINT presales_repository_workspaces_path_unique
    UNIQUE (
      workspace_path
    )
);

CREATE INDEX IF NOT EXISTS
  presales_repository_workspaces_opportunity_idx
ON app.presales_repository_workspaces (
  tenant_id,
  opportunity_id
);

COMMIT;
