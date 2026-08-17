import fs from "node:fs";

import type {
  SoftOneBlackBookCandidate,
} from "./blackbook-types";


type CandidateFile = {
  formatVersion: number;
  candidateCount: number;
  candidates: SoftOneBlackBookCandidate[];
};


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


const input =
  JSON.parse(
    fs.readFileSync(
      "data/softone-blackbook-all-candidates.json",
      "utf8",
    ),
  ) as CandidateFile;


const CONTROL_FLOW =
  new Set([
    "IF",
    "ELSE",
    "ELSEIF",
    "FOR",
    "WHILE",
    "DO",
    "TRY",
    "CATCH",
    "FINALLY",
    "RETURN",
    "BREAK",
    "CONTINUE",
    "SWITCH",
    "CASE",
    "DEFAULT",
    "BEGIN",
    "END",
    "VAR",
    "LET",
    "CONST",
    "NEW",
  ]);


function looksLikeCodeUsage(
  candidate:
    SoftOneBlackBookCandidate,
): boolean {
  const text =
    candidate.exampleText ?? "";

  return (
    /[;{}]/.test(text) ||
    /^\s*(if|for|while|return|var|let|const|try|catch)\b/i
      .test(text) ||
    /=\s*[A-Za-z0-9_.]+\s*\(/.test(text) ||
    /^\s*[A-Za-z0-9_.]+\s*\([^)]*\)\s*;?\s*$/
      .test(text)
  );
}


function looksLikeDefinition(
  candidate:
    SoftOneBlackBookCandidate,
): boolean {
  const text =
    (candidate.exampleText ?? "")
      .trim();

  const symbol =
    candidate.symbol ?? "";

  if (
    !text ||
    !symbol
  ) {
    return false;
  }

  /*
   * A definition/signature line should normally start
   * with the documented symbol and should not look like
   * assignment/executable invocation code.
   */
  const startsWithSymbol =
    text
      .toUpperCase()
      .startsWith(
        symbol.toUpperCase(),
      );

  const hasSignature =
    /^\s*[A-Z][A-Z0-9_.]*\s*\([^)]*\)/i
      .test(text);

  const assignmentUsage =
    /^[A-Za-z0-9_.]+\s*=\s*/i
      .test(text);

  const statementTerminator =
    /;\s*$/.test(text);

  return (
    startsWithSymbol &&
    hasSignature &&
    !assignmentUsage &&
    !statementTerminator
  );
}


function classify(
  candidate:
    SoftOneBlackBookCandidate,
): ClassifiedCandidate {
  const reasons:
    string[] = [];

  const symbol =
    (
      candidate.symbol ??
      ""
    ).toUpperCase();


  /*
   * Chapter 8 already has a separately vetted extractor.
   */
  if (
    candidate.chapter === 8
  ) {
    return {
      candidate,
      classification:
        "REJECTED_FALSE_POSITIVE",
      reasons: [
        "Chapter 8 generic candidate superseded by vetted Scheduler extractor.",
      ],
    };
  }


  /*
   * Case studies are examples by policy.
   */
  if (
    candidate.extractionKind ===
      "CASE_STUDY_PATTERN"
  ) {
    return {
      candidate,
      classification:
        "DERIVED_EXAMPLE",
      reasons: [
        "Case-study material is documented example only.",
      ],
    };
  }


  /*
   * Appendix X.SYS.* symbols are deterministic system
   * parameter references.
   */
  if (
    candidate.extractionKind ===
      "SYSTEM_PARAMETER" &&
    symbol.startsWith(
      "X.SYS.",
    )
  ) {
    return {
      candidate,
      classification:
        "SAFE_VERIFIED",
      reasons: [
        "Explicit X.SYS.* system parameter reference in Appendix.",
      ],
    };
  }


  /*
   * Programming language / control-flow keywords are
   * never SoftOne API symbols.
   */
  if (
    CONTROL_FLOW.has(
      symbol,
    )
  ) {
    return {
      candidate,
      classification:
        "REJECTED_FALSE_POSITIVE",
      reasons: [
        "Programming/control-flow keyword, not a SoftOne documented symbol.",
      ],
    };
  }


  /*
   * Very short symbols are too ambiguous for auto-promotion.
   */
  if (
    symbol.length > 0 &&
    symbol.length <= 2
  ) {
    return {
      candidate,
      classification:
        "REJECTED_FALSE_POSITIVE",
      reasons: [
        "Symbol too short/ambiguous for deterministic documentation extraction.",
      ],
    };
  }


  /*
   * Functions/methods/events require actual definition-like
   * text, not an invocation inside executable code.
   */
  if (
    candidate.extractionKind ===
      "FUNCTION_SIGNATURE" ||
    candidate.extractionKind ===
      "METHOD_SIGNATURE" ||
    candidate.extractionKind ===
      "EVENT_SIGNATURE"
  ) {
    if (
      looksLikeDefinition(
        candidate,
      )
    ) {
      return {
        candidate,
        classification:
          "SAFE_VERIFIED",
        reasons: [
          "Definition-like signature in a section explicitly allowing this extraction kind.",
        ],
      };
    }

    if (
      looksLikeCodeUsage(
        candidate,
      )
    ) {
      return {
        candidate,
        classification:
          "REJECTED_FALSE_POSITIVE",
        reasons: [
          "Looks like executable invocation/code usage rather than documentation definition.",
        ],
      };
    }

    return {
      candidate,
      classification:
        "REQUIRES_REVIEW",
      reasons: [
        "Signature candidate does not clearly distinguish definition from usage.",
      ],
    };
  }


  /*
   * Generic command candidates are too risky unless they
   * come from tightly scoped, vetted extraction rules.
   */
  if (
    candidate.extractionKind ===
      "COMMAND_SIGNATURE"
  ) {
    if (
      looksLikeCodeUsage(
        candidate,
      )
    ) {
      return {
        candidate,
        classification:
          "REJECTED_FALSE_POSITIVE",
        reasons: [
          "Command candidate appears inside executable/example code.",
        ],
      };
    }

    return {
      candidate,
      classification:
        "REQUIRES_REVIEW",
      reasons: [
        "Generic command extraction requires contextual validation before VERIFIED promotion.",
      ],
    };
  }


  return {
    candidate,
    classification:
      "REQUIRES_REVIEW",
    reasons: [
      "No deterministic auto-promotion rule matched.",
    ],
  };
}


const classified =
  input.candidates.map(
    classify,
  );


const output = {
  formatVersion: 1,

  sourceId:
    "OFFICIAL_SOFTONE_BLACKBOOK_3_5",

  total:
    classified.length,

  byClassification:
    classified.reduce<
      Record<string, number>
    >(
      (
        acc,
        item,
      ) => {
        acc[
          item.classification
        ] =
          (
            acc[
              item.classification
            ] ?? 0
          ) + 1;

        return acc;
      },
      {},
    ),

  classified,
};


fs.writeFileSync(
  "data/softone-blackbook-classified-candidates.json",

  JSON.stringify(
    output,
    null,
    2,
  ) + "\n",
);


console.log(
  JSON.stringify(
    {
      total:
        output.total,

      byClassification:
        output.byClassification,

      safeVerifiedByKind:
        Object.fromEntries(
          [
            ...new Set(
              classified
                .filter(
                  item =>
                    item.classification ===
                    "SAFE_VERIFIED",
                )
                .map(
                  item =>
                    item.candidate
                      .extractionKind,
                ),
            ),
          ].map(
            kind => [
              kind,

              classified.filter(
                item =>
                  item.classification ===
                    "SAFE_VERIFIED" &&
                  item.candidate
                    .extractionKind ===
                    kind,
              ).length,
            ],
          ),
        ),

      safeVerifiedByChapter:
        Object.fromEntries(
          Array.from(
            {
              length: 14,
            },
            (
              _,
              index,
            ) =>
              index + 1,
          ).map(
            chapter => [
              chapter,

              classified.filter(
                item =>
                  item.classification ===
                    "SAFE_VERIFIED" &&
                  item.candidate.chapter ===
                    chapter,
              ).length,
            ],
          ),
        ),
    },
    null,
    2,
  ),
);
