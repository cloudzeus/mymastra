import {
  appDb,
} from "../src/mastra/db/postgres";

import {
  mineImplementationRepository,
} from "../src/mastra/knowledge/deep-implementation-miner";


const TARGETS = [
  "DGproject",
  "dgconsultWebSite",
  "kimoncrm",
  "softboilerplate",
];


async function main() {
  console.log(
    "\n--- RETRY FAILED IMPLEMENTATION MINING ---",
  );


  let failures =
    0;


  for (
    const repositoryName
    of TARGETS
  ) {
    const result =
      await appDb.query<{
        id: string;
      }>(
        `
          SELECT
            id::text
          FROM app.implementation_repositories
          WHERE owner = 'cloudzeus'
            AND repository_name = $1
            AND status = 'READY'
        `,
        [
          repositoryName,
        ],
      );


    const row =
      result.rows[0];


    if (!row) {
      console.error(
        "NOT FOUND:",
        repositoryName,
      );

      failures += 1;

      continue;
    }


    try {
      const mined =
        await mineImplementationRepository(
          row.id,
        );


      console.log(
        `${repositoryName}: ${mined.candidateCount} candidates`,
      );
    }
    catch (error) {
      failures += 1;

      console.error(
        `${repositoryName}: FAILED`,
        error,
      );
    }
  }


  console.log(
    "\nfailures:",
    failures,
  );


  if (
    failures > 0
  ) {
    process.exitCode =
      1;
  }
  else {
    console.log(
      "RETRY FAILED IMPLEMENTATION MINING: PASS",
    );
  }
}


main()
  .catch(
    error => {
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
