import {
  randomUUID,
} from "node:crypto";

import {
  appDb,
} from "../src/mastra/db/postgres";

import {
  createProjectExecutionPlan,
  runExecutionPlanPass,
  reviewExecutionDeliverableRevision,
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
            true,

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
    "\n--- 3. ORCHESTRATOR PASS V1 ---",
  );


  let handlerRuns =
    0;


  let developerWorkOrderRecordIdV2:
    string | undefined;


  const handlers = {
    DEVELOPER:
      async () => {
        handlerRuns += 1;


        assert(
          developerWorkOrderRecordId,
          "DeveloperWorkOrder v1 missing",
        );


        if (
          handlerRuns === 1
        ) {
          return {
            kind:
              "DEVELOPER_WORK_ORDER" as const,

            developerWorkOrderId:
              developerWorkOrderRecordId,
          };
        }


        if (
          handlerRuns === 2
        ) {
          const correctionNow =
            new Date()
              .toISOString();


          const correctedWorkOrder:
            DeveloperWorkOrder = {
              ...workOrder,

              id:
                randomUUID(),

              objective:
                "Create corrected deterministic QA handoff fixture for RC-001",

              createdAt:
                correctionNow,

              updatedAt:
                correctionNow,
            };


          const persistedCorrection =
            await createDeveloperWorkOrder({
              workOrder:
                correctedWorkOrder,

              projectDefinitionRecordId,
            });


          developerWorkOrderRecordIdV2 =
            persistedCorrection.recordId;


          assert(
            developerWorkOrderRecordIdV2,
            "DeveloperWorkOrder v2 was not persisted",
          );


          assert(
            developerWorkOrderRecordIdV2 ===
              developerWorkOrderRecordId,
            "Correction must update the canonical DeveloperWorkOrder record",
          );


          return {
            kind:
              "DEVELOPER_WORK_ORDER" as const,

            developerWorkOrderId:
              developerWorkOrderRecordIdV2,
          };
        }


        throw new Error(
          `Unexpected Developer handler run ${handlerRuns}`,
        );
      },
  };


  const pass1 =
    await runExecutionPlanPass(
      tenantId,
      executionPlanId,
      handlers,
    );


  assert(
    handlerRuns === 1,
    "Developer handler must run once in pass 1",
  );


  const planAfterPass1 =
    await getProjectExecutionPlan(
      tenantId,
      executionPlanId,
    );


  const developerAfterPass1 =
    planAfterPass1.stages.find(
      stage =>
        stage.id ===
          developerStage.id,
    );


  const qaAfterPass1 =
    planAfterPass1.stages.find(
      stage =>
        stage.id ===
          qaStage.id,
    );


  console.log(
    "PASS1 RAW:",
    JSON.stringify(
      pass1,
      null,
      2,
    ),
  );


  console.log(
    "PASS1 STAGES:",
    JSON.stringify(
      planAfterPass1.stages.map(
        stage => ({
          stageKey:
            stage.stageKey,
          status:
            stage.status,
          id:
            stage.id,
        }),
      ),
      null,
      2,
    ),
  );


  assert(
    developerAfterPass1?.status ===
      "WAITING_APPROVAL",
    "Developer must be WAITING_APPROVAL after pass 1",
  );


  assert(
    qaAfterPass1?.status ===
      "PENDING",
    "QA must stay PENDING before approval",
  );


  const revisionsAfterPass1 =
    await appDb.query<{
      deliverable_id: string;
      revision_id: string;
      version: number;
      status: string;
      revision_of_id:
        string | null;
    }>(
      `
        SELECT
          d.id::text
            AS deliverable_id,
          r.id::text
            AS revision_id,
          r.version,
          r.status,
          r.revision_of_id::text
            AS revision_of_id
        FROM app.project_execution_deliverables d
        JOIN app.project_execution_deliverable_revisions r
          ON r.deliverable_id = d.id
        WHERE d.execution_plan_id = $1
          AND d.stage_id = $2
        ORDER BY r.version ASC
      `,
      [
        executionPlanId,
        developerStage.id,
      ],
    );


  assert(
    revisionsAfterPass1.rows.length ===
      1,
    "Pass 1 must create exactly one revision",
  );


  const revisionV1 =
    revisionsAfterPass1.rows[0];


  assert(
    revisionV1.version === 1 &&
    revisionV1.status ===
      "SUBMITTED",
    "Revision v1 must be SUBMITTED",
  );


  const outputsAfterPass1 =
    await appDb.query<{
      sequence: number;
    }>(
      `
        SELECT sequence
        FROM app.project_execution_stage_outputs
        WHERE execution_plan_id = $1
          AND stage_id = $2
        ORDER BY sequence ASC
      `,
      [
        executionPlanId,
        developerStage.id,
      ],
    );


  assert(
    outputsAfterPass1.rows.length === 1 &&
    outputsAfterPass1.rows[0]
      .sequence === 1,
    "Pass 1 output sequence must be [1]",
  );


  const pass1Result =
    (
      pass1 as any
    ).stageResults?.find(
      (result: any) =>
        result.stageId ===
          developerStage.id,
    ) ??
    (
      pass1 as any
    ).results?.find?.(
      (result: any) =>
        result.stageId ===
          developerStage.id,
    ) ??
    (
      Array.isArray(pass1)
        ? (pass1 as any[]).find(
            result =>
              result.stageId ===
                developerStage.id,
          )
        : undefined
    );


  if (pass1Result) {
    assert(
      pass1Result
        .reviewableDeliverable
        ?.deliverableRevisionId ===
        revisionV1.revision_id,
      "Pass 1 returned wrong reviewable revision id",
    );
  }


  console.log(
    "PASS v1 submitted and Developer waits for approval",
  );


  console.log(
    "\n--- 4. HUMAN REQUESTS CHANGES ---",
  );


  await reviewExecutionDeliverableRevision({
    tenantId,
    projectId,
    executionPlanId,

    stageId:
      developerStage.id,

    deliverableId:
      revisionV1.deliverable_id,

    deliverableRevisionId:
      revisionV1.revision_id,

    decision:
      "CHANGES_REQUESTED",

    reviewerRef:
      "orchestrator-test",

    summary:
      "Synthetic requested correction",

    requestedChanges: [
      {
        id:
          "RC-001",

        severity:
          "REQUIRED",

        target:
          "DEVELOPER_WORK_ORDER",

        description:
          "Create a corrected revision.",
      },
    ],
  });


  const afterChanges =
    await getProjectExecutionPlan(
      tenantId,
      executionPlanId,
    );


  assert(
    afterChanges.stages.find(
      stage =>
        stage.id ===
          developerStage.id,
    )?.status ===
      "READY",
    "CHANGES_REQUESTED must return Developer to READY",
  );


  assert(
    afterChanges.stages.find(
      stage =>
        stage.id ===
          qaStage.id,
    )?.status ===
      "PENDING",
    "QA must remain locked after CHANGES_REQUESTED",
  );


  console.log(
    "PASS requested changes keeps QA locked",
  );


  console.log(
    "\n--- 5. ORCHESTRATOR PASS V2 ---",
  );


  const pass2 =
    await runExecutionPlanPass(
      tenantId,
      executionPlanId,
      handlers,
    );


  assert(
    handlerRuns === 2,
    "Developer handler must run again for v2",
  );


  const planAfterPass2 =
    await getProjectExecutionPlan(
      tenantId,
      executionPlanId,
    );


  console.log(
    "PASS2 RAW:",
    JSON.stringify(
      pass2,
      null,
      2,
    ),
  );


  console.log(
    "PASS2 STAGES:",
    JSON.stringify(
      planAfterPass2.stages.map(
        stage => ({
          stageKey:
            stage.stageKey,
          status:
            stage.status,
          id:
            stage.id,
        }),
      ),
      null,
      2,
    ),
  );


  assert(
    planAfterPass2.stages.find(
      stage =>
        stage.id ===
          developerStage.id,
    )?.status ===
      "WAITING_APPROVAL",
    "Developer must wait for approval after v2",
  );


  assert(
    planAfterPass2.stages.find(
      stage =>
        stage.id ===
          qaStage.id,
    )?.status ===
      "PENDING",
    "QA must still be PENDING before v2 approval",
  );


  const revisionsAfterPass2 =
    await appDb.query<{
      deliverable_id: string;
      revision_id: string;
      version: number;
      status: string;
      revision_of_id:
        string | null;
    }>(
      `
        SELECT
          d.id::text
            AS deliverable_id,
          r.id::text
            AS revision_id,
          r.version,
          r.status,
          r.revision_of_id::text
            AS revision_of_id
        FROM app.project_execution_deliverables d
        JOIN app.project_execution_deliverable_revisions r
          ON r.deliverable_id = d.id
        WHERE d.execution_plan_id = $1
          AND d.stage_id = $2
        ORDER BY r.version ASC
      `,
      [
        executionPlanId,
        developerStage.id,
      ],
    );


  assert(
    revisionsAfterPass2.rows.length ===
      2,
    "Pass 2 must produce exactly two revisions",
  );


  const storedV1 =
    revisionsAfterPass2.rows[0];

  const revisionV2 =
    revisionsAfterPass2.rows[1];


  assert(
    storedV1.status ===
      "SUPERSEDED",
    "Revision v1 must become SUPERSEDED",
  );


  assert(
    revisionV2.version === 2 &&
    revisionV2.status ===
      "SUBMITTED",
    "Revision v2 must be SUBMITTED",
  );


  assert(
    revisionV2.revision_of_id ===
      revisionV1.revision_id,
    "Revision v2 must point to revision v1",
  );


  const outputsAfterPass2 =
    await appDb.query<{
      sequence: number;
      developer_work_order_id:
        string;
    }>(
      `
        SELECT
          sequence,
          developer_work_order_id::text
            AS developer_work_order_id
        FROM app.project_execution_stage_outputs
        WHERE execution_plan_id = $1
          AND stage_id = $2
        ORDER BY sequence ASC
      `,
      [
        executionPlanId,
        developerStage.id,
      ],
    );


  assert(
    outputsAfterPass2.rows.length === 1,
    "A stage must expose exactly one canonical output after correction",
  );


  assert(
    outputsAfterPass2.rows[0]
      .sequence === 1,
    "Canonical stage output sequence must remain 1",
  );


  assert(
    developerWorkOrderRecordIdV2,
    "Corrected DeveloperWorkOrder record id missing",
  );


  assert(
    developerWorkOrderRecordIdV2 ===
      developerWorkOrderRecordId,
    "Correction must reuse the canonical DeveloperWorkOrder DB row",
  );


  assert(
    outputsAfterPass2.rows[0]
      .developer_work_order_id ===
      developerWorkOrderRecordIdV2,
    "Canonical stage output must reference corrected DeveloperWorkOrder",
  );


  const pass2Result =
    (
      pass2 as any
    ).stageResults?.find(
      (result: any) =>
        result.stageId ===
          developerStage.id,
    ) ??
    (
      pass2 as any
    ).results?.find?.(
      (result: any) =>
        result.stageId ===
          developerStage.id,
    ) ??
    (
      Array.isArray(pass2)
        ? (pass2 as any[]).find(
            result =>
              result.stageId ===
                developerStage.id,
          )
        : undefined
    );


  if (pass2Result) {
    assert(
      pass2Result
        .reviewableDeliverable
        ?.deliverableRevisionId ===
        revisionV2.revision_id,
      "Pass 2 returned wrong reviewable revision id",
    );
  }


  console.log(
    "PASS v2 submitted and v1 superseded",
  );


  console.log(
    "\n--- 6. HUMAN APPROVES V2 ---",
  );


  await reviewExecutionDeliverableRevision({
    tenantId,
    projectId,
    executionPlanId,

    stageId:
      developerStage.id,

    deliverableId:
      revisionV2.deliverable_id,

    deliverableRevisionId:
      revisionV2.revision_id,

    decision:
      "APPROVED",

    reviewerRef:
      "orchestrator-test",

    summary:
      "Corrected revision accepted",

    requestedChanges:
      [],
  });


  const finalPlan =
    await getProjectExecutionPlan(
      tenantId,
      executionPlanId,
    );


  assert(
    finalPlan.stages.find(
      stage =>
        stage.id ===
          developerStage.id,
    )?.status ===
      "COMPLETED",
    "Approved Developer revision must complete Developer",
  );


  assert(
    finalPlan.stages.find(
      stage =>
        stage.id ===
          qaStage.id,
    )?.status ===
      "READY",
    "Approved Developer revision must unlock QA",
  );


  const reviewHistory =
    await appDb.query<{
      decision: string;
    }>(
      `
        SELECT decision
        FROM app.project_execution_reviews
        WHERE execution_plan_id = $1
          AND stage_id = $2
        ORDER BY created_at ASC
      `,
      [
        executionPlanId,
        developerStage.id,
      ],
    );


  assert(
    reviewHistory.rows.length ===
      2,
    "Expected exactly two immutable reviews",
  );


  assert(
    reviewHistory.rows[0]
      .decision ===
      "CHANGES_REQUESTED" &&
    reviewHistory.rows[1]
      .decision ===
      "APPROVED",
    "Review history must be CHANGES_REQUESTED -> APPROVED",
  );


  console.log(
    "PASS approval unlocks QA",
  );


  console.log(
    "========================================",
  );

  console.log(
    "ORCHESTRATOR DELIVERABLE REVIEW TEST: PASS",
  );

  console.log(
    "========================================",
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
