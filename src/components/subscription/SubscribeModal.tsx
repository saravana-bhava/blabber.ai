'use client';

import { Button } from "@/components/ui/button";
import { toast } from 'sonner';
import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { dispatchSubscribeButtonPulse } from '@/lib/credit-motion-events';
import { createNewSubscriptionNotification } from '@/app/actions/notificationActions';
import { CreditCard, Loader2, Lock, Shield, Star, Wallet } from 'lucide-react';
import {
  BrandDialogShell,
  brandCancelBtn,
  brandPrimaryBtn,
} from '@/components/feed/brand-dialog-shell';
import {
  PaymentMethodCard,
  PurchasePriceSummary,
} from '@/components/payments/brand-payment-ui';
import { cn } from '@/lib/utils';
import { useUser } from '@/lib/contexts/user-context';
import { useCreditsModal } from '@/lib/contexts/credits-modal-context';
import { useCreditMonetization } from '@/lib/contexts/credit-monetization-context';
import { postCreditSpend } from '@/lib/credits/post-credit-spend';
import { formatUsdWithCreditsSuffix } from '@/lib/credits/monetization-display';
import { OnyxCardForm } from '@/components/subscription/OnyxCardForm';
import { StripeSubscriptionElements } from '@/components/payments/StripeSubscriptionElements';

interface SubscribeModalProps {
  isOpen: boolean;
  onClose: () => void;
  creator: {
    id: string;
    subscription_price_cents: number;
    subscription_interval: 'month' | 'year';
    name?: string;
  };
  isDemo?: boolean;
  onSubscriptionSuccess?: () => void;
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

export function SubscribeModal({ isOpen, onClose, creator, isDemo, onSubscriptionSuccess }: SubscribeModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showPaymentSelection, setShowPaymentSelection] = useState(false);
  const [showOnyxCardForm, setShowOnyxCardForm] = useState(false);
  // Reusing OnyxCardForm UI for GOAT — toggle decides which backend route to hit on submit.
  const [cardFormProcessor, setCardFormProcessor] = useState<'onyx' | 'goat'>('onyx');
  const [showStripeSubscription, setShowStripeSubscription] = useState(false);
  const [stripeSubClientSecret, setStripeSubClientSecret] = useState<string | null>(null);
  const [stripeSubscriptionId, setStripeSubscriptionId] = useState<string | null>(null);
  const [profileBilling, setProfileBilling] = useState<{ first_name: string; last_name: string; email: string } | null>(null);
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<Array<{ id: string; last4: string; brand: string | null; is_default: boolean; onyx_payment_method_id: string }>>([]);
  const supabase = createClient();
  const { profile, refreshProfile } = useUser();
  const { setIsBuyCreditsModalOpen } = useCreditsModal();
  const { creditOnlyEcosystem, pricePerCreditCents, fiatPaymentProcessor, loaded: creditMetaLoaded } =
    useCreditMonetization();
  const subscribeAutoFlowStartedRef = useRef(false);

  const handleAdminTestSubscribe = async () => {
    const response = await fetch('/api/admin/bypass-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creatorId: creator.id,
        subscription_price_cents: creator.subscription_price_cents,
        subscription_interval: creator.subscription_interval,
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || 'Admin test subscribe failed');
    }
    toast.success('Admin test subscription active (no charge)');
    handleSuccess();
  };

  const handleDemoSubscription = async () => {
    
    // Get the current user's session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      throw new Error('No user session found');
    }

    // Check for existing subscription
    const { data: existingSubscription, error: existingError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('follower_id', session.user.id)
      .eq('following_id', creator.id)
      .single();

    let subscription;
    if (existingSubscription) {
      // Update existing subscription
      const { data: updatedSubscription, error: updateError } = await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          current_period_ends_at: new Date(Date.now() + getIntervalInMs(creator.subscription_interval)).toISOString(),
          provider_subscription_id: `demo_${Date.now()}`,
          price_at_time_of_subscription_cents: creator.subscription_price_cents,
          interval_at_time_of_subscription: creator.subscription_interval,
          payment_provider: 'demo',
          canceled_at: null,
        })
        .eq('id', existingSubscription.id)
        .select()
        .single();

      if (updateError) {
        throw new Error('Failed to update subscription record');
      }
      subscription = updatedSubscription;
    } else {
      // Create new subscription record
      const { data: newSubscription, error: subscriptionError } = await supabase
        .from('subscriptions')
        .insert({
          follower_id: session.user.id,
          following_id: creator.id,
          status: 'active',
          current_period_ends_at: new Date(Date.now() + getIntervalInMs(creator.subscription_interval)).toISOString(),
          provider_subscription_id: `demo_${Date.now()}`,
          price_at_time_of_subscription_cents: creator.subscription_price_cents,
          interval_at_time_of_subscription: creator.subscription_interval,
          payment_provider: 'demo',
        })
        .select()
        .single();

      if (subscriptionError) {
        throw new Error('Failed to create subscription record');
      }
      subscription = newSubscription;
    }

    // Create demo payment record
    const { error: paymentRecordError } = await supabase
      .from('subscription_payments')
      .insert({
        subscription_id: subscription.id,
        user_id: session.user.id,
        creator_profile_id: creator.id,
        amount_cents: creator.subscription_price_cents,
        currency: 'usd',
        payment_provider: 'demo',
        payment_intent_id: `demo_${Date.now()}`,
        status: 'succeeded',
        period_starts_at: new Date().toISOString(),
        period_ends_at: new Date(Date.now() + getIntervalInMs(creator.subscription_interval)).toISOString(),
        creator_share_cents: Math.round(creator.subscription_price_cents * 0.7), // Assume 70% creator share
        platform_share_cents: Math.round(creator.subscription_price_cents * 0.3), // Assume 30% platform share
      });

    if (paymentRecordError) {
      throw new Error('Failed to create payment record');
    }

    toast.success('Successfully subscribed to demo creator!');
    handleSuccess();

    // Create notification (same as regular flow)
    try {
      const { data: subscriberProfile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', session.user.id)
        .single();

      if (subscriberProfile?.username) {
        await createNewSubscriptionNotification({
          creatorId: creator.id,
          subscriberId: session.user.id,
          subscriberUsername: subscriberProfile.username
        });
      }
    } catch (notificationError) {
      console.error('Failed to create subscription notification:', notificationError);
      // Don't fail the subscription if notification fails
    }
  };

  const runCreditOnlySubscribe = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error('You must be logged in to subscribe');
        return;
      }
      const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('follower_id', session.user.id)
        .eq('following_id', creator.id)
        .maybeSingle();
      const result = await postCreditSpend({
        kind: 'subscription',
        creatorId: creator.id,
        subscriptionId: existingSub?.id ?? null,
      });
      if (!result.ok) {
        if (result.insufficientCredits) {
          toast.error('Insufficient credits');
          setIsBuyCreditsModalOpen(true);
        } else {
          toast.error(result.error);
        }
        return;
      }
      toast.success('Subscribed successfully');
      await refreshProfile();
      handleSuccess();
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpen = async () => {
    if (isDemo) {
      try {
        setIsLoading(true);
        await handleDemoSubscription();
      } catch (error) {
        console.error('Error creating demo subscription:', error);
        toast.error('Failed to create demo subscription.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (!creditMetaLoaded) return;

    if (creditOnlyEcosystem) {
      await runCreditOnlySubscribe();
      return;
    }

    setShowPaymentSelection(true);
  };

  useLayoutEffect(() => {
    if (!isOpen) {
      subscribeAutoFlowStartedRef.current = false;
      return;
    }
    if (!isDemo && !creditMetaLoaded) return;

    if (isDemo) {
      if (subscribeAutoFlowStartedRef.current) return;
      subscribeAutoFlowStartedRef.current = true;
      void (async () => {
        try {
          setIsLoading(true);
          await handleDemoSubscription();
        } catch (error) {
          console.error('Error creating demo subscription:', error);
          toast.error('Failed to create demo subscription.');
        } finally {
          setIsLoading(false);
        }
      })();
      return;
    }

    // Credit-only: require an explicit "Subscribe Now" click — do not charge on open.
    if (creditOnlyEcosystem) {
      return;
    }

    if (subscribeAutoFlowStartedRef.current) return;
    subscribeAutoFlowStartedRef.current = true;
    setShowPaymentSelection(true);
  }, [isOpen, isDemo, creditMetaLoaded, creditOnlyEcosystem, creator.id]);

  const handleOnyxCardPay = async (card: { number: string; exp_month: string; exp_year: string; cvc: string }, billing?: { first_name: string; last_name: string; email: string }, saveCard?: boolean) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      toast.error('You must be logged in to subscribe');
      return;
    }
    setIsLoading(true);
    try {
      const returnUrl = window.location.href;
      const { data: existingSub } = await supabase.from('subscriptions').select('id').eq('follower_id', session.user.id).eq('following_id', creator.id).single();
      const endpoint =
        cardFormProcessor === 'goat'
          ? '/api/goat/process-payment'
          : '/api/onyx/process-payment';
      const payload: Record<string, unknown> = {
        transactionType: 'subscription',
        amountCents: creator.subscription_price_cents,
        metadata: {
          userId: session.user.id,
          transactionType: 'subscription',
          creatorId: creator.id,
          amountCents: creator.subscription_price_cents,
          subscriptionId: existingSub?.id,
        },
        card,
        billing,
        returnUrl,
      };
      if (cardFormProcessor === 'onyx') payload.save_card = !!saveCard;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || 'Payment failed');
        setIsLoading(false);
        return;
      }
      if (data.status === 'redirect' && data.redirect_url) {
        window.location.href = data.redirect_url;
        return;
      }
      if (data.status === 'pending') {
        toast.info(data.message || 'Subscription is processing. You\u2019ll get access as soon as it settles.');
        handleClose();
        return;
      }
      if (data.status === 'success') {
        toast.success('Subscribed successfully');
        if (data.saved_card_error) {
          toast.warning(data.saved_card_error);
        }
        handleSuccess();
      }
    } catch (err) {
      toast.error('Payment failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayWithCardClick = () => {
    setCardFormProcessor('onyx');
    setShowOnyxCardForm(true);
  };

  const handlePayWithGoatCardClick = () => {
    setCardFormProcessor('goat');
    setShowOnyxCardForm(true);
  };

  const handlePayWithSavedCard = async (onyxPaymentMethodId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      toast.error('You must be logged in to subscribe');
      return;
    }
    setIsLoading(true);
    try {
      const returnUrl = window.location.href;
      const { data: existingSub } = await supabase.from('subscriptions').select('id').eq('follower_id', session.user.id).eq('following_id', creator.id).single();
      const response = await fetch('/api/onyx/process-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionType: 'subscription',
          amountCents: creator.subscription_price_cents,
          metadata: {
            userId: session.user.id,
            transactionType: 'subscription',
            creatorId: creator.id,
            amountCents: creator.subscription_price_cents,
            subscriptionId: existingSub?.id,
          },
          payment_method_id: onyxPaymentMethodId,
          returnUrl,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || 'Payment failed');
        setIsLoading(false);
        return;
      }
      if (data.status === 'redirect' && data.redirect_url) {
        window.location.href = data.redirect_url;
        return;
      }
      if (data.status === 'success') {
        toast.success('Subscribed successfully');
        handleSuccess();
      }
    } catch (err) {
      toast.error('Payment failed');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!showPaymentSelection || !isOpen) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data: methods } = await supabase
        .from('user_payment_methods')
        .select('id, last4, brand, is_default, onyx_payment_method_id')
        .eq('user_id', session.user.id)
        .order('is_default', { ascending: false });
      setSavedPaymentMethods((methods as any) || []);
    })();
  }, [showPaymentSelection, isOpen]);

  useEffect(() => {
    if (!showOnyxCardForm || !isOpen) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', session.user.id).single();
      const name = (profile?.full_name || '').trim().split(/\s+/);
      setProfileBilling({
        first_name: name[0] || '',
        last_name: name.slice(1).join(' ') || '',
        email: session.user.email || '',
      });
    })();
  }, [showOnyxCardForm, isOpen]);

  const handleMoonpayPayment = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error('You must be logged in to subscribe');
        return;
      }

      // Create checkout session (validates amount server-side)
      const response = await fetch('/api/moonpay/create-subscription-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: creator.subscription_price_cents,
          userId: session.user.id,
          creatorId: creator.id,
        }),
      });

      if (!response.ok) throw new Error('Failed to create checkout session');

      const data = await response.json();
      
      // Redirect with only type and paymentId (config will be fetched from Supabase)
      const params = new URLSearchParams({
        type: 'subscription',
        paymentId: data.paymentId,
      });

      window.location.href = `/crypto-payment?${params.toString()}`;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create checkout session';
      toast.error(errorMessage);
      
      // If transaction is still pending, close the modal and redirect to transactions page
      if (errorMessage.includes('Transaction still pending')) {
        handleClose();
        window.location.href = '/transactions';
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEpochSubscribe = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error('You must be logged in to subscribe');
        return;
      }
      const response = await fetch('/api/epoch/create-subscription-payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId: creator.id,
          returnUrl: window.location.href,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || 'Failed to create payment link');
        return;
      }
      if (data.paymentUrl) window.location.href = data.paymentUrl;
    } catch (e) {
      console.error(e);
      toast.error('Failed to start checkout');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUsPaymateSubscribe = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error('You must be logged in to subscribe');
        return;
      }
      const response = await fetch('/api/uspaymate/create-subscription-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId: creator.id,
          returnUrl: window.location.href,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || 'Failed to create checkout session');
        return;
      }
      if (data.paymentUrl) window.location.href = data.paymentUrl;
    } catch (e) {
      console.error(e);
      toast.error('Failed to start checkout');
    } finally {
      setIsLoading(false);
    }
  };

  const startStripeSubscribe = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/stripe/create-subscription-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorId: creator.id }),
      });
      if (!response.ok) {
        const text = await response.text();
        toast.error(text || 'Failed to start card subscription');
        return;
      }
      const data = await response.json();
      if (data.clientSecret && data.subscriptionId) {
        setStripeSubClientSecret(data.clientSecret);
        setStripeSubscriptionId(data.subscriptionId);
        setShowStripeSubscription(true);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to start card subscription');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setShowPaymentSelection(false);
    setShowOnyxCardForm(false);
    setShowStripeSubscription(false);
    setStripeSubClientSecret(null);
    setStripeSubscriptionId(null);
    onClose();
  };

  const handleBackToSelection = () => {
    setShowPaymentSelection(false);
    setShowStripeSubscription(false);
    setStripeSubClientSecret(null);
    setStripeSubscriptionId(null);
  };

  const handleSuccess = () => {
    dispatchSubscribeButtonPulse(creator.id);
    handleClose();
    onSubscriptionSuccess?.();
  };

  const formatPrice = (cents: number) => {
    return formatUsdWithCreditsSuffix(cents, creditOnlyEcosystem, pricePerCreditCents);
  };

  const formatInterval = (interval: 'month' | 'year') => {
    return interval === 'month' ? 'monthly' : 'yearly';
  };

  const priceLabel = `${formatPrice(creator.subscription_price_cents)}/${formatInterval(creator.subscription_interval)}`;
  const inCheckoutStep = showStripeSubscription || showOnyxCardForm;

  const dialogTitle = showPaymentSelection
    ? 'Choose payment method'
    : showStripeSubscription
      ? 'Card payment'
      : showOnyxCardForm
        ? 'Enter card'
        : `Subscribe to ${creator.name || 'Creator'}`;

  const dialogDescription = showPaymentSelection
    ? `You're subscribing for ${priceLabel}. Pick how you'd like to pay.`
    : `Unlock exclusive posts, videos, and shorts from ${creator.name || 'this creator'}.`;

  const footer =
    !showPaymentSelection && !inCheckoutStep && (isDemo || creditMetaLoaded) ? (
      <>
        <Button type="button" variant="outline" className={brandCancelBtn} onClick={handleClose}>
          Cancel
        </Button>
        <Button type="button" className={brandPrimaryBtn} onClick={handleOpen} disabled={isLoading}>
          {isLoading
            ? 'Please wait…'
            : creditOnlyEcosystem
              ? 'Subscribe with credits'
              : 'Continue'}
        </Button>
      </>
    ) : showPaymentSelection && !inCheckoutStep ? (
      <Button type="button" variant="outline" className={cn(brandCancelBtn, 'w-full sm:w-auto')} onClick={handleBackToSelection}>
        Back
      </Button>
    ) : undefined;

  return (
    <BrandDialogShell
      open={isOpen}
      onOpenChange={(open) => !open && handleClose()}
      icon={Star}
      title={dialogTitle}
      description={dialogDescription}
      size={showPaymentSelection ? 'wide' : 'default'}
      footer={footer}
    >
          {!isDemo && !creditMetaLoaded ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
              <p className="text-sm">Loading checkout…</p>
            </div>
          ) : (
            <>
          {showStripeSubscription && stripeSubClientSecret && stripeSubscriptionId ? (
            <StripeSubscriptionElements
              clientSecret={stripeSubClientSecret}
              creatorId={creator.id}
              subscriptionId={stripeSubscriptionId}
              onSuccess={() => {
                setShowStripeSubscription(false);
                setStripeSubClientSecret(null);
                setStripeSubscriptionId(null);
                handleSuccess();
              }}
              onBack={() => {
                setShowStripeSubscription(false);
                setStripeSubClientSecret(null);
                setStripeSubscriptionId(null);
              }}
            />
          ) : showOnyxCardForm ? (
            <OnyxCardForm
              amountLabel={`${formatPrice(creator.subscription_price_cents)}/${formatInterval(creator.subscription_interval)}`}
              billing={profileBilling}
              showSaveCard={cardFormProcessor === 'onyx'}
              onSubmit={handleOnyxCardPay}
              onCancel={() => setShowOnyxCardForm(false)}
              isLoading={isLoading}
            />
          ) : showPaymentSelection ? (
            <div className="space-y-4">
              <PurchasePriceSummary
                icon={Star}
                priceLabel={priceLabel}
                subtitle={`Billed ${formatInterval(creator.subscription_interval)} · Cancel anytime`}
              />
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Payment method
                </p>
                {fiatPaymentProcessor === 'onyx' && (
                  <>
                    {savedPaymentMethods.map((pm) => (
                      <PaymentMethodCard
                        key={pm.id}
                        variant="saved"
                        icon={<CreditCard className="h-[18px] w-[18px]" />}
                        title={`•••• ${pm.last4}${pm.is_default ? ' · Default' : ''}`}
                        subtitle={`${pm.brand || 'Card'} — saved payment method`}
                        onClick={() => handlePayWithSavedCard(pm.onyx_payment_method_id)}
                        disabled={isLoading}
                      />
                    ))}
                    <PaymentMethodCard
                      icon={<CreditCard className="h-[18px] w-[18px]" />}
                      title={savedPaymentMethods.length > 0 ? 'Pay with new card' : 'Pay with card'}
                      subtitle="Onyx — credit or debit card"
                      onClick={handlePayWithCardClick}
                      disabled={isLoading}
                    />
                  </>
                )}
                {fiatPaymentProcessor === 'moonpay' && (
                  <PaymentMethodCard
                    icon={<Wallet className="h-[18px] w-[18px]" />}
                    title="Pay with MoonPay"
                    subtitle="USDC, ETH, SOL & more (30 days)"
                    onClick={handleMoonpayPayment}
                    disabled={isLoading}
                  />
                )}
                {fiatPaymentProcessor === 'stripe' && (
                  <PaymentMethodCard
                    icon={<CreditCard className="h-[18px] w-[18px]" />}
                    title="Pay with card"
                    subtitle="Stripe — credit or debit card"
                    onClick={startStripeSubscribe}
                    disabled={isLoading}
                  />
                )}
                {fiatPaymentProcessor === 'epoch' && (
                  <PaymentMethodCard
                    icon={<CreditCard className="h-[18px] w-[18px]" />}
                    title="Continue to checkout"
                    subtitle="Epoch secure checkout"
                    onClick={handleEpochSubscribe}
                    disabled={isLoading}
                  />
                )}
                {profile?.isAdmin && (
                  <PaymentMethodCard
                    variant="admin"
                    icon={<Shield className="h-[18px] w-[18px]" />}
                    title="Admin test (no charge)"
                    subtitle="Bypass payment for testing"
                    onClick={async () => {
                      try {
                        setIsLoading(true);
                        await handleAdminTestSubscribe();
                      } catch (e) {
                        console.error(e);
                        toast.error(e instanceof Error ? e.message : 'Admin test subscribe failed');
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    disabled={isLoading}
                  />
                )}
              </div>
              {fiatPaymentProcessor === 'moonpay' && (
                <p className="text-xs text-muted-foreground text-center">
                  Crypto subscriptions expire in 30 days and cannot be automatically renewed.
                </p>
              )}
              <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
                <Lock className="h-3 w-3 shrink-0" />
                Secure checkout · Access unlocks instantly
              </p>
            </div>
          ) : (
            <PurchasePriceSummary
              icon={Star}
              priceLabel={priceLabel}
              subtitle={`Billed ${formatInterval(creator.subscription_interval)} · Cancel anytime`}
            />
          )}
            </>
          )}
    </BrandDialogShell>
  );
} 