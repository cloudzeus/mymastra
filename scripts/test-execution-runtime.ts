import {
  randomUUID,
} from "node:crypto";

import {
  appDb,
} from "../src/mastra/db/postgres";

import {
  createProjectExecutionPlan,
  getProjectExecutionPlan,
  getRunnableExecutionStages,

  startExecutionStage,
  finishExecutionStage,
  approveExecutionStage,
  blockExecutionStage,
  skipExecutionStage,
  resumeBlockedExecutionStage,
} from "../src/mastra/execution";


const TEST_MARKER =
  "__MASTRA_EXECUTION_RUNTIME_TEST__";

const suffix =
  Date.now().toString();


let tenantId:
  string | undefined;

let projectId:
  string | undefined;

let projectDefinitionId:
  string | undefined;

let planId:
  string | undefined;


function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}


function stageMap(
  plan:
    Awaited<
      ReturnType<
        typeof getProjectExecutionPlan
      >
    >,
) {
  return new Map(
    plan.stages.map(
      stage => [
        stage.stageKey,
        stage,
      ],
    ),
  );
}


async function getActiveTenant(): Promise<string> {
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
    await getActiveTenant();

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
        `RUN-${suffix}`,
        `${TEST_MARKER} Project`,
        "Disposable execution runtime test project",
      ],
    );

  projectId =
    project.rows[0].id;

  console.log(
    "projectId:",
    projectId,
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
    await client.query(
      "BEGIN",
    );

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
      projectDefinitionId,
      "projectDefinitionId missing",
    );


    console.log(
      "\n--- 1. CREATE RUNTIME PLAN ---",
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
              "ux",

            agentRole:
              "UI_UX_DESIGNER",

            executionKind:
              "SPECIALIST_ARTIFACT",

            expectedArtifactType:
              "UX_DESIGN_PACKAGE",

            required:
              false,
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

    planId =
      plan.id;

    console.log(
      "planId:",
      planId,
    );

    assert(
      plan.status ===
        "READY",
      "Plan should start READY",
    );


    console.log(
      "\n--- 2. START RESEARCH ---",
    );

    let current =
      await getProjectExecutionPlan(
        tenantId,
        planId,
      );

    let stages =
      stageMap(current);

    const research =
      stages.get(
        "research",
      );

    assert(
      research,
      "research stage missing",
    );

    assert(
      research.status ===
        "READY",
      "research should start READY",
    );


    await startExecutionStage(
      tenantId,
      planId,
      research.id,
    );


    current =
      await getProjectExecutionPlan(
        tenantId,
        planId,
      );

    stages =
      stageMap(current);

    assert(
      stages.get("research")
        ?.status ===
        "RUNNING",
      "research should be RUNNING",
    );

    assert(
      current.status ===
        "ACTIVE",
      "Plan should become ACTIVE",
    );

    console.log(
      "PASS research started",
    );


    console.log(
      "\n--- 3. COMPLETE RESEARCH ---",
    );

    const researchFinish =
      await finishExecutionStage(
        tenantId,
        planId,
        research.id,
      );

    console.log(
      "unlocked:",
      researchFinish.unlockedStageKeys,
    );

    const unlockedAfterResearch =
      [
        ...researchFinish
          .unlockedStageKeys,
      ].sort();

    assert(
      JSON.stringify(
        unlockedAfterResearch,
      ) ===
        JSON.stringify([
          "seo",
          "ux",
        ]),
      "Research completion should unlock ux and seo",
    );


    current =
      await getProjectExecutionPlan(
        tenantId,
        planId,
      );

    stages =
      stageMap(current);

    assert(
      stages.get("research")
        ?.status ===
        "COMPLETED",
      "research should be COMPLETED",
    );

    assert(
      stages.get("ux")
        ?.status ===
        "READY",
      "ux should be READY",
    );

    assert(
      stages.get("seo")
        ?.status ===
        "READY",
      "seo should be READY",
    );

    assert(
      stages.get("copy")
        ?.status ===
        "PENDING",
      "copy should remain PENDING",
    );

    console.log(
      "PASS research unlock",
    );


    console.log(
      "\n--- 4. SKIP OPTIONAL UX ---",
    );

    const ux =
      stages.get("ux");

    assert(
      ux,
      "ux stage missing",
    );

    const uxSkip =
      await skipExecutionStage(
        tenantId,
        planId,
        ux.id,
      );

    assert(
      uxSkip.stage.status ===
        "SKIPPED",
      "ux should become SKIPPED",
    );

    /*
     * Copy still depends on SEO,
     * therefore it must not unlock yet.
     */
    assert(
      !uxSkip.unlockedStageKeys
        .includes("copy"),
      "copy must not unlock before SEO completes",
    );

    console.log(
      "PASS optional UX skipped",
    );


    console.log(
      "\n--- 5. BLOCK SEO ---",
    );

    current =
      await getProjectExecutionPlan(
        tenantId,
        planId,
      );

    stages =
      stageMap(current);

    const seo =
      stages.get("seo");

    assert(
      seo,
      "seo stage missing",
    );

    const blocked =
      await blockExecutionStage(
        tenantId,
        planId,
        seo.id,
      );

    assert(
      blocked.stage.status ===
        "BLOCKED",
      "seo should become BLOCKED",
    );

    assert(
      blocked.planStatus ===
        "BLOCKED",
      "Plan should become BLOCKED",
    );

    console.log(
      "PASS SEO blocked",
    );


    console.log(
      "\n--- 6. RESUME SEO ---",
    );

    const resumed =
      await resumeBlockedExecutionStage(
        tenantId,
        planId,
        seo.id,
      );

    assert(
      resumed.stage.status ===
        "READY",
      "seo should resume to READY because research is completed",
    );

    assert(
      resumed.planStatus ===
        "READY",
      "Plan should return to READY",
    );

    console.log(
      "PASS SEO resumed",
    );


    console.log(
      "\n--- 7. RUN + COMPLETE SEO ---",
    );

    await startExecutionStage(
      tenantId,
      planId,
      seo.id,
    );

    const seoFinish =
      await finishExecutionStage(
        tenantId,
        planId,
        seo.id,
      );

    console.log(
      "unlocked:",
      seoFinish.unlockedStageKeys,
    );

    assert(
      seoFinish.unlockedStageKeys
        .includes("copy"),
      "SEO completion should unlock copy because UX is SKIPPED",
    );


    console.log(
      "\n--- 8. RUN + COMPLETE COPY ---",
    );

    current =
      await getProjectExecutionPlan(
        tenantId,
        planId,
      );

    stages =
      stageMap(current);

    const copy =
      stages.get("copy");

    assert(
      copy,
      "copy stage missing",
    );

    assert(
      copy.status ===
        "READY",
      "copy should now be READY",
    );


    await startExecutionStage(
      tenantId,
      planId,
      copy.id,
    );

    const copyFinish =
      await finishExecutionStage(
        tenantId,
        planId,
        copy.id,
      );

    assert(
      copyFinish
        .unlockedStageKeys
        .includes(
          "developer",
        ),
      "Copy completion should unlock developer",
    );

    console.log(
      "PASS copy completed",
    );


    console.log(
      "\n--- 9. DEVELOPER APPROVAL GATE ---",
    );

    current =
      await getProjectExecutionPlan(
        tenantId,
        planId,
      );

    stages =
      stageMap(current);

    const developer =
      stages.get(
        "developer",
      );

    assert(
      developer,
      "developer stage missing",
    );

    assert(
      developer.status ===
        "READY",
      "developer should be READY",
    );


    await startExecutionStage(
      tenantId,
      planId,
      developer.id,
    );


    const developerFinish =
      await finishExecutionStage(
        tenantId,
        planId,
        developer.id,
      );

    assert(
      developerFinish
        .stage.status ===
        "WAITING_APPROVAL",
      "developer should enter WAITING_APPROVAL",
    );

    assert(
      developerFinish
        .planStatus ===
        "ACTIVE",
      "Plan should remain ACTIVE while awaiting approval",
    );

    console.log(
      "PASS developer waiting approval",
    );


    console.log(
      "\n--- 10. APPROVE DEVELOPER ---",
    );

    const approved =
      await approveExecutionStage(
        tenantId,
        planId,
        developer.id,
      );

    assert(
      approved.stage.status ===
        "COMPLETED",
      "developer should become COMPLETED",
    );

    assert(
      approved.planStatus ===
        "COMPLETED",
      "Plan should become COMPLETED",
    );

    console.log(
      "PASS developer approved",
    );


    console.log(
      "\n--- 11. VERIFY FINAL PLAN ---",
    );

    current =
      await getProjectExecutionPlan(
        tenantId,
        planId,
      );

    stages =
      stageMap(current);

    console.log(
      "plan status:",
      current.status,
    );

    console.log(
      "stage states:",
      Object.fromEntries(
        current.stages.map(
          stage => [
            stage.stageKey,
            stage.status,
          ],
        ),
      ),
    );


    assert(
      current.status ===
        "COMPLETED",
      "Final plan should be COMPLETED",
    );

    assert(
      stages.get("research")
        ?.status ===
        "COMPLETED",
      "research final state mismatch",
    );

    assert(
      stages.get("ux")
        ?.status ===
        "SKIPPED",
      "ux final state mismatch",
    );

    assert(
      stages.get("seo")
        ?.status ===
        "COMPLETED",
      "seo final state mismatch",
    );

    assert(
      stages.get("copy")
        ?.status ===
        "COMPLETED",
      "copy final state mismatch",
    );

    assert(
      stages.get("developer")
        ?.status ===
        "COMPLETED",
      "developer final state mismatch",
    );


    const runnable =
      await getRunnableExecutionStages(
        tenantId,
        planId,
      );

    assert(
      runnable.length === 0,
      "Completed plan must have no runnable stages",
    );


    console.log(
      "\n========================================",
    );

    console.log(
      "EXECUTION RUNTIME TEST: PASS",
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
        "\nEXECUTION RUNTIME TEST: FAIL",
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
