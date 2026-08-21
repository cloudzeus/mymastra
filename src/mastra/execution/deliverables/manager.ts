import type {
  PoolClient,
} from "pg";

import {
  appDb,
} from "../../db/postgres";

import type {
  CreateExecutionDeliverableRevisionInput,
  ExecutionDeliverable,
  ExecutionDeliverableReview,
  ExecutionDeliverableRevision,
  ExecutionDeliverableRevisionStatus,
  ExecutionReviewDecision,
  RequestedChange,
  ReviewExecutionDeliverableInput,
} from "./types";


type DeliverableRow = {
  id: string;
  tenant_id: string;
  project_id: string;
  execution_plan_id: string;
  stage_id: string;
  agent_role: string;
  deliverable_type: string;
  created_at: string;
  updated_at: string;
};


type RevisionRow = {
  id: string;
  deliverable_id: string;
  version: number;
  status:
    ExecutionDeliverableRevisionStatus;
  revision_of_id: string | null;
  content_snapshot: unknown;
  output_kind: string | null;
  specialist_artifact_id:
    string | null;
  developer_work_order_id:
    string | null;
  change_resolution: unknown;
  created_at: string;
};


type ReviewRow = {
  id: string;
  tenant_id: string;
  project_id: string;
  execution_plan_id: string;
  stage_id: string;
  deliverable_id: string;
  deliverable_revision_id: string;
  decision:
    ExecutionReviewDecision;
  reviewer_ref: string;
  summary: string | null;
  requested_changes: unknown;
  created_at: string;
};


function requireText(
  value: string,
  fieldName: string,
): string {
  const normalized =
    value?.trim();

  if (!normalized) {
    throw new Error(
      `${fieldName} is required`,
    );
  }

  return normalized;
}


function requireObject(
  value: Record<string, unknown>,
  fieldName: string,
): Record<string, unknown> {
  if (
    typeof value !==
      "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new Error(
      `${fieldName} must be an object`,
    );
  }

  return value;
}


function asArray<T>(
  value: unknown,
): T[] {
  return Array.isArray(value)
    ? value as T[]
    : [];
}


function mapDeliverable(
  row: DeliverableRow,
): ExecutionDeliverable {
  return {
    id:
      row.id,

    tenantId:
      row.tenant_id,

    projectId:
      row.project_id,

    executionPlanId:
      row.execution_plan_id,

    stageId:
      row.stage_id,

    agentRole:
      row.agent_role as
        ExecutionDeliverable["agentRole"],

    deliverableType:
      row.deliverable_type,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  };
}


function mapRevision(
  row: RevisionRow,
): ExecutionDeliverableRevision {
  return {
    id:
      row.id,

    deliverableId:
      row.deliverable_id,

    version:
      row.version,

    status:
      row.status,

    revisionOfId:
      row.revision_of_id ??
      undefined,

    contentSnapshot:
      (
        typeof row.content_snapshot ===
          "object" &&
        row.content_snapshot !==
          null &&
        !Array.isArray(
          row.content_snapshot,
        )
      )
        ? row.content_snapshot as
            Record<string, unknown>
        : {},

    outputKind:
      row.output_kind ??
      undefined,

    specialistArtifactId:
      row.specialist_artifact_id ??
      undefined,

    developerWorkOrderId:
      row.developer_work_order_id ??
      undefined,

    changeResolution:
      asArray(
        row.change_resolution,
      ),

    createdAt:
      row.created_at,
  };
}


function mapReview(
  row: ReviewRow,
): ExecutionDeliverableReview {
  return {
    id:
      row.id,

    tenantId:
      row.tenant_id,

    projectId:
      row.project_id,

    executionPlanId:
      row.execution_plan_id,

    stageId:
      row.stage_id,

    deliverableId:
      row.deliverable_id,

    deliverableRevisionId:
      row.deliverable_revision_id,

    decision:
      row.decision,

    reviewerRef:
      row.reviewer_ref,

    summary:
      row.summary ??
      undefined,

    requestedChanges:
      asArray<RequestedChange>(
        row.requested_changes,
      ),

    createdAt:
      row.created_at,
  };
}


function validateRequestedChanges(
  decision:
    ExecutionReviewDecision,
  requestedChanges:
    RequestedChange[],
): void {
  if (
    decision ===
      "CHANGES_REQUESTED" &&
    requestedChanges.length ===
      0
  ) {
    throw new Error(
      "CHANGES_REQUESTED requires at least one requested change",
    );
  }


  const ids =
    new Set<string>();


  for (
    const change of
    requestedChanges
  ) {
    const id =
      requireText(
        change.id,
        "requestedChange.id",
      );

    requireText(
      change.target,
      "requestedChange.target",
    );

    requireText(
      change.description,
      "requestedChange.description",
    );


    if (
      change.severity !==
        "REQUIRED" &&
      change.severity !==
        "RECOMMENDED"
    ) {
      throw new Error(
        `Invalid requested change severity: ${change.severity}`,
      );
    }


    if (
      ids.has(id)
    ) {
      throw new Error(
        `Duplicate requested change id: ${id}`,
      );
    }


    ids.add(id);
  }
}


export async function createExecutionDeliverableRevision(
  input:
    CreateExecutionDeliverableRevisionInput,
): Promise<{
  deliverable:
    ExecutionDeliverable;

  revision:
    ExecutionDeliverableRevision;
}> {
  requireObject(
    input.contentSnapshot,
    "contentSnapshot",
  );


  const deliverableType =
    requireText(
      input.deliverableType,
      "deliverableType",
    );


  const client =
    await appDb.connect();


  try {
    await client.query(
      "BEGIN",
    );


    const stageResult =
      await client.query<{
        project_id: string;
        execution_plan_id: string;
        agent_role: string;
        status: string;
      }>(
        `
          SELECT
            project_id::text,
            execution_plan_id::text,
            agent_role,
            status
          FROM app.project_execution_stages
          WHERE id = $1
            AND execution_plan_id = $2
            AND project_id = $3
          FOR UPDATE
        `,
        [
          input.stageId,
          input.executionPlanId,
          input.projectId,
        ],
      );


    const stage =
      stageResult.rows[0];


    if (!stage) {
      throw new Error(
        "Execution stage ownership validation failed",
      );
    }


    if (
      stage.agent_role !==
        input.agentRole
    ) {
      throw new Error(
        "Execution deliverable agent role mismatch",
      );
    }


    if (
      stage.status !==
        "RUNNING"
    ) {
      throw new Error(
        `Execution deliverable revision can only be created while stage is RUNNING; current status=${stage.status}`,
      );
    }


    const planResult =
      await client.query(
        `
          SELECT id
          FROM app.project_execution_plans
          WHERE id = $1
            AND tenant_id = $2
            AND project_id = $3
          FOR UPDATE
        `,
        [
          input.executionPlanId,
          input.tenantId,
          input.projectId,
        ],
      );


    if (
      planResult.rowCount !==
        1
    ) {
      throw new Error(
        "Execution plan ownership validation failed",
      );
    }


    let deliverableResult =
      await client.query<
        DeliverableRow
      >(
        `
          SELECT
            id::text,
            tenant_id::text,
            project_id::text,
            execution_plan_id::text,
            stage_id::text,
            agent_role,
            deliverable_type,
            created_at::text,
            updated_at::text
          FROM app.project_execution_deliverables
          WHERE stage_id = $1
            AND deliverable_type = $2
          FOR UPDATE
        `,
        [
          input.stageId,
          deliverableType,
        ],
      );


    if (
      deliverableResult.rowCount ===
        0
    ) {
      deliverableResult =
        await client.query<
          DeliverableRow
        >(
          `
            INSERT INTO app.project_execution_deliverables (
              tenant_id,
              project_id,
              execution_plan_id,
              stage_id,
              agent_role,
              deliverable_type
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6
            )
            RETURNING
              id::text,
              tenant_id::text,
              project_id::text,
              execution_plan_id::text,
              stage_id::text,
              agent_role,
              deliverable_type,
              created_at::text,
              updated_at::text
          `,
          [
            input.tenantId,
            input.projectId,
            input.executionPlanId,
            input.stageId,
            input.agentRole,
            deliverableType,
          ],
        );
    }


    const deliverableRow =
      deliverableResult.rows[0];


    const latestResult =
      await client.query<
        RevisionRow
      >(
        `
          SELECT
            id::text,
            deliverable_id::text,
            version,
            status,
            revision_of_id::text,
            content_snapshot,
            output_kind,
            specialist_artifact_id::text,
            developer_work_order_id::text,
            change_resolution,
            created_at::text
          FROM app.project_execution_deliverable_revisions
          WHERE deliverable_id = $1
          ORDER BY version DESC
          LIMIT 1
          FOR UPDATE
        `,
        [
          deliverableRow.id,
        ],
      );


    const latest =
      latestResult.rows[0];


    if (
      latest &&
      latest.status !==
        "CHANGES_REQUESTED"
    ) {
      throw new Error(
        `Cannot create another deliverable revision while latest revision status=${latest.status}`,
      );
    }


    if (
      latest &&
      input.revisionOfId !==
        latest.id
    ) {
      throw new Error(
        "Revision must explicitly reference the latest CHANGES_REQUESTED revision",
      );
    }


    if (
      !latest &&
      input.revisionOfId
    ) {
      throw new Error(
        "Initial deliverable revision cannot specify revisionOfId",
      );
    }


    const nextVersion =
      latest
        ? latest.version + 1
        : 1;


    const revisionResult =
      await client.query<
        RevisionRow
      >(
        `
          INSERT INTO app.project_execution_deliverable_revisions (
            deliverable_id,
            version,
            status,
            revision_of_id,
            content_snapshot,
            output_kind,
            specialist_artifact_id,
            developer_work_order_id,
            change_resolution
          )
          VALUES (
            $1,
            $2,
            'DRAFT',
            $3,
            $4::jsonb,
            $5,
            $6,
            $7,
            $8::jsonb
          )
          RETURNING
            id::text,
            deliverable_id::text,
            version,
            status,
            revision_of_id::text,
            content_snapshot,
            output_kind,
            specialist_artifact_id::text,
            developer_work_order_id::text,
            change_resolution,
            created_at::text
        `,
        [
          deliverableRow.id,
          nextVersion,
          input.revisionOfId ??
            null,
          JSON.stringify(
            input.contentSnapshot,
          ),
          input.outputKind?.trim() ||
            null,
          input.specialistArtifactId ??
            null,
          input.developerWorkOrderId ??
            null,
          JSON.stringify(
            input.changeResolution ??
              [],
          ),
        ],
      );


    /*
     * Only after the new revision exists successfully
     * do we supersede the prior CHANGES_REQUESTED revision.
     */
    if (latest) {
      await client.query(
        `
          UPDATE app.project_execution_deliverable_revisions
          SET status = 'SUPERSEDED'
          WHERE id = $1
            AND status =
              'CHANGES_REQUESTED'
        `,
        [
          latest.id,
        ],
      );
    }


    await client.query(
      `
        UPDATE app.project_execution_deliverables
        SET updated_at = now()
        WHERE id = $1
      `,
      [
        deliverableRow.id,
      ],
    );


    await client.query(
      "COMMIT",
    );


    return {
      deliverable:
        mapDeliverable(
          deliverableRow,
        ),

      revision:
        mapRevision(
          revisionResult.rows[0],
        ),
    };
  }
  catch (error) {
    await client.query(
      "ROLLBACK",
    );

    throw error;
  }
  finally {
    client.release();
  }
}


export async function submitExecutionDeliverableRevisionForReview(
  tenantId: string,
  executionPlanId: string,
  stageId: string,
  revisionId: string,
): Promise<ExecutionDeliverableRevision> {
  const client =
    await appDb.connect();


  try {
    await client.query(
      "BEGIN",
    );


    const result =
      await client.query<
        RevisionRow
      >(
        `
          UPDATE app.project_execution_deliverable_revisions r
          SET status = 'SUBMITTED'
          FROM app.project_execution_deliverables d
          WHERE r.id = $1
            AND r.deliverable_id = d.id
            AND d.tenant_id = $2
            AND d.execution_plan_id = $3
            AND d.stage_id = $4
            AND r.status = 'DRAFT'
          RETURNING
            r.id::text,
            r.deliverable_id::text,
            r.version,
            r.status,
            r.revision_of_id::text,
            r.content_snapshot,
            r.output_kind,
            r.specialist_artifact_id::text,
            r.developer_work_order_id::text,
            r.change_resolution,
            r.created_at::text
        `,
        [
          revisionId,
          tenantId,
          executionPlanId,
          stageId,
        ],
      );


    const row =
      result.rows[0];


    if (!row) {
      throw new Error(
        "Deliverable revision must exist and be DRAFT before submission",
      );
    }


    await client.query(
      "COMMIT",
    );


    return mapRevision(
      row,
    );
  }
  catch (error) {
    await client.query(
      "ROLLBACK",
    );

    throw error;
  }
  finally {
    client.release();
  }
}


async function unlockEligibleExecutionStages(
  client: PoolClient,
  executionPlanId: string,
): Promise<string[]> {
  const result =
    await client.query<{
      stage_key: string;
    }>(
      `
        UPDATE app.project_execution_stages child

        SET
          status = 'READY',
          updated_at = now()

        WHERE child.execution_plan_id = $1
          AND child.status = 'PENDING'

          AND EXISTS (
            SELECT 1
            FROM app.project_execution_stage_dependencies d
            WHERE d.execution_plan_id =
              child.execution_plan_id
              AND d.stage_id =
                child.id
          )

          AND NOT EXISTS (
            SELECT 1

            FROM app.project_execution_stage_dependencies d

            JOIN app.project_execution_stages parent
              ON parent.id =
                d.depends_on_stage_id
              AND parent.execution_plan_id =
                d.execution_plan_id

            WHERE d.execution_plan_id =
              child.execution_plan_id

              AND d.stage_id =
                child.id

              AND parent.status NOT IN (
                'COMPLETED',
                'SKIPPED'
              )
          )

        RETURNING
          child.stage_key
      `,
      [
        executionPlanId,
      ],
    );


  return result.rows.map(
    row =>
      row.stage_key,
  );
}


async function syncExecutionPlanStatus(
  client: PoolClient,
  executionPlanId: string,
): Promise<
  | "DRAFT"
  | "READY"
  | "ACTIVE"
  | "BLOCKED"
  | "COMPLETED"
  | "CANCELLED"
> {
  const currentResult =
    await client.query<{
      status:
        | "DRAFT"
        | "READY"
        | "ACTIVE"
        | "BLOCKED"
        | "COMPLETED"
        | "CANCELLED";
    }>(
      `
        SELECT status

        FROM app.project_execution_plans

        WHERE id = $1

        FOR UPDATE
      `,
      [
        executionPlanId,
      ],
    );


  const current =
    currentResult.rows[0];


  if (!current) {
    throw new Error(
      `Execution plan not found while synchronizing status: ${executionPlanId}`,
    );
  }


  if (
    current.status ===
      "CANCELLED"
  ) {
    return "CANCELLED";
  }


  const counts =
    await client.query<{
      total: number;
      terminal: number;
      blocked: number;
      active: number;
    }>(
      `
        SELECT

          COUNT(*)::int
            AS total,

          COUNT(*) FILTER (
            WHERE status IN (
              'COMPLETED',
              'SKIPPED'
            )
          )::int
            AS terminal,

          COUNT(*) FILTER (
            WHERE status =
              'BLOCKED'
          )::int
            AS blocked,

          COUNT(*) FILTER (
            WHERE status IN (
              'RUNNING',
              'WAITING_APPROVAL'
            )
          )::int
            AS active

        FROM app.project_execution_stages

        WHERE execution_plan_id = $1
      `,
      [
        executionPlanId,
      ],
    );


  const row =
    counts.rows[0];


  let status:
    | "READY"
    | "ACTIVE"
    | "BLOCKED"
    | "COMPLETED";


  if (
    row.total > 0 &&
    row.terminal ===
      row.total
  ) {
    status =
      "COMPLETED";
  }
  else if (
    row.blocked >
      0
  ) {
    status =
      "BLOCKED";
  }
  else if (
    row.active >
      0
  ) {
    status =
      "ACTIVE";
  }
  else {
    status =
      "READY";
  }


  await client.query(
    `
      UPDATE app.project_execution_plans

      SET
        status = $2,
        updated_at = now()

      WHERE id = $1
    `,
    [
      executionPlanId,
      status,
    ],
  );


  return status;
}


export async function reviewExecutionDeliverableRevision(
  input:
    ReviewExecutionDeliverableInput,
): Promise<{
  review:
    ExecutionDeliverableReview;

  revision:
    ExecutionDeliverableRevision;

  stageStatus:
    | "READY"
    | "COMPLETED"
    | "BLOCKED";

  unlockedStageKeys:
    string[];

  planStatus:
    | "DRAFT"
    | "READY"
    | "ACTIVE"
    | "BLOCKED"
    | "COMPLETED"
    | "CANCELLED";
}> {
  const requestedChanges =
    input.requestedChanges ??
    [];


  validateRequestedChanges(
    input.decision,
    requestedChanges,
  );


  const reviewerRef =
    requireText(
      input.reviewerRef,
      "reviewerRef",
    );


  const client =
    await appDb.connect();


  try {
    await client.query(
      "BEGIN",
    );


    /*
     * Lock exact revision + logical deliverable.
     * The model/reviewer cannot redirect the review
     * to another project, plan or stage.
     */
    const revisionResult =
      await client.query<
        RevisionRow & {
          tenant_id: string;
          project_id: string;
          execution_plan_id: string;
          stage_id: string;
        }
      >(
        `
          SELECT
            r.id::text,
            r.deliverable_id::text,
            r.version,
            r.status,
            r.revision_of_id::text,
            r.content_snapshot,
            r.output_kind,
            r.specialist_artifact_id::text,
            r.developer_work_order_id::text,
            r.change_resolution,
            r.created_at::text,

            d.tenant_id::text,
            d.project_id::text,
            d.execution_plan_id::text,
            d.stage_id::text

          FROM app.project_execution_deliverable_revisions r

          JOIN app.project_execution_deliverables d
            ON d.id =
              r.deliverable_id

          WHERE r.id = $1
            AND d.tenant_id = $2
            AND d.execution_plan_id = $3
            AND d.stage_id = $4

          FOR UPDATE OF r, d
        `,
        [
          input.deliverableRevisionId,
          input.tenantId,
          input.executionPlanId,
          input.stageId,
        ],
      );


    const revision =
      revisionResult.rows[0];


    if (!revision) {
      throw new Error(
        "Deliverable revision ownership validation failed",
      );
    }


    if (
      revision.status !==
        "SUBMITTED"
    ) {
      throw new Error(
        `Deliverable revision must be SUBMITTED before review; current status=${revision.status}`,
      );
    }


    /*
     * A review is valid only against an exact
     * approval-gated stage currently awaiting
     * human decision.
     */
    const stageResult =
      await client.query<{
        status: string;
        approval_required: boolean;
      }>(
        `
          SELECT
            status,
            approval_required

          FROM app.project_execution_stages

          WHERE id = $1
            AND execution_plan_id = $2
            AND project_id = $3

          FOR UPDATE
        `,
        [
          revision.stage_id,
          revision.execution_plan_id,
          revision.project_id,
        ],
      );


    const stage =
      stageResult.rows[0];


    if (!stage) {
      throw new Error(
        "Execution stage ownership validation failed during deliverable review",
      );
    }


    if (
      !stage.approval_required
    ) {
      throw new Error(
        "Execution deliverable review requires an approval-gated stage",
      );
    }


    if (
      stage.status !==
        "WAITING_APPROVAL"
    ) {
      throw new Error(
        `Execution stage must be WAITING_APPROVAL before deliverable review; current status=${stage.status}`,
      );
    }


    const revisionTargetStatus:
      ExecutionDeliverableRevisionStatus =
      input.decision ===
        "APPROVED"
        ? "APPROVED"
        : input.decision ===
            "CHANGES_REQUESTED"
          ? "CHANGES_REQUESTED"
          : "REJECTED";


    /*
     * Immutable audit record of the human decision.
     */
    const reviewResult =
      await client.query<
        ReviewRow
      >(
        `
          INSERT INTO app.project_execution_reviews (
            tenant_id,
            project_id,
            execution_plan_id,
            stage_id,
            deliverable_id,
            deliverable_revision_id,
            decision,
            reviewer_ref,
            summary,
            requested_changes
          )

          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10::jsonb
          )

          RETURNING
            id::text,
            tenant_id::text,
            project_id::text,
            execution_plan_id::text,
            stage_id::text,
            deliverable_id::text,
            deliverable_revision_id::text,
            decision,
            reviewer_ref,
            summary,
            requested_changes,
            created_at::text
        `,
        [
          revision.tenant_id,
          revision.project_id,
          revision.execution_plan_id,
          revision.stage_id,
          revision.deliverable_id,
          revision.id,
          input.decision,
          reviewerRef,

          input.summary?.trim() ||
            null,

          JSON.stringify(
            requestedChanges,
          ),
        ],
      );


    /*
     * Revision transition and stage transition happen
     * in the same PostgreSQL transaction.
     */
    const updatedRevisionResult =
      await client.query<
        RevisionRow
      >(
        `
          UPDATE app.project_execution_deliverable_revisions

          SET status = $2

          WHERE id = $1
            AND status =
              'SUBMITTED'

          RETURNING
            id::text,
            deliverable_id::text,
            version,
            status,
            revision_of_id::text,
            content_snapshot,
            output_kind,
            specialist_artifact_id::text,
            developer_work_order_id::text,
            change_resolution,
            created_at::text
        `,
        [
          revision.id,
          revisionTargetStatus,
        ],
      );


    if (
      updatedRevisionResult.rowCount !==
        1
    ) {
      throw new Error(
        "Deliverable revision review transition failed",
      );
    }


    const stageTargetStatus:
      | "READY"
      | "COMPLETED"
      | "BLOCKED" =
      input.decision ===
        "APPROVED"
        ? "COMPLETED"
        : input.decision ===
            "CHANGES_REQUESTED"
          ? "READY"
          : "BLOCKED";


    const stageTransition =
      await client.query<{
        status:
          | "READY"
          | "COMPLETED"
          | "BLOCKED";
      }>(
        `
          UPDATE app.project_execution_stages

          SET
            status = $4,
            updated_at = now()

          WHERE id = $1
            AND execution_plan_id = $2
            AND status = $3

          RETURNING status
        `,
        [
          revision.stage_id,
          revision.execution_plan_id,
          "WAITING_APPROVAL",
          stageTargetStatus,
        ],
      );


    if (
      stageTransition.rowCount !==
        1
    ) {
      throw new Error(
        "Concurrent execution stage review transition detected",
      );
    }


    let unlockedStageKeys:
      string[] = [];


    /*
     * Only approval satisfies dependencies.
     *
     * CHANGES_REQUESTED returns the same stage to READY.
     * REJECTED blocks it.
     */
    if (
      stageTargetStatus ===
        "COMPLETED"
    ) {
      unlockedStageKeys =
        await unlockEligibleExecutionStages(
          client,
          revision.execution_plan_id,
        );
    }


    const planStatus =
      await syncExecutionPlanStatus(
        client,
        revision.execution_plan_id,
      );


    await client.query(
      "COMMIT",
    );


    return {
      review:
        mapReview(
          reviewResult.rows[0],
        ),

      revision:
        mapRevision(
          updatedRevisionResult.rows[0],
        ),

      stageStatus:
        stageTargetStatus,

      unlockedStageKeys,

      planStatus,
    };
  }
  catch (error) {
    await client.query(
      "ROLLBACK",
    );

    throw error;
  }
  finally {
    client.release();
  }
}


export async function getLatestExecutionDeliverableRevision(
  stageId: string,
  deliverableType: string,
): Promise<
  ExecutionDeliverableRevision |
  undefined
> {
  const result =
    await appDb.query<
      RevisionRow
    >(
      `
        SELECT
          r.id::text,
          r.deliverable_id::text,
          r.version,
          r.status,
          r.revision_of_id::text,
          r.content_snapshot,
          r.output_kind,
          r.specialist_artifact_id::text,
          r.developer_work_order_id::text,
          r.change_resolution,
          r.created_at::text
        FROM app.project_execution_deliverable_revisions r
        JOIN app.project_execution_deliverables d
          ON d.id =
            r.deliverable_id
        WHERE d.stage_id = $1
          AND d.deliverable_type = $2
        ORDER BY r.version DESC
        LIMIT 1
      `,
      [
        stageId,
        requireText(
          deliverableType,
          "deliverableType",
        ),
      ],
    );


  const row =
    result.rows[0];


  return row
    ? mapRevision(row)
    : undefined;
}
