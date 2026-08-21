import {
  readFileSync,
  writeFileSync,
  existsSync,
} from "node:fs";

import {
  resolve,
} from "node:path";

import {
  analyzeSoftOneImplementationCorroboration,
} from "../src/mastra/softone/implementation-corroboration";

import type {
  SoftOneImplementationCorroborationGroup,
  SoftOneImplementationCorroborationResult,
} from "../src/mastra/softone/implementation-corroboration-types";


function resultPath(
  capabilityKey: string,
): string {
  return resolve(
    process.cwd(),
    "data",
    "softone-corroboration",
    `${capabilityKey.toLowerCase()}.json`,
  );
}


function multipassPath(
  capabilityKey: string,
): string {
  return resolve(
    process.cwd(),
    "data",
    "softone-corroboration",
    `${capabilityKey.toLowerCase()}.multipass.json`,
  );
}


function memberIds(
  group:
    SoftOneImplementationCorroborationGroup,
): Set<string> {
  return new Set(
    group.members.map(
      member =>
        member.evidenceId,
    ),
  );
}


function overlapCount(
  a:
    SoftOneImplementationCorroborationGroup,
  b:
    SoftOneImplementationCorroborationGroup,
): number {
  const aa =
    memberIds(
      a,
    );

  const bb =
    memberIds(
      b,
    );


  let count =
    0;


  for (
    const id
    of aa
  ) {
    if (
      bb.has(
        id,
      )
    ) {
      count += 1;
    }
  }


  return count;
}


function normalizeSemanticKey(
  value: string,
): string {
  return value
    .toUpperCase()
    .replace(
      /WINDOWS[_-]?1253/g,
      "WIN1253",
    )
    .replace(
      /CP[_-]?1253/g,
      "WIN1253",
    )
    .replace(
      /[^A-Z0-9]+/g,
      "_",
    )
    .replace(
      /^_+|_+$/g,
      "",
    );
}


function sameGroup(
  a:
    SoftOneImplementationCorroborationGroup,
  b:
    SoftOneImplementationCorroborationGroup,
): boolean {
  const keyA =
    normalizeSemanticKey(
      a.key,
    );

  const keyB =
    normalizeSemanticKey(
      b.key,
    );


  if (
    keyA === keyB
  ) {
    return true;
  }


  /*
   * If two model passes independently assign at least
   * two exact evidence records to the same semantic
   * assertion, treat them as the same group.
   */
  return (
    overlapCount(
      a,
      b,
    ) >= 2
  );
}


function mergeGroup(
  a:
    SoftOneImplementationCorroborationGroup,
  b:
    SoftOneImplementationCorroborationGroup,
): SoftOneImplementationCorroborationGroup {
  const members =
    [
      ...a.members,
      ...b.members,
    ];


  const uniqueMembers =
    [
      ...new Map(
        members.map(
          member => [
            member.evidenceId,
            member,
          ],
        ),
      ).values(),
    ];


  const repositories =
    [
      ...new Set(
        uniqueMembers.map(
          member =>
            member.repository,
        ),
      ),
    ];


  const reviewedRepositories =
    [
      ...new Set(
        uniqueMembers
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


  const confidence =
    Math.min(
      100,
      repositoryConfidence +
      Math.min(
        5,
        reviewedRepositories.length,
      ),
    );


  return {
    ...a,

    /*
     * Keep the first accepted semantic key/title/claim.
     * Evidence strength is recomputed deterministically.
     */
    members:
      uniqueMembers,

    supportingRepositories:
      repositories,

    distinctRepositoryCount:
      repositories.length,

    reviewedRepositories,

    distinctReviewedRepositoryCount:
      reviewedRepositories.length,

    confidence,

    rationale: [
      `${repositories.length} distinct implementation repositories contain semantically equivalent observations.`,
      reviewedRepositories.length > 0
        ? `${reviewedRepositories.length} supporting repository observation(s) have completed human review.`
        : "No supporting repository observation has completed human review yet.",
      "Evidence members were accumulated across multiple independent semantic-analysis passes.",
    ].join(
      " ",
    ),

    tags:
      [
        ...new Set(
          [
            ...a.tags,
            ...b.tags,
          ],
        ),
      ],
  };
}


function mergeGroups(
  accumulated:
    SoftOneImplementationCorroborationGroup[],
  incoming:
    SoftOneImplementationCorroborationGroup[],
): SoftOneImplementationCorroborationGroup[] {
  const result =
    [
      ...accumulated,
    ];


  for (
    const group
    of incoming
  ) {
    const index =
      result.findIndex(
        existing =>
          sameGroup(
            existing,
            group,
          ),
      );


    if (
      index < 0
    ) {
      result.push(
        group,
      );

      continue;
    }


    result[index] =
      mergeGroup(
        result[index],
        group,
      );
  }


  result.sort(
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


  return result;
}


async function main() {
  const capabilityKey =
    process.argv[2];


  if (!capabilityKey) {
    throw new Error(
      "Capability key required",
    );
  }


  let accumulated:
    SoftOneImplementationCorroborationGroup[] = [];


  const passes =
    3;


  for (
    let pass = 1;
    pass <= passes;
    pass += 1
  ) {
    console.log(
      `\n===== CORROBORATION PASS ${pass}/${passes} =====`,
    );


    const result =
      await analyzeSoftOneImplementationCorroboration(
        capabilityKey,
      );


    accumulated =
      mergeGroups(
        accumulated,
        result.groups,
      );


    console.log(
      "groups discovered this pass:",
      result.groups.length,
    );

    console.log(
      "accumulated groups:",
      accumulated.length,
    );

    console.log(
      "single-pass ungrouped:",
      result.ungroupedEvidenceIds.length,
    );
  }


  /*
   * Derive final ungrouped IDs from the latest evidence
   * universe, minus every evidence member accumulated
   * across all passes.
   */
  const path =
    resultPath(
      capabilityKey,
    );


  if (
    !existsSync(
      path,
    )
  ) {
    throw new Error(
      `Single-pass result missing: ${path}`,
    );
  }


  const latest:
    SoftOneImplementationCorroborationResult =
    JSON.parse(
      readFileSync(
        path,
        "utf8",
      ),
    );


  const groupedIds =
    new Set(
      accumulated.flatMap(
        group =>
          group.members.map(
            member =>
              member.evidenceId,
          ),
      ),
    );


  const allEvidenceIds =
    new Set([
      ...latest.ungroupedEvidenceIds,

      ...latest.groups.flatMap(
        group =>
          group.members.map(
            member =>
              member.evidenceId,
          ),
      ),
  ]);


  const finalResult:
    SoftOneImplementationCorroborationResult = {
    capabilityKey,

    generatedAt:
      new Date()
        .toISOString(),

    groups:
      accumulated,

    ungroupedEvidenceIds:
      [
        ...allEvidenceIds,
      ].filter(
        id =>
          !groupedIds.has(
            id,
          ),
      ),
  };


  writeFileSync(
    multipassPath(
      capabilityKey,
    ),
    JSON.stringify(
      finalResult,
      null,
      2,
    ) + "\n",
    "utf8",
  );


  console.log(
    "\n===== MULTIPASS RESULT =====",
  );

  console.log(
    "groups:",
    finalResult.groups.length,
  );

  console.log(
    "ungrouped:",
    finalResult.ungroupedEvidenceIds.length,
  );


  console.table(
    finalResult.groups.map(
      group => ({
        key:
          group.key,

        repositories:
          group.distinctRepositoryCount,

        reviewed:
          group.distinctReviewedRepositoryCount,

        confidence:
          group.confidence,

        evidence:
          group.members.length,
      }),
    ),
  );


  console.log(
    "\nSOFTONE CORROBORATION MULTIPASS: PASS",
  );
}


main()
  .catch(
    error => {
      console.error(
        "\nSOFTONE CORROBORATION MULTIPASS: FAIL",
      );

      console.error(
        error,
      );

      process.exitCode =
        1;
    },
  );
