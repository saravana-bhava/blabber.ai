'use client';

import { useMemo } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { getStripe } from '@/lib/stripe/load-stripe';
import { CheckoutForm } from '@/components/subscription/CheckoutForm';

export function StripeSubscriptionElements({
  clientSecret,
  creatorId,
  subscriptionId,
  onSuccess,
  onBack,
}: {
  clientSecret: string;
  creatorId: string;
  subscriptionId: string;
  onSuccess: () => void;
  onBack: () => void;
}) {
  const stripePromise = useMemo(() => getStripe(), []);

  if (!stripePromise) {
    return (
      <p className="text-sm text-destructive">
        Stripe publishable key is not configured (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY).
      </p>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <CheckoutForm
        creatorId={creatorId}
        subscriptionId={subscriptionId}
        onSuccess={onSuccess}
        onBack={onBack}
      />
    </Elements>
  );
}
