import fs from "node:fs";

import type {
  SoftOneBlackBookCandidate,
} from "./blackbook-types";


type CandidateFile = {
  formatVersion: number;

  candidateCount: number;

  candidates:
    SoftOneBlackBookCandidate[];
};


const file =
  JSON.parse(
    fs.readFileSync(
      "data/softone-blackbook-all-candidates.json",
      "utf8",
    ),
  ) as CandidateFile;


const candidates =
  file.candidates;


/*
 * Count symbols.
 */
const symbolCounts =
  new Map<string, number>();

for (
  const candidate of candidates
) {
  if (
    !candidate.symbol
  ) {
    continue;
  }

  const key =
    candidate.symbol.toUpperCase();

  symbolCounts.set(
    key,
    (
      symbolCounts.get(key) ??
      0
    ) + 1,
  );
}


const mostRepeatedSymbols =
  [...symbolCounts.entries()]
    .sort(
      (
        a,
        b,
      ) =>
        b[1] - a[1],
    )
    .slice(
      0,
      50,
    )
    .map(
      (
        [
          symbol,
          count,
        ],
      ) => ({
        symbol,
        count,
      }),
    );


/*
 * Candidates whose example looks like executable code rather
 * than a definition/header.
 */
const possibleCodeUsages =
  candidates
    .filter(
      candidate => {
        const example =
          candidate.exampleText ??
          "";

        return (
          /[;{}]/.test(example) ||
          /\b(if|for|while|return|var|let|const)\b/i
            .test(example) ||
          /=\s*[A-Za-z0-9_.]+\s*\(/.test(
            example,
          )
        );
      },
    );


/*
 * Very short/generic symbols often indicate false positives.
 */
const suspiciousSymbols =
  candidates
    .filter(
      candidate => {
        const symbol =
          candidate.symbol ??
          "";

        return (
          symbol.length <= 2 ||
          /^(IF|FOR|VAR|LET|NEW|SET|GET|ADD|RUN|END)$/i
            .test(symbol)
        );
      },
    );


/*
 * Chapter 8 must stay protected because we already have
 * a separately vetted authoritative extractor there.
 */
const chapter8 =
  candidates.filter(
    candidate =>
      candidate.chapter === 8,
  );


const samplesByKind =
  Object.fromEntries(
    [
      "COMMAND_SIGNATURE",
      "METHOD_SIGNATURE",
      "FUNCTION_SIGNATURE",
      "EVENT_SIGNATURE",
      "CASE_STUDY_PATTERN",
      "SYSTEM_PARAMETER",
    ].map(
      kind => [
        kind,

        candidates
          .filter(
            candidate =>
              candidate.extractionKind ===
              kind,
          )
          .slice(
            0,
            15,
          )
          .map(
            candidate => ({
              page:
                candidate.page,

              chapter:
                candidate.chapter,

              section:
                candidate.section,

              symbol:
                candidate.symbol,

              signature:
                candidate.signature,

              exampleText:
                candidate.exampleText
                  ?.slice(
                    0,
                    250,
                  ),
            }),
          ),
      ],
    ),
  );


const byPage =
  new Map<
    number,
    number
  >();

for (
  const candidate of candidates
) {
  byPage.set(
    candidate.page,
    (
      byPage.get(
        candidate.page,
      ) ?? 0
    ) + 1,
  );
}


const highestCandidatePages =
  [...byPage.entries()]
    .sort(
      (
        a,
        b,
      ) =>
        b[1] - a[1],
    )
    .slice(
      0,
      30,
    )
    .map(
      (
        [
          page,
          count,
        ],
      ) => ({
        page,
        count,
      }),
    );


console.log(
  JSON.stringify(
    {
      totalCandidates:
        candidates.length,

      chapter8Candidates:
        chapter8.length,

      possibleCodeUsageCount:
        possibleCodeUsages.length,

      suspiciousSymbolCount:
        suspiciousSymbols.length,

      uniqueSymbols:
        symbolCounts.size,

      mostRepeatedSymbols,

      highestCandidatePages,

      suspiciousSymbolSamples:
        suspiciousSymbols
          .slice(
            0,
            30,
          )
          .map(
            candidate => ({
              page:
                candidate.page,

              chapter:
                candidate.chapter,

              kind:
                candidate.extractionKind,

              symbol:
                candidate.symbol,

              exampleText:
                candidate.exampleText,
            }),
          ),

      possibleCodeUsageSamples:
        possibleCodeUsages
          .slice(
            0,
            40,
          )
          .map(
            candidate => ({
              page:
                candidate.page,

              chapter:
                candidate.chapter,

              kind:
                candidate.extractionKind,

              symbol:
                candidate.symbol,

              exampleText:
                candidate.exampleText,
            }),
          ),

      samplesByKind,
    },
    null,
    2,
  ),
);
