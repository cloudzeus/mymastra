import { appDb } from "../db/postgres";
import { normalizeAiUsage } from "./usage-normalizer";

export type AiRunScope =
  | {
      scope: "TENANT";
      customerId?: never;
      opportunityId?: never;
      projectId?: never;
      proposalId?: never;
    }
  | {
      scope: "CUSTOMER";
      customerId: string;
      opportunityId?: never;
      projectId?: never;
      proposalId?: never;
    }
  | {
      scope: "OPPORTUNITY";
      customerId: string;
      opportunityId: string;
      projectId?: never;
      proposalId?: never;
    }
  | {
      scope: "PROJECT";
      customerId: string;
      opportunityId?: string;
      projectId: string;
      proposalId?: never;
    }
  | {
      scope: "PROPOSAL";
      customerId: string;
      opportunityId: string;
      projectId?: never;
      proposalId: string;
    };

export type StartAiRunInput = AiRunScope & {
  tenantId: string;
  workflowType: string;
  agentId: string;
  agentRole?: string;
  provider: string;
  model: string;
  providerRunId?: string;
  artifactId?: string;
  estimateId?: string;
  pricingId?: string;
};

export type FinishAiRunInput = {
  runId: string;
  usage: unknown;
  error?: unknown;
  providerRunId?: string;
};

function requireNonBlank(
  value: string,
  name: string,
): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${name} is required`);
  }

  return normalized;
}

export async function startAiRun(
  input: StartAiRunInput,
): Promise<string> {
  const tenantId = requireNonBlank(
    input.tenantId,
    "tenantId",
  );

  const workflowType = requireNonBlank(
    input.workflowType,
    "workflowType",
  );

  const agentId = requireNonBlank(
    input.agentId,
    "agentId",
  );

  const provider = requireNonBlank(
    input.provider,
    "provider",
  );

  const model = requireNonBlank(
    input.model,
    "model",
  );

  const result = await appDb.query<{
    id: string;
  }>(
    `
    INSERT INTO app.ai_runs (
      tenant_id,
      customer_id,
      opportunity_id,
      project_id,
      proposal_id,
      artifact_id,
      estimate_id,
      pricing_id,
      scope,
      workflow_type,
      agent_id,
      agent_role,
      provider,
      model,
      provider_run_id,
      status,
      started_at,
      updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, $13, $14, $15,
      'RUNNING', now(), now()
    )
    RETURNING id
    `,
    [
      tenantId,
      input.customerId ?? null,
      input.opportunityId ?? null,
      input.projectId ?? null,
      input.proposalId ?? null,
      input.artifactId ?? null,
      input.estimateId ?? null,
      input.pricingId ?? null,
      input.scope,
      workflowType,
      agentId,
      input.agentRole ?? null,
      provider,
      model,
      input.providerRunId ?? null,
    ],
  );

  const runId = result.rows[0]?.id;

  if (!runId) {
    throw new Error(
      "Failed to create ai run",
    );
  }

  return runId;
}

export async function finishAiRun(
  input: FinishAiRunInput,
): Promise<void> {
  const runId = requireNonBlank(
    input.runId,
    "runId",
  );

  const usage = normalizeAiUsage(
    input.usage,
  );

  const client = await appDb.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
      INSERT INTO app.ai_token_usage (
        run_id,
        input_tokens,
        output_tokens,
        cached_input_tokens,
        reasoning_tokens,
        total_tokens,
        provider_usage
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      ON CONFLICT (run_id)
      DO UPDATE SET
        input_tokens = EXCLUDED.input_tokens,
        output_tokens = EXCLUDED.output_tokens,
        cached_input_tokens = EXCLUDED.cached_input_tokens,
        reasoning_tokens = EXCLUDED.reasoning_tokens,
        total_tokens = EXCLUDED.total_tokens,
        provider_usage = EXCLUDED.provider_usage,
        recorded_at = now()
      `,
      [
        runId,
        usage.inputTokens,
        usage.outputTokens,
        usage.cachedInputTokens,
        usage.reasoningTokens,
        usage.totalTokens,
        JSON.stringify(
          usage.providerUsage,
        ),
      ],
    );

    if (
      usage.providerReportedCost !== undefined
    ) {
      await client.query(
        `
        INSERT INTO app.ai_cost_ledger (
          run_id,
          line_type,
          provider,
          service,
          unit,
          quantity,
          unit_price,
          cost,
          currency,
          metadata
        )
        SELECT
          id,
          'LLM_TOTAL',
          provider,
          model,
          'RUN',
          1::numeric,
          $2::numeric,
          $2::numeric,
          $3,
          $4::jsonb
        FROM app.ai_runs
        WHERE id = $1
        ON CONFLICT (run_id)
        WHERE line_type = 'LLM_TOTAL'
        DO UPDATE SET
          quantity = EXCLUDED.quantity,
          unit_price = EXCLUDED.unit_price,
          cost = EXCLUDED.cost,
          currency = EXCLUDED.currency,
          metadata = EXCLUDED.metadata,
          recorded_at = now()
        `,
        [
          runId,
          usage.providerReportedCost,
          usage.providerReportedCurrency ?? "USD",
          JSON.stringify({
            source: "provider_reported",
            providerUsage: usage.providerUsage,
          }),
        ],
      );
    }


    await client.query(
      `
      UPDATE app.ai_runs
      SET
        status = $2,
        provider_run_id = COALESCE($3, provider_run_id),
        completed_at = now(),
        updated_at = now()
      WHERE id = $1
      `,
      [
        runId,
        input.error ? "FAILED" : "COMPLETED",
        input.providerRunId ?? null,
      ],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");

    try {
      await client.query(
        `
        UPDATE app.ai_runs
        SET
          status = 'FAILED',
          provider_run_id = COALESCE($2, provider_run_id),
          completed_at = now(),
          updated_at = now()
        WHERE id = $1
          AND status = 'RUNNING'
        `,
        [
          runId,
          input.providerRunId ?? null,
        ],
      );
    } catch (recoveryError) {
      console.error(
        "AI accounting recovery failed",
        {
          runId,
          recoveryError,
        },
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

export type RecordExternalCostInput = {
  runId: string;
  lineType:
    | "WEB_SEARCH"
    | "WEB_EXTRACT"
    | "IMAGE_GENERATION"
    | "VIDEO_GENERATION"
    | "EMBEDDING"
    | "STORAGE"
    | "OTHER_API";
  provider?: string;
  service?: string;
  unit?: string;
  quantity: number;
  unitPrice?: number | null;
  currency?: string;
  sourceRef?: string;
  metadata?: Record<string, unknown>;
};

export async function recordExternalCost(
  input: RecordExternalCostInput,
): Promise<void> {
  const runId = requireNonBlank(
    input.runId,
    "runId",
  );

  if (
    !Number.isFinite(input.quantity) ||
    input.quantity < 0
  ) {
    throw new Error(
      "quantity must be a nonnegative finite number",
    );
  }

  const unitPrice =
    input.unitPrice ??
    null;

  const hasPrice =
    unitPrice !== null;

  if (
    hasPrice &&
    (
      !Number.isFinite(unitPrice) ||
      unitPrice < 0
    )
  ) {
    throw new Error(
      "unitPrice must be a nonnegative finite number",
    );
  }

  const cost =
    hasPrice
      ? input.quantity * unitPrice
      : null;

  await appDb.query(
    `
    INSERT INTO app.ai_cost_ledger (
      run_id,
      line_type,
      provider,
      service,
      unit,
      quantity,
      unit_price,
      cost,
      currency,
      source_ref,
      metadata
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6::numeric,
      $7::numeric,
      $8::numeric,
      $9,
      $10,
      $11::jsonb
    )
    `,
    [
      runId,
      input.lineType,
      input.provider ?? null,
      input.service ?? null,
      input.unit ?? null,
      input.quantity,
      unitPrice,
      cost,
      input.currency ?? "USD",
      input.sourceRef ?? null,
      JSON.stringify(
        input.metadata ?? {},
      ),
    ],
  );
}
