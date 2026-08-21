import {
  appDb,
} from "../src/mastra/db/postgres";

import {
  createInitialOpportunity,
  createInitialSolutionApproach,
  createProposal,
  createProposalRevision,
  submitProposalRevisionForReview,
  createProposalReview,
  markProposalSent,
  markProposalAwaitingCustomer,
  createCustomerDecision,
  convertAcceptedOpportunityToProject,
} from "../src/mastra/presales";


const TEST_MARKER =
  "__MASTRA_PRESALES_INTEGRATION_TEST__";

const suffix =
  Date.now().toString();

let tenantId:
  string | undefined;

let customerId:
  string | undefined;

let opportunityId:
  string | undefined;

let proposalId:
  string | undefined;

let projectId:
  string | undefined;


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
      "No active tenant exists for integration test",
    );
  }

  return row.id;
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
      `${TEST_MARKER}_${suffix}`;
  }

  if (names.has("name")) {
    values.name =
      `${TEST_MARKER} Customer ${suffix}`;
  }

  if (
    names.has("display_name")
  ) {
    values.display_name =
      `${TEST_MARKER} Customer ${suffix}`;
  }

  if (
    names.has("legal_name")
  ) {
    values.legal_name =
      `${TEST_MARKER} Customer ${suffix}`;
  }

  const requiredWithoutDefault =
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
    requiredWithoutDefault.length >
      0
  ) {
    throw new Error(
      [
        "Cannot auto-create disposable customer.",
        "Required customer columns:",
        ...requiredWithoutDefault.map(
          row =>
            row.column_name,
        ),
      ].join(" "),
    );
  }

  const keys =
    Object.keys(values);

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


async function assertOpportunityStatus(
  expectedStatus: string,
): Promise<void> {
  if (!opportunityId) {
    throw new Error(
      "opportunityId missing",
    );
  }

  const result =
    await appDb.query<{
      status: string;
    }>(
      `
        SELECT status
        FROM app.opportunities
        WHERE id = $1
      `,
      [
        opportunityId,
      ],
    );

  const actual =
    result.rows[0]?.status;

  if (
    actual !==
      expectedStatus
  ) {
    throw new Error(
      `Expected opportunity status ${expectedStatus}, got ${actual}`,
    );
  }
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
          DELETE FROM app.project_integration_bindings
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
          DELETE FROM app.project_workspaces
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
          DELETE FROM app.customer_decisions
          WHERE opportunity_id = $1
        `,
        [
          opportunityId,
        ],
      );

      await client.query(
        `
          DELETE FROM app.proposal_reviews
          WHERE opportunity_id = $1
        `,
        [
          opportunityId,
        ],
      );

      await client.query(
        `
          DELETE FROM app.proposal_revisions
          WHERE opportunity_id = $1
        `,
        [
          opportunityId,
        ],
      );

      await client.query(
        `
          DELETE FROM app.proposals
          WHERE opportunity_id = $1
        `,
        [
          opportunityId,
        ],
      );

      await client.query(
        `
          DELETE FROM app.specialist_artifacts
          WHERE opportunity_id = $1
        `,
        [
          opportunityId,
        ],
      );

      await client.query(
        `
          DELETE FROM app.initial_solution_approaches
          WHERE opportunity_id = $1
        `,
        [
          opportunityId,
        ],
      );

      await client.query(
        `
          DELETE FROM app.customer_requests
          WHERE opportunity_id = $1
        `,
        [
          opportunityId,
        ],
      );

      if (projectId) {
        await client.query(
          `
            UPDATE app.opportunities
            SET
              converted_project_id =
                NULL,
              status =
                'ACCEPTED'
            WHERE id = $1
          `,
          [
            opportunityId,
          ],
        );
      }

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
    console.log(
      "--- 1. ACTIVE TENANT ---",
    );

    tenantId =
      await getActiveTenant();

    console.log(
      "tenantId:",
      tenantId,
    );


    console.log(
      "\n--- 2. TEST CUSTOMER ---",
    );

    customerId =
      await createTestCustomer(
        tenantId,
      );

    console.log(
      "customerId:",
      customerId,
    );


    console.log(
      "\n--- 3. INITIAL OPPORTUNITY + REQUEST ---",
    );

    const initial =
      await createInitialOpportunity({
        tenantId,
        customerId,

        opportunity: {
          code:
            `TEST-${suffix}`,

          title:
            `${TEST_MARKER} Existing App Feature`,

          description:
            "Temporary integration-test opportunity",

          source:
            "INTEGRATION_TEST",

          currency:
            "EUR",
        },

        request: {
          title:
            "Add reporting feature",

          requestText:
            "Customer has an existing application and wants a new reporting feature.",

          sourceChannel:
            "INTEGRATION_TEST",

          metadata: {
            integrationTest:
              true,

            marker:
              TEST_MARKER,
          },
        },
      });

    opportunityId =
      initial.opportunity.id;

    console.log(
      "opportunityId:",
      opportunityId,
    );

    console.log(
      "requestId:",
      initial.request.id,
    );

    await assertOpportunityStatus(
      "DRAFT",
    );


    console.log(
      "\n--- 4. SOLUTION APPROACH ---",
    );

    const approach =
      await createInitialSolutionApproach({
        tenantId,
        customerId,
        opportunityId,

        approachText:
          "Analyze the existing repository and implement a reporting feature.",

        probableScope: [
          "Existing application assessment",
          "Reporting feature implementation",
          "Testing",
        ],

        probableTechnologies: [
          "Next.js",
          "TypeScript",
        ],

        assumptions: [
          "Repository access will be provided after acceptance",
        ],

        metadata: {
          engagementType:
            "EXISTING_APPLICATION_CHANGE",

          requiredCapabilities: [
            "TECHNICAL_ANALYSIS",
            "DEVELOPMENT",
            "TESTING",
          ],

          optionalCapabilities: [
            "UI_UX_DESIGN",
          ],

          developmentRequired:
            true,

          repositoryMode:
            "EXISTING",

          existingSystem:
            true,
        },
      });

    console.log(
      "approach version:",
      approach.version,
    );

    await assertOpportunityStatus(
      "ANALYSIS",
    );


    console.log(
      "\n--- 5. PROPOSAL ---",
    );

    const proposal =
      await createProposal({
        tenantId,
        customerId,
        opportunityId,

        code:
          `PROP-${suffix}`,

        title:
          `${TEST_MARKER} Proposal`,
      });

    proposalId =
      proposal.id;

    console.log(
      "proposalId:",
      proposalId,
    );

    await assertOpportunityStatus(
      "PROPOSAL_DRAFT",
    );


    console.log(
      "\n--- 6. PROPOSAL REVISION ---",
    );

    const revision =
      await createProposalRevision({
        tenantId,
        customerId,
        opportunityId,
        proposalId,

        content: {
          objective:
            "Implement reporting feature",

          inScope: [
            "Repository analysis",
            "Feature development",
            "Testing",
          ],

          outOfScope: [
            "Full application redesign",
          ],

          marker:
            TEST_MARKER,
        },

        sourceArtifactIds: [],
      });

    console.log(
      "revisionId:",
      revision.id,
    );

    console.log(
      "revision version:",
      revision.version,
    );


    console.log(
      "\n--- 7. INTERNAL REVIEW ---",
    );

    await submitProposalRevisionForReview(
      tenantId,
      revision.id,
    );

    await assertOpportunityStatus(
      "INTERNAL_REVIEW",
    );

    const review =
      await createProposalReview({
        tenantId,
        customerId,
        opportunityId,
        proposalId,

        proposalRevisionId:
          revision.id,

        decision:
          "APPROVED",

        reviewerRef:
          "integration-test",

        comments:
          "Automated lifecycle verification",
      });

    console.log(
      "reviewId:",
      review.id,
    );

    await assertOpportunityStatus(
      "READY_TO_SEND",
    );


    console.log(
      "\n--- 8. SEND PROPOSAL ---",
    );

    await markProposalSent(
      tenantId,
      proposalId,
    );

    await assertOpportunityStatus(
      "SENT",
    );

    await markProposalAwaitingCustomer(
      tenantId,
      proposalId,
    );

    await assertOpportunityStatus(
      "AWAITING_CUSTOMER",
    );


    console.log(
      "\n--- 9. CUSTOMER ACCEPTANCE ---",
    );

    const decision =
      await createCustomerDecision({
        tenantId,
        customerId,
        opportunityId,
        proposalId,

        proposalRevisionId:
          revision.id,

        decision:
          "ACCEPTED",

        customerContactRef:
          "integration-test-customer",

        comments:
          "Temporary integration-test acceptance",
      });

    console.log(
      "customerDecisionId:",
      decision.id,
    );

    await assertOpportunityStatus(
      "ACCEPTED",
    );


    console.log(
      "\n--- 10. PROJECT CONVERSION ---",
    );

    const conversion =
      await convertAcceptedOpportunityToProject({
        tenantId,
        opportunityId,

        projectCode:
          `TEST-PROJ-${suffix}`,

        projectName:
          `${TEST_MARKER} Project`,

        projectDescription:
          "Temporary integration-test project",
      });

    projectId =
      conversion.projectId;

    console.log(
      "projectId:",
      projectId,
    );

    await assertOpportunityStatus(
      "CONVERTED_TO_PROJECT",
    );


    console.log(
      "\n=================================",
    );

    console.log(
      "PRESALES LIFECYCLE TEST: PASS",
    );

    console.log(
      "=================================",
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
        "\nPRESALES LIFECYCLE TEST: FAIL",
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
