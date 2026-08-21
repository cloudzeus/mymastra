import {
  RequestContext,
} from "@mastra/core/request-context";

import {
  appDb,
} from "../src/mastra/db/postgres";

import {
  createInitialOpportunity,
  createPresalesRepositoryWorkspace,
  createPresalesSource,
  provisionPresalesRepository,
} from "../src/mastra/presales";

import {
  presalesRepositoryContext,
} from "../src/mastra/tools/presales-repository-context";

import {
  presalesRepositoryTree,
} from "../src/mastra/tools/presales-repository-tree";

import {
  presalesRepositoryReadFile,
} from "../src/mastra/tools/presales-repository-read-file";

import {
  presalesRepositorySearchCode,
} from "../src/mastra/tools/presales-repository-search-code";

import {
  presalesRepositoryManifest,
} from "../src/mastra/tools/presales-repository-manifest";

import {
  presalesRepositoryGitMetadata,
} from "../src/mastra/tools/presales-repository-git-metadata";


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


async function executeTool(
  tool:
    any,

  input:
    Record<string, unknown>,

  requestContext:
    RequestContext,
) {
  if (
    typeof tool.execute !==
      "function"
  ) {
    throw new Error(
      `Tool has no execute(): ${tool.id}`,
    );
  }

  return await tool.execute(
    input,
    {
      requestContext,
    },
  );
}


async function expectFailure(
  label:
    string,

  fn:
    () =>
      Promise<unknown>,

  expected:
    string,
): Promise<void> {
  try {
    await fn();

    throw new Error(
      `${label}: expected failure`,
    );
  }
  catch (
    error
  ) {
    const message =
      error instanceof Error
        ? error.message
        : String(
            error,
          );

    if (
      !message.includes(
        expected,
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

  let workspacePath:
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
            `REPO-TOOLS-${Date.now()}`,

          title:
            "Presales repository tools smoke",

          source:
            "TEST",
        },

        request: {
          title:
            "Inspect repository",

          requestText:
            "Inspect the existing application repository.",
        },
      });


    opportunityId =
      initial.opportunity.id;


    console.log(
      "\n--- CREATE + PROVISION SOURCE ---",
    );

    const source =
      await createPresalesSource({
        tenantId,

        customerId,

        opportunityId,

        sourceType:
          "REPOSITORY",

        title:
          "Public tool fixture",

        repositoryProvider:
          "GITHUB",

        repositoryUrl:
          "https://github.com/octocat/Hello-World.git",

        requestedRef:
          "master",
      });


    sourceId =
      source.id;


    const pendingWorkspace =
      await createPresalesRepositoryWorkspace(
        tenantId,
        source.id,
      );


    workspacePath =
      pendingWorkspace.workspacePath;


    const ready =
      await provisionPresalesRepository(
        tenantId,
        source.id,
      );


    assert(
      ready.status ===
        "READY",
      "repository provisioning",
    );


    console.log(
      "PASS repository provisioned",
    );


    const requestContext =
      new RequestContext();


    requestContext.set(
      "tenantId",
      tenantId,
    );


    requestContext.set(
      "customerId",
      customerId,
    );


    requestContext.set(
      "opportunityId",
      opportunityId,
    );


    console.log(
      "\n--- CONTEXT TOOL ---",
    );

    const contextResult =
      await executeTool(
        presalesRepositoryContext,
        {
          presalesSourceId:
            source.id,
        },
        requestContext,
      );


    assert(
      contextResult.resolvedCommit ===
        ready.resolvedCommit,
      "context exact commit",
    );


    assert(
      contextResult.accessMode ===
        "READ_ONLY",
      "context read-only",
    );


    console.log(
      "PASS context authority",
    );


    console.log(
      "\n--- TREE TOOL ---",
    );

    const treeResult =
      await executeTool(
        presalesRepositoryTree,
        {
          presalesSourceId:
            source.id,

          maxDepth:
            3,
        },
        requestContext,
      );


    assert(
      Array.isArray(
        treeResult.entries,
      ),
      "tree entries",
    );


    assert(
      treeResult.entries.every(
        (
          entry:
            {
              path:
                string;
            },
        ) =>
          !entry.path
            .split("/")
            .includes(
              ".git",
            ),
      ),
      ".git excluded from tree",
    );


    console.log(
      "PASS repository tree",
    );


    console.log(
      "\n--- READ TOOL ---",
    );

    const readResult =
      await executeTool(
        presalesRepositoryReadFile,
        {
          presalesSourceId:
            source.id,

          relativePath:
            "README",
        },
        requestContext,
      );


    assert(
      typeof readResult.content ===
        "string",
      "README content",
    );


    assert(
      readResult.resolvedCommit ===
        ready.resolvedCommit,
      "read exact commit",
    );


    console.log(
      "PASS repository file read",
    );


    console.log(
      "\n--- SEARCH TOOL ---",
    );

    const searchResult =
      await executeTool(
        presalesRepositorySearchCode,
        {
          presalesSourceId:
            source.id,

          query:
            "Hello",

          maxResults:
            20,
        },
        requestContext,
      );


    assert(
      Array.isArray(
        searchResult.matches,
      ),
      "search result array",
    );


    console.log(
      "PASS repository search",
    );


    console.log(
      "\n--- MANIFEST TOOL ---",
    );

    const manifestResult =
      await executeTool(
        presalesRepositoryManifest,
        {
          presalesSourceId:
            source.id,
        },
        requestContext,
      );


    assert(
      Array.isArray(
        manifestResult.manifests,
      ),
      "manifest result array",
    );


    console.log(
      "PASS repository manifest lookup",
    );


    console.log(
      "\n--- GIT METADATA TOOL ---",
    );

    const gitResult =
      await executeTool(
        presalesRepositoryGitMetadata,
        {
          presalesSourceId:
            source.id,
        },
        requestContext,
      );


    assert(
      gitResult.resolvedCommit ===
        ready.resolvedCommit,
      "git exact commit",
    );


    assert(
      gitResult.headCommit ===
        ready.resolvedCommit,
      "git HEAD exact commit",
    );


    assert(
      gitResult.detachedHead ===
        true,
      "repository must remain detached",
    );


    console.log(
      "PASS immutable git metadata",
    );


    console.log(
      "\n--- SECURITY FAILURES ---",
    );


    await expectFailure(
      "path traversal rejected",

      () =>
        executeTool(
          presalesRepositoryReadFile,
          {
            presalesSourceId:
              source.id,

            relativePath:
              "../etc/passwd",
          },
          requestContext,
        ),

      "invalid path traversal",
    );


    await expectFailure(
      ".git access rejected",

      () =>
        executeTool(
          presalesRepositoryReadFile,
          {
            presalesSourceId:
              source.id,

            relativePath:
              ".git/HEAD",
          },
          requestContext,
        ),

      ".git access is prohibited",
    );


    const wrongOpportunityContext =
      new RequestContext();


    wrongOpportunityContext.set(
      "tenantId",
      tenantId,
    );


    wrongOpportunityContext.set(
      "customerId",
      customerId,
    );


    wrongOpportunityContext.set(
      "opportunityId",
      "00000000-0000-4000-8000-000000000001",
    );


    await expectFailure(
      "wrong opportunity rejected",

      () =>
        executeTool(
          presalesRepositoryContext,
          {
            presalesSourceId:
              source.id,
          },
          wrongOpportunityContext,
        ),

      "opportunity ownership mismatch",
    );


    console.log(
      "\nPRESALES REPOSITORY TOOLS: PASS",
    );
  }
  finally {
    console.log(
      "\n--- CLEANUP ---",
    );


    if (
      workspacePath
    ) {
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
            recursive:
              true,

            force:
              true,
          },
        );
      }
    }


    if (
      sourceId
    ) {
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


    if (
      opportunityId
    ) {
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
      "\nPRESALES REPOSITORY TOOLS: FAIL\n",
      error,
    );


    process.exitCode =
      1;
  },
);
