import type {
  NormalizedCorpusClassification,
  NormalizedCorpusFile,
  NormalizedCorpusThread,
} from "./normalized-corpus-importer";

import type {
  Soft1ForumCorpusFile,
  Soft1ForumMessage,
  Soft1ForumThread,
} from "./soft1-forum-corpus-types";


function normalizeText(
  value:
    string,
): string {
  return value
    .replace(/\r/g, "")
    .replace(
      /[ \t]+/g,
      " ",
    )
    .replace(
      /\n{3,}/g,
      "\n\n",
    )
    .trim();
}


function isLegacyProjectionMessage(
  message:
    Soft1ForumMessage,
): boolean {
  return message
    .messageId
    .startsWith(
      "legacy-projection:",
    );
}


function isLegacyProjectionOnly(
  thread:
    Soft1ForumThread,
): boolean {
  return (
    thread.messages.length >
      0 &&
    thread.messages.every(
      isLegacyProjectionMessage,
    )
  );
}


function detectConfirmation(
  value:
    string,
): boolean {
  const text =
    value.toLowerCase();

  const patterns = [
    "δούλεψε",
    "δουλεψε",
    "λειτούργησε",
    "λειτουργησε",
    "το έλυσα",
    "το ελυσα",
    "το έλυσε",
    "το ελυσε",
    "λύθηκε",
    "λυθηκε",
    "worked",
    "it worked",
    "this worked",
    "works now",
    "solved",
    "fixed",
    "confirmed",
  ];

  return patterns.some(
    pattern =>
      text.includes(
        pattern,
      ),
  );
}


function detectFailure(
  value:
    string,
): boolean {
  const text =
    value.toLowerCase();

  const patterns = [
    "δεν δούλεψε",
    "δεν δουλεψε",
    "δεν λειτουργεί",
    "δεν λειτουργει",
    "δεν λειτούργησε",
    "δεν λειτουργησε",
    "δεν παίζει",
    "δεν παιζει",
    "not working",
    "doesn't work",
    "does not work",
    "didn't work",
    "did not work",
    "failed",
    "fails",
  ];

  return patterns.some(
    pattern =>
      text.includes(
        pattern,
      ),
  );
}


function containsLikelyTechnicalContent(
  value:
    string,
): boolean {
  return [
    /\bX\.[A-Z0-9_]+\b/i,
    /\bS1P\.[A-Z0-9_]+\b/i,
    /\bSELECT\b/i,
    /\bUPDATE\b/i,
    /\bINSERT\b/i,
    /\bDELETE\b/i,
    /\bFROM\b/i,
    /\bWHERE\b/i,
    /\bJOIN\b/i,
    /\bfunction\s+[A-Za-z0-9_]+\s*\(/i,
    /\bCREATEOBJ\b/i,
    /\bGETSQLDATASET\b/i,
    /\bDBLocate\b/i,
    /\bDBPost\b/i,
    /\bFORMIMPORT\b/i,
    /\bCLIENTIMPORT\b/i,
    /:[A-Z][A-Z0-9_.]+/,
    /^\/[a-z0-9_-]+$/im,
  ].some(
    pattern =>
      pattern.test(
        value,
      ),
  );
}


function orderedMessages(
  thread:
    Soft1ForumThread,
): Soft1ForumMessage[] {
  return [
    ...thread.messages,
  ].sort(
    (a, b) => {
      const dateCompare =
        (
          a.publishedAt ??
          ""
        ).localeCompare(
          b.publishedAt ??
          "",
        );

      if (dateCompare !== 0) {
        return dateCompare;
      }

      return a.messageId
        .localeCompare(
          b.messageId,
        );
    },
  );
}


function buildRawThreadText(
  thread:
    Soft1ForumThread,
): string {
  return orderedMessages(
    thread,
  )
    .filter(
      message =>
        !isLegacyProjectionMessage(
          message,
        ),
    )
    .map(
      (
        message,
        index,
      ) => {
        const author =
          message.author ??
          message.email ??
          "UNKNOWN";

        return [
          `MESSAGE ${index + 1}`,
          `AUTHOR: ${author}`,

          message.publishedAt
            ? `DATE: ${message.publishedAt}`
            : undefined,

          normalizeText(
            message.body,
          ),
        ]
          .filter(Boolean)
          .join("\n");
      },
    )
    .join(
      "\n\n---\n\n",
    );
}


function classifyThread(
  thread:
    Soft1ForumThread,

  fullText:
    string,
):
  NormalizedCorpusClassification {
  const messages =
    orderedMessages(
      thread,
    ).filter(
      message =>
        !isLegacyProjectionMessage(
          message,
        ),
    );

  /*
   * Chronology-aware:
   * any explicit success confirmation wins over
   * earlier failed attempts.
   */
  if (
    messages.some(
      message =>
        detectConfirmation(
          message.body,
        ),
    )
  ) {
    return "CONFIRMED";
  }

  if (
    messages.some(
      message =>
        detectFailure(
          message.body,
        ),
    )
  ) {
    return "FAILED";
  }

  if (
    containsLikelyTechnicalContent(
      fullText,
    )
  ) {
    return "MENTION";
  }

  return "PROSE_REVIEW";
}


function normalizeThread(
  thread:
    Soft1ForumThread,
): NormalizedCorpusThread {
  /*
   * Migration must be behavior-preserving.
   *
   * Until real forum messages are collected,
   * emit the original v1 normalized record exactly.
   */
  if (
    isLegacyProjectionOnly(
      thread,
    ) &&
    thread.normalized
  ) {
    return {
      sourceKey:
        thread.sourceKey,

      subject:
        thread.subject,

      classification:
        thread.normalized
          .classification,

      rawTechnicalContent:
        thread.normalized
          .rawTechnicalContent,

      notes: [
        ...thread.normalized
          .notes,
      ],
    };
  }

  const fullText =
    buildRawThreadText(
      thread,
    );

  const classification =
    classifyThread(
      thread,
      fullText,
    );

  const notes = [
    "Canonical forum source: SOFT1_DEVELOPERS_GROUP.",

    ...(thread.threadUrl
      ? [
          `Google Groups thread: ${thread.threadUrl}`,
        ]
      : []),

    ...(thread.gmailUrl
      ? [
          `Authenticated Gmail source: ${thread.gmailUrl}`,
        ]
      : []),

    `Forum messages collected: ${thread.messages.filter(
      message =>
        !isLegacyProjectionMessage(
          message,
        ),
    ).length}.`,

    `Thread completeness: ${thread.completeness}.`,

    ...(thread.completeness ===
    "PARTIAL"
      ? [
          "Thread archive is partial and must not be treated as complete discussion history.",
        ]
      : []),
  ];

  return {
    sourceKey:
      thread.sourceKey,

    subject:
      thread.subject,

    classification,

    /*
     * Preserve complete source context.
     * Claim decomposition can improve independently later.
     */
    rawTechnicalContent:
      containsLikelyTechnicalContent(
        fullText,
      )
        ? fullText
        : "",

    notes,
  };
}


export function normalizeSoft1ForumCorpus(
  corpus:
    Soft1ForumCorpusFile,
): NormalizedCorpusFile {
  if (
    corpus.formatVersion !==
    2
  ) {
    throw new Error(
      `Unsupported Soft1 forum corpus version: ${corpus.formatVersion}`,
    );
  }

  if (
    corpus.source !==
    "SOFT1_DEVELOPERS_GROUP"
  ) {
    throw new Error(
      `Unsupported Soft1 forum source: ${corpus.source}`,
    );
  }

  if (
    corpus.sourceUrl !==
    "https://groups.google.com/g/soft1"
  ) {
    throw new Error(
      `Unexpected Soft1 forum URL: ${corpus.sourceUrl}`,
    );
  }

  return {
    formatVersion:
      1,

    source:
      "Soft1 Developers Group via canonical forum corpus",

    threads:
      corpus.threads.map(
        normalizeThread,
      ),
  };
}
