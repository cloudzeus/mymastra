import {
  buildSoft1ThreadFingerprint,
  buildSoft1ThreadSourceKey,
} from "./soft1-group-ingestion";

import {
  runSoft1GroupPipeline,
} from "./soft1-group-pipeline";

import {
  shouldProcessSoftOneSource,
  updateSoftOneIngestionState,
} from "./ingestion-state";

import type {
  Soft1GroupPipelineInput,
  Soft1GroupPipelineResult,
} from "./soft1-group-pipeline";

export interface Soft1GroupBatchInput {
  threads:
    Soft1GroupPipelineInput[];

  stopOnError?:
    boolean;
}

export interface Soft1GroupBatchItemResult {
  sourceKey:
    string;

  subject:
    string;

  success:
    boolean;

  skipped:
    boolean;

  skipReason?:
    string;

  result?:
    Soft1GroupPipelineResult;

  error?:
    string;
}

export interface Soft1GroupBatchResult {
  total:
    number;

  processed:
    number;

  skipped:
    number;

  succeeded:
    number;

  failed:
    number;

  inserted:
    number;

  duplicates:
    number;

  needsReview:
    number;

  items:
    Soft1GroupBatchItemResult[];
}

export function runSoft1GroupBatch(
  input:
    Soft1GroupBatchInput,
): Soft1GroupBatchResult {
  const items:
    Soft1GroupBatchItemResult[] = [];

  let processed = 0;
  let skipped = 0;
  let inserted = 0;
  let duplicates = 0;
  let needsReview = 0;

  for (
    const threadInput of
      input.threads
  ) {
    const sourceKey =
      threadInput.sourceKey ??
      buildSoft1ThreadSourceKey(
        threadInput.thread,
      );

    const fingerprint =
      buildSoft1ThreadFingerprint(
        threadInput.thread,
      );

    if (
      !shouldProcessSoftOneSource(
        sourceKey,
        fingerprint,
      )
    ) {
      skipped++;

      items.push({
        sourceKey,

        subject:
          threadInput.thread.subject,

        success:
          true,

        skipped:
          true,

        skipReason:
          "UNCHANGED_FINGERPRINT",
      });

      continue;
    }

    try {
      processed++;

      const result =
        runSoft1GroupPipeline(
          threadInput,
        );

      inserted +=
        result.summary.inserted;

      duplicates +=
        result.summary.duplicates;

      needsReview +=
        result.summary.reviewCandidates;

      const persistedEvidenceIds =
        result.decisions
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
        sourceKey,

        sourceFingerprint:
          fingerprint,

        subject:
          threadInput.thread.subject,

        lastProcessedAt:
          new Date()
            .toISOString(),

        evidenceIds:
          [
            ...new Set(
              persistedEvidenceIds,
            ),
          ],

        reviewCount:
          result.summary
            .reviewCandidates,
      });

      items.push({
        sourceKey,

        subject:
          threadInput.thread.subject,

        success:
          true,

        skipped:
          false,

        result,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      items.push({
        sourceKey,

        subject:
          threadInput.thread.subject,

        success:
          false,

        skipped:
          false,

        error:
          message,
      });

      if (
        input.stopOnError
      ) {
        break;
      }
    }
  }

  return {
    total:
      items.length,

    processed,

    skipped,

    succeeded:
      items.filter(
        item =>
          item.success &&
          !item.skipped,
      ).length,

    failed:
      items.filter(
        item =>
          !item.success,
      ).length,

    inserted,

    duplicates,

    needsReview,

    items,
  };
}
