import {
  fetchSoftOneOfficialWsReference,
  writeSoftOneOfficialWsSnapshot,
} from "../src/mastra/softone/official-ws-reference";


async function main() {
  console.log(
    "--- SOFTONE OFFICIAL WS IMPORT ---",
  );


  const snapshot =
    await fetchSoftOneOfficialWsReference();


  const path =
    writeSoftOneOfficialWsSnapshot(
      snapshot,
    );


  console.log(
    "source:",
    snapshot.source.sourceId,
  );

  console.log(
    "retrieved:",
    snapshot.retrievedAt,
  );

  console.log(
    "sha256:",
    snapshot.sha256,
  );

  console.log(
    "methods:",
    snapshot.discoveredMethods.length,
  );

  console.log(
    "expected methods:",
    snapshot.expectedMethods.length,
  );

  console.log(
    "missing expected methods:",
    snapshot.missingExpectedMethods.length,
  );

  console.log(
    "error codes:",
    snapshot.hasErrorCodes
      ? "FOUND"
      : "MISSING",
  );


  console.table(
    snapshot.sections.map(
      section => ({
        kind:
          section.kind,

        section:
          section.title,

        chars:
          section.text.length,
      }),
    ),
  );


  console.log(
    "snapshot:",
    path,
  );


  if (
    snapshot.missingExpectedMethods.length >
    0
  ) {
    console.table(
      snapshot.missingExpectedMethods.map(
        method => ({
          missingMethod:
            method,
        }),
      ),
    );


    throw new Error(
      "Official WS snapshot is incomplete: expected Web Service methods are missing.",
    );
  }


  if (
    !snapshot.hasErrorCodes
  ) {
    throw new Error(
      "Official WS snapshot is incomplete: Error codes table is missing.",
    );
  }


  console.log(
    "\nSOFTONE OFFICIAL WS IMPORT: PASS",
  );
}


main()
  .catch(
    error => {
      console.error(
        "\nSOFTONE OFFICIAL WS IMPORT: FAIL",
      );

      console.error(
        error,
      );

      process.exitCode =
        1;
    },
  );
