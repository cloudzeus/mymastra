import {
  randomUUID,
} from "node:crypto";

import {
  RequestContext,
} from "@mastra/core/request-context";

import {
  analystAgent,
} from "../agents/analyst";

import {
  getOpportunity,
} from "./opportunity-manager";

import {
  listOpportunityRequests,
} from "./customer-request-manager";

import {
  createInitialSolutionApproach,
} from "./solution-approach-manager";

import {
  createRepositoryInspection,
} from "./repository-inspection-manager";

import {
  getPresalesRepositoryWorkspace,
} from "./presales-repository-workspace-manager";

import {
  listOpportunityPresalesSources,
} from "./presales-source-manager";

import {
  readPresalesRepositoryFile,
  resolvePresalesRepositoryAuthority,
} from "./presales-repository-gateway";

import type {
  InitialSolutionApproach,
  EngagementType,
  PresalesCapability,
} from "./types";

import type {
  PresalesSource,
} from "./presales-source-types";

import type {
  RepositoryInspection,
  RepositoryInspectionFinding,
  RepositoryFindingCategory,
  RepositoryFindingConfidence,
} from "./repository-inspection-types";


export type RunPresalesBusinessTechnicalAnalysisInput = {
  tenantId: string;

  customerId: string;

  opportunityId: string;

  presalesSourceIds?: string[];

  /**
   * Internal human feedback used when re-running
   * the current presales analysis.
   */
  feedback?: string;

  /**
   * New facts supplied after the first analysis.
   */
  additionalInformation?: string;

  timeoutMs?: number;
};


export type RunPresalesBusinessTechnicalAnalysisResult = {
  initialSolutionApproach:
    InitialSolutionApproach;

  repositoryInspections:
    RepositoryInspection[];
};


type ModelFileRef = {
  path: string;

  lineStart?: number;

  lineEnd?: number;
};


type ModelFinding = {
  category:
    RepositoryFindingCategory;

  statement: string;

  confidence:
    RepositoryFindingConfidence;

  fileRefs:
    ModelFileRef[];

  notes: string[];
};


type ModelRepositoryAnalysis = {
  presalesSourceId: string;

  inspectionStatus:
    "READY" | "PARTIAL";

  detectedStack: string[];

  architecture: string[];

  modules: string[];

  integrations: string[];

  dataLayer: string[];

  authentication: string[];

  deployment: string[];

  testing: string[];

  relevantFiles: string[];

  findings:
    ModelFinding[];

  risks: string[];

  technicalDebt: string[];

  limitations: string[];
};


type ModelAnalysisPayload = {
  engagementType:
    EngagementType;

  requiredCapabilities:
    PresalesCapability[];

  optionalCapabilities:
    PresalesCapability[];

  developmentRequired:
    boolean;

  approachText:
    string;

  probableScope:
    string[];

  probableTechnologies:
    string[];

  assumptions:
    string[];

  knownConstraints:
    string[];

  repositoryAnalyses:
    ModelRepositoryAnalysis[];
};


const ENGAGEMENT_TYPES =
  new Set<EngagementType>([
    "SEO",
    "EXISTING_APPLICATION_CHANGE",
    "GREENFIELD_APPLICATION",
    "INTEGRATION",
    "WEBSITE_REDESIGN",
    "CONTENT",
    "CONSULTING",
    "MAINTENANCE",
    "MIXED",
  ]);


const PRESALES_CAPABILITIES =
  new Set<PresalesCapability>([
    "TECHNICAL_ANALYSIS",
    "RESEARCH_COMPETITOR",
    "UI_UX_DESIGN",
    "COPYWRITING",
    "SEARCH_VISIBILITY",
    "CONTENT_CREATION",
    "DEVELOPMENT",
    "INTEGRATION",
    "DATA_MIGRATION",
    "TESTING",
    "DEPLOYMENT",
    "DOCUMENTATION",
  ]);


/*
 * Presales capabilities are deliberately business/domain neutral.
 *
 * Models may occasionally emit a more specific technology/domain label.
 * Those labels never become canonical persisted capabilities.
 *
 * Specialization belongs in evidence, technologies, integrations and
 * specialist knowledge — not in the PresalesCapability taxonomy.
 */
function normalizePresalesCapability(
  value: string,
): PresalesCapability {
  const aliases:
    Record<
      string,
      PresalesCapability
    > = {
      SOFTWARE_DEVELOPMENT:
        "DEVELOPMENT",

      SYSTEM_INTEGRATION:
        "INTEGRATION",

      API_INTEGRATION:
        "INTEGRATION",

      ERP_INTEGRATION:
        "INTEGRATION",

      SOFTONE_INTEGRATION:
        "INTEGRATION",

      IOT_INTEGRATION:
        "INTEGRATION",

      REGULATORY_INTEGRATION:
        "INTEGRATION",

      DATA_INTEGRATION:
        "INTEGRATION",
    };


  const canonical =
    aliases[value] ??
      value;


  if (
    !PRESALES_CAPABILITIES.has(
      canonical as
        PresalesCapability,
    )
  ) {
    throw new Error(
      `Unsupported presales capability=${value}`,
    );
  }


  return canonical as
    PresalesCapability;
}


const FINDING_CATEGORIES =
  new Set<RepositoryFindingCategory>([
    "ARCHITECTURE",
    "DEPENDENCY",
    "DATA_LAYER",
    "AUTHENTICATION",
    "INTEGRATION",
    "PERFORMANCE",
    "SECURITY",
    "TESTING",
    "DEPLOYMENT",
    "TECHNICAL_DEBT",
    "OTHER",
  ]);



function normalizeRepositoryFindingCategory(
  value: string,
): RepositoryFindingCategory {
  const aliases:
    Record<
      string,
      RepositoryFindingCategory
    > = {
      DATA_MODEL:
        "DATA_LAYER",

      DATABASE:
        "DATA_LAYER",

      DATABASE_SCHEMA:
        "DATA_LAYER",

      DATA_ACCESS:
        "DATA_LAYER",

      API:
        "INTEGRATION",

      EXTERNAL_INTEGRATION:
        "INTEGRATION",

      ERP_INTEGRATION:
        "INTEGRATION",

      SOFTONE_INTEGRATION:
        "INTEGRATION",

      IOT_INTEGRATION:
        "INTEGRATION",

      AUTH:
        "AUTHENTICATION",

      AUTHORIZATION:
        "AUTHENTICATION",

      INFRASTRUCTURE:
        "DEPLOYMENT",

      OPERATIONS:
        "DEPLOYMENT",

      CODE_QUALITY:
        "TECHNICAL_DEBT",
    };


  const canonical =
    aliases[value] ??
      value;


  if (
    !FINDING_CATEGORIES.has(
      canonical as
        RepositoryFindingCategory,
    )
  ) {
    throw new Error(
      `Unsupported finding category=${value}`,
    );
  }


  return canonical as
    RepositoryFindingCategory;
}


function requireText(
  value: unknown,
  name: string,
): string {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new Error(
      `${name} is required`,
    );
  }

  return value.trim();
}


function requireUuid(
  value: unknown,
  name: string,
): string {
  const normalized =
    requireText(
      value,
      name,
    );

  if (
    !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
      normalized,
    )
  ) {
    throw new Error(
      `${name} must be a UUID`,
    );
  }

  return normalized;
}


function asRecord(
  value: unknown,
  name: string,
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(
      value,
    )
  ) {
    throw new Error(
      `${name} must be an object`,
    );
  }

  return value as
    Record<string, unknown>;
}


function stringArray(
  value: unknown,
  name: string,
): string[] {
  if (
    value === undefined ||
    value === null
  ) {
    return [];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  const result:
    string[] = [];

  for (
    const item
    of value
  ) {
    let normalized:
      string | undefined;

    if (
      typeof item ===
        "string"
    ) {
      normalized =
        item.trim();
    }
    else if (
      item &&
      typeof item ===
        "object" &&
      !Array.isArray(item)
    ) {
      const record =
        item as
          Record<
            string,
            unknown
          >;

      const candidate =
        record.name ??
        record.title ??
        record.label ??
        record.description ??
        record.value ??
        record.text ??
        record.module;

      if (
        typeof candidate ===
          "string"
      ) {
        normalized =
          candidate.trim();
      }
    }

    if (
      normalized &&
      !result.includes(
        normalized,
      )
    ) {
      result.push(
        normalized,
      );
    }
  }

  return result;
}

function parseJsonObject(
  text: string,
): Record<string, unknown> {
  const trimmed =
    text.trim();

  if (!trimmed) {
    throw new Error(
      "Analyst returned empty text",
    );
  }

  try {
    return asRecord(
      JSON.parse(
        trimmed,
      ),
      "Analyst payload",
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
    try {
      return asRecord(
        JSON.parse(
          fenced[1].trim(),
        ),
        "Analyst payload",
      );
    }
    catch {
      // Continue.
    }
  }

  let start =
    -1;

  let depth =
    0;

  let inString =
    false;

  let escaped =
    false;

  for (
    let i = 0;
    i < trimmed.length;
    i += 1
  ) {
    const char =
      trimmed[i];

    if (
      inString
    ) {
      if (
        escaped
      ) {
        escaped =
          false;

        continue;
      }

      if (
        char === "\\"
      ) {
        escaped =
          true;

        continue;
      }

      if (
        char === '"'
      ) {
        inString =
          false;
      }

      continue;
    }

    if (
      char === '"'
    ) {
      inString =
        true;

      continue;
    }

    if (
      char === "{"
    ) {
      if (
        depth === 0
      ) {
        start =
          i;
      }

      depth +=
        1;

      continue;
    }

    if (
      char === "}" &&
      depth > 0
    ) {
      depth -=
        1;

      if (
        depth === 0 &&
        start >= 0
      ) {
        const candidate =
          trimmed.slice(
            start,
            i + 1,
          );

        try {
          return asRecord(
            JSON.parse(
              candidate,
            ),
            "Analyst payload",
          );
        }
        catch {
          start =
            -1;
        }
      }
    }
  }

  throw new Error(
    `Analyst output does not contain valid JSON: ${trimmed.slice(0, 500)}`,
  );
}


function extractResponseObject(
  response: unknown,
): Record<string, unknown> {
  const record =
    asRecord(
      response,
      "Analyst response",
    );

  const objectValue =
    record.object;

  if (
    objectValue &&
    typeof objectValue ===
      "object" &&
    !Array.isArray(
      objectValue,
    )
  ) {
    return objectValue as
      Record<string, unknown>;
  }

  if (
    typeof record.text ===
      "string"
  ) {
    return parseJsonObject(
      record.text,
    );
  }

  throw new Error(
    "Analyst response contains neither object nor text payload",
  );
}


function validateRepositoryRelativePath(
  value: unknown,
  name: string,
): string {
  const normalized =
    requireText(
      value,
      name,
    ).replace(
      /\\/g,
      "/",
    );

  if (
    normalized.startsWith(
      "/",
    )
  ) {
    throw new Error(
      `${name} must be repository-relative`,
    );
  }

  const segments =
    normalized.split(
      "/",
    );

  if (
    segments.some(
      segment =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        segment === ".git",
    )
  ) {
    throw new Error(
      `${name} contains prohibited path segments`,
    );
  }

  return normalized;
}


function parseOptionalLine(
  value: unknown,
  name: string,
): number | undefined {
  if (
    value === undefined ||
    value === null
  ) {
    return undefined;
  }

  if (
    typeof value !==
      "number" ||
    !Number.isInteger(
      value,
    ) ||
    value < 1
  ) {
    throw new Error(
      `${name} must be a positive integer`,
    );
  }

  return value;
}


function parsePayload(
  raw:
    Record<string, unknown>,
): ModelAnalysisPayload {
  const engagementType =
    requireText(
      raw.engagementType,
      "engagementType",
    ) as EngagementType;

  if (
    !ENGAGEMENT_TYPES.has(
      engagementType,
    )
  ) {
    throw new Error(
      `Unsupported engagementType=${engagementType}`,
    );
  }

  const requiredCapabilities =
    uniqueStrings(
      stringArray(
        raw.requiredCapabilities,
        "requiredCapabilities",
      ).map(
        normalizePresalesCapability,
      ),
    ) as
      PresalesCapability[];


  const optionalCapabilities =
    uniqueStrings(
      stringArray(
        raw.optionalCapabilities,
        "optionalCapabilities",
      ).map(
        normalizePresalesCapability,
      ),
    )
      .filter(
        capability =>
          !requiredCapabilities.includes(
            capability as
              PresalesCapability,
          ),
      ) as
        PresalesCapability[];

  if (
    typeof raw.developmentRequired !==
      "boolean"
  ) {
    throw new Error(
      "developmentRequired must be boolean",
    );
  }

  if (
    !Array.isArray(
      raw.repositoryAnalyses,
    )
  ) {
    throw new Error(
      "repositoryAnalyses must be an array",
    );
  }

  const repositoryAnalyses:
    ModelRepositoryAnalysis[] =
      raw.repositoryAnalyses.map(
        (
          item,
          analysisIndex,
        ) => {
          const analysis =
            asRecord(
              item,
              `repositoryAnalyses[${analysisIndex}]`,
            );

          const inspectionStatus =
            requireText(
              analysis.inspectionStatus,
              `repositoryAnalyses[${analysisIndex}].inspectionStatus`,
            );

          if (
            inspectionStatus !==
              "READY" &&
            inspectionStatus !==
              "PARTIAL"
          ) {
            throw new Error(
              `Invalid repository inspection status=${inspectionStatus}`,
            );
          }

          if (
            !Array.isArray(
              analysis.findings,
            )
          ) {
            throw new Error(
              `repositoryAnalyses[${analysisIndex}].findings must be an array`,
            );
          }

          const findings:
            ModelFinding[] =
              analysis.findings.map(
                (
                  findingValue,
                  findingIndex,
                ) => {
                  const finding =
                    asRecord(
                      findingValue,
                      `repositoryAnalyses[${analysisIndex}].findings[${findingIndex}]`,
                    );

                  const category =
                    requireText(
                      finding.category,
                      "finding.category",
                    ) as RepositoryFindingCategory;

                  if (
                    !FINDING_CATEGORIES.has(
                      category,
                    )
                  ) {
                    throw new Error(
                      `Unsupported finding category=${category}`,
                    );
                  }

                  const confidence =
                    requireText(
                      finding.confidence,
                      "finding.confidence",
                    ) as RepositoryFindingConfidence;

                  if (
                    confidence !==
                      "VERIFIED" &&
                    confidence !==
                      "INFERRED"
                  ) {
                    throw new Error(
                      `Unsupported finding confidence=${confidence}`,
                    );
                  }

                  if (
                    !Array.isArray(
                      finding.fileRefs,
                    )
                  ) {
                    throw new Error(
                      "finding.fileRefs must be an array",
                    );
                  }

                  const fileRefs =
                    finding.fileRefs.map(
                      (
                        fileRefValue,
                        fileRefIndex,
                      ) => {
                        const fileRef =
                          asRecord(
                            fileRefValue,
                            `finding.fileRefs[${fileRefIndex}]`,
                          );

                        const lineStart =
                          parseOptionalLine(
                            fileRef.lineStart,
                            "fileRef.lineStart",
                          );

                        const lineEnd =
                          parseOptionalLine(
                            fileRef.lineEnd,
                            "fileRef.lineEnd",
                          );

                        if (
                          lineStart !==
                            undefined &&
                          lineEnd !==
                            undefined &&
                          lineEnd <
                            lineStart
                        ) {
                          throw new Error(
                            "fileRef.lineEnd must be >= lineStart",
                          );
                        }

                        return {
                          path:
                            validateRepositoryRelativePath(
                              fileRef.path,
                              "fileRef.path",
                            ),

                          lineStart,

                          lineEnd,
                        };
                      },
                    );

                  const statement =
                    requireText(
                      finding.statement,
                      "finding.statement",
                    );


                  const normalizedConfidence:
                    RepositoryFindingConfidence =
                      confidence ===
                        "VERIFIED" &&
                      fileRefs.length ===
                        0
                        ? "INFERRED"
                        : confidence;


                  if (
                    confidence ===
                      "VERIFIED" &&
                    normalizedConfidence ===
                      "INFERRED"
                  ) {
                    console.warn(
                      `Repository finding downgraded VERIFIED -> INFERRED because no fileRef was supplied: ${statement.slice(0, 160)}`,
                    );
                  }


                  return {
                    category,

                    statement,

                    confidence:
                      normalizedConfidence,

                    fileRefs,

                    notes:
                      stringArray(
                        finding.notes ?? [],
                        "finding.notes",
                      ),
                  };
                },
              );

          return {
            presalesSourceId:
              requireUuid(
                analysis.presalesSourceId,
                "repositoryAnalysis.presalesSourceId",
              ),

            inspectionStatus,

            detectedStack:
              stringArray(
                analysis.detectedStack ?? [],
                "detectedStack",
              ),

            architecture:
              stringArray(
                analysis.architecture ?? [],
                "architecture",
              ),

            modules:
              stringArray(
                analysis.modules ?? [],
                "modules",
              ),

            integrations:
              stringArray(
                analysis.integrations ?? [],
                "integrations",
              ),

            dataLayer:
              stringArray(
                analysis.dataLayer ?? [],
                "dataLayer",
              ),

            authentication:
              stringArray(
                analysis.authentication ?? [],
                "authentication",
              ),

            deployment:
              stringArray(
                analysis.deployment ?? [],
                "deployment",
              ),

            testing:
              stringArray(
                analysis.testing ?? [],
                "testing",
              ),

            relevantFiles:
              stringArray(
                analysis.relevantFiles ?? [],
                "relevantFiles",
              ).map(
                (
                  value,
                ) =>
                  validateRepositoryRelativePath(
                    value,
                    "relevantFiles[]",
                  ),
              ),

            findings,

            risks:
              stringArray(
                analysis.risks ?? [],
                "risks",
              ),

            technicalDebt:
              stringArray(
                analysis.technicalDebt ?? [],
                "technicalDebt",
              ),

            limitations:
              stringArray(
                analysis.limitations ?? [],
                "limitations",
              ),
          };
        },
      );

  return {
    engagementType,

    requiredCapabilities,

    optionalCapabilities,

    developmentRequired:
      raw.developmentRequired,

    approachText:
      requireText(
        raw.approachText,
        "approachText",
      ),

    probableScope:
      stringArray(
        raw.probableScope ?? [],
        "probableScope",
      ),

    probableTechnologies:
      stringArray(
        raw.probableTechnologies ?? [],
        "probableTechnologies",
      ),

    assumptions:
      stringArray(
        raw.assumptions ?? [],
        "assumptions",
      ),

    knownConstraints:
      stringArray(
        raw.knownConstraints ?? [],
        "knownConstraints",
      ),

    repositoryAnalyses,
  };
}


function uniqueStrings(
  values: string[],
): string[] {
  return [
    ...new Set(
      values,
    ),
  ];
}


async function verifyFindingEvidence(
  resolved:
    Awaited<
      ReturnType<
        typeof resolvePresalesRepositoryAuthority
      >
    >,

  findings:
    ModelFinding[],
): Promise<
  RepositoryInspectionFinding[]
> {
  const cache =
    new Map<
      string,
      {
        lineCount: number;
      }
    >();

  async function verifyFile(
    relativePath:
      string,
  ): Promise<{
    lineCount: number;
  }> {
    const cached =
      cache.get(
        relativePath,
      );

    if (cached) {
      return cached;
    }

    const result =
      await readPresalesRepositoryFile(
        resolved,
        relativePath,
      );

    const lineCount =
      result.content
        .split(
          /\r?\n/,
        )
        .length;

    const metadata = {
      lineCount,
    };

    cache.set(
      relativePath,
      metadata,
    );

    return metadata;
  }

  const persisted:
    RepositoryInspectionFinding[] =
      [];

  for (
    const finding
    of findings
  ) {
    for (
      const fileRef
      of finding.fileRefs
    ) {
      const file =
        await verifyFile(
          fileRef.path,
        );

      if (
        fileRef.lineStart !==
          undefined &&
        fileRef.lineStart >
          file.lineCount
      ) {
        throw new Error(
          `Repository finding lineStart exceeds file length: ${fileRef.path}:${fileRef.lineStart}`,
        );
      }

      if (
        fileRef.lineEnd !==
          undefined &&
        fileRef.lineEnd >
          file.lineCount
      ) {
        throw new Error(
          `Repository finding lineEnd exceeds file length: ${fileRef.path}:${fileRef.lineEnd}`,
        );
      }
    }

    persisted.push({
      id:
        randomUUID(),

      category:
        finding.category,

      statement:
        finding.statement,

      confidence:
        finding.confidence,

      fileRefs:
        finding.fileRefs,

      notes:
        finding.notes,
    });
  }

  return persisted;
}


export async function runPresalesBusinessTechnicalAnalysis(
  input:
    RunPresalesBusinessTechnicalAnalysisInput,
): Promise<
  RunPresalesBusinessTechnicalAnalysisResult
> {
  const tenantId =
    requireUuid(
      input.tenantId,
      "tenantId",
    );

  const customerId =
    requireUuid(
      input.customerId,
      "customerId",
    );

  const opportunityId =
    requireUuid(
      input.opportunityId,
      "opportunityId",
    );


  const opportunity =
    await getOpportunity(
      tenantId,
      opportunityId,
    );


  if (
    opportunity.customerId !==
      customerId
  ) {
    throw new Error(
      "Presales Analyst BLOCKED: opportunity/customer ownership mismatch",
    );
  }


  if (
    [
      "REJECTED",
      "EXPIRED",
      "CONVERTED_TO_PROJECT",
    ].includes(
      opportunity.status,
    )
  ) {
    throw new Error(
      `Presales Analyst BLOCKED: opportunity status=${opportunity.status}`,
    );
  }


  const requests =
    await listOpportunityRequests(
      tenantId,
      opportunityId,
    );


  if (
    requests.some(
      request =>
        request.customerId !==
          customerId,
    )
  ) {
    throw new Error(
      "Presales Analyst BLOCKED: customer request ownership mismatch",
    );
  }


  if (
    requests.length ===
      0
  ) {
    throw new Error(
      "Presales Analyst requires at least one customer request",
    );
  }


  const allSources =
    await listOpportunityPresalesSources(
      tenantId,
      opportunityId,
    );


  const sourceById =
    new Map<
      string,
      PresalesSource
    >(
      allSources.map(
        source => [
          source.id,
          source,
        ],
      ),
    );


  const selectedSourceIds =
    input.presalesSourceIds
      ? uniqueStrings(
          input.presalesSourceIds.map(
            (
              sourceId,
            ) =>
              requireUuid(
                sourceId,
                "presalesSourceIds[]",
              ),
          ),
        )
      : allSources
          .filter(
            source =>
              source.sourceType ===
                "REPOSITORY" &&
              source.status ===
                "READY",
          )
          .map(
            source =>
              source.id,
          );


  const selectedSources:
    PresalesSource[] =
      [];


  for (
    const sourceId
    of selectedSourceIds
  ) {
    const source =
      sourceById.get(
        sourceId,
      );

    if (!source) {
      throw new Error(
        `Presales Analyst BLOCKED: source does not belong to opportunity: ${sourceId}`,
      );
    }

    if (
      source.customerId !==
        customerId
    ) {
      throw new Error(
        "Presales Analyst BLOCKED: presales source customer ownership mismatch",
      );
    }

    if (
      source.sourceType !==
        "REPOSITORY"
    ) {
      throw new Error(
        `Presales Analyst BLOCKED: selected source is not REPOSITORY: ${sourceId}`,
      );
    }

    if (
      source.status !==
        "READY"
    ) {
      throw new Error(
        `Presales Analyst BLOCKED: repository source status=${source.status}`,
      );
    }

    const workspace =
      await getPresalesRepositoryWorkspace(
        tenantId,
        source.id,
      );

    if (
      workspace.status !==
        "READY" ||
      !workspace.resolvedRef ||
      !workspace.resolvedCommit
    ) {
      throw new Error(
        `Presales Analyst BLOCKED: repository workspace is not READY: ${source.id}`,
      );
    }

    selectedSources.push(
      source,
    );
  }


  const requestContext =
    new RequestContext();


  requestContext.set(
    "tenantId",
    tenantId,
  );


  requestContext.set(
    "customerId",
    customerId,
  );


  requestContext.set(
    "opportunityId",
    opportunityId,
  );


  const repositoryBriefs =
    await Promise.all(
      selectedSources.map(
        async source => {
          const workspace =
            await getPresalesRepositoryWorkspace(
              tenantId,
              source.id,
            );

          return {
            presalesSourceId:
              source.id,

            title:
              source.title,

            repositoryUrl:
              source.repositoryUrl,

            requestedRef:
              source.requestedRef,

            authoritativeResolvedRef:
              workspace.resolvedRef,

            authoritativeResolvedCommit:
              workspace.resolvedCommit,
          };
        },
      ),
    );


  const executionBrief = {
    humanFeedback:
      input.feedback?.trim() ||
      undefined,

    additionalInformation:
      input.additionalInformation?.trim() ||
      undefined,


    opportunity: {
      id:
        opportunity.id,

      title:
        opportunity.title,

      description:
        opportunity.description,

      status:
        opportunity.status,

      expectedBudget:
        opportunity.expectedBudget,

      currency:
        opportunity.currency,

      targetDate:
        opportunity.targetDate,
    },

    customerRequests:
      requests.map(
        request => ({
          id:
            request.id,

          title:
            request.title,

          requestText:
            request.requestText,

          budgetText:
            request.budgetText,

          timelineText:
            request.timelineText,

          sourceUrls:
            request.sourceUrls,
        }),
      ),

    repositorySources:
      repositoryBriefs,
  };


  const messages = [
    {
      role:
        "user" as const,

      content:
        [
          "Perform the presales business and technical analysis for this Opportunity.",
          "",
          "The customer request/problem is the primary question to answer.",
          "",
          "For every repositorySources entry:",
          "- inspect that exact presalesSourceId using the presales repository tools;",
          "- use repository-context first;",
          "- inspect only files relevant to the customer's problem and the architecture needed to understand it;",
          "- VERIFIED findings require direct file evidence;",
          "- INFERRED findings must remain explicitly inferred;",
          "- do not invent repository facts;",
          "- do not output or override filesystem paths, Git refs or commit identifiers.",
          "- stop repository exploration once you have sufficient evidence to answer the customer problem;",
          "- do not keep reading peripheral files merely to make the repository inventory exhaustive;",
          "- reserve enough remaining steps to produce the final required JSON object.",
          "",
          "HUMAN FEEDBACK / RERUN POLICY:",
          "If humanFeedback is present, treat it as an explicit correction or direction from our internal presales team.",
          "If additionalInformation is present, incorporate it as newly supplied business context.",
          "Repository evidence remains authoritative for statements about the existing codebase.",
          "Do not ignore human feedback merely because the previous analysis took a different direction.",
          "",
          "OUTPUT LANGUAGE:",
          "All business, analytical and customer-facing narrative content MUST be written in Greek.",
          "This includes approachText, scope descriptions, assumptions, constraints, findings, risks, architecture descriptions, module descriptions, integration descriptions and acceptance-related narrative.",
          "Keep technical identifiers in their original form: filenames, repository paths, API endpoint names, database/model names, SoftOne object names, class/function names, product names and protocol names.",
          "Do not translate code identifiers.",
          "",
          "REPOSITORY EVIDENCE RULES:",
          "A finding may be VERIFIED only when you can provide at least one real repository-relative fileRef from a file actually inspected through repository tools.",
          "If you believe a statement is true but cannot provide a supporting fileRef, mark it INFERRED.",
          "Never emit VERIFIED with an empty fileRefs array.",
          "Do not invent filenames or paths.",
          "",
          "REPOSITORY FINDING CATEGORIES:",
          "Each finding.category MUST use ONLY one of:",
          "ARCHITECTURE, DEPENDENCY, DATA_LAYER, AUTHENTICATION, INTEGRATION, PERFORMANCE, SECURITY, TESTING, DEPLOYMENT, TECHNICAL_DEBT, OTHER.",
          "Use DATA_LAYER for database schema, Prisma models, persistence design and data-model findings.",
          "Do NOT emit DATA_MODEL, DATABASE_SCHEMA, API_INTEGRATION, SOFTONE_INTEGRATION or other technology-specific category names.",
          "",
          "CAPABILITY TAXONOMY:",
          "requiredCapabilities and optionalCapabilities MUST use ONLY these canonical values:",
          "TECHNICAL_ANALYSIS, RESEARCH_COMPETITOR, UI_UX_DESIGN, COPYWRITING, SEARCH_VISIBILITY, CONTENT_CREATION, DEVELOPMENT, INTEGRATION, DATA_MIGRATION, TESTING, DEPLOYMENT, DOCUMENTATION.",
          "",
          "Capabilities describe the kind of work required, not a product, vendor, protocol or specialist knowledge module.",
          "Examples:",
          "- SoftOne/API/ERP/IoT/AADE integration => INTEGRATION",
          "- application coding => DEVELOPMENT",
          "- repository/system assessment => TECHNICAL_ANALYSIS",
          "",
          "Do NOT emit labels such as SOFTONE_INTEGRATION, ERP_INTEGRATION, API_INTEGRATION, IOT_INTEGRATION, REGULATORY_INTEGRATION, SYSTEM_INTEGRATION or SOFTWARE_DEVELOPMENT.",
          "Technology/domain specificity belongs in probableTechnologies, repository analysis, integrations, findings and constraints.",
          "",
          "Do not select a capability merely because you have tools or specialist knowledge for that technology.",
          "The customer requirement and verified evidence determine capabilities.",
          "",
          "Return ONLY one JSON object with this exact top-level shape:",
          "",
          JSON.stringify(
            {
              engagementType:
                "EXISTING_APPLICATION_CHANGE",

              requiredCapabilities: [
                "TECHNICAL_ANALYSIS",
              ],

              optionalCapabilities: [],

              developmentRequired:
                true,

              approachText:
                "Evidence-backed initial solution approach.",

              probableScope: [],

              probableTechnologies: [],

              assumptions: [],

              knownConstraints: [],

              repositoryAnalyses: [
                {
                  presalesSourceId:
                    "UUID_FROM_CONTEXT",

                  inspectionStatus:
                    "READY",

                  detectedStack: [],

                  architecture: [],

                  modules: [],

                  integrations: [],

                  dataLayer: [],

                  authentication: [],

                  deployment: [],

                  testing: [],

                  relevantFiles: [],

                  findings: [
                    {
                      category:
                        "ARCHITECTURE",

                      statement:
                        "Evidence-backed statement.",

                      confidence:
                        "VERIFIED",

                      fileRefs: [
                        {
                          path:
                            "relative/path.ext",

                          lineStart:
                            1,

                          lineEnd:
                            1,
                        },
                      ],

                      notes: [],
                    },
                  ],

                  risks: [],

                  technicalDebt: [],

                  limitations: [],
                },
              ],
            },
            null,
            2,
          ),
          "",
          "repositoryAnalyses must contain exactly one entry for each repository source supplied.",
          "Do not include a repositoryAnalysis for any source not supplied.",
          "",
          "Execution brief:",
          JSON.stringify(
            executionBrief,
            null,
            2,
          ),
        ].join(
          "\n",
        ),
    },
  ];


  const timeoutMs =
    typeof input.timeoutMs ===
      "number" &&
    Number.isFinite(
      input.timeoutMs,
    ) &&
    input.timeoutMs >=
      1000
      ? Math.floor(
          input.timeoutMs,
        )
      : 180_000;


  let response:
    Awaited<
      ReturnType<
        typeof analystAgent.generate
      >
    > | undefined;


  for (
    let attempt = 1;
    attempt <= 2;
    attempt += 1
  ) {
    response =
      await analystAgent.generate(
        messages,
        {
          requestContext,

          toolChoice:
            selectedSources.length >
              0
              ? "auto"
              : "none",

          maxSteps:
            selectedSources.length >
              0
              ? 18
              : 1,

          abortSignal:
            AbortSignal.timeout(
              timeoutMs,
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
                        "8",
                    ),
                },
              ],
            },
          },
        },
      );


    const record =
      response as {
        object?: unknown;
        text?: unknown;
      };


    const hasObject =
      !!record.object &&
      typeof record.object ===
        "object" &&
      !Array.isArray(
        record.object,
      );


    const hasText =
      typeof record.text ===
        "string" &&
      record.text.trim().length >
        0;


    if (
      hasObject ||
      hasText
    ) {
      break;
    }


    if (
      attempt ===
        1
    ) {
      console.warn(
        "Presales Analyst returned no content; retrying once through OpenRouter Auto Router.",
      );
    }
  }


  if (!response) {
    throw new Error(
      "Presales Analyst produced no response",
    );
  }


  let rawPayload:
    Record<string, unknown>;


  try {
    rawPayload =
      extractResponseObject(
        response,
      );
  }
  catch (
    initialError
  ) {
    const rawTextValue =
      (
        response as {
          text?: unknown;
        }
      ).text;


    const rawText =
      typeof rawTextValue ===
        "string"
        ? rawTextValue
        : "";


    console.warn(
      "Presales Analyst output was not valid JSON; inspecting completed tool evidence before serialization fallback.",
    );


    console.log(
      "\n--- PRESALES ANALYST RAW RESPONSE DIAGNOSTIC ---",
    );


    console.log(
      "rawTextLength:",
      rawText.length,
    );


    console.log(
      "rawTextPreview:",
      rawText.slice(
        0,
        4000,
      ),
    );


    const diagnosticResponse =
      response as unknown as {
        steps?: unknown[];
      };


    console.log(
      "stepsCount:",
      Array.isArray(
        diagnosticResponse.steps,
      )
        ? diagnosticResponse.steps.length
        : 0,
    );


    if (
      Array.isArray(
        diagnosticResponse.steps,
      )
    ) {
      diagnosticResponse.steps.forEach(
        (
          step,
          index,
        ) => {
          console.log(
            `STEP ${index + 1}:`,
            JSON.stringify(
              step,
              null,
              2,
            ).slice(
              0,
              12000,
            ),
          );
        },
      );
    }


    const responseWithSteps =
      response as unknown as {
        steps?: Array<{
          toolCalls?: unknown[];
          toolResults?: unknown[];
          text?: string;
        }>;
      };


    const evidenceTranscript =
      Array.isArray(
        responseWithSteps.steps,
      )
        ? responseWithSteps.steps.map(
            (
              step,
              index,
            ) => ({
              step:
                index + 1,

              toolCalls:
                step.toolCalls ??
                [],

              toolResults:
                step.toolResults ??
                [],

              text:
                step.text ??
                "",
            }),
          )
        : [];


    const hasToolEvidence =
      evidenceTranscript.some(
        step =>
          step.toolResults.length >
            0 ||
          step.toolCalls.length >
            0,
      );


    if (
      !rawText.trim() &&
      !hasToolEvidence
    ) {
      throw initialError;
    }


    console.log(
      "serializationEvidence:",
      {
        rawTextLength:
          rawText.length,

        steps:
          evidenceTranscript.length,

        hasToolEvidence,
      },
    );


    const serializationResponse =
      await analystAgent.generate(
        [
          {
            role:
              "user" as const,

            content:
              [
                "Produce the FINAL presales analysis JSON from the completed repository inspection transcript below.",
                "",
                "IMPORTANT:",
                "- Do not perform new research.",
                "- Do not call tools.",
                "- Do not invent facts.",
                "- Use ONLY evidence contained in the transcript and execution brief.",
                "- A VERIFIED finding requires at least one real repository-relative fileRef supported by an actual repository tool result.",
                "- If no supporting fileRef exists in the evidence transcript, the finding MUST be INFERRED, never VERIFIED.",
                "- Never invent a file path merely to satisfy VERIFIED evidence requirements.",
                "- If evidence supports SoftOne, Milesight, BunnyCDN or any other existing integration, include it.",
                "- Do not omit an existing integration merely because the customer did not mention it.",
                "- Do not invent AADE API endpoints, fields or business rules that are not supported by authoritative evidence.",
                "- Unsupported AADE-specific requirements must remain assumptions, dependencies, risks or unresolved items.",
                "- Capabilities must use only the canonical presales capability taxonomy.",
                "- All narrative/business content in the JSON MUST be written in Greek.",
                "- Keep technical identifiers, filenames, paths, API names, model names, SoftOne names and code identifiers in their original form.",
                "",
                "Return ONLY one valid JSON object with the exact schema requested in the original execution brief.",
                "",
                "ORIGINAL EXECUTION BRIEF:",
                JSON.stringify(
                  executionBrief,
                  null,
                  2,
                ),
                "",
                "COMPLETED TOOL/EVIDENCE TRANSCRIPT:",
                JSON.stringify(
                  evidenceTranscript,
                  null,
                  2,
                ),
              ].join(
                "\n",
              ),
          },
        ],
        {
          requestContext,

          toolChoice:
            "none",

          maxSteps:
            1,

          abortSignal:
            AbortSignal.timeout(
              90_000,
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
                        "8",
                    ),
                },
              ],
            },
          },
        },
      );


    rawPayload =
      (() => {
        const serializationRecord =
          serializationResponse as {
            object?: unknown;
            text?: unknown;
          };


        console.log(
          "\n--- PRESALES SERIALIZATION RESPONSE ---",
        );


        console.log(
          "serializationObject:",
          serializationRecord.object
            ? JSON.stringify(
                serializationRecord.object,
                null,
                2,
              ).slice(
                0,
                12000,
              )
            : null,
        );


        console.log(
          "serializationText:",
          typeof serializationRecord.text ===
            "string"
            ? serializationRecord.text.slice(
                0,
                12000,
              )
            : serializationRecord.text,
        );


        return extractResponseObject(
          serializationResponse,
        );
      })();
  }


  const payload =
    parsePayload(
      rawPayload,
    );


  const expectedSourceIds =
    new Set(
      selectedSources.map(
        source =>
          source.id,
      ),
    );


  const actualSourceIds =
    new Set(
      payload.repositoryAnalyses.map(
        analysis =>
          analysis.presalesSourceId,
      ),
    );


  if (
    actualSourceIds.size !==
      expectedSourceIds.size
  ) {
    throw new Error(
      "Presales Analyst repository analysis source-set mismatch",
    );
  }


  for (
    const sourceId
    of expectedSourceIds
  ) {
    if (
      !actualSourceIds.has(
        sourceId,
      )
    ) {
      throw new Error(
        `Presales Analyst omitted repository source=${sourceId}`,
      );
    }
  }


  if (
    payload.repositoryAnalyses.length !==
      actualSourceIds.size
  ) {
    throw new Error(
      "Presales Analyst returned duplicate repositoryAnalyses entries",
    );
  }


  const repositoryInspections:
    RepositoryInspection[] =
      [];


  for (
    const analysis
    of payload.repositoryAnalyses
  ) {
    const source =
      sourceById.get(
        analysis.presalesSourceId,
      );


    if (
      !source ||
      !source.repositoryUrl
    ) {
      throw new Error(
        `Authoritative repository source unavailable: ${analysis.presalesSourceId}`,
      );
    }


    const workspace =
      await getPresalesRepositoryWorkspace(
        tenantId,
        source.id,
      );


    if (
      workspace.status !==
        "READY" ||
      !workspace.resolvedRef ||
      !workspace.resolvedCommit
    ) {
      throw new Error(
        `Repository workspace lost READY authority: ${source.id}`,
      );
    }


    const resolved =
      await resolvePresalesRepositoryAuthority(
        {
          tenantId,
          customerId,
          opportunityId,
        },

        source.id,
      );


    const findings =
      await verifyFindingEvidence(
        resolved,
        analysis.findings,
      );


    const inspection =
      await createRepositoryInspection({
        tenantId,

        customerId,

        opportunityId,

        presalesSourceId:
          source.id,

        repositoryUrl:
          source.repositoryUrl,

        requestedRef:
          source.requestedRef,

        /*
         * Authoritative values only.
         * Never sourced from LLM output.
         */
        resolvedRef:
          workspace.resolvedRef,

        resolvedCommit:
          workspace.resolvedCommit,

        detectedStack:
          analysis.detectedStack,

        architecture:
          analysis.architecture,

        modules:
          analysis.modules,

        integrations:
          analysis.integrations,

        dataLayer:
          analysis.dataLayer,

        authentication:
          analysis.authentication,

        deployment:
          analysis.deployment,

        testing:
          analysis.testing,

        relevantFiles:
          analysis.relevantFiles,

        findings,

        risks:
          analysis.risks,

        technicalDebt:
          analysis.technicalDebt,

        limitations:
          analysis.limitations,

        status:
          analysis.inspectionStatus,
      });


    repositoryInspections.push(
      inspection,
    );
  }


  const allFindings =
    repositoryInspections.flatMap(
      inspection =>
        inspection.findings,
    );


  const verifiedIssues =
    uniqueStrings(
      allFindings
        .filter(
          finding =>
            finding.confidence ===
              "VERIFIED",
        )
        .map(
          finding =>
            finding.statement,
        ),
    );


  const suspectedIssues =
    uniqueStrings(
      allFindings
        .filter(
          finding =>
            finding.confidence ===
              "INFERRED",
        )
        .map(
          finding =>
            finding.statement,
        ),
    );


  const detectedStack =
    uniqueStrings(
      repositoryInspections.flatMap(
        inspection =>
          inspection.detectedStack,
      ),
    );


  const customerProblemStatement =
    requests
      .map(
        request =>
          request.requestText.trim(),
      )
      .filter(
        Boolean,
      )
      .join(
        "\n\n",
      );


  const initialSolutionApproach =
    await createInitialSolutionApproach({
      tenantId,

      customerId,

      opportunityId,

      approachText:
        payload.approachText,

      probableScope:
        payload.probableScope,

      probableTechnologies:
        payload.probableTechnologies,

      assumptions:
        payload.assumptions,

      metadata: {
        engagementType:
          payload.engagementType,

        requiredCapabilities:
          payload.requiredCapabilities,

        optionalCapabilities:
          payload.optionalCapabilities,

        developmentRequired:
          payload.developmentRequired,

        repositoryMode:
          selectedSources.length >
            0
            ? "EXISTING"
            : "NONE",

        existingSystem:
          selectedSources.length >
            0,

        repositoryUrl:
          selectedSources.length ===
            1
            ? selectedSources[0]
                .repositoryUrl
            : undefined,

        customerProblemStatement,

        presalesSourceIds:
          selectedSources.map(
            source =>
              source.id,
          ),

        repositoryInspectionIds:
          repositoryInspections.map(
            inspection =>
              inspection.id,
          ),

        existingSystemAnalysis: {
          inspected:
            selectedSources.length >
              0,

          detectedStack,

          inspectedCommit:
            repositoryInspections.length ===
              1
              ? repositoryInspections[0]
                  .resolvedCommit
              : undefined,

          verifiedIssues,

          suspectedIssues,

          knownConstraints:
            payload.knownConstraints,
        },
      },
    });


  return {
    initialSolutionApproach,

    repositoryInspections,
  };
}
