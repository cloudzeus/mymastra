import {
  analyzeSoftOneImplementationCorroboration,
} from "../src/mastra/softone/implementation-corroboration";


async function main() {
  const canonicalKey =
    process.argv[2];


  if (!canonicalKey) {
    throw new Error(
      [
        "Usage:",
        "npx tsx scripts/analyze-softone-implementation-corroboration.ts",
        "<SOFTONE_CAPABILITY>",
      ].join(
        " ",
      ),
    );
  }


  const result =
    await analyzeSoftOneImplementationCorroboration(
      canonicalKey,
    );


  console.log(
    "\n--- SOFTONE IMPLEMENTATION CORROBORATION ---",
  );

  console.log(
    "capability:",
    result.capabilityKey,
  );

  console.log(
    "groups:",
    result.groups.length,
  );

  console.log(
    "ungrouped evidence:",
    result.ungroupedEvidenceIds.length,
  );


  console.table(
    result.groups.map(
      group => ({
        key:
          group.key,

        repositories:
          group.distinctRepositoryCount,

        reviewedRepositories:
          group.distinctReviewedRepositoryCount,

        confidence:
          group.confidence,

        assertion:
          group.normalizedClaim,
      }),
    ),
  );


  console.log(
    "\nSOFTONE IMPLEMENTATION CORROBORATION: PASS",
  );
}


main()
  .catch(
    error => {
      console.error(
        "\nSOFTONE IMPLEMENTATION CORROBORATION: FAIL",
      );

      console.error(
        error,
      );

      process.exitCode =
        1;
    },
  );
