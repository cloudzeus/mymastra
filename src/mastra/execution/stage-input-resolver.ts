import {
  appDb,
} from "../db/postgres";

import type {
  ProjectExecutionStageOutput,
} from "./types";


type OutputRow = {
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


function mapOutput(
  row: OutputRow,
): ProjectExecutionStageOutput {
  if (
    row.output_kind ===
      "SPECIALIST_ARTIFACT"
  ) {
    if (
      !row.specialist_artifact_id
    ) {
      throw new Error(
        `Invalid specialist stage output ${row.id}`,
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
      `Invalid developer stage output ${row.id}`,
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


export async function resolveUpstreamStageOutputs(
  tenantId: string,
  executionPlanId: string,
  stageId: string,
): Promise<
  ProjectExecutionStageOutput[]
> {
  const result =
    await appDb.query<
      OutputRow
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

        FROM app.project_execution_stage_dependencies d

        JOIN app.project_execution_stage_outputs o
          ON o.stage_id =
            d.depends_on_stage_id

          AND o.execution_plan_id =
            d.execution_plan_id

        JOIN app.project_execution_plans p
          ON p.id =
            d.execution_plan_id

        WHERE d.execution_plan_id = $1

          AND d.stage_id = $2

          AND p.tenant_id = $3

        ORDER BY
          d.depends_on_stage_id,
          o.sequence
      `,
      [
        executionPlanId,
        stageId,
        tenantId,
      ],
    );


  return result.rows.map(
    mapOutput,
  );
}
