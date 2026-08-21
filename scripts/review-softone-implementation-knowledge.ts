import {
  ingestSoftOneEvidenceCandidate,
} from "../src/mastra/softone/evidence-ingestion";

import {
  listSoftOneReviewQueue,
  setSoftOneReviewQueueStatus,
} from "../src/mastra/softone/review-queue";

import type {
  SoftOneIngestionCandidate,
} from "../src/mastra/softone/ingestion-types";


function printPending() {
  const items =
    listSoftOneReviewQueue(
      "PENDING",
    );


  console.table(
    items.map(
      item => ({
        reviewId:
          item.id,

        classification:
          item.classification,

        claim:
          item.evidence?.claim,

        kind:
          item.evidence?.kind,

        evidenceStatus:
          item.evidence?.status,

        source:
          item.evidence
            ?.sources?.[0]
            ?.sourceTitle,
      }),
    ),
  );


  console.log(
    `pending: ${items.length}`,
  );
}


function approve(
  id: string,
  note?: string,
) {
  const items =
    listSoftOneReviewQueue();


  const item =
    items.find(
      candidate =>
        candidate.id ===
        id,
    );


  if (!item) {
    throw new Error(
      `Review item not found: ${id}`,
    );
  }


  if (
    !item.evidence
  ) {
    throw new Error(
      `Review item has no evidence: ${id}`,
    );
  }


  if (
    item.evidence.status ===
    "VERIFIED"
  ) {
    throw new Error(
      "Implementation-derived evidence must not enter ingestion as VERIFIED",
    );
  }


  /*
   * Reconstruct the accepted candidate.
   *
   * Human approval removes the review gate,
   * but DOES NOT upgrade evidence status.
   */
  const candidate:
    SoftOneIngestionCandidate = {
    id:
      item.candidateId ??
      `REVIEWED_${item.id}`,

    source:
      "GITHUB",

    sourceKey:
      item.sourceKey,

    sourceFingerprint:
      item.sourceFingerprint,

    status:
      "ACCEPTED",

    evidence: {
      ...item.evidence,

      status:
        item.evidence.status ===
        "HYPOTHESIS"
          ? "HYPOTHESIS"
          : "DERIVED",

      verificationNotes: [
        ...(
          item.evidence
            .verificationNotes ??
          []
        ),

        "Human-reviewed implementation evidence.",
      ],
    },

    rawReference:
      item.rawReference,

    extraction: {
      automatic:
        true,

      confidence:
        "MEDIUM",

      reason: [
        "Implementation-derived claim approved by human review.",
        ...item.notes,
      ],

      requiresHumanReview:
        false,
    },

    createdAt:
      item.createdAt,
  };


  const decision =
    ingestSoftOneEvidenceCandidate(
      candidate,
    );


  if (
    !decision.success
  ) {
    throw new Error(
      [
        "Evidence ingestion failed:",
        ...decision.errors,
        ...decision.warnings,
      ].join(
        " ",
      ),
    );
  }


  setSoftOneReviewQueueStatus(
    id,
    "RESOLVED",
    note ??
      "Approved and ingested as reviewed implementation evidence.",
  );


  console.log(
    "INGESTED:",
    {
      reviewId:
        id,

      evidenceId:
        decision.evidenceId,

      action:
        decision.action,

      effectiveStatus:
        decision.effectiveStatus,

      corroboration:
        decision.corroboration,
    },
  );
}


function reject(
  id: string,
  note?: string,
) {
  setSoftOneReviewQueueStatus(
    id,
    "REJECTED",
    note ??
      "Rejected during implementation knowledge review.",
  );


  console.log(
    `REJECTED: ${id}`,
  );
}


function main() {
  const command =
    process.argv[2] ??
    "list";


  if (
    command === "list"
  ) {
    printPending();

    return;
  }


  const id =
    process.argv[3];


  if (!id) {
    throw new Error(
      "Review item id is required",
    );
  }


  const note =
    process.argv
      .slice(4)
      .join(
        " ",
      )
      .trim() ||
    undefined;


  if (
    command === "approve"
  ) {
    approve(
      id,
      note,
    );

    return;
  }


  if (
    command === "reject"
  ) {
    reject(
      id,
      note,
    );

    return;
  }


  throw new Error(
    `Unknown command: ${command}`,
  );
}


try {
  main();
}
catch (
  error
) {
  console.error(
    "\nSOFTONE IMPLEMENTATION KNOWLEDGE REVIEW: FAIL",
  );

  console.error(
    error,
  );

  process.exitCode =
    1;
}
