import type {
  PoolClient,
} from "pg";

import {
  appDb,
} from "../db/postgres";

import type {
  AttachDeveloperWorkOrderOutputInput,
  AttachSpecialistArtifactOutputInput,
  ProjectExecutionStageOutput,
} from "./types";


type StageOutputRow = {
  id: string;

  execution_plan_id: string;

  stage_id: string;

  project_id: string;

  output_kind:
    "SPECIALIST_ARTIFACT" |
    "DEVELOPER_WORK_ORDER";

  specialist_artifact_id:
    string | null;

  developer_work_order_id:
    string | null;

  sequence: number;

  created_at: string;
};


type LockedStage = {
  id: string;

  project_id: string;

  execution_kind:
    "SPECIALIST_ARTIFACT" |
    "DEVELOPER_WORK_ORDER";

  expected_artifact_type:
    string | null;

  status: string;
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


function mapOutput(
  row: StageOutputRow,
): ProjectExecutionStageOutput {
  if (
    row.output_kind ===
      "SPECIALIST_ARTIFACT"
  ) {
    if (
      !row.specialist_artifact_id
    ) {
      throw new Error(
        `Invalid persisted specialist output ${row.id}`,
      );
    }

    return {
      id:
        row.id,

      executionPlanId:
        row.execution_plan_id,

      stageId:
        row.stage_id,

      projectId:
        row.project_id,

      outputKind:
        "SPECIALIST_ARTIFACT",

      specialistArtifactId:
        row.specialist_artifact_id,

      sequence:
        row.sequence,

      createdAt:
        row.created_at,
    };
  }


  if (
    !row.developer_work_order_id
  ) {
    throw new Error(
      `Invalid persisted developer output ${row.id}`,
    );
  }


  return {
    id:
      row.id,

    executionPlanId:
      row.execution_plan_id,

    stageId:
      row.stage_id,

    projectId:
      row.project_id,

    outputKind:
      "DEVELOPER_WORK_ORDER",

    developerWorkOrderId:
      row.developer_work_order_id,

    sequence:
      row.sequence,

    createdAt:
      row.created_at,
  };
}


async function lockStage(
  client: PoolClient,
  tenantId: string,
  executionPlanId: string,
  stageId: string,
): Promise<LockedStage> {
  const result =
    await client.query<
      LockedStage
    >(
      `
        SELECT
          s.id::text,

          s.project_id::text,

          s.execution_kind,

          s.expected_artifact_type,

          s.status

        FROM app.project_execution_stages s

        JOIN app.project_execution_plans p
          ON p.id =
            s.execution_plan_id

        WHERE s.id = $1
          AND s.execution_plan_id = $2
          AND p.tenant_id = $3

        FOR UPDATE OF s
      `,
      [
        stageId,
        executionPlanId,
        tenantId,
      ],
    );


  const row =
    result.rows[0];


  if (!row) {
    throw new Error(
      "Execution stage ownership validation failed",
    );
  }


  if (
    ![
      "RUNNING",
      "WAITING_APPROVAL",
    ].includes(
      row.status,
    )
  ) {
    throw new Error(
      `Stage output can only be attached while RUNNING or WAITING_APPROVAL; current status=${row.status}`,
    );
  }


  return row;
}


async function nextSequence(
  client: PoolClient,
  stageId: string,
): Promise<number> {
  const result =
    await client.query<{
      next_sequence: number;
    }>(
      `
        SELECT
          COALESCE(
            MAX(sequence),
            0
          ) + 1
            AS next_sequence

        FROM app.project_execution_stage_outputs

        WHERE stage_id = $1
      `,
      [
        stageId,
      ],
    );


  return Number(
    result.rows[0]
      .next_sequence,
  );
}


export async function attachSpecialistArtifactOutput(
  input:
    AttachSpecialistArtifactOutputInput,
): Promise<ProjectExecutionStageOutput> {
  const tenantId =
    requireText(
      input.tenantId,
      "tenantId",
    );

  const executionPlanId =
    requireText(
      input.executionPlanId,
      "executionPlanId",
    );

  const stageId =
    requireText(
      input.stageId,
      "stageId",
    );

  const artifactId =
    requireText(
      input.specialistArtifactId,
      "specialistArtifactId",
    );


  const client =
    await appDb.connect();


  try {
    await client.query(
      "BEGIN",
    );


    const stage =
      await lockStage(
        client,
        tenantId,
        executionPlanId,
        stageId,
      );


    if (
      stage.execution_kind !==
        "SPECIALIST_ARTIFACT"
    ) {
      throw new Error(
        "Cannot attach specialist artifact to non-specialist execution stage",
      );
    }


    const artifact =
      await client.query<{
        project_id: string | null;
        artifact_type: string;
        status: string;
      }>(
        `
          SELECT
            project_id::text,
            artifact_type,
            status

          FROM app.specialist_artifacts

          WHERE id = $1
            AND tenant_id = $2

          LIMIT 1
        `,
        [
          artifactId,
          tenantId,
        ],
      );


    const artifactRow =
      artifact.rows[0];


    if (!artifactRow) {
      throw new Error(
        "Specialist artifact not found",
      );
    }


    if (
      artifactRow.project_id !==
        stage.project_id
    ) {
      throw new Error(
        "Specialist artifact belongs to a different project",
      );
    }


    if (
      artifactRow.artifact_type !==
        stage.expected_artifact_type
    ) {
      throw new Error(
        `Specialist artifact type mismatch: expected=${stage.expected_artifact_type} received=${artifactRow.artifact_type}`,
      );
    }


    if (
      artifactRow.status !==
        "READY"
    ) {
      throw new Error(
        `Specialist artifact must be READY before stage binding; current status=${artifactRow.status}`,
      );
    }


    const sequence =
      await nextSequence(
        client,
        stageId,
      );


    const result =
      await client.query<
        StageOutputRow
      >(
        `
          INSERT INTO app.project_execution_stage_outputs (
            execution_plan_id,
            stage_id,
            project_id,
            output_kind,
            specialist_artifact_id,
            sequence
          )
          VALUES (
            $1,
            $2,
            $3,
            'SPECIALIST_ARTIFACT',
            $4,
            $5
          )

          RETURNING
            id::text,
            execution_plan_id::text,
            stage_id::text,
            project_id::text,
            output_kind,
            specialist_artifact_id::text,
            developer_work_order_id::text,
            sequence,
            created_at::text
        `,
        [
          executionPlanId,
          stageId,
          stage.project_id,
          artifactId,
          sequence,
        ],
      );


    await client.query(
      "COMMIT",
    );


    return mapOutput(
      result.rows[0],
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


export async function attachDeveloperWorkOrderOutput(
  input:
    AttachDeveloperWorkOrderOutputInput,
): Promise<ProjectExecutionStageOutput> {
  const tenantId =
    requireText(
      input.tenantId,
      "tenantId",
    );

  const executionPlanId =
    requireText(
      input.executionPlanId,
      "executionPlanId",
    );

  const stageId =
    requireText(
      input.stageId,
      "stageId",
    );

  const workOrderId =
    requireText(
      input.developerWorkOrderId,
      "developerWorkOrderId",
    );


  const client =
    await appDb.connect();


  try {
    await client.query(
      "BEGIN",
    );


    const stage =
      await lockStage(
        client,
        tenantId,
        executionPlanId,
        stageId,
      );


    if (
      stage.execution_kind !==
        "DEVELOPER_WORK_ORDER"
    ) {
      throw new Error(
        "Cannot attach DeveloperWorkOrder to non-developer execution stage",
      );
    }


    const workOrder =
      await client.query<{
        project_id: string;
        status: string;
      }>(
        `
          SELECT
            project_id::text,
            status

          FROM app.developer_work_orders

          WHERE id = $1
            AND project_id = $2

          LIMIT 1
        `,
        [
          workOrderId,
          stage.project_id,
        ],
      );


    const workOrderRow =
      workOrder.rows[0];


    if (!workOrderRow) {
      throw new Error(
        "DeveloperWorkOrder not found for stage project",
      );
    }


    if (
      workOrderRow.status ===
        "BLOCKED"
    ) {
      throw new Error(
        "BLOCKED DeveloperWorkOrder cannot be bound as successful stage output",
      );
    }


    const sequence =
      await nextSequence(
        client,
        stageId,
      );


    const result =
      await client.query<
        StageOutputRow
      >(
        `
          INSERT INTO app.project_execution_stage_outputs (
            execution_plan_id,
            stage_id,
            project_id,
            output_kind,
            developer_work_order_id,
            sequence
          )
          VALUES (
            $1,
            $2,
            $3,
            'DEVELOPER_WORK_ORDER',
            $4,
            $5
          )

          RETURNING
            id::text,
            execution_plan_id::text,
            stage_id::text,
            project_id::text,
            output_kind,
            specialist_artifact_id::text,
            developer_work_order_id::text,
            sequence,
            created_at::text
        `,
        [
          executionPlanId,
          stageId,
          stage.project_id,
          workOrderId,
          sequence,
        ],
      );


    await client.query(
      "COMMIT",
    );


    return mapOutput(
      result.rows[0],
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


export async function listExecutionStageOutputs(
  tenantId: string,
  executionPlanId: string,
  stageId: string,
): Promise<
  ProjectExecutionStageOutput[]
> {
  const result =
    await appDb.query<
      StageOutputRow
    >(
      `
        SELECT
          o.id::text,
          o.execution_plan_id::text,
          o.stage_id::text,
          o.project_id::text,
          o.output_kind,
          o.specialist_artifact_id::text,
          o.developer_work_order_id::text,
          o.sequence,
          o.created_at::text

        FROM app.project_execution_stage_outputs o

        JOIN app.project_execution_plans p
          ON p.id =
            o.execution_plan_id

        WHERE o.execution_plan_id = $1
          AND o.stage_id = $2
          AND p.tenant_id = $3

        ORDER BY
          o.sequence ASC
      `,
      [
        requireText(
          executionPlanId,
          "executionPlanId",
        ),

        requireText(
          stageId,
          "stageId",
        ),

        requireText(
          tenantId,
          "tenantId",
        ),
      ],
    );


  return result.rows.map(
    mapOutput,
  );
}
