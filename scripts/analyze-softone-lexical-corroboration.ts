import {
  analyzeAllSoftOneLexicalBuckets,
} from "../src/mastra/softone/implementation-bucket-corroboration";


async function main() {
  const capabilityKey =
    process.argv[2];

  if (!capabilityKey) {
    throw new Error(
      "Capability key required",
    );
  }

  const results =
    await analyzeAllSoftOneLexicalBuckets(
      capabilityKey,
    );

  console.log(
    "\n--- SOFTONE TARGETED CORROBORATION ---",
  );

  const rows =
    results.flatMap(
      result =>
        result.groups.map(
          group => ({
            bucket:
              result.bucket,

            key:
              group.key,

            repositories:
              group.distinctRepositoryCount,

            reviewed:
              group.distinctReviewedRepositoryCount,

            confidence:
              group.confidence,

            assertion:
              group.normalizedClaim,
          }),
        ),
    );

  console.table(
    rows,
  );

  console.log(
    "\nGroups:",
    rows.length,
  );

  console.log(
    "\nSOFTONE TARGETED CORROBORATION: PASS",
  );
}


main()
  .catch(
    error => {
      console.error(
        "\nSOFTONE TARGETED CORROBORATION: FAIL",
      );

      console.error(
        error,
      );

      process.exitCode =
        1;
    },
  );
