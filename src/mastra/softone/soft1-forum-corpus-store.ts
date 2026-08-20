import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";

import {
  dirname,
  resolve,
} from "node:path";

import type {
  Soft1ForumCorpusFile,
  Soft1ForumMessage,
  Soft1ForumThread,
} from "./soft1-forum-corpus-types";


const DEFAULT_PATH =
  resolve(
    process.cwd(),
    "data/soft1-forum-corpus.json",
  );


function corpusPath():
  string {
  return (
    process.env
      .SOFT1_FORUM_CORPUS_PATH ??
    DEFAULT_PATH
  );
}


export function createEmptySoft1ForumCorpus():
  Soft1ForumCorpusFile {
  return {
    formatVersion:
      2,

    source:
      "SOFT1_DEVELOPERS_GROUP",

    sourceUrl:
      "https://groups.google.com/g/soft1",

    collectedAt:
      new Date()
        .toISOString(),

    threads:
      [],
  };
}


export function loadSoft1ForumCorpus():
  Soft1ForumCorpusFile {
  const path =
    corpusPath();

  if (!existsSync(path)) {
    return createEmptySoft1ForumCorpus();
  }

  const parsed =
    JSON.parse(
      readFileSync(
        path,
        "utf8",
      ),
    ) as Soft1ForumCorpusFile;

  if (
    parsed.formatVersion !==
    2
  ) {
    throw new Error(
      `Unsupported Soft1 forum corpus formatVersion: ${parsed.formatVersion}`,
    );
  }

  if (
    parsed.source !==
    "SOFT1_DEVELOPERS_GROUP"
  ) {
    throw new Error(
      `Unexpected Soft1 forum corpus source: ${parsed.source}`,
    );
  }

  if (
    parsed.sourceUrl !==
    "https://groups.google.com/g/soft1"
  ) {
    throw new Error(
      `Unexpected Soft1 forum corpus sourceUrl: ${parsed.sourceUrl}`,
    );
  }

  parsed.threads ??= [];

  return parsed;
}


export function saveSoft1ForumCorpus(
  corpus:
    Soft1ForumCorpusFile,
): void {
  const path =
    corpusPath();

  mkdirSync(
    dirname(path),
    {
      recursive:
        true,
    },
  );

  const persisted = {
    ...corpus,

    collectedAt:
      new Date()
        .toISOString(),
  };

  writeFileSync(
    path,
    JSON.stringify(
      persisted,
      null,
      2,
    ) + "\n",
    "utf8",
  );
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


function semanticMessage(
  message:
    Soft1ForumMessage,
) {
  return {
    messageId:
      message.messageId,

    author:
      message.author,

    email:
      message.email,

    publishedAt:
      message.publishedAt,

    body:
      message.body,

    parentMessageId:
      message.parentMessageId,

    sourceUrl:
      message.sourceUrl,
  };
}


function semanticThread(
  thread:
    Soft1ForumThread,
) {
  return {
    sourceKey:
      thread.sourceKey,

    gmailThreadId:
      thread.gmailThreadId,

    groupThreadId:
      thread.groupThreadId,

    subject:
      thread.subject,

    threadUrl:
      thread.threadUrl,

    gmailUrl:
      thread.gmailUrl,

    messages:
      thread.messages.map(
        semanticMessage,
      ),

    completeness:
      thread.completeness,

    firstPublishedAt:
      thread.firstPublishedAt,

    lastPublishedAt:
      thread.lastPublishedAt,

    normalized:
      thread.normalized,
  };
}


function mergeMessages(
  existing:
    Soft1ForumMessage[],

  incoming:
    Soft1ForumMessage[],
): Soft1ForumMessage[] {
  const incomingHasRealMessages =
    incoming.some(
      message =>
        !isLegacyProjectionMessage(
          message,
        ),
    );

  const base =
    incomingHasRealMessages
      ? existing.filter(
          message =>
            !isLegacyProjectionMessage(
              message,
            ),
        )
      : existing;

  const map =
    new Map<
      string,
      Soft1ForumMessage
    >();

  for (
    const message of
    base
  ) {
    map.set(
      message.messageId,
      message,
    );
  }

  for (
    const message of
    incoming
  ) {
    /*
     * Once real messages exist, never reintroduce
     * the synthetic migration projection.
     */
    if (
      incomingHasRealMessages &&
      isLegacyProjectionMessage(
        message,
      )
    ) {
      continue;
    }

    const previous =
      map.get(
        message.messageId,
      );

    map.set(
      message.messageId,
      previous
        ? {
            ...previous,
            ...message,

            body:
              message.body ||
              previous.body,
          }
        : message,
    );
  }

  return [
    ...map.values(),
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


function mergeThread(
  existing:
    Soft1ForumThread,

  incoming:
    Soft1ForumThread,
): Soft1ForumThread {
  const messages =
    mergeMessages(
      existing.messages,
      incoming.messages,
    );

  const dates =
    messages
      .map(
        message =>
          message.publishedAt,
      )
      .filter(
        (
          value,
        ): value is string =>
          Boolean(value),
      )
      .sort();

  const hasRealMessages =
    messages.some(
      message =>
        !isLegacyProjectionMessage(
          message,
        ),
    );

  return {
    ...existing,
    ...incoming,

    /*
     * Identity is immutable.
     */
    sourceKey:
      existing.sourceKey,

    /*
     * Never erase identifiers learned previously.
     */
    gmailThreadId:
      incoming.gmailThreadId ??
      existing.gmailThreadId,

    groupThreadId:
      incoming.groupThreadId ??
      existing.groupThreadId,

    threadUrl:
      incoming.threadUrl ??
      existing.threadUrl,

    gmailUrl:
      incoming.gmailUrl ??
      existing.gmailUrl,

    messages,

    completeness:
      existing.completeness ===
        "COMPLETE" ||
      incoming.completeness ===
        "COMPLETE"
        ? "COMPLETE"
        : "PARTIAL",

    firstPublishedAt:
      dates[0] ??
      incoming.firstPublishedAt ??
      existing.firstPublishedAt,

    lastPublishedAt:
      (
        dates.length > 0
          ? dates[
              dates.length -
              1
            ]
          : undefined
      ) ??
      incoming.lastPublishedAt ??
      existing.lastPublishedAt,

    /*
     * Once real source messages arrive, legacy
     * normalized projection is no longer authoritative.
     */
    normalized:
      hasRealMessages
        ? incoming.normalized
        : (
            incoming.normalized ??
            existing.normalized
          ),

    lastCollectedAt:
      incoming.lastCollectedAt ??
      existing.lastCollectedAt,
  };
}


export interface Soft1ForumCorpusMergeResult {
  inserted:
    number;

  updated:
    number;

  unchanged:
    number;

  total:
    number;
}


export function mergeSoft1ForumThreads(
  incomingThreads:
    Soft1ForumThread[],
): Soft1ForumCorpusMergeResult {
  const corpus =
    loadSoft1ForumCorpus();

  const bySourceKey =
    new Map<
      string,
      Soft1ForumThread
    >(
      corpus.threads.map(
        thread => [
          thread.sourceKey,
          thread,
        ],
      ),
    );

  let inserted = 0;
  let updated = 0;
  let unchanged = 0;

  for (
    const incoming of
    incomingThreads
  ) {
    const existing =
      bySourceKey.get(
        incoming.sourceKey,
      );

    if (!existing) {
      bySourceKey.set(
        incoming.sourceKey,
        incoming,
      );

      inserted++;
      continue;
    }

    const before =
      JSON.stringify(
        semanticThread(
          existing,
        ),
      );

    const merged =
      mergeThread(
        existing,
        incoming,
      );

    const after =
      JSON.stringify(
        semanticThread(
          merged,
        ),
      );

    if (before === after) {
      unchanged++;

      /*
       * Do not mutate timestamps for a semantic no-op.
       */
      bySourceKey.set(
        incoming.sourceKey,
        existing,
      );
    } else {
      updated++;

      bySourceKey.set(
        incoming.sourceKey,
        {
          ...merged,

          lastCollectedAt:
            new Date()
              .toISOString(),
        },
      );
    }
  }

  corpus.threads =
    [
      ...bySourceKey.values(),
    ].sort(
      (a, b) =>
        a.sourceKey.localeCompare(
          b.sourceKey,
        ),
    );

  saveSoft1ForumCorpus(
    corpus,
  );

  return {
    inserted,
    updated,
    unchanged,

    total:
      corpus.threads.length,
  };
}
