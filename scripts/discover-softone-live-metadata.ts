import {
  discoverSoftOneLiveMetadata,
} from "../src/mastra/softone/live-metadata-discovery";


async function main(): Promise<void> {
  const connectionId =
    process.argv[2];

  const outputPath =
    process.argv[3];


  const objectFilter =
    process.argv[4]
      ?.split(",")
      .map(
        value =>
          value.trim(),
      )
      .filter(
        Boolean,
      );


  if (
    !connectionId
  ) {
    throw new Error(
      [
        "Usage:",
        "npx tsx scripts/discover-softone-live-metadata.ts",
        "<connectionId>",
        "[outputPath]",
      ].join(
        " ",
      ),
    );
  }


  const snapshot =
    await discoverSoftOneLiveMetadata({
      connectionId,

      outputPath:
        outputPath ??
        `data/softone-live/${connectionId}/latest.json`,

      continueOnError:
        true,

      objectFilter,
    });


  console.log(
    JSON.stringify(
      {
        source:
          snapshot.source,

        statistics:
          snapshot.statistics,

        fingerprint:
          snapshot.fingerprint,

        failures:
          snapshot.failures,
      },
      null,
      2,
    ),
  );
}


main().catch(
  error => {
    console.error(
      error,
    );

    process.exit(
      1,
    );
  },
);
