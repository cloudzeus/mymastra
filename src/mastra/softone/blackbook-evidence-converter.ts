import type {
  SoftOneEvidenceRecord,
  SoftOneEvidenceScope,
} from "./evidence-types";

import type {
  SoftOneBlackBookCandidate,
} from "./blackbook-types";

import {
  SOFTONE_BLACKBOOK_SOURCE_ID,
} from "./blackbook-types";


function mapScope(
  candidate: SoftOneBlackBookCandidate,
): SoftOneEvidenceScope {
  /*
   * BlackBook v3.5 is versioned documentation.
   * Even documented global-looking behavior remains VERSION scoped
   * until corroborated by another version-independent authoritative
   * source or explicitly promoted later.
   */
  return "VERSION";
}


export function convertBlackBookCandidateToEvidence(
  candidate: SoftOneBlackBookCandidate,
): SoftOneEvidenceRecord {
  if (
    candidate.sourceId !==
    SOFTONE_BLACKBOOK_SOURCE_ID
  ) {
    throw new Error(
      `Unexpected BlackBook sourceId: ${candidate.sourceId}`,
    );
  }

  if (
    candidate.promotionPolicy !==
      "DIRECT_VERIFICATION_ELIGIBLE"
    &&
    candidate.recommendedStatus ===
      "VERIFIED"
  ) {
    throw new Error(
      `Candidate ${candidate.id} cannot be VERIFIED under promotion policy ${candidate.promotionPolicy}`,
    );
  }

  return {
    id:
      candidate.id,

    claim:
      candidate.claim,

    kind:
      candidate.evidenceKind,

    status:
      candidate.recommendedStatus,

    scope:
      mapScope(candidate),

    softOneVersion:
      "3.5",

    productAreas:
      candidate.productAreas,

    sources: [
      {
        sourceId:
          SOFTONE_BLACKBOOK_SOURCE_ID,

        sourceTitle:
          "SoftOne BlackBook ENG ver.3.5",

        section:
          candidate.section,

        page:
          candidate.page,

        softOneVersion:
          "3.5",

        notes: [
          `Chapter ${candidate.chapter}: ${candidate.chapterTitle}`,
          `Extraction kind: ${candidate.extractionKind}`,
          `Promotion policy: ${candidate.promotionPolicy}`,
        ],
      },
    ],

    limitations:
      candidate.limitations,

    verificationNotes: [
      ...(candidate.verificationNotes ?? []),
      "Verified against official SoftOne BlackBook v3.5 documentation.",
      "VERSION scoped; do not assume unchanged behavior across other SoftOne versions without corroboration.",
    ],

    tags: [
      ...(candidate.tags ?? []),

      candidate.symbol
        ? `symbol:${candidate.symbol}`
        : "",

      "official-documentation",
      "blackbook-v3.5",
    ].filter(Boolean),

    createdAt:
      new Date().toISOString(),

    updatedAt:
      new Date().toISOString(),
  };
}


export function convertBlackBookCandidatesToEvidence(
  candidates: readonly SoftOneBlackBookCandidate[],
): SoftOneEvidenceRecord[] {
  const ids =
    new Set<string>();

  return candidates.map(
    (candidate) => {
      if (
        ids.has(candidate.id)
      ) {
        throw new Error(
          `Duplicate BlackBook candidate id: ${candidate.id}`,
        );
      }

      ids.add(candidate.id);

      return convertBlackBookCandidateToEvidence(
        candidate,
      );
    },
  );
}
