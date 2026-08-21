import type {
  PoolClient,
} from "pg";

import {
  appDb,
} from "../db/postgres";

import type {
  ProjectExecutionPlanStatus,
  ProjectExecutionStage,
  ProjectExecutionStageStatus,
  ProjectExecutionAgentRole,
  ProjectExecutionKind,
} from "./types";

import type {
  SpecialistArtifactType,
} from "../specialists/types";


type StageRow = {
  id: string;

  execution_plan_id: string;

  project_id: string;

  stage_key: string;

  agent_role:
    ProjectExecutionAgentRole;

  execution_kind:
    ProjectExecutionKind;

  expected_artifact_type:
    SpecialistArtifactType | null;

  required: boolean;

  approval_required: boolean;

  status:
    ProjectExecutionStageStatus;

  configuration: unknown;

  created_at: string;

  updated_at: string;
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


function asObject(
  value: unknown,
): Record<string, unknown> {
  if (
    typeof value !==
      "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return {};
  }

  return value as
    Record<string, unknown>;
}


function mapStage(
  row: StageRow,
): ProjectExecutionStage {
  return {
    id:
      row.id,

    executionPlanId:
      row.execution_plan_id,

    projectId:
      row.project_id,

    stageKey:
      row.stage_key,

    agentRole:
      row.agent_role,

    executionKind:
      row.execution_kind,

    expectedArtifactType:
      row.expected_artifact_type ??
      undefined,

    required:
      row.required,

    approvalRequired:
      row.approval_required,

    status:
      row.status,

    configuration:
      asObject(
        row.configuration,
      ),

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  };
}


async function lockPlan(
  client: PoolClient,
  tenantId: string,
  executionPlanId: string,
): Promise<{
  id: string;
  status: ProjectExecutionPlanStatus;
}> {
  const result =
    await client.query<{
      id: string;
      status:
        ProjectExecutionPlanStatus;
    }>(
      `
        SELECT
          id::text,
          status

        FROM app.project_execution_plans

        WHERE id = $1
          AND tenant_id = $2

        FOR UPDATE
      `,
      [
        executionPlanId,
        tenantId,
      ],
    );

  const row =
    result.rows[0];

  if (!row) {
    throw new Error(
      `Project execution plan not found: ${executionPlanId}`,
    );
  }

  if (
    row.status ===
      "CANCELLED"
  ) {
    throw new Error(
      "Cannot execute stages of a CANCELLED plan",
    );
  }

  if (
    row.status ===
      "COMPLETED"
  ) {
    throw new Error(
      "Cannot execute stages of a COMPLETED plan",
    );
  }

  return row;
}


async function lockStage(
  client: PoolClient,
  executionPlanId: string,
  stageId: string,
): Promise<StageRow> {
  const result =
    await client.query<
      StageRow
    >(
      `
        SELECT
          id::text,
          execution_plan_id::text,
          project_id::text,
          stage_key,
          agent_role,
          execution_kind,
          expected_artifact_type,
          required,
          approval_required,
          status,
          configuration,
          created_at::text,
          updated_at::text

        FROM app.project_execution_stages

        WHERE id = $1
          AND execution_plan_id = $2

        FOR UPDATE
      `,
      [
        stageId,
        executionPlanId,
      ],
    );

  const row =
    result.rows[0];

  if (!row) {
    throw new Error(
      `Execution stage not found: ${stageId}`,
    );
  }

  return row;
}


async function unlockEligibleStages(
  client: PoolClient,
  executionPlanId: string,
): Promise<string[]> {
  const result =
    await client.query<{
      id: string;
      stage_key: string;
    }>(
      `
        UPDATE app.project_execution_stages child

        SET
          status = 'READY',
          updated_at = now()

        WHERE child.execution_plan_id = $1

          AND child.status =
            'PENDING'

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
          child.id::text,
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


async function syncPlanStatus(
  client: PoolClient,
  executionPlanId: string,
): Promise<ProjectExecutionPlanStatus> {
  const current =
    await client.query<{
      status:
        ProjectExecutionPlanStatus;
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

  const currentStatus =
    current.rows[0]
      ?.status;

  if (!currentStatus) {
    throw new Error(
      `Execution plan not found while synchronizing status: ${executionPlanId}`,
    );
  }

  if (
    currentStatus ===
      "CANCELLED"
  ) {
    return "CANCELLED";
  }


  const counts =
    await client.query<{
      total: number;
      completed: number;
      skipped: number;
      blocked: number;
      running: number;
      waiting_approval: number;
      ready: number;
      pending: number;
    }>(
      `
        SELECT

          COUNT(*)::int
            AS total,

          COUNT(*) FILTER (
            WHERE status =
              'COMPLETED'
          )::int
            AS completed,

          COUNT(*) FILTER (
            WHERE status =
              'SKIPPED'
          )::int
            AS skipped,

          COUNT(*) FILTER (
            WHERE status =
              'BLOCKED'
          )::int
            AS blocked,

          COUNT(*) FILTER (
            WHERE status =
              'RUNNING'
          )::int
            AS running,

          COUNT(*) FILTER (
            WHERE status =
              'WAITING_APPROVAL'
          )::int
            AS waiting_approval,

          COUNT(*) FILTER (
            WHERE status =
              'READY'
          )::int
            AS ready,

          COUNT(*) FILTER (
            WHERE status =
              'PENDING'
          )::int
            AS pending

        FROM app.project_execution_stages

        WHERE execution_plan_id = $1
      `,
      [
        executionPlanId,
      ],
    );


  const row =
    counts.rows[0];


  let nextStatus:
    ProjectExecutionPlanStatus;


  if (
    row.total > 0 &&
    row.completed +
      row.skipped ===
      row.total
  ) {
    nextStatus =
      "COMPLETED";
  }
  else if (
    row.blocked > 0
  ) {
    nextStatus =
      "BLOCKED";
  }
  else if (
    row.running > 0 ||
    row.waiting_approval > 0
  ) {
    nextStatus =
      "ACTIVE";
  }
  else {
    nextStatus =
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
      nextStatus,
    ],
  );


  return nextStatus;
}


async function updateStageStatus(
  client: PoolClient,
  stageId: string,
  expectedStatus:
    ProjectExecutionStageStatus,
  targetStatus:
    ProjectExecutionStageStatus,
): Promise<StageRow> {
  const result =
    await client.query<
      StageRow
    >(
      `
        UPDATE app.project_execution_stages

        SET
          status = $3,
          updated_at = now()

        WHERE id = $1
          AND status = $2

        RETURNING
          id::text,
          execution_plan_id::text,
          project_id::text,
          stage_key,
          agent_role,
          execution_kind,
          expected_artifact_type,
          required,
          approval_required,
          status,
          configuration,
          created_at::text,
          updated_at::text
      `,
      [
        stageId,
        expectedStatus,
        targetStatus,
      ],
    );

  const row =
    result.rows[0];

  if (!row) {
    throw new Error(
      `Concurrent stage status change detected for stage=${stageId}`,
    );
  }

  return row;
}


export async function startExecutionStage(
  tenantId: string,
  executionPlanId: string,
  stageId: string,
): Promise<ProjectExecutionStage> {
  const normalizedTenantId =
    requireText(
      tenantId,
      "tenantId",
    );

  const normalizedPlanId =
    requireText(
      executionPlanId,
      "executionPlanId",
    );

  const normalizedStageId =
    requireText(
      stageId,
      "stageId",
    );


  const client =
    await appDb.connect();

  try {
    await client.query(
      "BEGIN",
    );


    await lockPlan(
      client,
      normalizedTenantId,
      normalizedPlanId,
    );


    const stage =
      await lockStage(
        client,
        normalizedPlanId,
        normalizedStageId,
      );


    if (
      stage.status !==
        "READY"
    ) {
      throw new Error(
        `Stage ${stage.stage_key} must be READY before start; current status=${stage.status}`,
      );
    }


    const updated =
      await updateStageStatus(
        client,
        normalizedStageId,
        "READY",
        "RUNNING",
      );


    await syncPlanStatus(
      client,
      normalizedPlanId,
    );


    await client.query(
      "COMMIT",
    );


    return mapStage(
      updated,
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


export async function finishExecutionStage(
  tenantId: string,
  executionPlanId: string,
  stageId: string,
): Promise<{
  stage: ProjectExecutionStage;

  unlockedStageKeys:
    string[];

  planStatus:
    ProjectExecutionPlanStatus;
}> {
  const normalizedTenantId =
    requireText(
      tenantId,
      "tenantId",
    );

  const normalizedPlanId =
    requireText(
      executionPlanId,
      "executionPlanId",
    );

  const normalizedStageId =
    requireText(
      stageId,
      "stageId",
    );


  const client =
    await appDb.connect();

  try {
    await client.query(
      "BEGIN",
    );


    await lockPlan(
      client,
      normalizedTenantId,
      normalizedPlanId,
    );


    const stage =
      await lockStage(
        client,
        normalizedPlanId,
        normalizedStageId,
      );


    if (
      stage.status !==
        "RUNNING"
    ) {
      throw new Error(
        `Stage ${stage.stage_key} must be RUNNING before finish; current status=${stage.status}`,
      );
    }


    const targetStatus:
      ProjectExecutionStageStatus =
      stage.approval_required
        ? "WAITING_APPROVAL"
        : "COMPLETED";


    const updated =
      await updateStageStatus(
        client,
        normalizedStageId,
        "RUNNING",
        targetStatus,
      );


    let unlockedStageKeys:
      string[] = [];


    if (
      targetStatus ===
        "COMPLETED"
    ) {
      unlockedStageKeys =
        await unlockEligibleStages(
          client,
          normalizedPlanId,
        );
    }


    const planStatus =
      await syncPlanStatus(
        client,
        normalizedPlanId,
      );


    await client.query(
      "COMMIT",
    );


    return {
      stage:
        mapStage(updated),

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


export async function approveExecutionStage(
  tenantId: string,
  executionPlanId: string,
  stageId: string,
): Promise<{
  stage: ProjectExecutionStage;

  unlockedStageKeys:
    string[];

  planStatus:
    ProjectExecutionPlanStatus;
}> {
  const normalizedTenantId =
    requireText(
      tenantId,
      "tenantId",
    );

  const normalizedPlanId =
    requireText(
      executionPlanId,
      "executionPlanId",
    );

  const normalizedStageId =
    requireText(
      stageId,
      "stageId",
    );


  const client =
    await appDb.connect();

  try {
    await client.query(
      "BEGIN",
    );


    await lockPlan(
      client,
      normalizedTenantId,
      normalizedPlanId,
    );


    const stage =
      await lockStage(
        client,
        normalizedPlanId,
        normalizedStageId,
      );


    if (
      !stage.approval_required
    ) {
      throw new Error(
        `Stage ${stage.stage_key} does not require approval`,
      );
    }


    if (
      stage.status !==
        "WAITING_APPROVAL"
    ) {
      throw new Error(
        `Stage ${stage.stage_key} must be WAITING_APPROVAL before approval; current status=${stage.status}`,
      );
    }


    const updated =
      await updateStageStatus(
        client,
        normalizedStageId,
        "WAITING_APPROVAL",
        "COMPLETED",
      );


    const unlockedStageKeys =
      await unlockEligibleStages(
        client,
        normalizedPlanId,
      );


    const planStatus =
      await syncPlanStatus(
        client,
        normalizedPlanId,
      );


    await client.query(
      "COMMIT",
    );


    return {
      stage:
        mapStage(updated),

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


export async function blockExecutionStage(
  tenantId: string,
  executionPlanId: string,
  stageId: string,
): Promise<{
  stage: ProjectExecutionStage;

  planStatus:
    ProjectExecutionPlanStatus;
}> {
  const normalizedTenantId =
    requireText(
      tenantId,
      "tenantId",
    );

  const normalizedPlanId =
    requireText(
      executionPlanId,
      "executionPlanId",
    );

  const normalizedStageId =
    requireText(
      stageId,
      "stageId",
    );


  const client =
    await appDb.connect();

  try {
    await client.query(
      "BEGIN",
    );


    await lockPlan(
      client,
      normalizedTenantId,
      normalizedPlanId,
    );


    const stage =
      await lockStage(
        client,
        normalizedPlanId,
        normalizedStageId,
      );


    const blockable:
      ProjectExecutionStageStatus[] = [
        "READY",
        "RUNNING",
        "WAITING_APPROVAL",
      ];


    if (
      !blockable.includes(
        stage.status,
      )
    ) {
      throw new Error(
        `Stage ${stage.stage_key} cannot be blocked from status=${stage.status}`,
      );
    }


    const updated =
      await updateStageStatus(
        client,
        normalizedStageId,
        stage.status,
        "BLOCKED",
      );


    const planStatus =
      await syncPlanStatus(
        client,
        normalizedPlanId,
      );


    await client.query(
      "COMMIT",
    );


    return {
      stage:
        mapStage(updated),

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


export async function skipExecutionStage(
  tenantId: string,
  executionPlanId: string,
  stageId: string,
): Promise<{
  stage: ProjectExecutionStage;

  unlockedStageKeys:
    string[];

  planStatus:
    ProjectExecutionPlanStatus;
}> {
  const normalizedTenantId =
    requireText(
      tenantId,
      "tenantId",
    );

  const normalizedPlanId =
    requireText(
      executionPlanId,
      "executionPlanId",
    );

  const normalizedStageId =
    requireText(
      stageId,
      "stageId",
    );


  const client =
    await appDb.connect();

  try {
    await client.query(
      "BEGIN",
    );


    await lockPlan(
      client,
      normalizedTenantId,
      normalizedPlanId,
    );


    const stage =
      await lockStage(
        client,
        normalizedPlanId,
        normalizedStageId,
      );


    if (
      stage.required
    ) {
      throw new Error(
        `Required stage ${stage.stage_key} cannot be skipped`,
      );
    }


    if (
      ![
        "PENDING",
        "READY",
      ].includes(
        stage.status,
      )
    ) {
      throw new Error(
        `Optional stage ${stage.stage_key} cannot be skipped from status=${stage.status}`,
      );
    }


    const updated =
      await updateStageStatus(
        client,
        normalizedStageId,
        stage.status,
        "SKIPPED",
      );


    const unlockedStageKeys =
      await unlockEligibleStages(
        client,
        normalizedPlanId,
      );


    const planStatus =
      await syncPlanStatus(
        client,
        normalizedPlanId,
      );


    await client.query(
      "COMMIT",
    );


    return {
      stage:
        mapStage(updated),

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


export async function resumeBlockedExecutionStage(
  tenantId: string,
  executionPlanId: string,
  stageId: string,
): Promise<{
  stage: ProjectExecutionStage;

  planStatus:
    ProjectExecutionPlanStatus;
}> {
  const normalizedTenantId =
    requireText(
      tenantId,
      "tenantId",
    );

  const normalizedPlanId =
    requireText(
      executionPlanId,
      "executionPlanId",
    );

  const normalizedStageId =
    requireText(
      stageId,
      "stageId",
    );


  const client =
    await appDb.connect();

  try {
    await client.query(
      "BEGIN",
    );


    await lockPlan(
      client,
      normalizedTenantId,
      normalizedPlanId,
    );


    const stage =
      await lockStage(
        client,
        normalizedPlanId,
        normalizedStageId,
      );


    if (
      stage.status !==
        "BLOCKED"
    ) {
      throw new Error(
        `Stage ${stage.stage_key} must be BLOCKED before resume; current status=${stage.status}`,
      );
    }


    /*
     * Recalculate whether all parents are terminal.
     * A root stage also qualifies as runnable.
     */
    const dependencyState =
      await client.query<{
        dependency_count: number;
        unsatisfied_count: number;
      }>(
        `
          SELECT

            COUNT(d.*)::int
              AS dependency_count,

            COUNT(*) FILTER (
              WHERE parent.status NOT IN (
                'COMPLETED',
                'SKIPPED'
              )
            )::int
              AS unsatisfied_count

          FROM app.project_execution_stages s

          LEFT JOIN app.project_execution_stage_dependencies d
            ON d.stage_id =
              s.id

            AND d.execution_plan_id =
              s.execution_plan_id

          LEFT JOIN app.project_execution_stages parent
            ON parent.id =
              d.depends_on_stage_id

            AND parent.execution_plan_id =
              d.execution_plan_id

          WHERE s.id = $1

          GROUP BY s.id
        `,
        [
          normalizedStageId,
        ],
      );


    const dependencyRow =
      dependencyState.rows[0];


    if (!dependencyRow) {
      throw new Error(
        "Could not calculate stage dependency state",
      );
    }


    const targetStatus:
      ProjectExecutionStageStatus =
      dependencyRow
        .unsatisfied_count === 0
        ? "READY"
        : "PENDING";


    const updated =
      await updateStageStatus(
        client,
        normalizedStageId,
        "BLOCKED",
        targetStatus,
      );


    const planStatus =
      await syncPlanStatus(
        client,
        normalizedPlanId,
      );


    await client.query(
      "COMMIT",
    );


    return {
      stage:
        mapStage(updated),

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
