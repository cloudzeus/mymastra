import {
  createHash,
} from "node:crypto";

import {
  ingestSoftOneEvidenceCandidate,
} from "../src/mastra/softone/evidence-ingestion";

import {
  SOFTONE_BLACKBOOK_APPENDIX_ENTRIES,
} from "../src/mastra/softone/blackbook-appendix-registry";

import type {
  SoftOneIngestionCandidate,
} from "../src/mastra/softone/ingestion-types";


const SOURCE_ID =
  "OFFICIAL_SOFTONE_BLACKBOOK_3_5";


function hash(
  value: string,
): string {
  return createHash(
    "sha256",
  )
    .update(
      value,
      "utf8",
    )
    .digest(
      "hex",
    )
    .slice(
      0,
      24,
    )
    .toUpperCase();
}


function claimFor(
  registry: string,
  code: string,
  label: string,
): string {
  switch (
    registry
  ) {
    case "SODTYPE":
      return `SoftOne internal SODTYPE entity value ${code} means '${label}'.`;

    case "SOSOURCE":
      return `SoftOne internal SOSOURCE module value ${code} means '${label}'.`;

    case "ORIGIN":
      return `SoftOne FINDOC ORIGIN transaction-source value ${code} means '${label}'.`;

    case "CSTTYPE":
      return `SoftOne CSTINFO CSTTYPE value ${code} means '${label}'.`;

    default:
      throw new Error(
        `Unsupported appendix registry: ${registry}`,
      );
  }
}


const candidates:
  SoftOneIngestionCandidate[] =
  SOFTONE_BLACKBOOK_APPENDIX_ENTRIES.map(
    entry => {
      const claim =
        claimFor(
          entry.registry,
          entry.code,
          entry.label,
        );


      const evidenceId =
        `BLACKBOOK_APPENDIX_${hash(
          [
            entry.registry,
            entry.code,
            entry.label,
          ].join(
            "|",
          ),
        )}`;


      return {
        id:
          `CANDIDATE_${evidenceId}`,

        source:
          "BLACKBOOK",

        sourceKey:
          [
            SOURCE_ID,
            "APPENDIX",
            entry.registry,
            entry.code,
          ].join(
            ":",
          ),

        sourceFingerprint:
          hash(
            [
              SOURCE_ID,
              "3.5",
              entry.page,
              entry.section,
              entry.code,
              entry.label,
            ].join(
              "|",
            ),
          ),

        status:
          "ACCEPTED",

        evidence: {
          id:
            evidenceId,

          claim,

          kind:
            "BUSINESS_SEMANTIC",

          status:
            "VERIFIED",

          scope:
            "GLOBAL",

          productAreas:
            entry.registry ===
              "CSTTYPE"
              ? [
                  "CUSTOMIZATION",
                  "DATABASE_DESIGNER",
                ]
              : [
                  "OBJECT_MODEL",
                  "SCHEMA",
                ],

          sources: [
            {
              sourceId:
                SOURCE_ID,

              sourceTitle:
                "SoftOne BlackBook ENG ver.3.5",

              section:
                entry.section,

              page:
                entry.page,

              softOneVersion:
                "3.5",

              notes: [
                `Registry: ${entry.registry}`,
                `Code: ${entry.code}`,
                `Official label: ${entry.label}`,
                "Extraction: deterministic from BlackBook Appendix table.",
              ],
            },
          ],

          verificationNotes: [
            "Authoritative value from the SoftOne BlackBook v3.5 Appendix.",
          ],

          tags: [
            "blackbook-appendix",
            entry.registry,
            entry.code,
            entry.label,
          ],
        },

        rawReference: {
          page:
            entry.page,

          section:
            entry.section,
        },

        extraction: {
          automatic:
            true,

          confidence:
            "HIGH",

          reason: [
            "Structured BlackBook Appendix table.",
            "Code and label are explicitly documented.",
            "No LLM semantic inference was used.",
          ],

          requiresHumanReview:
            false,
        },

        createdAt:
          new Date()
            .toISOString(),
      };
    },
  );


let failed =
  0;


const summary =
  new Map<
    string,
    {
      total: number;
      verified: number;
      failed: number;
    }
  >();


for (
  const candidate
  of candidates
) {
  const result =
    ingestSoftOneEvidenceCandidate(
      candidate,
    );


  const registry =
    candidate.evidence.tags?.[
      1
    ] ??
    "UNKNOWN";


  const current =
    summary.get(
      registry,
    ) ?? {
      total:
        0,

      verified:
        0,

      failed:
        0,
    };


  current.total +=
    1;


  if (
    result.success &&
    result.effectiveStatus ===
      "VERIFIED"
  ) {
    current.verified +=
      1;
  }


  if (
    !result.success
  ) {
    current.failed +=
      1;

    failed +=
      1;


    console.error({
      evidenceId:
        candidate.evidence.id,

      claim:
        candidate.evidence.claim,

      action:
        result.action,

      errors:
        result.errors,

      warnings:
        result.warnings,
    });
  }


  summary.set(
    registry,
    current,
  );
}


console.table(
  [
    ...summary.entries(),
  ].map(
    (
      [
        registry,
        values,
      ],
    ) => ({
      registry,
      ...values,
    }),
  ),
);


console.log(
  "candidates:",
  candidates.length,
);

console.log(
  "failed:",
  failed,
);


if (
  failed > 0
) {
  throw new Error(
    `${failed} BlackBook Appendix evidence candidate(s) failed ingestion.`,
  );
}


console.log(
  "\nSOFTONE BLACKBOOK APPENDIX INGESTION: PASS",
);
