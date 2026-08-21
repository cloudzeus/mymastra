import {
  createHash,
} from "node:crypto";

import {
  execFileSync,
} from "node:child_process";

import {
  readdirSync,
  statSync,
} from "node:fs";

import {
  join,
} from "node:path";

import {
  analystAgent,
} from "../agents/analyst";

import type {
  SoftOneClaimKind,
} from "./evidence-types";

import type {
  SoftOneProductArea,
} from "./source-types";

import type {
  SoftOneImplementationExtractedClaim,
  SoftOneImplementationExtractionResult,
  SoftOneImplementationSource,
} from "./implementation-knowledge-types";


const DEFAULT_REPOSITORY_WORKSPACE =
  "/opt/mastra-implementation-repositories";


const CLAIM_KINDS =
  new Set<SoftOneClaimKind>([
    "API_BEHAVIOR",
    "FUNCTION",
    "OBJECT_BEHAVIOR",
    "FIELD_SEMANTICS",
    "RELATION",
    "PHYSICAL_MAPPING",
    "SQL_PATTERN",
    "SCRIPT_PATTERN",
    "FORM_BEHAVIOR",
    "EVENT_BEHAVIOR",
    "TENANT_RULE",
    "VERSION_BEHAVIOR",
    "BUSINESS_SEMANTIC",
  ]);


const PRODUCT_AREAS =
  new Set<SoftOneProductArea>([
    "WEB_SERVICES",
    "OBJECT_MODEL",
    "DATABASE_DESIGNER",
    "FORM_DESIGN",
    "DATA_FLOWS",
    "SCRIPTING",
    "EVENTS",
    "SQL",
    "SQLDATA",
    "BROWSERS",
    "REPORTING",
    "CUSTOMIZATION",
    "INTEGRATIONS",
    "SCHEMA",
    "RELATIONS",
    "PHYSICAL_DATABASE",
    "TENANT_CONFIGURATION",
  ]);


function normalizeGitUrl(
  value: string,
): string {
  return value
    .trim()
    .replace(
      /^git@github\.com:/,
      "https://github.com/",
    )
    .replace(
      /\.git$/,
      "",
    )
    .replace(
      /\/$/,
      "",
    )
    .toLowerCase();
}


function git(
  cwd: string,
  args: string[],
): string {
  return execFileSync(
    "git",
    args,
    {
      cwd,
      encoding:
        "utf8",

      stdio: [
        "ignore",
        "pipe",
        "pipe",
      ],

      timeout:
        20_000,
    },
  ).trim();
}


function discoverGitDirectories(
  root: string,
): string[] {
  const result:
    string[] = [];


  for (
    const entry
    of readdirSync(
      root,
    )
  ) {
    const first =
      join(
        root,
        entry,
      );


    try {
      if (
        !statSync(
          first,
        ).isDirectory()
      ) {
        continue;
      }
    }
    catch {
      continue;
    }


    try {
      git(
        first,
        [
          "rev-parse",
          "--git-dir",
        ],
      );

      result.push(
        first,
      );

      continue;
    }
    catch {
      // Maybe workspace/owner/repository.
    }


    let children:
      string[] = [];


    try {
      children =
        readdirSync(
          first,
        );
    }
    catch {
      continue;
    }


    for (
      const child
      of children
    ) {
      const second =
        join(
          first,
          child,
        );


      try {
        if (
          !statSync(
            second,
          ).isDirectory()
        ) {
          continue;
        }


        git(
          second,
          [
            "rev-parse",
            "--git-dir",
          ],
        );


        result.push(
          second,
        );
      }
      catch {
        // Not a git repository.
      }
    }
  }


  return result;
}


function resolveRepositoryPath(
  source:
    SoftOneImplementationSource,
): string {
  const workspace =
    process.env
      .IMPLEMENTATION_REPOSITORY_WORKSPACE ??
    DEFAULT_REPOSITORY_WORKSPACE;


  const expectedUrls =
    new Set(
      [
        source.repositoryUrl,

        `https://github.com/${source.repositoryOwner}/${source.repositoryName}`,
      ].map(
        normalizeGitUrl,
      ),
    );


  const repositories =
    discoverGitDirectories(
      workspace,
    );


  for (
    const repositoryPath
    of repositories
  ) {
    let origin =
      "";


    try {
      origin =
        git(
          repositoryPath,
          [
            "remote",
            "get-url",
            "origin",
          ],
        );
    }
    catch {
      continue;
    }


    if (
      expectedUrls.has(
        normalizeGitUrl(
          origin,
        ),
      )
    ) {
      return repositoryPath;
    }
  }


  throw new Error(
    [
      "Implementation repository clone not found:",
      `${source.repositoryOwner}/${source.repositoryName}`,
    ].join(
      " ",
    ),
  );
}


function verifyPinnedCommit(
  repositoryPath: string,
  commit: string,
): void {
  const resolved =
    git(
      repositoryPath,
      [
        "rev-parse",
        `${commit}^{commit}`,
      ],
    );


  if (
    !resolved ||
    !resolved.startsWith(
      commit,
    ) &&
    !commit.startsWith(
      resolved,
    )
  ) {
    throw new Error(
      `Pinned commit could not be verified: ${commit}`,
    );
  }
}


function readPinnedFile(
  repositoryPath: string,
  commit: string,
  filePath: string,
): string {
  /*
   * READ ONLY.
   *
   * No checkout.
   * No worktree mutation.
   * No branch creation.
   *
   * Read exact blob from exact commit.
   */
  return git(
    repositoryPath,
    [
      "show",
      `${commit}:${filePath}`,
    ],
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
    // Continue.
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
    "SoftOne implementation extractor returned invalid JSON",
  );
}



async function repairExtractorJson(
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
                  "The following text was intended to be valid JSON produced by a SoftOne implementation knowledge extractor.",
                  "",
                  "Rules:",
                  "- Preserve the existing semantic content.",
                  "- Do not add new claims.",
                  "- Do not remove valid claims unless required to make the JSON syntactically valid.",
                  "- Escape quotes, backslashes, control characters and newlines correctly.",
                  "- Return ONLY valid JSON.",
                  "- Root object must contain a claims array.",
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


      const repaired =
        response.text ??
        "";


      if (
        !repaired.trim()
      ) {
        throw new Error(
          "JSON repair returned empty response",
        );
      }


      return parseJson(
        repaired,
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
      "Unable to repair extractor JSON",
    )
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
        .filter(
          Boolean,
        ),
    ),
  ];
}


function normalizeClaim(
  raw: unknown,
  allowedFiles:
    Set<string>,
): SoftOneImplementationExtractedClaim | null {
  if (
    !raw ||
    typeof raw !==
      "object"
  ) {
    return null;
  }


  const item =
    raw as Record<
      string,
      unknown
    >;


  const claim =
    typeof item.claim ===
      "string"
      ? item.claim.trim()
      : "";


  if (!claim) {
    return null;
  }


  /*
   * Implementation repositories establish observed
   * working behavior, not universal SoftOne truth.
   *
   * Keep the claim intrinsically scoped even if an
   * LLM uses overly canonical wording.
   */
  const scopedClaim =
    /^this implementation\b/i.test(claim) ||
    /^the observed implementation\b/i.test(claim) ||
    /^the observed integration\b/i.test(claim) ||
    /^the source code\b/i.test(claim)
      ? claim
      : `Observed implementation behavior: ${claim}`;


  const kind =
    item.kind;


  if (
    typeof kind !==
      "string" ||
    !CLAIM_KINDS.has(
      kind as SoftOneClaimKind,
    )
  ) {
    return null;
  }


  const productAreas =
    strings(
      item.productAreas,
    ).filter(
      area =>
        PRODUCT_AREAS.has(
          area as SoftOneProductArea,
        ),
    ) as SoftOneProductArea[];


  if (
    productAreas.length === 0
  ) {
    return null;
  }


  const evidenceFiles =
    strings(
      item.evidenceFiles,
    ).filter(
      path =>
        allowedFiles.has(
          path,
        ),
    );


  /*
   * Hard evidence rule:
   * no source file = no claim.
   */
  if (
    evidenceFiles.length === 0
  ) {
    return null;
  }


  const confidence =
    item.confidence === "HIGH" ||
    item.confidence === "MEDIUM" ||
    item.confidence === "LOW"
      ? item.confidence
      : "LOW";


  return {
    claim:
      scopedClaim,

    kind:
      kind as SoftOneClaimKind,

    productAreas,

    conditions:
      strings(
        item.conditions,
      ),

    limitations:
      strings(
        item.limitations,
      ),

    tags:
      strings(
        item.tags,
      ),

    evidenceFiles,

    confidence,
  };
}


function contentFingerprint(
  value: string,
): string {
  return createHash(
    "sha256",
  )
    .update(
      value,
    )
    .digest(
      "hex",
    );
}


export async function extractSoftOneImplementationKnowledge(
  source:
    SoftOneImplementationSource,
): Promise<SoftOneImplementationExtractionResult> {
  const repositoryPath =
    resolveRepositoryPath(
      source,
    );


  verifyPinnedCommit(
    repositoryPath,
    source.commit,
  );


  const evidence:
    Array<{
      path: string;
      content: string;
    }> = [];


  const skippedFiles:
    Array<{
      path: string;
      reason: string;
    }> = [];


  /*
   * Prevent huge prompts.
   * Individual implementation candidates should
   * already contain the most relevant files.
   */
  const files =
    source.sourceFiles.slice(
      0,
      16,
    );


  for (
    const filePath
    of files
  ) {
    try {
      let content =
        readPinnedFile(
          repositoryPath,
          source.commit,
          filePath,
        );


      if (
        content.length >
        30_000
      ) {
        content =
          content.slice(
            0,
            30_000,
          );
      }


      if (
        !content.trim()
      ) {
        skippedFiles.push({
          path:
            filePath,

          reason:
            "Empty source file",
        });

        continue;
      }


      evidence.push({
        path:
          filePath,

        content,
      });
    }
    catch (
      error
    ) {
      skippedFiles.push({
        path:
          filePath,

        reason:
          error instanceof Error
            ? error.message
            : String(
                error,
              ),
      });
    }
  }


  if (
    evidence.length === 0
  ) {
    throw new Error(
      `No readable evidence files for candidate ${source.candidateId}`,
    );
  }


  const prompt =
    [
      "SOFTONE IMPLEMENTATION KNOWLEDGE EXTRACTION",
      "",
      "You are examining source code from a real implementation repository.",
      "",
      "The repository is READ-ONLY evidence.",
      "",
      "Extract only atomic SoftOne-specific technical claims that are directly supported by the supplied source code.",
      "",
      "IMPORTANT RULES:",
      "- A working implementation proves only that this pattern was implemented in this project.",
      "- Phrase implementation-derived claims as observations, not universal SoftOne facts.",
      "- Prefer wording such as: 'This implementation uses...', 'The observed integration sends...', 'The implementation expects...', or 'The source code defensively handles...'.",
      "- Do NOT use universal wording such as 'SoftOne always', 'SoftOne requires', 'SoftOne returns', 'must', 'all requests', or 'there exists' unless the supplied source alone can directly establish that scope.",
      "- Do NOT present project configuration, tenant IDs, series IDs, company IDs, credentials or environment-specific values as universal SoftOne facts.",
      "- Do NOT infer undocumented SoftOne behavior.",
      "- Do NOT claim an object/table/field relationship unless the code directly demonstrates it.",
      "- Prefer reusable API/session/object/sync/payload/document/script patterns.",
      "- Exclude generic Next.js, Prisma, React, HTTP or application logic unless it materially describes SoftOne integration.",
      "- Every claim MUST cite at least one exact evidenceFiles path supplied below.",
      "- Never invent a file path.",
      "- Break compound claims into separate atomic claims.",
      "",
      "Allowed kind values:",
      [...CLAIM_KINDS].join(", "),
      "",
      "Allowed productAreas:",
      [...PRODUCT_AREAS].join(", "),
      "",
      "Return ONLY JSON:",
      "{",
      '  "claims": [',
      "    {",
      '      "claim": "specific atomic claim",',
      '      "kind": "API_BEHAVIOR",',
      '      "productAreas": ["WEB_SERVICES"],',
      '      "conditions": [],',
      '      "limitations": [],',
      '      "tags": [],',
      '      "evidenceFiles": ["exact/path.ts"],',
      '      "confidence": "HIGH"',
      "    }",
      "  ]",
      "}",
      "",
      `Capability: ${source.capabilityKey}`,
      `Implementation: ${source.implementationName}`,
      `Repository: ${source.repositoryOwner}/${source.repositoryName}`,
      `Commit: ${source.commit}`,
      "",
      "SOURCE EVIDENCE:",
      ...evidence.flatMap(
        item => [
          "",
          `===== FILE ${item.path} =====`,
          item.content,
        ],
      ),
    ].join(
      "\n",
    );


  let responseText =
    "";

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


      responseText =
        response.text ??
        "";


      if (
        responseText.trim()
      ) {
        break;
      }
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


  if (
    !responseText.trim()
  ) {
    throw (
      lastError ??
      new Error(
        "SoftOne implementation extraction returned no response",
      )
    );
  }


  let payload:
    unknown;


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
        "SoftOne implementation extractor returned malformed JSON;",
        "attempting tools-disabled repair.",
      ].join(
        " ",
      ),
    );


    payload =
      await repairExtractorJson(
        responseText,
      );
  }


  if (
    !payload ||
    typeof payload !==
      "object" ||
    !Array.isArray(
      (
        payload as Record<
          string,
          unknown
        >
      ).claims,
    )
  ) {
    throw new Error(
      "SoftOne implementation extractor response has no claims array",
    );
  }


  const allowedFiles =
    new Set(
      evidence.map(
        item =>
          item.path,
      ),
    );


  const seen =
    new Set<string>();


  const claims =
    (
      payload as {
        claims:
          unknown[];
      }
    ).claims
      .map(
        raw =>
          normalizeClaim(
            raw,
            allowedFiles,
          ),
      )
      .filter(
        (
          claim,
        ): claim is SoftOneImplementationExtractedClaim =>
          claim !== null,
      )
      .filter(
        claim => {
          const key =
            contentFingerprint(
              [
                claim.kind,
                claim.claim
                  .trim()
                  .toLowerCase(),
              ].join(
                "|",
              ),
            );


          if (
            seen.has(
              key,
            )
          ) {
            return false;
          }


          seen.add(
            key,
          );

          return true;
        },
      );


  return {
    source,

    claims,

    skippedFiles,
  };
}
