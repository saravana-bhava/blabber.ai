import type { Stripe } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null> | null = null;

/**
 * Lazily load Stripe.js only when a payment UI mounts.
 * Uses the `/pure` entry so importing payment components does not inject
 * Stripe's fraud-detection iframe (m.stripe.network) on unrelated pages.
 */
export function getStripe(): Promise<Stripe | null> | null {
  if (typeof window === 'undefined') return null;

  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) return null;

  if (!stripePromise) {
    stripePromise = (async () => {
      const { loadStripe } = await import('@stripe/stripe-js/pure');
      loadStripe.setLoadParameters({ advancedFraudSignals: false });
      return loadStripe(key);
    })();
  }

  return stripePromise;
}
