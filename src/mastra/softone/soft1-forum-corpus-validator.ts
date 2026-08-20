import type {
  Soft1ForumCorpusFile,
} from "./soft1-forum-corpus-types";


export interface Soft1ForumCorpusValidationResult {
  valid:
    boolean;

  errors:
    string[];

  warnings:
    string[];

  stats: {
    threads:
      number;

    messages:
      number;

    complete:
      number;

    partial:
      number;

    gmailAnchored:
      number;

    groupAnchored:
      number;

    duplicateSourceKeys:
      number;

    duplicateMessageIds:
      number;
  };
}


export function validateSoft1ForumCorpus(
  corpus:
    Soft1ForumCorpusFile,
): Soft1ForumCorpusValidationResult {
  const errors:
    string[] = [];

  const warnings:
    string[] = [];

  const sourceKeys =
    new Set<string>();

  let duplicateSourceKeys =
    0;

  let duplicateMessageIds =
    0;

  let messageCount =
    0;

  for (
    const thread of
    corpus.threads
  ) {
    if (
      !thread.sourceKey
        .trim()
    ) {
      errors.push(
        "Thread with empty sourceKey detected.",
      );
    }

    if (
      sourceKeys.has(
        thread.sourceKey,
      )
    ) {
      duplicateSourceKeys++;

      errors.push(
        `Duplicate sourceKey: ${thread.sourceKey}`,
      );
    }

    sourceKeys.add(
      thread.sourceKey,
    );

    if (
      !thread.subject
        .trim()
    ) {
      errors.push(
        `Thread ${thread.sourceKey} has empty subject.`,
      );
    }

    if (
      thread.messages.length ===
      0
    ) {
      errors.push(
        `Thread ${thread.sourceKey} has no messages.`,
      );
    }

    if (
      thread.completeness ===
        "COMPLETE" &&
      thread.messages.some(
        message =>
          message.messageId
            .startsWith(
              "legacy-projection:",
            ),
      )
    ) {
      errors.push(
        `COMPLETE thread ${thread.sourceKey} still contains legacy projection.`,
      );
    }

    const messageIds =
      new Set<string>();

    for (
      const message of
      thread.messages
    ) {
      messageCount++;

      if (
        !message.messageId
          .trim()
      ) {
        errors.push(
          `Thread ${thread.sourceKey} contains message without messageId.`,
        );
      }

      if (
        messageIds.has(
          message.messageId,
        )
      ) {
        duplicateMessageIds++;

        errors.push(
          `Duplicate messageId ${message.messageId} in ${thread.sourceKey}.`,
        );
      }

      messageIds.add(
        message.messageId,
      );

      if (
        !message.body
          .trim()
      ) {
        warnings.push(
          `Empty message body: ${thread.sourceKey}/${message.messageId}`,
        );
      }
    }

    if (
      thread.completeness ===
        "PARTIAL"
    ) {
      warnings.push(
        `Partial thread: ${thread.sourceKey}`,
      );
    }
  }

  return {
    valid:
      errors.length ===
      0,

    errors,

    warnings,

    stats: {
      threads:
        corpus.threads.length,

      messages:
        messageCount,

      complete:
        corpus.threads.filter(
          thread =>
            thread.completeness ===
            "COMPLETE",
        ).length,

      partial:
        corpus.threads.filter(
          thread =>
            thread.completeness ===
            "PARTIAL",
        ).length,

      gmailAnchored:
        corpus.threads.filter(
          thread =>
            Boolean(
              thread.gmailThreadId,
            ),
        ).length,

      groupAnchored:
        corpus.threads.filter(
          thread =>
            Boolean(
              thread.groupThreadId,
            ),
        ).length,

      duplicateSourceKeys,

      duplicateMessageIds,
    },
  };
}
