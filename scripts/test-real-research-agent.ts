import {
  randomUUID,
} from "node:crypto";

import {
  appDb,
} from "../src/mastra/db/postgres";

import {
  createProjectExecutionPlan,
  getProjectExecutionPlan,
  productionStageHandlers,
  runExecutionPlanPass,
} from "../src/mastra/execution";


const TEST_MARKER =
  "__REAL_RESEARCH_AGENT_SMOKE_TEST__";

const suffix =
  Date.now().toString();


let tenantId:
  string | undefined;

let customerId:
  string | undefined;

let opportunityId:
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


async function getActiveTenant(): Promise<{
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


  if (!row.code?.trim()) {
    throw new Error(
      "Active tenant has no code",
    );
  }


  return {
    id:
      row.id,

    code:
      row.code.trim(),
  };
}


async function createCustomer(
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
        row =>
          row.column_name,
      ),
    );


  const values:
    Record<string, unknown> = {
      tenant_id:
        resolvedTenantId,
    };


  if (
    names.has("status")
  ) {
    values.status =
      "PROSPECT";
  }


  if (
    names.has("code")
  ) {
    values.code =
      `REAL-RESEARCH-${suffix}`;
  }


  if (
    names.has("name")
  ) {
    values.name =
      `${TEST_MARKER} Customer`;
  }


  if (
    names.has(
      "display_name",
    )
  ) {
    values.display_name =
      `${TEST_MARKER} Customer`;
  }


  if (
    names.has(
      "legal_name",
    )
  ) {
    values.legal_name =
      `${TEST_MARKER} Customer`;
  }


  const required =
    columns.rows.filter(
      row =>
        row.is_nullable ===
          "NO" &&
        row.column_default ===
          null &&
        row.column_name !==
          "tenant_id" &&
        !Object.prototype
          .hasOwnProperty.call(
            values,
            row.column_name,
          ),
    );


  if (
    required.length > 0
  ) {
    throw new Error(
      [
        "Cannot create disposable customer.",
        "Required columns:",
        required
          .map(
            row =>
              row.column_name,
          )
          .join(", "),
      ].join(" "),
    );
  }


  const keys =
    Object.keys(
      values,
    );


  const placeholders =
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
          ${placeholders.join(", ")}
        )
        RETURNING id::text
      `,
      keys.map(
        key =>
          values[key],
      ),
    );


  return result.rows[0].id;
}


async function createFixtures(): Promise<void> {
  console.log(
    "--- CREATE FIXTURES ---",
  );


  const tenant =
    await getActiveTenant();


  tenantId =
    tenant.id;


  customerId =
    await createCustomer(
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

        `REAL-R-${suffix}`,

        `${TEST_MARKER} Opportunity`,

        "Real Mastra research agent smoke test",
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

        `REAL-R-${suffix}`,

        `${TEST_MARKER} Project`,

        "Real research-agent integration smoke test",
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


  /*
   * This smoke test is deliberately simple.
   * We give the research agent a concrete
   * business problem, not an empty definition.
   */
  const definition = {
    id:
      `real-research-definition-${suffix}`,

    projectId,

    tenantId,

    version:
      1,

    status:
      "READY",

    title:
      "Competitive research for yacht charter website",

    objective:
      [
        "Identify useful competitive and positioning insights",
        "for a yacht charter website operating in Lefkada, Greece.",
      ].join(" "),

    requirements: [],

    knowledgeReferences: [],

    structuredSqlPlans: [],

    integrationRequirements: [],

    context: {
      market:
        "Yacht charter",

      geography:
        "Lefkada, Greece",

      audience: [
        "German-speaking charter customers",
        "European sailing customers",
      ],

      businessCharacteristics: [
        "family business",
        "Greek and German background",
        "long operating experience",
      ],

      requestedResearch: [
        "competitive positioning",
        "customer decision factors",
        "trust signals",
        "content opportunities",
      ],
    },
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
      projectDefinitionId,
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


    if (
      projectId ||
      opportunityId ||
      customerId
    ) {
      await client.query(
        `
          DELETE FROM app.ai_cost_ledger
          WHERE run_id IN (
            SELECT id
            FROM app.ai_runs
            WHERE
              ($1::uuid IS NOT NULL AND project_id = $1)
              OR
              ($2::uuid IS NOT NULL AND opportunity_id = $2)
              OR
              ($3::uuid IS NOT NULL AND customer_id = $3)
          )
        `,
        [
          projectId,
          opportunityId,
          customerId,
        ],
      );


      await client.query(
        `
          DELETE FROM app.ai_token_usage
          WHERE run_id IN (
            SELECT id
            FROM app.ai_runs
            WHERE
              ($1::uuid IS NOT NULL AND project_id = $1)
              OR
              ($2::uuid IS NOT NULL AND opportunity_id = $2)
              OR
              ($3::uuid IS NOT NULL AND customer_id = $3)
          )
        `,
        [
          projectId,
          opportunityId,
          customerId,
        ],
      );


      await client.query(
        `
          DELETE FROM app.ai_runs
          WHERE
            ($1::uuid IS NOT NULL AND project_id = $1)
            OR
            ($2::uuid IS NOT NULL AND opportunity_id = $2)
            OR
            ($3::uuid IS NOT NULL AND customer_id = $3)
        `,
        [
          projectId,
          opportunityId,
          customerId,
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
      tenantId &&
      projectId &&
      projectDefinitionId,
      "Fixture creation incomplete",
    );


    console.log(
      "\n--- CREATE REAL RESEARCH EXECUTION PLAN ---",
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
              "competitive-research",

            agentRole:
              "RESEARCH_COMPETITOR",

            executionKind:
              "SPECIALIST_ARTIFACT",

            expectedArtifactType:
              "RESEARCH_PACKAGE",

            required:
              true,

            approvalRequired:
              false,

            configuration: {
              smokeTest:
                true,

              allowTools:
                true,

              timeoutMs:
                120000,

              focus: [
                "competitive positioning",
                "trust signals",
                "conversion drivers",
              ],
            },
          },
        ],
      });


    planId =
      plan.id;


    console.log(
      "planId:",
      planId,
    );


    console.log(
      "\n--- EXECUTE REAL MASTRA AGENT ---",
    );


    const result =
      await runExecutionPlanPass(
        tenantId,
        planId,
        productionStageHandlers,
      );


    console.log(
      "executedStageCount:",
      result.executedStageCount,
    );

    console.log(
      "finalPlanStatus:",
      result.finalPlanStatus,
    );


    const stageResult =
      result.stageResults[0];


    assert(
      stageResult,
      "No stage result returned",
    );


    console.log(
      "stage success:",
      stageResult.success,
    );


    if (
      !stageResult.success
    ) {
      console.error(
        "stage error:",
        stageResult.error,
      );

      throw new Error(
        `Real research stage failed: ${stageResult.error}`,
      );
    }


    assert(
      stageResult.outputs.length ===
        1,
      "Expected exactly one stage output",
    );


    const output =
      stageResult.outputs[0];


    assert(
      output.outputKind ===
        "SPECIALIST_ARTIFACT",
      "Expected specialist artifact output",
    );


    const artifactId =
      output.specialistArtifactId;


    console.log(
      "artifactId:",
      artifactId,
    );


    const artifact =
      await appDb.query<{
        id: string;
        role: string;
        artifact_type: string;
        status: string;
        project_definition_id: string;
        project_definition_version: number;
        payload: unknown;
      }>(
        `
          SELECT
            id::text,
            role,
            artifact_type,
            status,
            project_definition_id::text,
            project_definition_version,
            payload

          FROM app.specialist_artifacts

          WHERE id = $1

          LIMIT 1
        `,
        [
          artifactId,
        ],
      );


    const artifactRow =
      artifact.rows[0];


    assert(
      artifactRow,
      "Persisted research artifact not found",
    );


    assert(
      artifactRow.role ===
        "RESEARCH_COMPETITOR",
      "Persisted artifact role mismatch",
    );


    assert(
      artifactRow.artifact_type ===
        "RESEARCH_PACKAGE",
      "Persisted artifact type mismatch",
    );


    assert(
      artifactRow.status ===
        "READY",
      "Persisted artifact should be READY",
    );


    assert(
      artifactRow.project_definition_id ===
        projectDefinitionId,
      "Artifact ProjectDefinition binding mismatch",
    );


    assert(
      artifactRow.project_definition_version ===
        1,
      "Artifact ProjectDefinition version mismatch",
    );


    assert(
      typeof artifactRow.payload ===
        "object" &&
      artifactRow.payload !==
        null,
      "Artifact payload should be JSON object",
    );


    const loadedPlan =
      await getProjectExecutionPlan(
        tenantId,
        planId,
      );


    const stage =
      loadedPlan.stages.find(
        item =>
          item.stageKey ===
            "competitive-research",
      );


    assert(
      stage?.status ===
        "COMPLETED",
      `Research stage should be COMPLETED; current=${stage?.status}`,
    );


    assert(
      loadedPlan.status ===
        "COMPLETED",
      `Execution plan should be COMPLETED; current=${loadedPlan.status}`,
    );


    console.log(
      "\n--- RESULT SUMMARY ---",
    );

    console.log(
      "stage:",
      stage.status,
    );

    console.log(
      "plan:",
      loadedPlan.status,
    );

    console.log(
      "artifact:",
      artifactRow.status,
    );


    console.log(
      "\n========================================",
    );

    console.log(
      "REAL RESEARCH AGENT SMOKE TEST: PASS",
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
        "\nREAL RESEARCH AGENT SMOKE TEST: FAIL",
      );

      console.error(
        error,
      );

      process.exitCode =
        1;
    },
  )
  .finally(
    async () => {
      await appDb.end();
    },
  );
