import {
  resolveSoftOneCrossSourceEvidence,
} from "../src/mastra/softone/cross-source-evidence-resolver";


async function main() {
  const capabilityKey =
    process.argv[2];


  if (
    !capabilityKey
  ) {
    throw new Error(
      "Capability key required",
    );
  }


  console.log(
    "--- SOFTONE CROSS-SOURCE RESOLUTION ---",
  );


  const result =
    await resolveSoftOneCrossSourceEvidence(
      capabilityKey,
    );


  console.table(
    result.results.map(
      item => ({
        bucket:
          item.target.bucket,

        key:
          item.target.key,

        resolution:
          item.resolution,

        repos:
          item.target.repositories.length,

        reviewed:
          item.target.reviewedRepositories.length,

        officialWs:
          item.officialWsSupport.length,

        blackBook:
          item.blackBookSupport.length,

        authoritative:
          item.authoritativeSupport.length,

        variants:
          item.authoritativeVariants.length,

        contradictions:
          item.authoritativeContradictions.length,
      }),
    ),
  );


  const counts =
    new Map<
      string,
      number
    >();


  for (
    const item
    of result.results
  ) {
    counts.set(
      item.resolution,
      (
        counts.get(
          item.resolution,
        ) ??
        0
      ) + 1,
    );
  }


  console.log(
    "\nResolution counts:",
    Object.fromEntries(
      counts,
    ),
  );


  console.log(
    "\nSOFTONE CROSS-SOURCE RESOLUTION: PASS",
  );
}


main()
  .catch(
    error => {
      console.error(
        "\nSOFTONE CROSS-SOURCE RESOLUTION: FAIL",
      );

      console.error(
        error,
      );

      process.exitCode =
        1;
    },
  );
