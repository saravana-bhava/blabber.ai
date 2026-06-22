-- Admin-selectable processor for fiat/card flows (buy credits, and purchases when not in credit-only mode).
INSERT INTO public.platform_settings (key, value, description)
VALUES (
  'fiat_payment_processor',
  'onyx',
  'Card/fiat processor for buying credits and for PPV/subscription/tip/product card checkout when credit_only_ecosystem is off. One of: onyx | stripe | moonpay | epoch.'
)
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  updated_at = timezone('utc'::text, now());
