BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS ai_cost_ledger_llm_total_run_uidx
ON app.ai_cost_ledger (run_id)
WHERE line_type = 'LLM_TOTAL';

COMMIT;
