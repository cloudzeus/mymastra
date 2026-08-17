import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import {
  SOFTONE_BLACKBOOK_SOURCE_ID,
  type SoftOneBlackBookCandidate,
  type SoftOneBlackBookExtractionKind,
} from "./blackbook-types";

import {
  SOFTONE_BLACKBOOK_EXTRACTION_POLICIES,
  SOFTONE_BLACKBOOK_PRIORITY_SECTIONS,
} from "./blackbook-section-map";


type PageIndexRecord = {
  page: number;
  chapter: number;
  chapterTitle: string;
  textFile: string;
  textLength: number;
  firstNonEmptyLines: string[];
};

type PageIndexFile = {
  formatVersion: number;
  sourceId: string;
  softOneVersion: string;
  totalPages: number;
  chapterCount: number;
  pages: PageIndexRecord[];
};

type CorpusChunk = {
  id: string;

  sourceId:
    typeof SOFTONE_BLACKBOOK_SOURCE_ID;

  softOneVersion: "3.5";

  page: number;

  chapter: number;

  chapterTitle: string;

  section: string;

  chunkIndex: number;

  text: string;

  textLength: number;

  tags: string[];
};


const INDEX_FILE =
  path.resolve(
    "data/softone-blackbook-page-index.json",
  );

const CORPUS_OUTPUT =
  path.resolve(
    "data/softone-blackbook-corpus.json",
  );

const CANDIDATES_OUTPUT =
  path.resolve(
    "data/softone-blackbook-all-candidates.json",
  );


function normalizeWhitespace(
  value: string,
): string {
  return value
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}


function slug(
  value: string,
): string {
  return value
    .toUpperCase()
    .replace(
      /[^A-Z0-9]+/g,
      "_",
    )
    .replace(
      /^_+|_+$/g,
      "",
    )
    .slice(
      0,
      80,
    );
}


function hash(
  value: string,
): string {
  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex")
    .slice(0, 12)
    .toUpperCase();
}


function splitIntoChunks(
  text: string,
): string[] {
  /*
   * Page-local chunking only.
   *
   * We intentionally never merge text across pages,
   * because page provenance must remain exact.
   */
  const normalized =
    normalizeWhitespace(text);

  if (
    !normalized
  ) {
    return [];
  }

  const paragraphs =
    normalized
      .split(/\n\s*\n/)
      .map(
        paragraph =>
          paragraph.trim(),
      )
      .filter(Boolean);

  const chunks: string[] = [];

  let buffer = "";

  for (
    const paragraph of paragraphs
  ) {
    const candidate =
      buffer
        ? `${buffer}\n\n${paragraph}`
        : paragraph;

    /*
     * Keep chunks reasonably small while preserving
     * paragraph boundaries.
     */
    if (
      candidate.length >
        2200 &&
      buffer
    ) {
      chunks.push(buffer);

      buffer =
        paragraph;
    } else {
      buffer =
        candidate;
    }
  }

  if (
    buffer
  ) {
    chunks.push(buffer);
  }

  return chunks;
}


function sectionForPage(
  page: PageIndexRecord,
): {
  section: string;

  allowedExtractionKinds:
    SoftOneBlackBookExtractionKind[];
} {
  const priority =
    SOFTONE_BLACKBOOK_PRIORITY_SECTIONS.find(
      section =>
        page.page >=
          section.startPage &&
        page.page <=
          section.endPage,
    );

  if (
    priority
  ) {
    return {
      section:
        priority.section,

      allowedExtractionKinds:
        [
          ...priority
            .allowedExtractionKinds,
        ],
    };
  }

  /*
   * Every page still belongs to the searchable corpus,
   * even when we have no special extraction policy yet.
   */
  return {
    section:
      page.chapter === 0
        ? "Front Matter"
        : page.chapterTitle,

    allowedExtractionKinds:
      [],
  };
}


function productAreasForPage(
  page: PageIndexRecord,
): any[] {
  const priority =
    SOFTONE_BLACKBOOK_PRIORITY_SECTIONS.find(
      section =>
        page.page >=
          section.startPage &&
        page.page <=
          section.endPage,
    );

  if (
    priority
  ) {
    return [
      ...priority.productAreas,
    ];
  }

  /*
   * Conservative chapter-level fallback.
   */
  switch (
    page.chapter
  ) {
    case 1:
      return [
        "FORM_DESIGN",
        "CUSTOMIZATION",
      ];

    case 2:
      return [
        "BROWSERS",
        "REPORTING",
      ];

    case 3:
      return [
        "REPORTING",
        "CUSTOMIZATION",
      ];

    case 4:
      return [
        "CUSTOMIZATION",
        "EVENTS",
      ];

    case 5:
      return [
        "CUSTOMIZATION",
        "SCHEMA",
      ];

    case 6:
      return [
        "DATABASE_DESIGNER",
        "PHYSICAL_DATABASE",
        "SCHEMA",
        "RELATIONS",
      ];

    case 7:
      return [
        "CUSTOMIZATION",
      ];

    case 8:
      return [
        "CUSTOMIZATION",
        "SCRIPTING",
      ];

    case 9:
      return [
        "SCRIPTING",
        "FORM_DESIGN",
        "OBJECT_MODEL",
      ];

    case 10:
      return [
        "DATA_FLOWS",
        "CUSTOMIZATION",
      ];

    case 11:
      return [
        "SCRIPTING",
        "CUSTOMIZATION",
        "SQL",
      ];

    case 12:
      return [
        "WEB_SERVICES",
        "INTEGRATIONS",
        "OBJECT_MODEL",
      ];

    case 13:
      return [
        "CUSTOMIZATION",
        "REPORTING",
      ];

    case 14:
      return [
        "CUSTOMIZATION",
        "SCRIPTING",
      ];

    default:
      return [];
  }
}


function makeCandidate(
  input: {
    page:
      PageIndexRecord;

    section:
      string;

    extractionKind:
      SoftOneBlackBookExtractionKind;

    claim:
      string;

    symbol?:
      string;

    signature?:
      string;

    exampleText?:
      string;

    productAreas:
      any[];

    tags?:
      string[];

    limitations?:
      string[];
  },
): SoftOneBlackBookCandidate {
  const policy =
    SOFTONE_BLACKBOOK_EXTRACTION_POLICIES[
      input.extractionKind
    ];

  const identity =
    [
      input.page.page,
      input.section,
      input.extractionKind,
      input.symbol ?? "",
      input.signature ?? "",
      input.claim,
    ].join("|");

  return {
    id:
      [
        "BLACKBOOK_3_5",
        `P${input.page.page}`,
        slug(
          input.symbol ??
            input.extractionKind,
        ),
        hash(identity),
      ].join("_"),

    sourceId:
      SOFTONE_BLACKBOOK_SOURCE_ID,

    chapter:
      input.page.chapter,

    chapterTitle:
      input.page.chapterTitle,

    section:
      input.section,

    page:
      input.page.page,

    extractionKind:
      input.extractionKind,

    claim:
      input.claim,

    evidenceKind:
      policy.evidenceKind,

    productAreas:
      input.productAreas,

    promotionPolicy:
      policy.promotionPolicy,

    recommendedStatus:
      policy.recommendedStatus,

    symbol:
      input.symbol,

    signature:
      input.signature,

    exampleText:
      input.exampleText,

    verificationNotes: [
      `Extracted deterministically from SoftOne BlackBook v3.5 page ${input.page.page}.`,
      "Candidate requires source-text guard validation before evidence-catalog import.",
    ],

    limitations:
      input.limitations,

    tags: [
      "blackbook",
      "blackbook-v3.5",
      `chapter-${input.page.chapter}`,
      `page-${input.page.page}`,
      ...(
        input.tags ?? []
      ),
    ],
  };
}


function extractCandidates(
  page: PageIndexRecord,
  text: string,
): SoftOneBlackBookCandidate[] {
  const {
    section,
    allowedExtractionKinds,
  } =
    sectionForPage(page);

  const productAreas =
    productAreasForPage(page);

  const candidates:
    SoftOneBlackBookCandidate[] =
      [];

  const lines =
    text
      .split(/\r?\n/)
      .map(
        line =>
          line.trim(),
      )
      .filter(Boolean);


  /*
   * ----------------------------------------------------
   * FUNCTION / METHOD SIGNATURES
   * ----------------------------------------------------
   *
   * Deliberately restricted to pages whose section map
   * explicitly permits these extraction kinds.
   */
  for (
    const line of lines
  ) {
    const signatureMatch =
      line.match(
        /^([A-Z][A-Z0-9_.]{1,80})\s*\(([^)]*)\)/i,
      );

    if (
      !signatureMatch
    ) {
      continue;
    }

    const symbol =
      signatureMatch[1];

    const signature =
      `${symbol}(${signatureMatch[2]})`;

    let extractionKind:
      SoftOneBlackBookExtractionKind
      | undefined;

    if (
      allowedExtractionKinds.includes(
        "EVENT_SIGNATURE",
      ) &&
      (
        /event/i.test(section) ||
        /^ON[A-Z0-9_]/i.test(
          symbol,
        )
      )
    ) {
      extractionKind =
        "EVENT_SIGNATURE";
    } else if (
      allowedExtractionKinds.includes(
        "METHOD_SIGNATURE",
      ) &&
      /method/i.test(section)
    ) {
      extractionKind =
        "METHOD_SIGNATURE";
    } else if (
      allowedExtractionKinds.includes(
        "FUNCTION_SIGNATURE",
      )
    ) {
      extractionKind =
        "FUNCTION_SIGNATURE";
    }

    if (
      !extractionKind
    ) {
      continue;
    }

    candidates.push(
      makeCandidate({
        page,
        section,
        extractionKind,
        symbol,
        signature,

        claim:
          `${signature} is documented in SoftOne BlackBook v3.5.`,

        exampleText:
          line,

        productAreas,

        tags: [
          `symbol:${symbol}`,
          "signature",
        ],
      }),
    );
  }


  /*
   * ----------------------------------------------------
   * COMMAND SIGNATURES
   * ----------------------------------------------------
   */
  if (
    allowedExtractionKinds.includes(
      "COMMAND_SIGNATURE",
    )
  ) {
    for (
      const line of lines
    ) {
      const commandMatch =
        line.match(
          /^([A-Z][A-Z0-9_]{1,40})\s*(?:=|:)\s*(.+)$/i,
        );

      if (
        !commandMatch
      ) {
        continue;
      }

      const symbol =
        commandMatch[1];

      /*
       * Avoid ordinary prose labels.
       */
      if (
        symbol.length < 2
      ) {
        continue;
      }

      candidates.push(
        makeCandidate({
          page,
          section,

          extractionKind:
            "COMMAND_SIGNATURE",

          symbol,

          signature:
            `${symbol}=...`,

          claim:
            `${symbol} is documented as a command or command parameter in SoftOne BlackBook v3.5.`,

          exampleText:
            line,

          productAreas,

          tags: [
            `symbol:${symbol}`,
            "command",
          ],

          limitations: [
            "The extracted command signature proves documentation presence only; accepted values and execution semantics require the surrounding documented context.",
          ],
        }),
      );
    }
  }


  /*
   * ----------------------------------------------------
   * APPENDIX SYSTEM PARAMETERS
   * ----------------------------------------------------
   *
   * X.SYS.* references are strong deterministic symbols.
   */
  if (
    page.chapter === 14
  ) {
    const seen =
      new Set<string>();

    const matches =
      text.matchAll(
        /\bX\.SYS\.([A-Z0-9_.]+)\b/gi,
      );

    for (
      const match of matches
    ) {
      const symbol =
        `X.SYS.${match[1]}`;

      const key =
        symbol.toUpperCase();

      if (
        seen.has(key)
      ) {
        continue;
      }

      seen.add(key);

      candidates.push(
        makeCandidate({
          page,
          section,

          extractionKind:
            "SYSTEM_PARAMETER",

          symbol,

          signature:
            symbol,

          claim:
            `${symbol} is referenced as a SoftOne system parameter in BlackBook v3.5.`,

          exampleText:
            lines.find(
              line =>
                line
                  .toUpperCase()
                  .includes(key),
            ),

          productAreas,

          tags: [
            `symbol:${symbol}`,
            "system-parameter",
          ],
        }),
      );
    }
  }


  /*
   * ----------------------------------------------------
   * FORM SCRIPT EVENT SYMBOLS
   * ----------------------------------------------------
   *
   * Some documented event definitions may appear without
   * a function-style (...) signature.
   */
  if (
    allowedExtractionKinds.includes(
      "EVENT_SIGNATURE",
    )
  ) {
    const seenEvents =
      new Set(
        candidates
          .filter(
            candidate =>
              candidate.extractionKind ===
              "EVENT_SIGNATURE",
          )
          .map(
            candidate =>
              candidate.symbol
                ?.toUpperCase(),
          )
          .filter(Boolean),
      );

    for (
      const line of lines
    ) {
      const eventMatch =
        line.match(
          /\b(ON[A-Z][A-Z0-9_]{2,60})\b/,
        );

      if (
        !eventMatch
      ) {
        continue;
      }

      const symbol =
        eventMatch[1];

      if (
        seenEvents.has(
          symbol.toUpperCase(),
        )
      ) {
        continue;
      }

      seenEvents.add(
        symbol.toUpperCase(),
      );

      candidates.push(
        makeCandidate({
          page,
          section,

          extractionKind:
            "EVENT_SIGNATURE",

          symbol,

          claim:
            `${symbol} is a documented SoftOne event identifier in BlackBook v3.5.`,

          exampleText:
            line,

          productAreas,

          tags: [
            `symbol:${symbol}`,
            "event",
          ],
        }),
      );
    }
  }


  /*
   * ----------------------------------------------------
   * CASE STUDY PAGES
   * ----------------------------------------------------
   *
   * We do NOT promote arbitrary code or literals to
   * universal behavior.
   *
   * We only record that the page is documented example
   * material. It remains DERIVED by policy.
   */
  if (
    allowedExtractionKinds.includes(
      "CASE_STUDY_PATTERN",
    ) &&
    normalizeWhitespace(text)
      .length > 0
  ) {
    const sample =
      normalizeWhitespace(text)
        .slice(
          0,
          1200,
        );

    candidates.push(
      makeCandidate({
        page,
        section,

        extractionKind:
          "CASE_STUDY_PATTERN",

        claim:
          `SoftOne BlackBook v3.5 page ${page.page} contains a documented Form Scripts case-study example.`,

        exampleText:
          sample,

        productAreas,

        tags: [
          "case-study",
          "documented-example",
        ],

        limitations: [
          "Case-study code and literal values are examples only and must not be generalized as universal SoftOne behavior or tenant configuration.",
        ],
      }),
    );
  }


  return candidates;
}


const index =
  JSON.parse(
    fs.readFileSync(
      INDEX_FILE,
      "utf8",
    ),
  ) as PageIndexFile;


if (
  index.sourceId !==
    SOFTONE_BLACKBOOK_SOURCE_ID
) {
  throw new Error(
    `Unexpected sourceId: ${index.sourceId}`,
  );
}


if (
  index.totalPages !== 573 ||
  index.pages.length !== 573
) {
  throw new Error(
    `Expected 573 indexed pages, got ${index.pages.length}`,
  );
}


const corpus:
  CorpusChunk[] =
    [];

const candidates:
  SoftOneBlackBookCandidate[] =
    [];


for (
  const page of index.pages
) {
  const absoluteTextFile =
    path.resolve(
      page.textFile,
    );

  if (
    !fs.existsSync(
      absoluteTextFile,
    )
  ) {
    throw new Error(
      `Missing page text: ${absoluteTextFile}`,
    );
  }

  const rawText =
    fs.readFileSync(
      absoluteTextFile,
      "utf8",
    );

  const {
    section,
  } =
    sectionForPage(page);

  const chunks =
    splitIntoChunks(
      rawText,
    );

  chunks.forEach(
    (
      text,
      chunkIndex,
    ) => {
      corpus.push({
        id:
          `BLACKBOOK_3_5_P${page.page}_C${chunkIndex + 1}_${hash(text)}`,

        sourceId:
          SOFTONE_BLACKBOOK_SOURCE_ID,

        softOneVersion:
          "3.5",

        page:
          page.page,

        chapter:
          page.chapter,

        chapterTitle:
          page.chapterTitle,

        section,

        chunkIndex:
          chunkIndex + 1,

        text,

        textLength:
          text.length,

        tags: [
          "blackbook",
          "blackbook-v3.5",
          `chapter-${page.chapter}`,
          `page-${page.page}`,
        ],
      });
    },
  );

  candidates.push(
    ...extractCandidates(
      page,
      rawText,
    ),
  );
}


/*
 * Candidate extraction may encounter the same documented
 * symbol/signature more than once on the same page.
 *
 * Candidate IDs are deterministic, so identical IDs represent
 * the same extracted claim and are safely deduplicated here.
 */
const deduplicatedCandidates =
  [
    ...new Map(
      candidates.map(
        candidate => [
          candidate.id,
          candidate,
        ],
      ),
    ).values(),
  ];


/*
 * Candidate IDs must now be unique after deterministic dedupe.
 */
const candidateIds =
  new Set<string>();

for (
  const candidate of deduplicatedCandidates
) {
  if (
    candidateIds.has(
      candidate.id,
    )
  ) {
    throw new Error(
      `Duplicate candidate id after dedupe: ${candidate.id}`,
    );
  }

  candidateIds.add(
    candidate.id,
  );
}


/*
 * Corpus IDs must be unique.
 */
const corpusIds =
  new Set<string>();

for (
  const chunk of corpus
) {
  if (
    corpusIds.has(
      chunk.id,
    )
  ) {
    throw new Error(
      `Duplicate corpus id: ${chunk.id}`,
    );
  }

  corpusIds.add(
    chunk.id,
  );
}


const corpusFile = {
  formatVersion: 1,

  source: {
    sourceId:
      SOFTONE_BLACKBOOK_SOURCE_ID,

    title:
      "SoftOne BlackBook ENG ver.3.5",

    version:
      "3.5",

    authority:
      "OFFICIAL_DOCUMENTATION",
  },

  totalPages:
    index.totalPages,

  chunkCount:
    corpus.length,

  chunks:
    corpus,
};


const candidateFile = {
  formatVersion: 1,

  source: {
    sourceId:
      SOFTONE_BLACKBOOK_SOURCE_ID,

    title:
      "SoftOne BlackBook ENG ver.3.5",

    version:
      "3.5",

    authority:
      "OFFICIAL_DOCUMENTATION",
  },

  candidateCount:
    deduplicatedCandidates.length,

  candidates:
    deduplicatedCandidates,
};


fs.writeFileSync(
  CORPUS_OUTPUT,

  JSON.stringify(
    corpusFile,
    null,
    2,
  ) + "\n",
);


fs.writeFileSync(
  CANDIDATES_OUTPUT,

  JSON.stringify(
    candidateFile,
    null,
    2,
  ) + "\n",
);


const byChapter =
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

        {
          pages:
            index.pages.filter(
              page =>
                page.chapter ===
                chapter,
            ).length,

          chunks:
            corpus.filter(
              chunk =>
                chunk.chapter ===
                chapter,
            ).length,

          candidates:
            deduplicatedCandidates.filter(
              candidate =>
                candidate.chapter ===
                chapter,
            ).length,
        },
      ],
    ),
  );


const byExtractionKind =
  deduplicatedCandidates.reduce<
    Record<
      string,
      number
    >
  >(
    (
      acc,
      candidate,
    ) => {
      acc[
        candidate.extractionKind
      ] =
        (
          acc[
            candidate.extractionKind
          ] ?? 0
        ) + 1;

      return acc;
    },
    {},
  );


const byRecommendedStatus =
  deduplicatedCandidates.reduce<
    Record<
      string,
      number
    >
  >(
    (
      acc,
      candidate,
    ) => {
      acc[
        candidate.recommendedStatus
      ] =
        (
          acc[
            candidate.recommendedStatus
          ] ?? 0
        ) + 1;

      return acc;
    },
    {},
  );


console.log(
  JSON.stringify(
    {
      success: true,

      sourceId:
        SOFTONE_BLACKBOOK_SOURCE_ID,

      totalPages:
        index.totalPages,

      corpusChunks:
        corpus.length,

      structuredCandidates:
        deduplicatedCandidates.length,

      duplicateCandidatesRemoved:
        candidates.length -
        deduplicatedCandidates.length,

      outputs: {
        corpus:
          path.relative(
            process.cwd(),
            CORPUS_OUTPUT,
          ),

        candidates:
          path.relative(
            process.cwd(),
            CANDIDATES_OUTPUT,
          ),
      },

      byChapter,

      byExtractionKind,

      byRecommendedStatus,
    },
    null,
    2,
  ),
);
