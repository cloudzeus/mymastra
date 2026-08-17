import fs from "node:fs";
import path from "node:path";

import {
  extractBlackBookSchedulerFromFile,
} from "./blackbook-scheduler-extractor";


const OUTPUT_FILE =
  "data/softone-blackbook-scheduler-candidates.json";


const candidates =
  extractBlackBookSchedulerFromFile();


const output = {
  formatVersion: 1,

  generatedAt:
    new Date().toISOString(),

  sourceId:
    "OFFICIAL_SOFTONE_BLACKBOOK_3_5",

  chapter:
    8,

  title:
    "Scheduler & Messages",

  count:
    candidates.length,

  candidates,
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
        candidates.length,

      byStatus:
        candidates.reduce<
          Record<string, number>
        >(
          (acc, item) => {
            acc[item.recommendedStatus] =
              (acc[item.recommendedStatus] ?? 0) + 1;

            return acc;
          },
          {},
        ),

      byKind:
        candidates.reduce<
          Record<string, number>
        >(
          (acc, item) => {
            acc[item.extractionKind] =
              (acc[item.extractionKind] ?? 0) + 1;

            return acc;
          },
          {},
        ),

      pages:
        [...new Set(
          candidates.map(
            (item) => item.page,
          ),
        )].sort(
          (a, b) => a - b,
        ),

      forbiddenPositiveClaimHits: {
        CLIENTIMPORT:
          candidates.filter(
            (item) =>
              [
                item.claim,
                item.symbol ?? "",
                item.signature ?? "",
              ]
                .join(" ")
                .toUpperCase()
                .includes("CLIENTIMPORT"),
          ).length,

        FORMIMPORT:
          candidates.filter(
            (item) =>
              [
                item.claim,
                item.symbol ?? "",
                item.signature ?? "",
              ]
                .join(" ")
                .toUpperCase()
                .includes("FORMIMPORT"),
          ).length,

        JAVASCRIPT:
          candidates.filter(
            (item) =>
              [
                item.claim,
                item.symbol ?? "",
                item.signature ?? "",
              ]
                .join(" ")
                .toUpperCase()
                .includes("JAVASCRIPT"),
          ).length,
      },

      guardrailMentions: {
        CLIENTIMPORT:
          candidates.filter(
            (item) =>
              (item.limitations ?? [])
                .join(" ")
                .toUpperCase()
                .includes("CLIENTIMPORT"),
          ).length,

        FORMIMPORT:
          candidates.filter(
            (item) =>
              (item.limitations ?? [])
                .join(" ")
                .toUpperCase()
                .includes("FORMIMPORT"),
          ).length,

        JAVASCRIPT:
          candidates.filter(
            (item) =>
              (item.limitations ?? [])
                .join(" ")
                .toUpperCase()
                .includes("JAVASCRIPT"),
          ).length,
      },
    },
    null,
    2,
  ),
);
