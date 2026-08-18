BEGIN;

ALTER TABLE app.ai_cost_ledger
  ALTER COLUMN unit_price DROP NOT NULL,
  ALTER COLUMN unit_price DROP DEFAULT,
  ALTER COLUMN cost DROP NOT NULL;

ALTER TABLE app.ai_cost_ledger
  DROP CONSTRAINT IF EXISTS ai_cost_ledger_price_cost_pair_check;

ALTER TABLE app.ai_cost_ledger
  ADD CONSTRAINT ai_cost_ledger_price_cost_pair_check
  CHECK (
    (
      unit_price IS NULL
      AND cost IS NULL
    )
    OR
    (
      unit_price IS NOT NULL
      AND cost IS NOT NULL
    )
  );

COMMIT;
