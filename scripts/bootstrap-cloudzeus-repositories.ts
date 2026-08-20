import {
  appDb,
} from "../src/mastra/db/postgres";

import {
  upsertImplementationRepository,
} from "../src/mastra/knowledge/implementation-catalog-manager";


const OWNER =
  process.env.IMPLEMENTATION_CATALOG_GITHUB_OWNER?.trim() ||
  "cloudzeus";

const GITHUB_TOKEN =
  process.env.GITHUB_TOKEN?.trim();

const INCLUDE_FORKS =
  process.env.IMPLEMENTATION_CATALOG_INCLUDE_FORKS ===
  "true";

const INCLUDE_ARCHIVED =
  process.env.IMPLEMENTATION_CATALOG_INCLUDE_ARCHIVED ===
  "true";

const INCLUDE_EMPTY =
  process.env.IMPLEMENTATION_CATALOG_INCLUDE_EMPTY ===
  "true";


type GitHubRepository = {
  name: string;

  html_url: string;

  clone_url: string;

  default_branch: string;

  size: number;

  fork: boolean;

  archived: boolean;

  disabled: boolean;

  pushed_at:
    string | null;

  updated_at: string;

  language:
    string | null;

  description:
    string | null;
};


async function fetchOwnerRepositories(): Promise<
  GitHubRepository[]
> {
  const repositories:
    GitHubRepository[] = [];

  for (
    let page = 1;
    ;
    page += 1
  ) {
    const url =
      new URL(
        `https://api.github.com/users/${encodeURIComponent(OWNER)}/repos`,
      );

    url.searchParams.set(
      "per_page",
      "100",
    );

    url.searchParams.set(
      "page",
      String(page),
    );

    url.searchParams.set(
      "sort",
      "updated",
    );

    url.searchParams.set(
      "direction",
      "desc",
    );

    const headers:
      Record<string, string> = {
        Accept:
          "application/vnd.github+json",

        "User-Agent":
          "mastra-implementation-catalog",

        "X-GitHub-Api-Version":
          "2022-11-28",
      };

    if (GITHUB_TOKEN) {
      headers.Authorization =
        `Bearer ${GITHUB_TOKEN}`;
    }

    const response =
      await fetch(
        url,
        {
          headers,
        },
      );

    if (!response.ok) {
      const body =
        await response.text();

      throw new Error(
        `GitHub repository discovery failed: ${response.status} ${response.statusText}\n${body}`,
      );
    }

    const pageRepositories =
      await response.json() as
        GitHubRepository[];

    repositories.push(
      ...pageRepositories,
    );

    if (
      pageRepositories.length <
        100
    ) {
      break;
    }
  }

  return repositories;
}


function shouldInclude(
  repository:
    GitHubRepository,
): boolean {
  if (repository.disabled) {
    return false;
  }

  if (
    repository.fork &&
    !INCLUDE_FORKS
  ) {
    return false;
  }

  if (
    repository.archived &&
    !INCLUDE_ARCHIVED
  ) {
    return false;
  }

  if (
    repository.size === 0 &&
    !INCLUDE_EMPTY
  ) {
    return false;
  }

  return true;
}


async function main(): Promise<void> {
  console.log(
    "\n--- IMPLEMENTATION CATALOG BOOTSTRAP ---",
  );

  console.log(
    "owner:",
    OWNER,
  );

  console.log(
    "githubAuth:",
    GITHUB_TOKEN
      ? "token"
      : "anonymous/public",
  );


  const discovered =
    await fetchOwnerRepositories();

  console.log(
    "discovered:",
    discovered.length,
  );


  const included =
    discovered.filter(
      shouldInclude,
    );

  const excluded =
    discovered.filter(
      repository =>
        !shouldInclude(
          repository,
        ),
    );


  console.log(
    "included:",
    included.length,
  );

  console.log(
    "excluded:",
    excluded.length,
  );


  let insertedOrUpdated =
    0;

  for (
    const repository
    of included
  ) {
    const stored =
      await upsertImplementationRepository(
        {
          owner:
            OWNER,

          repositoryName:
            repository.name,

          repositoryUrl:
            repository.clone_url,

          defaultBranch:
            repository.default_branch,
        },
      );

    insertedOrUpdated += 1;

    console.log(
      [
        "UPSERT",
        stored.owner +
          "/" +
          stored.repositoryName,
        repository.language ??
          "unknown",
        `size=${repository.size}`,
      ].join(
        " | ",
      ),
    );
  }


  console.log(
    "\n--- EXCLUDED ---",
  );

  for (
    const repository
    of excluded
  ) {
    const reasons:
      string[] = [];

    if (
      repository.size === 0
    ) {
      reasons.push(
        "empty",
      );
    }

    if (
      repository.fork
    ) {
      reasons.push(
        "fork",
      );
    }

    if (
      repository.archived
    ) {
      reasons.push(
        "archived",
      );
    }

    if (
      repository.disabled
    ) {
      reasons.push(
        "disabled",
      );
    }

    console.log(
      `${OWNER}/${repository.name} -> ${reasons.join(", ")}`,
    );
  }


  const result =
    await appDb.query<{
      repository_count:
        string;

      pending_count:
        string;
    }>(
      `
        SELECT
          COUNT(*)::text AS repository_count,

          COUNT(*) FILTER (
            WHERE status = 'PENDING'
          )::text AS pending_count

        FROM app.implementation_repositories
        WHERE owner = $1
      `,
      [
        OWNER,
      ],
    );


  console.log(
    "\n--- RESULT ---",
  );

  console.log(
    "storedRepositories:",
    result.rows[0]
      .repository_count,
  );

  console.log(
    "pendingScan:",
    result.rows[0]
      .pending_count,
  );

  console.log(
    "upserted:",
    insertedOrUpdated,
  );

  console.log(
    "\nIMPLEMENTATION CATALOG BOOTSTRAP: PASS",
  );
}


main()
  .catch(
    error => {
      console.error(
        "\nIMPLEMENTATION CATALOG BOOTSTRAP: FAIL",
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
