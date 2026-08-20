import {
  appDb,
} from "../src/mastra/db/postgres";

import {
  mineImplementationRepository,
} from "../src/mastra/knowledge/deep-implementation-miner";


const TARGETS = [
  "dgparking",
  "softboilerplate",
  "iotSaas",
];


async function main() {
  console.log(
    "\n--- DEEP MINER QUALITY TEST ---",
  );


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


    const repository =
      result.rows[0];


    if (!repository) {
      throw new Error(
        `Repository not found: ${repositoryName}`,
      );
    }


    console.log(
      `\n=== ${repositoryName} ===`,
    );


    const mined =
      await mineImplementationRepository(
        repository.id,
      );


    console.log(
      JSON.stringify(
        mined,
        null,
        2,
      ),
    );
  }


  console.log(
    "\nDEEP MINER QUALITY TEST: PASS",
  );
}


main()
  .catch(
    error => {
      console.error(
        "\nDEEP MINER QUALITY TEST: FAIL",
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
