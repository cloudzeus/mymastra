BEGIN;


-- ============================================================
-- Projects
-- ============================================================

CREATE TABLE IF NOT EXISTS app.projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id uuid NOT NULL
        REFERENCES app.tenants(id),

    code text NOT NULL,

    name text NOT NULL,

    description text,

    status text NOT NULL DEFAULT 'DRAFT',

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT projects_status_check
        CHECK (
            status IN (
                'DRAFT',
                'ACTIVE',
                'BLOCKED',
                'COMPLETED',
                'ARCHIVED'
            )
        ),

    CONSTRAINT projects_tenant_code_unique
        UNIQUE (
            tenant_id,
            code
        ),

    /*
     * Required for tenant-consistent composite foreign keys
     * from project-scoped tables.
     */
    CONSTRAINT projects_id_tenant_unique
        UNIQUE (
            id,
            tenant_id
        )
);


CREATE INDEX IF NOT EXISTS
    projects_tenant_idx
ON app.projects (
    tenant_id
);


-- ============================================================
-- Canonical project workspace
--
-- Exactly one canonical workspace is owned by a project.
-- Developer agents must never accept arbitrary workspace paths
-- directly from prompts. Workspace creation/path assignment is
-- owned by the future Project Workspace Manager.
-- ============================================================

CREATE TABLE IF NOT EXISTS app.project_workspaces (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    project_id uuid NOT NULL
        REFERENCES app.projects(id)
        ON DELETE CASCADE,

    workspace_path text NOT NULL,

    repository_url text,

    base_branch text,

    status text NOT NULL DEFAULT 'PROVISIONING',

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT project_workspaces_project_unique
        UNIQUE (
            project_id
        ),

    CONSTRAINT project_workspaces_path_unique
        UNIQUE (
            workspace_path
        ),

    CONSTRAINT project_workspaces_path_not_blank
        CHECK (
            btrim(workspace_path) <> ''
        ),

    CONSTRAINT project_workspaces_status_check
        CHECK (
            status IN (
                'PROVISIONING',
                'READY',
                'BLOCKED',
                'ARCHIVED'
            )
        )
);


-- ============================================================
-- Integration binding support
--
-- This additional unique identity allows a binding to reference
-- an integration connection together with tenant/provider/env,
-- so PostgreSQL can enforce that the binding metadata matches
-- the exact connection.
-- ============================================================

ALTER TABLE app.integration_connections
ADD CONSTRAINT integration_connections_binding_identity_unique
UNIQUE (
    id,
    tenant_id,
    provider_id,
    environment
);


-- ============================================================
-- Project integration bindings
--
-- A project does not "choose" an integration dynamically.
-- It is explicitly bound to a specific tenant connection.
--
-- At most one ACTIVE binding may exist for:
--
-- project + provider + environment
--
-- This gives deterministic project-level resolution.
-- ============================================================

CREATE TABLE IF NOT EXISTS app.project_integration_bindings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    project_id uuid NOT NULL,

    tenant_id uuid NOT NULL,

    provider_id uuid NOT NULL,

    environment text NOT NULL,

    connection_id uuid NOT NULL,

    is_active boolean NOT NULL DEFAULT true,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT project_integration_bindings_environment_check
        CHECK (
            environment IN (
                'PRODUCTION',
                'TEST',
                'DEVELOPMENT'
            )
        ),

    /*
     * Project and binding must belong to the same tenant.
     */
    CONSTRAINT project_integration_bindings_project_tenant_fk
        FOREIGN KEY (
            project_id,
            tenant_id
        )
        REFERENCES app.projects (
            id,
            tenant_id
        )
        ON DELETE CASCADE,

    /*
     * Connection identity must match:
     *
     * tenant
     * provider
     * environment
     *
     * This prevents a project binding from claiming one provider
     * while actually pointing to another provider's connection.
     */
    CONSTRAINT project_integration_bindings_connection_fk
        FOREIGN KEY (
            connection_id,
            tenant_id,
            provider_id,
            environment
        )
        REFERENCES app.integration_connections (
            id,
            tenant_id,
            provider_id,
            environment
        )
);


CREATE UNIQUE INDEX IF NOT EXISTS
    project_integration_bindings_active_unique
ON app.project_integration_bindings (
    project_id,
    provider_id,
    environment
)
WHERE is_active = true;


CREATE INDEX IF NOT EXISTS
    project_integration_bindings_project_idx
ON app.project_integration_bindings (
    project_id
);


CREATE INDEX IF NOT EXISTS
    project_integration_bindings_connection_idx
ON app.project_integration_bindings (
    connection_id
);


COMMIT;
