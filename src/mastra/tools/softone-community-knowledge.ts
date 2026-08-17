import {
  createTool,
} from "@mastra/core/tools";

import {
  z,
} from "zod";

import {
  searchSoftOneEvidenceCatalog,
  getSoftOneEvidenceCatalogStats,
} from "../softone/evidence-catalog";

import {
  listSoftOneReviewQueue,
  getSoftOneReviewQueueStats,
} from "../softone/review-queue";

import {
  SOFTONE_SOURCE_REGISTRY,
} from "../softone/source-registry";

import {
  searchSoftOneBlackBookCorpus,
  getSoftOneBlackBookCorpusStats,
} from "../softone/blackbook-corpus";

function normalize(
  value: string,
): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .replace(
      /[^a-z0-9α-ωάέήίόύώϊϋΐΰ._:-]+/gi,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}

function queryTerms(
  query: string,
): string[] {
  return [
    ...new Set(
      normalize(query)
        .split(" ")
        .map(term =>
          term.trim(),
        )
        .filter(term =>
          term.length >= 2,
        ),
    ),
  ];
}


function sourceAuthority(
  sourceId: string,
): string | undefined {
  return SOFTONE_SOURCE_REGISTRY.find(
    source =>
      source.id === sourceId,
  )?.authority;
}


function isOfficialVerifiedEvidence(
  record:
    ReturnType<
      typeof searchSoftOneEvidenceCatalog
    >[number],
): boolean {
  if (
    record.status !==
    "VERIFIED"
  ) {
    return false;
  }

  return record.sources.some(
    source => {
      const authority =
        sourceAuthority(
          source.sourceId,
        );

      return (
        authority ===
          "OFFICIAL_DOCUMENTATION" ||
        authority ===
          "OFFICIAL_TRAINING"
      );
    },
  );
}


function scoreReviewItem(
  item:
    ReturnType<
      typeof listSoftOneReviewQueue
    >[number],

  terms:
    string[],
): number {
  const subject =
    normalize(
      item.subject ?? "",
    );

  const classification =
    normalize(
      item.classification ?? "",
    );

  const reason =
    normalize(
      item.reason ?? "",
    );

  const claim =
    normalize(
      item.evidence?.claim ?? "",
    );

  const notes =
    normalize(
      (item.notes ?? [])
        .join(" "),
    );

  const raw =
    normalize(
      JSON.stringify(
        item.rawReference ?? {},
      ),
    );

  let score = 0;

  for (
    const term of terms
  ) {
    if (
      subject.includes(term)
    ) {
      score += 8;
    }

    if (
      claim.includes(term)
    ) {
      score += 6;
    }

    if (
      classification.includes(term)
    ) {
      score += 4;
    }

    if (
      reason.includes(term)
    ) {
      score += 3;
    }

    if (
      notes.includes(term)
    ) {
      score += 2;
    }

    if (
      raw.includes(term)
    ) {
      score += 1;
    }
  }

  return score;
}

function evidenceMatchesQuery(
  record:
    ReturnType<
      typeof searchSoftOneEvidenceCatalog
    >[number],

  terms:
    string[],
): {
  matchedTerms:
    string[];

  coverage:
    number;
} {
  const haystack =
    normalize(
      [
        record.id,
        record.claim,
        record.kind,
        record.status,
        record.scope,
        ...(record.tags ?? []),
        ...(
          record.sources ?? []
        ).flatMap(source => [
          source.sourceId,
          source.sourceTitle,
          source.section,
          source.notes?.join(" "),
        ]),
      ]
        .filter(Boolean)
        .join(" "),
    );

  const matchedTerms =
    terms.filter(
      term =>
        haystack.includes(
          term,
        ),
    );

  return {
    matchedTerms,

    coverage:
      terms.length > 0
        ? matchedTerms.length /
          terms.length
        : 0,
  };
}

export const softoneCommunityKnowledge =
  createTool({
    id:
      "softone-community-knowledge",

    description:
      [
        "Unified read-only SoftOne technical/community knowledge lookup.",
        "Always searches both accepted evidence and unresolved review material.",
        "Returns evidence and review material separately.",
        "Review material may contain failed attempts, tenant-specific values and unverified proposals and must never be treated as confirmed fact.",
        "Use this tool first for SoftOne scripting, Scheduler, imports, customization, event, form, SQL recipe and community-knowledge questions.",
      ].join(" "),

    inputSchema:
      z.object({
        query:
          z.string()
            .min(1),

        includeStats:
          z.boolean()
            .default(false),

        limit:
          z.number()
            .int()
            .min(1)
            .max(50)
            .default(20),
      }),

    execute:
      async input => {
        const terms =
          queryTerms(
            input.query,
          );

        /*
         * Evidence catalog already has its own ranking.
         * We additionally expose lexical query coverage so
         * the agent can see whether a result actually covers
         * the whole requested relationship.
         */
        const rawEvidence =
          searchSoftOneEvidenceCatalog({
            query:
              input.query,

            limit:
              Math.max(
                input.limit,
                30,
              ),
          });

        const evidence =
          rawEvidence
            .map(record => {
              const match =
                evidenceMatchesQuery(
                  record,
                  terms,
                );

              return {
                record,

                matchedTerms:
                  match.matchedTerms,

                queryCoverage:
                  match.coverage,

                directlyResolvesQuery:
                  terms.length > 0 &&
                  match.coverage === 1,
              };
            })
            .filter(
              result =>
                result.matchedTerms
                  .length > 0,
            )
            .slice(
              0,
              input.limit,
            );

        /*
         * Official BlackBook corpus search.
         *
         * This is deliberately separate from structured evidence.
         * A corpus hit proves that source text exists in the official
         * BlackBook v3.5, but it must not automatically be promoted
         * into an atomic VERIFIED claim.
         */
        const corpus =
          searchSoftOneBlackBookCorpus({
            query:
              input.query,

            limit:
              input.limit,
          });


        /*
         * Review queue search is intentionally independent
         * from evidence search.
         *
         * This ensures FAILED / REJECTED material is surfaced
         * even when no accepted evidence exists.
         */
        const review =
          listSoftOneReviewQueue()
            .map(item => ({
              item,

              score:
                scoreReviewItem(
                  item,
                  terms,
                ),
            }))
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
            .slice(
              0,
              input.limit,
            );

        const authoritativeEvidence =
          evidence.filter(
            result =>
              isOfficialVerifiedEvidence(
                result.record,
              ),
          );

        const directlyResolvingAuthoritativeEvidence =
          authoritativeEvidence.filter(
            result =>
              result.directlyResolvesQuery,
          );

        const failedReview =
          review.filter(
            result =>
              result.item.status ===
                "REJECTED" ||
              result.item.classification ===
                "FAILED",
          );

        const pendingReview =
          review.filter(
            result =>
              result.item.status ===
                "PENDING",
          );

        return {
          success:
            true,

          query:
            input.query,

          terms,

          materialType:
            "SOFTONE_COMBINED_KNOWLEDGE",

          evidence: {
            count:
              evidence.length,

            results:
              evidence,
          },

          corpus: {
            count:
              corpus.length,

            sourceId:
              "OFFICIAL_SOFTONE_BLACKBOOK_3_5",

            softOneVersion:
              "3.5",

            results:
              corpus.map(
                result => ({
                  page:
                    result.chunk.page,

                  chapter:
                    result.chunk.chapter,

                  chapterTitle:
                    result.chunk.chapterTitle,

                  section:
                    result.chunk.section,

                  chunkIndex:
                    result.chunk.chunkIndex,

                  score:
                    result.score,

                  matchedTerms:
                    result.matchedTerms,

                  queryCoverage:
                    result.queryCoverage,

                  text:
                    result.chunk.text,

                  provenance: {
                    sourceId:
                      result.chunk.sourceId,

                    softOneVersion:
                      result.chunk.softOneVersion,

                    page:
                      result.chunk.page,

                    chapter:
                      result.chunk.chapter,

                    chapterTitle:
                      result.chunk.chapterTitle,

                    section:
                      result.chunk.section,
                  },
                }),
              ),
          },

          review: {
            count:
              review.length,

            failedCount:
              failedReview.length,

            pendingCount:
              pendingReview.length,

            results:
              review,
          },

          decisionSupport: {
            hasDirectEvidence:
              evidence.some(
                result =>
                  result
                    .directlyResolvesQuery,
              ),

            hasAuthoritativeEvidence:
              authoritativeEvidence.length >
              0,

            hasDirectAuthoritativeEvidence:
              directlyResolvingAuthoritativeEvidence.length >
              0,

            authoritativeEvidenceCount:
              authoritativeEvidence.length,

            authoritativeSourceIds: [
              ...new Set(
                authoritativeEvidence.flatMap(
                  result =>
                    result.record.sources
                      .filter(source => {
                        const authority =
                          sourceAuthority(
                            source.sourceId,
                          );

                        return (
                          authority ===
                            "OFFICIAL_DOCUMENTATION" ||
                          authority ===
                            "OFFICIAL_TRAINING"
                        );
                      })
                      .map(
                        source =>
                          source.sourceId,
                      ),
                ),
              ),
            ],

            hasFailedMaterial:
              failedReview.length >
              0,

            hasPendingMaterial:
              pendingReview.length >
              0,

            rule:
              [
                "Evidence and review material are separate.",
                "VERIFIED evidence backed by OFFICIAL_DOCUMENTATION or OFFICIAL_TRAINING is authoritative for the exact documented claim it supports.",
                "Community DERIVED evidence is supporting evidence only and must not override conflicting authoritative documentation.",
                "FAILED/REJECTED review material is negative context, never a working recipe.",
                "PENDING review material is unverified context.",
                "A partial evidence match must not be generalized to cover missing query terms or relationships.",
                "BlackBook corpus text is authoritative source material for what the document says, but a corpus hit is not automatically an atomic VERIFIED evidence record.",
                "When structured evidence exists, prefer it for exact claims; use corpus text to supply broader context, uncovered chapters, and surrounding documentation.",
                "The existence of a documented Scheduler OBJECT command does not establish that CLIENTIMPORT, FORMIMPORT, or arbitrary Form JavaScript is a valid Scheduler OBJECT value.",
                "Do not infer Scheduler execution context, client/server execution mode, or implementation support unless directly established by evidence.",
              ],
          },

          stats:
            input.includeStats
              ? {
                  evidence:
                    getSoftOneEvidenceCatalogStats(),

                  review:
                    getSoftOneReviewQueueStats(),

                  corpus:
                    getSoftOneBlackBookCorpusStats(),
                }
              : undefined,

          safety: {
            readOnly:
              true,

            writePerformed:
              false,

            reviewMaterialVerified:
              false,
          },
        };
      },
  });
