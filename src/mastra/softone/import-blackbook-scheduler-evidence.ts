import fs from "node:fs";

import type {
  SoftOneEvidenceRecord,
} from "./evidence-types";

import {
  getSoftOneEvidenceCatalogStats,
  loadSoftOneEvidenceCatalog,
  upsertSoftOneEvidenceRecords,
} from "./evidence-catalog";


const INPUT_FILE =
  "data/softone-blackbook-scheduler-evidence.json";


interface SchedulerEvidenceFile {
  evidence:
    SoftOneEvidenceRecord[];
}


const parsed =
  JSON.parse(
    fs.readFileSync(
      INPUT_FILE,
      "utf8",
    ),
  ) as SchedulerEvidenceFile;


if (
  !Array.isArray(
    parsed.evidence,
  )
) {
  throw new Error(
    "Scheduler evidence file does not contain an evidence array.",
  );
}


const before =
  loadSoftOneEvidenceCatalog();


const communityBefore =
  before.records.filter(
    record =>
      record.sources.some(
        source =>
          source.sourceId ===
          "SOFT1_DEVELOPERS_GROUP",
      ),
  );


const blackBookBefore =
  before.records.filter(
    record =>
      record.sources.some(
        source =>
          source.sourceId ===
          "OFFICIAL_SOFTONE_BLACKBOOK_3_5",
      ),
  );


const result =
  upsertSoftOneEvidenceRecords(
    parsed.evidence,
  );


if (
  !result.success
) {
  console.error(
    JSON.stringify(
      result,
      null,
      2,
    ),
  );

  process.exit(1);
}


const after =
  loadSoftOneEvidenceCatalog();


const communityAfter =
  after.records.filter(
    record =>
      record.sources.some(
        source =>
          source.sourceId ===
          "SOFT1_DEVELOPERS_GROUP",
      ),
  );


const blackBookAfter =
  after.records.filter(
    record =>
      record.sources.some(
        source =>
          source.sourceId ===
          "OFFICIAL_SOFTONE_BLACKBOOK_3_5",
      ),
  );


const blackBookVerified =
  blackBookAfter.filter(
    record =>
      record.status ===
        "VERIFIED",
  );


const blackBookVersionScoped =
  blackBookAfter.filter(
    record =>
      record.scope ===
        "VERSION" &&
      record.softOneVersion ===
        "3.5",
  );


console.log(
  JSON.stringify(
    {
      import: {
        success:
          result.success,

        inserted:
          result.inserted,

        updated:
          result.updated,

        warnings:
          result.warnings,
      },

      before: {
        total:
          before.records.length,

        community:
          communityBefore.length,

        blackBook:
          blackBookBefore.length,
      },

      after: {
        total:
          after.records.length,

        community:
          communityAfter.length,

        blackBook:
          blackBookAfter.length,

        blackBookVerified:
          blackBookVerified.length,

        blackBookVersionScoped:
          blackBookVersionScoped.length,
      },

      communityPreserved:
        communityBefore.length ===
        communityAfter.length,

      stats:
        getSoftOneEvidenceCatalogStats(),
    },
    null,
    2,
  ),
);
