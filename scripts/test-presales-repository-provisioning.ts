import {
  appDb,
} from "../src/mastra/db/postgres";

import {
  createInitialOpportunity,
  createPresalesSource,
  createPresalesRepositoryWorkspace,
  getPresalesRepositoryWorkspace,
  provisionPresalesRepository,
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

    const row =
      owner.rows[0];

    if (!row) {
      throw new Error(
        "No customer fixture available",
      );
    }

    const tenantId =
      row.tenant_id;

    const customerId =
      row.customer_id;


    console.log(
      "\n--- CREATE OPPORTUNITY ---",
    );

    const initial =
      await createInitialOpportunity({
        tenantId,
        customerId,

        opportunity: {
          code:
            `REPO-PROVISION-${Date.now()}`,

          title:
            "Presales repository provisioning smoke",

          source:
            "TEST",
        },

        request: {
          title:
            "Inspect existing repository",

          requestText:
            "Inspect an existing application repository.",
        },
      });

    opportunityId =
      initial.opportunity.id;


    console.log(
      "\n--- CREATE SOURCE ---",
    );

    const source =
      await createPresalesSource({
        tenantId,
        customerId,
        opportunityId,

        sourceType:
          "REPOSITORY",

        title:
          "Public provisioning fixture",

        repositoryProvider:
          "GITHUB",

        repositoryUrl:
          "https://github.com/octocat/Hello-World.git",

        requestedRef:
          "master",
      });

    sourceId =
      source.id;


    console.log(
      "\n--- CREATE CANONICAL WORKSPACE ---",
    );

    const pending =
      await createPresalesRepositoryWorkspace(
        tenantId,
        source.id,
      );

    assert(
      pending.status ===
        "PENDING",
      "workspace must begin PENDING",
    );

    console.log(
      "PASS canonical workspace registered",
    );


    console.log(
      "\n--- PROVISION REPOSITORY ---",
    );

    const ready =
      await provisionPresalesRepository(
        tenantId,
        source.id,
      );

    assert(
      ready.status ===
        "READY",
      "workspace must become READY",
    );

    assert(
      !!ready.resolvedRef,
      "resolvedRef required",
    );

    assert(
      !!ready.resolvedCommit,
      "resolvedCommit required",
    );

    assert(
      /^[0-9a-fA-F]{40,64}$/.test(
        ready.resolvedCommit!,
      ),
      "resolvedCommit format",
    );

    console.log(
      "resolvedRef:",
      ready.resolvedRef,
    );

    console.log(
      "resolvedCommit:",
      ready.resolvedCommit,
    );

    console.log(
      "PASS exact repository commit resolved",
    );


    console.log(
      "\n--- VERIFY ROUND TRIP ---",
    );

    const persisted =
      await getPresalesRepositoryWorkspace(
        tenantId,
        source.id,
      );

    assert(
      persisted.status ===
        "READY",
      "persisted workspace READY",
    );

    assert(
      persisted.resolvedCommit ===
        ready.resolvedCommit,
      "persisted exact commit",
    );

    console.log(
      "PASS workspace persistence",
    );


    console.log(
      "\nPRESALES REPOSITORY PROVISIONING: PASS",
    );
  }
  finally {
    console.log(
      "\n--- CLEANUP ---",
    );

    if (sourceId) {
      const workspace =
        await appDb.query<{
          workspace_path: string;
        }>(
          `
            SELECT workspace_path
            FROM app.presales_repository_workspaces
            WHERE presales_source_id = $1
          `,
          [
            sourceId,
          ],
        );

      const workspacePath =
        workspace.rows[0]
          ?.workspace_path;

      if (workspacePath) {
        const {
          rm,
        } =
          await import(
            "node:fs/promises"
          );

        if (
          workspacePath.startsWith(
            "/opt/mastra-presales-repositories/",
          )
        ) {
          await rm(
            workspacePath,
            {
              recursive: true,
              force: true,
            },
          );
        }
      }

      await appDb.query(
        `
          DELETE FROM app.presales_repository_workspaces
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
      "\nPRESALES REPOSITORY PROVISIONING: FAIL\n",
      error,
    );

    process.exitCode =
      1;
  },
);
