import {
  loadSoft1ForumCorpus,
} from "../src/mastra/softone/soft1-forum-corpus-store";

import {
  validateSoft1ForumCorpus,
} from "../src/mastra/softone/soft1-forum-corpus-validator";


const corpus =
  loadSoft1ForumCorpus();

const result =
  validateSoft1ForumCorpus(
    corpus,
  );

console.log(
  JSON.stringify(
    result,
    null,
    2,
  ),
);

if (!result.valid) {
  process.exit(1);
}

console.log(
  "SOFT1 FORUM CORPUS VALIDATION: PASS",
);
