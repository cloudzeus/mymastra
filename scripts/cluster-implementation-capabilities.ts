import {
  appDb,
} from "../src/mastra/db/postgres";

import {
  clusterNextImplementationBatch,
} from "../src/mastra/knowledge/implementation-capability-clusterer";


async function runBatchWithRetry(
  batchSize: number,
  maxAttempts = 3,
) {
  let lastError:
    unknown;

  for (
    let attempt = 1;
    attempt <= maxAttempts;
    attempt += 1
  ) {
    try {
      return await clusterNextImplementationBatch(
        batchSize,
      );
    }
    catch (error) {
      lastError =
        error;

      console.warn(
        `Batch attempt ${attempt}/${maxAttempts} failed:`,
        error instanceof Error
          ? error.message
          : error,
      );

      if (
        attempt >= maxAttempts
      ) {
        break;
      }

      const delayMs =
        attempt * 2_000;

      console.warn(
        `Retrying same unclustered batch in ${delayMs}ms...`,
      );

      await new Promise(
        resolve =>
          setTimeout(
            resolve,
            delayMs,
          ),
      );
    }
  }

  throw (
    lastError ??
    new Error(
      "Capability clustering batch failed",
    )
  );
}


async function main() {
  const requestedBatchSize =
    Number(
      process.argv[2] ??
      "20",
    );

  const batchSize =
    Number.isFinite(
      requestedBatchSize,
    ) &&
    requestedBatchSize > 0
      ? Math.floor(
          requestedBatchSize,
        )
      : 20;


  let totalProcessed =
    0;

  let totalAssigned =
    0;

  let batch =
    0;


  while (true) {
    batch += 1;


    console.log(
      `\n--- CLUSTER BATCH ${batch} ---`,
    );


    const result =
      await runBatchWithRetry(
        batchSize,
      );


    console.log(
      result,
    );


    totalProcessed +=
      result.processed;

    totalAssigned +=
      result.assigned;


    if (
      result.processed === 0
    ) {
      break;
    }


    if (
      result.assigned === 0
    ) {
      throw new Error(
        "Clusterer made no assignments; stopping to avoid infinite loop",
      );
    }


    if (
      result.assigned <
      result.processed
    ) {
      console.warn(
        [
          result.processed -
            result.assigned,
          "candidate(s) were not assigned.",
          "They remain unclustered and will be retried.",
        ].join(
          " ",
        ),
      );
    }
  }


  const totals =
    await appDb.query<{
      total_candidates: number;
      clustered_candidates: number;
      unclustered_candidates: number;
      capabilities: number;
    }>(
      `
        SELECT
          (
            SELECT COUNT(*)::integer
            FROM app.implementation_candidates
            WHERE admin_status <> 'IGNORED'
          ) AS total_candidates,

          (
            SELECT COUNT(DISTINCT candidate_id)::integer
            FROM app.implementation_capability_members
          ) AS clustered_candidates,

          (
            SELECT COUNT(*)::integer
            FROM app.implementation_candidates c
            WHERE c.admin_status <> 'IGNORED'
              AND NOT EXISTS (
                SELECT 1
                FROM app.implementation_capability_members m
                WHERE m.candidate_id = c.id
              )
          ) AS unclustered_candidates,

          (
            SELECT COUNT(*)::integer
            FROM app.implementation_capabilities
            WHERE status = 'ACTIVE'
          ) AS capabilities
      `,
    );


  console.log(
    "\n--- CLUSTERING RESULT ---",
  );

  console.log(
    "processed this run:",
    totalProcessed,
  );

  console.log(
    "assigned this run:",
    totalAssigned,
  );

  console.log(
    totals.rows[0],
  );


  if (
    totals.rows[0]
      .unclustered_candidates !== 0
  ) {
    throw new Error(
      `${totals.rows[0].unclustered_candidates} candidates remain unclustered`,
    );
  }


  console.log(
    "\nCAPABILITY CLUSTERING: PASS",
  );
}


main()
  .catch(
    error => {
      console.error(
        "\nCAPABILITY CLUSTERING: FAIL",
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
