export const RESEARCH_EXECUTION_LIMITS = {
  webSearchCalls: 4,
  advancedSearchCalls: 2,
  fetchCalls: 2,
  fetchMaxCharacters: 12000,
} as const;

type ResearchExecutionBudgetState = {
  webSearchCalls: number;
  advancedSearchCalls: number;
  fetchCalls: number;
  createdAt: number;
  lastTouchedAt: number;
};

const RESEARCH_BUDGET_TTL_MS =
  30 * 60 * 1000;

const budgetRegistry =
  new Map<
    string,
    ResearchExecutionBudgetState
  >();

function normalizeRunId(
  runId: string,
): string {
  const normalized =
    runId.trim();

  if (!normalized) {
    throw new Error(
      "Research execution budget requires a valid internal runId",
    );
  }

  return normalized;
}

function cleanupExpiredBudgets(
  now: number,
): void {
  for (
    const [
      runId,
      state,
    ] of budgetRegistry
  ) {
    if (
      now - state.lastTouchedAt >
      RESEARCH_BUDGET_TTL_MS
    ) {
      budgetRegistry.delete(
        runId,
      );
    }
  }
}

function getBudgetState(
  runId: string,
): ResearchExecutionBudgetState {
  const normalizedRunId =
    normalizeRunId(
      runId,
    );

  const now =
    Date.now();

  cleanupExpiredBudgets(
    now,
  );

  const existing =
    budgetRegistry.get(
      normalizedRunId,
    );

  if (existing) {
    existing.lastTouchedAt =
      now;

    return existing;
  }

  const created:
    ResearchExecutionBudgetState = {
      webSearchCalls: 0,
      advancedSearchCalls: 0,
      fetchCalls: 0,
      createdAt: now,
      lastTouchedAt: now,
    };

  budgetRegistry.set(
    normalizedRunId,
    created,
  );

  return created;
}

export function consumeWebSearchBudget(
  runId: string,
  searchDepth:
    string | undefined,
): void {
  const state =
    getBudgetState(
      runId,
    );

  if (
    state.webSearchCalls >=
    RESEARCH_EXECUTION_LIMITS
      .webSearchCalls
  ) {
    throw new Error(
      `Research web-search budget exhausted: maximum ${RESEARCH_EXECUTION_LIMITS.webSearchCalls} searches per run. Stop searching and synthesize from evidence already collected.`,
    );
  }

  state.webSearchCalls +=
    1;

  state.lastTouchedAt =
    Date.now();

  if (
    searchDepth !==
    "advanced"
  ) {
    return;
  }

  if (
    state.advancedSearchCalls >=
    RESEARCH_EXECUTION_LIMITS
      .advancedSearchCalls
  ) {
    throw new Error(
      `Research advanced-search budget exhausted: maximum ${RESEARCH_EXECUTION_LIMITS.advancedSearchCalls} advanced searches per run. Use existing evidence or a non-advanced search only if web-search budget remains.`,
    );
  }

  state.advancedSearchCalls +=
    1;

  state.lastTouchedAt =
    Date.now();
}

export function consumeFetchBudget(
  runId: string,
): void {
  const state =
    getBudgetState(
      runId,
    );

  if (
    state.fetchCalls >=
    RESEARCH_EXECUTION_LIMITS
      .fetchCalls
  ) {
    throw new Error(
      `Research URL-fetch budget exhausted: maximum ${RESEARCH_EXECUTION_LIMITS.fetchCalls} fetches per run. Stop fetching and synthesize from evidence already collected.`,
    );
  }

  state.fetchCalls +=
    1;

  state.lastTouchedAt =
    Date.now();
}

export function clearResearchExecutionBudget(
  runId: string,
): void {
  const normalizedRunId =
    runId.trim();

  if (!normalizedRunId) {
    return;
  }

  budgetRegistry.delete(
    normalizedRunId,
  );
}
