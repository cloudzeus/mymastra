import type {
  PoolClient,
} from "pg";

import {
  appDb,
} from "../db/postgres";

import type {
  ProjectExecutionPlanStatus,
  ProjectExecutionStageOutput,
  ProjectExecutionStageStatus,
} from "./types";

import type {
  StageExecutionResult,
} from "./orchestrator-types";


type PlanRow = {
  id: string;
  project_id: string;
  project_definition_id: string;
  project_definition_version: number;
  status: ProjectExecutionPlanStatus;
};


type StageRow = {
  id: string;
  execution_plan_id: string;
  project_id: string;
  stage_key: string;
  execution_kind:
    "SPECIALIST_ARTIFACT" |
    "DEVELOPER_WORK_ORDER";
  expected_artifact_type:
    string | null;
  approval_required: boolean;
  status: ProjectExecutionStageStatus;
};


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
    if (!row.specialist_artifact_id) {
      throw new Error(
        "Persisted specialist output is invalid",
      );
    }

    return {
      id: row.id,
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


  if (!row.developer_work_order_id) {
    throw new Error(
      "Persisted developer output is invalid",
    );
  }


  return {
    id: row.id,
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


async function unlockEligibleStages(
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

        RETURNING child.stage_key
      `,
      [
        executionPlanId,
      ],
    );


  return result.rows.map(
    row => row.stage_key,
  );
}


async function syncPlanStatus(
  client: PoolClient,
  executionPlanId: string,
): Promise<ProjectExecutionPlanStatus> {
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
            WHERE status = 'BLOCKED'
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
    ProjectExecutionPlanStatus;


  if (
    row.total > 0 &&
    row.terminal === row.total
  ) {
    status = "COMPLETED";
  }
  else if (
    row.blocked > 0
  ) {
    status = "BLOCKED";
  }
  else if (
    row.active > 0
  ) {
    status = "ACTIVE";
  }
  else {
    status = "READY";
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


export async function commitExecutionStageResult(
  tenantId: string,
  executionPlanId: string,
  stageId: string,
  result: StageExecutionResult,
): Promise<{
  output: ProjectExecutionStageOutput;

  stageStatus:
    ProjectExecutionStageStatus;

  unlockedStageKeys:
    string[];

  planStatus:
    ProjectExecutionPlanStatus;

  reviewableDeliverable?: {
    deliverableId: string;
    deliverableRevisionId: string;
    deliverableType: string;
    version: number;
  };
}> {
  const client =
    await appDb.connect();


  try {
    await client.query("BEGIN");


    const planResult =
      await client.query<PlanRow>(
        `
          SELECT
            id::text,
            project_id::text,
            project_definition_id::text,
            project_definition_version,
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


    const plan =
      planResult.rows[0];


    if (!plan) {
      throw new Error(
        "Execution plan not found",
      );
    }


    if (
      plan.status === "CANCELLED" ||
      plan.status === "COMPLETED"
    ) {
      throw new Error(
        `Cannot commit result to plan status=${plan.status}`,
      );
    }


    const stageResult =
      await client.query<StageRow>(
        `
          SELECT
            id::text,
            execution_plan_id::text,
            project_id::text,
            stage_key,
            execution_kind,
            expected_artifact_type,
            approval_required,
            status

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


    const stage =
      stageResult.rows[0];


    if (!stage) {
      throw new Error(
        "Execution stage not found",
      );
    }


    if (
      stage.status !== "RUNNING"
    ) {
      throw new Error(
        `Stage ${stage.stage_key} must be RUNNING before result commit; current=${stage.status}`,
      );
    }


    if (
      stage.execution_kind !==
        result.kind
    ) {
      throw new Error(
        `Stage ${stage.stage_key} expects ${stage.execution_kind} but handler returned ${result.kind}`,
      );
    }


    let outputResult;


    if (
      result.kind ===
        "SPECIALIST_ARTIFACT"
    ) {
      const artifact =
        await client.query<{
          project_id: string | null;
          artifact_type: string;
          status: string;
          project_definition_id:
            string | null;
          project_definition_version:
            number | null;
        }>(
          `
            SELECT
              project_id::text,
              artifact_type,
              status,
              project_definition_id::text,
              project_definition_version

            FROM app.specialist_artifacts

            WHERE id = $1
              AND tenant_id = $2

            LIMIT 1
          `,
          [
            result.specialistArtifactId,
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
          plan.project_id
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
          `Specialist artifact must be READY; current=${artifactRow.status}`,
        );
      }


      if (
        artifactRow.project_definition_id !==
          plan.project_definition_id ||
        artifactRow.project_definition_version !==
          plan.project_definition_version
      ) {
        throw new Error(
          "Specialist artifact ProjectDefinition binding does not match execution plan",
        );
      }


      outputResult =
        await client.query<OutputRow>(
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
              (
                SELECT
                  COALESCE(
                    MAX(o.sequence),
                    0
                  ) + 1
                FROM app.project_execution_stage_outputs o
                WHERE o.execution_plan_id = $1
                  AND o.stage_id = $2
              )
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
            plan.project_id,
            result.specialistArtifactId,
          ],
        );
    }
    else {
      const workOrder =
        await client.query<{
          project_id: string;
          project_definition_id: string;
          project_definition_version: number;
          status: string;
        }>(
          `
            SELECT
              project_id::text,
              project_definition_id::text,
              project_definition_version,
              status

            FROM app.developer_work_orders

            WHERE id = $1
              AND project_id = $2

            LIMIT 1
          `,
          [
            result.developerWorkOrderId,
            plan.project_id,
          ],
        );


      const workOrderRow =
        workOrder.rows[0];


      if (!workOrderRow) {
        throw new Error(
          "DeveloperWorkOrder not found for execution project",
        );
      }


      if (
        workOrderRow.project_definition_id !==
          plan.project_definition_id ||
        workOrderRow.project_definition_version !==
          plan.project_definition_version
      ) {
        throw new Error(
          "DeveloperWorkOrder ProjectDefinition binding does not match execution plan",
        );
      }


      if (
        workOrderRow.status ===
          "BLOCKED"
      ) {
        throw new Error(
          "BLOCKED DeveloperWorkOrder cannot be committed as stage output",
        );
      }


      /*
       * Exactly one canonical output is exposed by a stage.
       *
       * On a correction run we update that canonical binding.
       * Immutable history belongs to deliverable revisions.
       */
      const updatedOutput =
        await client.query<OutputRow>(
          `
            UPDATE app.project_execution_stage_outputs

            SET
              project_id = $3,
              output_kind =
                'DEVELOPER_WORK_ORDER',
              specialist_artifact_id =
                NULL,
              developer_work_order_id =
                $4,
              sequence =
                1

            WHERE execution_plan_id = $1
              AND stage_id = $2

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
            plan.project_id,
            result.developerWorkOrderId,
          ],
        );


      if (
        updatedOutput.rows.length > 0
      ) {
        outputResult =
          updatedOutput;
      }
      else {
        outputResult =
          await client.query<OutputRow>(
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
                1
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
              plan.project_id,
              result.developerWorkOrderId,
            ],
          );
      }
    }


    let reviewableDeliverable:
      | {
          deliverableId: string;
          deliverableRevisionId: string;
          deliverableType: string;
          version: number;
        }
      | undefined;


    if (
      stage.approval_required
    ) {
      const deliverableType =
        result.kind ===
          "SPECIALIST_ARTIFACT"
          ? stage.expected_artifact_type
          : "DEVELOPER_WORK_ORDER";


      if (!deliverableType) {
        throw new Error(
          "Approval-gated stage is missing a deliverable type",
        );
      }


      const existingDeliverable =
        await client.query<{
          id: string;
        }>(
          `
            SELECT id::text
            FROM app.project_execution_deliverables
            WHERE stage_id = $1
              AND deliverable_type = $2
            FOR UPDATE
          `,
          [
            stageId,
            deliverableType,
          ],
        );


      let deliverableId =
        existingDeliverable.rows[0]?.id;


      if (!deliverableId) {
        const created =
          await client.query<{
            id: string;
          }>(
            `
              INSERT INTO app.project_execution_deliverables (
                tenant_id,
                project_id,
                execution_plan_id,
                stage_id,
                agent_role,
                deliverable_type
              )

              SELECT
                p.tenant_id,
                s.project_id,
                s.execution_plan_id,
                s.id,
                s.agent_role,
                $3

              FROM app.project_execution_stages s

              JOIN app.project_execution_plans p
                ON p.id =
                  s.execution_plan_id

              WHERE s.id = $1
                AND s.execution_plan_id = $2

              RETURNING id::text
            `,
            [
              stageId,
              executionPlanId,
              deliverableType,
            ],
          );


        deliverableId =
          created.rows[0]?.id;


        if (!deliverableId) {
          throw new Error(
            "Could not create execution deliverable",
          );
        }
      }


      const latestResult =
        await client.query<{
          id: string;
          version: number;
          status: string;
        }>(
          `
            SELECT
              id::text,
              version,
              status

            FROM app.project_execution_deliverable_revisions

            WHERE deliverable_id = $1

            ORDER BY version DESC

            LIMIT 1

            FOR UPDATE
          `,
          [
            deliverableId,
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
          `Cannot create execution deliverable revision while latest status=${latest.status}`,
        );
      }


      const nextVersion =
        latest
          ? latest.version + 1
          : 1;


      const contentSnapshot =
        result.kind ===
          "SPECIALIST_ARTIFACT"
          ? {
              outputKind:
                "SPECIALIST_ARTIFACT",
              specialistArtifactId:
                result.specialistArtifactId,
              artifactType:
                deliverableType,
              projectId:
                plan.project_id,
              projectDefinitionId:
                plan.project_definition_id,
              projectDefinitionVersion:
                plan.project_definition_version,
            }
          : {
              outputKind:
                "DEVELOPER_WORK_ORDER",
              developerWorkOrderId:
                result.developerWorkOrderId,
              projectId:
                plan.project_id,
              projectDefinitionId:
                plan.project_definition_id,
              projectDefinitionVersion:
                plan.project_definition_version,
            };


      const revisionResult =
        await client.query<{
          id: string;
          version: number;
        }>(
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
              'SUBMITTED',
              $3,
              $4::jsonb,
              $5,
              $6,
              $7,
              '[]'::jsonb
            )
            RETURNING
              id::text,
              version
          `,
          [
            deliverableId,
            nextVersion,
            latest?.id ??
              null,
            JSON.stringify(
              contentSnapshot,
            ),
            result.kind,
            result.kind ===
              "SPECIALIST_ARTIFACT"
              ? result.specialistArtifactId
              : null,
            result.kind ===
              "DEVELOPER_WORK_ORDER"
              ? result.developerWorkOrderId
              : null,
          ],
        );


      const revision =
        revisionResult.rows[0];


      if (!revision) {
        throw new Error(
          "Could not create execution deliverable revision",
        );
      }


      /*
       * Supersede only after replacement revision
       * was created successfully.
       */
      if (latest) {
        const superseded =
          await client.query(
            `
              UPDATE app.project_execution_deliverable_revisions
              SET status =
                'SUPERSEDED'
              WHERE id = $1
                AND status =
                  'CHANGES_REQUESTED'
            `,
            [
              latest.id,
            ],
          );


        if (
          superseded.rowCount !==
            1
        ) {
          throw new Error(
            "Previous deliverable revision could not be superseded",
          );
        }
      }


      await client.query(
        `
          UPDATE app.project_execution_deliverables
          SET updated_at =
            now()
          WHERE id = $1
        `,
        [
          deliverableId,
        ],
      );


      reviewableDeliverable = {
        deliverableId,
        deliverableRevisionId:
          revision.id,
        deliverableType,
        version:
          revision.version,
      };
    }


    const targetStatus:
      ProjectExecutionStageStatus =
      stage.approval_required
        ? "WAITING_APPROVAL"
        : "COMPLETED";


    const stageUpdate =
      await client.query(
        `
          UPDATE app.project_execution_stages

          SET
            status = $3,
            updated_at = now()

          WHERE id = $1
            AND status = $2
        `,
        [
          stageId,
          "RUNNING",
          targetStatus,
        ],
      );


    if (
      stageUpdate.rowCount !== 1
    ) {
      throw new Error(
        "Concurrent execution stage modification detected",
      );
    }


    let unlockedStageKeys:
      string[] = [];


    if (
      targetStatus ===
        "COMPLETED"
    ) {
      unlockedStageKeys =
        await unlockEligibleStages(
          client,
          executionPlanId,
        );
    }


    const planStatus =
      await syncPlanStatus(
        client,
        executionPlanId,
      );


    await client.query("COMMIT");


    return {
      output:
        mapOutput(
          outputResult.rows[0],
        ),

      stageStatus:
        targetStatus,

      unlockedStageKeys,

      planStatus,

      reviewableDeliverable,
    };
  }
  catch (error) {
    await client.query("ROLLBACK");

    throw error;
  }
  finally {
    client.release();
  }
}
