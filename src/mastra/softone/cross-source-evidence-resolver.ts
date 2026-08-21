import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";

import {
  dirname,
  resolve,
} from "node:path";

import {
  analystAgent,
} from "../agents/analyst";

import {
  searchSoftOneEvidenceCatalog,
} from "./evidence-catalog";

import type {
  SoftOneEvidenceRecord,
} from "./evidence-types";

import type {
  SoftOneCrossSourceMatch,
  SoftOneCrossSourceRelation,
  SoftOneCrossSourceResolution,
  SoftOneCrossSourceResolutionFile,
  SoftOneCrossSourceResolutionResult,
  SoftOneCrossSourceTarget,
} from "./cross-source-evidence-types";


const OFFICIAL_WS_SOURCE =
  "OFFICIAL_SOFTONE_WS_DOCS";

const BLACKBOOK_SOURCE =
  "OFFICIAL_SOFTONE_BLACKBOOK_3_5";


interface LexicalMember {
  evidenceId: string;

  repository: string;

  reviewStatus?:
    | "PENDING"
    | "APPROVED"
    | "REJECTED"
    | "RESOLVED";

  claim: string;

  kind: string;

  commit?: string;

  sourceFiles?: string[];
}


interface LexicalGroup {
  key: string;

  title: string;

  normalizedClaim: string;

  confidence: number;

  supportingRepositories:
    string[];

  reviewedRepositories:
    string[];

  members:
    LexicalMember[];

  tags:
    string[];
}


interface LexicalBucket {
  bucket: string;

  groups:
    LexicalGroup[];
}


interface LexicalFile {
  capabilityKey: string;

  generatedAt: string;

  buckets:
    LexicalBucket[];
}


interface SemanticMatchPayload {
  matches?: Array<{
    evidenceId?: unknown;
    relation?: unknown;
    reason?: unknown;
  }>;
}


function lexicalPath(
  capabilityKey: string,
): string {
  return resolve(
    process.cwd(),
    "data",
    "softone-corroboration",
    `${capabilityKey.toLowerCase()}.lexical.json`,
  );
}


function outputPath(
  capabilityKey: string,
): string {
  return resolve(
    process.cwd(),
    "data",
    "softone-corroboration",
    `${capabilityKey.toLowerCase()}.resolved.json`,
  );
}


function loadTargets(
  capabilityKey: string,
): {
  sourceFile: string;
  targets:
    SoftOneCrossSourceTarget[];
} {
  const path =
    lexicalPath(
      capabilityKey,
    );


  if (
    !existsSync(
      path,
    )
  ) {
    throw new Error(
      `Lexical corroboration file not found: ${path}`,
    );
  }


  const file =
    JSON.parse(
      readFileSync(
        path,
        "utf8",
      ),
    ) as LexicalFile;


  const targets =
    file.buckets.flatMap(
      bucket =>
        bucket.groups.map(
          group => ({
            bucket:
              bucket.bucket,

            key:
              group.key,

            claim:
              group.normalizedClaim,

            title:
              group.title,

            confidence:
              group.confidence,

            repositories:
              group.supportingRepositories,

            reviewedRepositories:
              group.reviewedRepositories,

            members:
              group.members,

            tags:
              group.tags ?? [],
          }),
        ),
    );


  return {
    sourceFile:
      path,

    targets,
  };
}


function normalizeToken(
  value: string,
): string {
  return value
    .toLowerCase()
    .replace(
      /[^a-z0-9_-]+/g,
      " ",
    )
    .trim();
}


const STOPWORDS =
  new Set(
    [
      "the",
      "a",
      "an",
      "and",
      "or",
      "to",
      "of",
      "in",
      "with",
      "for",
      "from",
      "by",
      "is",
      "are",
      "be",
      "as",
      "this",
      "that",
      "when",
      "softone",
      "web",
      "services",
      "service",
      "request",
      "response",
      "implementation",
      "implementations",
      "repositories",
      "repository",
    ],
  );


function searchTerms(
  target:
    SoftOneCrossSourceTarget,
): string[] {
  const preferred =
    [
      ...target.tags,
      target.bucket,
      target.title,
      target.claim,
    ]
      .flatMap(
        value =>
          normalizeToken(
            value,
          )
            .split(
              /\s+/,
            ),
      )
      .filter(
        token =>
          token.length >= 3 &&
          !STOPWORDS.has(
            token,
          ),
      );


  const unique =
    [
      ...new Set(
        preferred,
      ),
    ];


  /*
   * Keep specific SoftOne identifiers first.
   */
  const ranked =
    unique.sort(
      (
        a,
        b,
      ) => {
        const score =
          (
            value: string,
          ) => {
            let result =
              value.length;

            if (
              /[0-9]/.test(
                value,
              )
            ) {
              result +=
                20;
            }

            if (
              value ===
                "sqldata" ||
              value ===
                "clientid" ||
              value ===
                "trdr" ||
              value ===
                "sodtype" ||
              value ===
                "authenticate" ||
              value ===
                "selectorfields" ||
              value ===
                "gettable"
            ) {
              result +=
                50;
            }

            return result;
          };


        return (
          score(
            b,
          ) -
          score(
            a,
          )
        );
      },
    );


  return ranked.slice(
    0,
    8,
  );
}


function collectCatalogCandidates(
  target:
    SoftOneCrossSourceTarget,
): SoftOneEvidenceRecord[] {
  const terms =
    searchTerms(
      target,
    );


  const records =
    new Map<
      string,
      SoftOneEvidenceRecord
    >();


  const add =
    (
      values:
        SoftOneEvidenceRecord[],
    ) => {
      for (
        const record
        of values
      ) {
        records.set(
          record.id,
          record,
        );
      }
    };


  for (
    const sourceId
    of [
      OFFICIAL_WS_SOURCE,
      BLACKBOOK_SOURCE,
    ]
  ) {
    /*
     * Strong specific queries.
     */
    for (
      const term
      of terms
    ) {
      add(
        searchSoftOneEvidenceCatalog({
          query:
            term,

          sourceId,

          limit:
            30,
        }),
      );
    }


    /*
     * Also search two-token combinations.
     */
    for (
      let index = 0;
      index <
        Math.min(
          terms.length - 1,
          5,
        );
      index += 1
    ) {
      add(
        searchSoftOneEvidenceCatalog({
          query:
            `${terms[index]} ${terms[index + 1]}`,

          sourceId,

          limit:
            30,
        }),
      );
    }
  }


  return [
    ...records.values(),
  ];
}


function parseJson(
  text: string,
): unknown {
  const value =
    text.trim();


  try {
    return JSON.parse(
      value,
    );
  }
  catch {
    // continue
  }


  const fenced =
    value.match(
      /```(?:json)?\s*([\s\S]*?)```/i,
    );


  if (
    fenced?.[1]
  ) {
    return JSON.parse(
      fenced[1],
    );
  }


  const start =
    value.indexOf(
      "{",
    );

  const end =
    value.lastIndexOf(
      "}",
    );


  if (
    start >= 0 &&
    end > start
  ) {
    return JSON.parse(
      value.slice(
        start,
        end + 1,
      ),
    );
  }


  throw new Error(
    "Invalid semantic matcher JSON",
  );
}



async function repairSemanticMatcherJson(
  malformedText: string,
): Promise<unknown> {
  let lastError:
    unknown;


  for (
    let attempt = 1;
    attempt <= 3;
    attempt += 1
  ) {
    try {
      const result =
        await analystAgent.generate(
          [
            {
              role:
                "user" as const,

              content:
                [
                  "REPAIR JSON ONLY.",
                  "",
                  "The following text was intended to be JSON produced by a SoftOne semantic evidence matcher.",
                  "",
                  "Rules:",
                  "- Preserve the existing classifications and reasons.",
                  "- Do not invent evidence IDs.",
                  "- Do not invent new matches.",
                  "- Do not change semantic relations unless required only to repair malformed JSON syntax.",
                  "- Return ONLY valid JSON.",
                  "",
                  'Required root shape:',
                  '{"matches":[{"evidenceId":"...","relation":"SUPPORTS|CONTRADICTS|VARIANT|RELATED|NONE","reason":"..."}]}',
                  "",
                  "MALFORMED TEXT:",
                  malformedText,
                ].join(
                  "\n",
                ),
            },
          ],
          {
            toolChoice:
              "none",

            maxSteps:
              1,

            abortSignal:
              AbortSignal.timeout(
                120_000,
              ),
          },
        );


      return parseJson(
        result.text ??
        "",
      );
    }
    catch (
      error
    ) {
      lastError =
        error;


      if (
        attempt < 3
      ) {
        await new Promise(
          resolvePromise =>
            setTimeout(
              resolvePromise,
              attempt * 2_000,
            ),
        );
      }
    }
  }


  throw (
    lastError ??
    new Error(
      "Unable to repair semantic matcher JSON",
    )
  );
}


function relation(
  value: unknown,
): SoftOneCrossSourceRelation | null {
  if (
    typeof value !==
      "string"
  ) {
    return null;
  }


  const normalized =
    value
      .trim()
      .toUpperCase();


  if (
    [
      "SUPPORTS",
      "CONTRADICTS",
      "VARIANT",
      "RELATED",
      "NONE",
    ].includes(
      normalized,
    )
  ) {
    return normalized as
      SoftOneCrossSourceRelation;
  }


  return null;
}


async function semanticMatch(
  target:
    SoftOneCrossSourceTarget,
  candidates:
    SoftOneEvidenceRecord[],
): Promise<
  SoftOneCrossSourceMatch[]
> {
  if (
    candidates.length === 0
  ) {
    return [];
  }


  const evidence =
    candidates.map(
      record => ({
        evidenceId:
          record.id,

        claim:
          record.claim,

        kind:
          record.kind,

        status:
          record.status,

        scope:
          record.scope,

        sources:
          record.sources.map(
            source => ({
              sourceId:
                source.sourceId,

              section:
                source.section,

              page:
                source.page,
            }),
          ),

        limitations:
          record.limitations ??
          [],

        conditions:
          record.conditions ??
          [],
      }),
    );


  const prompt =
    [
      "SOFTONE CROSS-SOURCE SEMANTIC EVIDENCE MATCHING",
      "",
      "TARGET CLAIM:",
      target.claim,
      "",
      `Target bucket: ${target.bucket}`,
      `Target key: ${target.key}`,
      "",
      "Classify each supplied authoritative evidence record ONLY by its semantic relationship to the target claim.",
      "",
      "Allowed relations:",
      "",
      "SUPPORTS",
      "- The evidence directly supports substantially the same technical assertion.",
      "- It may be narrower, provided it proves the target's relevant assertion.",
      "",
      "CONTRADICTS",
      "- The evidence explicitly states behavior incompatible with the target assertion.",
      "",
      "VARIANT",
      "- The evidence documents a different valid mode, alternative flow, version-dependent behavior or conditional alternative.",
      "- A variant is NOT automatically a contradiction.",
      "",
      "RELATED",
      "- Same area/topic but does not prove, contradict or establish a variant of the actual target assertion.",
      "",
      "NONE",
      "- Semantically unrelated.",
      "",
      "Rules:",
      "- Do not infer undocumented semantics.",
      "- Field existence does not prove a field's business-semantic value.",
      "- An example proves only what the example explicitly demonstrates.",
      "- Do not treat implementation conventions as official product behavior.",
      "- Do not treat a missing official statement as contradiction.",
      "- Preserve documented authentication alternatives as variants rather than contradictions.",
      "- Return every supplied evidenceId exactly once.",
      "",
      "Return ONLY JSON:",
      "{",
      '  "matches": [',
      "    {",
      '      "evidenceId": "...",',
      '      "relation": "SUPPORTS|CONTRADICTS|VARIANT|RELATED|NONE",',
      '      "reason": "brief evidence-grounded reason"',
      "    }",
      "  ]",
      "}",
      "",
      "AUTHORITATIVE EVIDENCE:",
      JSON.stringify(
        evidence,
        null,
        2,
      ),
    ].join(
      "\n",
    );


  let payload:
    unknown;


  for (
    let attempt = 1;
    attempt <= 3;
    attempt += 1
  ) {
    try {
      const result =
        await analystAgent.generate(
          [
            {
              role:
                "user" as const,

              content:
                prompt,
            },
          ],
          {
            toolChoice:
              "none",

            maxSteps:
              1,

            abortSignal:
              AbortSignal.timeout(
                180_000,
              ),
          },
        );


      const rawText =
        result.text ??
        "";


      try {
        payload =
          parseJson(
            rawText,
          );
      }
      catch {
        console.warn(
          `Malformed semantic matcher JSON for ${target.key}; attempting repair.`,
        );


        payload =
          await repairSemanticMatcherJson(
            rawText,
          );
      }


      break;
    }
    catch (
      error
    ) {
      if (
        attempt === 3
      ) {
        throw error;
      }


      await new Promise(
        resolvePromise =>
          setTimeout(
            resolvePromise,
            attempt * 2_000,
          ),
      );
    }
  }


  const rawMatches =
    (
      payload as
        SemanticMatchPayload
    )?.matches;


  if (
    !Array.isArray(
      rawMatches,
    )
  ) {
    throw new Error(
      `Semantic matcher returned no matches array for ${target.key}`,
    );
  }


  const byId =
    new Map(
      candidates.map(
        candidate => [
          candidate.id,
          candidate,
        ],
      ),
    );


  const seen =
    new Set<string>();


  const matches:
    SoftOneCrossSourceMatch[] = [];


  for (
    const raw
    of rawMatches
  ) {
    if (
      !raw ||
      typeof raw !==
        "object"
    ) {
      continue;
    }


    const evidenceId =
      typeof raw.evidenceId ===
        "string"
        ? raw.evidenceId
        : "";


    const record =
      byId.get(
        evidenceId,
      );


    if (
      !record ||
      seen.has(
        evidenceId,
      )
    ) {
      continue;
    }


    const semanticRelation =
      relation(
        raw.relation,
      );


    if (
      !semanticRelation
    ) {
      continue;
    }


    seen.add(
      evidenceId,
    );


    matches.push({
      evidenceId,

      relation:
        semanticRelation,

      reason:
        typeof raw.reason ===
          "string"
          ? raw.reason.trim()
          : "",

      evidence:
        record,
    });
  }


  /*
   * If the model omitted an evidence id, treat it
   * conservatively as NONE rather than inventing a
   * semantic relation.
   */
  for (
    const candidate
    of candidates
  ) {
    if (
      seen.has(
        candidate.id,
      )
    ) {
      continue;
    }


    matches.push({
      evidenceId:
        candidate.id,

      relation:
        "NONE",

      reason:
        "Semantic matcher did not return a validated relationship for this evidence record.",

      evidence:
        candidate,
    });
  }


  return matches;
}


function hasSource(
  match:
    SoftOneCrossSourceMatch,
  sourceId:
    string,
): boolean {
  return match.evidence.sources.some(
    source =>
      source.sourceId ===
      sourceId,
  );
}


function looksLikeRecipe(
  target:
    SoftOneCrossSourceTarget,
): boolean {
  const text =
    [
      target.claim,
      target.title,
      ...target.tags,
    ]
      .join(
        " ",
      )
      .toLowerCase();


  return [
    "retry",
    "cache",
    "stored",
    "store locally",
    "storage",
    "wrapper",
    "cookie",
    "local reference",
    "external reference",
    "implementation",
  ].some(
    term =>
      text.includes(
        term,
      ),
  );
}


function deterministicResolution(
  target:
    SoftOneCrossSourceTarget,
  matches:
    SoftOneCrossSourceMatch[],
): {
  resolution:
    SoftOneCrossSourceResolution;

  rationale:
    string[];
} {
  const supports =
    matches.filter(
      match =>
        match.relation ===
        "SUPPORTS",
    );


  const contradictions =
    matches.filter(
      match =>
        match.relation ===
        "CONTRADICTS",
    );


  const variants =
    matches.filter(
      match =>
        match.relation ===
        "VARIANT",
    );


  const authoritativeSupport =
    supports.filter(
      match =>
        match.evidence.status ===
        "VERIFIED",
    );


  const authoritativeContradictions =
    contradictions.filter(
      match =>
        match.evidence.status ===
        "VERIFIED",
    );


  const rationale:
    string[] = [];


  if (
    authoritativeSupport.length >
      0 &&
    authoritativeContradictions.length >
      0
  ) {
    rationale.push(
      "Verified authoritative evidence both supports and contradicts the target assertion.",
    );

    return {
      resolution:
        "CONFLICT",

      rationale,
    };
  }


  if (
    authoritativeSupport.length >
    0
  ) {
    rationale.push(
      `${authoritativeSupport.length} VERIFIED authoritative evidence record(s) semantically support the target claim.`,
    );


    if (
      variants.length >
      0
    ) {
      rationale.push(
        `${variants.length} authoritative variant record(s) were retained as valid alternative behavior rather than contradictions.`,
      );
    }


    return {
      resolution:
        "VERIFIED",

      rationale,
    };
  }


  if (
    authoritativeContradictions.length >
    0
  ) {
    rationale.push(
      `${authoritativeContradictions.length} VERIFIED authoritative evidence record(s) contradict the target assertion.`,
    );


    return {
      resolution:
        "CONFLICT",

      rationale,
    };
  }


  if (
    variants.length >
      0 &&
    target.repositories.length >=
      2
  ) {
    rationale.push(
      "Authoritative evidence documents related alternative behavior but does not directly verify the implementation-derived assertion.",
    );

    rationale.push(
      `${target.repositories.length} independent implementation repositories support the observed target behavior.`,
    );


    return {
      resolution:
        "VERSION_VARIANT",

      rationale,
    };
  }


  if (
    target.repositories.length >=
    2
  ) {
    if (
      looksLikeRecipe(
        target,
      )
    ) {
      rationale.push(
        `${target.repositories.length} independent repositories support an implementation pattern with no matching authoritative product contract.`,
      );


      return {
        resolution:
          "RECIPE_ONLY",

        rationale,
      };
    }


    rationale.push(
      `${target.repositories.length} independent implementation repositories support the assertion, but no authoritative evidence directly verifies it.`,
    );


    return {
      resolution:
        "DERIVED",

      rationale,
    };
  }


  rationale.push(
    "Insufficient authoritative or multi-repository evidence to resolve this assertion.",
  );


  return {
    resolution:
      "UNRESOLVED",

    rationale,
  };
}


async function resolveTarget(
  target:
    SoftOneCrossSourceTarget,
): Promise<
  SoftOneCrossSourceResolutionResult
> {
  const candidates =
    collectCatalogCandidates(
      target,
    );


  const matches =
    await semanticMatch(
      target,
      candidates,
    );


  const authoritativeSupport =
    matches.filter(
      match =>
        match.relation ===
        "SUPPORTS" &&
        match.evidence.status ===
          "VERIFIED",
    );


  const authoritativeContradictions =
    matches.filter(
      match =>
        match.relation ===
        "CONTRADICTS" &&
        match.evidence.status ===
          "VERIFIED",
    );


  const authoritativeVariants =
    matches.filter(
      match =>
        match.relation ===
        "VARIANT" &&
        match.evidence.status ===
          "VERIFIED",
    );


  const relatedAuthoritativeEvidence =
    matches.filter(
      match =>
        match.relation ===
        "RELATED" &&
        match.evidence.status ===
          "VERIFIED",
    );


  const officialWsSupport =
    authoritativeSupport.filter(
      match =>
        hasSource(
          match,
          OFFICIAL_WS_SOURCE,
        ),
    );


  const blackBookSupport =
    authoritativeSupport.filter(
      match =>
        hasSource(
          match,
          BLACKBOOK_SOURCE,
        ),
    );


  const deterministic =
    deterministicResolution(
      target,
      matches,
    );


  return {
    target,

    resolution:
      deterministic.resolution,

    authoritativeSupport,

    authoritativeContradictions,

    authoritativeVariants,

    relatedAuthoritativeEvidence,

    officialWsSupport,

    blackBookSupport,

    rationale: [
      ...deterministic.rationale,

      `Implementation repositories: ${target.repositories.length}.`,

      `Human-reviewed implementation repositories: ${target.reviewedRepositories.length}.`,

      `Authoritative candidates inspected: ${candidates.length}.`,
    ],

    resolvedAt:
      new Date()
        .toISOString(),
  };
}


export async function resolveSoftOneCrossSourceEvidence(
  capabilityKey: string,
): Promise<
  SoftOneCrossSourceResolutionFile
> {
  const loaded =
    loadTargets(
      capabilityKey,
    );


  const results:
    SoftOneCrossSourceResolutionResult[] = [];


  for (
    const target
    of loaded.targets
  ) {
    console.log(
      `Resolving ${target.key}...`,
    );


    const result =
      await resolveTarget(
        target,
      );


    results.push(
      result,
    );


    console.log(
      `  -> ${result.resolution}`,
    );
  }


  const file:
    SoftOneCrossSourceResolutionFile = {
    formatVersion:
      1,

    capabilityKey,

    generatedAt:
      new Date()
        .toISOString(),

    sourceFile:
      loaded.sourceFile,

    results,
  };


  const path =
    outputPath(
      capabilityKey,
    );


  mkdirSync(
    dirname(
      path,
    ),
    {
      recursive:
        true,
    },
  );


  writeFileSync(
    path,
    JSON.stringify(
      file,
      null,
      2,
    ) + "\n",
    "utf8",
  );


  return file;
}
