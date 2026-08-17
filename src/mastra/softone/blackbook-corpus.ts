import fs from "node:fs";
import path from "node:path";

import {
  SOFTONE_BLACKBOOK_SOURCE_ID,
} from "./blackbook-types";


export interface SoftOneBlackBookCorpusChunk {
  id: string;

  sourceId:
    typeof SOFTONE_BLACKBOOK_SOURCE_ID;

  softOneVersion:
    "3.5";

  page: number;

  chapter: number;

  chapterTitle: string;

  section: string;

  chunkIndex: number;

  text: string;

  textLength: number;

  tags: string[];
}


interface SoftOneBlackBookCorpusFile {
  formatVersion: number;

  source: {
    sourceId:
      typeof SOFTONE_BLACKBOOK_SOURCE_ID;

    title: string;

    version: string;

    authority:
      "OFFICIAL_DOCUMENTATION";
  };

  totalPages: number;

  chunkCount: number;

  chunks:
    SoftOneBlackBookCorpusChunk[];
}


export interface SoftOneBlackBookCorpusSearchResult {
  chunk:
    SoftOneBlackBookCorpusChunk;

  score:
    number;

  matchedTerms:
    string[];

  queryCoverage:
    number;
}


const DEFAULT_FILE =
  path.resolve(
    "data/softone-blackbook-corpus.json",
  );


function normalize(
  value: string,
): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .replace(
      /[^a-z0-9α-ωάέήίόύώϊϋΐΰ._:/-]+/gi,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}


function queryTerms(
  query: string,
): string[] {
  return [
    ...new Set(
      normalize(query)
        .split(" ")
        .map(
          term =>
            term.trim(),
        )
        .filter(
          term =>
            term.length >= 2,
        ),
    ),
  ];
}


export function loadSoftOneBlackBookCorpus(
  file =
    DEFAULT_FILE,
): SoftOneBlackBookCorpusFile {
  if (
    !fs.existsSync(file)
  ) {
    throw new Error(
      `BlackBook corpus not found: ${file}`,
    );
  }

  const corpus =
    JSON.parse(
      fs.readFileSync(
        file,
        "utf8",
      ),
    ) as SoftOneBlackBookCorpusFile;


  if (
    corpus.source.sourceId !==
      SOFTONE_BLACKBOOK_SOURCE_ID
  ) {
    throw new Error(
      `Unexpected BlackBook corpus sourceId: ${corpus.source.sourceId}`,
    );
  }


  if (
    corpus.totalPages !== 573
  ) {
    throw new Error(
      `Expected 573 BlackBook pages, got ${corpus.totalPages}`,
    );
  }


  if (
    corpus.chunkCount !==
      corpus.chunks.length
  ) {
    throw new Error(
      `BlackBook chunkCount mismatch: ${corpus.chunkCount} != ${corpus.chunks.length}`,
    );
  }


  return corpus;
}


export function searchSoftOneBlackBookCorpus(
  input: {
    query: string;

    limit?: number;

    chapter?: number;
  },
): SoftOneBlackBookCorpusSearchResult[] {
  const limit =
    Math.max(
      1,
      Math.min(
        input.limit ?? 10,
        50,
      ),
    );

  const terms =
    queryTerms(
      input.query,
    );


  if (
    terms.length === 0
  ) {
    return [];
  }


  const corpus =
    loadSoftOneBlackBookCorpus();


  return corpus.chunks
    .filter(
      chunk =>
        input.chapter ===
          undefined ||
        chunk.chapter ===
          input.chapter,
    )
    .map(
      chunk => {
        const chapterTitle =
          normalize(
            chunk.chapterTitle,
          );

        const section =
          normalize(
            chunk.section,
          );

        const text =
          normalize(
            chunk.text,
          );

        const tags =
          normalize(
            chunk.tags.join(
              " ",
            ),
          );


        const matchedTerms:
          string[] =
            [];

        let score =
          0;


        for (
          const term of terms
        ) {
          let matched =
            false;


          if (
            chapterTitle.includes(
              term,
            )
          ) {
            score += 12;

            matched =
              true;
          }


          if (
            section.includes(
              term,
            )
          ) {
            score += 10;

            matched =
              true;
          }


          if (
            tags.includes(
              term,
            )
          ) {
            score += 5;

            matched =
              true;
          }


          if (
            text.includes(
              term,
            )
          ) {
            /*
             * Presence is enough for baseline relevance.
             * Add a bounded frequency bonus so a long page
             * cannot dominate purely by repetition.
             */
            score += 4;

            const occurrences =
              text
                .split(term)
                .length - 1;

            score +=
              Math.min(
                occurrences,
                5,
              );

            matched =
              true;
          }


          if (
            matched
          ) {
            matchedTerms.push(
              term,
            );
          }
        }


        const queryCoverage =
          matchedTerms.length /
          terms.length;


        /*
         * Reward coverage strongly so a chunk matching
         * several requested concepts ranks above a page
         * repeating only one keyword.
         */
        score +=
          Math.round(
            queryCoverage *
            20,
          );


        return {
          chunk,

          score,

          matchedTerms,

          queryCoverage,
        };
      },
    )
    .filter(
      result =>
        result.score > 0 &&
        result.matchedTerms.length >
          0,
    )
    .sort(
      (
        a,
        b,
      ) => {
        if (
          b.score !==
          a.score
        ) {
          return (
            b.score -
            a.score
          );
        }

        if (
          b.queryCoverage !==
          a.queryCoverage
        ) {
          return (
            b.queryCoverage -
            a.queryCoverage
          );
        }

        if (
          a.chunk.page !==
          b.chunk.page
        ) {
          return (
            a.chunk.page -
            b.chunk.page
          );
        }

        return (
          a.chunk.chunkIndex -
          b.chunk.chunkIndex
        );
      },
    )
    .slice(
      0,
      limit,
    );
}


export function getSoftOneBlackBookCorpusStats() {
  const corpus =
    loadSoftOneBlackBookCorpus();


  return {
    sourceId:
      corpus.source.sourceId,

    softOneVersion:
      corpus.source.version,

    totalPages:
      corpus.totalPages,

    chunkCount:
      corpus.chunkCount,

    chapters:
      Object.fromEntries(
        Array.from(
          {
            length: 14,
          },
          (
            _,
            index,
          ) =>
            index + 1,
        ).map(
          chapter => [
            chapter,

            corpus.chunks.filter(
              chunk =>
                chunk.chapter ===
                chapter,
            ).length,
          ],
        ),
      ),
  };
}
