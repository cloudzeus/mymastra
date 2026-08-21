import {
  randomUUID,
} from "node:crypto";

import {
  appDb,
} from "../src/mastra/db/postgres";

import {
  createProjectExecutionPlan,
  getProjectExecutionPlan,
  runExecutionPlanPass,
} from "../src/mastra/execution";

import {
  createSpecialistArtifact,
} from "../src/mastra/specialists";

import type {
  StageExecutionHandlerRegistry,
} from "../src/mastra/execution";


const TEST_MARKER =
  "__MASTRA_DYNAMIC_ORCHESTRATOR_TEST__";

const suffix =
  Date.now().toString();


let tenantId: string | undefined;
let tenantCode: string | undefined;
let customerId: string | undefined;
let opportunityId: string | undefined;
let projectId: string | undefined;
let projectDefinitionId: string | undefined;


function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}


async function getTenant(): Promise<{
  id: string;
  code: string;
}> {
  const result =
    await appDb.query<{
      id: string;
      code: string | null;
    }>(
      `
        SELECT
          id::text,
          to_jsonb(t)->>'code' AS code
        FROM app.tenants t
        WHERE is_active = true
        ORDER BY created_at ASC
        LIMIT 1
      `,
    );

  const row =
    result.rows[0];

  if (!row) {
    throw new Error(
      "No active tenant available",
    );
  }

  if (!row.code?.trim()) {
    throw new Error(
      "Active tenant has no tenant code",
    );
  }

  return {
    id: row.id,
    code: row.code.trim(),
  };
}


async function createTestCustomer(
  resolvedTenantId: string,
): Promise<string> {
  const columns =
    await appDb.query<{
      column_name: string;
      is_nullable: string;
      column_default: string | null;
    }>(
      `
        SELECT
          column_name,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'app'
          AND table_name = 'customers'
        ORDER BY ordinal_position
      `,
    );

  const names =
    new Set(
      columns.rows.map(
        row => row.column_name,
      ),
    );

  const values:
    Record<string, unknown> = {
      tenant_id:
        resolvedTenantId,
      status:
        "PROSPECT",
    };

  if (names.has("code")) {
    values.code =
      `ORCH-${suffix}`;
  }

  if (names.has("name")) {
    values.name =
      `${TEST_MARKER} Customer`;
  }

  if (names.has("display_name")) {
    values.display_name =
      `${TEST_MARKER} Customer`;
  }

  if (names.has("legal_name")) {
    values.legal_name =
      `${TEST_MARKER} Customer`;
  }

  const required =
    columns.rows.filter(
      row =>
        row.is_nullable === "NO" &&
        row.column_default === null &&
        row.column_name !== "tenant_id" &&
        !Object.prototype.hasOwnProperty.call(
          values,
          row.column_name,
        ),
    );

  if (required.length > 0) {
    throw new Error(
      `Cannot create disposable customer. Required columns: ${required
        .map(row => row.column_name)
        .join(", ")}`,
    );
  }

  const keys =
    Object.keys(values);

  const params =
    keys.map(
      (_, index) =>
        `$${index + 1}`,
    );

  const result =
    await appDb.query<{
      id: string;
    }>(
      `
        INSERT INTO app.customers (
          ${keys.join(", ")}
        )
        VALUES (
          ${params.join(", ")}
        )
        RETURNING id::text
      `,
      keys.map(
        key => values[key],
      ),
    );

  return result.rows[0].id;
}


async function createFixtures(): Promise<void> {
  console.log(
    "--- CREATE FIXTURES ---",
  );

  const tenant =
    await getTenant();

  tenantId =
    tenant.id;

  tenantCode =
    tenant.code;

  customerId =
    await createTestCustomer(
      tenantId,
    );

  const opportunity =
    await appDb.query<{
      id: string;
    }>(
      `
        INSERT INTO app.opportunities (
          tenant_id,
          customer_id,
          code,
          title,
          description,
          status,
          source
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          'CONVERTED_TO_PROJECT',
          'INTEGRATION_TEST'
        )
        RETURNING id::text
      `,
      [
        tenantId,
        customerId,
        `ORCH-OPP-${suffix}`,
        `${TEST_MARKER} Opportunity`,
        "Disposable orchestrator test opportunity",
      ],
    );

  opportunityId =
    opportunity.rows[0].id;

  const project =
    await appDb.query<{
      id: string;
    }>(
      `
        INSERT INTO app.projects (
          tenant_id,
          code,
          name,
          description,
          status
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          'ACTIVE'
        )
        RETURNING id::text
      `,
      [
        tenantId,
        `ORCH-PROJ-${suffix}`,
        `${TEST_MARKER} Project`,
        "Disposable orchestrator test project",
      ],
    );

  projectId =
    project.rows[0].id;

  await appDb.query(
    `
      UPDATE app.opportunities
      SET
        converted_project_id = $2
      WHERE id = $1
    `,
    [
      opportunityId,
      projectId,
    ],
  );

  projectDefinitionId =
    randomUUID();

  await appDb.query(
    `
      INSERT INTO app.project_definitions (
        id,
        project_id,
        tenant_id,
        version,
        status,
        definition
      )
      VALUES (
        $1,
        $2,
        $3,
        1,
        'READY',
        $4::jsonb
      )
    `,
    [
      projectDefinitionId,
      projectId,
      tenantId,
      JSON.stringify({
        marker:
          TEST_MARKER,
        requirements: [],
      }),
    ],
  );

  console.log(
    "tenantId:",
    tenantId,
  );

  console.log(
    "customerId:",
    customerId,
  );

  console.log(
    "opportunityId:",
    opportunityId,
  );

  console.log(
    "projectId:",
    projectId,
  );

  console.log(
    "projectDefinitionId:",
    projectDefinitionId,
  );
}


async function cleanup(): Promise<void> {
  console.log(
    "\n--- CLEANUP ---",
  );

  const client =
    await appDb.connect();

  try {
    await client.query("BEGIN");

    if (projectId) {
      await client.query(
        `
          DELETE FROM app.project_execution_plans
          WHERE project_id = $1
        `,
        [
          projectId,
        ],
      );

      await client.query(
        `
          DELETE FROM app.specialist_artifacts
          WHERE project_id = $1
        `,
        [
          projectId,
        ],
      );

      await client.query(
        `
          DELETE FROM app.project_definitions
          WHERE project_id = $1
        `,
        [
          projectId,
        ],
      );
    }

    if (opportunityId) {
      await client.query(
        `
          UPDATE app.opportunities
          SET converted_project_id = NULL
          WHERE id = $1
        `,
        [
          opportunityId,
        ],
      );

      await client.query(
        `
          DELETE FROM app.opportunities
          WHERE id = $1
        `,
        [
          opportunityId,
        ],
      );
    }

    if (projectId) {
      await client.query(
        `
          DELETE FROM app.projects
          WHERE id = $1
        `,
        [
          projectId,
        ],
      );
    }

    if (customerId) {
      await client.query(
        `
          DELETE FROM app.customers
          WHERE id = $1
        `,
        [
          customerId,
        ],
      );
    }

    await client.query("COMMIT");

    console.log(
      "Cleanup completed.",
    );
  }
  catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "Cleanup failed:",
      error,
    );

    throw error;
  }
  finally {
    client.release();
  }
}


async function createReadyArtifact(
  role:
    | "RESEARCH_COMPETITOR"
    | "SEARCH_VISIBILITY"
    | "COPYWRITER",
  artifactType:
    | "RESEARCH_PACKAGE"
    | "SEARCH_VISIBILITY_PACKAGE"
    | "COPY_PACKAGE",
  sourceArtifactIds:
    string[],
  payload:
    Record<string, unknown>,
): Promise<string> {
  assert(
    tenantId &&
    tenantCode &&
    customerId &&
    opportunityId &&
    projectId &&
    projectDefinitionId,
    "Fixture IDs missing",
  );

  const latest =
    await appDb.query<{
      next_version: number;
    }>(
      `
        SELECT
          COALESCE(
            MAX(version),
            0
          ) + 1 AS next_version
        FROM app.specialist_artifacts
        WHERE project_id = $1
          AND artifact_type = $2
      `,
      [
        projectId,
        artifactType,
      ],
    );

  const version =
    Number(
      latest.rows[0]
        .next_version,
    );

  const id =
    randomUUID();

  await createSpecialistArtifact({
    artifact: {
      id,
      version,

      tenantId,
      tenantCode,

      scope:
        "PROJECT",

      customerId,
      opportunityId,
      projectId,

      role,
      artifactType,

      status:
        "READY",

      title:
        `${TEST_MARKER} ${artifactType}`,

      objective:
        `Produce ${artifactType}`,

      sourceArtifactIds,

      findings: [],
      recommendations: [],
      unresolved: [],
      blockers: [],
      provenance: [],

      payload,

      createdAt:
        new Date().toISOString(),

      updatedAt:
        new Date().toISOString(),
    },

    projectDefinitionBinding: {
      recordId:
        projectDefinitionId,

      version:
        1,
    },
  });

  return id;
}


async function main(): Promise<void> {
  try {
    await createFixtures();

    assert(
      tenantId &&
      tenantCode &&
      customerId &&
      opportunityId &&
      projectId &&
      projectDefinitionId,
      "Fixture creation incomplete",
    );


    console.log(
      "\n--- 1. CREATE ORCHESTRATOR PLAN ---",
    );

    const plan =
      await createProjectExecutionPlan({
        tenantId,
        projectId,
        projectDefinitionId,
        projectDefinitionVersion:
          1,

        stages: [
          {
            stageKey:
              "research",

            agentRole:
              "RESEARCH_COMPETITOR",

            executionKind:
              "SPECIALIST_ARTIFACT",

            expectedArtifactType:
              "RESEARCH_PACKAGE",
          },

          {
            stageKey:
              "seo",

            agentRole:
              "SEARCH_VISIBILITY",

            executionKind:
              "SPECIALIST_ARTIFACT",

            expectedArtifactType:
              "SEARCH_VISIBILITY_PACKAGE",
          },

          {
            stageKey:
              "copy",

            agentRole:
              "COPYWRITER",

            executionKind:
              "SPECIALIST_ARTIFACT",

            expectedArtifactType:
              "COPY_PACKAGE",
          },
        ],

        dependencies: [
          {
            stageKey:
              "seo",

            dependsOnStageKey:
              "research",
          },

          {
            stageKey:
              "copy",

            dependsOnStageKey:
              "seo",
          },
        ],
      });

    console.log(
      "planId:",
      plan.id,
    );


    let researchArtifactId =
      "";

    let seoArtifactId =
      "";


    const handlers:
      StageExecutionHandlerRegistry = {

      RESEARCH_COMPETITOR:
        async context => {
          assert(
            context.upstreamOutputs.length ===
              0,
            "Research should have no upstream outputs",
          );

          researchArtifactId =
            await createReadyArtifact(
              "RESEARCH_COMPETITOR",
              "RESEARCH_PACKAGE",
              [],
              {
                handler:
                  "research",

                upstreamCount:
                  context.upstreamOutputs.length,
              },
            );

          return {
            kind:
              "SPECIALIST_ARTIFACT",

            specialistArtifactId:
              researchArtifactId,
          };
        },


      SEARCH_VISIBILITY:
        async context => {
          assert(
            context.upstreamOutputs.length ===
              1,
            "SEO should receive exactly one upstream output",
          );

          const upstream =
            context.upstreamOutputs[0];

          assert(
            upstream.outputKind ===
              "SPECIALIST_ARTIFACT",
            "SEO upstream output should be specialist artifact",
          );

          assert(
            upstream.specialistArtifactId ===
              researchArtifactId,
            "SEO did not receive research artifact",
          );

          seoArtifactId =
            await createReadyArtifact(
              "SEARCH_VISIBILITY",
              "SEARCH_VISIBILITY_PACKAGE",
              [
                researchArtifactId,
              ],
              {
                handler:
                  "seo",

                receivedResearch:
                  upstream.specialistArtifactId,
              },
            );

          return {
            kind:
              "SPECIALIST_ARTIFACT",

            specialistArtifactId:
              seoArtifactId,
          };
        },


      COPYWRITER:
        async context => {
          assert(
            context.upstreamOutputs.length ===
              1,
            "Copy should receive one SEO output",
          );

          const upstream =
            context.upstreamOutputs[0];

          assert(
            upstream.outputKind ===
              "SPECIALIST_ARTIFACT",
            "Copy upstream must be specialist artifact",
          );

          assert(
            upstream.specialistArtifactId ===
              seoArtifactId,
            "Copy did not receive SEO artifact",
          );

          const copyArtifactId =
            await createReadyArtifact(
              "COPYWRITER",
              "COPY_PACKAGE",
              [
                seoArtifactId,
              ],
              {
                handler:
                  "copy",
              },
            );

          return {
            kind:
              "SPECIALIST_ARTIFACT",

            specialistArtifactId:
              copyArtifactId,
          };
        },
    };


    console.log(
      "\n--- 2. PASS 1: RESEARCH ---",
    );

    const pass1 =
      await runExecutionPlanPass(
        tenantId,
        plan.id,
        handlers,
      );

    assert(
      pass1.executedStageCount ===
        1,
      "Pass 1 should execute one stage",
    );

    assert(
      pass1.stageResults[0]
        .success,
      "Research stage failed",
    );

    assert(
      pass1.remainingRunnableStageKeys
        .includes("seo"),
      "SEO should be READY after research",
    );

    console.log(
      "PASS research orchestration",
    );


    console.log(
      "\n--- 3. PASS 2: SEO RECEIVES RESEARCH OUTPUT ---",
    );

    const pass2 =
      await runExecutionPlanPass(
        tenantId,
        plan.id,
        handlers,
      );

    assert(
      pass2.stageResults[0]
        .success,
      "SEO stage failed",
    );

    assert(
      pass2.remainingRunnableStageKeys
        .includes("copy"),
      "Copy should be READY after SEO",
    );

    console.log(
      "PASS upstream propagation",
    );


    console.log(
      "\n--- 4. PASS 3: COPY ---",
    );

    const pass3 =
      await runExecutionPlanPass(
        tenantId,
        plan.id,
        handlers,
      );

    assert(
      pass3.stageResults[0]
        .success,
      "Copy stage failed",
    );

    assert(
      pass3.finalPlanStatus ===
        "COMPLETED",
      "Main orchestrator plan should complete",
    );

    console.log(
      "PASS main orchestration chain",
    );


    console.log(
      "\n--- 5. VERIFY OUTPUT BINDINGS ---",
    );

    const outputRows =
      await appDb.query<{
        stage_key: string;
        output_kind: string;
        specialist_artifact_id:
          string | null;
      }>(
        `
          SELECT
            s.stage_key,
            o.output_kind,
            o.specialist_artifact_id::text

          FROM app.project_execution_stage_outputs o

          JOIN app.project_execution_stages s
            ON s.id =
              o.stage_id

          WHERE o.execution_plan_id = $1

          ORDER BY s.stage_key
        `,
        [
          plan.id,
        ],
      );

    assert(
      outputRows.rows.length ===
        3,
      `Expected 3 persisted stage outputs, got ${outputRows.rows.length}`,
    );

    console.log(
      "PASS output bindings",
    );


    console.log(
      "\n--- 6. MISSING HANDLER → BLOCKED ---",
    );

    const missingHandlerPlan =
      await createProjectExecutionPlan({
        tenantId,
        projectId,
        projectDefinitionId,
        projectDefinitionVersion:
          1,

        stages: [
          {
            stageKey:
              "ux",

            agentRole:
              "UI_UX_DESIGNER",

            executionKind:
              "SPECIALIST_ARTIFACT",

            expectedArtifactType:
              "UX_DESIGN_PACKAGE",
          },
        ],
      });

    const missingResult =
      await runExecutionPlanPass(
        tenantId,
        missingHandlerPlan.id,
        {},
      );

    assert(
      missingResult.stageResults[0]
        .success === false,
      "Missing handler should fail",
    );

    const missingLoaded =
      await getProjectExecutionPlan(
        tenantId,
        missingHandlerPlan.id,
      );

    assert(
      missingLoaded.stages[0]
        .status ===
        "BLOCKED",
      "Missing handler stage should become BLOCKED",
    );

    assert(
      missingLoaded.status ===
        "BLOCKED",
      "Missing handler plan should become BLOCKED",
    );

    console.log(
      "PASS missing handler failure",
    );


    console.log(
      "\n--- 7. HANDLER THROW → BLOCKED ---",
    );

    const throwingPlan =
      await createProjectExecutionPlan({
        tenantId,
        projectId,
        projectDefinitionId,
        projectDefinitionVersion:
          1,

        stages: [
          {
            stageKey:
              "research",

            agentRole:
              "RESEARCH_COMPETITOR",

            executionKind:
              "SPECIALIST_ARTIFACT",

            expectedArtifactType:
              "RESEARCH_PACKAGE",
          },
        ],
      });

    const throwingResult =
      await runExecutionPlanPass(
        tenantId,
        throwingPlan.id,
        {
          RESEARCH_COMPETITOR:
            async () => {
              throw new Error(
                "Intentional handler failure",
              );
            },
        },
      );

    assert(
      throwingResult.stageResults[0]
        .success === false,
      "Throwing handler should fail",
    );

    const throwingLoaded =
      await getProjectExecutionPlan(
        tenantId,
        throwingPlan.id,
      );

    assert(
      throwingLoaded.stages[0]
        .status ===
        "BLOCKED",
      "Throwing handler stage should be BLOCKED",
    );

    console.log(
      "PASS handler exception blocking",
    );


    console.log(
      "\n--- 8. WRONG OUTPUT KIND → BLOCKED ---",
    );

    const wrongKindPlan =
      await createProjectExecutionPlan({
        tenantId,
        projectId,
        projectDefinitionId,
        projectDefinitionVersion:
          1,

        stages: [
          {
            stageKey:
              "research",

            agentRole:
              "RESEARCH_COMPETITOR",

            executionKind:
              "SPECIALIST_ARTIFACT",

            expectedArtifactType:
              "RESEARCH_PACKAGE",
          },
        ],
      });

    const wrongKindResult =
      await runExecutionPlanPass(
        tenantId,
        wrongKindPlan.id,
        {
          RESEARCH_COMPETITOR:
            async () => ({
              kind:
                "DEVELOPER_WORK_ORDER",

              developerWorkOrderId:
                randomUUID(),
            }),
        },
      );

    assert(
      wrongKindResult.stageResults[0]
        .success === false,
      "Wrong output kind should fail",
    );

    const wrongKindLoaded =
      await getProjectExecutionPlan(
        tenantId,
        wrongKindPlan.id,
      );

    assert(
      wrongKindLoaded.stages[0]
        .status ===
        "BLOCKED",
      "Wrong output kind stage should be BLOCKED",
    );

    console.log(
      "PASS wrong output kind blocking",
    );


    console.log(
      "\n--- 9. PARALLEL READY STAGES ---",
    );

    const parallelPlan =
      await createProjectExecutionPlan({
        tenantId,
        projectId,
        projectDefinitionId,
        projectDefinitionVersion:
          1,

        stages: [
          {
            stageKey:
              "research",

            agentRole:
              "RESEARCH_COMPETITOR",

            executionKind:
              "SPECIALIST_ARTIFACT",

            expectedArtifactType:
              "RESEARCH_PACKAGE",
          },

          {
            stageKey:
              "seo",

            agentRole:
              "SEARCH_VISIBILITY",

            executionKind:
              "SPECIALIST_ARTIFACT",

            expectedArtifactType:
              "SEARCH_VISIBILITY_PACKAGE",
          },
        ],
      });


    const parallelHandlers:
      StageExecutionHandlerRegistry = {

      RESEARCH_COMPETITOR:
        async () => {
          const id =
            await createReadyArtifact(
              "RESEARCH_COMPETITOR",
              "RESEARCH_PACKAGE",
              [],
              {
                parallel:
                  "research",
              },
            );

          return {
            kind:
              "SPECIALIST_ARTIFACT",

            specialistArtifactId:
              id,
          };
        },


      SEARCH_VISIBILITY:
        async () => {
          const id =
            await createReadyArtifact(
              "SEARCH_VISIBILITY",
              "SEARCH_VISIBILITY_PACKAGE",
              [],
              {
                parallel:
                  "seo",
              },
            );

          return {
            kind:
              "SPECIALIST_ARTIFACT",

            specialistArtifactId:
              id,
          };
        },
    };


    const parallelResult =
      await runExecutionPlanPass(
        tenantId,
        parallelPlan.id,
        parallelHandlers,
      );


    assert(
      parallelResult.runnableStageCount ===
        2,
      "Parallel plan should have two initial runnable stages",
    );

    assert(
      parallelResult.stageResults.every(
        result =>
          result.success,
      ),
      "Parallel stages should both succeed",
    );

    assert(
      parallelResult.finalPlanStatus ===
        "COMPLETED",
      "Parallel plan should complete in one pass",
    );

    console.log(
      "PASS parallel execution",
    );


    console.log(
      "\n========================================",
    );

    console.log(
      "DYNAMIC ORCHESTRATOR TEST: PASS",
    );

    console.log(
      "========================================",
    );
  }
  finally {
    await cleanup();
  }
}


main()
  .catch(
    error => {
      console.error(
        "\nDYNAMIC ORCHESTRATOR TEST: FAIL",
      );

      console.error(
        error,
      );

      process.exitCode = 1;
    },
  )
  .finally(
    async () => {
      await appDb.end();
    },
  );
