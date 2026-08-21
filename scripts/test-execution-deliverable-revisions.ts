import {
  randomUUID,
} from "node:crypto";

import {
  appDb,
} from "../src/mastra/db/postgres";

import {
  createProjectExecutionPlan,
  finishExecutionStage,
  getProjectExecutionPlan,
  startExecutionStage,
  createExecutionDeliverableRevision,
  submitExecutionDeliverableRevisionForReview,
  reviewExecutionDeliverableRevision,
  getLatestExecutionDeliverableRevision,
} from "../src/mastra/execution";


const TEST_MARKER =
  "__EXECUTION_DELIVERABLE_REVISION_TEST__";

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
    throw new Error(
      message,
    );
  }
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


async function cleanup(): Promise<void> {
  if (planId) {
    await appDb.query(
      `
        DELETE FROM app.project_execution_reviews
        WHERE execution_plan_id = $1
      `,
      [
        planId,
      ],
    );


    await appDb.query(
      `
        DELETE FROM app.project_execution_deliverables
        WHERE execution_plan_id = $1
      `,
      [
        planId,
      ],
    );


    await appDb.query(
      `
        DELETE FROM app.project_execution_plans
        WHERE id = $1
      `,
      [
        planId,
      ],
    );
  }


  if (
    projectDefinitionId
  ) {
    await appDb.query(
      `
        DELETE FROM app.project_definitions
        WHERE id = $1
      `,
      [
        projectDefinitionId,
      ],
    );
  }


  if (projectId) {
    await appDb.query(
      `
        DELETE FROM app.projects
        WHERE id = $1
      `,
      [
        projectId,
      ],
    );
  }
}


async function main(): Promise<void> {
  console.log(
    "--- CREATE FIXTURES ---",
  );


  tenantId =
    await getActiveTenant();


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
        `REV-${suffix}`,
        `${TEST_MARKER} Project`,
        "Disposable execution deliverable revision test",
      ],
    );


  projectId =
    projectResult.rows[0].id;


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
      }),
    ],
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
            "producer",

          agentRole:
            "DEVELOPER",

          executionKind:
            "DEVELOPER_WORK_ORDER",

          approvalRequired:
            true,
        },
        {
          stageKey:
            "downstream",

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
            "downstream",

          dependsOnStageKey:
            "producer",
        },
      ],
    });


  planId =
    plan.id;


  const producer =
    plan.stages.find(
      stage =>
        stage.stageKey ===
          "producer",
    );


  const downstream =
    plan.stages.find(
      stage =>
        stage.stageKey ===
          "downstream",
    );


  assert(
    producer,
    "producer stage missing",
  );

  assert(
    downstream,
    "downstream stage missing",
  );

  assert(
    producer.status ===
      "READY",
    "producer must initially be READY",
  );

  assert(
    downstream.status ===
      "PENDING",
    "downstream must initially be PENDING",
  );


  console.log(
    "--- 1. START PRODUCER ---",
  );


  await startExecutionStage(
    tenantId,
    planId,
    producer.id,
  );


  console.log(
    "--- 2. CREATE REVISION V1 ---",
  );


  const v1 =
    await createExecutionDeliverableRevision({
      tenantId,
      projectId,
      executionPlanId:
        planId,
      stageId:
        producer.id,

      agentRole:
        "DEVELOPER",

      deliverableType:
        "TEST_DELIVERABLE",

      contentSnapshot: {
        marker:
          TEST_MARKER,

        message:
          "version 1",
      },
    });


  assert(
    v1.revision.version ===
      1,
    "v1 must have version=1",
  );

  assert(
    v1.revision.status ===
      "DRAFT",
    "v1 must initially be DRAFT",
  );


  console.log(
    "PASS v1 created",
  );


  console.log(
    "--- 3. SUBMIT V1 ---",
  );


  const submittedV1 =
    await submitExecutionDeliverableRevisionForReview(
      tenantId,
      planId,
      producer.id,
      v1.revision.id,
    );


  assert(
    submittedV1.status ===
      "SUBMITTED",
    "v1 must become SUBMITTED",
  );


  const firstFinish =
    await finishExecutionStage(
      tenantId,
      planId,
      producer.id,
    );


  assert(
    firstFinish.stage.status ===
      "WAITING_APPROVAL",
    "producer must enter WAITING_APPROVAL",
  );


  console.log(
    "PASS v1 waiting approval",
  );


  console.log(
    "--- 4. REQUEST CHANGES ---",
  );


  const changes =
    await reviewExecutionDeliverableRevision({
      tenantId,
      executionPlanId:
        planId,
      stageId:
        producer.id,

      deliverableRevisionId:
        v1.revision.id,

      reviewerRef:
        "integration-test-reviewer",

      decision:
        "CHANGES_REQUESTED",

      summary:
        "Version 1 requires correction",

      requestedChanges: [
        {
          id:
            "RC-001",

          severity:
            "REQUIRED",

          target:
            "implementation",

          description:
            "Correct the deliverable for version 2",
        },
      ],
    });


  assert(
    changes.revision.status ===
      "CHANGES_REQUESTED",
    "v1 must become CHANGES_REQUESTED",
  );

  assert(
    changes.stageStatus ===
      "READY",
    "producer must return to READY",
  );

  assert(
    changes.unlockedStageKeys.length ===
      0,
    "REQUEST_CHANGES must not unlock downstream",
  );


  let current =
    await getProjectExecutionPlan(
      tenantId,
      planId,
    );


  let currentDownstream =
    current.stages.find(
      stage =>
        stage.stageKey ===
          "downstream",
    );


  assert(
    currentDownstream?.status ===
      "PENDING",
    "downstream must remain PENDING after REQUEST_CHANGES",
  );


  console.log(
    "PASS requested changes keeps downstream locked",
  );


  console.log(
    "--- 5. START REVISION RUN ---",
  );


  await startExecutionStage(
    tenantId,
    planId,
    producer.id,
  );


  console.log(
    "--- 6. CREATE REVISION V2 ---",
  );


  const v2 =
    await createExecutionDeliverableRevision({
      tenantId,
      projectId,
      executionPlanId:
        planId,
      stageId:
        producer.id,

      agentRole:
        "DEVELOPER",

      deliverableType:
        "TEST_DELIVERABLE",

      revisionOfId:
        v1.revision.id,

      contentSnapshot: {
        marker:
          TEST_MARKER,

        message:
          "version 2",
      },

      changeResolution: [
        {
          requestedChangeId:
            "RC-001",

          status:
            "RESOLVED",

          evidence: [
            "TEST_DELIVERABLE:v2",
          ],
        },
      ],
    });


  assert(
    v2.revision.version ===
      2,
    "v2 must have version=2",
  );

  assert(
    v2.revision.revisionOfId ===
      v1.revision.id,
    "v2 must reference v1",
  );


  const latestAfterV2 =
    await getLatestExecutionDeliverableRevision(
      producer.id,
      "TEST_DELIVERABLE",
    );


  assert(
    latestAfterV2?.id ===
      v2.revision.id,
    "latest revision must be v2",
  );


  const oldRevision =
    await appDb.query<{
      status: string;
    }>(
      `
        SELECT status
        FROM app.project_execution_deliverable_revisions
        WHERE id = $1
      `,
      [
        v1.revision.id,
      ],
    );


  assert(
    oldRevision.rows[0]?.status ===
      "SUPERSEDED",
    "v1 must become SUPERSEDED after successful v2 creation",
  );


  console.log(
    "PASS v2 created and v1 superseded",
  );


  console.log(
    "--- 7. SUBMIT V2 ---",
  );


  await submitExecutionDeliverableRevisionForReview(
    tenantId,
    planId,
    producer.id,
    v2.revision.id,
  );


  const secondFinish =
    await finishExecutionStage(
      tenantId,
      planId,
      producer.id,
    );


  assert(
    secondFinish.stage.status ===
      "WAITING_APPROVAL",
    "producer must wait for approval again",
  );


  console.log(
    "--- 8. APPROVE V2 ---",
  );


  const approval =
    await reviewExecutionDeliverableRevision({
      tenantId,
      executionPlanId:
        planId,
      stageId:
        producer.id,

      deliverableRevisionId:
        v2.revision.id,

      reviewerRef:
        "integration-test-reviewer",

      decision:
        "APPROVED",

      summary:
        "Revision 2 accepted",
    });


  assert(
    approval.revision.status ===
      "APPROVED",
    "v2 must become APPROVED",
  );

  assert(
    approval.stageStatus ===
      "COMPLETED",
    "producer must become COMPLETED",
  );

  assert(
    approval.unlockedStageKeys.includes(
      "downstream",
    ),
    "approval must unlock downstream",
  );


  current =
    await getProjectExecutionPlan(
      tenantId,
      planId,
    );


  currentDownstream =
    current.stages.find(
      stage =>
        stage.stageKey ===
          "downstream",
    );


  assert(
    currentDownstream?.status ===
      "READY",
    "downstream must become READY after approval",
  );


  console.log(
    "PASS v2 approval unlocks downstream",
  );


  console.log(
    "--- 9. VERIFY REVIEW HISTORY ---",
  );


  const reviewHistory =
    await appDb.query<{
      decision: string;
      requested_changes: unknown;
    }>(
      `
        SELECT
          decision,
          requested_changes
        FROM app.project_execution_reviews
        WHERE deliverable_id = $1
        ORDER BY created_at ASC
      `,
      [
        v1.deliverable.id,
      ],
    );


  assert(
    reviewHistory.rows.length ===
      2,
    "expected exactly two review records",
  );

  assert(
    reviewHistory.rows[0]
      .decision ===
      "CHANGES_REQUESTED",
    "first review must request changes",
  );

  assert(
    reviewHistory.rows[1]
      .decision ===
      "APPROVED",
    "second review must approve",
  );


  console.log(
    "PASS immutable review history",
  );


  console.log(
    "\nEXECUTION DELIVERABLE REVISION TEST: PASS",
  );
}


main()
  .catch(error => {
    console.error(
      "\nEXECUTION DELIVERABLE REVISION TEST: FAILED",
      error,
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await cleanup();
    }
    finally {
      await appDb.end();
    }
  });
