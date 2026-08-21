import {
  readFile,
} from "node:fs/promises";

import {
  appDb,
} from "../src/mastra/db/postgres";


async function main(): Promise<void> {
  const sql =
    await readFile(
      "sql/migrations/020_execution_deliverable_reviews.sql",
      "utf8",
    );


  console.log(
    "Applying migration 020_execution_deliverable_reviews.sql",
  );


  await appDb.query(sql);


  const result =
    await appDb.query<{
      table_name: string;
    }>(
      `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'app'
          AND table_name IN (
            'project_execution_deliverables',
            'project_execution_deliverable_revisions',
            'project_execution_reviews'
          )
        ORDER BY table_name
      `,
    );


  console.log(
    "Created/verified tables:",
    result.rows.map(
      row =>
        row.table_name,
    ),
  );


  if (
    result.rows.length !==
      3
  ) {
    throw new Error(
      `Expected 3 execution deliverable tables, found ${result.rows.length}`,
    );
  }


  console.log(
    "MIGRATION 020: PASS",
  );
}


main()
  .catch(error => {
    console.error(
      "MIGRATION 020: FAILED",
      error,
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await appDb.end();
  });
