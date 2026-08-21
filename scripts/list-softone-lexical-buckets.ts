import {
  buildSoftOneLexicalBuckets,
} from "../src/mastra/softone/implementation-lexical-buckets";


function main() {
  const capabilityKey =
    process.argv[2];


  if (!capabilityKey) {
    throw new Error(
      "Capability key required",
    );
  }


  const buckets =
    buildSoftOneLexicalBuckets(
      capabilityKey,
    );


  console.log(
    "\n--- SOFTONE LEXICAL BUCKETS ---",
  );


  console.table(
    buckets.map(
      bucket => ({
        bucket:
          bucket.key,

        claims:
          bucket.members.length,

        repositories:
          new Set(
            bucket.members.map(
              member =>
                member.repository,
            ),
          ).size,
      }),
    ),
  );


  for (
    const bucket
    of buckets
  ) {
    console.log(
      `\n===== ${bucket.key} =====`,
    );


    console.table(
      bucket.members.map(
        member => ({
          evidenceId:
            member.evidenceId,

          repository:
            member.repository,

          kind:
            member.kind,

          claim:
            member.claim,
        }),
      ),
    );
  }
}


main();
