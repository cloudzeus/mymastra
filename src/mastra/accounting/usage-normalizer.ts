export type NormalizedAiUsage = {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  cacheCreationInputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  providerUsage: Record<string, unknown>;
  providerReportedCost?: number;
  providerReportedCurrency?: string;
};

function toNonNegativeInteger(
  value: unknown,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    return 0;
  }

  return Math.trunc(value);
}

function toNonNegativeNumber(
  value: unknown,
): number | undefined {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    return undefined;
  }

  return value;
}

function asRecord(
  value: unknown,
): Record<string, unknown> {
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  ) {
    return value as Record<string, unknown>;
  }

  return {};
}

export function normalizeAiUsage(
  usage: unknown,
): NormalizedAiUsage {
  const record =
    asRecord(usage);

  const raw =
    asRecord(record.raw);

  const nestedRaw =
    asRecord(raw.raw);

  const providerReportedCost =
    toNonNegativeNumber(
      nestedRaw.cost ??
        raw.cost ??
        record.cost,
    );

  return {
    inputTokens:
      toNonNegativeInteger(
        record.inputTokens,
      ),

    outputTokens:
      toNonNegativeInteger(
        record.outputTokens,
      ),

    cachedInputTokens:
      toNonNegativeInteger(
        record.cachedInputTokens,
      ),

    cacheCreationInputTokens:
      toNonNegativeInteger(
        record.cacheCreationInputTokens,
      ),

    reasoningTokens:
      toNonNegativeInteger(
        record.reasoningTokens,
      ),

    totalTokens:
      toNonNegativeInteger(
        record.totalTokens,
      ),

    providerUsage:
      record,

    providerReportedCost,

    providerReportedCurrency:
      providerReportedCost === undefined
        ? undefined
        : "USD",
  };
}
