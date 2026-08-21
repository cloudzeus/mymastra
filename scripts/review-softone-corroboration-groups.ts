import {
  readFileSync,
} from "node:fs";

import {
  resolve,
} from "node:path";

import {
  canonicalizeSoftOneCorroborationGroup,
} from "../src/mastra/softone/implementation-corroboration-canonicalizer";

import type {
  SoftOneImplementationCorroborationResult,
} from "../src/mastra/softone/implementation-corroboration-types";


function main() {
  const capabilityKey =
    process.argv[2];


  if (!capabilityKey) {
    throw new Error(
      "Capability key required",
    );
  }


  const path =
    resolve(
      process.cwd(),
      "data",
      "softone-corroboration",
      `${capabilityKey.toLowerCase()}.multipass.json`,
    );


  const result:
    SoftOneImplementationCorroborationResult =
    JSON.parse(
      readFileSync(
        path,
        "utf8",
      ),
    );


  const rows =
    result.groups.map(
      group => {
        const canonical =
          canonicalizeSoftOneCorroborationGroup(
            group,
          );


        return {
          sourceKey:
            group.key,

          canonicalKey:
            canonical.canonicalKey,

          repositories:
            group.distinctRepositoryCount,

          reviewed:
            group.distinctReviewedRepositoryCount,

          confidence:
            group.confidence,

          implementationCorroborated:
            canonical.implementationCorroborated,

          authoritativeReview:
            canonical.eligibleForAuthoritativeReview,

          canonicalPromotion:
            canonical.canonicalPromotionAllowed,

          canonicalClaim:
            canonical.canonicalClaim,
        };
      },
    );


  console.log(
    "\n--- SOFTONE CORROBORATION REVIEW ---",
  );


  console.table(
    rows,
  );


  console.log(
    "\nImplementation corroborated:",
    rows.filter(
      row =>
        row.implementationCorroborated,
    ).length,
  );


  console.log(
    "Eligible for authoritative review:",
    rows.filter(
      row =>
        row.authoritativeReview,
    ).length,
  );


  console.log(
    "Canonical promotion allowed:",
    rows.filter(
      row =>
        row.canonicalPromotion,
    ).length,
  );


  console.log(
    "Ungrouped evidence:",
    result.ungroupedEvidenceIds.length,
  );
}


main();
