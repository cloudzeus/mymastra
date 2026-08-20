import {
  migrateInitialSoft1CorpusToV2,
} from "../src/mastra/softone/migrate-soft1-initial-corpus";


const result =
  migrateInitialSoft1CorpusToV2();

console.log(
  JSON.stringify(
    result,
    null,
    2,
  ),
);

console.log(
  "SOFT1 INITIAL CORPUS MIGRATION: PASS",
);
