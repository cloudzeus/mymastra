import {
  writeFileSync,
  mkdirSync,
} from "node:fs";

import {
  dirname,
  resolve,
} from "node:path";

import {
  analystAgent,
} from "../agents/analyst";

import {
  buildSoftOneLexicalBuckets,
} from "./implementation-lexical-buckets";

import type {
  SoftOneImplementationCorroborationGroup,
  SoftOneImplementationCorroborationMember,
} from "./implementation-corroboration-types";


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
    "Bucket corroboration returned invalid JSON",
  );
}


async function repairJson(
  malformedText: string,
): Promise<unknown> {
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
                  "Preserve existing semantic content.",
                  "Do not invent evidence IDs.",
                  "Do not invent assertions.",
                  "Return ONLY valid JSON.",
                  'Root shape: {"groups":[...]}',
                  "",
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
        response.text ??
        "",
      );
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

  throw new Error(
    "Unable to repair bucket corroboration JSON",
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


function deterministicConfidence(
  repositories: number,
  reviewedRepositories: number,
): number {
  const base =
    repositories >= 6
      ? 95
      : repositories === 5
        ? 90
        : repositories === 4
          ? 80
          : repositories === 3
            ? 70
            : 60;

  return Math.min(
    100,
    base +
      Math.min(
        5,
        reviewedRepositories,
      ),
  );
}


export async function analyzeSoftOneLexicalBucket(
  capabilityKey: string,
  bucketKey: string,
): Promise<SoftOneImplementationCorroborationGroup[]> {
  const bucket =
    buildSoftOneLexicalBuckets(
      capabilityKey,
    ).find(
      item =>
        item.key ===
        bucketKey,
    );

  if (!bucket) {
    throw new Error(
      `Lexical bucket not found: ${bucketKey}`,
    );
  }

  const evidence =
    bucket.members.map(
      member => ({
        evidenceId:
          member.evidenceId,

        repository:
          member.repository,

        kind:
          member.kind,

        claim:
          member.claim,
      }),
    );

  const prompt =
    [
      "SOFTONE TARGETED IMPLEMENTATION CORROBORATION",
      "",
      `Capability: ${capabilityKey}`,
      `Lexical bucket: ${bucketKey}`,
      "",
      "The evidence below was preselected deterministically because it concerns one narrow SoftOne technical area.",
      "",
      "Create only assertions that are directly supported by semantically equivalent observations from AT LEAST TWO DISTINCT repositories.",
      "",
      "Rules:",
      "- Do not merge different API flows merely because they share clientID or authentication terminology.",
      "- Preserve implementation variants when behavior differs.",
      "- Do not convert tenant-specific values into general SoftOne facts.",
      "- Do not include local framework/storage implementation details unless they are essential to the shared SoftOne behavior.",
      "- Do not invent evidence IDs.",
      "- Prefer narrow atomic assertions.",
      "",
      "Return ONLY JSON:",
      "{",
      '  "groups": [',
      "    {",
      '      "key": "UPPER_SNAKE_CASE",',
      '      "title": "short title",',
      '      "normalizedClaim": "precise implementation-derived assertion",',
      '      "evidenceIds": ["..."],',
      '      "tags": []',
      "    }",
      "  ]",
      "}",
      "",
      "EVIDENCE:",
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

      try {
        payload =
          parseJson(
            response.text ??
            "",
          );
      }
      catch {
        console.warn(
          `Malformed JSON for bucket ${bucketKey}; attempting repair.`,
        );

        payload =
          await repairJson(
            response.text ??
            "",
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
          resolvePromise =>
            setTimeout(
              resolvePromise,
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
        `No corroboration result for bucket ${bucketKey}`,
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
      `No groups array for bucket ${bucketKey}`,
    );
  }

  const byId =
    new Map<
      string,
      SoftOneImplementationCorroborationMember
    >(
      bucket.members.map(
        member => [
          member.evidenceId,
          member,
        ],
      ),
    );

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
          byId.has(
            id,
          ),
      );

    const members =
      evidenceIds
        .map(
          id =>
            byId.get(
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

    if (
      repositories.length < 2
    ) {
      continue;
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

    const key =
      normalizeKey(
        typeof item.key ===
          "string"
          ? item.key
          : "",
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

    groups.push({
      key:
        `${bucketKey}_${key}`,

      title:
        typeof item.title ===
          "string"
          ? item.title.trim()
          : key,

      normalizedClaim,

      rationale: [
        `${repositories.length} distinct repositories support this assertion inside lexical bucket ${bucketKey}.`,
        `${reviewedRepositories.length} supporting repository observation(s) have completed human review.`,
        "Counts and confidence are computed deterministically from validated evidence IDs.",
      ].join(
        " ",
      ),

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

      confidence:
        deterministicConfidence(
          repositories.length,
          reviewedRepositories.length,
        ),

      tags: [
        bucketKey,
        ...strings(
          item.tags,
        ),
      ],
    });
  }

  return groups;
}


export async function analyzeAllSoftOneLexicalBuckets(
  capabilityKey: string,
) {
  const buckets =
    buildSoftOneLexicalBuckets(
      capabilityKey,
    );

  const results:
    Array<{
      bucket: string;
      groups: SoftOneImplementationCorroborationGroup[];
    }> = [];

  for (
    const bucket
    of buckets
  ) {
    console.log(
      `Analyzing bucket ${bucket.key}...`,
    );

    const groups =
      await analyzeSoftOneLexicalBucket(
        capabilityKey,
        bucket.key,
      );

    results.push({
      bucket:
        bucket.key,

      groups,
    });
  }

  const path =
    resolve(
      process.cwd(),
      "data",
      "softone-corroboration",
      `${capabilityKey.toLowerCase()}.lexical.json`,
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
      {
        capabilityKey,

        generatedAt:
          new Date()
            .toISOString(),

        buckets:
          results,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  return results;
}
