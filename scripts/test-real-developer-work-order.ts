import {
  randomUUID,
} from "node:crypto";

import {
  readdir,
  rm,
} from "node:fs/promises";

import {
  appDb,
} from "../src/mastra/db/postgres";

import {
  createProject,
  createProjectWorkspace,
  provisionProjectWorkspace,
} from "../src/mastra/projects";

import {
  createProjectDefinition,
  loadDeveloperExecutionContext,
} from "../src/mastra/projects/developer-contract-manager";

import type {
  ProjectDefinitionPackage,
} from "../src/mastra/projects/project-definition-types";

import {
  SOFTONE_CAPABILITY,
} from "../src/mastra/projects/softone-access-policy";

import {
  createProjectExecutionPlan,
  getProjectExecutionPlan,
} from "../src/mastra/execution";

import {
  developerAgentHandler,
} from "../src/mastra/execution/developer-agent-adapter";


const TEST_MARKER =
  "__MASTRA_REAL_DEVELOPER_WORK_ORDER_TEST__";

const suffix =
  Date.now()
    .toString();


let tenantId:
  string | undefined;

let tenantCode:
  string | undefined;

let projectId:
  string | undefined;

let workspacePath:
  string | undefined;

let projectDefinitionRecordId:
  string | undefined;

let projectDefinitionPackageId:
  string | undefined;

let executionPlanId:
  string | undefined;

let developerWorkOrderId:
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
  Promise<{
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
          to_jsonb(t)->>'code'
            AS code
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


  if (
    !row.code?.trim()
  ) {
    throw new Error(
      "Active tenant has no tenant code",
    );
  }


  return {
    id:
      row.id,

    code:
      row.code.trim(),
  };
}


async function createFixtures():
  Promise<void> {
  console.log(
    "\n--- CREATE FIXTURES ---",
  );


  const tenant =
    await getActiveTenant();


  tenantId =
    tenant.id;

  tenantCode =
    tenant.code;


  const project =
    await createProject({
      tenantId,

      code:
        `DEVWO-${suffix}`,

      name:
        `${TEST_MARKER} ${suffix}`,

      description:
        "Disposable real DeveloperWorkOrder production smoke test",

      status:
        "ACTIVE",
    });


  projectId =
    project.id;


  const workspace =
    await createProjectWorkspace({
      projectId,
    });


  workspacePath =
    workspace.workspacePath;


  /*
   * Creates only the canonical empty project directory.
   *
   * NO Git clone.
   * NO project file generation.
   * NO Developer write tool.
   */
  const readyWorkspace =
    await provisionProjectWorkspace(
      projectId,
    );


  assert(
    readyWorkspace.status ===
      "READY",
    `Expected workspace READY, got ${readyWorkspace.status}`,
  );


  const now =
    new Date()
      .toISOString();


  const definition:
    ProjectDefinitionPackage = {
    id:
      randomUUID(),

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
          "REQ-SOFTONE-WS-001",

        statement:
          "Implement an application-side SoftOne integration contract using SoftOne Web Services only.",

        status:
          "VERIFIED",

        acceptanceCriteria: [
          "SoftOne reads use Web Services.",
          "SoftOne upserts use Web Services.",
          "No direct SoftOne database connection is implemented.",
          "SQL Scripts require administrator testing and installation before Web Services invocation.",
          "Advanced JavaScript requires administrator installation before Web Services invocation.",
        ],

        sourceIds: [
          TEST_MARKER,
        ],

        requiredForDevelopment:
          true,
      },
    ],

    knowledgeReferences:
      [],

    structuredSqlPlans:
      [],

    integrationRequirements: [
      {
        id:
          "INT-SOFTONE-001",

        providerCode:
          "SOFTONE",

        environment:
          "PRODUCTION",

        purpose:
          "Application integration with SoftOne exclusively through Web Services",

        requiredCapabilities: [
          SOFTONE_CAPABILITY
            .WEB_SERVICES_READ,

          SOFTONE_CAPABILITY
            .WEB_SERVICES_UPSERT,

          SOFTONE_CAPABILITY
            .SQL_SCRIPT_GENERATION,

          SOFTONE_CAPABILITY
            .ADVANCED_JAVASCRIPT_GENERATION,
        ],

        requiredForDevelopment:
          true,

        bindingRequired:
          true,
      },
    ],

    unresolved:
      [],

    blockers:
      [],

    provenance:
      [],

    createdAt:
      now,

    updatedAt:
      now,
  };


  projectDefinitionPackageId =
    definition.id;


  const persistedDefinition =
    await createProjectDefinition(
      definition,
    );


  projectDefinitionRecordId =
    persistedDefinition.recordId;


  const plan =
    await createProjectExecutionPlan({
      tenantId,

      projectId,

      /*
       * ExecutionPlan binds to the persisted
       * app.project_definitions record UUID.
       */
      projectDefinitionId:
        persistedDefinition.recordId,

      projectDefinitionVersion:
        1,

      stages: [
        {
          stageKey:
            "developer-softone",

          agentRole:
            "DEVELOPER",

          executionKind:
            "DEVELOPER_WORK_ORDER",

          approvalRequired:
            false,

          configuration: {
            /*
             * Application-owned authorization.
             *
             * The Developer model must NOT be able
             * to change this scope.
             */
            allowedScopePaths: [
              "src",
            ],

            taskType:
              "SOFTONE_INTEGRATION",

            objective:
              "Prepare a DeveloperWorkOrder for the approved SoftOne Web Services integration. Do not implement files or execute any integration.",
          },
        },
      ],
    });


  executionPlanId =
    plan.id;


  console.log(
    JSON.stringify(
      {
        tenantId,
        tenantCode,
        projectId,
        workspacePath,
        projectDefinitionPackageId,
        projectDefinitionRecordId,
        executionPlanId,
      },
      null,
      2,
    ),
  );
}


async function runSmoke():
  Promise<void> {
  assert(
    tenantId &&
    tenantCode &&
    projectId &&
    workspacePath &&
    projectDefinitionRecordId &&
    projectDefinitionPackageId &&
    executionPlanId,
    "Fixture creation incomplete",
  );


  console.log(
    "\n--- VERIFY EMPTY WORKSPACE BEFORE DEVELOPER ---",
  );


  const filesBefore =
    (
      await readdir(
        workspacePath,
      )
    ).sort();


  assert(
    filesBefore.length ===
      0,
    [
      "Disposable Developer workspace must start empty.",
      `Found=${JSON.stringify(filesBefore)}`,
    ].join(" "),
  );


  console.log(
    "workspace files before:",
    filesBefore,
  );


  const plan =
    await getProjectExecutionPlan(
      tenantId,
      executionPlanId,
    );


  const stage =
    plan.stages.find(
      candidate =>
        candidate.stageKey ===
        "developer-softone",
    );


  assert(
    stage,
    "Developer execution stage not found",
  );


  assert(
    stage.agentRole ===
      "DEVELOPER",
    `Unexpected role=${stage.agentRole}`,
  );


  assert(
    stage.executionKind ===
      "DEVELOPER_WORK_ORDER",
    `Unexpected executionKind=${stage.executionKind}`,
  );


  console.log(
    "\n--- REAL DEVELOPER PROPOSAL ---",
  );


  /*
   * REAL production Developer adapter.
   *
   * Proposal generation is currently:
   *
   *   toolChoice = none
   *   maxSteps    = 1
   *
   * Therefore this call may generate only the
   * proposal from which the application constructs
   * the authoritative DeveloperWorkOrder.
   */
  const result =
    await developerAgentHandler({
      tenantId,

      executionPlanId,

      projectId,

      projectDefinitionId:
        projectDefinitionRecordId,

      projectDefinitionVersion:
        1,

      stage,

      upstreamOutputs:
        [],
    });


  assert(
    result.kind ===
      "DEVELOPER_WORK_ORDER",
    `Unexpected Developer result kind=${result.kind}`,
  );


  developerWorkOrderId =
    result.developerWorkOrderId;


  assert(
    developerWorkOrderId,
    "Developer handler did not return developerWorkOrderId",
  );


  console.log(
    "developerWorkOrderId:",
    developerWorkOrderId,
  );


  const context =
    await loadDeveloperExecutionContext(
      developerWorkOrderId,
    );


  const workOrder =
    context.workOrder;


  console.log(
    "\n--- EXACT PROJECT DEFINITION BINDING ---",
  );


  assert(
    workOrder.projectId ===
      projectId,
    "WorkOrder projectId mismatch",
  );


  assert(
    workOrder.projectDefinitionId ===
      projectDefinitionPackageId,
    [
      "WorkOrder must reference ProjectDefinitionPackage.id.",
      `expected=${projectDefinitionPackageId}`,
      `actual=${workOrder.projectDefinitionId}`,
    ].join(" "),
  );


  assert(
    workOrder.projectDefinitionVersion ===
      1,
    "WorkOrder ProjectDefinition version mismatch",
  );


  assert(
    context.projectDefinitionRecordId ===
      projectDefinitionRecordId,
    [
      "Persisted ProjectDefinition record binding mismatch.",
      `expected=${projectDefinitionRecordId}`,
      `actual=${context.projectDefinitionRecordId}`,
    ].join(" "),
  );


  assert(
    context.projectDefinition.id ===
      projectDefinitionPackageId,
    "Re-read ProjectDefinitionPackage identity mismatch",
  );


  console.log(
    "PASS exact definition record/package/version binding",
  );


  console.log(
    "\n--- WORK ORDER AUTHORITY ---",
  );


  assert(
    workOrder.status ===
      "READY",
    `Expected WorkOrder READY, got ${workOrder.status}`,
  );


  assert(
    workOrder.taskId ===
      stage.id,
    [
      "WorkOrder taskId must be execution stage UUID.",
      `expected=${stage.id}`,
      `actual=${workOrder.taskId}`,
    ].join(" "),
  );


  /*
   * Critical:
   *
   * This exact scope was declared by the
   * ExecutionPlan. It did NOT come from the LLM.
   */
  assert(
    JSON.stringify(
      workOrder.allowedScope.paths,
    ) ===
    JSON.stringify([
      "src",
    ]),
    [
      "Developer filesystem scope mismatch.",
      `actual=${JSON.stringify(workOrder.allowedScope.paths)}`,
    ].join(" "),
  );


  assert(
    workOrder.allowedScope.allowCreate ===
      true,
    "allowCreate must be true",
  );


  assert(
    workOrder.allowedScope.allowModify ===
      true,
    "allowModify must be true",
  );


  assert(
    workOrder.allowedScope.allowDelete ===
      false,
    "allowDelete must remain false",
  );


  console.log(
    "PASS application-owned filesystem scope",
  );


  const policy =
    workOrder.executionPolicy;


  console.log(
    "\n--- DEVELOPER EXECUTION POLICY ---",
  );


  assert(
    policy.workspaceResolvedByProjectId ===
      true,
    "workspaceResolvedByProjectId invariant failed",
  );


  assert(
    policy.arbitraryWorkspacePathAllowed ===
      false,
    "arbitraryWorkspacePathAllowed invariant failed",
  );


  assert(
    policy.shellExecutionAllowed ===
      false,
    "Developer shell execution must be false",
  );


  assert(
    policy.networkAccessAllowed ===
      false,
    "Developer live network access must be false",
  );


  assert(
    policy.gitCommitAllowed ===
      false,
    "Developer gitCommitAllowed must be false",
  );


  assert(
    policy.gitPushAllowed ===
      false,
    "Developer gitPushAllowed must be false",
  );


  console.log(
    "PASS Developer execution restrictions",
  );


  const softOne =
    policy.softOneAccessPolicy;


  console.log(
    "\n--- SOFTONE ACCESS POLICY ---",
  );


  assert(
    softOne.transport ===
      "WEB_SERVICES_ONLY",
    `Unexpected SoftOne transport=${softOne.transport}`,
  );


  assert(
    softOne.directDatabaseAccess ===
      "UNAVAILABLE",
    `Unexpected directDatabaseAccess=${softOne.directDatabaseAccess}`,
  );


  assert(
    softOne.dataExplorerExecution ===
      "ADMIN_MANUAL_ONLY",
    `Unexpected dataExplorerExecution=${softOne.dataExplorerExecution}`,
  );


  assert(
    softOne.webServicesReadAllowed ===
      true,
    "WEB_SERVICES_READ capability not propagated",
  );


  assert(
    softOne.webServicesUpsertAllowed ===
      true,
    "WEB_SERVICES_UPSERT capability not propagated",
  );


  assert(
    softOne.sqlScriptGenerationAllowed ===
      true,
    "SQL_SCRIPT_GENERATION capability not propagated",
  );


  assert(
    softOne.sqlScriptInstallation ===
      "ADMIN_MANUAL_ONLY",
    "SQL Script installation must be ADMIN_MANUAL_ONLY",
  );


  assert(
    softOne.sqlScriptInvocation ===
      "WEB_SERVICES_ONLY",
    "SQL Script invocation must be WEB_SERVICES_ONLY",
  );


  assert(
    softOne.advancedJavaScriptGenerationAllowed ===
      true,
    "ADVANCED_JAVASCRIPT_GENERATION capability not propagated",
  );


  assert(
    softOne.advancedJavaScriptInstallation ===
      "ADMIN_MANUAL_ONLY",
    "Advanced JavaScript installation must be ADMIN_MANUAL_ONLY",
  );


  assert(
    softOne.advancedJavaScriptInvocation ===
      "WEB_SERVICES_ONLY",
    "Advanced JavaScript invocation must be WEB_SERVICES_ONLY",
  );


  console.log(
    "PASS SoftOne Web-Services-only policy",
  );


  console.log(
    "\n--- VERIFY ZERO FILESYSTEM IMPLEMENTATION ---",
  );


  const filesAfter =
    (
      await readdir(
        workspacePath,
      )
    ).sort();


  assert(
    JSON.stringify(
      filesAfter,
    ) ===
    JSON.stringify(
      filesBefore,
    ),
    [
      "Developer proposal modified project filesystem.",
      `before=${JSON.stringify(filesBefore)}`,
      `after=${JSON.stringify(filesAfter)}`,
    ].join(" "),
  );


  console.log(
    "PASS zero Developer filesystem writes",
  );


  console.log(
    "\n--- RESULT ---",
  );


  console.log(
    JSON.stringify(
      {
        workOrderId:
          developerWorkOrderId,

        taskType:
          workOrder.taskType,

        objective:
          workOrder.objective,

        acceptanceCriteria:
          workOrder.acceptanceCriteria,

        allowedScope:
          workOrder.allowedScope,

        executionPolicy: {
          workspaceResolvedByProjectId:
            policy.workspaceResolvedByProjectId,

          arbitraryWorkspacePathAllowed:
            policy.arbitraryWorkspacePathAllowed,

          shellExecutionAllowed:
            policy.shellExecutionAllowed,

          networkAccessAllowed:
            policy.networkAccessAllowed,

          gitCommitAllowed:
            policy.gitCommitAllowed,

          gitPushAllowed:
            policy.gitPushAllowed,

          softOneAccessPolicy:
            softOne,
        },

        filesystemBefore:
          filesBefore,

        filesystemAfter:
          filesAfter,

        filesystemChanged:
          false,
      },
      null,
      2,
    ),
  );


  console.log(
    "\nREAL DEVELOPER WORK ORDER: PASS",
  );
}


async function cleanup():
  Promise<void> {
  console.log(
    "\n--- CLEANUP ---",
  );


  /*
   * Remove disposable canonical workspace.
   */
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


  if (
    !projectId
  ) {
    console.log(
      "No project fixture to clean.",
    );

    return;
  }


  const client =
    await appDb.connect();


  try {
    await client.query(
      "BEGIN",
    );


    /*
     * DeveloperWorkOrder has an exact FK to
     * ProjectDefinition record/project/version,
     * therefore delete it first.
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


    /*
     * ExecutionPlan children are expected to
     * cascade with the plan.
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
        DELETE FROM app.project_workspaces
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
  }
  catch (
    error
  ) {
    await client.query(
      "ROLLBACK",
    );

    throw error;
  }
  finally {
    client.release();
  }


  console.log(
    "Cleanup completed.",
  );
}


async function main():
  Promise<void> {
  try {
    await createFixtures();

    await runSmoke();
  }
  finally {
    await cleanup();
  }
}


main()
  .catch(
    error => {
      console.error(
        "\nREAL DEVELOPER WORK ORDER: FAIL",
      );

      console.error(
        error,
      );

      process.exitCode =
        1;
    },
  );
