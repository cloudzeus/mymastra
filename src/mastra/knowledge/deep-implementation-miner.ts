import {
  execFile,
} from "node:child_process";

import {
  promisify,
} from "node:util";

import {
  join,
} from "node:path";

import {
  analystAgent,
} from "../agents/analyst";

import {
  appDb,
} from "../db/postgres";

import {
  replaceRepositoryImplementationCandidates,
} from "./implementation-catalog-manager";

import type {
  MinedImplementationCandidate,
} from "./implementation-catalog-types";


const execFileAsync =
  promisify(
    execFile,
  );


const WORKSPACE_ROOT =
  process.env
    .IMPLEMENTATION_CATALOG_WORKSPACE_ROOT
    ?.trim() ||
  "/opt/mastra-implementation-repositories";


const MAX_FILES =
  Number(
    process.env
      .IMPLEMENTATION_MINER_MAX_FILES ??
      "45",
  );


const MAX_FILE_BYTES =
  Number(
    process.env
      .IMPLEMENTATION_MINER_MAX_FILE_BYTES ??
      "80000",
  );


const MAX_TOTAL_BYTES =
  Number(
    process.env
      .IMPLEMENTATION_MINER_MAX_TOTAL_BYTES ??
      "700000",
  );


type RepositoryRow = {
  id: string;

  owner: string;

  repository_name:
    string;

  scanned_commit:
    string;

  detected_stack:
    unknown;

  summary:
    string | null;
};


type RepositoryProfile = {
  stack?: string[];

  packageVersions?:
    Record<string, string>;

  dependencyAudit?: {
    available?: boolean;

    critical?: number;

    high?: number;

    moderate?: number;

    low?: number;

    total?: number;

    status?:
      | "UNKNOWN"
      | "PASS"
      | "WARNING"
      | "BLOCKED";

    score?: number;
  };

  integrations?: string[];

  signals?: string[];

  importantFiles?: string[];

  worthDeepScan?: boolean;
};


type EvidenceFile = {
  path: string;

  content: string;

  bytes: number;
};


function normalizeConfidence(
  value: unknown,
): number {
  const number =
    Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  /*
   * Models sometimes naturally return
   * confidence on a 0..5 scale.
   * Normalize that deterministically
   * to the canonical 0..100 scale.
   */
  if (
    number >= 0 &&
    number <= 5
  ) {
    return Math.round(
      number * 20,
    );
  }

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(number),
    ),
  );
}


function clamp(
  value: unknown,
  minimum: number,
  maximum: number,
): number {
  const number =
    Number(
      value,
    );

  if (
    !Number.isFinite(
      number,
    )
  ) {
    return minimum;
  }

  return Math.max(
    minimum,
    Math.min(
      maximum,
      Math.round(
        number,
      ),
    ),
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

  return [
    ...new Set(
      value
        .filter(
          (
            item,
          ): item is string =>
            typeof item ===
              "string",
        )
        .map(
          item =>
            item.trim(),
        )
        .filter(Boolean),
    ),
  ];
}


function parseProfile(
  value:
    string | null,
): RepositoryProfile {
  if (!value) {
    return {};
  }

  try {
    return JSON.parse(
      value,
    ) as
      RepositoryProfile;
  }
  catch {
    return {};
  }
}


async function git(
  cwd: string,
  args: string[],
): Promise<string> {
  const result =
    await execFileAsync(
      "git",
      args,
      {
        cwd,

        maxBuffer:
          30 * 1024 * 1024,
      },
    );

  return result.stdout;
}


async function repositoryTree(
  cwd: string,
): Promise<string[]> {
  const output =
    await git(
      cwd,
      [
        "ls-tree",
        "-r",
        "--name-only",
        "HEAD",
      ],
    );

  return output
    .split(
      "\n",
    )
    .map(
      item =>
        item.trim(),
    )
    .filter(Boolean);
}


function isSourceFile(
  path: string,
): boolean {
  const lower =
    path.toLowerCase();

  if (
    lower.includes(
      "node_modules/",
    ) ||
    lower.includes(
      ".next/",
    ) ||
    lower.includes(
      "dist/",
    ) ||
    lower.includes(
      "build/",
    ) ||
    lower.includes(
      "coverage/",
    ) ||
    lower.includes(
      "public/",
    )
  ) {
    return false;
  }

  return (
    /\.(ts|tsx|js|jsx|mjs|cjs|json|prisma|sql|md|yml|yaml)$/i
      .test(
        path,
      )
  );
}


function filePriority(
  path: string,
  profile:
    RepositoryProfile,
): number {
  const lower =
    path.toLowerCase();

  let score =
    0;


  const exactHigh = [
    "package.json",
    "prisma/schema.prisma",
    "readme.md",
    "dockerfile",
  ];

  if (
    exactHigh.includes(
      lower,
    )
  ) {
    score += 100;
  }


  const highSignals = [
    "/api/",
    "/lib/",
    "/services/",
    "/service/",
    "/integrations/",
    "/integration/",
    "/actions/",
    "/repositories/",
    "/repository/",
    "/workers/",
    "/jobs/",
    "/cron/",
    "/webhooks/",
    "webhook",
    "softone",
    "soft1",
    "milesight",
    "bunny",
    "aade",
    "mydata",
    "woocommerce",
    "stripe",
    "oauth",
    "auth",
    "upload",
    "import",
    "export",
    "sync",
    "worker",
    "scheduler",
    "queue",
    "email",
    "pdf",
    "excel",
    "xlsx",
    "ocr",
  ];

  for (
    const signal
    of highSignals
  ) {
    if (
      lower.includes(
        signal,
      )
    ) {
      score += 12;
    }
  }


  if (
    lower.endsWith(
      "route.ts",
    ) ||
    lower.endsWith(
      "route.js",
    )
  ) {
    score += 20;
  }


  if (
    lower.includes(
      ".test.",
    ) ||
    lower.includes(
      ".spec.",
    )
  ) {
    score += 4;
  }


  for (
    const importantFile
    of profile.importantFiles ??
      []
  ) {
    if (
      importantFile ===
        path
    ) {
      score += 20;
    }
  }


  return score;
}


async function readGitFile(
  cwd: string,
  path: string,
): Promise<
  EvidenceFile | undefined
> {
  try {
    const output =
      await execFileAsync(
        "git",
        [
          "show",
          `HEAD:${path}`,
        ],
        {
          cwd,

          encoding:
            "buffer",

          maxBuffer:
            MAX_FILE_BYTES +
            1024,
        },
      );

    const buffer =
      Buffer.isBuffer(
        output.stdout,
      )
        ? output.stdout
        : Buffer.from(
            String(
              output.stdout,
            ),
          );


    if (
      buffer.length >
        MAX_FILE_BYTES
    ) {
      return undefined;
    }


    if (
      buffer.includes(
        0,
      )
    ) {
      return undefined;
    }


    return {
      path,

      content:
        buffer.toString(
          "utf8",
        ),

      bytes:
        buffer.length,
    };
  }
  catch {
    return undefined;
  }
}


async function buildEvidenceBundle(
  repository:
    RepositoryRow,
  profile:
    RepositoryProfile,
): Promise<{
  tree: string[];

  files:
    EvidenceFile[];
}> {
  const cwd =
    join(
      WORKSPACE_ROOT,
      repository.id,
    );


  const actualCommit =
    (
      await git(
        cwd,
        [
          "rev-parse",
          "HEAD",
        ],
      )
    ).trim();


  if (
    actualCommit !==
      repository.scanned_commit
  ) {
    throw new Error(
      [
        "Implementation repository commit mismatch.",
        `DB=${repository.scanned_commit}`,
        `workspace=${actualCommit}`,
      ].join(
        " ",
      ),
    );
  }


  const tree =
    await repositoryTree(
      cwd,
    );


  const ranked =
    tree
      .filter(
        isSourceFile,
      )
      .map(
        path => ({
          path,

          score:
            filePriority(
              path,
              profile,
            ),
        }),
      )
      .sort(
        (
          a,
          b,
        ) =>
          b.score -
          a.score ||
          a.path.localeCompare(
            b.path,
          ),
      );


  const selected:
    EvidenceFile[] = [];

  let totalBytes =
    0;


  for (
    const entry
    of ranked
  ) {
    if (
      selected.length >=
        MAX_FILES
    ) {
      break;
    }

    const file =
      await readGitFile(
        cwd,
        entry.path,
      );

    if (!file) {
      continue;
    }

    if (
      totalBytes +
        file.bytes >
      MAX_TOTAL_BYTES
    ) {
      continue;
    }

    selected.push(
      file,
    );

    totalBytes +=
      file.bytes;
  }


  return {
    tree,
    files:
      selected,
  };
}



async function repairImplementationMinerJson(
  rawText: string,
): Promise<unknown> {
  let response:
    Awaited<
      ReturnType<
        typeof analystAgent.generate
      >
    > | undefined;

  let lastError:
    unknown;

  for (
    let attempt = 1;
    attempt <= 3;
    attempt += 1
  ) {
    try {
      response =
        await analystAgent.generate(
          [
            {
              role:
                "user" as const,

              content:
                [
                  "Repair the malformed JSON below.",
                  "",
                  "STRICT RULES:",
                  "- Do not add new candidates.",
                  "- Do not remove supported information unless required to make valid JSON.",
                  "- Do not perform research.",
                  "- Do not call tools.",
                  "- Preserve sourceFiles exactly.",
                  "- Return ONLY one valid JSON object.",
                  '- Root schema must be: {"candidates":[...]}',
                  "",
                  "MALFORMED JSON:",
                  rawText,
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
                90_000,
              ),
          },
        );

      break;
    }
    catch (error) {
      lastError =
        error;

      if (
        attempt >= 3
      ) {
        throw error;
      }

      await new Promise(
        resolve =>
          setTimeout(
            resolve,
            attempt * 2_000,
          ),
      );
    }
  }

  if (!response) {
    throw (
      lastError ??
      new Error(
        "Implementation miner JSON repair failed",
      )
    );
  }

  return extractJson(
    response.text ??
      "",
  );
}


function extractJson(
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
    "Implementation miner returned no valid JSON object",
  );
}


function normalizeCandidates(
  payload: unknown,
  actualFiles:
    Set<string>,
  securityStatus:
    | "UNKNOWN"
    | "PASS"
    | "WARNING"
    | "BLOCKED",
): MinedImplementationCandidate[] {
  if (
    typeof payload !==
      "object" ||
    payload === null
  ) {
    return [];
  }


  const raw =
    (
      payload as
        Record<
          string,
          unknown
        >
    ).candidates;


  if (
    !Array.isArray(
      raw,
    )
  ) {
    return [];
  }


  const result:
    MinedImplementationCandidate[] =
      [];


  for (
    const item
    of raw
  ) {
    if (
      typeof item !==
        "object" ||
      item === null
    ) {
      continue;
    }


    const source =
      item as
        Record<
          string,
          unknown
        >;


    const sourceFiles =
      strings(
        source.sourceFiles,
      ).filter(
        path =>
          actualFiles.has(
            path,
          ),
      );


    /*
     * Hard evidence requirement.
     */
    if (
      sourceFiles.length ===
        0
    ) {
      continue;
    }


    const name =
      typeof source.name ===
        "string"
        ? source.name.trim()
        : "";


    const category =
      typeof source.category ===
        "string"
        ? source.category.trim()
        : "";


    const problemSolved =
      typeof source.problemSolved ===
        "string"
        ? source.problemSolved.trim()
        : "";


    if (
      !name ||
      !category ||
      !problemSolved
    ) {
      continue;
    }


    let reuseMode =
      [
        "REUSE_AS_IS",
        "ADAPT",
        "REFERENCE_ONLY",
        "NOT_SUITABLE",
      ].includes(
        String(
          source.reuseMode,
        ),
      )
        ? String(
            source.reuseMode,
          ) as
            MinedImplementationCandidate["reuseMode"]
        : "REFERENCE_ONLY";


    /*
     * Repository-level dependency audit is evidence,
     * not proof that this specific implementation
     * is vulnerable.
     *
     * Automatic promotion to an APPROVED shared skill
     * will be blocked later until candidate-level
     * security review passes.
     *
     * Therefore do NOT destroy the semantic reuseMode
     * here merely because another package elsewhere in
     * the repository has an advisory.
     */



    result.push({
      name,

      category,

      problemSolved,

      description:
        typeof source.description ===
          "string"
          ? source.description.trim()
          : undefined,

      tags:
        strings(
          source.tags,
        ),

      technologies:
        strings(
          source.technologies,
        ),

      sourceFiles,

      dependencies:
        strings(
          source.dependencies,
        ),

      customerSpecificDependencies:
        strings(
          source.customerSpecificDependencies,
        ),

      reusableParts:
        strings(
          source.reusableParts,
        ),

      nonReusableParts:
        strings(
          source.nonReusableParts,
        ),

      reuseGuidance:
        strings(
          source.reuseGuidance,
        ),

      reuseMode,

      scores: {
        completeness:
          clamp(
            (
              source.scores as
                Record<
                  string,
                  unknown
                > | undefined
            )?.completeness,
            0,
            5,
          ),

        isolation:
          clamp(
            (
              source.scores as
                Record<
                  string,
                  unknown
                > | undefined
            )?.isolation,
            0,
            5,
          ),

        production:
          clamp(
            (
              source.scores as
                Record<
                  string,
                  unknown
                > | undefined
            )?.production,
            0,
            5,
          ),

        portability:
          clamp(
            (
              source.scores as
                Record<
                  string,
                  unknown
                > | undefined
            )?.portability,
            0,
            5,
          ),

        maintainability:
          clamp(
            (
              source.scores as
                Record<
                  string,
                  unknown
                > | undefined
            )?.maintainability,
            0,
            5,
          ),
      },

      confidence:
        normalizeConfidence(
          source.confidence,
        ),
    });
  }


  return result;
}


export async function mineImplementationRepository(
  repositoryId: string,
): Promise<{
  repository:
    string;

  candidateCount:
    number;

  candidates:
    MinedImplementationCandidate[];
}> {
  const result =
    await appDb.query<
      RepositoryRow
    >(
      `
        SELECT
          id::text,
          owner,
          repository_name,
          scanned_commit,
          detected_stack,
          summary
        FROM app.implementation_repositories
        WHERE id = $1
          AND status = 'READY'
      `,
      [
        repositoryId,
      ],
    );


  const repository =
    result.rows[0];


  if (!repository) {
    throw new Error(
      `READY implementation repository not found: ${repositoryId}`,
    );
  }


  const profile =
    parseProfile(
      repository.summary,
    );


  if (
    profile.worthDeepScan !==
      true
  ) {
    return {
      repository:
        `${repository.owner}/${repository.repository_name}`,

      candidateCount: 0,

      candidates: [],
    };
  }


  const evidence =
    await buildEvidenceBundle(
      repository,
      profile,
    );


  const evidenceFiles =
    evidence.files.map(
      file => ({
        path:
          file.path,

        content:
          file.content,
      }),
    );


  let response:
    Awaited<
      ReturnType<
        typeof analystAgent.generate
      >
    > | undefined;


  let lastGenerationError:
    unknown;


  for (
    let attempt = 1;
    attempt <= 3;
    attempt += 1
  ) {
    try {
      response =
        await analystAgent.generate(
      [
        {
          role:
            "user" as const,

          content:
            [
              "You are performing INTERNAL IMPLEMENTATION MINING.",
              "",
              "This is NOT customer presales analysis.",
              "Do not call tools.",
              "Do not perform external research.",
              "Use only the repository evidence supplied below.",
              "",
              "GOAL:",
              "Identify substantial implemented technical capabilities that could be useful in other software projects.",
              "",
              "DO NOT create candidates for:",
              "- generic pages",
              "- trivial UI components",
              "- ordinary CRUD with no reusable pattern",
              "- package installation alone",
              "- filenames without implementation evidence",
              "- capabilities that are merely mentioned but not implemented",
              "",
              "GOOD candidate examples:",
              "- external API connectors",
              "- ERP integrations",
              "- webhook ingestion",
              "- authentication patterns",
              "- reusable import/export pipelines",
              "- background workers / retry systems",
              "- file/document processing",
              "- OCR pipelines",
              "- storage adapters",
              "- domain-independent business engines",
              "- synchronization frameworks",
              "- reusable audit/logging infrastructure",
              "- substantial reusable UI/application modules",
              "",
              "SCORING:",
              "Each quality score is integer 0..5.",
              "confidence is integer 0..100, where 100 means extremely well supported by the supplied source evidence.",
              "completeness = how complete the implementation appears",
              "isolation = how independent from customer/project-specific code",
              "production = evidence of production maturity",
              "portability = ease of reuse in another project",
              "maintainability = clarity/current quality of implementation",
              "",
              "REUSE MODE:",
              "REUSE_AS_IS = highly isolated reusable implementation",
              "ADAPT = useful implementation requiring adaptation",
              "REFERENCE_ONLY = valuable technical reference but should not be copied directly",
              "NOT_SUITABLE = implementation should not be reused",
              "",
              "IMPORTANT:",
              "Every candidate MUST contain one or more sourceFiles exactly matching paths from EVIDENCE FILES.",
              "Never invent source paths.",
              "A security BLOCKED repository may still contain valuable REFERENCE_ONLY knowledge.",
              "Do not judge dependency vulnerability status yourself; it is supplied separately.",
              "",
              "Return ONLY valid JSON:",
              "{",
              '  "candidates": [',
              "    {",
              '      "name": "string",',
              '      "category": "string",',
              '      "problemSolved": "string",',
              '      "description": "string",',
              '      "tags": ["string"],',
              '      "technologies": ["string"],',
              '      "sourceFiles": ["exact/path"],',
              '      "dependencies": ["string"],',
              '      "customerSpecificDependencies": ["string"],',
              '      "reusableParts": ["string"],',
              '      "nonReusableParts": ["string"],',
              '      "reuseGuidance": ["string"],',
              '      "reuseMode": "REUSE_AS_IS|ADAPT|REFERENCE_ONLY|NOT_SUITABLE",',
              '      "scores": {',
              '        "completeness": 0,',
              '        "isolation": 0,',
              '        "production": 0,',
              '        "portability": 0,',
              '        "maintainability": 0',
              "      },",
              '      "confidence": 0',
              "    }",
              "  ]",
              "}",
              "",
              "REPOSITORY:",
              `${repository.owner}/${repository.repository_name}`,
              "",
              "PINNED COMMIT:",
              repository.scanned_commit,
              "",
              "PROFILE:",
              JSON.stringify(
                profile,
                null,
                2,
              ),
              "",
              "REPOSITORY TREE:",
              JSON.stringify(
                evidence.tree,
                null,
                2,
              ),
              "",
              "EVIDENCE FILES:",
              JSON.stringify(
                evidenceFiles,
                null,
                2,
              ),
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
            180_000,
          ),

        providerOptions: {
          openrouter: {
            plugins: [
              {
                id:
                  "auto-router",

                cost_quality_tradeoff:
                  Number(
                    process.env
                      .MASTRA_OPENROUTER_COST_QUALITY_TRADEOFF ??
                      "0.5",
                  ),
              },
            ],
          },
        },
          },
        );

      break;
    }
    catch (error) {
      lastGenerationError =
        error;

      if (
        attempt >= 3
      ) {
        throw error;
      }

      console.warn(
        `Implementation miner generation attempt ${attempt} failed; retrying...`,
      );

      await new Promise(
        resolve =>
          setTimeout(
            resolve,
            attempt * 2_000,
          ),
      );
    }
  }


  if (!response) {
    throw (
      lastGenerationError ??
      new Error(
        "Implementation miner generation failed",
      )
    );
  }


  const rawText =
    response.text ??
    "";


  let payload:
    unknown;


  try {
    payload =
      extractJson(
        rawText,
      );
  }
  catch {
    payload =
      await repairImplementationMinerJson(
        rawText,
      );
  }


  const actualFiles =
    new Set(
      evidence.files.map(
        file =>
          file.path,
      ),
    );


  const securityStatus =
    profile.dependencyAudit
      ?.status ??
    "UNKNOWN";


  const candidates =
    normalizeCandidates(
      payload,
      actualFiles,
      securityStatus,
    );


  const vulnerabilitySummary =
    profile.dependencyAudit ??
    {};


  const securityScore =
    clamp(
      profile.dependencyAudit
        ?.score,
      0,
      5,
    );


  await replaceRepositoryImplementationCandidates({
    repositoryId:
      repository.id,

    candidates:
      candidates.map(
        candidate => ({
          name:
            candidate.name,

          category:
            candidate.category,

          problemSolved:
            candidate.problemSolved,

          description:
            candidate.description,

          tags:
            candidate.tags,

          technologies:
            candidate.technologies,

          sourceFiles:
            candidate.sourceFiles,

          dependencies:
            candidate.dependencies,

          customerSpecificDependencies:
            candidate.customerSpecificDependencies,

          reusableParts:
            candidate.reusableParts,

          nonReusableParts:
            candidate.nonReusableParts,

          reuseGuidance:
            candidate.reuseGuidance,

          reuseMode:
            candidate.reuseMode,

          completenessScore:
            candidate.scores
              .completeness,

          isolationScore:
            candidate.scores
              .isolation,

          productionScore:
            candidate.scores
              .production,

          portabilityScore:
            candidate.scores
              .portability,

          maintainabilityScore:
            candidate.scores
              .maintainability,

          confidence:
            candidate.confidence,

          securityStatus,

          vulnerabilitySummary,

          securityScore,
        }),
      ),
  });


  return {
    repository:
      `${repository.owner}/${repository.repository_name}`,

    candidateCount:
      candidates.length,

    candidates,
  };
}
