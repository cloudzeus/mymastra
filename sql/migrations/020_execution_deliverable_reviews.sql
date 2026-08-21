-- ============================================================
-- Generic Project Execution Deliverables / Revisions / Reviews
--
-- Every agent-facing deliverable is versioned and reviewed.
--
-- Stage lifecycle remains:
-- PENDING -> READY -> RUNNING -> WAITING_APPROVAL
-- -> COMPLETED / BLOCKED
--
-- Revision lifecycle is modeled independently here.
-- ============================================================


-- ============================================================
-- Deliverables
--
-- Stable logical identity of one deliverable produced by one
-- execution stage. A stage may own more than one logical
-- deliverable (for example Developer WorkOrder and later
-- Developer Implementation).
-- ============================================================

CREATE TABLE IF NOT EXISTS app.project_execution_deliverables (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    execution_plan_id uuid NOT NULL,
    stage_id uuid NOT NULL,

    agent_role text NOT NULL,
    deliverable_type text NOT NULL,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT project_execution_deliverables_plan_fk
        FOREIGN KEY (execution_plan_id)
        REFERENCES app.project_execution_plans (id)
        ON DELETE CASCADE,

    CONSTRAINT project_execution_deliverables_stage_fk
        FOREIGN KEY (stage_id)
        REFERENCES app.project_execution_stages (id)
        ON DELETE CASCADE,

    CONSTRAINT project_execution_deliverables_agent_role_not_blank
        CHECK (btrim(agent_role) <> ''),

    CONSTRAINT project_execution_deliverables_type_not_blank
        CHECK (btrim(deliverable_type) <> ''),

    CONSTRAINT project_execution_deliverables_stage_type_unique
        UNIQUE (stage_id, deliverable_type)
);


CREATE INDEX IF NOT EXISTS project_execution_deliverables_plan_idx
ON app.project_execution_deliverables (
    execution_plan_id,
    created_at
);


CREATE INDEX IF NOT EXISTS project_execution_deliverables_project_idx
ON app.project_execution_deliverables (
    project_id,
    created_at
);


-- ============================================================
-- Deliverable Revisions
--
-- Immutable snapshots of one logical deliverable.
--
-- A new correction always creates a new revision.
-- Existing revision content is never overwritten.
-- ============================================================

CREATE TABLE IF NOT EXISTS app.project_execution_deliverable_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    deliverable_id uuid NOT NULL,

    version integer NOT NULL,

    status text NOT NULL DEFAULT 'DRAFT',

    revision_of_id uuid,

    /*
     * Complete structured snapshot describing exactly what the
     * reviewer is approving.
     *
     * Examples:
     * - specialist artifact identity/version
     * - DeveloperWorkOrder identity
     * - implementation artifact manifest
     * - QA report identity
     * - release package manifest
     */
    content_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,

    /*
     * Links to existing canonical outputs when applicable.
     * These are references, not duplicated business truth.
     */
    output_kind text,

    specialist_artifact_id uuid,
    developer_work_order_id uuid,

    /*
     * For revision runs the responsible agent records how each
     * requested change was addressed.
     *
     * [
     *   {
     *     "requestedChangeId": "RC-001",
     *     "status": "RESOLVED",
     *     "evidence": [...]
     *   }
     * ]
     */
    change_resolution jsonb NOT NULL DEFAULT '[]'::jsonb,

    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT project_execution_deliverable_revisions_deliverable_fk
        FOREIGN KEY (deliverable_id)
        REFERENCES app.project_execution_deliverables (id)
        ON DELETE CASCADE,

    CONSTRAINT project_execution_deliverable_revisions_parent_fk
        FOREIGN KEY (revision_of_id)
        REFERENCES app.project_execution_deliverable_revisions (id)
        ON DELETE RESTRICT,

    CONSTRAINT project_execution_deliverable_revisions_version_positive
        CHECK (version > 0),

    CONSTRAINT project_execution_deliverable_revisions_status_check
        CHECK (
            status IN (
                'DRAFT',
                'SUBMITTED',
                'CHANGES_REQUESTED',
                'APPROVED',
                'REJECTED',
                'SUPERSEDED'
            )
        ),

    CONSTRAINT project_execution_deliverable_revisions_snapshot_object
        CHECK (
            jsonb_typeof(content_snapshot) = 'object'
        ),

    CONSTRAINT project_execution_deliverable_revisions_resolution_array
        CHECK (
            jsonb_typeof(change_resolution) = 'array'
        ),

    CONSTRAINT project_execution_deliverable_revisions_version_unique
        UNIQUE (deliverable_id, version),

    CONSTRAINT project_execution_deliverable_revisions_parent_not_self
        CHECK (
            revision_of_id IS NULL
            OR revision_of_id <> id
        )
);


CREATE INDEX IF NOT EXISTS project_execution_deliverable_revisions_deliverable_idx
ON app.project_execution_deliverable_revisions (
    deliverable_id,
    version DESC
);


CREATE INDEX IF NOT EXISTS project_execution_deliverable_revisions_status_idx
ON app.project_execution_deliverable_revisions (
    deliverable_id,
    status
);


-- ============================================================
-- Deliverable Reviews
--
-- Immutable human review history for an exact revision.
--
-- APPROVED:
--   downstream may continue.
--
-- CHANGES_REQUESTED:
--   same responsible agent receives structured feedback and
--   produces a new revision.
--
-- REJECTED:
--   current execution path is blocked.
-- ============================================================

CREATE TABLE IF NOT EXISTS app.project_execution_reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    execution_plan_id uuid NOT NULL,
    stage_id uuid NOT NULL,

    deliverable_id uuid NOT NULL,
    deliverable_revision_id uuid NOT NULL,

    decision text NOT NULL,

    reviewer_ref text NOT NULL,

    summary text,

    /*
     * [
     *   {
     *     "id": "RC-001",
     *     "severity": "REQUIRED",
     *     "target": "openapi",
     *     "description": "..."
     *   }
     * ]
     */
    requested_changes jsonb NOT NULL DEFAULT '[]'::jsonb,

    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT project_execution_reviews_deliverable_fk
        FOREIGN KEY (deliverable_id)
        REFERENCES app.project_execution_deliverables (id)
        ON DELETE RESTRICT,

    CONSTRAINT project_execution_reviews_revision_fk
        FOREIGN KEY (deliverable_revision_id)
        REFERENCES app.project_execution_deliverable_revisions (id)
        ON DELETE RESTRICT,

    CONSTRAINT project_execution_reviews_plan_fk
        FOREIGN KEY (execution_plan_id)
        REFERENCES app.project_execution_plans (id)
        ON DELETE CASCADE,

    CONSTRAINT project_execution_reviews_stage_fk
        FOREIGN KEY (stage_id)
        REFERENCES app.project_execution_stages (id)
        ON DELETE CASCADE,

    CONSTRAINT project_execution_reviews_decision_check
        CHECK (
            decision IN (
                'APPROVED',
                'CHANGES_REQUESTED',
                'REJECTED'
            )
        ),

    CONSTRAINT project_execution_reviews_reviewer_not_blank
        CHECK (
            btrim(reviewer_ref) <> ''
        ),

    CONSTRAINT project_execution_reviews_requested_changes_array
        CHECK (
            jsonb_typeof(requested_changes) = 'array'
        )
);


CREATE INDEX IF NOT EXISTS project_execution_reviews_revision_idx
ON app.project_execution_reviews (
    deliverable_revision_id,
    created_at
);


CREATE INDEX IF NOT EXISTS project_execution_reviews_stage_idx
ON app.project_execution_reviews (
    stage_id,
    created_at
);
