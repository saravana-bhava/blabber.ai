-- Add 250-credit bundle between 100 (list) and 500 (volume); ~4% off list at 5¢/credit.
INSERT INTO platform_settings (key, value, description) VALUES
(
  'credit_packages',
  '[{"amount":100,"price_cents":500},{"amount":250,"price_cents":1199},{"amount":500,"price_cents":2350},{"amount":1000,"price_cents":4600}]',
  'Credit bundles: 100 @ list; 250/500/1000 at volume discount'
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = timezone('utc'::text, now());
