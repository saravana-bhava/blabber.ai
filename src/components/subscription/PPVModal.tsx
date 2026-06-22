'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { CreditCard, Loader2, Lock, Shield, Unlock, Wallet } from 'lucide-react';
import {
  BrandPaymentContinueButton,
  BrandPaymentDialogHeader,
  brandPaymentDialogContentClass,
  PaymentMethodCard,
  PurchasePriceSummary,
} from '@/components/payments/brand-payment-ui';
import { useUser } from '@/lib/contexts/user-context';
import { useCreditsModal } from '@/lib/contexts/credits-modal-context';
import { useCreditMonetization } from '@/lib/contexts/credit-monetization-context';
import { postCreditSpend } from '@/lib/credits/post-credit-spend';
import { formatUsdWithCreditsSuffix } from '@/lib/credits/monetization-display';
import { OnyxCardForm } from '@/components/subscription/OnyxCardForm';
import { StripePaymentInline } from '@/components/payments/StripePaymentInline';

interface PPVModalProps {
  isOpen: boolean;
  onClose: () => void;
  post?: {
    id: string;
    ppv_price_cents: number;
    creator: {
      id: string;
      name?: string;
    };
  };
  messageId?: string;
  priceCents?: number;
  isMessage?: boolean;
  isDemo?: boolean;
  onPaymentSuccess?: () => void;
}

export function PPVModal({ isOpen, onClose, post, messageId, priceCents, isMessage = false, isDemo, onPaymentSuccess }: PPVModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showPaymentSelection, setShowPaymentSelection] = useState(false);
  const [showOnyxCardForm, setShowOnyxCardForm] = useState(false);
  // Reusing OnyxCardForm UI for GOAT — toggle decides which backend route to hit on submit.
  const [cardFormProcessor, setCardFormProcessor] = useState<'onyx' | 'goat'>('onyx');
  const [showStripePayment, setShowStripePayment] = useState(false);
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [profileBilling, setProfileBilling] = useState<{ first_name: string; last_name: string; email: string } | null>(null);
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<Array<{ id: string; last4: string; brand: string | null; is_default: boolean; onyx_payment_method_id: string }>>([]);
  const supabase = createClient();
  const { profile, refreshProfile } = useUser();
  const { setIsBuyCreditsModalOpen } = useCreditsModal();
  const { creditOnlyEcosystem, pricePerCreditCents, fiatPaymentProcessor, loaded: creditMetaLoaded } =
    useCreditMonetization();
  const amountCents = isMessage ? (priceCents || 0) : (post?.ppv_price_cents || 0);
  const creatorIdForMeta = post?.creator?.id;

  const handleAdminTestPPV = async () => {
    const response = await fetch('/api/stripe/create-ppv-transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        isMessage
          ? { messageId, adminTestBypass: true }
          : { postId: post?.id, adminTestBypass: true }
      ),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || 'Admin test purchase failed');
    }

    toast.success('Admin test unlock recorded (no charge)');
    onPaymentSuccess?.();
    handleClose();
  };

  const handleDemoPPV = async () => {
    // Create demo PPV transaction record directly
    const response = await fetch('/api/stripe/create-ppv-transaction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(isMessage ? {
        messageId,
        paymentIntentId: `demo_ppv_${Date.now()}`,
        isDemo: true,
      } : {
        postId: post?.id,
        paymentIntentId: `demo_ppv_${Date.now()}`,
        isDemo: true,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create demo PPV transaction');
    }

    toast.success('Demo payment successful!');
    onPaymentSuccess?.();
    handleClose();
  };

  const handleOpen = async () => {
    if (isDemo) {
      // Demo mode: bypass Stripe and directly create PPV transaction
      try {
        setIsLoading(true);
        await handleDemoPPV();
      } catch (error) {
        console.error('Error creating demo PPV:', error);
        toast.error('Failed to process demo payment.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (!creditMetaLoaded) {
      return;
    }

    if (creditOnlyEcosystem) {
      setIsLoading(true);
      try {
        const result = await postCreditSpend(
          isMessage
            ? { kind: 'ppv', messageId }
            : { kind: 'ppv', postId: post?.id }
        );
        if (!result.ok) {
          if (result.insufficientCredits) {
            toast.error('Insufficient credits');
            setIsBuyCreditsModalOpen(true);
          } else {
            toast.error(result.error);
          }
          return;
        }
        toast.success('Purchase successful');
        await refreshProfile();
        handleSuccess();
      } finally {
        setIsLoading(false);
      }
      return;
    }

    setShowPaymentSelection(true);
  };

  const handleOnyxCardPay = async (card: { number: string; exp_month: string; exp_year: string; cvc: string }, billing?: { first_name: string; last_name: string; email: string }, saveCard?: boolean) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      toast.error('You must be logged in to purchase content');
      return;
    }
    setIsLoading(true);
    try {
      const returnUrl = window.location.href;
      const endpoint =
        cardFormProcessor === 'goat'
          ? '/api/goat/process-payment'
          : '/api/onyx/process-payment';
      const payload: Record<string, unknown> = {
        transactionType: 'ppv',
        amountCents,
        metadata: {
          userId: session.user.id,
          transactionType: 'ppv',
          postId: isMessage ? undefined : post?.id,
          messageId: isMessage ? messageId : undefined,
          creatorId: creatorIdForMeta,
          amountCents,
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
        toast.info(data.message || 'Payment is processing. Your purchase will unlock once it settles.');
        handleClose();
        return;
      }
      if (data.status === 'success') {
        toast.success('Purchase successful');
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

  const handlePayWithSavedCard = async (onyxPaymentMethodId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      toast.error('You must be logged in to purchase content');
      return;
    }
    setIsLoading(true);
    try {
      const returnUrl = window.location.href;
      const response = await fetch('/api/onyx/process-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionType: 'ppv',
          amountCents,
          metadata: {
            userId: session.user.id,
            transactionType: 'ppv',
            postId: isMessage ? undefined : post?.id,
            messageId: isMessage ? messageId : undefined,
            creatorId: creatorIdForMeta,
            amountCents,
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
        toast.success('Purchase successful');
        if (data.saved_card_error) toast.warning(data.saved_card_error);
        handleSuccess();
      }
    } catch (err) {
      toast.error('Payment failed');
    } finally {
      setIsLoading(false);
    }
  };

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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error('You must be logged in to purchase content');
        return;
      }

      const amountCents = isMessage ? (priceCents || 0) : (post?.ppv_price_cents || 0);
      
      // Create checkout session (validates amount server-side)
      const response = await fetch('/api/moonpay/create-ppv-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountCents,
          userId: session.user.id,
          postId: isMessage ? null : post?.id,
          messageId: isMessage ? messageId : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || 'Failed to create checkout session';
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      // Redirect with only type and transactionId (config will be fetched from Supabase)
      const params = new URLSearchParams({
        type: 'ppv',
        transactionId: data.transactionId,
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

  const handleEpochPayment = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error('You must be logged in to purchase content');
        return;
      }
      const response = await fetch('/api/epoch/create-ppv-payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: isMessage ? undefined : post?.id,
          messageId: isMessage ? messageId : undefined,
          amountCents,
          returnUrl: window.location.href,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || 'Failed to create payment link');
        return;
      }
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      }
    } catch (error) {
      console.error('Epoch PPV error:', error);
      toast.error('Failed to start checkout');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUsPaymatePayment = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error('You must be logged in to purchase content');
        return;
      }
      const response = await fetch('/api/uspaymate/create-ppv-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: isMessage ? undefined : post?.id,
          messageId: isMessage ? messageId : undefined,
          amountCents,
          returnUrl: window.location.href,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || 'Failed to create checkout session');
        return;
      }
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      }
    } catch (error) {
      console.error('USPaymate PPV error:', error);
      toast.error('Failed to start checkout');
    } finally {
      setIsLoading(false);
    }
  };

  const startStripePpv = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/stripe/create-ppv-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: isMessage ? undefined : post?.id,
          messageId: isMessage ? messageId : undefined,
          amountCents,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || 'Failed to start card payment');
        return;
      }
      if (data.clientSecret) {
        setStripeClientSecret(data.clientSecret);
        setShowStripePayment(true);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to start card payment');
    } finally {
      setIsLoading(false);
    }
  };

  const finalizeStripePpv = async (paymentIntentId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      toast.error('Session expired');
      return;
    }
    const response = await fetch('/api/stripe/create-ppv-transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        isMessage
          ? { messageId, paymentIntentId }
          : { postId: post?.id, paymentIntentId }
      ),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      toast.error((err as { error?: string }).error || 'Failed to record purchase');
      return;
    }
    toast.success('Purchase successful');
    handleSuccess();
  };

  const handleClose = () => {
    setShowPaymentSelection(false);
    setShowOnyxCardForm(false);
    setShowStripePayment(false);
    setStripeClientSecret(null);
    onClose();
  };

  const handleBackToSelection = () => {
    setShowPaymentSelection(false);
    setShowStripePayment(false);
    setStripeClientSecret(null);
  };

  const handleSuccess = () => {
    onPaymentSuccess?.();
    handleClose();
  };

  const formatPrice = (cents: number) => {
    return formatUsdWithCreditsSuffix(cents, creditOnlyEcosystem, pricePerCreditCents);
  };

  const inCheckoutStep = showStripePayment || showOnyxCardForm;
  const dialogTitle = inCheckoutStep
    ? 'Complete payment'
    : showPaymentSelection
      ? 'Choose payment method'
      : 'Purchase Content';
  const dialogDescription = inCheckoutStep
    ? 'Enter your payment details below. Content unlocks instantly after purchase.'
    : showPaymentSelection
      ? 'Pick how you want to pay. Access unlocks right after your purchase.'
      : 'Purchase this pay-per-view content to unlock access.';
  const DialogIcon = inCheckoutStep || showPaymentSelection ? CreditCard : Unlock;
  const priceLabel = formatPrice(amountCents);
  const summarySubtitle = creditOnlyEcosystem
    ? 'One-time unlock with credits from your balance'
    : 'One-time payment to view this content';

  const handleHeaderBack = () => {
    if (showOnyxCardForm || showStripePayment) {
      setShowOnyxCardForm(false);
      setShowStripePayment(false);
      setStripeClientSecret(null);
      return;
    }
    handleBackToSelection();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent className={brandPaymentDialogContentClass}>
        <BrandPaymentDialogHeader
          icon={DialogIcon}
          title={dialogTitle}
          description={dialogDescription}
          showBack={showPaymentSelection || inCheckoutStep}
          onBack={handleHeaderBack}
        />

        <div className="px-6 py-5">
          {showStripePayment && stripeClientSecret ? (
            <div className="space-y-4">
              <PurchasePriceSummary
                icon={Unlock}
                priceLabel={priceLabel}
                subtitle={summarySubtitle}
              />
              <StripePaymentInline
                clientSecret={stripeClientSecret}
                amountLabel={`${priceLabel} — One-time payment`}
                onSuccess={finalizeStripePpv}
                onCancel={() => {
                  setShowStripePayment(false);
                  setStripeClientSecret(null);
                }}
                variant="branded"
                hideAmountLabel
                hideCancel
              />
            </div>
          ) : showOnyxCardForm ? (
            <div className="space-y-4">
              <PurchasePriceSummary
                icon={Unlock}
                priceLabel={priceLabel}
                subtitle={summarySubtitle}
              />
              <OnyxCardForm
                amountLabel={`${priceLabel} — One-time payment`}
                billing={profileBilling}
                showSaveCard={true}
                onSubmit={handleOnyxCardPay}
                onCancel={() => setShowOnyxCardForm(false)}
                isLoading={isLoading}
                variant="branded"
                hideAmountLabel
                hideCancel
              />
            </div>
          ) : showPaymentSelection ? (
            <div className="space-y-4">
              {!creditMetaLoaded ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
                  <p className="text-sm">Loading payment options…</p>
                </div>
              ) : (
                <>
                  <PurchasePriceSummary
                    icon={Unlock}
                    priceLabel={priceLabel}
                    subtitle={summarySubtitle}
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
                        subtitle="USDC, ETH, SOL & more"
                        onClick={handleMoonpayPayment}
                        disabled={isLoading}
                      />
                    )}

                    {fiatPaymentProcessor === 'stripe' && (
                      <PaymentMethodCard
                        icon={<CreditCard className="h-[18px] w-[18px]" />}
                        title="Pay with card"
                        subtitle="Stripe — credit or debit card"
                        onClick={startStripePpv}
                        disabled={isLoading}
                      />
                    )}

                    {fiatPaymentProcessor === 'epoch' && (
                      <PaymentMethodCard
                        icon={<CreditCard className="h-[18px] w-[18px]" />}
                        title="Continue to checkout"
                        subtitle="Epoch secure checkout"
                        onClick={handleEpochPayment}
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
                            await handleAdminTestPPV();
                          } catch (e) {
                            console.error(e);
                            toast.error(e instanceof Error ? e.message : 'Admin test purchase failed');
                          } finally {
                            setIsLoading(false);
                          }
                        }}
                        disabled={isLoading}
                      />
                    )}
                  </div>

                  <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
                    <Lock className="h-3 w-3 shrink-0" />
                    Secure checkout · Content unlocks instantly
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {!creditMetaLoaded ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
                  <p className="text-sm">Loading price…</p>
                </div>
              ) : (
                <>
                  <PurchasePriceSummary
                    icon={Unlock}
                    priceLabel={priceLabel}
                    subtitle={summarySubtitle}
                  />
                  <BrandPaymentContinueButton
                    onClick={handleOpen}
                    disabled={!creditMetaLoaded}
                    loading={isLoading}
                  >
                    {creditOnlyEcosystem ? 'Unlock with credits' : 'Continue to payment'}
                  </BrandPaymentContinueButton>
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 