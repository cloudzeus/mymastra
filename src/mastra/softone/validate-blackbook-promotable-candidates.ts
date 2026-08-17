import fs from "node:fs";
import path from "node:path";

import type {
  SoftOneBlackBookCandidate,
} from "./blackbook-types";


type Classification =
  | "SAFE_VERIFIED"
  | "DERIVED_EXAMPLE"
  | "REQUIRES_REVIEW"
  | "REJECTED_FALSE_POSITIVE";


type ClassifiedCandidate = {
  candidate: SoftOneBlackBookCandidate;
  classification: Classification;
  reasons: string[];
};


type ClassifiedFile = {
  formatVersion: number;
  sourceId: string;
  total: number;
  classified: ClassifiedCandidate[];
};


const INPUT =
  "data/softone-blackbook-classified-candidates.json";

const OUTPUT =
  "data/softone-blackbook-promotable-candidates.json";


const input =
  JSON.parse(
    fs.readFileSync(
      INPUT,
      "utf8",
    ),
  ) as ClassifiedFile;


function normalized(
  value: string,
): string {
  return value
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n+/g, "\n")
    .trim();
}


const promotable =
  input.classified.filter(
    item =>
      item.classification ===
        "SAFE_VERIFIED" ||
      item.classification ===
        "DERIVED_EXAMPLE",
  );


const valid:
  ClassifiedCandidate[] =
    [];

const invalid:
  Array<{
    id: string;
    page: number;
    classification: Classification;
    reason: string;
  }> =
    [];


for (
  const item of promotable
) {
  const candidate =
    item.candidate;

  const pageFile =
    path.resolve(
      "data/sources/blackbook/all-pages",
      `page-${String(
        candidate.page,
      ).padStart(
        3,
        "0",
      )}.txt`,
    );

  if (
    !fs.existsSync(
      pageFile,
    )
  ) {
    invalid.push({
      id:
        candidate.id,

      page:
        candidate.page,

      classification:
        item.classification,

      reason:
        "SOURCE_PAGE_MISSING",
    });

    continue;
  }


  const sourceText =
    normalized(
      fs.readFileSync(
        pageFile,
        "utf8",
      ),
    );


  /*
   * Every promoted candidate must retain exact textual
   * provenance from its source page.
   */
  if (
    candidate.exampleText
  ) {
    const example =
      normalized(
        candidate.exampleText,
      );

    if (
      !sourceText.includes(
        example,
      )
    ) {
      invalid.push({
        id:
          candidate.id,

        page:
          candidate.page,

        classification:
          item.classification,

        reason:
          "EXAMPLE_TEXT_NOT_FOUND_ON_SOURCE_PAGE",
      });

      continue;
    }
  }


  /*
   * SAFE_VERIFIED must only come from direct-verification
   * eligible extraction policies.
   */
  if (
    item.classification ===
      "SAFE_VERIFIED" &&
    candidate.promotionPolicy !==
      "DIRECT_VERIFICATION_ELIGIBLE"
  ) {
    invalid.push({
      id:
        candidate.id,

      page:
        candidate.page,

      classification:
        item.classification,

      reason:
        `INVALID_SAFE_PROMOTION_POLICY:${candidate.promotionPolicy}`,
    });

    continue;
  }


  /*
   * Example material may never become VERIFIED.
   */
  if (
    item.classification ===
      "DERIVED_EXAMPLE" &&
    candidate.recommendedStatus ===
      "VERIFIED"
  ) {
    invalid.push({
      id:
        candidate.id,

      page:
        candidate.page,

      classification:
        item.classification,

      reason:
        "DERIVED_EXAMPLE_CANNOT_BE_VERIFIED",
    });

    continue;
  }


  valid.push(
    item,
  );
}


const duplicateIds =
  [
    ...new Set(
      valid
        .map(
          item =>
            item.candidate.id,
        )
        .filter(
          (
            id,
            index,
            array,
          ) =>
            array.indexOf(id) !==
            index,
        ),
    ),
  ];


if (
  duplicateIds.length >
  0
) {
  throw new Error(
    `Duplicate promotable candidate IDs: ${duplicateIds.join(", ")}`,
  );
}


const output = {
  formatVersion: 1,

  sourceId:
    input.sourceId,

  validatedAt:
    new Date()
      .toISOString(),

  totalInput:
    promotable.length,

  validCount:
    valid.length,

  invalidCount:
    invalid.length,

  byClassification: {
    SAFE_VERIFIED:
      valid.filter(
        item =>
          item.classification ===
          "SAFE_VERIFIED",
      ).length,

    DERIVED_EXAMPLE:
      valid.filter(
        item =>
          item.classification ===
          "DERIVED_EXAMPLE",
      ).length,
  },

  invalid,

  records:
    valid,
};


fs.writeFileSync(
  OUTPUT,

  JSON.stringify(
    output,
    null,
    2,
  ) + "\n",
);


console.log(
  JSON.stringify(
    {
      output:
        OUTPUT,

      totalInput:
        output.totalInput,

      validCount:
        output.validCount,

      invalidCount:
        output.invalidCount,

      byClassification:
        output.byClassification,

      invalid:
        output.invalid.slice(
          0,
          20,
        ),
    },
    null,
    2,
  ),
);
