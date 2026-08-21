import {
  randomUUID,
  createHash,
} from "node:crypto";

import {
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";

import path from "node:path";

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

import {
  createProjectWorkspace,
  provisionProjectWorkspace,
} from "../src/mastra/projects/workspace-manager";

import {
  createSpecialistAgentHandler,
} from "../src/mastra/execution/specialist-agent-adapter";

import type {
  DeveloperWorkOrder,
} from "../src/mastra/projects/developer-work-order-types";


const TEST_MARKER =
  "__MASTRA_QA_RELEASE_BEHAVIOR_TEST__";

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

let workspacePath:
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
        DELETE FROM app.project_workspaces
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



async function fileSha256(
  absolutePath: string,
): Promise<string> {
  const data =
    await readFile(
      absolutePath,
    );

  return createHash(
    "sha256",
  )
    .update(
      data,
    )
    .digest(
      "hex",
    );
}


async function createQaReleaseFixture():
  Promise<void> {
  assert(
    projectId,
    "projectId missing",
  );


  const workspace =
    await createProjectWorkspace({
      projectId,
    });


  workspacePath =
    workspace.workspacePath;


  const ready =
    await provisionProjectWorkspace(
      projectId,
    );


  assert(
    ready.status ===
      "READY",
    `Expected workspace READY, got ${ready.status}`,
  );


  const root =
    path.join(
      workspacePath,
      "artifacts",
      "qa-handoff-test",
    );


  const routeRoot =
    path.join(
      workspacePath,
      "src",
      "app",
      "api",
      "couriers",
      "geniki",
      "shipments",
    );


  await mkdir(
    path.join(root, "softone"),
    { recursive: true },
  );

  await mkdir(
    path.join(root, "api"),
    { recursive: true },
  );

  await mkdir(
    path.join(root, "mappings"),
    { recursive: true },
  );

  await mkdir(
    path.join(root, "documentation"),
    { recursive: true },
  );

  await mkdir(
    path.join(root, "qa"),
    { recursive: true },
  );

  await mkdir(
    routeRoot,
    { recursive: true },
  );


  await writeFile(
    path.join(
      routeRoot,
      "route.ts",
    ),
    `
export async function POST(request: Request) {
  const body = await request.json();

  const canonicalRequest = {
    customerCode: body.customerCode,
    allowReturn: true,
  };

  return Response.json({
    shipmentId: "fixture-001",
    request: canonicalRequest,
  });
}
`.trim() + "\n",
    "utf8",
  );


  await writeFile(
    path.join(
      root,
      "softone",
      "create-shipment.js",
    ),
    `
function ON_CREATE_SHIPMENT() {
  var payload = {
    customerCode: X.SYS.USER,
    allowReturn: true
  };

  return payload;
}
`.trim() + "\n",
    "utf8",
  );


  await writeFile(
    path.join(
      root,
      "softone",
      "INSTALLATION.md",
    ),
    `
# SoftOne Installation

Install manually by an authorized SoftOne administrator.

Live installation and execution remain outside automated QA authority.
`.trim() + "\n",
    "utf8",
  );


  await writeFile(
    path.join(
      root,
      "softone",
      "README.md",
    ),
    `
# SoftOne Integration

Canonical field:

- allowReturn
`.trim() + "\n",
    "utf8",
  );


  await writeFile(
    path.join(
      root,
      "api",
      "openapi.yaml",
    ),
    `
openapi: 3.0.3

info:
  title: QA Fixture API
  version: 1.0.0

paths:
  /api/couriers/geniki/shipments:
    post:
      operationId: createShipment
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - customerCode
                - allowReturn
              properties:
                customerCode:
                  type: string
                allowReturn:
                  type: boolean
      responses:
        '200':
          description: Shipment created

  /api/couriers/geniki/shipments/{id}/cancel:
    post:
      operationId: cancelShipment
      parameters:
        - in: path
          name: id
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Shipment cancelled
`.trim() + "\n",
    "utf8",
  );


  /*
   * INTENTIONAL CONTRACT DEFECT:
   * Postman says /void.
   * OpenAPI says /cancel.
   */
  await writeFile(
    path.join(
      root,
      "api",
      "postman_collection.json",
    ),
    JSON.stringify(
      {
        info: {
          name:
            "QA Fixture",

          schema:
            "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
        },

        item: [
          {
            name:
              "Create shipment",

            request: {
              method:
                "POST",

              url: {
                raw:
                  "{{baseUrl}}/api/couriers/geniki/shipments",
              },

              body: {
                mode:
                  "raw",

                raw:
                  JSON.stringify({
                    customerCode:
                      "TEST",

                    allowReturn:
                      true,
                  }),
              },
            },
          },

          {
            name:
              "Cancel shipment",

            request: {
              method:
                "POST",

              url: {
                raw:
                  "{{baseUrl}}/api/couriers/geniki/shipments/fixture-001/void",
              },
            },
          },
        ],
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );


  await writeFile(
    path.join(
      root,
      "mappings",
      "softone-to-canonical.json",
    ),
    JSON.stringify(
      {
        mappings: [
          {
            source:
              "SoftOne.payload.allowReturn",

            target:
              "canonical.allowReturn",

            evidence:
              "VERIFIED",
          },
        ],
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );


  await writeFile(
    path.join(
      root,
      "mappings",
      "external-client-to-canonical.md",
    ),
    `
# External Client Mapping

\`allowReturn\`
maps to
\`canonical.allowReturn\`.
`.trim() + "\n",
    "utf8",
  );


  /*
   * INTENTIONAL DOCUMENTATION DEFECT:
   * alertReturn should be allowReturn.
   */
  await writeFile(
    path.join(
      root,
      "documentation",
      "API.md",
    ),
    `
# API

## Create shipment

POST /api/couriers/geniki/shipments

Request fields:

- customerCode
- alertReturn

## Cancel shipment

POST /api/couriers/geniki/shipments/{id}/cancel
`.trim() + "\n",
    "utf8",
  );


  await writeFile(
    path.join(
      root,
      "documentation",
      "INTEGRATION-GUIDE.md",
    ),
    `
# Integration Guide

The canonical shipment request uses \`allowReturn\`.

OpenAPI is the canonical API contract.
`.trim() + "\n",
    "utf8",
  );


  await writeFile(
    path.join(
      root,
      "documentation",
      "THIRD-PARTY-DEVELOPER-GUIDE.md",
    ),
    `
# Third Party Developer Guide

Create shipment:

POST /api/couriers/geniki/shipments

Cancel shipment:

POST /api/couriers/geniki/shipments/{id}/cancel
`.trim() + "\n",
    "utf8",
  );


  await writeFile(
    path.join(
      root,
      "documentation",
      "SOFTONE-INTEGRATION.md",
    ),
    `
# SoftOne Integration

Advanced JavaScript installation is manual.

Canonical field:

\`allowReturn\`
`.trim() + "\n",
    "utf8",
  );


  await writeFile(
    path.join(
      root,
      "qa",
      "handoff.json",
    ),
    JSON.stringify(
      {
        collectionName:
          "qa-handoff-test",

        readyForQa:
          true,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );


  await writeFile(
    path.join(
      root,
      "qa",
      "test-matrix.md",
    ),
    `
# Test Matrix

- implementation/OpenAPI
- OpenAPI/Postman
- documentation/implementation
- SoftOne mapping
- manual SoftOne admin validation
`.trim() + "\n",
    "utf8",
  );


  console.log(
    "PASS synthetic QA release package created",
  );
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
    "\n--- 6. CREATE SYNTHETIC RELEASE PACKAGE ---",
  );


  await createQaReleaseFixture();


  assert(
    workspacePath,
    "workspacePath missing after fixture creation",
  );


  const artifactRoot =
    path.join(
      workspacePath,
      "artifacts",
      "qa-handoff-test",
    );


  const protectedPaths = {
    openApi:
      path.join(
        artifactRoot,
        "api",
        "openapi.yaml",
      ),

    postman:
      path.join(
        artifactRoot,
        "api",
        "postman_collection.json",
      ),

    softOne:
      path.join(
        artifactRoot,
        "softone",
        "create-shipment.js",
      ),
  };


  const beforeHashes = {
    openApi:
      await fileSha256(
        protectedPaths.openApi,
      ),

    postman:
      await fileSha256(
        protectedPaths.postman,
      ),

    softOne:
      await fileSha256(
        protectedPaths.softOne,
      ),
  };


  console.log(
    "PASS protected artifact hashes captured",
  );


  console.log(
    "\n--- 7. RUN REAL QUALITY_ASSURANCE HANDLER ---",
  );


  const qaHandler =
    createSpecialistAgentHandler(
      "QUALITY_ASSURANCE",
      "QA_REPORT",
    );


  const qaExecutionResult =
    await qaHandler({
      tenantId,

      executionPlanId,

      projectId,

      projectDefinitionId:
        projectDefinitionRecordId,

      projectDefinitionVersion:
        1,

      stage:
        qaAfterDeveloper,

      upstreamOutputs:
        upstream,
    });


  const qaExecutionResults =
    Array.isArray(
      qaExecutionResult,
    )
      ? qaExecutionResult
      : [
          qaExecutionResult,
        ];


  const qaArtifactResult =
    qaExecutionResults.find(
      result =>
        result.kind ===
          "SPECIALIST_ARTIFACT",
    );


  assert(
    qaArtifactResult &&
      qaArtifactResult.kind ===
        "SPECIALIST_ARTIFACT",
    "QA handler did not return a SPECIALIST_ARTIFACT",
  );


  console.log(
    "qaArtifactId:",
    qaArtifactResult
      .specialistArtifactId,
  );


  console.log(
    "PASS real QA specialist handler completed",
  );


  console.log(
    "\n--- 8. VERIFY QA FILE OUTPUTS ---",
  );


  const qaReportPath =
    path.join(
      artifactRoot,
      "qa",
      "QA-REPORT.md",
    );


  const testResultsPath =
    path.join(
      artifactRoot,
      "qa",
      "test-results.json",
    );


  const qaReport =
    await readFile(
      qaReportPath,
      "utf8",
    );


  const testResultsRaw =
    await readFile(
      testResultsPath,
      "utf8",
    );


  assert(
    qaReport.trim().length >
      0,
    "QA-REPORT.md was not created or is empty",
  );


  assert(
    testResultsRaw.trim().length >
      0,
    "test-results.json was not created or is empty",
  );


  let testResults:
    unknown;


  try {
    testResults =
      JSON.parse(
        testResultsRaw,
      );
  }
  catch {
    throw new Error(
      "test-results.json is not valid JSON",
    );
  }


  assert(
    typeof testResults ===
      "object" &&
      testResults !==
        null,
    "test-results.json must contain a JSON object",
  );


  console.log(
    "PASS QA-REPORT.md created",
  );

  console.log(
    "PASS test-results.json created and valid JSON",
  );


  console.log(
    "\n--- 9. VERIFY INTENTIONAL CONTRACT DEFECT DETECTED ---",
  );


  const combinedQaEvidence =
    [
      qaReport,
      testResultsRaw,
    ].join(
      "\n",
    );


  assert(
    combinedQaEvidence.includes(
      "FAIL",
    ),
    "QA did not record FAIL for the intentional contract mismatch",
  );


  assert(
    (
      combinedQaEvidence.includes(
        "/void",
      ) &&
      combinedQaEvidence.includes(
        "/cancel",
      )
    ) ||
      combinedQaEvidence
        .toLowerCase()
        .includes(
          "postman",
        ),
    "QA did not report the OpenAPI/Postman mismatch",
  );


  console.log(
    "PASS OpenAPI/Postman mismatch detected",
  );


  console.log(
    "\n--- 10. VERIFY MANUAL SOFTONE VALIDATION ---",
  );


  assert(
    combinedQaEvidence.includes(
      "PENDING_ADMIN_TEST",
    ),
    "QA did not preserve PENDING_ADMIN_TEST for SoftOne live validation",
  );


  console.log(
    "PASS SoftOne manual validation preserved",
  );


  console.log(
    "\n--- 11. VERIFY EVIDENCE-BACKED DOCUMENTATION CORRECTION ---",
  );


  const apiDocumentationPath =
    path.join(
      artifactRoot,
      "documentation",
      "API.md",
    );


  const apiDocumentation =
    await readFile(
      apiDocumentationPath,
      "utf8",
    );


  assert(
    apiDocumentation.includes(
      "allowReturn",
    ),
    "QA did not correct API documentation to allowReturn",
  );


  assert(
    !apiDocumentation.includes(
      "alertReturn",
    ),
    "Incorrect alertReturn remains in API documentation",
  );


  console.log(
    "PASS documentation corrected from implementation evidence",
  );


  console.log(
    "\n--- 12. VERIFY PROTECTED ARTIFACTS IMMUTABLE ---",
  );


  const afterHashes = {
    openApi:
      await fileSha256(
        protectedPaths.openApi,
      ),

    postman:
      await fileSha256(
        protectedPaths.postman,
      ),

    softOne:
      await fileSha256(
        protectedPaths.softOne,
      ),
  };


  assert(
    beforeHashes.openApi ===
      afterHashes.openApi,
    "QA illegally modified OpenAPI",
  );


  assert(
    beforeHashes.postman ===
      afterHashes.postman,
    "QA illegally modified Postman",
  );


  assert(
    beforeHashes.softOne ===
      afterHashes.softOne,
    "QA illegally modified SoftOne Advanced JavaScript",
  );


  console.log(
    "PASS OpenAPI unchanged",
  );

  console.log(
    "PASS Postman unchanged",
  );

  console.log(
    "PASS SoftOne JS unchanged",
  );


  console.log(
    "\n========================================",
  );

  console.log(
    "QA RELEASE BEHAVIOR TEST: PASS",
  );

  console.log(
    "========================================",
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

        if (
          workspacePath
        ) {
          await rm(
            workspacePath,
            {
              recursive:
                true,

              force:
                true,
            },
          );
        }
      }
      finally {
        await appDb.end();
      }
    },
  );
