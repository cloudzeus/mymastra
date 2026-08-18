import {
  finishAiRun,
  startAiRun,
  type AiRunScope,
} from "./ai-run-recorder";

type RequestContextLike = {
  get<R = unknown>(key: string): R;
  set(key: string, value: unknown): void;
};

export type AgentAccountingConfig = {
  agentId: string;
  agentRole?: string;
  workflowType: string;
  provider: string;
  model: string;
};

function getContextString(
  requestContext: RequestContextLike | undefined,
  key: string,
): string | undefined {
  if (!requestContext) {
    return undefined;
  }

  const value =
    requestContext.get<unknown>(key);

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();

  return normalized || undefined;
}

function resolveRunScope(
  requestContext: RequestContextLike | undefined,
): AiRunScope {
  const customerId = getContextString(
    requestContext,
    "customerId",
  );
  const opportunityId = getContextString(
    requestContext,
    "opportunityId",
  );
  const projectId = getContextString(
    requestContext,
    "projectId",
  );
  const proposalId = getContextString(
    requestContext,
    "proposalId",
  );

  if (proposalId) {
    if (
      !customerId ||
      !opportunityId ||
      projectId
    ) {
      throw new Error(
        "Invalid PROPOSAL accounting ownership context",
      );
    }

    return {
      scope: "PROPOSAL",
      customerId,
      opportunityId,
      proposalId,
    };
  }

  if (projectId) {
    if (!customerId) {
      throw new Error(
        "PROJECT accounting context requires customerId",
      );
    }

    return {
      scope: "PROJECT",
      customerId,
      projectId,
      ...(opportunityId
        ? { opportunityId }
        : {}),
    };
  }

  if (opportunityId) {
    if (!customerId) {
      throw new Error(
        "OPPORTUNITY accounting context requires customerId",
      );
    }

    return {
      scope: "OPPORTUNITY",
      customerId,
      opportunityId,
    };
  }

  if (customerId) {
    return {
      scope: "CUSTOMER",
      customerId,
    };
  }

  return {
    scope: "TENANT",
  };
}

export function createAgentAccountingDefaults(
  config: AgentAccountingConfig,
) {
  return async ({
    requestContext,
  }: {
    requestContext?: RequestContextLike;
  }) => {
    const tenantId = getContextString(
      requestContext,
      "tenantId",
    );

    if (!tenantId) {
      return {};
    }

    const ownership =
      resolveRunScope(requestContext);

    const runId = await startAiRun({
      tenantId,
      ...ownership,
      workflowType: config.workflowType,
      agentId: config.agentId,
      agentRole: config.agentRole,
      provider: config.provider,
      model: config.model,
    });

    requestContext?.set(
      "__dgsmart.aiAccounting.runId",
      runId,
    );

    return {
      onFinish: async (event: {
        totalUsage: unknown;
        error?: unknown;
        steps: Array<{
          response?: {
            id?: string;
          };
        }>;
      }) => {
        const providerRunId =
          event.steps.at(-1)?.response?.id;

        await finishAiRun({
          runId,
          usage: event.totalUsage,
          error: event.error,
          providerRunId,
        });
      },
    };
  };
}
