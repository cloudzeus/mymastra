import {
  loadSoft1ForumCorpus,
} from "../src/mastra/softone/soft1-forum-corpus-store";

import {
  normalizeSoft1ForumCorpus,
} from "../src/mastra/softone/soft1-forum-normalizer";

import {
  importNormalizedSoft1Corpus,
} from "../src/mastra/softone/normalized-corpus-importer";


const corpus =
  loadSoft1ForumCorpus();

const normalized =
  normalizeSoft1ForumCorpus(
    corpus,
  );

const result =
  importNormalizedSoft1Corpus(
    normalized,
  );

console.log(
  JSON.stringify(
    {
      corpusThreads:
        corpus.threads.length,

      processed:
        result.processed,

      skipped:
        result.skipped,

      inserted:
        result.inserted,

      needsReview:
        result.needsReview,

      rejected:
        result.rejected,
    },
    null,
    2,
  ),
);

console.log(
  "SOFT1 FORUM IMPORT: PASS",
);
