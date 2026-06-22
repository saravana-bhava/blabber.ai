-- Credit bundles: 100 credits at list (100 × price_per_credit); larger packages at volume discount.
-- Does not change price_per_credit (already configured in platform_settings).
INSERT INTO platform_settings (key, value, description) VALUES
(
  'credit_packages',
  '[{"amount":100,"price_cents":500},{"amount":500,"price_cents":2350},{"amount":1000,"price_cents":4600}]',
  'Credit bundles: 100 @ list rate; 500 and 1000 at volume discount'
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = timezone('utc'::text, now());
