import {
  randomUUID,
} from "node:crypto";

import {
  appDb,
} from "../src/mastra/db/postgres";

import {
  createSpecialistArtifact,
  getSpecialistArtifact,
  getLatestOpportunityArtifact,
  getLatestProjectArtifact,
  listOpportunityArtifacts,
  listProjectArtifacts,
} from "../src/mastra/specialists";


const TEST_MARKER =
  "__MASTRA_SPECIALIST_ARTIFACT_TEST__";

const suffix =
  Date.now().toString();


let tenantId:
  string | undefined;

let tenantCode:
  string | undefined;

let customerId:
  string | undefined;

let opportunityId:
  string | undefined;

let projectId:
  string | undefined;

let projectDefinitionId:
  string | undefined;


function now(): string {
  return new Date().toISOString();
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
      !message.includes(
        expectedText,
      )
    ) {
      throw new Error(
        `${label}: failed, but with unexpected error: ${message}`,
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
      `Active tenant ${row.id} has no code`,
    );
  }

  return {
    id:
      row.id,

    code:
      row.code.trim(),
  };
}


async function createTestCustomer(
  resolvedTenantId: string,
): Promise<string> {
  const columns =
    await appDb.query<{
      column_name: string;
      is_nullable: string;
      column_default:
        string | null;
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

      status:
        "PROSPECT",
    };

  if (
    names.has("code")
  ) {
    values.code =
      `SPEC-${suffix}`;
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

  const missing =
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
    missing.length > 0
  ) {
    throw new Error(
      [
        "Cannot create disposable customer.",
        "Required columns:",
        ...missing.map(
          row =>
            row.column_name,
        ),
      ].join(" "),
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
    await getTenant();

  tenantId =
    tenant.id;

  tenantCode =
    tenant.code;

  console.log(
    "tenantId:",
    tenantId,
  );

  console.log(
    "tenantCode:",
    tenantCode,
  );


  customerId =
    await createTestCustomer(
      tenantId,
    );

  console.log(
    "customerId:",
    customerId,
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
          'DRAFT',
          'INTEGRATION_TEST'
        )
        RETURNING id::text
      `,
      [
        tenantId,
        customerId,

        `SPEC-OPP-${suffix}`,

        `${TEST_MARKER} Opportunity`,

        "Disposable specialist artifact test opportunity",
      ],
    );

  opportunityId =
    opportunity.rows[0].id;

  console.log(
    "opportunityId:",
    opportunityId,
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

        `SPEC-PROJ-${suffix}`,

        `${TEST_MARKER} Project`,

        "Disposable specialist artifact test project",
      ],
    );

  projectId =
    project.rows[0].id;

  console.log(
    "projectId:",
    projectId,
  );


  await appDb.query(
    `
      UPDATE app.opportunities

      SET
        status =
          'CONVERTED_TO_PROJECT',

        converted_project_id =
          $2,

        updated_at =
          now()

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
        integrationTest:
          true,

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

    if (
      opportunityId ||
      projectId
    ) {
      await client.query(
        `
          DELETE FROM app.specialist_artifacts

          WHERE
            opportunity_id = $1
            OR project_id = $2
        `,
        [
          opportunityId ??
            null,

          projectId ??
            null,
        ],
      );
    }


    if (
      projectDefinitionId
    ) {
      await client.query(
        `
          DELETE FROM app.project_definitions
          WHERE id = $1
        `,
        [
          projectDefinitionId,
        ],
      );
    }


    if (
      opportunityId
    ) {
      await client.query(
        `
          UPDATE app.opportunities

          SET
            converted_project_id =
              NULL,

            status =
              'DRAFT'

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


    if (
      projectId
    ) {
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


    if (
      customerId
    ) {
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

    if (
      !tenantId ||
      !tenantCode ||
      !customerId ||
      !opportunityId ||
      !projectId ||
      !projectDefinitionId
    ) {
      throw new Error(
        "Fixture initialization incomplete",
      );
    }


    console.log(
      "\n--- 1. OPPORTUNITY RESEARCH ARTIFACT ---",
    );

    const opportunityResearchId =
      randomUUID();

    const opportunityResearch =
      await createSpecialistArtifact({
        artifact: {
          id:
            opportunityResearchId,

          version:
            1,

          tenantId,
          tenantCode,

          scope:
            "OPPORTUNITY",

          customerId,

          opportunityId,

          role:
            "RESEARCH_COMPETITOR",

          artifactType:
            "RESEARCH_PACKAGE",

          status:
            "READY",

          title:
            "Competitor research",

          objective:
            "Research competitors during presales",

          sourceArtifactIds:
            [],

          findings:
            [],

          recommendations:
            [],

          unresolved:
            [],

          blockers:
            [],

          provenance:
            [],

          payload: {
            marker:
              TEST_MARKER,

            phase:
              "PRESALES",
          },

          createdAt:
            now(),

          updatedAt:
            now(),
        },
      });

    console.log(
      "opportunity research:",
      opportunityResearch.recordId,
    );


    console.log(
      "\n--- 2. READ OPPORTUNITY ARTIFACT ---",
    );

    const loaded =
      await getSpecialistArtifact(
        tenantId,
        opportunityResearchId,
      );

    if (
      loaded.artifact.id !==
        opportunityResearchId
    ) {
      throw new Error(
        "getSpecialistArtifact returned wrong artifact",
      );
    }

    const latestOpportunity =
      await getLatestOpportunityArtifact(
        tenantId,
        opportunityId,
        "RESEARCH_PACKAGE",
      );

    if (
      latestOpportunity
        ?.artifact.version !==
        1
    ) {
      throw new Error(
        "Latest opportunity artifact version mismatch",
      );
    }

    const opportunityList =
      await listOpportunityArtifacts(
        tenantId,
        opportunityId,
      );

    console.log(
      "opportunity artifacts:",
      opportunityList.length,
    );


    console.log(
      "\n--- 3. NEGATIVE: WRONG VERSION ---",
    );

    await expectFailure(
      "wrong opportunity artifact version",

      async () => {
        await createSpecialistArtifact({
          artifact: {
            id:
              randomUUID(),

            version:
              3,

            tenantId,
            tenantCode,

            scope:
              "OPPORTUNITY",

            customerId,

            opportunityId,

            role:
              "RESEARCH_COMPETITOR",

            artifactType:
              "RESEARCH_PACKAGE",

            status:
              "READY",

            title:
              "Invalid version",

            objective:
              "Should fail version sequencing",

            sourceArtifactIds:
              [],

            findings:
              [],

            recommendations:
              [],

            unresolved:
              [],

            blockers:
              [],

            provenance:
              [],

            payload: {},

            createdAt:
              now(),

            updatedAt:
              now(),
          },
        });
      },

      "version must be 2",
    );


    console.log(
      "\n--- 4. NEGATIVE: WRONG TENANT CODE ---",
    );

    await expectFailure(
      "wrong tenantCode",

      async () => {
        await createSpecialistArtifact({
          artifact: {
            id:
              randomUUID(),

            version:
              2,

            tenantId,

            tenantCode:
              "__WRONG_TENANT__",

            scope:
              "OPPORTUNITY",

            customerId,

            opportunityId,

            role:
              "RESEARCH_COMPETITOR",

            artifactType:
              "RESEARCH_PACKAGE",

            status:
              "READY",

            title:
              "Wrong tenant",

            objective:
              "Should fail tenant validation",

            sourceArtifactIds:
              [],

            findings:
              [],

            recommendations:
              [],

            unresolved:
              [],

            blockers:
              [],

            provenance:
              [],

            payload: {},

            createdAt:
              now(),

            updatedAt:
              now(),
          },
        });
      },

      "tenantCode mismatch",
    );


    console.log(
      "\n--- 5. NEGATIVE: DANGLING SOURCE ARTIFACT ---",
    );

    await expectFailure(
      "dangling sourceArtifactId",

      async () => {
        await createSpecialistArtifact({
          artifact: {
            id:
              randomUUID(),

            version:
              1,

            tenantId,
            tenantCode,

            scope:
              "OPPORTUNITY",

            customerId,

            opportunityId,

            role:
              "SEARCH_VISIBILITY",

            artifactType:
              "SEARCH_VISIBILITY_PACKAGE",

            status:
              "READY",

            title:
              "Invalid search artifact",

            objective:
              "Should reject missing source artifact",

            sourceArtifactIds: [
              randomUUID(),
            ],

            findings:
              [],

            recommendations:
              [],

            unresolved:
              [],

            blockers:
              [],

            provenance:
              [],

            payload: {},

            createdAt:
              now(),

            updatedAt:
              now(),
          },
        });
      },

      "Unknown source specialist artifacts",
    );


    console.log(
      "\n--- 6. NEGATIVE: PROJECT WITHOUT DEFINITION ---",
    );

    await expectFailure(
      "project artifact without ProjectDefinition",

      async () => {
        await createSpecialistArtifact({
          artifact: {
            id:
              randomUUID(),

            version:
              1,

            tenantId,
            tenantCode,

            scope:
              "PROJECT",

            customerId,

            opportunityId,

            projectId,

            role:
              "RESEARCH_COMPETITOR",

            artifactType:
              "RESEARCH_PACKAGE",

            status:
              "READY",

            title:
              "Invalid project research",

            objective:
              "Should require ProjectDefinition binding",

            sourceArtifactIds:
              [],

            findings:
              [],

            recommendations:
              [],

            unresolved:
              [],

            blockers:
              [],

            provenance:
              [],

            payload: {},

            createdAt:
              now(),

            updatedAt:
              now(),
          },
        });
      },

      "require projectDefinitionBinding",
    );


    console.log(
      "\n--- 7. NEGATIVE: PROJECT WITHOUT ORIGIN OPPORTUNITY ---",
    );

    await expectFailure(
      "project artifact without opportunityId",

      async () => {
        await createSpecialistArtifact({
          artifact: {
            id:
              randomUUID(),

            version:
              1,

            tenantId,
            tenantCode,

            scope:
              "PROJECT",

            customerId,

            projectId,

            role:
              "RESEARCH_COMPETITOR",

            artifactType:
              "RESEARCH_PACKAGE",

            status:
              "READY",

            title:
              "Missing origin",

            objective:
              "Should require originating opportunity",

            sourceArtifactIds:
              [],

            findings:
              [],

            recommendations:
              [],

            unresolved:
              [],

            blockers:
              [],

            provenance:
              [],

            payload: {},

            createdAt:
              now(),

            updatedAt:
              now(),
          } as any,

          projectDefinitionBinding: {
            recordId:
              projectDefinitionId,

            version:
              1,
          },
        });
      },

      "originating opportunityId",
    );


    console.log(
      "\n--- 8. VALID PROJECT RESEARCH ARTIFACT ---",
    );

    const projectResearchId =
      randomUUID();

    const projectResearch =
      await createSpecialistArtifact({
        artifact: {
          id:
            projectResearchId,

          version:
            1,

          tenantId,
          tenantCode,

          scope:
            "PROJECT",

          customerId,

          opportunityId,

          projectId,

          role:
            "RESEARCH_COMPETITOR",

          artifactType:
            "RESEARCH_PACKAGE",

          status:
            "READY",

          title:
            "Delivery research package",

          objective:
            "Provide verified research for project delivery",

          sourceArtifactIds: [
            opportunityResearchId,
          ],

          findings:
            [],

          recommendations:
            [],

          unresolved:
            [],

          blockers:
            [],

          provenance:
            [],

          payload: {
            marker:
              TEST_MARKER,

            phase:
              "DELIVERY",
          },

          createdAt:
            now(),

          updatedAt:
            now(),
        },

        projectDefinitionBinding: {
          recordId:
            projectDefinitionId,

          version:
            1,
        },
      });

    if (
      projectResearch
        .projectDefinitionRecordId !==
        projectDefinitionId
    ) {
      throw new Error(
        "ProjectDefinition record binding mismatch",
      );
    }

    if (
      projectResearch
        .projectDefinitionVersion !==
        1
    ) {
      throw new Error(
        "ProjectDefinition version binding mismatch",
      );
    }

    console.log(
      "project research:",
      projectResearch.recordId,
    );


    console.log(
      "\n--- 9. PROJECT SEARCH VISIBILITY ARTIFACT ---",
    );

    const projectSearchId =
      randomUUID();

    const projectSearch =
      await createSpecialistArtifact({
        artifact: {
          id:
            projectSearchId,

          version:
            1,

          tenantId,
          tenantCode,

          scope:
            "PROJECT",

          customerId,

          opportunityId,

          projectId,

          role:
            "SEARCH_VISIBILITY",

          artifactType:
            "SEARCH_VISIBILITY_PACKAGE",

          status:
            "READY",

          title:
            "Search visibility package",

          objective:
            "Produce SEO/search visibility delivery recommendations",

          sourceArtifactIds: [
            projectResearchId,
          ],

          findings:
            [],

          recommendations:
            [],

          unresolved:
            [],

          blockers:
            [],

          provenance:
            [],

          payload: {
            marker:
              TEST_MARKER,

            dependsOn:
              projectResearchId,
          },

          createdAt:
            now(),

          updatedAt:
            now(),
        },

        projectDefinitionBinding: {
          recordId:
            projectDefinitionId,

          version:
            1,
        },
      });

    console.log(
      "project search:",
      projectSearch.recordId,
    );


    console.log(
      "\n--- 10. VERIFY GRAPH ---",
    );

    const latestProjectResearch =
      await getLatestProjectArtifact(
        tenantId,
        projectId,
        "RESEARCH_PACKAGE",
      );

    if (
      latestProjectResearch
        ?.artifact.id !==
        projectResearchId
    ) {
      throw new Error(
        "Latest project research lookup mismatch",
      );
    }

    const latestProjectSearch =
      await getLatestProjectArtifact(
        tenantId,
        projectId,
        "SEARCH_VISIBILITY_PACKAGE",
      );

    if (
      latestProjectSearch
        ?.artifact.id !==
        projectSearchId
    ) {
      throw new Error(
        "Latest project search lookup mismatch",
      );
    }

    if (
      !latestProjectSearch
        .artifact
        .sourceArtifactIds
        .includes(
          projectResearchId,
        )
    ) {
      throw new Error(
        "Project artifact dependency graph was not preserved",
      );
    }

    const projectArtifacts =
      await listProjectArtifacts(
        tenantId,
        projectId,
      );

    console.log(
      "project artifacts:",
      projectArtifacts.length,
    );

    if (
      projectArtifacts.length !==
        2
    ) {
      throw new Error(
        `Expected 2 project artifacts, got ${projectArtifacts.length}`,
      );
    }


    console.log(
      "\n========================================",
    );

    console.log(
      "SPECIALIST ARTIFACT TEST: PASS",
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
        "\nSPECIALIST ARTIFACT TEST: FAIL",
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
