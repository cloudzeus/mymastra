import {
  createTool,
} from "@mastra/core/tools";

import {
  z,
} from "zod";

import {
  listSoftOneReviewQueue,
  getSoftOneReviewQueueStats,
} from "../softone/review-queue";

export const softoneReviewKnowledge =
  createTool({
    id:
      "softone-review-knowledge",

    description:
      [
        "Read-only access to SoftOne review-queue material.",
        "This material is NOT verified evidence.",
        "Use it only for unresolved, proposed, failed, tenant-specific, recipe-specific, or prose-review context.",
        "Never treat review-queue content as VERIFIED or authoritative.",
      ].join(" "),

    inputSchema:
      z.object({
        query:
          z.string()
            .optional(),

        status:
          z.enum([
            "PENDING",
            "APPROVED",
            "REJECTED",
            "RESOLVED",
          ])
            .optional(),

        classification:
          z.string()
            .optional(),

        sourceKey:
          z.string()
            .optional(),

        subject:
          z.string()
            .optional(),

        includeStats:
          z.boolean()
            .default(true),

        limit:
          z.number()
            .int()
            .min(1)
            .max(100)
            .default(25),
      }),

    execute:
      async input => {
        const {
          query,
          status,
          classification,
          sourceKey,
          subject,
          includeStats,
          limit,
        } = input;

        let items =
          listSoftOneReviewQueue(
            status,
          );

        if (
          classification
        ) {
          const wanted =
            classification
              .toLowerCase();

          items =
            items.filter(
              item =>
                (
                  item.classification ??
                  ""
                )
                  .toLowerCase() ===
                wanted,
            );
        }

        if (
          sourceKey
        ) {
          items =
            items.filter(
              item =>
                item.sourceKey ===
                sourceKey,
            );
        }

        if (
          subject
        ) {
          const wanted =
            subject
              .toLowerCase();

          items =
            items.filter(
              item =>
                (
                  item.subject ??
                  ""
                )
                  .toLowerCase()
                  .includes(
                    wanted,
                  ),
            );
        }

        if (
          query
        ) {
          const terms =
            query
              .toLowerCase()
              .split(/\s+/)
              .filter(Boolean);

          items =
            items
              .map(
                item => {
                  const haystack =
                    [
                      item.subject,
                      item.classification,
                      item.reason,
                      item.evidence
                        ?.claim,
                      item.evidence
                        ?.kind,
                      item.evidence
                        ?.scope,
                      ...(
                        item.notes ??
                        []
                      ),
                      JSON.stringify(
                        item.rawReference ??
                        {},
                      ),
                    ]
                      .filter(Boolean)
                      .join(" ")
                      .toLowerCase();

                  const score =
                    terms.reduce(
                      (
                        total,
                        term,
                      ) =>
                        total +
                        (
                          haystack.includes(
                            term,
                          )
                            ? 1
                            : 0
                        ),
                      0,
                    );

                  return {
                    item,
                    score,
                  };
                },
              )
              .filter(
                result =>
                  result.score > 0,
              )
              .sort(
                (
                  a,
                  b,
                ) =>
                  b.score -
                  a.score,
              )
              .map(
                result =>
                  result.item,
              );
        }

        const limited =
          items.slice(
            0,
            limit,
          );

        return {
          materialType:
            "UNVERIFIED_REVIEW_QUEUE",

          safety: {
            readOnly:
              true,

            verifiedEvidence:
              false,

            mayContainFailedAttempts:
              true,

            mayContainTenantSpecificValues:
              true,

            mayContainUnverifiedClaims:
              true,

            instruction:
              "Review queue material must never be promoted to fact without appropriate verification.",
          },

          count:
            limited.length,

          totalMatched:
            items.length,

          items:
            limited,

          stats:
            includeStats
              ? getSoftOneReviewQueueStats()
              : undefined,
        };
      },
  });
