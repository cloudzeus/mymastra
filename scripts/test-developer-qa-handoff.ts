import {
  randomUUID,
} from "node:crypto";

import {
  appDb,
} from "../src/mastra/db/postgres";

import {
  createProjectExecutionPlan,
  getProjectExecutionPlan,
  startExecutionStage,
  finishExecutionStage,
  attachDeveloperWorkOrderOutput,
  listExecutionStageOutputs,
  resolveUpstreamStageOutputs,
} from "../src/mastra/execution";

import {
  createDeveloperWorkOrder,
} from "../src/mastra/projects/developer-contract-manager";

import type {
  DeveloperWorkOrder,
} from "../src/mastra/projects/developer-work-order-types";


const TEST_MARKER =
  "__MASTRA_DEVELOPER_QA_HANDOFF_TEST__";

const suffix =
  Date.now().toString();


let tenantId:
  string | undefined;

let tenantCode:
  string | undefined;

let projectId:
  string | undefined;

let projectDefinitionRecordId:
  string | undefined;

let projectDefinitionPackageId:
  string | undefined;

let executionPlanId:
  string | undefined;

let developerWorkOrderRecordId:
  string | undefined;


function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(
      message,
    );
  }
}


async function getActiveTenant():
  Promise<string> {
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


async function createFixtures():
  Promise<void> {
  console.log(
    "--- CREATE FIXTURES ---",
  );


  tenantId =
    await getActiveTenant();


  const tenantResult =
    await appDb.query<{
      code: string | null;
    }>(
      `
        SELECT
          to_jsonb(t)->>'code'
            AS code
        FROM app.tenants t
        WHERE t.id = $1
        LIMIT 1
      `,
      [
        tenantId,
      ],
    );


  tenantCode =
    tenantResult.rows[0]
      ?.code
      ?.trim();


  if (!tenantCode) {
    throw new Error(
      "Active tenant has no code",
    );
  }


  const projectResult =
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
        `QA-HANDOFF-${suffix}`,
        `${TEST_MARKER} Project`,
        "Disposable Developer -> QA handoff integration test",
      ],
    );


  projectId =
    projectResult.rows[0]
      .id;


  projectDefinitionRecordId =
    randomUUID();

  projectDefinitionPackageId =
    randomUUID();


  /*
   * Keep this definition intentionally minimal.
   *
   * The test validates execution-DAG handoff rather than
   * business analysis or live SoftOne discovery.
   */
  const definitionNow =
    new Date()
      .toISOString();


  const definition = {
    id:
      projectDefinitionPackageId,

    version:
      1,

    projectId,

    tenantId,

    tenantCode,

    status:
      "READY",

    requirements: [
      {
        id:
          "REQ-QA-HANDOFF",

        statement:
          "The Developer stage output must be propagated to the dependent QA stage.",

        status:
          "VERIFIED",

        acceptanceCriteria: [
          "QA receives the persisted DeveloperWorkOrder output from the execution DAG.",
        ],

        sourceIds: [
          TEST_MARKER,
        ],

        requiredForDevelopment:
          true,

        notes: [
          "Synthetic requirement used only by the Developer -> QA handoff integration test.",
        ],
      },
    ],

    knowledgeReferences:
      [],

    structuredSqlPlans:
      [],

    integrationRequirements: [
      {
        id:
          "INT-SOFTONE-QA-HANDOFF",

        providerCode:
          "SOFTONE",

        environment:
          "TEST",

        purpose:
          "Synthetic SoftOne integration used to validate Developer -> QA handoff.",

        requiredCapabilities: [
          "WEB_SERVICES_READ",
          "WEB_SERVICES_UPSERT",
          "SQL_SCRIPT_GENERATION",
          "ADVANCED_JAVASCRIPT_GENERATION",
        ],

        requiredForDevelopment:
          true,

        bindingRequired:
          false,
      },
    ],

    unresolved:
      [],

    blockers:
      [],

    provenance:
      [],

    createdAt:
      definitionNow,

    updatedAt:
      definitionNow,
  };


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
      projectDefinitionRecordId,
      projectId,
      tenantId,
      JSON.stringify(
        definition,
      ),
    ],
  );


  console.log(
    "tenantId:",
    tenantId,
  );

  console.log(
    "tenantCode:",
    tenantCode,
  );

  console.log(
    "projectId:",
    projectId,
  );

  console.log(
    "projectDefinitionRecordId:",
    projectDefinitionRecordId,
  );

  console.log(
    "projectDefinitionPackageId:",
    projectDefinitionPackageId,
  );
}


async function cleanup():
  Promise<void> {
  console.log(
    "\n--- CLEANUP ---",
  );


  if (!projectId) {
    return;
  }


  const client =
    await appDb.connect();


  try {
    await client.query(
      "BEGIN",
    );


    /*
     * The execution plan owns stage outputs/dependencies.
     * Delete it before the underlying work order/project.
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


    /*
     * Developer work orders are project-owned.
     * Keep cleanup resilient to schema evolution.
     */
    await client.query(
      `
        DELETE FROM app.developer_work_orders
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


async function main():
  Promise<void> {
  await createFixtures();


  assert(
    tenantId &&
      tenantCode &&
      projectId &&
      projectDefinitionRecordId &&
      projectDefinitionPackageId,
    "Fixture ids missing",
  );


  console.log(
    "\n--- 1. CREATE DEVELOPER -> QA PLAN ---",
  );


  const plan =
    await createProjectExecutionPlan({
      tenantId,

      projectId,

      projectDefinitionId:
        projectDefinitionRecordId,

      projectDefinitionVersion:
        1,

      stages: [
        {
          stageKey:
            "developer",

          agentRole:
            "DEVELOPER",

          executionKind:
            "DEVELOPER_WORK_ORDER",

          required:
            true,

          approvalRequired:
            false,

          configuration: {
            allowedScopePaths: [
              "src",
              "artifacts",
            ],
          },
        },

        {
          stageKey:
            "qa",

          agentRole:
            "QUALITY_ASSURANCE",

          executionKind:
            "SPECIALIST_ARTIFACT",

          expectedArtifactType:
            "QA_REPORT",

          required:
            true,

          approvalRequired:
            false,

          configuration: {
            allowTools:
              true,
          },
        },
      ],

      dependencies: [
        {
          stageKey:
            "qa",

          dependsOnStageKey:
            "developer",
        },
      ],
    });


  executionPlanId =
    plan.id;


  console.log(
    "planId:",
    executionPlanId,
  );


  let hydrated =
    await getProjectExecutionPlan(
      tenantId,
      executionPlanId,
    );


  const developerStage =
    hydrated.stages.find(
      stage =>
        stage.stageKey ===
          "developer",
    );


  const qaStage =
    hydrated.stages.find(
      stage =>
        stage.stageKey ===
          "qa",
    );


  assert(
    developerStage,
    "Developer stage missing",
  );

  assert(
    qaStage,
    "QA stage missing",
  );

  assert(
    developerStage.status ===
      "READY",
    `Developer must start READY; received=${developerStage.status}`,
  );

  assert(
    qaStage.status ===
      "PENDING",
    `QA must start PENDING; received=${qaStage.status}`,
  );


  console.log(
    "PASS plan dependency",
  );


  console.log(
    "\n--- 2. CREATE PERSISTED DEVELOPER WORK ORDER ---",
  );


  const now =
    new Date()
      .toISOString();


  const workOrder:
    DeveloperWorkOrder = {
      id:
        randomUUID(),

      projectId,

      projectDefinitionId:
        projectDefinitionPackageId,

      projectDefinitionVersion:
        1,

      taskId:
        developerStage.id,

      taskType:
        "SOFTONE_INTEGRATION",

      objective:
        "Create deterministic QA handoff fixture",

      allowedScope: {
        paths: [
          "src",
          "artifacts",
        ],

        allowCreate:
          true,

        allowModify:
          true,

        allowDelete:
          false,
      },

      requiredArtifacts:
        [],

      artifactContract: {
        collectionName:
          "qa-handoff-test",

        artifactRoot:
          "artifacts/qa-handoff-test",

        softOne: {
          required:
            true,

          advancedJavaScriptGenerationRequired:
            true,

          manualInstallationRequired:
            true,

          autoInstallationAllowed:
            false,

          directory:
            "artifacts/qa-handoff-test/softone",

          installationGuidePath:
            "artifacts/qa-handoff-test/softone/INSTALLATION.md",

          readmePath:
            "artifacts/qa-handoff-test/softone/README.md",
        },

        api: {
          required:
            true,

          openApiRequired:
            true,

          openApiPath:
            "artifacts/qa-handoff-test/api/openapi.yaml",

          postmanRequired:
            true,

          postmanPath:
            "artifacts/qa-handoff-test/api/postman_collection.json",

          sourceOfTruth:
            "OPENAPI",
        },

        mappings: {
          required:
            true,

          directory:
            "artifacts/qa-handoff-test/mappings",

          softOneMappingPath:
            "artifacts/qa-handoff-test/mappings/softone-to-canonical.json",

          externalClientMappingPath:
            "artifacts/qa-handoff-test/mappings/external-client-to-canonical.md",
        },

        documentation: {
          required:
            true,

          directory:
            "artifacts/qa-handoff-test/documentation",

          apiDocumentationPath:
            "artifacts/qa-handoff-test/documentation/API.md",

          integrationGuidePath:
            "artifacts/qa-handoff-test/documentation/INTEGRATION-GUIDE.md",

          thirdPartyDeveloperGuidePath:
            "artifacts/qa-handoff-test/documentation/THIRD-PARTY-DEVELOPER-GUIDE.md",

          softOneIntegrationGuidePath:
            "artifacts/qa-handoff-test/documentation/SOFTONE-INTEGRATION.md",
        },

        qa: {
          handoffRequired:
            true,

          directory:
            "artifacts/qa-handoff-test/qa",

          handoffManifestPath:
            "artifacts/qa-handoff-test/qa/handoff.json",

          testMatrixPath:
            "artifacts/qa-handoff-test/qa/test-matrix.md",

          qaReportPath:
            "artifacts/qa-handoff-test/qa/QA-REPORT.md",

          documentationValidationRequired:
            true,

          openApiValidationRequired:
            true,

          postmanValidationRequired:
            true,
        },
      },

      acceptanceCriteria: [
        "QA receives the exact persisted DeveloperWorkOrder",
        "QA receives collectionName from artifactContract",
        "QA receives Developer acceptance criteria",
      ],

      executionPolicy: {
        workspaceResolvedByProjectId:
          true,

        arbitraryWorkspacePathAllowed:
          false,

        shellExecutionAllowed:
          false,

        networkAccessAllowed:
          false,

        gitCommitAllowed:
          false,

        gitPushAllowed:
          false,

        /*
         * Keep these values aligned with the currently
         * persisted DeveloperExecutionPolicy type.
         */
        softOneAccessPolicy: {
          transport:
            "WEB_SERVICES_ONLY",

          directDatabaseAccess:
            "UNAVAILABLE",

          dataExplorerExecution:
            "ADMIN_MANUAL_ONLY",

          webServicesReadAllowed:
            true,

          webServicesUpsertAllowed:
            true,

          sqlScriptGenerationAllowed:
            true,

          sqlScriptInstallation:
            "ADMIN_MANUAL_ONLY",

          sqlScriptInvocation:
            "WEB_SERVICES_ONLY",

          advancedJavaScriptGenerationAllowed:
            true,

          advancedJavaScriptInstallation:
            "ADMIN_MANUAL_ONLY",

          advancedJavaScriptInvocation:
            "WEB_SERVICES_ONLY",
        },

        softOneLiveMetadataPreflightRequired:
          true,
      },

      status:
        "READY",

      blockers:
        [],

      createdAt:
        now,

      updatedAt:
        now,
    };


  /*
   * createDeveloperWorkOrder persists the exact
   * application-owned contract.
   */
  const persisted =
    await createDeveloperWorkOrder({
      workOrder,

      projectDefinitionRecordId,
    });


  developerWorkOrderRecordId =
    persisted.recordId;


  assert(
    developerWorkOrderRecordId,
    "DeveloperWorkOrder was not persisted",
  );


  console.log(
    "developerWorkOrderId:",
    developerWorkOrderRecordId,
  );


  console.log(
    "\n--- 3. ATTACH DEVELOPER OUTPUT ---",
  );


  await startExecutionStage(
    tenantId,
    executionPlanId,
    developerStage.id,
  );


  await attachDeveloperWorkOrderOutput({
    tenantId,

    executionPlanId,

    stageId:
      developerStage.id,

    developerWorkOrderId:
      developerWorkOrderRecordId,
  });


  await finishExecutionStage(
    tenantId,
    executionPlanId,
    developerStage.id,
  );


  hydrated =
    await getProjectExecutionPlan(
      tenantId,
      executionPlanId,
    );


  const qaAfterDeveloper =
    hydrated.stages.find(
      stage =>
        stage.stageKey ===
          "qa",
    );


  assert(
    qaAfterDeveloper?.status ===
      "READY",
    `QA was not unlocked; received=${qaAfterDeveloper?.status}`,
  );


  console.log(
    "PASS QA unlocked by Developer completion",
  );


  console.log(
    "\n--- 4. VERIFY PERSISTED DEVELOPER OUTPUT ---",
  );


  const developerOutputs =
    await listExecutionStageOutputs(
      tenantId,
      executionPlanId,
      developerStage.id,
    );


  const developerOutput =
    developerOutputs.find(
      output =>
        output.outputKind ===
          "DEVELOPER_WORK_ORDER",
    );


  assert(
    developerOutput &&
      developerOutput.outputKind ===
        "DEVELOPER_WORK_ORDER",
    "Developer stage output missing",
  );


  assert(
    developerOutput
      .developerWorkOrderId ===
      developerWorkOrderRecordId,
    "Persisted developerWorkOrderId mismatch",
  );


  console.log(
    "PASS developerWorkOrderId persisted",
  );


  console.log(
    "\n--- 5. RESOLVE QA UPSTREAM INPUT ---",
  );


  assert(
    qaAfterDeveloper,
    "QA stage missing after Developer completion",
  );


  const upstream =
    await resolveUpstreamStageOutputs(
      tenantId,
      executionPlanId,
      qaAfterDeveloper.id,
    );


  const qaDeveloperOutput =
    upstream.find(
      output =>
        output.outputKind ===
          "DEVELOPER_WORK_ORDER",
    );


  assert(
    qaDeveloperOutput &&
      qaDeveloperOutput.outputKind ===
        "DEVELOPER_WORK_ORDER",
    "QA did not receive upstream DeveloperWorkOrder output",
  );


  assert(
    qaDeveloperOutput
      .developerWorkOrderId ===
      developerWorkOrderRecordId,
    "QA upstream DeveloperWorkOrder id mismatch",
  );


  console.log(
    "PASS execution DAG propagated DeveloperWorkOrder",
  );


  console.log(
    "\n--- 6. VERIFY QA CONTRACT FROM PERSISTED WORK ORDER ---",
  );


  const workOrderResult =
    await appDb.query<{
      work_order: any;
    }>(
      `
        SELECT work_order
        FROM app.developer_work_orders
        WHERE id = $1
        LIMIT 1
      `,
      [
        developerWorkOrderRecordId,
      ],
    );


  const persistedWorkOrder =
    workOrderResult.rows[0]
      ?.work_order;


  assert(
    persistedWorkOrder,
    "Persisted work order JSON missing",
  );


  assert(
    persistedWorkOrder
      .artifactContract
      .collectionName ===
      "qa-handoff-test",
    "collectionName did not survive persistence",
  );


  assert(
    persistedWorkOrder
      .artifactContract
      .qa
      .qaReportPath ===
      "artifacts/qa-handoff-test/qa/QA-REPORT.md",
    "QA report path mismatch",
  );


  assert(
    Array.isArray(
      persistedWorkOrder
        .acceptanceCriteria,
    ) &&
      persistedWorkOrder
        .acceptanceCriteria
        .length ===
        3,
    "Acceptance criteria did not survive persistence",
  );


  console.log(
    "PASS artifactContract persisted",
  );

  console.log(
    "PASS acceptance criteria persisted",
  );


  console.log(
    "\n========================================",
  );

  console.log(
    "DEVELOPER -> QA HANDOFF TEST: PASS",
  );

  console.log(
    "========================================",
  );
}


main()
  .catch(
    error => {
      console.error(
        "\nTEST FAILED:",
        error,
      );

      process.exitCode =
        1;
    },
  )
  .finally(
    async () => {
      try {
        await cleanup();
      }
      finally {
        await appDb.end();
      }
    },
  );
