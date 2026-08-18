BEGIN;

-- ============================================================
-- 010 - Pre-Sales and AI Cost Foundation
-- Part 1: Customers, Customer Workspaces, Opportunities
-- ============================================================

-- ============================================================
-- Customers
--
-- Customer is a commercial entity and exists independently
-- from Opportunities and Delivery Projects.
--
-- code is the canonical business code.
-- When linked to SoftOne, code is sourced from TRDR.CODE.
-- ============================================================

CREATE TABLE IF NOT EXISTS app.customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id uuid NOT NULL
        REFERENCES app.tenants(id),

    code text NOT NULL,

    name text NOT NULL,

    legal_name text,

    vat_number text,

    website_url text,

    status text NOT NULL DEFAULT 'PROSPECT',

    source_system text NOT NULL DEFAULT 'LOCAL',

    softone_trdr_id text,

    softone_trdr_code text,

    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT customers_code_not_blank
        CHECK (btrim(code) <> ''),

    CONSTRAINT customers_name_not_blank
        CHECK (btrim(name) <> ''),

    CONSTRAINT customers_status_check
        CHECK (
            status IN (
                'PROSPECT',
                'ACTIVE',
                'INACTIVE',
                'ARCHIVED'
            )
        ),

    CONSTRAINT customers_source_system_check
        CHECK (
            source_system IN (
                'LOCAL',
                'SOFTONE',
                'IMPORT',
                'OTHER'
            )
        ),

    CONSTRAINT customers_metadata_object_check
        CHECK (
            jsonb_typeof(metadata) = 'object'
        ),

    CONSTRAINT customers_tenant_code_unique
        UNIQUE (
            tenant_id,
            code
        ),

    CONSTRAINT customers_id_tenant_unique
        UNIQUE (
            id,
            tenant_id
        )
);

CREATE INDEX IF NOT EXISTS
    customers_tenant_idx
ON app.customers (
    tenant_id
);

CREATE INDEX IF NOT EXISTS
    customers_tenant_status_idx
ON app.customers (
    tenant_id,
    status
);

CREATE UNIQUE INDEX IF NOT EXISTS
    customers_softone_trdr_code_unique
ON app.customers (
    tenant_id,
    softone_trdr_code
)
WHERE softone_trdr_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS
    customers_softone_trdr_id_unique
ON app.customers (
    tenant_id,
    softone_trdr_id
)
WHERE softone_trdr_id IS NOT NULL;

-- ============================================================
-- Customer Workspaces
--
-- Exactly one canonical persistent pre-sales/customer workspace
-- is associated with each customer.
-- ============================================================

CREATE TABLE IF NOT EXISTS app.customer_workspaces (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    customer_id uuid NOT NULL,

    tenant_id uuid NOT NULL,

    workspace_path text NOT NULL,

    status text NOT NULL DEFAULT 'PROVISIONING',

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT customer_workspaces_customer_tenant_fk
        FOREIGN KEY (
            customer_id,
            tenant_id
        )
        REFERENCES app.customers (
            id,
            tenant_id
        )
        ON DELETE CASCADE,

    CONSTRAINT customer_workspaces_customer_unique
        UNIQUE (
            customer_id
        ),

    CONSTRAINT customer_workspaces_path_unique
        UNIQUE (
            workspace_path
        ),

    CONSTRAINT customer_workspaces_path_not_blank
        CHECK (
            btrim(workspace_path) <> ''
        ),

    CONSTRAINT customer_workspaces_status_check
        CHECK (
            status IN (
                'PROVISIONING',
                'READY',
                'BLOCKED',
                'ARCHIVED'
            )
        )
);

CREATE INDEX IF NOT EXISTS
    customer_workspaces_tenant_idx
ON app.customer_workspaces (
    tenant_id
);

-- ============================================================
-- Opportunities
--
-- Opportunity represents potential commercial work.
-- A Delivery Project does not exist until conversion.
-- ============================================================

CREATE TABLE IF NOT EXISTS app.opportunities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id uuid NOT NULL,

    customer_id uuid NOT NULL,

    code text NOT NULL,

    title text NOT NULL,

    description text,

    status text NOT NULL DEFAULT 'DRAFT',

    source text,

    expected_budget numeric(18,2),

    currency text,

    target_date date,

    converted_project_id uuid,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT opportunities_customer_tenant_fk
        FOREIGN KEY (
            customer_id,
            tenant_id
        )
        REFERENCES app.customers (
            id,
            tenant_id
        )
        ON DELETE RESTRICT,

    CONSTRAINT opportunities_converted_project_fk
        FOREIGN KEY (
            converted_project_id,
            tenant_id
        )
        REFERENCES app.projects (
            id,
            tenant_id
        )
        ON DELETE RESTRICT,

    CONSTRAINT opportunities_code_not_blank
        CHECK (btrim(code) <> ''),

    CONSTRAINT opportunities_title_not_blank
        CHECK (btrim(title) <> ''),

    CONSTRAINT opportunities_status_check
        CHECK (
            status IN (
                'DRAFT',
                'QUALIFYING',
                'ANALYSIS',
                'CONCEPT_DESIGN',
                'PROPOSAL_DRAFT',
                'INTERNAL_REVIEW',
                'READY_TO_SEND',
                'SENT',
                'AWAITING_CUSTOMER',
                'CHANGES_REQUESTED',
                'ACCEPTED',
                'REJECTED',
                'ON_HOLD',
                'EXPIRED',
                'CONVERTED_TO_PROJECT'
            )
        ),

    CONSTRAINT opportunities_expected_budget_check
        CHECK (
            expected_budget IS NULL
            OR expected_budget >= 0
        ),

    CONSTRAINT opportunities_currency_check
        CHECK (
            currency IS NULL
            OR currency ~ '^[A-Z]{3}$'
        ),

    CONSTRAINT opportunities_tenant_code_unique
        UNIQUE (
            tenant_id,
            code
        ),

    CONSTRAINT opportunities_id_tenant_customer_unique
        UNIQUE (
            id,
            tenant_id,
            customer_id
        )
);

CREATE INDEX IF NOT EXISTS
    opportunities_customer_idx
ON app.opportunities (
    customer_id
);

CREATE INDEX IF NOT EXISTS
    opportunities_tenant_status_idx
ON app.opportunities (
    tenant_id,
    status
);

CREATE UNIQUE INDEX IF NOT EXISTS
    opportunities_converted_project_unique
ON app.opportunities (
    converted_project_id
)
WHERE converted_project_id IS NOT NULL;
-- ============================================================
-- Customer Requests
-- ============================================================

CREATE TABLE IF NOT EXISTS app.customer_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    opportunity_id uuid NOT NULL,
    title text NOT NULL,
    request_text text NOT NULL,
    source_channel text,
    budget_text text,
    timeline_text text,
    source_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
    attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT customer_requests_opportunity_owner_fk
        FOREIGN KEY (opportunity_id, tenant_id, customer_id)
        REFERENCES app.opportunities (id, tenant_id, customer_id)
        ON DELETE CASCADE,

    CONSTRAINT customer_requests_title_not_blank
        CHECK (btrim(title) <> ''),

    CONSTRAINT customer_requests_request_text_not_blank
        CHECK (btrim(request_text) <> ''),

    CONSTRAINT customer_requests_source_urls_array_check
        CHECK (jsonb_typeof(source_urls) = 'array'),

    CONSTRAINT customer_requests_attachments_array_check
        CHECK (jsonb_typeof(attachments) = 'array'),

    CONSTRAINT customer_requests_metadata_object_check
        CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS customer_requests_opportunity_idx
ON app.customer_requests (opportunity_id, created_at);
-- ============================================================
-- Initial Solution Approaches
--
-- Administrator-authored input to Analysis.
-- This is not an authoritative final technical solution.
-- ============================================================

CREATE TABLE IF NOT EXISTS app.initial_solution_approaches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    opportunity_id uuid NOT NULL,
    version integer NOT NULL DEFAULT 1,
    approach_text text NOT NULL,
    probable_scope jsonb NOT NULL DEFAULT '[]'::jsonb,
    probable_technologies jsonb NOT NULL DEFAULT '[]'::jsonb,
    assumptions jsonb NOT NULL DEFAULT '[]'::jsonb,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT initial_solution_approaches_opportunity_owner_fk
        FOREIGN KEY (opportunity_id, tenant_id, customer_id)
        REFERENCES app.opportunities (id, tenant_id, customer_id)
        ON DELETE CASCADE,

    CONSTRAINT initial_solution_approaches_version_positive
        CHECK (version > 0),

    CONSTRAINT initial_solution_approaches_text_not_blank
        CHECK (btrim(approach_text) <> ''),

    CONSTRAINT initial_solution_approaches_scope_array_check
        CHECK (jsonb_typeof(probable_scope) = 'array'),

    CONSTRAINT initial_solution_approaches_technologies_array_check
        CHECK (jsonb_typeof(probable_technologies) = 'array'),

    CONSTRAINT initial_solution_approaches_assumptions_array_check
        CHECK (jsonb_typeof(assumptions) = 'array'),

    CONSTRAINT initial_solution_approaches_metadata_object_check
        CHECK (jsonb_typeof(metadata) = 'object'),

    CONSTRAINT initial_solution_approaches_opportunity_version_unique
        UNIQUE (opportunity_id, version)
);

CREATE INDEX IF NOT EXISTS initial_solution_approaches_opportunity_idx
ON app.initial_solution_approaches (opportunity_id, version);
-- ============================================================
-- Specialist Artifacts
--
-- Generic persisted specialist artifact envelope.
-- Supports both pre-sales Opportunity scope and Delivery Project scope.
-- =============================================================

CREATE TABLE IF NOT EXISTS app.specialist_artifacts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL
        REFERENCES app.tenants(id),
    customer_id uuid NOT NULL,
    opportunity_id uuid,
    project_id uuid,
    scope text NOT NULL,
    role text NOT NULL,
    artifact_type text NOT NULL,
    version integer NOT NULL,
    status text NOT NULL,
    title text NOT NULL,
    objective text NOT NULL,
    source_artifact_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
    findings jsonb NOT NULL DEFAULT '[]'::jsonb,
    recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
    unresolved jsonb NOT NULL DEFAULT '[]'::jsonb,
    blockers jsonb NOT NULL DEFAULT '[]'::jsonb,
    provenance jsonb NOT NULL DEFAULT '[]'::jsonb,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT specialist_artifacts_customer_tenant_fk
        FOREIGN KEY (customer_id, tenant_id)
        REFERENCES app.customers (id, tenant_id)
        ON DELETE RESTRICT,

    CONSTRAINT specialist_artifacts_opportunity_owner_fk
        FOREIGN KEY (opportunity_id, tenant_id, customer_id)
        REFERENCES app.opportunities (id, tenant_id, customer_id)
        ON DELETE RESTRICT,

    CONSTRAINT specialist_artifacts_project_owner_fk
        FOREIGN KEY (project_id, tenant_id)
        REFERENCES app.projects (id, tenant_id)
        ON DELETE RESTRICT,

    CONSTRAINT specialist_artifacts_scope_check
        CHECK (scope IN ('OPPORTUNITY', 'PROJECT')),

    CONSTRAINT specialist_artifacts_scope_ownership_check
        CHECK (
            (
                scope = 'OPPORTUNITY'
                AND opportunity_id IS NOT NULL
                AND project_id IS NULL
            )
            OR
            (
                scope = 'PROJECT'
                AND project_id IS NOT NULL
            )
        ),

    CONSTRAINT specialist_artifacts_version_positive
        CHECK (version > 0),

    CONSTRAINT specialist_artifacts_title_not_blank
        CHECK (btrim(title) <> ''),

    CONSTRAINT specialist_artifacts_objective_not_blank
        CHECK (btrim(objective) <> ''),

    CONSTRAINT specialist_artifacts_source_ids_array_check
        CHECK (jsonb_typeof(source_artifact_ids) = 'array'),

    CONSTRAINT specialist_artifacts_findings_array_check
        CHECK (jsonb_typeof(findings) = 'array'),

    CONSTRAINT specialist_artifacts_recommendations_array_check
        CHECK (jsonb_typeof(recommendations) = 'array'),

    CONSTRAINT specialist_artifacts_unresolved_array_check
        CHECK (jsonb_typeof(unresolved) = 'array'),

    CONSTRAINT specialist_artifacts_blockers_array_check
        CHECK (jsonb_typeof(blockers) = 'array'),

    CONSTRAINT specialist_artifacts_provenance_array_check
        CHECK (jsonb_typeof(provenance) = 'array'),

    CONSTRAINT specialist_artifacts_payload_object_check
        CHECK (jsonb_typeof(payload) = 'object')
);

CREATE INDEX IF NOT EXISTS specialist_artifacts_opportunity_idx
ON app.specialist_artifacts (opportunity_id, artifact_type, version)
WHERE opportunity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS specialist_artifacts_project_idx
ON app.specialist_artifacts (project_id, artifact_type, version)
WHERE project_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS specialist_artifacts_opportunity_version_unique
ON app.specialist_artifacts (opportunity_id, artifact_type, version)
WHERE scope = 'OPPORTUNITY';

CREATE UNIQUE INDEX IF NOT EXISTS specialist_artifacts_project_version_unique
ON app.specialist_artifacts (project_id, artifact_type, version)
WHERE scope = 'PROJECT';
-- ============================================================
-- Proposals
--
-- Logical commercial proposal for an Opportunity.
-- Proposal revisions are stored separately and are never overwritten.
-- ============================================================

CREATE TABLE IF NOT EXISTS app.proposals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    opportunity_id uuid NOT NULL,
    code text NOT NULL,
    title text NOT NULL,
    status text NOT NULL DEFAULT 'DRAFT',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT proposals_opportunity_owner_fk
        FOREIGN KEY (opportunity_id, tenant_id, customer_id)
        REFERENCES app.opportunities (id, tenant_id, customer_id)
        ON DELETE RESTRICT,

    CONSTRAINT proposals_code_not_blank
        CHECK (btrim(code) <> ''),

    CONSTRAINT proposals_title_not_blank
        CHECK (btrim(title) <> ''),

    CONSTRAINT proposals_status_check
        CHECK (
            status IN (
                'DRAFT',
                'INTERNAL_REVIEW',
                'APPROVED',
                'SENT',
                'AWAITING_CUSTOMER',
                'CHANGES_REQUESTED',
                'ACCEPTED',
                'REJECTED',
                'ON_HOLD',
                'EXPIRED',
                'ARCHIVED'
            )
        ),

    CONSTRAINT proposals_tenant_code_unique
        UNIQUE (tenant_id, code),

    CONSTRAINT proposals_id_owner_unique
        UNIQUE (id, tenant_id, customer_id, opportunity_id)
);

CREATE INDEX IF NOT EXISTS proposals_opportunity_idx
ON app.proposals (opportunity_id, created_at);

CREATE INDEX IF NOT EXISTS proposals_tenant_status_idx
ON app.proposals (tenant_id, status);
-- ============================================================
-- Proposal Revisions
--
-- Immutable revision history for a Proposal.
-- Each revision stores a complete structured content snapshot and
-- references generated customer-facing document artifacts when available.
-- ============================================================

CREATE TABLE IF NOT EXISTS app.proposal_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    opportunity_id uuid NOT NULL,
    proposal_id uuid NOT NULL,
    version integer NOT NULL,
    status text NOT NULL DEFAULT 'DRAFT',
    content jsonb NOT NULL DEFAULT '{}'::jsonb,
    source_artifact_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
    docx_file_ref text,
    pdf_file_ref text,
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT proposal_revisions_proposal_owner_fk
        FOREIGN KEY (proposal_id, tenant_id, customer_id, opportunity_id)
        REFERENCES app.proposals (id, tenant_id, customer_id, opportunity_id)
        ON DELETE CASCADE,

    CONSTRAINT proposal_revisions_version_positive
        CHECK (version > 0),

    CONSTRAINT proposal_revisions_status_check
        CHECK (
            status IN (
                'DRAFT',
                'INTERNAL_REVIEW',
                'APPROVED',
                'SUPERSEDED',
                'REJECTED'
            )
        ),

    CONSTRAINT proposal_revisions_content_object_check
        CHECK (jsonb_typeof(content) = 'object'),

    CONSTRAINT proposal_revisions_source_artifact_ids_array_check
        CHECK (jsonb_typeof(source_artifact_ids) = 'array'),

    CONSTRAINT proposal_revisions_proposal_version_unique
        UNIQUE (proposal_id, version),

    CONSTRAINT proposal_revisions_id_owner_unique
        UNIQUE (id, proposal_id, tenant_id, customer_id, opportunity_id)
);

CREATE INDEX IF NOT EXISTS proposal_revisions_proposal_idx
ON app.proposal_revisions (proposal_id, version DESC);

CREATE INDEX IF NOT EXISTS proposal_revisions_status_idx
ON app.proposal_revisions (proposal_id, status);
-- ============================================================
-- Proposal Reviews
--
-- Auditable internal review decisions for a specific Proposal Revision.
-- Actor identity is stored as an external/application reference because
-- no authoritative application-user table is currently defined here.
-- ============================================================

CREATE TABLE IF NOT EXISTS app.proposal_reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    opportunity_id uuid NOT NULL,
    proposal_id uuid NOT NULL,
    proposal_revision_id uuid NOT NULL,
    decision text NOT NULL,
    reviewer_ref text NOT NULL,
    comments text,
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT proposal_reviews_revision_owner_fk
        FOREIGN KEY (
            proposal_revision_id,
            proposal_id,
            tenant_id,
            customer_id,
            opportunity_id
        )
        REFERENCES app.proposal_revisions (
            id,
            proposal_id,
            tenant_id,
            customer_id,
            opportunity_id
        )
        ON DELETE RESTRICT,

    CONSTRAINT proposal_reviews_decision_check
        CHECK (
            decision IN (
                'APPROVED',
                'CHANGES_REQUESTED',
                'REJECTED'
            )
        ),

    CONSTRAINT proposal_reviews_reviewer_ref_not_blank
        CHECK (btrim(reviewer_ref) <> '')
);

CREATE INDEX IF NOT EXISTS proposal_reviews_revision_idx
ON app.proposal_reviews (proposal_revision_id, created_at);

CREATE INDEX IF NOT EXISTS proposal_reviews_proposal_idx
ON app.proposal_reviews (proposal_id, created_at);
-- ============================================================
-- Customer Decisions
--
-- Immutable customer decision history for a specific Proposal Revision.
-- Customer identity/contact is stored as a reference string because
-- no authoritative customer-contact table is defined in this migration.
-- ============================================================

CREATE TABLE IF NOT EXISTS app.customer_decisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    opportunity_id uuid NOT NULL,
    proposal_id uuid NOT NULL,
    proposal_revision_id uuid NOT NULL,
    decision text NOT NULL,
    customer_contact_ref text,
    comments text,
    effective_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT customer_decisions_revision_owner_fk
        FOREIGN KEY (
            proposal_revision_id,
            proposal_id,
            tenant_id,
            customer_id,
            opportunity_id
        )
        REFERENCES app.proposal_revisions (
            id,
            proposal_id,
            tenant_id,
            customer_id,
            opportunity_id
        )
        ON DELETE RESTRICT,

    CONSTRAINT customer_decisions_decision_check
        CHECK (
            decision IN (
                'ACCEPTED',
                'REJECTED',
                'CHANGES_REQUESTED',
                'ON_HOLD',
                'EXPIRED'
            )
        ),

    CONSTRAINT customer_decisions_contact_ref_not_blank
        CHECK (
            customer_contact_ref IS NULL
            OR btrim(customer_contact_ref) <> ''
        )
);

CREATE INDEX IF NOT EXISTS customer_decisions_revision_idx
ON app.customer_decisions (proposal_revision_id, effective_at);

CREATE INDEX IF NOT EXISTS customer_decisions_opportunity_idx
ON app.customer_decisions (opportunity_id, effective_at);

CREATE INDEX IF NOT EXISTS customer_decisions_proposal_idx
ON app.customer_decisions (proposal_id, effective_at);
-- ============================================================
-- AI Model Pricing
--
-- Versioned pricing snapshots for LLM usage.
-- Historical runs must retain the pricing basis effective at execution time.
-- ============================================================

CREATE TABLE IF NOT EXISTS app.ai_model_pricing (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider text NOT NULL,
    model text NOT NULL,
    currency text NOT NULL DEFAULT 'USD',
    input_price_per_million numeric(20,8) NOT NULL DEFAULT 0,
    output_price_per_million numeric(20,8) NOT NULL DEFAULT 0,
    cached_input_price_per_million numeric(20,8),
    reasoning_price_per_million numeric(20,8),
    source text,
    effective_from timestamptz NOT NULL,
    effective_to timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT ai_model_pricing_provider_not_blank
        CHECK (btrim(provider) <> ''),

    CONSTRAINT ai_model_pricing_model_not_blank
        CHECK (btrim(model) <> ''),

    CONSTRAINT ai_model_pricing_currency_check
        CHECK (currency ~ '^[A-Z]{3}$'),

    CONSTRAINT ai_model_pricing_input_nonnegative
        CHECK (input_price_per_million >= 0),

    CONSTRAINT ai_model_pricing_output_nonnegative
        CHECK (output_price_per_million >= 0),

    CONSTRAINT ai_model_pricing_cached_input_nonnegative
        CHECK (
            cached_input_price_per_million IS NULL
            OR cached_input_price_per_million >= 0
        ),

    CONSTRAINT ai_model_pricing_reasoning_nonnegative
        CHECK (
            reasoning_price_per_million IS NULL
            OR reasoning_price_per_million >= 0
        ),

    CONSTRAINT ai_model_pricing_effective_range_check
        CHECK (
            effective_to IS NULL
            OR effective_to > effective_from
        ),

    CONSTRAINT ai_model_pricing_identity_unique
        UNIQUE (provider, model, currency, effective_from)
);

CREATE INDEX IF NOT EXISTS ai_model_pricing_lookup_idx
ON app.ai_model_pricing (provider, model, currency, effective_from DESC);
-- ============================================================
-- AI Cost Estimates
--
-- Pre-run token and cost estimates.
-- Estimates are immutable planning snapshots and are compared
-- later against actual run usage.
-- ============================================================

CREATE TABLE IF NOT EXISTS app.ai_cost_estimates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL
        REFERENCES app.tenants(id),
    customer_id uuid,
    opportunity_id uuid,
    project_id uuid,
    proposal_id uuid,
    scope text NOT NULL,
    workflow_type text NOT NULL,
    agent_role text,
    provider text,
    model text,
    pricing_id uuid
        REFERENCES app.ai_model_pricing(id)
        ON DELETE RESTRICT,
    currency text NOT NULL DEFAULT 'USD',
    estimated_input_tokens bigint NOT NULL DEFAULT 0,
    estimated_output_tokens bigint NOT NULL DEFAULT 0,
    estimated_cached_input_tokens bigint NOT NULL DEFAULT 0,
    estimated_reasoning_tokens bigint NOT NULL DEFAULT 0,
    estimated_tool_calls integer NOT NULL DEFAULT 0,
    estimated_external_api_calls integer NOT NULL DEFAULT 0,
    estimated_external_cost numeric(20,8) NOT NULL DEFAULT 0,
    best_case_cost numeric(20,8) NOT NULL,
    expected_cost numeric(20,8) NOT NULL,
    worst_case_cost numeric(20,8) NOT NULL,
    confidence numeric(5,4),
    assumptions jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT ai_cost_estimates_customer_tenant_fk
        FOREIGN KEY (customer_id, tenant_id)
        REFERENCES app.customers (id, tenant_id)
        ON DELETE RESTRICT,
    CONSTRAINT ai_cost_estimates_opportunity_owner_fk
        FOREIGN KEY (opportunity_id, tenant_id, customer_id)
        REFERENCES app.opportunities (id, tenant_id, customer_id)
        ON DELETE RESTRICT,

    CONSTRAINT ai_cost_estimates_project_owner_fk
        FOREIGN KEY (project_id, tenant_id)
        REFERENCES app.projects (id, tenant_id)
        ON DELETE RESTRICT,

    CONSTRAINT ai_cost_estimates_proposal_owner_fk
        FOREIGN KEY (proposal_id, tenant_id, customer_id, opportunity_id)
        REFERENCES app.proposals (id, tenant_id, customer_id, opportunity_id)
        ON DELETE RESTRICT,
    CONSTRAINT ai_cost_estimates_scope_check
        CHECK (scope IN ('TENANT', 'CUSTOMER', 'OPPORTUNITY', 'PROJECT', 'PROPOSAL')),
    CONSTRAINT ai_cost_estimates_scope_ownership_check
        CHECK (
            (scope = 'TENANT' AND customer_id IS NULL AND opportunity_id IS NULL AND project_id IS NULL AND proposal_id IS NULL)
            OR
            (scope = 'CUSTOMER' AND customer_id IS NOT NULL AND opportunity_id IS NULL AND project_id IS NULL AND proposal_id IS NULL)
            OR
            (scope = 'OPPORTUNITY' AND customer_id IS NOT NULL AND opportunity_id IS NOT NULL AND project_id IS NULL AND proposal_id IS NULL)
            OR
            (scope = 'PROJECT' AND customer_id IS NOT NULL AND project_id IS NOT NULL AND proposal_id IS NULL)
            OR
            (scope = 'PROPOSAL' AND customer_id IS NOT NULL AND opportunity_id IS NOT NULL AND proposal_id IS NOT NULL AND project_id IS NULL)
        ),
    CONSTRAINT ai_cost_estimates_workflow_type_not_blank
        CHECK (btrim(workflow_type) <> ''),
    CONSTRAINT ai_cost_estimates_currency_check
        CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT ai_cost_estimates_tokens_nonnegative
        CHECK (
            estimated_input_tokens >= 0
            AND estimated_output_tokens >= 0
            AND estimated_cached_input_tokens >= 0
            AND estimated_reasoning_tokens >= 0
        ),
    CONSTRAINT ai_cost_estimates_calls_nonnegative
        CHECK (estimated_tool_calls >= 0 AND estimated_external_api_calls >= 0),
    CONSTRAINT ai_cost_estimates_costs_nonnegative
        CHECK (estimated_external_cost >= 0 AND best_case_cost >= 0 AND expected_cost >= 0 AND worst_case_cost >= 0),
    CONSTRAINT ai_cost_estimates_cost_order_check
        CHECK (best_case_cost <= expected_cost AND expected_cost <= worst_case_cost),
    CONSTRAINT ai_cost_estimates_confidence_check
        CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
    CONSTRAINT ai_cost_estimates_assumptions_array_check
        CHECK (jsonb_typeof(assumptions) = 'array')
);

CREATE INDEX IF NOT EXISTS ai_cost_estimates_tenant_idx
ON app.ai_cost_estimates (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_cost_estimates_opportunity_idx
ON app.ai_cost_estimates (opportunity_id, created_at DESC)
WHERE opportunity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ai_cost_estimates_project_idx
ON app.ai_cost_estimates (project_id, created_at DESC)
WHERE project_id IS NOT NULL;
-- ============================================================
-- AI Runs
--
-- Canonical execution identity for every agent/model/workflow run.
-- Actual token usage and cost line items are stored separately and
-- reference this run.
-- =============================================================

CREATE TABLE IF NOT EXISTS app.ai_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL
        REFERENCES app.tenants(id),
    customer_id uuid,
    opportunity_id uuid,
    project_id uuid,
    proposal_id uuid,
    artifact_id uuid,
    estimate_id uuid
        REFERENCES app.ai_cost_estimates(id)
        ON DELETE SET NULL,
    pricing_id uuid
        REFERENCES app.ai_model_pricing(id)
        ON DELETE RESTRICT,
    scope text NOT NULL,
    workflow_type text NOT NULL,
    agent_id text NOT NULL,
    agent_role text,
    provider text NOT NULL,
    model text NOT NULL,
    provider_run_id text,
    status text NOT NULL DEFAULT 'PLANNED',
    started_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT ai_runs_customer_tenant_fk
        FOREIGN KEY (customer_id, tenant_id)
        REFERENCES app.customers (id, tenant_id)
        ON DELETE RESTRICT,

    CONSTRAINT ai_runs_opportunity_owner_fk
        FOREIGN KEY (opportunity_id, tenant_id, customer_id)
        REFERENCES app.opportunities (id, tenant_id, customer_id)
        ON DELETE RESTRICT,

    CONSTRAINT ai_runs_project_owner_fk
        FOREIGN KEY (project_id, tenant_id)
        REFERENCES app.projects (id, tenant_id)
        ON DELETE RESTRICT,

    CONSTRAINT ai_runs_proposal_owner_fk
        FOREIGN KEY (proposal_id, tenant_id, customer_id, opportunity_id)
        REFERENCES app.proposals (id, tenant_id, customer_id, opportunity_id)
        ON DELETE RESTRICT,

    CONSTRAINT ai_runs_artifact_fk
        FOREIGN KEY (artifact_id)
        REFERENCES app.specialist_artifacts (id)
        ON DELETE SET NULL,

    CONSTRAINT ai_runs_scope_check
        CHECK (scope IN ('TENANT', 'CUSTOMER', 'OPPORTUNITY', 'PROJECT', 'PROPOSAL')),

    CONSTRAINT ai_runs_scope_ownership_check
        CHECK (
            (scope = 'TENANT' AND customer_id IS NULL AND opportunity_id IS NULL AND project_id IS NULL AND proposal_id IS NULL)
            OR
            (scope = 'CUSTOMER' AND customer_id IS NOT NULL AND opportunity_id IS NULL AND project_id IS NULL AND proposal_id IS NULL)
            OR
            (scope = 'OPPORTUNITY' AND customer_id IS NOT NULL AND opportunity_id IS NOT NULL AND project_id IS NULL AND proposal_id IS NULL)
            OR
            (scope = 'PROJECT' AND customer_id IS NOT NULL AND project_id IS NOT NULL AND proposal_id IS NULL)
            OR
            (scope = 'PROPOSAL' AND customer_id IS NOT NULL AND opportunity_id IS NOT NULL AND proposal_id IS NOT NULL AND project_id IS NULL)
        ),

    CONSTRAINT ai_runs_workflow_type_not_blank
        CHECK (btrim(workflow_type) <> ''),

    CONSTRAINT ai_runs_agent_id_not_blank
        CHECK (btrim(agent_id) <> ''),

    CONSTRAINT ai_runs_provider_not_blank
        CHECK (btrim(provider) <> ''),

    CONSTRAINT ai_runs_model_not_blank
        CHECK (btrim(model) <> ''),

    CONSTRAINT ai_runs_status_check
        CHECK (
            status IN (
                'PLANNED',
                'RUNNING',
                'COMPLETED',
                'FAILED',
                'CANCELED'
            )
        ),

    CONSTRAINT ai_runs_time_range_check
        CHECK (
            completed_at IS NULL
            OR started_at IS NULL
            OR completed_at >= started_at
        )
);

CREATE INDEX IF NOT EXISTS ai_runs_tenant_idx
ON app.ai_runs (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_runs_opportunity_idx
ON app.ai_runs (opportunity_id, created_at DESC)
WHERE opportunity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ai_runs_project_idx
ON app.ai_runs (project_id, created_at DESC)
WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ai_runs_provider_run_id_idx
ON app.ai_runs (provider, provider_run_id)
WHERE provider_run_id IS NOT NULL;
-- ============================================================
-- AI Token Usage
--
-- Actual provider-reported token usage for a canonical AI Run.
-- One final usage record is stored per run.
-- ============================================================

CREATE TABLE IF NOT EXISTS app.ai_token_usage (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL
        REFERENCES app.ai_runs(id)
        ON DELETE CASCADE,
    input_tokens bigint NOT NULL DEFAULT 0,
    output_tokens bigint NOT NULL DEFAULT 0,
    cached_input_tokens bigint NOT NULL DEFAULT 0,
    reasoning_tokens bigint NOT NULL DEFAULT 0,
    total_tokens bigint NOT NULL DEFAULT 0,
    provider_usage jsonb NOT NULL DEFAULT '{}'::jsonb,
    recorded_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT ai_token_usage_run_unique
        UNIQUE (run_id),

    CONSTRAINT ai_token_usage_tokens_nonnegative
        CHECK (
            input_tokens >= 0
            AND output_tokens >= 0
            AND cached_input_tokens >= 0
            AND reasoning_tokens >= 0
            AND total_tokens >= 0
        ),

    CONSTRAINT ai_token_usage_provider_usage_object_check
        CHECK (jsonb_typeof(provider_usage) = 'object')
);

CREATE INDEX IF NOT EXISTS ai_token_usage_recorded_at_idx
ON app.ai_token_usage (recorded_at DESC);
-- ============================================================
-- AI Cost Ledger
--
-- Line-item actual cost ledger for every AI Run.
-- Supports LLM tokens, research, image/video, embeddings, storage,
-- and other external API costs.
-- ============================================================

CREATE TABLE IF NOT EXISTS app.ai_cost_ledger (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL
        REFERENCES app.ai_runs(id)
        ON DELETE CASCADE,
    line_type text NOT NULL,
    provider text,
    service text,
    unit text,
    quantity numeric(24,8) NOT NULL DEFAULT 1,
    unit_price numeric(24,10) NOT NULL DEFAULT 0,
    cost numeric(24,10) NOT NULL,
    currency text NOT NULL DEFAULT 'USD',
    pricing_id uuid
        REFERENCES app.ai_model_pricing(id)
        ON DELETE RESTRICT,

    source_ref text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    recorded_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT ai_cost_ledger_line_type_check
        CHECK (
            line_type IN (
                'LLM_INPUT',
                'LLM_OUTPUT',
                'LLM_CACHED_INPUT',
                'LLM_REASONING',
                'WEB_SEARCH',
                'WEB_EXTRACT',
                'IMAGE_GENERATION',
                'VIDEO_GENERATION',
                'EMBEDDING',
                'STORAGE',
                'OTHER_API'
            )
        ),
    CONSTRAINT ai_cost_ledger_quantity_nonnegative
        CHECK (quantity >= 0),
    CONSTRAINT ai_cost_ledger_unit_price_nonnegative
        CHECK (unit_price >= 0),
    CONSTRAINT ai_cost_ledger_cost_nonnegative
        CHECK (cost >= 0),
    CONSTRAINT ai_cost_ledger_currency_check
        CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT ai_cost_ledger_metadata_object_check
        CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS ai_cost_ledger_run_idx
ON app.ai_cost_ledger (run_id, recorded_at);

CREATE INDEX IF NOT EXISTS ai_cost_ledger_line_type_idx
ON app.ai_cost_ledger (line_type, recorded_at);
-- ============================================================
-- AI Budgets
--
-- Budget policies for tenant, opportunity, and project AI/automation spend.
-- Thresholds are ratios of the configured budget amount.
-- =============================================================

CREATE TABLE IF NOT EXISTS app.ai_budgets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL
        REFERENCES app.tenants(id),
    customer_id uuid,
    opportunity_id uuid,
    project_id uuid,
    scope text NOT NULL,
    period_type text NOT NULL,
    period_start date,
    period_end date,
    budget_amount numeric(24,10) NOT NULL,
    currency text NOT NULL DEFAULT 'USD',
    warn_at_ratio numeric(8,6) NOT NULL DEFAULT 0.700000,
    require_approval_at_ratio numeric(8,6) NOT NULL DEFAULT 0.900000,
    block_at_ratio numeric(8,6) NOT NULL DEFAULT 1.000000,
    enforcement_mode text NOT NULL DEFAULT 'HARD',
    status text NOT NULL DEFAULT 'ACTIVE',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT ai_budgets_customer_tenant_fk
        FOREIGN KEY (customer_id, tenant_id)
        REFERENCES app.customers (id, tenant_id)
        ON DELETE RESTRICT,

    CONSTRAINT ai_budgets_opportunity_owner_fk
        FOREIGN KEY (opportunity_id, tenant_id, customer_id)
        REFERENCES app.opportunities (id, tenant_id, customer_id)
        ON DELETE RESTRICT,

    CONSTRAINT ai_budgets_project_owner_fk
        FOREIGN KEY (project_id, tenant_id)
        REFERENCES app.projects (id, tenant_id)
        ON DELETE RESTRICT,

    CONSTRAINT ai_budgets_scope_check
        CHECK (scope IN ('TENANT', 'OPPORTUNITY', 'PROJECT')),

    CONSTRAINT ai_budgets_scope_ownership_check
        CHECK (
            (scope = 'TENANT'
                AND customer_id IS NULL
                AND opportunity_id IS NULL
                AND project_id IS NULL)
            OR
            (scope = 'OPPORTUNITY'
                AND customer_id IS NOT NULL
                AND opportunity_id IS NOT NULL
                AND project_id IS NULL)
            OR
            (scope = 'PROJECT'
                AND customer_id IS NOT NULL
                AND project_id IS NOT NULL)
        ),

    CONSTRAINT ai_budgets_period_type_check
        CHECK (period_type IN ('MONTHLY', 'LIFECYCLE', 'CUSTOM')),

    CONSTRAINT ai_budgets_period_presence_check
        CHECK (
            (period_type = 'LIFECYCLE'
                AND period_start IS NULL
                AND period_end IS NULL)
            OR
            (period_type IN ('MONTHLY', 'CUSTOM')
                AND period_start IS NOT NULL
                AND period_end IS NOT NULL)
        ),

    CONSTRAINT ai_budgets_period_range_check
        CHECK (
            period_start IS NULL
            OR period_end IS NULL
            OR period_end >= period_start
        ),

    CONSTRAINT ai_budgets_monthly_period_check
        CHECK (
            period_type <> 'MONTHLY'
            OR (
                EXTRACT(DAY FROM period_start) = 1
                AND period_end = (period_start + INTERVAL '1 month - 1 day')::date
            )
        ),

    CONSTRAINT ai_budgets_amount_positive
        CHECK (budget_amount > 0),

    CONSTRAINT ai_budgets_currency_check
        CHECK (currency ~ '^[A-Z]{3}$'),

    CONSTRAINT ai_budgets_thresholds_check
        CHECK (
            warn_at_ratio >= 0
            AND require_approval_at_ratio >= warn_at_ratio
            AND block_at_ratio >= require_approval_at_ratio
        ),

    CONSTRAINT ai_budgets_enforcement_mode_check
        CHECK (enforcement_mode IN ('SOFT', 'HARD')),

    CONSTRAINT ai_budgets_status_check
        CHECK (status IN ('ACTIVE', 'PAUSED', 'ARCHIVED'))
);

CREATE INDEX IF NOT EXISTS ai_budgets_tenant_idx
ON app.ai_budgets (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_budgets_opportunity_idx
ON app.ai_budgets (opportunity_id, status, created_at DESC)
WHERE opportunity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ai_budgets_project_idx
ON app.ai_budgets (project_id, status, created_at DESC)
WHERE project_id IS NOT NULL;

COMMIT;
