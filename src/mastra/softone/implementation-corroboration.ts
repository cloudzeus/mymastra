import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";

import {
  dirname,
  resolve,
} from "node:path";

import {
  analystAgent,
} from "../agents/analyst";

import type {
  SoftOneImplementationCorroborationGroup,
  SoftOneImplementationCorroborationMember,
  SoftOneImplementationCorroborationResult,
} from "./implementation-corroboration-types";


const REVIEW_QUEUE_PATH =
  resolve(
    process.cwd(),
    process.env
      .SOFTONE_REVIEW_QUEUE_PATH ??
      "data/softone-review-queue.json",
  );


function outputPath(
  capabilityKey: string,
): string {
  return resolve(
    process.cwd(),
    "data",
    "softone-corroboration",
    `${capabilityKey.toLowerCase()}.json`,
  );
}


function strings(
  value: unknown,
): string[] {
  if (
    !Array.isArray(
      value,
    )
  ) {
    return [];
  }


  return value.filter(
    (
      item,
    ): item is string =>
      typeof item ===
      "string",
  );
}


function parseJson(
  text: string,
): unknown {
  const trimmed =
    text.trim();


  try {
    return JSON.parse(
      trimmed,
    );
  }
  catch {
    // continue
  }


  const fenced =
    trimmed.match(
      /```(?:json)?\s*([\s\S]*?)```/i,
    );


  if (
    fenced?.[1]
  ) {
    return JSON.parse(
      fenced[1],
    );
  }


  const first =
    trimmed.indexOf(
      "{",
    );

  const last =
    trimmed.lastIndexOf(
      "}",
    );


  if (
    first >= 0 &&
    last > first
  ) {
    return JSON.parse(
      trimmed.slice(
        first,
        last + 1,
      ),
    );
  }


  throw new Error(
    "Corroboration analyzer returned invalid JSON",
  );
}



async function repairCorroborationJson(
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
      const response =
        await analystAgent.generate(
          [
            {
              role:
                "user" as const,

              content:
                [
                  "REPAIR JSON ONLY.",
                  "",
                  "The following text was intended to be the JSON result of a SoftOne implementation corroboration analysis.",
                  "",
                  "Rules:",
                  "- Preserve the existing semantic content.",
                  "- Do not invent assertions.",
                  "- Do not invent evidence IDs.",
                  "- Do not add repositories or evidence.",
                  "- Preserve group keys, normalized claims, rationale, evidenceIds, confidence and tags where present.",
                  "- Remove prose outside the JSON structure.",
                  "- Correct malformed quotes, backslashes, commas, control characters and truncated formatting where possible.",
                  "- Return ONLY valid JSON.",
                  "- Root object MUST be:",
                  '  {"groups":[...]}',
                  "",
                  "MALFORMED JSON:",
                  malformedText,
                ].join(
                  "\\n",
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


      const repairedText =
        response.text ??
        "";


      if (
        !repairedText.trim()
      ) {
        throw new Error(
          "Corroboration JSON repair returned empty response",
        );
      }


      const repaired =
        parseJson(
          repairedText,
        );


      if (
        !repaired ||
        typeof repaired !==
          "object" ||
        !Array.isArray(
          (
            repaired as Record<
              string,
              unknown
            >
          ).groups,
        )
      ) {
        throw new Error(
          "Repaired corroboration JSON has no groups array",
        );
      }


      return repaired;
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
          resolve =>
            setTimeout(
              resolve,
              attempt * 2_000,
            ),
        );
      }
    }
  }


  throw (
    lastError ??
    new Error(
      "Unable to repair corroboration JSON",
    )
  );
}


function loadCapabilityEvidence(
  capabilityKey: string,
): SoftOneImplementationCorroborationMember[] {
  if (
    !existsSync(
      REVIEW_QUEUE_PATH,
    )
  ) {
    return [];
  }


  const queue =
    JSON.parse(
      readFileSync(
        REVIEW_QUEUE_PATH,
        "utf8",
      ),
    );


  const result:
    SoftOneImplementationCorroborationMember[] = [];


  for (
    const item
    of queue.items ?? []
  ) {
    if (
      item.classification !==
      capabilityKey
    ) {
      continue;
    }


    if (
      !item.evidence?.id ||
      !item.evidence?.claim
    ) {
      continue;
    }


    if (
      item.status ===
      "REJECTED"
    ) {
      continue;
    }


    const source =
      item.evidence.sources?.[0];


    const notes =
      strings(
        source?.notes,
      );


    const candidateId =
      notes
        .find(
          note =>
            note.startsWith(
              "Implementation candidate:",
            ),
        )
        ?.replace(
          "Implementation candidate:",
          "",
        )
        .trim();


    const commit =
      notes
        .find(
          note =>
            note.startsWith(
              "Commit:",
            ),
        )
        ?.replace(
          "Commit:",
          "",
        )
        .trim();


    const sourceFiles =
      (
        item.evidence.sources ??
        []
      )
        .map(
          (
            ref: Record<string, unknown>,
          ) =>
            typeof ref.section ===
              "string"
              ? ref.section
              : "",
        )
        .filter(
          Boolean,
        );


    result.push({
      evidenceId:
        String(
          item.evidence.id,
        ),

      reviewId:
        typeof item.id ===
          "string"
          ? item.id
          : undefined,

      reviewStatus:
        item.status === "PENDING" ||
        item.status === "APPROVED" ||
        item.status === "REJECTED" ||
        item.status === "RESOLVED"
          ? item.status
          : undefined,

      repository:
        String(
          source?.sourceTitle ??
          "UNKNOWN",
        ),

      candidateId,

      claim:
        String(
          item.evidence.claim,
        ),

      kind:
        String(
          item.evidence.kind ??
          "UNKNOWN",
        ),

      sourceFiles,

      commit,
    });
  }


  return result;
}


function normalizeKey(
  value: string,
): string {
  return value
    .trim()
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
      120,
    );
}


export async function analyzeSoftOneImplementationCorroboration(
  capabilityKey: string,
): Promise<SoftOneImplementationCorroborationResult> {
  const evidence =
    loadCapabilityEvidence(
      capabilityKey,
    );


  if (
    evidence.length === 0
  ) {
    throw new Error(
      `No implementation evidence found for ${capabilityKey}`,
    );
  }


  const compact =
    evidence.map(
      item => ({
        evidenceId:
          item.evidenceId,

        repository:
          item.repository,

        claim:
          item.claim,

        kind:
          item.kind,
      }),
    );


  const prompt =
    [
      "SOFTONE IMPLEMENTATION CORROBORATION ANALYSIS",
      "",
      "Group implementation-derived SoftOne observations only when they describe substantially the same technical behavior.",
      "",
      "Do not group claims merely because they mention the same SoftOne service.",
      "",
      "Prefer precise canonical assertions such as:",
      "- login response clientID usage",
      "- Windows-1253 response decoding",
      "- GetTable request shape",
      "- GetObjects metadata retrieval",
      "- SqlData request pattern",
      "",
      "Exclude application-specific implementation details such as:",
      "- cookie names",
      "- local cache files",
      "- Prisma schema details",
      "- MySQL local tables",
      "- generic application helper functions",
      "- tenant-specific COMPANY/SERIES/FPRMS values",
      "",
      "A corroborated group should ideally contain evidence from at least TWO distinct repositories.",
      "",
      "Do not invent evidence IDs.",
      "",
      "Return ONLY valid JSON:",
      "{",
      '  "groups": [',
      "    {",
      '      "key": "UPPER_SNAKE_CASE",',
      '      "title": "Human title",',
      '      "normalizedClaim": "Precise implementation-derived technical assertion.",',
      '      "rationale": "Why these observations represent the same behavior.",',
      '      "evidenceIds": ["..."],',
      '      "confidence": 0,',
      '      "tags": []',
      "    }",
      "  ]",
      "}",
      "",
      `Capability: ${capabilityKey}`,
      "",
      "EVIDENCE:",
      JSON.stringify(
        compact,
        null,
        2,
      ),
    ].join(
      "\n",
    );


  let lastError:
    unknown;

  let payload:
    unknown;


  for (
    let attempt = 1;
    attempt <= 3;
    attempt += 1
  ) {
    try {
      const response =
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


      const responseText =
        response.text ??
        "";


      try {
        payload =
          parseJson(
            responseText,
          );
      }
      catch (
        parseError
      ) {
        console.warn(
          [
            "Corroboration analyzer returned malformed JSON;",
            "attempting tools-disabled repair.",
          ].join(
            " ",
          ),
        );


        payload =
          await repairCorroborationJson(
            responseText,
          );
      }


      break;
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
          resolve =>
            setTimeout(
              resolve,
              attempt * 2_000,
            ),
        );
      }
    }
  }


  if (!payload) {
    throw (
      lastError ??
      new Error(
        "Unable to analyze implementation corroboration",
      )
    );
  }


  const rawGroups =
    (
      payload as Record<
        string,
        unknown
      >
    ).groups;


  if (
    !Array.isArray(
      rawGroups,
    )
  ) {
    throw new Error(
      "Corroboration result has no groups array",
    );
  }


  const byEvidenceId =
    new Map(
      evidence.map(
        item => [
          item.evidenceId,
          item,
        ],
      ),
    );


  const usedEvidenceIds =
    new Set<string>();


  const groups:
    SoftOneImplementationCorroborationGroup[] = [];


  for (
    const raw
    of rawGroups
  ) {
    if (
      !raw ||
      typeof raw !==
        "object"
    ) {
      continue;
    }


    const item =
      raw as Record<
        string,
        unknown
      >;


    const evidenceIds =
      strings(
        item.evidenceIds,
      ).filter(
        id =>
          byEvidenceId.has(
            id,
          ),
      );


    const members =
      evidenceIds
        .map(
          id =>
            byEvidenceId.get(
              id,
            ),
        )
        .filter(
          (
            member,
          ): member is SoftOneImplementationCorroborationMember =>
            Boolean(
              member,
            ),
        );


    const repositories =
      [
        ...new Set(
          members.map(
            member =>
              member.repository,
          ),
        ),
      ];


    /*
     * Cross-project corroboration means
     * at least two distinct repositories.
     */
    if (
      repositories.length < 2
    ) {
      continue;
    }


    const rawKey =
      typeof item.key ===
        "string"
        ? item.key
        : "";


    const key =
      normalizeKey(
        rawKey,
      );


    const normalizedClaim =
      typeof item.normalizedClaim ===
        "string"
        ? item.normalizedClaim.trim()
        : "";


    if (
      !key ||
      !normalizedClaim
    ) {
      continue;
    }


    for (
      const member
      of members
    ) {
      usedEvidenceIds.add(
        member.evidenceId,
      );
    }


    const reviewedRepositories =
      [
        ...new Set(
          members
            .filter(
              member =>
                member.reviewStatus ===
                "RESOLVED",
            )
            .map(
              member =>
                member.repository,
            ),
        ),
      ];


    /*
     * Confidence is deterministic.
     *
     * LLM grouping decides semantic equivalence only.
     * It must not decide evidence strength.
     *
     * Base:
     *   2 repos = 60
     *   3 repos = 70
     *   4 repos = 80
     *   5 repos = 90
     *   6+      = 95
     *
     * Human-reviewed independent repositories add
     * up to 5 additional points.
     */
    const repositoryConfidence =
      repositories.length >= 6
        ? 95
        : repositories.length === 5
          ? 90
          : repositories.length === 4
            ? 80
            : repositories.length === 3
              ? 70
              : 60;


    const reviewBonus =
      Math.min(
        5,
        reviewedRepositories.length,
      );


    const confidence =
      Math.min(
        100,
        repositoryConfidence +
        reviewBonus,
      );


    const rationale =
      [
        `${repositories.length} distinct implementation repositories contain semantically equivalent observations.`,
        reviewedRepositories.length > 0
          ? `${reviewedRepositories.length} supporting repository observation(s) have completed human review.`
          : "No supporting repository observation has completed human review yet.",
        "Repository counts and review counts are computed from validated evidence members, not from model output.",
      ].join(
        " ",
      );


    groups.push({
      key,

      title:
        typeof item.title ===
          "string" &&
        item.title.trim()
          ? item.title.trim()
          : key,

      normalizedClaim,

      rationale,

      status:
        "CORROBORATED",

      members,

      supportingRepositories:
        repositories,

      distinctRepositoryCount:
        repositories.length,

      reviewedRepositories,

      distinctReviewedRepositoryCount:
        reviewedRepositories.length,

      confidence,

      tags:
        strings(
          item.tags,
        ),
    });
  }


  groups.sort(
    (
      a,
      b,
    ) =>
      b.distinctRepositoryCount -
        a.distinctRepositoryCount ||
      b.confidence -
        a.confidence ||
      a.key.localeCompare(
        b.key,
      ),
  );


  const result:
    SoftOneImplementationCorroborationResult = {
    capabilityKey,

    generatedAt:
      new Date()
        .toISOString(),

    groups,

    ungroupedEvidenceIds:
      evidence
        .map(
          item =>
            item.evidenceId,
        )
        .filter(
          id =>
            !usedEvidenceIds.has(
              id,
            ),
        ),
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
      result,
      null,
      2,
    ) + "\n",
    "utf8",
  );


  return result;
}
