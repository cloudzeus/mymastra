import {
  appDb,
} from "../db/postgres";

import {
  validateProjectExecutionPlan,
} from "./plan-validator";

import type {
  CreateProjectExecutionPlanInput,
  ProjectExecutionPlan,
  ProjectExecutionPlanStatus,
  ProjectExecutionStage,
  ProjectExecutionStageDependency,
  ProjectExecutionStageStatus,
  ProjectExecutionAgentRole,
  ProjectExecutionKind,
} from "./types";

import type {
  SpecialistArtifactType,
} from "../specialists/types";


type PlanRow = {
  id: string;
  tenant_id: string;
  project_id: string;
  project_definition_id: string;
  project_definition_version: number;
  version: number;
  status:
    ProjectExecutionPlanStatus;
  created_at: string;
  updated_at: string;
};


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


type DependencyRow = {
  execution_plan_id: string;
  stage_id: string;
  depends_on_stage_id: string;
  stage_key: string;
  depends_on_stage_key: string;
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


async function loadStages(
  executionPlanId: string,
): Promise<
  ProjectExecutionStage[]
> {
  const result =
    await appDb.query<
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
        WHERE execution_plan_id = $1
        ORDER BY
          created_at,
          stage_key
      `,
      [
        executionPlanId,
      ],
    );

  return result.rows.map(
    mapStage,
  );
}


async function loadDependencies(
  executionPlanId: string,
): Promise<
  ProjectExecutionStageDependency[]
> {
  const result =
    await appDb.query<
      DependencyRow
    >(
      `
        SELECT
          d.execution_plan_id::text,
          d.stage_id::text,
          d.depends_on_stage_id::text,
          child.stage_key,
          parent.stage_key
            AS depends_on_stage_key
        FROM app.project_execution_stage_dependencies d
        JOIN app.project_execution_stages child
          ON child.id =
            d.stage_id
        JOIN app.project_execution_stages parent
          ON parent.id =
            d.depends_on_stage_id
        WHERE d.execution_plan_id = $1
        ORDER BY
          child.stage_key,
          parent.stage_key
      `,
      [
        executionPlanId,
      ],
    );

  return result.rows.map(
    row => ({
      executionPlanId:
        row.execution_plan_id,

      stageId:
        row.stage_id,

      dependsOnStageId:
        row.depends_on_stage_id,

      stageKey:
        row.stage_key,

      dependsOnStageKey:
        row.depends_on_stage_key,
    }),
  );
}


async function hydratePlan(
  row: PlanRow,
): Promise<ProjectExecutionPlan> {
  const [
    stages,
    dependencies,
  ] =
    await Promise.all([
      loadStages(
        row.id,
      ),

      loadDependencies(
        row.id,
      ),
    ]);

  return {
    id:
      row.id,

    tenantId:
      row.tenant_id,

    projectId:
      row.project_id,

    projectDefinitionId:
      row.project_definition_id,

    projectDefinitionVersion:
      row.project_definition_version,

    version:
      row.version,

    status:
      row.status,

    stages,

    dependencies,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  };
}


export async function createProjectExecutionPlan(
  input:
    CreateProjectExecutionPlanInput,
): Promise<ProjectExecutionPlan> {
  const validation =
    validateProjectExecutionPlan(
      input,
    );

  if (
    !validation.valid
  ) {
    throw new Error(
      [
        "Project execution plan validation failed",
        ...validation.errors,
      ].join(
        ": ",
      ),
    );
  }


  const tenantId =
    requireText(
      input.tenantId,
      "tenantId",
    );

  const projectId =
    requireText(
      input.projectId,
      "projectId",
    );

  const projectDefinitionId =
    requireText(
      input.projectDefinitionId,
      "projectDefinitionId",
    );


  const client =
    await appDb.connect();

  try {
    await client.query(
      "BEGIN",
    );


    const definition =
      await client.query<{
        status: string;
      }>(
        `
          SELECT status
          FROM app.project_definitions
          WHERE id = $1
            AND project_id = $2
            AND tenant_id = $3
            AND version = $4
          FOR UPDATE
        `,
        [
          projectDefinitionId,
          projectId,
          tenantId,
          input.projectDefinitionVersion,
        ],
      );


    const definitionRow =
      definition.rows[0];


    if (!definitionRow) {
      throw new Error(
        "ProjectDefinition binding not found",
      );
    }


    if (
      definitionRow.status !==
        "READY"
    ) {
      throw new Error(
        `ProjectDefinition must be READY before execution planning; current status=${definitionRow.status}`,
      );
    }


    const versionResult =
      await client.query<{
        next_version: number;
      }>(
        `
          SELECT
            COALESCE(
              MAX(version),
              0
            ) + 1
              AS next_version
          FROM app.project_execution_plans
          WHERE project_id = $1
        `,
        [
          projectId,
        ],
      );


    const version =
      Number(
        versionResult.rows[0]
          .next_version,
      );


    const planResult =
      await client.query<
        PlanRow
      >(
        `
          INSERT INTO app.project_execution_plans (
            tenant_id,
            project_id,
            project_definition_id,
            project_definition_version,
            version,
            status
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            'DRAFT'
          )
          RETURNING
            id::text,
            tenant_id::text,
            project_id::text,
            project_definition_id::text,
            project_definition_version,
            version,
            status,
            created_at::text,
            updated_at::text
        `,
        [
          tenantId,
          projectId,
          projectDefinitionId,
          input.projectDefinitionVersion,
          version,
        ],
      );


    const plan =
      planResult.rows[0];


    const stageIds =
      new Map<
        string,
        string
      >();


    for (
      const stage of
        input.stages
    ) {
      const result =
        await client.query<{
          id: string;
        }>(
          `
            INSERT INTO app.project_execution_stages (
              execution_plan_id,
              project_id,
              stage_key,
              agent_role,
              execution_kind,
              expected_artifact_type,
              required,
              approval_required,
              status,
              configuration
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
              'PENDING',
              $9::jsonb
            )
            RETURNING id::text
          `,
          [
            plan.id,
            projectId,
            stage.stageKey.trim(),
            stage.agentRole,
            stage.executionKind,

            stage.executionKind ===
              "SPECIALIST_ARTIFACT"
              ? stage.expectedArtifactType
              : null,

            stage.required ??
              true,

            stage.approvalRequired ??
              false,

            JSON.stringify(
              stage.configuration ??
              {},
            ),
          ],
        );


      stageIds.set(
        stage.stageKey.trim(),
        result.rows[0].id,
      );
    }


    for (
      const dependency of
        input.dependencies ??
        []
    ) {
      const stageId =
        stageIds.get(
          dependency.stageKey.trim(),
        );

      const dependsOnStageId =
        stageIds.get(
          dependency
            .dependsOnStageKey
            .trim(),
        );


      if (
        !stageId ||
        !dependsOnStageId
      ) {
        throw new Error(
          "Internal dependency resolution failed",
        );
      }


      await client.query(
        `
          INSERT INTO app.project_execution_stage_dependencies (
            execution_plan_id,
            stage_id,
            depends_on_stage_id
          )
          VALUES (
            $1,
            $2,
            $3
          )
        `,
        [
          plan.id,
          stageId,
          dependsOnStageId,
        ],
      );
    }


    /*
     * Initial runnable stages are those
     * with no dependencies.
     */
    await client.query(
      `
        UPDATE app.project_execution_stages s
        SET
          status = 'READY',
          updated_at = now()
        WHERE s.execution_plan_id = $1
          AND NOT EXISTS (
            SELECT 1
            FROM app.project_execution_stage_dependencies d
            WHERE d.execution_plan_id = s.execution_plan_id
              AND d.stage_id = s.id
          )
      `,
      [
        plan.id,
      ],
    );


    const readyPlan =
      await client.query<
        PlanRow
      >(
        `
          UPDATE app.project_execution_plans
          SET
            status = 'READY',
            updated_at = now()
          WHERE id = $1
          RETURNING
            id::text,
            tenant_id::text,
            project_id::text,
            project_definition_id::text,
            project_definition_version,
            version,
            status,
            created_at::text,
            updated_at::text
        `,
        [
          plan.id,
        ],
      );


    await client.query(
      "COMMIT",
    );


    return hydratePlan(
      readyPlan.rows[0],
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


export async function getProjectExecutionPlan(
  tenantId: string,
  executionPlanId: string,
): Promise<ProjectExecutionPlan> {
  const result =
    await appDb.query<
      PlanRow
    >(
      `
        SELECT
          id::text,
          tenant_id::text,
          project_id::text,
          project_definition_id::text,
          project_definition_version,
          version,
          status,
          created_at::text,
          updated_at::text
        FROM app.project_execution_plans
        WHERE id = $1
          AND tenant_id = $2
        LIMIT 1
      `,
      [
        requireText(
          executionPlanId,
          "executionPlanId",
        ),

        requireText(
          tenantId,
          "tenantId",
        ),
      ],
    );


  const row =
    result.rows[0];


  if (!row) {
    throw new Error(
      `Project execution plan not found: ${executionPlanId}`,
    );
  }


  return hydratePlan(
    row,
  );
}


export async function getLatestProjectExecutionPlan(
  tenantId: string,
  projectId: string,
): Promise<ProjectExecutionPlan | null> {
  const result =
    await appDb.query<
      PlanRow
    >(
      `
        SELECT
          id::text,
          tenant_id::text,
          project_id::text,
          project_definition_id::text,
          project_definition_version,
          version,
          status,
          created_at::text,
          updated_at::text
        FROM app.project_execution_plans
        WHERE tenant_id = $1
          AND project_id = $2
        ORDER BY version DESC
        LIMIT 1
      `,
      [
        requireText(
          tenantId,
          "tenantId",
        ),

        requireText(
          projectId,
          "projectId",
        ),
      ],
    );


  const row =
    result.rows[0];


  return row
    ? hydratePlan(row)
    : null;
}


export async function getRunnableExecutionStages(
  tenantId: string,
  executionPlanId: string,
): Promise<
  ProjectExecutionStage[]
> {
  const plan =
    await getProjectExecutionPlan(
      tenantId,
      executionPlanId,
    );


  return plan.stages.filter(
    stage =>
      stage.status ===
        "READY",
  );
}
