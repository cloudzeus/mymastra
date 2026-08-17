import fs from "node:fs";

import type {
  SoftOneBlackBookCandidate,
} from "./blackbook-types";

import type {
  SoftOneEvidenceRecord,
} from "./evidence-types";

import {
  SOFTONE_BLACKBOOK_SOURCE_ID,
} from "./blackbook-types";

import {
  convertBlackBookCandidatesToEvidence,
} from "./blackbook-evidence-converter";

import {
  upsertSoftOneEvidenceRecords,
  getSoftOneEvidenceCatalogStats,
} from "./evidence-catalog";


type Classification =
  | "SAFE_VERIFIED"
  | "DERIVED_EXAMPLE"
  | "REQUIRES_REVIEW"
  | "REJECTED_FALSE_POSITIVE";


type PromotableRecord = {
  candidate:
    SoftOneBlackBookCandidate;

  classification:
    Classification;

  reasons:
    string[];
};


type PromotableFile = {
  formatVersion: number;

  sourceId: string;

  validatedAt: string;

  totalInput: number;

  validCount: number;

  invalidCount: number;

  byClassification: {
    SAFE_VERIFIED: number;
    DERIVED_EXAMPLE: number;
  };

  invalid: unknown[];

  records:
    PromotableRecord[];
};


type EvidenceCatalogFile = {
  formatVersion: number;

  updatedAt:
    string | null;

  records:
    SoftOneEvidenceRecord[];
};


const INPUT_FILE =
  "data/softone-blackbook-promotable-candidates.json";

const EVIDENCE_OUTPUT =
  "data/softone-blackbook-full-evidence.json";

const CATALOG_FILE =
  "data/softone-evidence-catalog.json";


const input =
  JSON.parse(
    fs.readFileSync(
      INPUT_FILE,
      "utf8",
    ),
  ) as PromotableFile;


/*
 * ---------------------------------------------------------
 * Source / validation guards
 * ---------------------------------------------------------
 */
if (
  input.sourceId !==
    SOFTONE_BLACKBOOK_SOURCE_ID
) {
  throw new Error(
    `Unexpected sourceId: ${input.sourceId}`,
  );
}


if (
  input.invalidCount !== 0
) {
  throw new Error(
    `Promotable input contains ${input.invalidCount} invalid records.`,
  );
}


if (
  input.validCount !==
    input.records.length
) {
  throw new Error(
    `validCount mismatch: ${input.validCount} != ${input.records.length}`,
  );
}


const safeVerified =
  input.records.filter(
    item =>
      item.classification ===
      "SAFE_VERIFIED",
  );


const derivedExamples =
  input.records.filter(
    item =>
      item.classification ===
      "DERIVED_EXAMPLE",
  );


if (
  safeVerified.length !== 174
) {
  throw new Error(
    `Expected 174 SAFE_VERIFIED records, got ${safeVerified.length}`,
  );
}


if (
  derivedExamples.length !== 30
) {
  throw new Error(
    `Expected 30 DERIVED_EXAMPLE records, got ${derivedExamples.length}`,
  );
}


/*
 * Chapter 8 is intentionally excluded.
 *
 * Its 26 authoritative records come only from the separately
 * vetted Scheduler extractor.
 */
const chapter8Records =
  input.records.filter(
    item =>
      item.candidate.chapter === 8,
  );


if (
  chapter8Records.length > 0
) {
  throw new Error(
    `Promotable full-book input unexpectedly contains ${chapter8Records.length} Chapter 8 records.`,
  );
}


/*
 * Classification and candidate status must agree.
 */
for (
  const item of input.records
) {
  if (
    item.classification ===
      "SAFE_VERIFIED" &&
    item.candidate.recommendedStatus !==
      "VERIFIED"
  ) {
    throw new Error(
      `SAFE_VERIFIED candidate ${item.candidate.id} is not recommended VERIFIED.`,
    );
  }


  if (
    item.classification ===
      "DERIVED_EXAMPLE" &&
    item.candidate.recommendedStatus !==
      "DERIVED"
  ) {
    throw new Error(
      `DERIVED_EXAMPLE candidate ${item.candidate.id} is not recommended DERIVED.`,
    );
  }
}


/*
 * ---------------------------------------------------------
 * Convert through the canonical BlackBook converter
 * ---------------------------------------------------------
 */
const candidates =
  input.records.map(
    item =>
      item.candidate,
  );


const evidence =
  convertBlackBookCandidatesToEvidence(
    candidates,
  );


if (
  evidence.length !== 204
) {
  throw new Error(
    `Expected 204 evidence records, got ${evidence.length}`,
  );
}


/*
 * All full-book evidence remains VERSION scoped to BlackBook 3.5.
 */
for (
  const record of evidence
) {
  if (
    record.scope !==
      "VERSION"
  ) {
    throw new Error(
      `Evidence ${record.id} has unexpected scope ${record.scope}`,
    );
  }


  if (
    record.softOneVersion !==
      "3.5"
  ) {
    throw new Error(
      `Evidence ${record.id} has unexpected SoftOne version ${record.softOneVersion}`,
    );
  }


  if (
    !record.sources.some(
      source =>
        source.sourceId ===
        SOFTONE_BLACKBOOK_SOURCE_ID,
    )
  ) {
    throw new Error(
      `Evidence ${record.id} lacks canonical BlackBook source.`,
    );
  }
}


/*
 * ---------------------------------------------------------
 * Preflight collision check against current catalog
 * ---------------------------------------------------------
 */
const catalog =
  JSON.parse(
    fs.readFileSync(
      CATALOG_FILE,
      "utf8",
    ),
  ) as EvidenceCatalogFile;


const existingIds =
  new Set(
    catalog.records.map(
      record =>
        record.id.toUpperCase(),
    ),
  );


const collisionIds =
  evidence
    .map(
      record =>
        record.id.toUpperCase(),
    )
    .filter(
      id =>
        existingIds.has(id),
    );


if (
  collisionIds.length > 0
) {
  console.error(
    JSON.stringify(
      {
        success:
          false,

        stage:
          "PREFLIGHT",

        reason:
          "EVIDENCE_ID_COLLISION",

        collisionCount:
          collisionIds.length,

        collisionIds,
      },
      null,
      2,
    ),
  );

  process.exit(1);
}


/*
 * Save the converted evidence artifact before mutation.
 */
fs.writeFileSync(
  EVIDENCE_OUTPUT,

  JSON.stringify(
    {
      formatVersion: 1,

      sourceId:
        SOFTONE_BLACKBOOK_SOURCE_ID,

      softOneVersion:
        "3.5",

      generatedAt:
        new Date()
          .toISOString(),

      count:
        evidence.length,

      evidence,
    },
    null,
    2,
  ) + "\n",
);


/*
 * ---------------------------------------------------------
 * Atomic-ish catalog batch upsert
 * ---------------------------------------------------------
 *
 * upsertSoftOneEvidenceRecords validates the entire batch
 * before mutating the catalog and writes the catalog once.
 */
const beforeStats =
  getSoftOneEvidenceCatalogStats();


const result =
  upsertSoftOneEvidenceRecords(
    evidence,
  );


if (
  !result.success
) {
  throw new Error(
    `BlackBook batch import failed: ${JSON.stringify(result.errors ?? [])}`,
  );
}


const afterStats =
  getSoftOneEvidenceCatalogStats();


const blackBookRecords =
  (
    JSON.parse(
      fs.readFileSync(
        CATALOG_FILE,
        "utf8",
      ),
    ) as EvidenceCatalogFile
  ).records.filter(
    record =>
      record.sources.some(
        source =>
          source.sourceId ===
          SOFTONE_BLACKBOOK_SOURCE_ID,
      ),
  );


const blackBookChapter8 =
  blackBookRecords.filter(
    record =>
      record.tags?.includes(
        "chapter-8",
      ),
  );


const newFullBookIds =
  new Set(
    evidence.map(
      record =>
        record.id.toUpperCase(),
    ),
  );


const importedFullBook =
  blackBookRecords.filter(
    record =>
      newFullBookIds.has(
        record.id.toUpperCase(),
      ),
  );


console.log(
  JSON.stringify(
    {
      success:
        true,

      preflight: {
        inputValidated:
          input.validCount,

        collisionCount:
          collisionIds.length,

        chapter8InputCount:
          chapter8Records.length,
      },

      import: {
        inserted:
          result.inserted,

        updated:
          result.updated,

        warnings:
          result.warnings,
      },

      evidence: {
        generated:
          evidence.length,

        verified:
          evidence.filter(
            record =>
              record.status ===
              "VERIFIED",
          ).length,

        derived:
          evidence.filter(
            record =>
              record.status ===
              "DERIVED",
          ).length,

        versionScoped:
          evidence.filter(
            record =>
              record.scope ===
              "VERSION",
          ).length,

        importedFullBook:
          importedFullBook.length,
      },

      catalog: {
        beforeTotal:
          beforeStats.total,

        afterTotal:
          afterStats.total,

        expectedAfterTotal:
          beforeStats.total +
          evidence.length,

        blackBookTotal:
          blackBookRecords.length,

        vettedChapter8StillPresent:
          blackBookChapter8.length,
      },

      stats:
        afterStats,

      evidenceOutput:
        EVIDENCE_OUTPUT,
    },
    null,
    2,
  ),
);
