import fs from "node:fs";
import path from "node:path";

import {
  extractBlackBookSchedulerFromFile,
} from "./blackbook-scheduler-extractor";

import {
  convertBlackBookCandidatesToEvidence,
} from "./blackbook-evidence-converter";


const OUTPUT_FILE =
  "data/softone-blackbook-scheduler-evidence.json";


const candidates =
  extractBlackBookSchedulerFromFile();

const evidence =
  convertBlackBookCandidatesToEvidence(
    candidates,
  );


const output = {
  formatVersion: 1,

  sourceId:
    "OFFICIAL_SOFTONE_BLACKBOOK_3_5",

  softOneVersion:
    "3.5",

  chapter:
    8,

  count:
    evidence.length,

  generatedAt:
    new Date().toISOString(),

  evidence,
};


fs.mkdirSync(
  path.dirname(OUTPUT_FILE),
  {
    recursive: true,
  },
);


fs.writeFileSync(
  OUTPUT_FILE,
  JSON.stringify(
    output,
    null,
    2,
  ) + "\n",
  "utf8",
);


console.log(
  JSON.stringify(
    {
      outputFile:
        OUTPUT_FILE,

      count:
        evidence.length,

      byStatus:
        evidence.reduce<
          Record<string, number>
        >(
          (acc, item) => {
            acc[item.status] =
              (acc[item.status] ?? 0) + 1;

            return acc;
          },
          {},
        ),

      byScope:
        evidence.reduce<
          Record<string, number>
        >(
          (acc, item) => {
            acc[item.scope] =
              (acc[item.scope] ?? 0) + 1;

            return acc;
          },
          {},
        ),

      byKind:
        evidence.reduce<
          Record<string, number>
        >(
          (acc, item) => {
            acc[item.kind] =
              (acc[item.kind] ?? 0) + 1;

            return acc;
          },
          {},
        ),

      sourceIds:
        [
          ...new Set(
            evidence.flatMap(
              (item) =>
                item.sources.map(
                  (source) =>
                    source.sourceId,
                ),
            ),
          ),
        ],

      pages:
        [
          ...new Set(
            evidence.flatMap(
              (item) =>
                item.sources
                  .map(
                    (source) =>
                      source.page,
                  )
                  .filter(
                    (page):
                      page is number =>
                        typeof page ===
                        "number",
                  ),
            ),
          ),
        ].sort(
          (a, b) => a - b,
        ),
    },
    null,
    2,
  ),
);
