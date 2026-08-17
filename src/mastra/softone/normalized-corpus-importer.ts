import {
  readFileSync,
} from "node:fs";

import {
  resolve,
} from "node:path";

import {
  createHash,
} from "node:crypto";

import {
  decomposeSoftOneTechnicalSource,
} from "./claim-decomposition";

import {
  ingestSoftOneEvidenceCandidate,
} from "./evidence-ingestion";

import {
  shouldProcessSoftOneSource,
  updateSoftOneIngestionState,
} from "./ingestion-state";

import {
  enqueueSoftOneCandidateForReview,
  enqueueSoftOneReviewItem,
} from "./review-queue";


import type {
  SoftOneEvidenceRecord,
} from "./evidence-types";

import type {
  SoftOneIngestionCandidate,
} from "./ingestion-types";

export type NormalizedCorpusClassification =
  | "CONFIRMED"
  | "MENTION"
  | "FAILED"
  | "PROSE_REVIEW"
  | "BUSINESS_IDEA";

export interface NormalizedCorpusThread {
  sourceKey:
    string;

  subject:
    string;

  classification:
    NormalizedCorpusClassification;

  rawTechnicalContent:
    string;

  notes:
    string[];
}

export interface NormalizedCorpusFile {
  formatVersion:
    number;

  source:
    string;

  threads:
    NormalizedCorpusThread[];
}

export interface NormalizedCorpusThreadResult {
  sourceKey:
    string;

  subject:
    string;

  classification:
    NormalizedCorpusClassification;

  processed:
    boolean;

  skipped:
    boolean;

  skipReason?:
    string;

  totalClaims:
    number;

  inserted:
    number;

  needsReview:
    number;

  rejected:
    number;

  evidenceIds:
    string[];
}

export interface NormalizedCorpusImportResult {
  totalThreads:
    number;

  processed:
    number;

  skipped:
    number;

  inserted:
    number;

  needsReview:
    number;

  rejected:
    number;

  byClassification:
    Record<
      NormalizedCorpusClassification,
      number
    >;

  threads:
    NormalizedCorpusThreadResult[];
}

function hash(
  value: string,
): string {
  return createHash("sha256")
    .update(value)
    .digest("hex");
}

function shortHash(
  value: string,
): string {
  return hash(value)
    .slice(0, 12)
    .toUpperCase();
}

function normalizeIdPart(
  value: string,
): string {
  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .toUpperCase()
    .replace(
      /[^A-Z0-9]+/g,
      "_",
    )
    .replace(
      /^_+|_+$/g,
      "",
    )
    .slice(0, 48);
}

function stableSubjectId(
  value: string,
): string {
  const normalized =
    normalizeIdPart(
      value,
    );

  return (
    normalized ||
    `THREAD_${shortHash(value).slice(0, 10)}`
  );
}

function buildThreadFingerprint(
  thread:
    NormalizedCorpusThread,
): string {
  return hash(
    JSON.stringify({
      sourceKey:
        thread.sourceKey,

      subject:
        thread.subject,

      classification:
        thread.classification,

      rawTechnicalContent:
        thread.rawTechnicalContent,

      notes:
        thread.notes,
    }),
  );
}

function evidenceKindForClaim(
  type:
    ReturnType<
      typeof decomposeSoftOneTechnicalSource
    >["claims"][number]["type"],
): SoftOneEvidenceRecord["kind"] {
  switch (type) {
    case "FUNCTION_USAGE":
      return "FUNCTION";

    case "OBJECT_USAGE":
      return "OBJECT_BEHAVIOR";

    case "SYSTEM_CONTEXT":
      return "SCRIPT_PATTERN";

    case "TENANT_LITERAL":
      return "TENANT_RULE";

    case "RECIPE_CONDITION":
      return "BUSINESS_SEMANTIC";

    case "CUSTOM_FIELD":
      return "FIELD_SEMANTICS";

    default:
      return "SCRIPT_PATTERN";
  }
}

function productAreasForClaim(
  type:
    ReturnType<
      typeof decomposeSoftOneTechnicalSource
    >["claims"][number]["type"],
): SoftOneEvidenceRecord["productAreas"] {
  switch (type) {
    case "FUNCTION_USAGE":
      return [
        "SCRIPTING",
        "CUSTOMIZATION",
      ];

    case "OBJECT_USAGE":
      return [
        "SCRIPTING",
        "OBJECT_MODEL",
      ];

    case "SYSTEM_CONTEXT":
      return [
        "SCRIPTING",
        "SQL",
      ];

    case "TENANT_LITERAL":
      return [
        "TENANT_CONFIGURATION",
      ];

    case "RECIPE_CONDITION":
      return [
        "SQL",
        "SQLDATA",
      ];

    case "CUSTOM_FIELD":
      return [
        "CUSTOMIZATION",
        "TENANT_CONFIGURATION",
      ];

    default:
      return [
        "CUSTOMIZATION",
      ];
  }
}

function statusForClaim(
  classification:
    NormalizedCorpusClassification,

  claim:
    ReturnType<
      typeof decomposeSoftOneTechnicalSource
    >["claims"][number],
):
  | "ACCEPTED"
  | "NEEDS_REVIEW"
  | "REJECTED" {

  /*
   * FAILED threads must never write technical
   * evidence automatically.
   */
  if (
    classification ===
      "FAILED"
  ) {
    return "REJECTED";
  }

  /*
   * Prose-only and business-idea items are not
   * deterministic technical evidence.
   */
  if (
    classification ===
      "PROSE_REVIEW" ||
    classification ===
      "BUSINESS_IDEA"
  ) {
    return "NEEDS_REVIEW";
  }

  /*
   * Only confirmed GLOBAL observed technical
   * patterns may auto-enter as DERIVED.
   */
  if (
    classification ===
      "CONFIRMED" &&
    claim.scope ===
      "GLOBAL" &&
    (
      claim.type ===
        "FUNCTION_USAGE" ||
      claim.type ===
        "OBJECT_USAGE" ||
      claim.type ===
        "SYSTEM_CONTEXT"
    )
  ) {
    return "ACCEPTED";
  }

  return "NEEDS_REVIEW";
}

function buildEvidence(
  thread:
    NormalizedCorpusThread,

  claim:
    ReturnType<
      typeof decomposeSoftOneTechnicalSource
    >["claims"][number],

  fingerprint:
    string,
): SoftOneEvidenceRecord {
  const subjectId =
    stableSubjectId(
      thread.subject,
    );

  const claimHash =
    shortHash(
      [
        thread.sourceKey,
        fingerprint,
        claim.type,
        claim.scope,
        claim.statement,
        claim.sourceFragment,
      ].join("|"),
    );

  const scope =
    claim.scope ===
      "TENANT"
      ? "TENANT"
      : claim.scope ===
          "RECIPE"
        ? "RECIPE"
        : "GLOBAL";

  return {
    id:
      [
        "GMAIL",
        subjectId,
        normalizeIdPart(
          claim.concept,
        ) ||
          "CLAIM",
        claimHash,
      ].join("_"),

    claim:
      claim.statement,

    kind:
      evidenceKindForClaim(
        claim.type,
      ),

    status:
      "DERIVED",

    scope,

    productAreas:
      productAreasForClaim(
        claim.type,
      ),

    sources: [
      {
        sourceId:
          "SOFT1_DEVELOPERS_GROUP",

        sourceTitle:
          thread.subject,

        notes: [
          `Canonical source key: ${thread.sourceKey}`,
          `Source fingerprint: ${fingerprint}`,
          `Normalized classification: ${thread.classification}`,
          `Observed source fragment: ${claim.sourceFragment}`,
          ...thread.notes,
        ],
      },
    ],

    conditions:
      claim.type ===
        "RECIPE_CONDITION"
        ? [
            claim.sourceFragment,
          ]
        : undefined,

    verificationNotes: [
      ...claim.reasons,

      `Imported from normalized Soft1 Gmail corpus with classification ${thread.classification}.`,

      "Community evidence remains DERIVED unless independently verified by an appropriate authoritative source.",
    ],

    limitations: [
      "Community evidence may be SoftOne-version or installation specific.",

      "Observed implementation must not be generalized beyond the stored claim.",

      ...(claim.scope ===
        "TENANT"
        ? [
            "Tenant-sensitive value has no local tenant ownership assigned and must remain review-only.",
          ]
        : []),

      ...(claim.scope ===
        "RECIPE"
        ? [
            "Recipe condition is contextual and must not be treated as universal business semantics.",
          ]
        : []),
    ],

    tags: [
      "soft1-developers-group",
      "gmail-corpus",
      thread.classification
        .toLowerCase(),
      claim.type
        .toLowerCase(),
      claim.scope
        .toLowerCase(),
      ...claim.tags,
    ],
  };
}

function makeCandidate(
  thread:
    NormalizedCorpusThread,

  claim:
    ReturnType<
      typeof decomposeSoftOneTechnicalSource
    >["claims"][number],

  fingerprint:
    string,

  index:
    number,
): SoftOneIngestionCandidate {
  const status =
    statusForClaim(
      thread.classification,
      claim,
    );

  return {
    id:
      `CORPUS_${shortHash(
        [
          thread.sourceKey,
          fingerprint,
          claim.id,
          String(index),
        ].join("|"),
      )}`,

    source:
      "SOFT1_GMAIL",

    sourceKey:
      thread.sourceKey,

    sourceFingerprint:
      fingerprint,

    status,

    evidence:
      buildEvidence(
        thread,
        claim,
        fingerprint,
      ),

    rawReference: {
      subject:
        thread.subject,
    },

    extraction: {
      automatic:
        true,

      confidence:
        status ===
          "ACCEPTED"
          ? "HIGH"
          : status ===
              "REJECTED"
            ? "LOW"
            : "MEDIUM",

      reason: [
        ...claim.reasons,

        `Normalized thread classification: ${thread.classification}.`,
      ],

      requiresHumanReview:
        status !==
        "ACCEPTED",
    },

    createdAt:
      new Date()
        .toISOString(),
  };
}

export function loadNormalizedSoft1Corpus(
  path =
    resolve(
      process.cwd(),
      "data/soft1-gmail-corpus.initial.json",
    ),
): NormalizedCorpusFile {
  return JSON.parse(
    readFileSync(
      path,
      "utf8",
    ),
  ) as NormalizedCorpusFile;
}

export function importNormalizedSoft1Corpus(
  corpus:
    NormalizedCorpusFile,
): NormalizedCorpusImportResult {

  const threadResults:
    NormalizedCorpusThreadResult[] =
      [];

  let inserted = 0;
  let needsReview = 0;
  let rejected = 0;
  let processed = 0;
  let skipped = 0;

  const byClassification:
    Record<
      NormalizedCorpusClassification,
      number
    > = {
      CONFIRMED: 0,
      MENTION: 0,
      FAILED: 0,
      PROSE_REVIEW: 0,
      BUSINESS_IDEA: 0,
    };

  for (
    const thread of
      corpus.threads
  ) {
    byClassification[
      thread.classification
    ]++;

    const fingerprint =
      buildThreadFingerprint(
        thread,
      );

    if (
      !shouldProcessSoftOneSource(
        thread.sourceKey,
        fingerprint,
      )
    ) {
      skipped++;

      threadResults.push({
        sourceKey:
          thread.sourceKey,

        subject:
          thread.subject,

        classification:
          thread.classification,

        processed:
          false,

        skipped:
          true,

        skipReason:
          "UNCHANGED_FINGERPRINT",

        totalClaims:
          0,

        inserted:
          0,

        needsReview:
          0,

        rejected:
          0,

        evidenceIds:
          [],
      });

      continue;
    }

    processed++;

    /*
     * Prose-only / business-idea entries are persisted
     * directly in the review queue.
     *
     * They are intentionally not forced through the
     * deterministic technical parser.
     */
    if (
      !thread.rawTechnicalContent
        .trim()
    ) {
      enqueueSoftOneReviewItem({
        sourceKey:
          thread.sourceKey,

        sourceFingerprint:
          fingerprint,

        subject:
          thread.subject,

        classification:
          thread.classification,

        status:
          "PENDING",

        reason:
          thread.classification ===
          "BUSINESS_IDEA"
            ? "Business/workflow idea requires semantic review before becoming SoftOne knowledge."
            : "Prose-only technical claim requires human or authoritative-source review.",

        notes: [
          ...thread.notes,
          `Normalized classification: ${thread.classification}.`,
        ],
      });

      updateSoftOneIngestionState({
        sourceKey:
          thread.sourceKey,

        sourceFingerprint:
          fingerprint,

        subject:
          thread.subject,

        lastProcessedAt:
          new Date()
            .toISOString(),

        evidenceIds:
          [],

        reviewCount:
          1,
      });

      needsReview++;

      threadResults.push({
        sourceKey:
          thread.sourceKey,

        subject:
          thread.subject,

        classification:
          thread.classification,

        processed:
          true,

        skipped:
          false,

        totalClaims:
          0,

        inserted:
          0,

        needsReview:
          1,

        rejected:
          0,

        evidenceIds:
          [],
      });

      continue;
    }

    const decomposition =
      decomposeSoftOneTechnicalSource(
        thread.rawTechnicalContent,
      );

    /*
     * Preserve technical source even when the deterministic
     * parser does not yet understand any atomic claims.
     *
     * Examples:
     *   /usewebview2
     *   plain SQL structural snippets
     *   failed scheduler configuration text
     *
     * These must never silently disappear.
     */
    if (
      decomposition.claims.length === 0
    ) {
      const failed =
        thread.classification ===
        "FAILED";

      enqueueSoftOneReviewItem({
        sourceKey:
          thread.sourceKey,

        sourceFingerprint:
          fingerprint,

        subject:
          thread.subject,

        classification:
          thread.classification,

        status:
          failed
            ? "REJECTED"
            : "PENDING",

        reason:
          failed
            ? "FAILED technical thread retained as negative evidence; deterministic parser produced no atomic claims."
            : "Technical source produced no deterministic atomic claims and requires review or a specialized extractor.",

        rawReference: {
          subject:
            thread.subject,

          rawTechnicalContent:
            thread.rawTechnicalContent,
        },

        notes: [
          ...thread.notes,
          `Normalized classification: ${thread.classification}.`,
          "No deterministic claims were extracted.",
        ],
      });

      updateSoftOneIngestionState({
        sourceKey:
          thread.sourceKey,

        sourceFingerprint:
          fingerprint,

        subject:
          thread.subject,

        lastProcessedAt:
          new Date()
            .toISOString(),

        evidenceIds:
          [],

        reviewCount:
          failed
            ? 0
            : 1,
      });

      if (failed) {
        rejected++;
      } else {
        needsReview++;
      }

      threadResults.push({
        sourceKey:
          thread.sourceKey,

        subject:
          thread.subject,

        classification:
          thread.classification,

        processed:
          true,

        skipped:
          false,

        totalClaims:
          0,

        inserted:
          0,

        needsReview:
          failed
            ? 0
            : 1,

        rejected:
          failed
            ? 1
            : 0,

        evidenceIds:
          [],
      });

      continue;
    }

    const candidates =
      decomposition.claims.map(
        (
          claim,
          index,
        ) =>
          makeCandidate(
            thread,
            claim,
            fingerprint,
            index,
          ),
      );

    const decisions =
      candidates.map(
        candidate =>
          ingestSoftOneEvidenceCandidate(
            candidate,
          ),
      );

    /*
     * Persist every candidate that was not automatically
     * accepted into the review queue.
     *
     * FAILED candidates are also retained there so we keep
     * the negative evidence / failed-attempt context without
     * contaminating the evidence catalog.
     */
    for (
      let index = 0;
      index < candidates.length;
      index++
    ) {
      const candidate =
        candidates[index];

      const decision =
        decisions[index];

      if (
        candidate.status ===
          "NEEDS_REVIEW" ||
        candidate.status ===
          "REJECTED"
      ) {
        enqueueSoftOneCandidateForReview(
          candidate,
          {
            classification:
              thread.classification,

            reason:
              candidate.status ===
              "REJECTED"
                ? "Candidate originates from a FAILED thread and must not be promoted automatically."
                : "Candidate requires review before promotion.",

            notes: [
              ...thread.notes,

              ...(decision
                ? [
                    `Ingestion action: ${decision.action}`,
                  ]
                : []),
            ],
          },
        );
      }
    }

    const threadInserted =
      decisions.filter(
        decision =>
          decision.action ===
          "INSERTED",
      ).length;

    const threadReview =
      decisions.filter(
        decision =>
          decision.action ===
          "NEEDS_REVIEW",
      ).length;

    const threadRejected =
      decisions.filter(
        decision =>
          decision.action ===
          "REJECTED",
      ).length;

    inserted +=
      threadInserted;

    needsReview +=
      threadReview;

    rejected +=
      threadRejected;

    const evidenceIds =
      decisions
        .filter(
          decision =>
            decision.action ===
              "INSERTED" ||
            decision.action ===
              "UPDATED" ||
            decision.action ===
              "DUPLICATE",
        )
        .map(
          decision =>
            decision.evidenceId,
        );

    updateSoftOneIngestionState({
      sourceKey:
        thread.sourceKey,

      sourceFingerprint:
        fingerprint,

      subject:
        thread.subject,

      lastProcessedAt:
        new Date()
          .toISOString(),

      evidenceIds:
        [
          ...new Set(
            evidenceIds,
          ),
        ],

      reviewCount:
        threadReview,
    });

    threadResults.push({
      sourceKey:
        thread.sourceKey,

      subject:
        thread.subject,

      classification:
        thread.classification,

      processed:
        true,

      skipped:
        false,

      totalClaims:
        decomposition.claims
          .length,

      inserted:
        threadInserted,

      needsReview:
        threadReview,

      rejected:
        threadRejected,

      evidenceIds:
        [
          ...new Set(
            evidenceIds,
          ),
        ],
    });
  }

  return {
    totalThreads:
      corpus.threads.length,

    processed,

    skipped,

    inserted,

    needsReview,

    rejected,

    byClassification,

    threads:
      threadResults,
  };
}
