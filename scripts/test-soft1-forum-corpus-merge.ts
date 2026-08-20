import {
  mkdtempSync,
} from "node:fs";

import {
  tmpdir,
} from "node:os";

import {
  join,
} from "node:path";

import {
  buildSoft1ForumCorpus,
} from "../src/mastra/softone/google-groups-collector";

import {
  loadSoft1ForumCorpus,
  mergeSoft1ForumThreads,
} from "../src/mastra/softone/soft1-forum-corpus-store";

import {
  normalizeSoft1ForumCorpus,
} from "../src/mastra/softone/soft1-forum-normalizer";


const dir =
  mkdtempSync(
    join(
      tmpdir(),
      "soft1-forum-test-",
    ),
  );

process.env
  .SOFT1_FORUM_CORPUS_PATH =
    join(
      dir,
      "corpus.json",
    );


const first =
  buildSoft1ForumCorpus([
    {
      gmailThreadId:
        "abc123",

      subject:
        "Test thread",

      complete:
        false,

      messages: [
        {
          messageId:
            "m1",

          author:
            "Developer A",

          publishedAt:
            "2026-01-01T10:00:00Z",

          body:
            "X.WARNING('test');",
        },
      ],
    },
  ]);


const firstResult =
  mergeSoft1ForumThreads(
    first.threads,
  );

if (
  firstResult.inserted !==
  1
) {
  throw new Error(
    "Initial insert failed.",
  );
}


/*
 * Exact same fetch must be a no-op.
 */
const identicalResult =
  mergeSoft1ForumThreads(
    first.threads,
  );

if (
  identicalResult.unchanged !==
  1
) {
  throw new Error(
    `Expected unchanged=1, got ${identicalResult.unchanged}`,
  );
}


/*
 * New reply arrives.
 */
const second =
  buildSoft1ForumCorpus([
    {
      gmailThreadId:
        "abc123",

      groupThreadId:
        "groups-abc123",

      subject:
        "Test thread",

      threadUrl:
        "https://groups.google.com/g/soft1/c/example",

      complete:
        true,

      messages: [
        {
          messageId:
            "m1",

          author:
            "Developer A",

          publishedAt:
            "2026-01-01T10:00:00Z",

          body:
            "X.WARNING('test');",
        },

        {
          messageId:
            "m2",

          author:
            "Developer B",

          publishedAt:
            "2026-01-01T11:00:00Z",

          body:
            "δουλεψε",
        },
      ],
    },
  ]);


const secondResult =
  mergeSoft1ForumThreads(
    second.threads,
  );

if (
  secondResult.updated !==
  1
) {
  throw new Error(
    `Expected updated=1, got ${secondResult.updated}`,
  );
}


const corpus =
  loadSoft1ForumCorpus();

if (
  corpus.threads.length !==
  1
) {
  throw new Error(
    "Duplicate thread was created.",
  );
}

const thread =
  corpus.threads[0];

if (!thread) {
  throw new Error(
    "Merged thread missing.",
  );
}

if (
  thread.messages.length !==
  2
) {
  throw new Error(
    `Expected 2 messages, got ${thread.messages.length}`,
  );
}

if (
  thread.completeness !==
  "COMPLETE"
) {
  throw new Error(
    "PARTIAL → COMPLETE promotion failed.",
  );
}

if (
  thread.sourceKey !==
  "gmail-thread:abc123"
) {
  throw new Error(
    `Canonical sourceKey changed: ${thread.sourceKey}`,
  );
}

if (
  thread.groupThreadId !==
  "groups-abc123"
) {
  throw new Error(
    "groupThreadId enrichment failed.",
  );
}


const normalized =
  normalizeSoft1ForumCorpus(
    corpus,
  );

if (
  normalized
    .threads[0]
    ?.classification !==
  "CONFIRMED"
) {
  throw new Error(
    "Full-thread classification failed.",
  );
}


console.log(
  JSON.stringify(
    {
      firstResult,
      identicalResult,
      secondResult,

      final: {
        sourceKey:
          thread.sourceKey,

        groupThreadId:
          thread.groupThreadId,

        messages:
          thread.messages.length,

        completeness:
          thread.completeness,

        classification:
          normalized
            .threads[0]
            ?.classification,
      },
    },
    null,
    2,
  ),
);

console.log(
  "SOFT1 FORUM MERGE: PASS",
);
