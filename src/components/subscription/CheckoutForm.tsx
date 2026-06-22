import { useState } from 'react';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Stripe } from 'stripe';

interface CheckoutFormProps {
  creatorId: string;
  onSuccess: () => void;
  subscriptionId: string;
  onBack?: () => void;
}

interface PaymentIntentWithMetadata extends Stripe.PaymentIntent {
  metadata: {
    creatorShare: string;
    platformShare: string;
    agencyShare?: string;
    agencyProfileId?: string;
  };
}

export function CheckoutForm({ creatorId, onSuccess, subscriptionId, onBack }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);

    try {
      const { error: paymentError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: 'if_required',
      });

      if (paymentError) {
        toast.error(paymentError.message || 'An error occurred during payment');
        return;
      }

      if (paymentIntent.status === 'succeeded') {
        // Get the current user's session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          throw new Error('No user session found');
        }

        // Get creator details
        const { data: creator, error: creatorError } = await supabase
          .from('creators')
          .select('subscription_price_cents, subscription_interval')
          .eq('profile_id', creatorId)
          .single();

        if (creatorError || !creator) {
          throw new Error('Creator not found');
        }

        // Create subscription record
        const { data: subscription, error: subscriptionError } = await supabase
          .from('subscriptions')
          .insert({
            follower_id: session.user.id,
            following_id: creatorId,
            status: 'active',
            current_period_ends_at: new Date(Date.now() + getIntervalInMs(creator.subscription_interval)).toISOString(),
            provider_subscription_id: subscriptionId,
            price_at_time_of_subscription_cents: creator.subscription_price_cents,
            interval_at_time_of_subscription: creator.subscription_interval,
            payment_provider: 'stripe',
          })
          .select()
          .single();

        if (subscriptionError) {
          throw new Error('Failed to create subscription record');
        }

        // Create subscription payment record
        const paymentIntentWithMetadata = paymentIntent as PaymentIntentWithMetadata;
        const { error: paymentRecordError } = await supabase
          .from('subscription_payments')
          .insert({
            subscription_id: subscription.id,
            user_id: session.user.id,
            creator_profile_id: creatorId,
            amount_cents: creator.subscription_price_cents,
            currency: 'usd',
            payment_provider: 'stripe',
            payment_intent_id: paymentIntent.id,
            status: 'succeeded',
            period_starts_at: new Date().toISOString(),
            period_ends_at: new Date(Date.now() + getIntervalInMs(creator.subscription_interval)).toISOString(),
            creator_share_cents: parseInt(paymentIntentWithMetadata.metadata.creatorShare),
            platform_share_cents: parseInt(paymentIntentWithMetadata.metadata.platformShare),
            agency_share_cents: paymentIntentWithMetadata.metadata.agencyShare
              ? parseInt(paymentIntentWithMetadata.metadata.agencyShare) || null
              : null,
            agency_profile_id: paymentIntentWithMetadata.metadata.agencyProfileId || null,
          });

        if (paymentRecordError) {
          throw new Error('Failed to create payment record');
        }

        toast.success('Successfully subscribed!');
        onSuccess();
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error('An error occurred while processing your payment');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full p-4 space-y-4">
      <PaymentElement />
      <Button
        type="submit"
        disabled={!stripe || !elements || isLoading}
        className="w-full"
      >
        {isLoading ? 'Processing...' : 'Subscribe Now'}
      </Button>
      {onBack && (
        <Button type="button" variant="outline" className="w-full" onClick={onBack} disabled={isLoading}>
          Back
        </Button>
      )}
    </form>
  );
}

// Helper function to convert interval to milliseconds
function getIntervalInMs(interval: 'month' | 'year'): number {
  const now = new Date();
  const next = new Date(now);
  
  if (interval === 'month') {
    next.setMonth(next.getMonth() + 1);
  } else {
    next.setFullYear(next.getFullYear() + 1);
  }
  
  return next.getTime() - now.getTime();
} 