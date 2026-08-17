import {
  createHash,
} from "node:crypto";

import {
  buildSoft1ThreadFingerprint,
  inferSoft1GroupEvidenceLevel,
} from "./soft1-group-ingestion";

import {
  decomposeSoftOneTechnicalSource,
} from "./claim-decomposition";

import {
  ingestSoftOneEvidenceCandidate,
} from "./evidence-ingestion";

import type {
  Soft1GroupThread,
} from "./soft1-group-ingestion";

import type {
  SoftOneEvidenceRecord,
} from "./evidence-types";

import type {
  SoftOneIngestionCandidate,
} from "./ingestion-types";

export interface Soft1GroupPipelineInput {
  thread:
    Soft1GroupThread;

  rawTechnicalContent:
    string;

  tenantCode?: string;

  sourceKey?: string;

  autoAcceptObservedPatterns?:
    boolean;
}

export interface Soft1GroupPipelineResult {
  threadFingerprint:
    string;

  decomposition:
    ReturnType<
      typeof decomposeSoftOneTechnicalSource
    >;

  candidates:
    SoftOneIngestionCandidate[];

  decisions:
    ReturnType<
      typeof ingestSoftOneEvidenceCandidate
    >[];

  summary: {
    totalClaims:
      number;

    globalClaims:
      number;

    tenantClaims:
      number;

    recipeClaims:
      number;

    acceptedCandidates:
      number;

    reviewCandidates:
      number;

    inserted:
      number;

    duplicates:
      number;

    rejected:
      number;
  };
}

function hash(
  value: string,
): string {
  return createHash("sha256")
    .update(value)
    .digest("hex")
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
    normalizeIdPart(value);

  return normalized ||
    `THREAD_${hash(value).slice(0, 10)}`;
}

function decodeHtmlEntities(
  value: string,
): string {
  return value
    .replace(
      /&#x([0-9a-f]+);/gi,
      (_, hex) =>
        String.fromCodePoint(
          parseInt(hex, 16),
        ),
    )
    .replace(
      /&#([0-9]+);/g,
      (_, decimal) =>
        String.fromCodePoint(
          parseInt(decimal, 10),
        ),
    )
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
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
) {
  switch (type) {
    case "FUNCTION_USAGE":
      return [
        "SCRIPTING",
        "CUSTOMIZATION",
      ] as const;

    case "OBJECT_USAGE":
      return [
        "SCRIPTING",
        "OBJECT_MODEL",
      ] as const;

    case "SYSTEM_CONTEXT":
      return [
        "SCRIPTING",
        "SQL",
      ] as const;

    case "TENANT_LITERAL":
      return [
        "TENANT_CONFIGURATION",
      ] as const;

    case "RECIPE_CONDITION":
      return [
        "SQL",
        "SQLDATA",
      ] as const;

    case "CUSTOM_FIELD":
      return [
        "CUSTOMIZATION",
        "TENANT_CONFIGURATION",
      ] as const;

    default:
      return [
        "CUSTOMIZATION",
      ] as const;
  }
}

function candidateStatusForClaim(
  claim:
    ReturnType<
      typeof decomposeSoftOneTechnicalSource
    >["claims"][number],
  options: {
    tenantCode?: string;
    autoAcceptObservedPatterns:
      boolean;
  },
):
  | "ACCEPTED"
  | "NEEDS_REVIEW" {
  /*
   * Tenant facts cannot be accepted without
   * knowing which tenant owns the value.
   */
  if (
    claim.scope === "TENANT" &&
    !options.tenantCode
  ) {
    return "NEEDS_REVIEW";
  }

  /*
   * Unknown semantics always require review.
   */
  if (
    claim.scope === "UNKNOWN" ||
    claim.type === "UNKNOWN" ||
    claim.requiresReview
  ) {
    return "NEEDS_REVIEW";
  }

  /*
   * Observed function/object usage may be accepted
   * as DERIVED implementation evidence.
   * This still does NOT make the semantic claim VERIFIED.
   */
  if (
    options.autoAcceptObservedPatterns &&
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

  /*
   * Tenant literals and recipe conditions are
   * conservative by default.
   */
  return "NEEDS_REVIEW";
}

function buildEvidenceRecord(
  input:
    Soft1GroupPipelineInput,

  claim:
    ReturnType<
      typeof decomposeSoftOneTechnicalSource
    >["claims"][number],

  threadFingerprint:
    string,
): SoftOneEvidenceRecord {
  const id =
    [
      "GROUP",
      stableSubjectId(
        input.thread.subject,
      ),
      normalizeIdPart(
        claim.concept,
      ),
      hash(
        [
          threadFingerprint,
          claim.type,
          claim.scope,
          claim.statement,
          claim.sourceFragment,
        ].join("|"),
      ),
    ].join("_");

  const scope =
    claim.scope === "TENANT"
      ? "TENANT"
      : claim.scope === "RECIPE"
        ? "RECIPE"
        : "GLOBAL";

  return {
    id,

    claim:
      claim.statement,

    kind:
      evidenceKindForClaim(
        claim.type,
      ),

    status:
      "DERIVED",

    scope,

    tenantCode:
      scope === "TENANT"
        ? input.tenantCode
        : undefined,

    productAreas: [
      ...productAreasForClaim(
        claim.type,
      ),
    ],

    sources: [
      {
        sourceId:
          "SOFT1_DEVELOPERS_GROUP",

        sourceTitle:
          input.thread.subject,

        sourceUrl:
          input.thread.threadUrl,

        publishedAt:
          input.thread.messages
            .map(
              message =>
                message.date,
            )
            .filter(
              (
                value,
              ): value is string =>
                Boolean(value),
            )
            .sort()[0],

        notes: [
          `Thread fingerprint: ${threadFingerprint}`,
          `Observed source fragment: ${claim.sourceFragment}`,
          `Community evidence derived from thread confirmation state`,
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

      "Generated from deterministic claim decomposition of Soft1 Developers Group content.",

      "Evidence remains DERIVED unless independently verified by an authority appropriate to the claim category.",
    ],

    limitations: [
      "Community source may be SoftOne-version specific.",

      "Observed implementation must not be generalized beyond the stored claim.",

      ...(claim.scope ===
      "TENANT"
        ? [
            "Tenant-scoped value must not be reused by another tenant.",
          ]
        : []),

      ...(claim.scope ===
      "RECIPE"
        ? [
            "Recipe condition is contextual and does not establish universal business semantics.",
          ]
        : []),
    ],

    tags: [
      "soft1-developers-group",
      "pipeline",
      claim.type.toLowerCase(),
      claim.scope.toLowerCase(),
      ...claim.tags,
    ],
  };
}

export function runSoft1GroupPipeline(
  input:
    Soft1GroupPipelineInput,
): Soft1GroupPipelineResult {
  const raw =
    decodeHtmlEntities(
      input.rawTechnicalContent,
    ).trim();

  if (!raw) {
    throw new Error(
      "rawTechnicalContent is required.",
    );
  }

  const threadFingerprint =
    buildSoft1ThreadFingerprint(
      input.thread,
    );

  const decomposition =
    decomposeSoftOneTechnicalSource(
      raw,
    );

  const communityEvidence =
    inferSoft1GroupEvidenceLevel(
      input.thread,
    );

  const requestedAutoAccept =
    input.autoAcceptObservedPatterns ??
    true;

  /*
   * Automatic acceptance is allowed only when
   * the thread contains explicit success confirmation.
   *
   * A question, proposal or failed attempt may contain
   * valid-looking code but is not working evidence.
   */
  const autoAccept =
    requestedAutoAccept &&
    (
      communityEvidence.level ===
        "CONFIRMED" ||
      communityEvidence.level ===
        "CORROBORATED"
    );

  const candidates =
    decomposition.claims.map(
      (
        claim,
        index,
      ): SoftOneIngestionCandidate => {
        const status =
          candidateStatusForClaim(
            claim,
            {
              tenantCode:
                input.tenantCode,

              autoAcceptObservedPatterns:
                autoAccept,
            },
          );

        const evidence =
          buildEvidenceRecord(
            input,
            claim,
            threadFingerprint,
          );

        return {
          id:
            `PIPE_${hash(
              [
                threadFingerprint,
                claim.id,
                String(index),
              ].join("|"),
            )}`,

          source:
            "SOFT1_GMAIL",

          sourceKey:
            input.sourceKey ??
            input.thread.subject,

          sourceFingerprint:
            threadFingerprint,

          status,

          evidence,

          rawReference: {
            subject:
              input.thread.subject,

            publishedAt:
              evidence.sources[0]
                ?.publishedAt,

            gmailUrl:
              input.thread.gmailUrl,

            groupUrl:
              input.thread.threadUrl,
          },

          extraction: {
            automatic:
              true,

            confidence:
              status ===
              "ACCEPTED"
                ? "HIGH"
                : "MEDIUM",

            reason: [
              ...claim.reasons,

              status ===
              "ACCEPTED"
                ? "Deterministic observed technical pattern."
                : "Contextual or tenant-scoped claim requires review.",
            ],

            requiresHumanReview:
              status ===
              "NEEDS_REVIEW",
          },

          createdAt:
            new Date()
              .toISOString(),
        };
      },
    );

  const decisions =
    candidates.map(
      candidate =>
        ingestSoftOneEvidenceCandidate(
          candidate,
        ),
    );

  return {
    threadFingerprint,

    decomposition,

    candidates,

    decisions,

    summary: {
      totalClaims:
        decomposition.claims.length,

      globalClaims:
        decomposition.claims.filter(
          claim =>
            claim.scope ===
            "GLOBAL",
        ).length,

      tenantClaims:
        decomposition.claims.filter(
          claim =>
            claim.scope ===
            "TENANT",
        ).length,

      recipeClaims:
        decomposition.claims.filter(
          claim =>
            claim.scope ===
            "RECIPE",
        ).length,

      acceptedCandidates:
        candidates.filter(
          candidate =>
            candidate.status ===
            "ACCEPTED",
        ).length,

      reviewCandidates:
        candidates.filter(
          candidate =>
            candidate.status ===
            "NEEDS_REVIEW",
        ).length,

      inserted:
        decisions.filter(
          decision =>
            decision.action ===
            "INSERTED",
        ).length,

      duplicates:
        decisions.filter(
          decision =>
            decision.action ===
            "DUPLICATE",
        ).length,

      rejected:
        decisions.filter(
          decision =>
            decision.action ===
            "REJECTED",
        ).length,
    },
  };
}
