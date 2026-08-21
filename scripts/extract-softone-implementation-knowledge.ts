import {
  appDb,
} from "../src/mastra/db/postgres";

import {
  enqueueSoftOneImplementationKnowledge,
} from "../src/mastra/softone/implementation-knowledge-promotion";


async function main() {
  const canonicalKey =
    process.argv[2];

  const candidateId =
    process.argv[3];


  if (!canonicalKey) {
    throw new Error(
      [
        "Usage:",
        "npx tsx scripts/extract-softone-implementation-knowledge.ts",
        "<SOFTONE_CAPABILITY>",
        "[candidate-id]",
      ].join(
        " ",
      ),
    );
  }


  if (
    !canonicalKey.startsWith(
      "SOFTONE_",
    )
  ) {
    throw new Error(
      "Only SOFTONE_* capabilities are accepted by this extractor",
    );
  }


  const result =
    await enqueueSoftOneImplementationKnowledge({
      canonicalKey,

      candidateId,
    });


  console.log(
    "\n--- SOFTONE IMPLEMENTATION KNOWLEDGE EXTRACTION ---",
  );


  console.log(
    "capability:",
    result.source.capabilityKey,
  );

  console.log(
    "implementation:",
    result.source.implementationName,
  );

  console.log(
    "repository:",
    `${result.source.repositoryOwner}/${result.source.repositoryName}`,
  );

  console.log(
    "commit:",
    result.source.commit,
  );

  console.log(
    "extracted claims:",
    result.extractedClaims,
  );

  console.log(
    "queued claims:",
    result.queuedClaims,
  );


  if (
    result.skippedFiles.length
  ) {
    console.log(
      "\nskipped files:",
    );

    console.table(
      result.skippedFiles,
    );
  }


  console.log(
    "\nqueued:",
  );

  console.table(
    result.queued,
  );


  console.log(
    "\nSOFTONE IMPLEMENTATION KNOWLEDGE EXTRACTION: PASS",
  );
}


main()
  .catch(
    error => {
      console.error(
        "\nSOFTONE IMPLEMENTATION KNOWLEDGE EXTRACTION: FAIL",
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
