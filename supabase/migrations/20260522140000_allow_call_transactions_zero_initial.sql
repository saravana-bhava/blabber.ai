-- In-progress calls start at 0 credits; billing updates the row each interval.
ALTER TABLE public.call_transactions
  DROP CONSTRAINT IF EXISTS chk_call_amount_positive;

ALTER TABLE public.call_transactions
  ADD CONSTRAINT chk_call_amount_positive CHECK (credits_cents >= 0);
