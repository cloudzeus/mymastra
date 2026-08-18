BEGIN;

ALTER TABLE app.ai_cost_ledger
  DROP CONSTRAINT ai_cost_ledger_line_type_check;

ALTER TABLE app.ai_cost_ledger
  ADD CONSTRAINT ai_cost_ledger_line_type_check
  CHECK (
    line_type IN (
      'LLM_TOTAL',
      'LLM_INPUT',
      'LLM_OUTPUT',
      'LLM_CACHED_INPUT',
      'LLM_REASONING',
      'WEB_SEARCH',
      'WEB_EXTRACT',
      'IMAGE_GENERATION',
      'VIDEO_GENERATION',
      'EMBEDDING',
      'STORAGE',
      'OTHER_API'
    )
  );

COMMIT;
