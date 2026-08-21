import {
  randomUUID,
} from "node:crypto";

import {
  z,
} from "zod";

import {
  RequestContext,
} from "@mastra/core/request-context";

import {
  appDb,
} from "../db/postgres";

import {
  loadDeveloperExecutionContext,
} from "../projects/developer-contract-manager";

import {
  createSpecialistArtifact,
} from "../specialists";

import type {
  SpecialistArtifactEnvelope,
  SpecialistArtifactType,
  SpecialistRole,
} from "../specialists/types";

import type {
  StageExecutionContext,
  StageExecutionHandler,
} from "./orchestrator-types";

import {
  getDeliveryAgent,
} from "./agent-registry";


const SpecialistPayloadSchema =
  z.record(
    z.string(),
    z.unknown(),
  );


function asObject(
  value: unknown,
): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return {};
  }

  return value as Record<string, unknown>;
}


async function loadProjectDefinition(
  projectDefinitionId: string,
  projectId: string,
  version: number,
): Promise<Record<string, unknown>> {
  const result =
    await appDb.query<{
      definition: unknown;
    }>(
      `
        SELECT definition
        FROM app.project_definitions
        WHERE id = $1
          AND project_id = $2
          AND version = $3
        LIMIT 1
      `,
      [
        projectDefinitionId,
        projectId,
        version,
      ],
    );

  const row =
    result.rows[0];

  if (!row) {
    throw new Error(
      "ProjectDefinition not found for specialist adapter",
    );
  }

  return asObject(
    row.definition,
  );
}


async function loadUpstreamArtifacts(
  artifactIds: string[],
): Promise<
  Record<string, unknown>[]
> {
  if (
    artifactIds.length === 0
  ) {
    return [];
  }

  const result =
    await appDb.query<{
      id: string;
      role: string;
      artifact_type: string;
      version: number;
      title: string;
      objective: string;
      findings: unknown;
      recommendations: unknown;
      payload: unknown;
    }>(
      `
        SELECT
          id::text,
          role,
          artifact_type,
          version,
          title,
          objective,
          findings,
          recommendations,
          payload
        FROM app.specialist_artifacts
        WHERE id = ANY(
          $1::uuid[]
        )
      `,
      [
        artifactIds,
      ],
    );

  return result.rows.map(
    row => ({
      id:
        row.id,

      role:
        row.role,

      artifactType:
        row.artifact_type,

      version:
        row.version,

      title:
        row.title,

      objective:
        row.objective,

      findings:
        row.findings,

      recommendations:
        row.recommendations,

      payload:
        row.payload,
    }),
  );
}


async function resolveTenantCode(
  tenantId: string,
): Promise<string> {
  const result =
    await appDb.query<{
      code: string | null;
    }>(
      `
        SELECT
          to_jsonb(t)->>'code'
            AS code
        FROM app.tenants t
        WHERE t.id = $1
        LIMIT 1
      `,
      [
        tenantId,
      ],
    );

  const code =
    result.rows[0]
      ?.code
      ?.trim();

  if (!code) {
    throw new Error(
      `Tenant code could not be resolved for tenant=${tenantId}`,
    );
  }

  return code;
}


async function resolveProjectOwnership(
  tenantId: string,
  projectId: string,
): Promise<{
  customerId: string;
  opportunityId: string;
}> {
  const result =
    await appDb.query<{
      customer_id: string;
      opportunity_id: string;
    }>(
      `
        SELECT
          o.customer_id::text,
          o.id::text AS opportunity_id
        FROM app.opportunities o
        WHERE o.tenant_id = $1
          AND o.converted_project_id = $2
        ORDER BY o.updated_at DESC
        LIMIT 1
      `,
      [
        tenantId,
        projectId,
      ],
    );

  const row =
    result.rows[0];

  if (!row) {
    throw new Error(
      "Could not resolve originating opportunity/customer for project",
    );
  }

  return {
    customerId:
      row.customer_id,

    opportunityId:
      row.opportunity_id,
  };
}


function extractFirstJsonObject(
  text: string,
): string | undefined {
  let depth =
    0;

  let start =
    -1;

  let inString =
    false;

  let escaped =
    false;


  for (
    let index = 0;
    index < text.length;
    index += 1
  ) {
    const char =
      text[index];


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
          index;
      }

      depth +=
        1;

      continue;
    }


    if (
      char === "}"
    ) {
      if (
        depth === 0
      ) {
        continue;
      }

      depth -=
        1;


      if (
        depth === 0 &&
        start >= 0
      ) {
        return text.slice(
          start,
          index + 1,
        );
      }
    }
  }


  return undefined;
}


function extractSpecialistPayload(
  response: unknown,
): Record<string, unknown> {
  if (
    typeof response === "object" &&
    response !== null &&
    "object" in response
  ) {
    const candidate =
      (
        response as {
          object?: unknown;
        }
      ).object;


    if (
      typeof candidate === "object" &&
      candidate !== null &&
      !Array.isArray(candidate)
    ) {
      return candidate as
        Record<string, unknown>;
    }
  }


  if (
    typeof response === "object" &&
    response !== null &&
    "text" in response
  ) {
    const rawText =
      (
        response as {
          text?: unknown;
        }
      ).text;


    if (
      typeof rawText === "string"
    ) {
      const trimmed =
        rawText.trim();


      /*
       * 1. Exact JSON object.
       */
      try {
        const parsed =
          JSON.parse(
            trimmed,
          );


        if (
          typeof parsed === "object" &&
          parsed !== null &&
          !Array.isArray(parsed)
        ) {
          return parsed as
            Record<string, unknown>;
        }
      }
      catch {
        /*
         * Continue with tolerant extraction.
         */
      }


      /*
       * 2. Markdown fenced JSON.
       */
      const unfenced =
        trimmed
          .replace(
            /^```(?:json)?\s*/i,
            "",
          )
          .replace(
            /\s*```$/,
            "",
          )
          .trim();


      if (
        unfenced !== trimmed
      ) {
        try {
          const parsed =
            JSON.parse(
              unfenced,
            );


          if (
            typeof parsed === "object" &&
            parsed !== null &&
            !Array.isArray(parsed)
          ) {
            return parsed as
              Record<string, unknown>;
          }
        }
        catch {
          /*
           * Continue with object extraction.
           */
        }
      }


      /*
       * 3. JSON object embedded in explanatory text.
       *
       * We still accept only one syntactically valid
       * object and never arbitrary prose.
       */
      const jsonObject =
        extractFirstJsonObject(
          trimmed,
        );


      if (
        jsonObject
      ) {
        try {
          const parsed =
            JSON.parse(
              jsonObject,
            );


          if (
            typeof parsed === "object" &&
            parsed !== null &&
            !Array.isArray(parsed)
          ) {
            return parsed as
              Record<string, unknown>;
          }
        }
        catch {
          /*
           * Fall through to explicit error below.
           */
        }
      }


      throw new Error(
        [
          "Specialist agent returned text but no valid JSON object.",
          `Preview=${trimmed.slice(0, 500)}`,
        ].join(" "),
      );
    }
  }


  throw new Error(
    "Specialist agent returned no structured object",
  );
}



export function createSpecialistAgentHandler(
  role: SpecialistRole,
  artifactType:
    SpecialistArtifactType,
): StageExecutionHandler {
  return async (
    context:
      StageExecutionContext,
  ) => {
    if (
      context.stage.executionKind !==
        "SPECIALIST_ARTIFACT"
    ) {
      throw new Error(
        `Specialist adapter cannot execute stage kind=${context.stage.executionKind}`,
      );
    }

    if (
      context.stage.agentRole !==
        role
    ) {
      throw new Error(
        `Specialist adapter role mismatch: expected=${role} received=${context.stage.agentRole}`,
      );
    }

    if (
      context.stage.expectedArtifactType !==
        artifactType
    ) {
      throw new Error(
        `Specialist adapter artifact type mismatch: expected=${artifactType} received=${context.stage.expectedArtifactType}`,
      );
    }


    const agent =
      getDeliveryAgent(
        context.stage.agentRole,
      );


    const projectDefinition =
      await loadProjectDefinition(
        context.projectDefinitionId,
        context.projectId,
        context.projectDefinitionVersion,
      );


    const upstreamArtifactIds =
      context.upstreamOutputs
        .filter(
          output =>
            output.outputKind ===
              "SPECIALIST_ARTIFACT",
        )
        .map(
          output =>
            output.outputKind ===
              "SPECIALIST_ARTIFACT"
              ? output.specialistArtifactId
              : "",
        )
        .filter(Boolean);


    const upstreamArtifacts =
      await loadUpstreamArtifacts(
        upstreamArtifactIds,
      );


    /*
     * Specialist stages normally consume SpecialistArtifacts.
     *
     * QUALITY_ASSURANCE is the deliberate exception:
     * it also consumes exactly one persisted DeveloperWorkOrder
     * from an upstream DEVELOPER stage.
     *
     * The work-order id comes from the execution DAG output,
     * never from model input or stage configuration.
     */
    const upstreamDeveloperWorkOrderIds =
      context.upstreamOutputs
        .filter(
          output =>
            output.outputKind ===
              "DEVELOPER_WORK_ORDER",
        )
        .map(
          output =>
            output.outputKind ===
              "DEVELOPER_WORK_ORDER"
              ? output.developerWorkOrderId
              : "",
        )
        .filter(Boolean);


    let qaContext:
      Record<string, unknown> |
      undefined;


    if (
      role ===
        "QUALITY_ASSURANCE"
    ) {
      if (
        upstreamDeveloperWorkOrderIds.length !==
          1
      ) {
        throw new Error(
          [
            "QUALITY_ASSURANCE execution BLOCKED:",
            "exactly one upstream DeveloperWorkOrder is required.",
            `received=${upstreamDeveloperWorkOrderIds.length}`,
            `stage=${context.stage.stageKey}`,
          ].join(
            " ",
          ),
        );
      }


      const developerExecutionContext =
        await loadDeveloperExecutionContext(
          upstreamDeveloperWorkOrderIds[0],
        );


      if (
        developerExecutionContext
          .workOrder
          .projectId !==
        context.projectId
      ) {
        throw new Error(
          "QUALITY_ASSURANCE upstream DeveloperWorkOrder project mismatch",
        );
      }


      /*
       * context.projectDefinitionId is the persisted
       * app.project_definitions record id.
       *
       * workOrder.projectDefinitionId is the logical id inside
       * ProjectDefinitionPackage. They are intentionally different
       * identifiers and must never be compared directly.
       */
      if (
        developerExecutionContext
          .projectDefinitionRecordId !==
        context.projectDefinitionId
      ) {
        throw new Error(
          "QUALITY_ASSURANCE upstream DeveloperWorkOrder persisted ProjectDefinition mismatch",
        );
      }


      if (
        developerExecutionContext
          .workOrder
          .projectDefinitionVersion !==
        context.projectDefinitionVersion
      ) {
        throw new Error(
          "QUALITY_ASSURANCE upstream DeveloperWorkOrder ProjectDefinition version mismatch",
        );
      }


      const artifactContract =
        developerExecutionContext
          .workOrder
          .artifactContract;


      qaContext = {
        /*
         * This record id is what qa-read-file / qa-write-file
         * must use. It originates from persisted DAG output.
         */
        developerWorkOrderId:
          developerExecutionContext
            .workOrderRecordId,

        developerTaskId:
          developerExecutionContext
            .workOrder
            .taskId,

        developerTaskType:
          developerExecutionContext
            .workOrder
            .taskType,

        collectionName:
          artifactContract
            .collectionName,

        artifactRoot:
          artifactContract
            .artifactRoot,

        artifactContract,

        acceptanceCriteria:
          developerExecutionContext
            .workOrder
            .acceptanceCriteria,

        developerWorkOrderStatus:
          developerExecutionContext
            .workOrder
            .status,
      };
    }


    const executionBrief = {
      executionPlanId:
        context.executionPlanId,

      projectId:
        context.projectId,

      projectDefinitionId:
        context.projectDefinitionId,

      projectDefinitionVersion:
        context.projectDefinitionVersion,

      stage: {
        id:
          context.stage.id,

        stageKey:
          context.stage.stageKey,

        agentRole:
          context.stage.agentRole,

        expectedArtifactType:
          context.stage.expectedArtifactType,

        configuration:
          context.stage.configuration,
      },

      projectDefinition,

      upstreamArtifacts,

      /*
       * Present only for QUALITY_ASSURANCE.
       *
       * This is server-resolved authority and must not be
       * reconstructed or overridden by the model.
       */
      ...(qaContext
        ? {
            qaContext,
          }
        : {}),
    };


    const stageConfiguration =
      asObject(
        context.stage.configuration,
      );


    const allowTools =
      stageConfiguration[
        "allowTools"
      ] !== false;


    const configuredTimeout =
      stageConfiguration[
        "timeoutMs"
      ];


    const timeoutMs =
      typeof configuredTimeout === "number" &&
      Number.isFinite(
        configuredTimeout,
      ) &&
      configuredTimeout >= 1000
        ? Math.floor(
            configuredTimeout,
          )
        : 120000;


    const ownership =
      await resolveProjectOwnership(
        context.tenantId,
        context.projectId,
      );


    const requestContext =
      new RequestContext();


    requestContext.set(
      "tenantId",
      context.tenantId,
    );


    requestContext.set(
      "customerId",
      ownership.customerId,
    );


    requestContext.set(
      "opportunityId",
      ownership.opportunityId,
    );


    requestContext.set(
      "projectId",
      context.projectId,
    );


    requestContext.set(
      "executionPlanId",
      context.executionPlanId,
    );


    const messages = [
      {
        role:
          "user" as const,

        content:
          [
            "Execute the assigned delivery stage.",
            "",
            "Return a JSON object suitable for the specialist artifact payload.",
            "Do not create database records directly.",
            "Do not invent project identifiers.",
            "",
            JSON.stringify(
              executionBrief,
              null,
              2,
            ),
          ].join("\n"),
      },
    ];


    let response:
      Awaited<
        ReturnType<
          typeof agent.generate
        >
      > | undefined;


    /*
     * OpenRouter Auto Router may occasionally
     * select an endpoint that returns no visible
     * content.
     *
     * Retry once through Auto Router rather than
     * pinning or selecting another model ourselves.
     */
    for (
      let attempt = 1;
      attempt <= 2;
      attempt += 1
    ) {
      response =
        await agent.generate(
          messages,
          {
            requestContext,

            toolChoice:
              allowTools
                ? "auto"
                : "none",

            maxSteps:
              allowTools
                ? 8
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


      const structuredObject =
        (
          response as {
            object?: unknown;
          }
        ).object;


      const visibleText =
        (
          response as {
            text?: unknown;
          }
        ).text;


      const hasStructuredObject =
        typeof structuredObject ===
          "object" &&
        structuredObject !== null &&
        !Array.isArray(
          structuredObject,
        );


      const hasVisibleText =
        typeof visibleText ===
          "string" &&
        visibleText.trim().length >
          0;


      if (
        hasStructuredObject ||
        hasVisibleText
      ) {
        break;
      }


      if (
        attempt === 1
      ) {
        console.warn(
          [
            "Specialist agent returned no content.",
            `stage=${context.stage.stageKey}`,
            "Retrying once through OpenRouter Auto Router.",
          ].join(" "),
        );
      }
    }


    if (!response) {
      throw new Error(
        "Specialist agent produced no response",
      );
    }


    let payload:
      Record<string, unknown>;


    try {
      payload =
        extractSpecialistPayload(
          response,
        );
    }
    catch (error) {
      const rawText =
        (
          response as {
            text?: unknown;
          }
        ).text;


      if (
        typeof rawText !== "string" ||
        !rawText.trim()
      ) {
        throw error;
      }


      console.warn(
        [
          "Specialist output was not valid JSON.",
          `stage=${context.stage.stageKey}`,
          "Running one serialization-only pass with tools disabled.",
        ].join(" "),
      );


      const serializationResponse =
        await agent.generate(
          [
            {
              role:
                "user",

              content:
                [
                  "Convert the completed specialist analysis below into ONE valid JSON object.",
                  "",
                  "Do not perform new research.",
                  "Do not call tools.",
                  "Do not add Markdown.",
                  "Do not add code fences.",
                  "Do not add prose before or after the JSON.",
                  "Preserve the factual content, source URLs, findings, recommendations, limitations and unresolved items from the analysis.",
                  "Return JSON only.",
                  "",
                  "COMPLETED ANALYSIS:",
                  rawText,
                ].join("\n"),
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
                Math.min(
                  timeoutMs,
                  60000,
                ),
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


      payload =
        extractSpecialistPayload(
          serializationResponse,
        );
    }


    const tenantCode =
      await resolveTenantCode(
        context.tenantId,
      );


    const versionResult =
      await appDb.query<{
        next_version: number;
      }>(
        `
          SELECT
            COALESCE(
              MAX(version),
              0
            ) + 1
              AS next_version
          FROM app.specialist_artifacts
          WHERE project_id = $1
            AND artifact_type = $2
        `,
        [
          context.projectId,
          artifactType,
        ],
      );


    const version =
      Number(
        versionResult.rows[0]
          .next_version,
      );


    const now =
      new Date().toISOString();


    const artifact:
      SpecialistArtifactEnvelope<Record<string, unknown>> = {
      id:
        randomUUID(),

      version,

      tenantId:
        context.tenantId,

      tenantCode,

      scope:
        "PROJECT",

      customerId:
        ownership.customerId,

      opportunityId:
        ownership.opportunityId,

      projectId:
        context.projectId,

      role,

      artifactType,

      status:
        "READY",

      title:
        `${context.stage.stageKey} output`,

      objective:
        `Execute project stage ${context.stage.stageKey}`,

      sourceArtifactIds:
        upstreamArtifactIds,

      findings:
        [],

      recommendations:
        [],

      unresolved:
        [],

      blockers:
        [],

      provenance:
        [],

      payload,

      createdAt:
        now,

      updatedAt:
        now,
    };


    const persisted =
      await createSpecialistArtifact({
        artifact,

        projectDefinitionBinding: {
          recordId:
            context.projectDefinitionId,

          version:
            context.projectDefinitionVersion,
        },
      });


    return {
      kind:
        "SPECIALIST_ARTIFACT",

      specialistArtifactId:
        persisted.artifact.id,
    };
  };
}
