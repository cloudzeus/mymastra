BEGIN;


-- ============================================================
-- Versioned Project Definition Packages
--
-- This is the server-authoritative persistence layer for the
-- Analyst -> Developer handoff.
--
-- A definition is never selected from Developer model input.
-- Runtime execution loads the stored definition by id/version.
--
-- Changes to a definition must produce a new version.
-- ============================================================

CREATE TABLE IF NOT EXISTS app.project_definitions (
    id uuid PRIMARY KEY
        DEFAULT gen_random_uuid(),

    project_id uuid NOT NULL,

    tenant_id uuid NOT NULL,

    version integer NOT NULL,

    status text NOT NULL,

    definition jsonb NOT NULL,

    created_at timestamptz NOT NULL
        DEFAULT now(),

    updated_at timestamptz NOT NULL
        DEFAULT now(),

    CONSTRAINT project_definitions_project_tenant_fk
        FOREIGN KEY (
            project_id,
            tenant_id
        )
        REFERENCES app.projects (
            id,
            tenant_id
        )
        ON DELETE CASCADE,

    CONSTRAINT project_definitions_version_positive
        CHECK (
            version > 0
        ),

    CONSTRAINT project_definitions_status_check
        CHECK (
            status IN (
                'DRAFT',
                'PARTIAL',
                'READY',
                'BLOCKED'
            )
        ),

    CONSTRAINT project_definitions_payload_object_check
        CHECK (
            jsonb_typeof(definition) = 'object'
        ),

    CONSTRAINT project_definitions_project_version_unique
        UNIQUE (
            project_id,
            version
        ),

    /*
     * Required for an exact DeveloperWorkOrder foreign key:
     *
     * definition id
     * project id
     * definition version
     */
    CONSTRAINT project_definitions_binding_identity_unique
        UNIQUE (
            id,
            project_id,
            version
        )
);


CREATE INDEX IF NOT EXISTS
    project_definitions_project_idx
ON app.project_definitions (
    project_id
);


CREATE INDEX IF NOT EXISTS
    project_definitions_project_status_idx
ON app.project_definitions (
    project_id,
    status
);


-- ============================================================
-- Developer Work Orders
--
-- A Developer model must never construct its own authoritative
-- work order during filesystem execution.
--
-- Runtime tools receive only a persisted workOrderId plus the
-- operation-specific arguments. The server loads this row and
-- its exact ProjectDefinitionPackage version.
-- ============================================================

CREATE TABLE IF NOT EXISTS app.developer_work_orders (
    id uuid PRIMARY KEY
        DEFAULT gen_random_uuid(),

    project_id uuid NOT NULL
        REFERENCES app.projects(id)
        ON DELETE CASCADE,

    project_definition_id uuid NOT NULL,

    project_definition_version integer NOT NULL,

    task_id text NOT NULL,

    task_type text NOT NULL,

    status text NOT NULL,

    work_order jsonb NOT NULL,

    created_at timestamptz NOT NULL
        DEFAULT now(),

    updated_at timestamptz NOT NULL
        DEFAULT now(),

    CONSTRAINT developer_work_orders_definition_fk
        FOREIGN KEY (
            project_definition_id,
            project_id,
            project_definition_version
        )
        REFERENCES app.project_definitions (
            id,
            project_id,
            version
        )
        ON DELETE RESTRICT,

    CONSTRAINT developer_work_orders_definition_version_positive
        CHECK (
            project_definition_version > 0
        ),

    CONSTRAINT developer_work_orders_task_id_not_blank
        CHECK (
            btrim(task_id) <> ''
        ),

    CONSTRAINT developer_work_orders_task_type_check
        CHECK (
            task_type IN (
                'APPLICATION_SCAFFOLD',
                'DATA_MODEL',
                'API_CONTRACT',
                'SOFTONE_INTEGRATION',
                'SYNC_WORKER',
                'BUSINESS_LOGIC',
                'UI',
                'TEST',
                'REFACTOR',
                'DOCUMENTATION'
            )
        ),

    CONSTRAINT developer_work_orders_status_check
        CHECK (
            status IN (
                'DRAFT',
                'READY',
                'BLOCKED',
                'COMPLETED'
            )
        ),

    CONSTRAINT developer_work_orders_payload_object_check
        CHECK (
            jsonb_typeof(work_order) = 'object'
        ),

    CONSTRAINT developer_work_orders_project_task_unique
        UNIQUE (
            project_id,
            task_id
        )
);


CREATE INDEX IF NOT EXISTS
    developer_work_orders_project_idx
ON app.developer_work_orders (
    project_id
);


CREATE INDEX IF NOT EXISTS
    developer_work_orders_definition_idx
ON app.developer_work_orders (
    project_definition_id
);


CREATE INDEX IF NOT EXISTS
    developer_work_orders_project_status_idx
ON app.developer_work_orders (
    project_id,
    status
);


COMMIT;
