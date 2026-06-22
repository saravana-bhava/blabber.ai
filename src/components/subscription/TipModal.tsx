'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { createTipNotification } from '@/app/actions/notificationActions';
import { Coins, CreditCard, DollarSign, Loader2, Shield, Wallet } from 'lucide-react';
import { useUser } from '@/lib/contexts/user-context';
import { useCreditsModal } from '@/lib/contexts/credits-modal-context';
import { useCreditMonetization } from '@/lib/contexts/credit-monetization-context';
import { postCreditSpend } from '@/lib/credits/post-credit-spend';
import { formatUsdWithCreditsSuffix } from '@/lib/credits/monetization-display';
import { OnyxCardForm } from '@/components/subscription/OnyxCardForm';
import { StripePaymentInline } from '@/components/payments/StripePaymentInline';
import { createClient } from '@/lib/supabase/client';
import {
  BrandDialogShell,
  brandCancelBtn,
  brandPrimaryBtn,
} from '@/components/feed/brand-dialog-shell';
import { cn } from '@/lib/utils';

const TIP_PRESETS_CENTS = [100, 500, 1000, 2000, 5000] as const;

function formatTipPreset(cents: number) {
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}

const paymentMethodBtn =
  'w-full h-auto min-h-[52px] rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3 text-left transition-colors hover:border-[var(--brand-pink)]/40 hover:bg-muted/30';

const paymentMethodBtnAccent =
  'w-full h-auto min-h-[52px] rounded-xl border border-transparent px-4 py-3 flex items-center gap-3 text-left text-[var(--brand-on-accent)] [background:var(--brand-grad)] [box-shadow:var(--brand-ring-money)] hover:brightness-110';

interface TipModalProps {
  isOpen: boolean;
  onClose: () => void;
  post?: {
    id: string;
    user_id: string;
  };
  creatorId?: string;
  isDemo?: boolean;
  onPaymentSuccess?: () => void;
  onTipSuccess?: (amount: number) => void;
}

export function TipModal({ isOpen, onClose, post, creatorId, isDemo, onPaymentSuccess, onTipSuccess }: TipModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [showPaymentSelection, setShowPaymentSelection] = useState(false);
  const [showOnyxCardForm, setShowOnyxCardForm] = useState(false);
  // Reusing OnyxCardForm UI for GOAT — toggle decides which backend route to hit on submit.
  const [cardFormProcessor, setCardFormProcessor] = useState<'onyx' | 'goat'>('onyx');
  const [showStripePayment, setShowStripePayment] = useState(false);
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [profileBilling, setProfileBilling] = useState<{ first_name: string; last_name: string; email: string } | null>(null);
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<Array<{ id: string; last4: string; brand: string | null; is_default: boolean; onyx_payment_method_id: string }>>([]);
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const supabase = createClient();
  const { profile, refreshProfile } = useUser();
  const { setIsBuyCreditsModalOpen } = useCreditsModal();
  const { creditOnlyEcosystem, pricePerCreditCents, fiatPaymentProcessor, loaded: creditMetaLoaded } =
    useCreditMonetization();

  const handleAdminTestTip = async (amountCents: number) => {
    const effectiveCreatorId = creatorId || post?.user_id;
    if (!effectiveCreatorId) return;

    const response = await fetch('/api/stripe/create-tip-transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postId: post?.id,
        creatorId: effectiveCreatorId,
        amountCents,
        adminTestBypass: true,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || 'Admin test tip failed');
    }

    toast.success('Admin test tip recorded (no charge)');
    onTipSuccess?.(amountCents);
    onPaymentSuccess?.();
    handleClose();
  };

  const handleDemoTip = async (amountCents: number) => {
    const effectiveCreatorId = creatorId || post?.user_id;
    if (!effectiveCreatorId) return;

    // Create demo tip transaction record directly
    const response = await fetch('/api/stripe/create-tip-transaction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        postId: post?.id,
        creatorId: effectiveCreatorId,
        paymentIntentId: `demo_tip_${Date.now()}`,
        amountCents,
        isDemo: true,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create demo tip transaction');
    }

    // Create tip notification
    try {
      // Get current user info for notification
      const userResponse = await fetch('/api/auth/user');
      if (userResponse.ok) {
        const userData = await userResponse.json();
        if (userData.user && effectiveCreatorId) {
          await createTipNotification({
            creatorId: effectiveCreatorId,
            tipperId: userData.user.id,
            tipperUsername: userData.user.username || 'User',
            amount: amountCents / 100, // Convert cents to dollars
            postId: post?.id || undefined
          });
        }
      }
    } catch (notificationError) {
      console.error('Failed to create tip notification:', notificationError);
      // Don't fail the tip if notification fails
    }

    toast.success('Demo tip sent successfully!');
    onTipSuccess?.(amountCents);
    onPaymentSuccess?.();
    handleClose();
  };

  const handleOpen = async () => {
    // Validate amount
    const amountCents = Math.round(parseFloat(amount) * 100);
    if (isNaN(amountCents) || amountCents < 100) {
      setAmountError('Please enter a valid amount (minimum $1.00)');
      return;
    }
    if (amountCents > 1000000) {
      setAmountError('Maximum tip amount is $10,000.00');
      return;
    }

    setAmountError(null);
    
    if (isDemo) {
      // Demo mode: bypass Stripe and directly create tip
      try {
        setIsLoading(true);
        await handleDemoTip(amountCents);
      } catch (error) {
        console.error('Error creating demo tip:', error);
        toast.error('Failed to send demo tip.');
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
        const cid = creatorId || post?.user_id;
        if (!cid) {
          toast.error('Missing creator');
          return;
        }
        const result = await postCreditSpend({
          kind: 'tip',
          amountCents,
          postId: post?.id,
          creatorId: cid,
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
        toast.success('Tip sent successfully');
        await refreshProfile();
        onTipSuccess?.(amountCents);
        onPaymentSuccess?.();
        handleClose();
      } finally {
        setIsLoading(false);
      }
      return;
    }

    setShowPaymentSelection(true);
  };

  const amountCents = Math.round(parseFloat(amount) * 100);
  const effectiveCreatorId = creatorId || post?.user_id;

  const handleOnyxCardPay = async (card: { number: string; exp_month: string; exp_year: string; cvc: string }, billing?: { first_name: string; last_name: string; email: string }, saveCard?: boolean) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      toast.error('You must be logged in to send a tip');
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
        transactionType: 'tip',
        amountCents,
        metadata: {
          userId: session.user.id,
          transactionType: 'tip',
          postId: post?.id,
          creatorId: effectiveCreatorId,
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
        toast.info(data.message || 'Tip is processing. The creator will be notified once it settles.');
        handleClose();
        return;
      }
      if (data.status === 'success') {
        toast.success('Tip sent successfully');
        onTipSuccess?.(amountCents);
        onPaymentSuccess?.();
        handleClose();
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
      toast.error('You must be logged in to send a tip');
      return;
    }
    setIsLoading(true);
    try {
      const returnUrl = window.location.href;
      const response = await fetch('/api/onyx/process-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionType: 'tip',
          amountCents,
          metadata: {
            userId: session.user.id,
            transactionType: 'tip',
            postId: post?.id,
            creatorId: effectiveCreatorId,
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
        toast.success('Tip sent successfully');
        if (data.saved_card_error) toast.warning(data.saved_card_error);
        onTipSuccess?.(amountCents);
        onPaymentSuccess?.();
        handleClose();
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
    const amountCents = Math.round(parseFloat(amount) * 100);
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error('You must be logged in to send a tip');
        return;
      }

      const effectiveCreatorId = creatorId || post?.user_id;
      
      // Create checkout session (validates amount server-side)
      const response = await fetch('/api/moonpay/create-tip-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountCents,
          userId: session.user.id,
          postId: post?.id || null,
          creatorId: effectiveCreatorId,
        }),
      });

      if (!response.ok) throw new Error('Failed to create checkout session');

      const data = await response.json();
      
      // Redirect with only type and transactionId (config will be fetched from Supabase)
      const params = new URLSearchParams({
        type: 'tip',
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

  const handleEpochTip = async () => {
    const tipCents = Math.round(parseFloat(amount) * 100);
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error('You must be logged in to send a tip');
        return;
      }
      const effectiveCreatorId = creatorId || post?.user_id;
      const response = await fetch('/api/epoch/create-tip-payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: post?.id,
          amountCents: tipCents,
          creatorId: effectiveCreatorId,
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

  const handleUsPaymateTip = async () => {
    const tipCents = Math.round(parseFloat(amount) * 100);
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error('You must be logged in to send a tip');
        return;
      }
      const effectiveCreatorId = creatorId || post?.user_id;
      const response = await fetch('/api/uspaymate/create-tip-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: post?.id,
          amountCents: tipCents,
          creatorId: effectiveCreatorId,
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

  const startStripeTip = async () => {
    const tipCents = Math.round(parseFloat(amount) * 100);
    setIsLoading(true);
    try {
      const effectiveCreatorId = creatorId || post?.user_id;
      const response = await fetch('/api/stripe/create-tip-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          post?.id
            ? { postId: post.id, amountCents: tipCents }
            : { creatorId: effectiveCreatorId, amountCents: tipCents }
        ),
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

  const finalizeStripeTip = async (paymentIntentId: string) => {
    const tipCents = Math.round(parseFloat(amount) * 100);
    const effectiveCreatorId = creatorId || post?.user_id;
    const response = await fetch('/api/stripe/create-tip-transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postId: post?.id,
        creatorId: effectiveCreatorId,
        paymentIntentId,
        amountCents: tipCents,
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      toast.error((err as { error?: string }).error || 'Failed to record tip');
      return;
    }
    toast.success('Tip sent successfully');
    handleSuccess(tipCents);
  };

  const handleClose = () => {
    setAmount('');
    setAmountError(null);
    setSelectedPreset(null);
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

  const handleSuccess = (amount: number) => {
    onTipSuccess?.(amount);
    onPaymentSuccess?.();
    handleClose();
  };

  const formatAmount = (cents: number) => {
    return formatUsdWithCreditsSuffix(cents, creditOnlyEcosystem, pricePerCreditCents);
  };

  const inputPreviewTipCents = (() => {
    const parsed = parseFloat(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.round(parsed * 100);
  })();

  const dialogTitle = showPaymentSelection
    ? 'Choose payment'
    : showStripePayment
      ? 'Card payment'
      : showOnyxCardForm
        ? 'Enter card'
        : 'Send a tip';

  const dialogDescription = showPaymentSelection
    ? `You're tipping ${formatAmount(amountCents)}. Pick how you'd like to pay.`
    : creditOnlyEcosystem
      ? 'Support this creator using your credit balance.'
      : 'Show appreciation — tips go directly to the creator.';

  const footer =
    !showPaymentSelection && !showStripePayment && !showOnyxCardForm && creditMetaLoaded ? (
      <>
        <Button type="button" variant="outline" className={brandCancelBtn} onClick={handleClose}>
          Cancel
        </Button>
        <Button type="button" className={brandPrimaryBtn} onClick={handleOpen} disabled={isLoading}>
          {isLoading
            ? 'Please wait…'
            : creditOnlyEcosystem
              ? 'Send tip'
              : 'Continue'}
        </Button>
      </>
    ) : showPaymentSelection && !showStripePayment && !showOnyxCardForm ? (
      <Button type="button" variant="outline" className={cn(brandCancelBtn, 'w-full sm:w-auto')} onClick={handleBackToSelection}>
        Back
      </Button>
    ) : undefined;

  return (
    <BrandDialogShell
      open={isOpen}
      onOpenChange={(open) => !open && handleClose()}
      icon={DollarSign}
      title={dialogTitle}
      description={dialogDescription}
      size={showPaymentSelection ? 'wide' : 'default'}
      footer={footer}
    >
      {!showPaymentSelection ? (
        !creditMetaLoaded ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
            <p className="text-sm">Loading…</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Quick amounts
              </p>
              <div className="flex flex-wrap gap-2">
                {TIP_PRESETS_CENTS.map((cents) => {
                  const active = selectedPreset === cents;
                  return (
                    <button
                      key={cents}
                      type="button"
                      onClick={() => {
                        setSelectedPreset(cents);
                        setAmount((cents / 100).toFixed(cents % 100 === 0 ? 0 : 2));
                        setAmountError(null);
                      }}
                      className={cn(
                        'rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors',
                        active
                          ? 'border-transparent text-[var(--brand-on-accent)] [background:var(--brand-grad)] [box-shadow:var(--brand-ring-money)]'
                          : 'border-border bg-card text-foreground hover:border-[var(--brand-pink)]/40'
                      )}
                    >
                      {formatTipPreset(cents)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="tip-amount" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Custom amount
              </label>
              <div
                className={cn(
                  'flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 focus-within:ring-2 focus-within:ring-[var(--brand-violet)]/30',
                  amountError && 'border-destructive'
                )}
                style={{ background: 'var(--brand-surface)' }}
              >
                <span className="text-lg font-semibold text-muted-foreground">$</span>
                <Input
                  id="tip-amount"
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => {
                    setSelectedPreset(null);
                    setAmount(e.target.value);
                  }}
                  className="h-auto border-0 bg-transparent p-0 text-2xl font-semibold shadow-none focus-visible:ring-0"
                />
              </div>
              {creditOnlyEcosystem && inputPreviewTipCents != null && inputPreviewTipCents > 0 && (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground" aria-live="polite">
                  <Coins className="h-4 w-4 shrink-0" style={{ color: 'var(--brand-gold)' }} />
                  {formatUsdWithCreditsSuffix(inputPreviewTipCents, true, pricePerCreditCents)}
                </p>
              )}
              {amountError && <p className="text-sm text-destructive">{amountError}</p>}
            </div>
          </>
        )
      ) : showStripePayment && stripeClientSecret ? (
        <StripePaymentInline
          clientSecret={stripeClientSecret}
          amountLabel={`Tip: ${formatAmount(amountCents)}`}
          onSuccess={finalizeStripeTip}
          onCancel={() => {
            setShowStripePayment(false);
            setStripeClientSecret(null);
          }}
        />
      ) : showOnyxCardForm ? (
        <OnyxCardForm
          amountLabel={`Tip: ${formatAmount(amountCents)}`}
          billing={profileBilling}
          showSaveCard={true}
          onSubmit={handleOnyxCardPay}
          onCancel={() => setShowOnyxCardForm(false)}
          isLoading={isLoading}
        />
      ) : (
        <div className="space-y-3">
          <div
            className="rounded-xl border border-border px-4 py-3 text-center"
            style={{ background: 'var(--brand-surface)' }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tip total</p>
            <p className="mt-1 font-display text-2xl text-foreground">{formatAmount(amountCents)}</p>
          </div>
          {fiatPaymentProcessor === 'onyx' && (
            <>
              {savedPaymentMethods.map((pm) => (
                <button
                  key={pm.id}
                  type="button"
                  className={paymentMethodBtn}
                  onClick={() => handlePayWithSavedCard(pm.onyx_payment_method_id)}
                  disabled={isLoading}
                >
                  <CreditCard className="h-5 w-5 shrink-0" style={{ color: 'var(--brand-violet)' }} />
                  <span className="flex-1 font-mono text-sm">•••• {pm.last4}</span>
                  <span className="text-xs capitalize text-muted-foreground">{pm.brand || 'Card'}</span>
                  {pm.is_default && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">Default</span>
                  )}
                </button>
              ))}
              <button
                type="button"
                className={paymentMethodBtnAccent}
                onClick={handlePayWithCardClick}
                disabled={isLoading}
              >
                <CreditCard className="h-5 w-5 shrink-0" />
                <span className="flex flex-col items-start">
                  <span className="text-sm font-semibold">
                    {savedPaymentMethods.length > 0 ? 'Pay with new card' : 'Pay with card'}
                  </span>
                  <span className="text-xs opacity-90">Onyx — credit or debit</span>
                </span>
              </button>
            </>
          )}
          {fiatPaymentProcessor === 'moonpay' && (
            <button type="button" className={paymentMethodBtnAccent} onClick={handleMoonpayPayment} disabled={isLoading}>
              <Wallet className="h-5 w-5 shrink-0" />
              <span className="flex flex-col items-start">
                <span className="text-sm font-semibold">Pay with MoonPay</span>
                <span className="text-xs opacity-90">USDC, ETH, SOL & more</span>
              </span>
            </button>
          )}
          {fiatPaymentProcessor === 'stripe' && (
            <button type="button" className={paymentMethodBtnAccent} onClick={startStripeTip} disabled={isLoading}>
              <CreditCard className="h-5 w-5 shrink-0" />
              <span className="flex flex-col items-start">
                <span className="text-sm font-semibold">Pay with card</span>
                <span className="text-xs opacity-90">Stripe</span>
              </span>
            </button>
          )}
          {fiatPaymentProcessor === 'epoch' && (
            <button type="button" className={paymentMethodBtn} onClick={handleEpochTip} disabled={isLoading}>
              <CreditCard className="h-5 w-5 shrink-0" style={{ color: 'var(--brand-violet)' }} />
              <span className="flex flex-col items-start">
                <span className="text-sm font-semibold">Continue to checkout</span>
                <span className="text-xs text-muted-foreground">Epoch</span>
              </span>
            </button>
          )}
          {profile?.isAdmin && (
            <button
              type="button"
              className={cn(paymentMethodBtn, 'border-amber-500/40 bg-amber-500/10')}
              onClick={async () => {
                try {
                  setIsLoading(true);
                  await handleAdminTestTip(amountCents);
                } catch (e) {
                  console.error(e);
                  toast.error(e instanceof Error ? e.message : 'Admin test tip failed');
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={isLoading}
            >
              <Shield className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <span className="flex flex-col items-start">
                <span className="text-sm font-semibold">Admin test (no charge)</span>
                <span className="text-xs text-muted-foreground">Bypass payment for testing</span>
              </span>
            </button>
          )}
        </div>
      )}
    </BrandDialogShell>
  );
} 