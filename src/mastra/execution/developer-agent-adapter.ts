import {
  randomUUID,
} from "node:crypto";

import {
  appDb,
} from "../db/postgres";

import {
  createDeveloperWorkOrder,
  getProjectDefinition,
  loadDeveloperExecutionContext,
} from "../projects/developer-contract-manager";

import {
  resolveDeveloperWorkOrder,
} from "../projects/developer-work-order-resolver";


import {
  deriveSoftOneAccessPolicy,
} from "../projects/softone-access-policy";

import type {
  DeveloperTaskType,
  DeveloperWorkOrder,
} from "../projects/developer-work-order-types";

import {
  getDeliveryAgent,
} from "./agent-registry";

import type {
  StageExecutionContext,
  StageExecutionHandler,
} from "./orchestrator-types";


const DEVELOPER_TASK_TYPES =
  new Set<DeveloperTaskType>([
    "APPLICATION_SCAFFOLD",
    "DATA_MODEL",
    "API_CONTRACT",
    "SOFTONE_INTEGRATION",
    "SYNC_WORKER",
    "BUSINESS_LOGIC",
    "UI",
    "TEST",
    "REFACTOR",
    "DOCUMENTATION",
  ]);


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

  return value as
    Record<string, unknown>;
}


function readString(
  object: Record<string, unknown>,
  key: string,
): string | undefined {
  const value =
    object[key];

  if (
    typeof value !== "string"
  ) {
    return undefined;
  }

  const normalized =
    value.trim();

  return normalized ||
    undefined;
}


function readStringArray(
  object: Record<string, unknown>,
  key: string,
): string[] {
  const value =
    object[key];

  if (
    !Array.isArray(value)
  ) {
    return [];
  }

  return value
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
    .filter(Boolean);
}


function readConfiguredScope(
  configuration:
    Record<string, unknown>,
): string[] {
  const raw =
    configuration[
      "allowedScopePaths"
    ];

  if (
    !Array.isArray(raw)
  ) {
    return [];
  }

  return raw
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
    .filter(Boolean);
}


function extractBalancedJsonObject(
  text: string,
): string | undefined {
  let start =
    -1;

  let depth =
    0;

  let inString =
    false;

  let escaped =
    false;


  for (
    let index = 0;
    index < text.length;
    index += 1
  ) {
    const character =
      text[index];


    if (
      start ===
        -1
    ) {
      if (
        character ===
          "{"
      ) {
        start =
          index;

        depth =
          1;

        inString =
          false;

        escaped =
          false;
      }

      continue;
    }


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
        character ===
          "\\"
      ) {
        escaped =
          true;

        continue;
      }


      if (
        character ===
          '"'
      ) {
        inString =
          false;
      }

      continue;
    }


    if (
      character ===
        '"'
    ) {
      inString =
        true;

      continue;
    }


    if (
      character ===
        "{"
    ) {
      depth +=
        1;

      continue;
    }


    if (
      character ===
        "}"
    ) {
      depth -=
        1;


      if (
        depth ===
          0
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


function parseJsonObject(
  text: string,
): Record<string, unknown> | undefined {
  const candidate =
    text.trim();


  if (
    !candidate
  ) {
    return undefined;
  }


  /*
   * 1. Exact JSON object.
   */
  try {
    const parsed =
      JSON.parse(
        candidate,
      );

    if (
      typeof parsed ===
        "object" &&
      parsed !==
        null &&
      !Array.isArray(
        parsed,
      )
    ) {
      return parsed as
        Record<string, unknown>;
    }
  }
  catch {
    // Continue with tolerant parsing.
  }


  /*
   * 2. Markdown fenced JSON.
   */
  const fencedMatch =
    candidate.match(
      /```(?:json)?\s*([\s\S]*?)```/i,
    );


  if (
    fencedMatch?.[1]
  ) {
    try {
      const parsed =
        JSON.parse(
          fencedMatch[1].trim(),
        );

      if (
        typeof parsed ===
          "object" &&
        parsed !==
          null &&
        !Array.isArray(
          parsed,
        )
      ) {
        return parsed as
          Record<string, unknown>;
      }
    }
    catch {
      // Continue with balanced-object parsing.
    }
  }


  /*
   * 3. First balanced JSON object embedded in prose.
   */
  const balanced =
    extractBalancedJsonObject(
      candidate,
    );


  if (
    balanced
  ) {
    try {
      const parsed =
        JSON.parse(
          balanced,
        );

      if (
        typeof parsed ===
          "object" &&
        parsed !==
          null &&
        !Array.isArray(
          parsed,
        )
      ) {
        return parsed as
          Record<string, unknown>;
      }
    }
    catch {
      // Fall through.
    }
  }


  return undefined;
}


function readResponseText(
  response: unknown,
): string | undefined {
  if (
    typeof response !==
      "object" ||
    response ===
      null
  ) {
    return undefined;
  }


  const value =
    (
      response as
        Record<string, unknown>
    )["text"];


  return typeof value ===
    "string"
    ? value
    : undefined;
}


function extractStructuredObject(
  response: unknown,
): Record<string, unknown> {
  if (
    typeof response ===
      "object" &&
    response !==
      null
  ) {
    const responseObject =
      response as
        Record<string, unknown>;


    const structured =
      responseObject[
        "object"
      ];


    if (
      typeof structured ===
        "object" &&
      structured !==
        null &&
      !Array.isArray(
        structured,
      )
    ) {
      return structured as
        Record<string, unknown>;
    }


    const responseText =
      readResponseText(
        response,
      );


    if (
      responseText
    ) {
      const parsed =
        parseJsonObject(
          responseText,
        );


      if (
        parsed
      ) {
        return parsed;
      }


      const preview =
        responseText
          .replace(
            /\s+/g,
            " ",
          )
          .trim()
          .slice(
            0,
            240,
          );


      throw new Error(
        `Developer agent returned non-JSON text: ${preview}`,
      );
    }
  }


  throw new Error(
    "Developer agent returned no structured JSON object",
  );
}

function parseTaskType(
  value: unknown,
): DeveloperTaskType {
  if (
    typeof value !== "string"
  ) {
    throw new Error(
      "Developer agent response requires taskType",
    );
  }


  const normalized =
    value.trim() as
      DeveloperTaskType;


  if (
    !DEVELOPER_TASK_TYPES.has(
      normalized,
    )
  ) {
    throw new Error(
      `Unsupported Developer taskType=${value}`,
    );
  }


  return normalized;
}


async function loadUpstreamArtifactContents(
  context:
    StageExecutionContext,
): Promise<
  Record<string, unknown>[]
> {
  const ids =
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


  if (
    ids.length === 0
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
      unresolved: unknown;
      blockers: unknown;
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
          unresolved,
          blockers,
          payload

        FROM app.specialist_artifacts

        WHERE id = ANY(
          $1::uuid[]
        )
      `,
      [
        ids,
      ],
    );


  const byId =
    new Map(
      result.rows.map(
        row => [
          row.id,
          row,
        ],
      ),
    );


  /*
   * Preserve DAG upstream-output order.
   */
  return ids.map(
    id => {
      const row =
        byId.get(
          id,
        );

      if (!row) {
        throw new Error(
          `Upstream specialist artifact not found: ${id}`,
        );
      }


      return {
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

        unresolved:
          row.unresolved,

        blockers:
          row.blockers,

        payload:
          row.payload,
      };
    },
  );
}


export const developerAgentHandler:
  StageExecutionHandler =
  async (
    context:
      StageExecutionContext,
  ) => {
    if (
      context.stage.executionKind !==
        "DEVELOPER_WORK_ORDER"
    ) {
      throw new Error(
        `Developer adapter cannot execute stage kind=${context.stage.executionKind}`,
      );
    }


    if (
      context.stage.agentRole !==
        "DEVELOPER"
    ) {
      throw new Error(
        `Developer adapter role mismatch: ${context.stage.agentRole}`,
      );
    }


    /*
     * The execution plan owns filesystem
     * authorization.
     *
     * The LLM is never allowed to choose or
     * broaden its own filesystem scope.
     */
    const configuration =
      asObject(
        context.stage.configuration,
      );


    const allowedScopePaths =
      readConfiguredScope(
        configuration,
      );


    if (
      allowedScopePaths.length ===
        0
    ) {
      throw new Error(
        [
          "Developer execution BLOCKED:",
          `stage=${context.stage.stageKey}`,
          "has no configuration.allowedScopePaths.",
          "Filesystem scope must be explicitly authorized by the execution plan.",
        ].join(" "),
      );
    }


    const persistedDefinition =
      await getProjectDefinition(
        context.projectDefinitionId,
      );


    if (
      persistedDefinition.projectId !==
        context.projectId
    ) {
      throw new Error(
        "Developer adapter ProjectDefinition project mismatch",
      );
    }


    if (
      persistedDefinition.version !==
        context.projectDefinitionVersion
    ) {
      throw new Error(
        "Developer adapter ProjectDefinition version mismatch",
      );
    }


    if (
      persistedDefinition.status !==
        "READY"
    ) {
      throw new Error(
        `Developer execution BLOCKED: ProjectDefinition status=${persistedDefinition.status}`,
      );
    }


    const definition =
      persistedDefinition.definition;


    const upstreamArtifacts =
      await loadUpstreamArtifactContents(
        context,
      );


    const agent =
      getDeliveryAgent(
        "DEVELOPER",
      );


    const executionBrief = {
      executionPlanId:
        context.executionPlanId,

      projectId:
        context.projectId,

      projectDefinitionRecordId:
        persistedDefinition.recordId,

      projectDefinitionId:
        definition.id,

      projectDefinitionVersion:
        definition.version,

      stage: {
        id:
          context.stage.id,

        stageKey:
          context.stage.stageKey,

        configuration:
          context.stage.configuration,
      },

      authorizedFilesystemScope:
        allowedScopePaths,

      projectDefinition:
        definition,

      upstreamArtifacts,

      requiredOutput: {
        taskType:
          Array.from(
            DEVELOPER_TASK_TYPES,
          ),

        objective:
          "non-empty string",

        acceptanceCriteria:
          "non-empty string array",
      },

      securityPolicy: {
        workspaceResolvedByProjectId:
          true,

        arbitraryWorkspacePathAllowed:
          false,

        shellExecutionAllowed:
          false,

        softOneAccessPolicy:
          deriveSoftOneAccessPolicy(
            definition,
          ),

        gitCommitAllowed:
          false,

        gitPushAllowed:
          false,

        networkAccessAllowed:
          false,
      },
    };


    const response =
      await agent.generate(
        [
          {
            role:
              "user",

            content: [
              "Prepare the DeveloperWorkOrder proposal for this execution stage.",
            "",
            "Return ONLY a JSON object with these properties:",
            '{ "taskType": "...", "objective": "...", "acceptanceCriteria": ["..."] }',
            "",
            "Do not return filesystem paths.",
            "Do not change or propose security permissions.",
            "Do not execute code.",
            "Do not execute shell commands.",
            "Do not write files.",
            "Do not access networks or ERP systems.",
            "Do not ask the user, operator, administrator, or another agent to execute shell commands, write files, or perform another prohibited operation on your behalf.",
            "Do not use human execution as a workaround for missing tool authority.",
            "Manual human actions are allowed only when the persisted contract explicitly defines an ADMIN_MANUAL_ONLY step.",
            "",
            "The application owns filesystem scope and execution policy.",
            "",
              JSON.stringify(
                executionBrief,
                null,
                2,
              ),
            ].join(
              "\n",
            ),
          },
        ],
        {
          /*
           * Work-order proposal generation is planning only.
           * The Developer agent must have zero tool authority here.
           */
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


    let proposal:
      Record<string, unknown>;


    try {
      proposal =
        extractStructuredObject(
          response,
        );
    }
    catch (
      initialParseError
    ) {
      const originalText =
        readResponseText(
          response,
        );


      if (
        !originalText?.trim()
      ) {
        throw initialParseError;
      }


      console.warn(
        [
          "Developer proposal serialization failed.",
          `stage=${context.stage.stageKey}`,
          "Running one serialization-only pass with tools disabled.",
        ].join(
          " ",
        ),
      );


      const serializationResponse =
        await agent.generate(
          [
            {
              role:
                "user",

              content: [
                "Convert the following DeveloperWorkOrder proposal into valid JSON.",
                "",
                "Return ONLY one JSON object.",
                "Do not add markdown fences.",
                "Do not add commentary.",
                "Do not change the meaning.",
                "",
                "The JSON object must contain exactly these logical fields:",
                '{ "taskType": "...", "objective": "...", "acceptanceCriteria": ["..."] }',
                "",
                "Do not execute tools.",
                "Do not execute code.",
                "Do not execute shell commands.",
                "Do not write files.",
                "Do not access networks or ERP systems.",
                "Do not ask a human or another agent to perform a prohibited operation.",
                "",
                "ORIGINAL RESPONSE:",
                originalText,
              ].join(
                "\n",
              ),
            },
          ],
          {
            /*
             * Serialization retry is formatting only.
             * It has zero runtime execution authority.
             */
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


      proposal =
        extractStructuredObject(
          serializationResponse,
        );
    }


    const taskType =
      parseTaskType(
        proposal[
          "taskType"
        ],
      );


    const objective =
      readString(
        proposal,
        "objective",
      );


    if (!objective) {
      throw new Error(
        "Developer agent response requires objective",
      );
    }


    const acceptanceCriteria =
      readStringArray(
        proposal,
        "acceptanceCriteria",
      );


    if (
      acceptanceCriteria.length ===
        0
    ) {
      throw new Error(
        "Developer agent response requires at least one acceptance criterion",
      );
    }


    const now =
      new Date()
        .toISOString();


    const workOrder:
      DeveloperWorkOrder = {
      id:
        randomUUID(),

      projectId:
        context.projectId,

      /*
       * IMPORTANT:
       *
       * This is ProjectDefinitionPackage.id,
       * NOT app.project_definitions.id.
       */
      projectDefinitionId:
        definition.id,

      projectDefinitionVersion:
        definition.version,

      /*
       * Stable relation to the execution DAG.
       */
      taskId:
        context.stage.id,

      taskType,

      objective,

      allowedScope: {
        paths:
          allowedScopePaths,

        allowCreate:
          true,

        allowModify:
          true,

        /*
         * Delete remains application-denied
         * for production agent execution.
         */
        allowDelete:
          false,
      },

      /*
       * SpecialistArtifact outputs are supplied
       * as execution context, but this field
       * references artifacts contained inside
       * ProjectDefinitionPackage.
       *
       * Therefore we do NOT put specialist
       * artifact UUIDs here.
       */
      requiredArtifacts:
        [],

      acceptanceCriteria,

      executionPolicy: {
        workspaceResolvedByProjectId:
          true,

        arbitraryWorkspacePathAllowed:
          false,

        shellExecutionAllowed:
          false,

        softOneAccessPolicy:
          deriveSoftOneAccessPolicy(
            definition,
          ),

        gitCommitAllowed:
          false,

        gitPushAllowed:
          false,

        networkAccessAllowed:
          false,
      },

      status:
        "READY",

      blockers:
        [],

      createdAt:
        now,

      updatedAt:
        now,
    };


    /*
     * Validate BOTH the contract and the
     * canonical filesystem workspace BEFORE
     * inserting the work order.
     *
     * This prevents creating an orphan READY
     * work order for an invalid workspace.
     */
    await resolveDeveloperWorkOrder(
      workOrder,
      definition,
    );


    const persisted =
      await createDeveloperWorkOrder({
        projectDefinitionRecordId:
          persistedDefinition.recordId,

        workOrder,
      });


    /*
     * Re-read through the canonical contract
     * manager after persistence.
     *
     * This proves DB binding, READY status and
     * persisted ProjectDefinition relationship.
     */
    const executionContext =
      await loadDeveloperExecutionContext(
        persisted.recordId,
      );


    if (
      executionContext.workOrderRecordId !==
        persisted.recordId
    ) {
      throw new Error(
        "Persisted DeveloperWorkOrder execution-context invariant failed",
      );
    }


    if (
      executionContext.projectDefinitionRecordId !==
        persistedDefinition.recordId
    ) {
      throw new Error(
        "Persisted DeveloperWorkOrder ProjectDefinition binding invariant failed",
      );
    }


    return {
      kind:
        "DEVELOPER_WORK_ORDER",

      developerWorkOrderId:
        persisted.recordId,
    };
  };
