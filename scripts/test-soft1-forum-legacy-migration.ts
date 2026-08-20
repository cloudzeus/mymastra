import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";

import {
  tmpdir,
} from "node:os";

import {
  join,
} from "node:path";

import {
  migrateInitialSoft1CorpusToV2,
} from "../src/mastra/softone/migrate-soft1-initial-corpus";

import {
  loadSoft1ForumCorpus,
  mergeSoft1ForumThreads,
} from "../src/mastra/softone/soft1-forum-corpus-store";

import {
  normalizeSoft1ForumCorpus,
} from "../src/mastra/softone/soft1-forum-normalizer";

import {
  buildSoft1ForumCorpus,
} from "../src/mastra/softone/google-groups-collector";


const dir =
  mkdtempSync(
    join(
      tmpdir(),
      "soft1-legacy-test-",
    ),
  );

const legacyPath =
  join(
    dir,
    "legacy.json",
  );

process.env
  .SOFT1_FORUM_CORPUS_PATH =
    join(
      dir,
      "v2.json",
    );


writeFileSync(
  legacyPath,
  JSON.stringify(
    {
      formatVersion:
        1,

      source:
        "Soft1 Developers Group via connected Gmail",

      threads: [
        {
          sourceKey:
            "gmail-thread:legacy123",

          subject:
            "Legacy thread",

          classification:
            "CONFIRMED",

          rawTechnicalContent:
            "X.WARNING('legacy');",

          notes: [
            "Original legacy note.",
          ],
        },
      ],
    },
    null,
    2,
  ),
);


migrateInitialSoft1CorpusToV2(
  legacyPath,
);


let corpus =
  loadSoft1ForumCorpus();

let normalized =
  normalizeSoft1ForumCorpus(
    corpus,
  );

const legacyNormalized =
  normalized.threads[0];

if (!legacyNormalized) {
  throw new Error(
    "Legacy normalized projection missing.",
  );
}

if (
  legacyNormalized
    .rawTechnicalContent !==
  "X.WARNING('legacy');"
) {
  throw new Error(
    "Legacy rawTechnicalContent changed during migration.",
  );
}

if (
  JSON.stringify(
    legacyNormalized.notes,
  ) !==
  JSON.stringify([
    "Original legacy note.",
  ])
) {
  throw new Error(
    "Legacy notes changed during migration.",
  );
}


/*
 * Real source messages arrive later.
 */
const real =
  buildSoft1ForumCorpus([
    {
      gmailThreadId:
        "legacy123",

      subject:
        "Legacy thread",

      complete:
        true,

      messages: [
        {
          messageId:
            "real-1",

          author:
            "Developer A",

          publishedAt:
            "2025-01-01T10:00:00Z",

          body:
            "X.WARNING('real');",
        },

        {
          messageId:
            "real-2",

          author:
            "Developer B",

          publishedAt:
            "2025-01-01T11:00:00Z",

          body:
            "λειτούργησε",
        },
      ],
    },
  ]);


mergeSoft1ForumThreads(
  real.threads,
);


corpus =
  loadSoft1ForumCorpus();

const thread =
  corpus.threads[0];

if (!thread) {
  throw new Error(
    "Thread missing after enrichment.",
  );
}

if (
  thread.messages.some(
    message =>
      message.messageId
        .startsWith(
          "legacy-projection:",
        ),
  )
) {
  throw new Error(
    "Legacy projection was not removed after real messages arrived.",
  );
}

if (
  thread.messages.length !==
  2
) {
  throw new Error(
    `Expected exactly 2 real messages, got ${thread.messages.length}`,
  );
}

normalized =
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
    "Enriched thread did not classify as CONFIRMED.",
  );
}


console.log(
  JSON.stringify(
    {
      sourceKey:
        thread.sourceKey,

      messages:
        thread.messages.length,

      completeness:
        thread.completeness,

      classification:
        normalized
          .threads[0]
          ?.classification,
    },
    null,
    2,
  ),
);

console.log(
  "SOFT1 LEGACY MIGRATION: PASS",
);
