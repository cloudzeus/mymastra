import {
  appDb,
} from "../src/mastra/db/postgres";

import {
  approveCapability,
  ignoreCapability,
  listCapabilityReviewQueue,
} from "../src/mastra/knowledge/implementation-capability-manager";


async function main() {
  const command =
    process.argv[2] ??
    "list";


  if (
    command === "list"
  ) {
    const rows =
      await listCapabilityReviewQueue();

    console.table(
      rows.map(
        row => ({
          key:
            row.canonical_key,

          name:
            row.name,

          candidates:
            row.candidate_count,

          preferred:
            row.preferred_candidate_name,

          repo:
            row.preferred_repository,

          mode:
            row.reuse_mode,

          security:
            row.security_status,

          confidence:
            row.confidence,

          status:
            row.admin_status,

          securityReview:
            row.security_review_status,
        }),
      ),
    );

    return;
  }


  if (
    command === "approve"
  ) {
    const canonicalKey =
      process.argv[3];

    const security =
      process.argv[4];


    if (!canonicalKey) {
      throw new Error(
        "Usage: approve <CANONICAL_KEY> PASS|PASS_WITH_NOTES [notes]",
      );
    }


    if (
      security !== "PASS" &&
      security !== "PASS_WITH_NOTES"
    ) {
      throw new Error(
        "Explicit security review is required: PASS or PASS_WITH_NOTES",
      );
    }


    const notes =
      process.argv
        .slice(5)
        .join(" ")
        .trim() ||
      undefined;


    await approveCapability({
      canonicalKey,

      securityReview:
        security,

      notes,
    });


    console.log(
      `APPROVED: ${canonicalKey}`,
    );

    return;
  }


  if (
    command === "ignore"
  ) {
    const canonicalKey =
      process.argv[3];


    if (!canonicalKey) {
      throw new Error(
        "Usage: ignore <CANONICAL_KEY>",
      );
    }


    await ignoreCapability(
      canonicalKey,
    );


    console.log(
      `IGNORED: ${canonicalKey}`,
    );

    return;
  }


  throw new Error(
    `Unknown command: ${command}`,
  );
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
