import {
  readFileSync,
} from "node:fs";

import {
  resolve,
} from "node:path";

import {
  mergeSoft1ForumThreads,
} from "./soft1-forum-corpus-store";

import type {
  NormalizedCorpusFile,
} from "./normalized-corpus-importer";

import type {
  Soft1ForumThread,
} from "./soft1-forum-corpus-types";


export function migrateInitialSoft1CorpusToV2(
  path =
    resolve(
      process.cwd(),
      "data/soft1-gmail-corpus.initial.json",
    ),
) {
  const oldCorpus =
    JSON.parse(
      readFileSync(
        path,
        "utf8",
      ),
    ) as NormalizedCorpusFile;

  const now =
    new Date()
      .toISOString();

  const threads:
    Soft1ForumThread[] =
    oldCorpus.threads.map(
      thread => {
        const gmailThreadId =
          thread.sourceKey
            .startsWith(
              "gmail-thread:",
            )
            ? thread.sourceKey.slice(
                "gmail-thread:"
                  .length,
              )
            : undefined;

        const legacyBody =
          thread.rawTechnicalContent
            .trim() ||
          thread.notes.join(
            "\n",
          ) ||
          `[Legacy normalized record: ${thread.subject}]`;

        return {
          /*
           * Preserve the exact existing canonical identity.
           */
          sourceKey:
            thread.sourceKey,

          gmailThreadId,

          subject:
            thread.subject,

          messages: [
            {
              messageId:
                `legacy-projection:${thread.sourceKey}`,

              body:
                legacyBody,
            },
          ],

          completeness:
            "PARTIAL",

          lastCollectedAt:
            now,

          /*
           * Preserve EXACT v1 normalized projection.
           * This prevents migration alone from changing
           * downstream ingestion semantics.
           */
          normalized: {
            classification:
              thread.classification,

            rawTechnicalContent:
              thread.rawTechnicalContent,

            notes: [
              ...thread.notes,
            ],
          },
        };
      },
    );

  return mergeSoft1ForumThreads(
    threads,
  );
}
