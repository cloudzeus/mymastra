import {
  randomUUID,
} from "node:crypto";

import {
  appDb,
} from "../src/mastra/db/postgres";

import {
  createProjectExecutionPlan,
  getProjectExecutionPlan,
  getLatestProjectExecutionPlan,
  getRunnableExecutionStages,
  validateProjectExecutionPlan,
} from "../src/mastra/execution";


const TEST_MARKER =
  "__MASTRA_EXECUTION_PLAN_TEST__";

const suffix =
  Date.now().toString();


let tenantId:
  string | undefined;

let projectId:
  string | undefined;

let readyDefinitionId:
  string | undefined;

let blockedDefinitionId:
  string | undefined;


function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}


async function expectFailure(
  label: string,
  fn: () => Promise<unknown>,
  expectedText?: string,
): Promise<void> {
  try {
    await fn();

    throw new Error(
      `${label}: expected failure but operation succeeded`,
    );
  }
  catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    if (
      message.includes(
        "expected failure but operation succeeded",
      )
    ) {
      throw error;
    }

    if (
      expectedText &&
      !message.includes(expectedText)
    ) {
      throw new Error(
        `${label}: unexpected error: ${message}`,
      );
    }

    console.log(
      `PASS expected failure: ${label}`,
    );

    console.log(
      `  -> ${message}`,
    );
  }
}


async function getTenant(): Promise<string> {
  const result =
    await appDb.query<{
      id: string;
    }>(
      `
        SELECT id::text
        FROM app.tenants
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

  return row.id;
}


async function createFixtures(): Promise<void> {
  console.log(
    "--- CREATE FIXTURES ---",
  );

  tenantId =
    await getTenant();

  console.log(
    "tenantId:",
    tenantId,
  );


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
        `EXEC-${suffix}`,
        `${TEST_MARKER} Project`,
        "Disposable execution-plan integration test project",
      ],
    );

  projectId =
    project.rows[0].id;

  console.log(
    "projectId:",
    projectId,
  );


  readyDefinitionId =
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
      readyDefinitionId,
      projectId,
      tenantId,
      JSON.stringify({
        marker:
          TEST_MARKER,

        version:
          1,

        requirements: [],
      }),
    ],
  );

  console.log(
    "readyDefinitionId:",
    readyDefinitionId,
  );


  blockedDefinitionId =
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
        2,
        'BLOCKED',
        $4::jsonb
      )
    `,
    [
      blockedDefinitionId,
      projectId,
      tenantId,
      JSON.stringify({
        marker:
          TEST_MARKER,

        version:
          2,

        blockers: [
          "Integration test blocker",
        ],
      }),
    ],
  );

  console.log(
    "blockedDefinitionId:",
    blockedDefinitionId,
  );
}


async function cleanup(): Promise<void> {
  console.log(
    "\n--- CLEANUP ---",
  );

  const client =
    await appDb.connect();

  try {
    await client.query(
      "BEGIN",
    );

    if (projectId) {
      /*
       * Dependencies and stages cascade from plans.
       */
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
          DELETE FROM app.project_definitions
          WHERE project_id = $1
        `,
        [
          projectId,
        ],
      );

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

    await client.query(
      "COMMIT",
    );

    console.log(
      "Cleanup completed.",
    );
  }
  catch (error) {
    await client.query(
      "ROLLBACK",
    );

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


async function main(): Promise<void> {
  try {
    await createFixtures();

    assert(
      tenantId,
      "tenantId missing",
    );

    assert(
      projectId,
      "projectId missing",
    );

    assert(
      readyDefinitionId,
      "readyDefinitionId missing",
    );

    assert(
      blockedDefinitionId,
      "blockedDefinitionId missing",
    );


    console.log(
      "\n--- 1. VALIDATOR: DUPLICATE STAGE ---",
    );

    const duplicateValidation =
      validateProjectExecutionPlan({
        tenantId,
        projectId,

        projectDefinitionId:
          readyDefinitionId,

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
              "research",

            agentRole:
              "SEARCH_VISIBILITY",

            executionKind:
              "SPECIALIST_ARTIFACT",

            expectedArtifactType:
              "SEARCH_VISIBILITY_PACKAGE",
          },
        ],
      });

    assert(
      !duplicateValidation.valid,
      "Duplicate stage validator should fail",
    );

    assert(
      duplicateValidation.errors.some(
        error =>
          error.includes(
            "Duplicate stageKey",
          ),
      ),
      "Duplicate stage error missing",
    );

    console.log(
      "PASS duplicate stage validation",
    );


    console.log(
      "\n--- 2. VALIDATOR: UNKNOWN DEPENDENCY ---",
    );

    const unknownDependencyValidation =
      validateProjectExecutionPlan({
        tenantId,
        projectId,

        projectDefinitionId:
          readyDefinitionId,

        projectDefinitionVersion:
          1,

        stages: [
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

        dependencies: [
          {
            stageKey:
              "seo",

            dependsOnStageKey:
              "missing",
          },
        ],
      });

    assert(
      !unknownDependencyValidation.valid,
      "Unknown dependency validator should fail",
    );

    assert(
      unknownDependencyValidation.errors.some(
        error =>
          error.includes(
            "unknown parent stage",
          ),
      ),
      "Unknown dependency error missing",
    );

    console.log(
      "PASS unknown dependency validation",
    );


    console.log(
      "\n--- 3. VALIDATOR: SELF DEPENDENCY ---",
    );

    const selfDependencyValidation =
      validateProjectExecutionPlan({
        tenantId,
        projectId,

        projectDefinitionId:
          readyDefinitionId,

        projectDefinitionVersion:
          1,

        stages: [
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

        dependencies: [
          {
            stageKey:
              "seo",

            dependsOnStageKey:
              "seo",
          },
        ],
      });

    assert(
      !selfDependencyValidation.valid,
      "Self dependency validator should fail",
    );

    assert(
      selfDependencyValidation.errors.some(
        error =>
          error.includes(
            "cannot depend on itself",
          ),
      ),
      "Self dependency error missing",
    );

    console.log(
      "PASS self dependency validation",
    );


    console.log(
      "\n--- 4. VALIDATOR: CYCLE ---",
    );

    const cycleValidation =
      validateProjectExecutionPlan({
        tenantId,
        projectId,

        projectDefinitionId:
          readyDefinitionId,

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

          {
            stageKey:
              "research",

            dependsOnStageKey:
              "copy",
          },
        ],
      });

    assert(
      !cycleValidation.valid,
      "Cycle validator should fail",
    );

    assert(
      cycleValidation.errors.some(
        error =>
          error.includes(
            "dependency cycle",
          ),
      ),
      "Cycle error missing",
    );

    console.log(
      "PASS cycle validation",
    );


    console.log(
      "\n--- 5. NON-READY PROJECT DEFINITION ---",
    );

    await expectFailure(
      "BLOCKED ProjectDefinition",

      async () => {
        await createProjectExecutionPlan({
          tenantId,
          projectId,

          projectDefinitionId:
            blockedDefinitionId,

          projectDefinitionVersion:
            2,

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
      },

      "ProjectDefinition must be READY",
    );


    console.log(
      "\n--- 6. CREATE MIXED EXECUTION PLAN ---",
    );

    const plan =
      await createProjectExecutionPlan({
        tenantId,
        projectId,

        projectDefinitionId:
          readyDefinitionId,

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

            configuration: {
              purpose:
                "competitor baseline",
            },
          },

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

          {
            stageKey:
              "developer",

            agentRole:
              "DEVELOPER",

            executionKind:
              "DEVELOPER_WORK_ORDER",

            approvalRequired:
              true,

            configuration: {
              taskType:
                "UI",
            },
          },
        ],

        dependencies: [
          {
            stageKey:
              "ux",

            dependsOnStageKey:
              "research",
          },

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
              "ux",
          },

          {
            stageKey:
              "copy",

            dependsOnStageKey:
              "seo",
          },

          {
            stageKey:
              "developer",

            dependsOnStageKey:
              "copy",
          },
        ],
      });

    console.log(
      "planId:",
      plan.id,
    );

    console.log(
      "planVersion:",
      plan.version,
    );

    console.log(
      "planStatus:",
      plan.status,
    );

    assert(
      plan.status ===
        "READY",
      "New execution plan should be READY",
    );

    assert(
      plan.version === 1,
      `Expected plan version 1, got ${plan.version}`,
    );

    assert(
      plan.stages.length ===
        5,
      `Expected 5 stages, got ${plan.stages.length}`,
    );

    assert(
      plan.dependencies.length ===
        5,
      `Expected 5 dependencies, got ${plan.dependencies.length}`,
    );


    console.log(
      "\n--- 7. VERIFY INITIAL STAGE STATES ---",
    );

    const byKey =
      new Map(
        plan.stages.map(
          stage => [
            stage.stageKey,
            stage,
          ],
        ),
      );

    assert(
      byKey.get("research")
        ?.status ===
        "READY",
      "research should start READY",
    );

    assert(
      byKey.get("ux")
        ?.status ===
        "PENDING",
      "ux should start PENDING",
    );

    assert(
      byKey.get("seo")
        ?.status ===
        "PENDING",
      "seo should start PENDING",
    );

    assert(
      byKey.get("copy")
        ?.status ===
        "PENDING",
      "copy should start PENDING",
    );

    assert(
      byKey.get("developer")
        ?.status ===
        "PENDING",
      "developer should start PENDING",
    );

    console.log(
      "PASS initial stage states",
    );


    console.log(
      "\n--- 8. RUNNABLE STAGES ---",
    );

    const runnable =
      await getRunnableExecutionStages(
        tenantId,
        plan.id,
      );

    console.log(
      "runnable:",
      runnable.map(
        stage =>
          stage.stageKey,
      ),
    );

    assert(
      runnable.length === 1,
      `Expected 1 runnable stage, got ${runnable.length}`,
    );

    assert(
      runnable[0].stageKey ===
        "research",
      "research should be the only runnable stage",
    );


    console.log(
      "\n--- 9. LOAD PLAN ---",
    );

    const loaded =
      await getProjectExecutionPlan(
        tenantId,
        plan.id,
      );

    assert(
      loaded.id ===
        plan.id,
      "Loaded plan id mismatch",
    );

    assert(
      loaded.dependencies.length ===
        5,
      "Loaded dependency count mismatch",
    );

    console.log(
      "PASS plan hydration",
    );


    console.log(
      "\n--- 10. LATEST PLAN ---",
    );

    const latest =
      await getLatestProjectExecutionPlan(
        tenantId,
        projectId,
      );

    assert(
      latest?.id ===
        plan.id,
      "Latest project execution plan mismatch",
    );

    console.log(
      "PASS latest plan retrieval",
    );


    console.log(
      "\n--- 11. PARALLEL ROOT PLAN ---",
    );

    const parallelPlan =
      await createProjectExecutionPlan({
        tenantId,
        projectId,

        projectDefinitionId:
          readyDefinitionId,

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
              "ux",

            agentRole:
              "UI_UX_DESIGNER",

            executionKind:
              "SPECIALIST_ARTIFACT",

            expectedArtifactType:
              "UX_DESIGN_PACKAGE",
          },

          {
            stageKey:
              "developer",

            agentRole:
              "DEVELOPER",

            executionKind:
              "DEVELOPER_WORK_ORDER",
          },
        ],

        dependencies: [
          {
            stageKey:
              "developer",

            dependsOnStageKey:
              "research",
          },

          {
            stageKey:
              "developer",

            dependsOnStageKey:
              "ux",
          },
        ],
      });

    assert(
      parallelPlan.version ===
        2,
      `Expected second plan version 2, got ${parallelPlan.version}`,
    );

    const parallelRunnable =
      await getRunnableExecutionStages(
        tenantId,
        parallelPlan.id,
      );

    const runnableKeys =
      parallelRunnable
        .map(
          stage =>
            stage.stageKey,
        )
        .sort();

    console.log(
      "parallel runnable:",
      runnableKeys,
    );

    assert(
      JSON.stringify(
        runnableKeys,
      ) ===
        JSON.stringify([
          "research",
          "ux",
        ]),
      "Expected research and ux to be parallel root stages",
    );


    console.log(
      "\n========================================",
    );

    console.log(
      "PROJECT EXECUTION PLAN TEST: PASS",
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
        "\nPROJECT EXECUTION PLAN TEST: FAIL",
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
