import {
  appDb,
} from "../src/mastra/db/postgres";

import {
  mineImplementationRepository,
} from "../src/mastra/knowledge/deep-implementation-miner";


type RepositoryRow = {
  id: string;

  repository_name:
    string;

  summary:
    string | null;
};


function worthDeepScan(
  summary:
    string | null,
): boolean {
  if (!summary) {
    return false;
  }

  try {
    return (
      JSON.parse(
        summary,
      )?.worthDeepScan ===
      true
    );
  }
  catch {
    return false;
  }
}


async function main() {
  const requestedLimit =
    Number(
      process.argv[2] ??
      "5",
    );


  const limit =
    Number.isFinite(
      requestedLimit,
    ) &&
    requestedLimit > 0
      ? Math.floor(
          requestedLimit,
        )
      : 5;


  const result =
    await appDb.query<
      RepositoryRow
    >(
      `
        SELECT
          id::text,
          repository_name,
          summary
        FROM app.implementation_repositories
        WHERE owner = 'cloudzeus'
          AND status = 'READY'
        ORDER BY
          repository_name
      `,
    );


  const repositories =
    result.rows
      .filter(
        row =>
          worthDeepScan(
            row.summary,
          ),
      )
      .slice(
        0,
        limit,
      );


  console.log(
    "\n--- DEEP IMPLEMENTATION MINER ---",
  );

  console.log(
    "selected:",
    repositories.length,
  );


  let totalCandidates =
    0;

  let failures =
    0;


  for (
    const repository
    of repositories
  ) {
    console.log(
      `\n--- ${repository.repository_name} ---`,
    );

    try {
      const mined =
        await mineImplementationRepository(
          repository.id,
        );


      totalCandidates +=
        mined.candidateCount;


      console.log(
        "candidates:",
        mined.candidateCount,
      );


      for (
        const candidate
        of mined.candidates
      ) {
        console.log(
          [
            "-",
            candidate.name,
            `mode=${candidate.reuseMode}`,
            `confidence=${candidate.confidence}`,
            `files=${candidate.sourceFiles.length}`,
          ].join(
            " ",
          ),
        );
      }
    }
    catch (error) {
      failures +=
        1;

      console.error(
        "FAILED:",
        error,
      );
    }
  }


  console.log(
    "\n--- RESULT ---",
  );

  console.log(
    "repositories:",
    repositories.length,
  );

  console.log(
    "candidates:",
    totalCandidates,
  );

  console.log(
    "failures:",
    failures,
  );

  if (
    failures === 0
  ) {
    console.log(
      "\nDEEP IMPLEMENTATION MINER: PASS",
    );
  }
  else {
    process.exitCode =
      1;
  }
}


main()
  .catch(
    error => {
      console.error(
        "\nDEEP IMPLEMENTATION MINER: FAIL",
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
