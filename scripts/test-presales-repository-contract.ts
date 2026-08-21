import {
  randomUUID,
} from "node:crypto";

import {
  appDb,
} from "../src/mastra/db/postgres";

import {
  createInitialOpportunity,
  createPresalesSource,
  createRepositoryInspection,
  getLatestRepositoryInspection,
  getPresalesSource,
  listOpportunityPresalesSources,
  listOpportunityRepositoryInspections,
  updatePresalesSourceStatus,
} from "../src/mastra/presales";


function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(
      `ASSERTION FAILED: ${message}`,
    );
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
        : String(
            error,
          );

    if (
      expectedText &&
      !message.includes(
        expectedText,
      )
    ) {
      throw new Error(
        `${label}: wrong error: ${message}`,
      );
    }

    console.log(
      `PASS ${label}`,
    );
  }
}


async function main(): Promise<void> {
  let opportunityId:
    string | undefined;

  let sourceId:
    string | undefined;

  try {
    console.log(
      "\n--- LOAD FIXTURE OWNER ---",
    );

    const owner =
      await appDb.query<{
        tenant_id: string;
        customer_id: string;
      }>(
        `
          SELECT
            c.tenant_id::text,
            c.id::text AS customer_id
          FROM app.customers c
          JOIN app.tenants t
            ON t.id = c.tenant_id
          WHERE t.is_active = true
          ORDER BY c.created_at ASC
          LIMIT 1
        `,
      );

    const ownerRow =
      owner.rows[0];

    if (!ownerRow) {
      throw new Error(
        "No customer fixture available",
      );
    }

    const tenantId =
      ownerRow.tenant_id;

    const customerId =
      ownerRow.customer_id;


    console.log(
      "\n--- CREATE OPPORTUNITY ---",
    );

    const initial =
      await createInitialOpportunity({
        tenantId,
        customerId,

        opportunity: {
          code:
            `REPO-${Date.now()}`,

          title:
            "Repository inspection contract smoke",

          description:
            "Existing application with customer-reported performance issue.",

          source:
            "CONTRACT_SMOKE",
        },

        request: {
          title:
            "Inspect existing application",

          requestText:
            "The customer reports that order processing becomes slow during integration activity.",

          sourceChannel:
            "TEST",
        },
      });

    opportunityId =
      initial.opportunity.id;

    console.log(
      "opportunityId:",
      opportunityId,
    );


    console.log(
      "\n--- CREATE REPOSITORY SOURCE ---",
    );

    const source =
      await createPresalesSource({
        tenantId,
        customerId,
        opportunityId,

        sourceType:
          "REPOSITORY",

        title:
          "Existing customer application",

        repositoryProvider:
          "GITHUB",

        repositoryUrl:
          "https://github.com/example/customer-app.git",

        requestedRef:
          "main",

        metadata: {
          purpose:
            "contract-smoke",
        },
      });

    sourceId =
      source.id;

    assert(
      source.sourceType ===
        "REPOSITORY",
      "source type",
    );

    assert(
      source.accessMode ===
        "READ_ONLY",
      "source must be READ_ONLY",
    );

    assert(
      source.status ===
        "PENDING",
      "source must initially be PENDING",
    );

    console.log(
      "PASS repository source persisted as READ_ONLY/PENDING",
    );


    console.log(
      "\n--- VERIFY SOURCE ROUND TRIP ---",
    );

    const reloadedSource =
      await getPresalesSource(
        tenantId,
        source.id,
      );

    assert(
      reloadedSource.id ===
        source.id,
      "source round-trip id",
    );

    assert(
      reloadedSource.opportunityId ===
        opportunityId,
      "source opportunity binding",
    );

    assert(
      reloadedSource.customerId ===
        customerId,
      "source customer binding",
    );

    console.log(
      "PASS exact source ownership binding",
    );


    console.log(
      "\n--- INSPECTION MUST REQUIRE READY SOURCE ---",
    );

    await expectFailure(
      "PENDING source cannot be inspected",
      () =>
        createRepositoryInspection({
          tenantId,
          customerId,
          opportunityId:
            opportunityId!,

          presalesSourceId:
            source.id,

          repositoryUrl:
            source.repositoryUrl!,

          resolvedRef:
            "refs/heads/main",

          resolvedCommit:
            "1111111111111111111111111111111111111111",

          status:
            "READY",
        }),
      "must be READY",
    );


    console.log(
      "\n--- MARK SOURCE READY ---",
    );

    const readySource =
      await updatePresalesSourceStatus(
        tenantId,
        source.id,
        "READY",
      );

    assert(
      readySource.status ===
        "READY",
      "source READY transition",
    );

    console.log(
      "PASS source READY",
    );


    console.log(
      "\n--- CREATE INSPECTION V1 ---",
    );

    const inspectionV1 =
      await createRepositoryInspection({
        tenantId,
        customerId,
        opportunityId,

        presalesSourceId:
          source.id,

        repositoryUrl:
          source.repositoryUrl!,

        requestedRef:
          "main",

        resolvedRef:
          "refs/heads/main",

        resolvedCommit:
          "1111111111111111111111111111111111111111",

        detectedStack: [
          "Next.js",
          "TypeScript",
          "PostgreSQL",
        ],

        architecture: [
          "Server-rendered web application",
        ],

        modules: [
          "orders",
          "integration",
        ],

        integrations: [
          "SoftOne",
        ],

        dataLayer: [
          "PostgreSQL",
        ],

        relevantFiles: [
          "package.json",
          "src/app/api/orders/route.ts",
        ],

        findings: [
          {
            id:
              randomUUID(),

            category:
              "INTEGRATION",

            statement:
              "The application contains an integration path relevant to the reported order-processing problem.",

            confidence:
              "VERIFIED",

            fileRefs: [
              {
                path:
                  "src/app/api/orders/route.ts",
              },
            ],

            notes: [],
          },

          {
            id:
              randomUUID(),

            category:
              "PERFORMANCE",

            statement:
              "The integration path may contribute to request latency.",

            confidence:
              "INFERRED",

            fileRefs: [
              {
                path:
                  "src/app/api/orders/route.ts",
              },
            ],

            notes: [
              "Requires runtime verification.",
            ],
          },
        ],

        risks: [
          "Production runtime behaviour has not been measured.",
        ],

        technicalDebt: [],

        limitations: [
          "Static repository inspection only.",
        ],

        status:
          "READY",
      });

    assert(
      inspectionV1.version ===
        1,
      "first inspection version must be 1",
    );

    assert(
      inspectionV1.resolvedCommit ===
        "1111111111111111111111111111111111111111",
      "inspection exact commit",
    );

    console.log(
      "PASS inspection v1",
    );


    console.log(
      "\n--- CREATE INSPECTION V2 ---",
    );

    const inspectionV2 =
      await createRepositoryInspection({
        tenantId,
        customerId,
        opportunityId,

        presalesSourceId:
          source.id,

        repositoryUrl:
          source.repositoryUrl!,

        requestedRef:
          "main",

        resolvedRef:
          "refs/heads/main",

        resolvedCommit:
          "2222222222222222222222222222222222222222",

        detectedStack: [
          "Next.js",
          "TypeScript",
          "PostgreSQL",
        ],

        findings: [],

        limitations: [],

        status:
          "PARTIAL",
      });

    assert(
      inspectionV2.version ===
        2,
      "second inspection version must be 2",
    );

    assert(
      inspectionV2.resolvedCommit ===
        "2222222222222222222222222222222222222222",
      "v2 exact commit",
    );

    console.log(
      "PASS inspection versioning",
    );


    console.log(
      "\n--- VERIFY LATEST ---",
    );

    const latest =
      await getLatestRepositoryInspection(
        tenantId,
        source.id,
      );

    assert(
      latest !== null,
      "latest inspection exists",
    );

    assert(
      latest.version ===
        2,
      "latest inspection must be v2",
    );

    assert(
      latest.resolvedCommit ===
        "2222222222222222222222222222222222222222",
      "latest commit binding",
    );

    console.log(
      "PASS latest inspection resolution",
    );


    console.log(
      "\n--- VERIFY OPPORTUNITY LISTS ---",
    );

    const sources =
      await listOpportunityPresalesSources(
        tenantId,
        opportunityId,
      );

    assert(
      sources.some(
        item =>
          item.id ===
          source.id,
      ),
      "source appears in opportunity list",
    );

    const inspections =
      await listOpportunityRepositoryInspections(
        tenantId,
        opportunityId,
      );

    const ownInspections =
      inspections.filter(
        item =>
          item.presalesSourceId ===
          source.id,
      );

    assert(
      ownInspections.length ===
        2,
      "opportunity must contain two inspection versions",
    );

    console.log(
      "PASS opportunity evidence listing",
    );


    console.log(
      "\n--- AUTHORITY / INVARIANT FAILURES ---",
    );

    await expectFailure(
      "non-repository source rejected for repository inspection",
      async () => {
        const website =
          await createPresalesSource({
            tenantId,
            customerId,
            opportunityId,

            sourceType:
              "WEBSITE",

            title:
              "Existing website",

            reference:
              "https://example.com",

            status:
              "READY",
          });

        try {
          await createRepositoryInspection({
            tenantId,
            customerId,
            opportunityId,

            presalesSourceId:
              website.id,

            repositoryUrl:
              "https://github.com/example/not-authoritative.git",

            resolvedRef:
              "refs/heads/main",

            resolvedCommit:
              "3333333333333333333333333333333333333333",

            status:
              "READY",
          });
        }
        finally {
          await appDb.query(
            `
              DELETE FROM app.presales_sources
              WHERE id = $1
            `,
            [
              website.id,
            ],
          );
        }
      },
      "requires a REPOSITORY",
    );


    await expectFailure(
      "repository URL authority mismatch",
      () =>
        createRepositoryInspection({
          tenantId,
          customerId,
          opportunityId,

          presalesSourceId:
            source.id,

          repositoryUrl:
            "https://github.com/example/different.git",

          resolvedRef:
            "refs/heads/main",

          resolvedCommit:
            "4444444444444444444444444444444444444444",

          status:
            "READY",
        }),
      "does not match authoritative presales source",
    );


    await expectFailure(
      "READY inspection requires exact resolved commit",
      () =>
        createRepositoryInspection({
          tenantId,
          customerId,
          opportunityId,

          presalesSourceId:
            source.id,

          repositoryUrl:
            source.repositoryUrl!,

          status:
            "READY",
        }),
      "resolvedRef is required",
    );


    console.log(
      "\nPRESALES REPOSITORY CONTRACT: PASS",
    );
  }
  finally {
    console.log(
      "\n--- CLEANUP ---",
    );

    if (sourceId) {
      await appDb.query(
        `
          DELETE FROM app.repository_inspections
          WHERE presales_source_id = $1
        `,
        [
          sourceId,
        ],
      );

      await appDb.query(
        `
          DELETE FROM app.presales_sources
          WHERE id = $1
        `,
        [
          sourceId,
        ],
      );
    }

    if (opportunityId) {
      await appDb.query(
        `
          DELETE FROM app.customer_requests
          WHERE opportunity_id = $1
        `,
        [
          opportunityId,
        ],
      );

      await appDb.query(
        `
          DELETE FROM app.opportunities
          WHERE id = $1
        `,
        [
          opportunityId,
        ],
      );
    }

    console.log(
      "Cleanup completed.",
    );

    await appDb.end();
  }
}


main().catch(
  error => {
    console.error(
      "\nPRESALES REPOSITORY CONTRACT: FAIL\n",
    );

    console.error(
      error,
    );

    process.exitCode =
      1;
  },
);
