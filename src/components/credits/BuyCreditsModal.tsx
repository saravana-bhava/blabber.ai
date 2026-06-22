'use client';

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { createClient } from '@/lib/supabase/client';
import {
  ArrowLeft,
  ChevronRight,
  Coins,
  CreditCard,
  Loader2,
  Minus,
  Plus,
  Shield,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { useUser } from '@/lib/contexts/user-context';
import { useCreditMonetization } from '@/lib/contexts/credit-monetization-context';
import { toast } from 'sonner';
import { OnyxCardForm } from '@/components/subscription/OnyxCardForm';
import { StripePaymentInline } from '@/components/payments/StripePaymentInline';
import { AnimatedInteger } from '@/components/motion/AnimatedInteger';
import { cn } from '@/lib/utils';

interface CreditPackage {
  amount: number;
  price_cents: number;
}

/** List price in cents; falls back to amount × price_per_credit when bundle price is missing/zero. */
function resolvePackagePriceCents(pkg: CreditPackage, pricePerCreditCents: number): number {
  if (pkg.price_cents > 0) return pkg.price_cents;
  if (pricePerCreditCents > 0 && pkg.amount > 0) return pkg.amount * pricePerCreditCents;
  return 0;
}

function creditsToPriceCents(credits: number, pricePerCreditCents: number): number {
  if (!Number.isFinite(credits) || credits < 1 || pricePerCreditCents <= 0) return 0;
  return credits * pricePerCreditCents;
}

interface BuyCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: () => void;
}

function getBonusLabel(pkg: CreditPackage, pricePerCreditCents: number): string | null {
  if (!pricePerCreditCents || !pkg.amount) return null;
  const expectedCents = pkg.amount * pricePerCreditCents;
  const chargedCents = resolvePackagePriceCents(pkg, pricePerCreditCents);
  if (chargedCents >= expectedCents) return null;
  const bonusCredits = Math.round((expectedCents - chargedCents) / pricePerCreditCents);
  if (bonusCredits <= 0) return null;
  const pct = Math.round((bonusCredits / pkg.amount) * 100);
  return pct > 0 ? `+${pct}% bonus` : null;
}

function PaymentMethodCard({
  icon,
  title,
  subtitle,
  onClick,
  disabled,
  variant = 'default',
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'admin' | 'saved';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group flex w-full items-center gap-3.5 rounded-[14px] border p-4 text-left transition-all',
        'disabled:pointer-events-none disabled:opacity-50',
        variant === 'admin'
          ? 'border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/15'
          : variant === 'saved'
            ? 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50 hover:bg-emerald-500/10'
            : 'border-border/70 bg-background hover:border-[var(--brand-pink)] hover:bg-[var(--brand-grad-soft)]'
      )}
    >
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-white',
          variant === 'admin' && 'bg-amber-500',
          variant === 'saved' && 'bg-emerald-600',
          variant === 'default' && '[background:var(--brand-grad)]'
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold leading-tight">{title}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--brand-pink)]" />
    </button>
  );
}

const CUSTOM_STEP = 25;
const CUSTOM_MIN = 5;
const FALLBACK_QUICK_AMOUNTS = [100, 250, 500, 1000] as const;

function CustomAmountCard({
  value,
  packages,
  pricePerCreditCents,
  isLoading,
  disabled,
  onChange,
  onSubmit,
}: {
  value: string;
  packages: CreditPackage[];
  pricePerCreditCents: number;
  isLoading: boolean;
  disabled?: boolean;
  onChange: (next: string) => void;
  onSubmit: () => void;
}) {
  const quickAmounts = useMemo(() => {
    const fromPackages = packages
      .map((p) => p.amount)
      .filter((a) => a >= CUSTOM_MIN);
    const unique = [...new Set(fromPackages)].sort((a, b) => a - b);
    return unique.length > 0 ? unique : [...FALLBACK_QUICK_AMOUNTS];
  }, [packages]);

  const parsed = parseInt(value, 10);
  const credits = !isNaN(parsed) && parsed >= CUSTOM_MIN ? parsed : 0;
  const priceCents = creditsToPriceCents(credits, pricePerCreditCents);
  const canContinue = credits >= CUSTOM_MIN && priceCents > 0 && !disabled;
  const perCreditLabel =
    pricePerCreditCents > 0 ? `$${(pricePerCreditCents / 100).toFixed(2)} per credit` : null;

  const adjust = (delta: number) => {
    const current = !isNaN(parsed) && parsed >= CUSTOM_MIN ? parsed : CUSTOM_MIN;
    onChange(String(Math.max(CUSTOM_MIN, current + delta)));
  };

  return (
    <section className="pt-1">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Choose your own amount</h3>
          <p className="mt-0.5 text-[12px] text-muted-foreground leading-snug">
            {perCreditLabel ? (
              <>
                {perCreditLabel}
                <span className="text-muted-foreground/70"> · </span>
                min {CUSTOM_MIN} credits
              </>
            ) : (
              <>Minimum {CUSTOM_MIN} credits</>
            )}
          </p>
        </div>
        {priceCents > 0 && (
          <div className="text-right shrink-0">
            <div className="font-display text-xl font-extrabold tabular-nums leading-none">
              ${(priceCents / 100).toFixed(2)}
            </div>
            <div className="mt-0.5 text-[10px] font-semibold text-muted-foreground">total</div>
          </div>
        )}
      </div>

      <div
        className="rounded-[16px] border border-border/70 p-3"
        style={{ background: 'var(--brand-surface)' }}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Decrease credits"
            onClick={() => adjust(-CUSTOM_STEP)}
            disabled={disabled || credits <= CUSTOM_MIN}
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-border/70 bg-background transition-colors',
              'hover:border-[var(--brand-pink)] hover:text-[var(--brand-pink)]',
              'disabled:pointer-events-none disabled:opacity-35'
            )}
          >
            <Minus className="h-4 w-4" />
          </button>

          <label className="min-w-0 flex-1 text-center">
            <span className="sr-only">Credit amount</span>
            <input
              id="customAmount"
              type="number"
              inputMode="numeric"
              min={CUSTOM_MIN}
              placeholder={String(CUSTOM_MIN)}
              value={value}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') {
                  onChange('');
                  return;
                }
                const n = parseInt(raw, 10);
                if (!isNaN(n) && n >= 0) onChange(String(Math.min(n, 999999)));
              }}
              disabled={disabled}
              className={cn(
                'w-full bg-transparent text-center font-display text-[2.25rem] font-extrabold tabular-nums leading-none',
                'border-none outline-none placeholder:text-muted-foreground/30',
                '[-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
              )}
            />
            <span className="mt-1 block text-[11px] font-semibold text-muted-foreground">credits</span>
          </label>

          <button
            type="button"
            aria-label="Increase credits"
            onClick={() => adjust(CUSTOM_STEP)}
            disabled={disabled}
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-border/70 bg-background transition-colors',
              'hover:border-[var(--brand-pink)] hover:text-[var(--brand-pink)]',
              'disabled:pointer-events-none disabled:opacity-35'
            )}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(quickAmounts.length, 4)}, minmax(0, 1fr))` }}>
          {quickAmounts.map((amt) => {
            const chipPrice = creditsToPriceCents(amt, pricePerCreditCents);
            const selected = value === String(amt);
            return (
              <button
                key={amt}
                type="button"
                disabled={disabled}
                onClick={() => onChange(String(amt))}
                className={cn(
                  'flex flex-col items-center rounded-[12px] border px-1 py-2 transition-all',
                  selected
                    ? 'border-transparent text-white'
                    : 'border-border/60 bg-background text-foreground hover:border-[var(--brand-pink)]'
                )}
                style={selected ? { background: 'var(--brand-grad)' } : undefined}
              >
                <span className="text-[13px] font-bold tabular-nums leading-none">
                  {amt.toLocaleString()}
                </span>
                <span
                  className={cn(
                    'mt-0.5 text-[10px] font-semibold tabular-nums',
                    selected ? 'text-white/85' : 'text-muted-foreground'
                  )}
                >
                  {chipPrice > 0 ? `$${(chipPrice / 100).toFixed(2)}` : '—'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={!canContinue || isLoading}
        className={cn(
          'mt-3 flex h-11 w-full items-center justify-center rounded-full text-sm font-semibold text-white transition-[filter,transform]',
          'disabled:pointer-events-none disabled:opacity-40',
          'hover:brightness-110 active:scale-[0.98]'
        )}
        style={{
          background: 'var(--brand-grad)',
          boxShadow: canContinue ? 'var(--brand-ring-money)' : 'none',
        }}
      >
        {isLoading
          ? 'Processing…'
          : credits > 0
            ? `Continue · ${credits.toLocaleString()} credits`
            : 'Enter an amount to continue'}
      </button>
    </section>
  );
}

function OrderSummary({ credits, amountCents }: { credits: number; amountCents: number }) {
  return (
    <div
      className="rounded-[16px] border border-border/60 p-4"
      style={{ background: 'var(--brand-grad-soft)' }}
    >
      <div className="mb-3 flex items-center gap-2">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-[8px] text-white"
          style={{ background: 'var(--brand-grad)' }}
        >
          <Coins className="h-4 w-4" />
        </span>
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Order summary
        </span>
      </div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="font-display text-3xl font-extrabold tabular-nums leading-none">
            {credits.toLocaleString()}
          </div>
          <div className="mt-1 text-xs font-semibold text-muted-foreground">credits</div>
        </div>
        <div className="text-right">
          <div className="font-display text-2xl font-extrabold tabular-nums leading-none">
            ${(amountCents / 100).toFixed(2)}
          </div>
          <div className="mt-1 text-xs font-semibold text-muted-foreground">total</div>
        </div>
      </div>
    </div>
  );
}

export function BuyCreditsModal({ isOpen, onClose, onPaymentSuccess }: BuyCreditsModalProps) {
  const [creditPackages, setCreditPackages] = useState<CreditPackage[]>([]);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [selectedAmount, setSelectedAmount] = useState<number>(0);
  const [selectedCredits, setSelectedCredits] = useState<number>(0);
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
  const { profile } = useUser();
  const { fiatPaymentProcessor, pricePerCreditCents, loaded: creditMetaLoaded } =
    useCreditMonetization();

  const bestValueIndex = useMemo(() => {
    if (creditPackages.length < 2 || pricePerCreditCents <= 0) return -1;
    return creditPackages.reduce((bestIdx, pkg, idx, arr) => {
      const priceA = resolvePackagePriceCents(pkg, pricePerCreditCents);
      const priceB = resolvePackagePriceCents(arr[bestIdx], pricePerCreditCents);
      if (priceA <= 0) return bestIdx;
      const ratioA = pkg.amount / priceA;
      const ratioB = priceB > 0 ? arr[bestIdx].amount / priceB : 0;
      return ratioA > ratioB ? idx : bestIdx;
    }, 0);
  }, [creditPackages, pricePerCreditCents]);

  const handleAdminTestCredits = async () => {
    const response = await fetch('/api/admin/bypass-credit-purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        credits: selectedCredits,
        amountCents: selectedAmount,
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || 'Admin test credit purchase failed');
    }
    toast.success('Admin test: credits added (no charge)');
    onPaymentSuccess();
    handleClose();
  };

  useEffect(() => {
    const fetchSettings = async () => {
      const { data: packagesData } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'credit_packages')
        .single();

      if (packagesData?.value) {
        const parsed = JSON.parse(packagesData.value) as CreditPackage[];
        if (Array.isArray(parsed)) {
          setCreditPackages([...parsed].sort((a, b) => a.amount - b.amount));
        }
      }
    };

    if (isOpen) {
      fetchSettings();
    }
  }, [isOpen]);

  const handlePackageSelect = async (pkg: CreditPackage, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      toast.error('You must be logged in to purchase credits');
      return;
    }

    const priceCents = resolvePackagePriceCents(pkg, pricePerCreditCents);
    if (priceCents <= 0) {
      toast.error('Pricing is not configured. Please try again later.');
      return;
    }

    setSelectedAmount(priceCents);
    setSelectedCredits(pkg.amount);
    setShowPaymentSelection(true);
  };

  const handleCustomAmountSubmit = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const amount = parseInt(customAmount, 10);
    if (isNaN(amount) || amount < CUSTOM_MIN) {
      toast.error(`Minimum purchase amount is ${CUSTOM_MIN} credits`);
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      toast.error('You must be logged in to purchase credits');
      return;
    }

    const priceCents = creditsToPriceCents(amount, pricePerCreditCents);
    if (priceCents <= 0) {
      toast.error('Pricing is not configured. Please try again later.');
      return;
    }

    setSelectedAmount(priceCents);
    setSelectedCredits(amount);
    setShowPaymentSelection(true);
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
      setSavedPaymentMethods((methods as typeof savedPaymentMethods) || []);
    })();
  }, [showPaymentSelection, isOpen]);

  const handleOnyxCardPay = async (card: { number: string; exp_month: string; exp_year: string; cvc: string }, billing?: { first_name: string; last_name: string; email: string }, saveCard?: boolean) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      toast.error('You must be logged in to purchase credits');
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
        transactionType: 'credit',
        amountCents: selectedAmount,
        metadata: {
          userId: session.user.id,
          transactionType: 'credit',
          amountCents: selectedAmount,
          credits: String(selectedCredits),
        },
        card,
        billing,
        returnUrl,
      };
      // GOAT scaffold doesn't yet support saved cards; only forward on Onyx.
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
        toast.info(data.message || 'Payment is processing. We\u2019ll add your credits as soon as it settles.');
        handleClose();
        return;
      }
      if (data.status === 'success') {
        toast.success('Credits added successfully');
        onPaymentSuccess();
        handleClose();
      }
    } catch {
      toast.error('Payment failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayWithCardClick = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCardFormProcessor('onyx');
    setShowOnyxCardForm(true);
  };

  const handlePayWithGoatCardClick = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCardFormProcessor('goat');
    setShowOnyxCardForm(true);
  };

  const handlePayWithSavedCard = async (onyxPaymentMethodId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      toast.error('You must be logged in to purchase credits');
      return;
    }
    setIsLoading(true);
    try {
      const returnUrl = window.location.href;
      const response = await fetch('/api/onyx/process-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionType: 'credit',
          amountCents: selectedAmount,
          metadata: {
            userId: session.user.id,
            transactionType: 'credit',
            amountCents: selectedAmount,
            credits: String(selectedCredits),
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
        toast.success('Credits added successfully');
        if (data.saved_card_error) {
          toast.warning(data.saved_card_error);
        }
        onPaymentSuccess();
        handleClose();
      }
    } catch {
      toast.error('Payment failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMoonpayPayment = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error('You must be logged in to purchase credits');
        return;
      }

      const response = await fetch('/api/moonpay/create-credit-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: selectedAmount,
          userId: session.user.id,
          credits: selectedCredits,
        }),
      });

      if (!response.ok) throw new Error('Failed to create checkout session');

      const data = await response.json();

      const params = new URLSearchParams({
        type: 'credit',
        transactionId: data.transactionId,
      });

      window.location.href = `/crypto-payment?${params.toString()}`;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create checkout session';
      toast.error(errorMessage);

      if (errorMessage.includes('Transaction still pending')) {
        handleClose();
        window.location.href = '/transactions';
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEpochCredits = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error('You must be logged in to purchase credits');
        return;
      }
      const response = await fetch('/api/epoch/create-credit-payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: selectedAmount,
          userId: session.user.id,
          credits: selectedCredits,
          returnUrl: window.location.href,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || 'Failed to create payment link');
        return;
      }
      if (data.paymentUrl) window.location.href = data.paymentUrl;
    } catch (err) {
      console.error(err);
      toast.error('Failed to start checkout');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUsPaymateCredits = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error('You must be logged in to purchase credits');
        return;
      }
      const response = await fetch('/api/uspaymate/create-credit-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: selectedAmount,
          userId: session.user.id,
          credits: selectedCredits,
          returnUrl: window.location.href,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || 'Failed to create checkout session');
        return;
      }
      if (data.paymentUrl) window.location.href = data.paymentUrl;
    } catch (err) {
      console.error(err);
      toast.error('Failed to start checkout');
    } finally {
      setIsLoading(false);
    }
  };

  const startStripeCredits = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error('You must be logged in to purchase credits');
        return;
      }
      const response = await fetch('/api/stripe/create-credit-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: selectedAmount,
          userId: session.user.id,
          credits: selectedCredits,
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
    } catch (err) {
      console.error(err);
      toast.error('Failed to start card payment');
    } finally {
      setIsLoading(false);
    }
  };

  const finalizeStripeCredits = async (paymentIntentId: string) => {
    const response = await fetch('/api/stripe/complete-credit-purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentIntentId }),
    });
    const data = await response.json();
    if (!response.ok) {
      toast.error(data.error || 'Failed to add credits');
      return;
    }
    toast.success('Credits added successfully');
    onPaymentSuccess();
    handleClose();
  };

  const handleClose = () => {
    setShowPaymentSelection(false);
    setShowOnyxCardForm(false);
    setShowStripePayment(false);
    setStripeClientSecret(null);
    setCustomAmount('');
    onClose();
  };

  const handleBackToSelection = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setShowPaymentSelection(false);
    setShowStripePayment(false);
    setStripeClientSecret(null);
    setShowOnyxCardForm(false);
  };

  const dialogTitle = showStripePayment || showOnyxCardForm
    ? 'Complete payment'
    : showPaymentSelection
      ? 'Choose payment method'
      : 'Top up credits';

  const dialogDescription = showStripePayment || showOnyxCardForm
    ? 'Enter your card details below. Credits are added to your balance instantly.'
    : showPaymentSelection
      ? 'Pick how you want to pay. Your credits will be ready right away.'
      : 'Add credits to your balance — spend them on subscriptions, tips, pay-per-view, and AI calls.';

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent
        className="gap-0 overflow-hidden rounded-[20px] border-border/60 p-0 sm:max-w-[440px] !translate-x-[-50%] !translate-y-[-50%] !top-[50%] !left-[50%]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Branded header strip */}
        <div
          className="relative px-6 pt-6 pb-5"
          style={{ background: 'var(--brand-grad-soft)' }}
        >
          {(showPaymentSelection || showOnyxCardForm || showStripePayment) && (
            <button
              type="button"
              onClick={showOnyxCardForm || showStripePayment ? () => {
                setShowOnyxCardForm(false);
                setShowStripePayment(false);
                setStripeClientSecret(null);
              } : handleBackToSelection}
              className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
          )}

          <DialogHeader className="gap-2 text-left">
            <div className="flex items-start gap-3">
              <span
                className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] text-white shadow-sm"
                style={{ background: 'var(--brand-grad)', boxShadow: 'var(--brand-ring-money)' }}
              >
                <Coins className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <DialogTitle className="font-display text-xl font-extrabold tracking-tight">
                  {dialogTitle}
                </DialogTitle>
                <DialogDescription className="mt-1 text-[13px] leading-snug">
                  {dialogDescription}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {!showPaymentSelection && !showOnyxCardForm && !showStripePayment && profile && (
            <div className="mt-4 flex items-center justify-between rounded-[12px] border border-border/50 bg-background/80 px-3.5 py-2.5 backdrop-blur-sm">
              <span className="text-xs font-semibold text-muted-foreground">Current balance</span>
              <span className="font-display text-lg font-extrabold tabular-nums">
                <AnimatedInteger value={profile.credits ?? 0} />
                <span className="ml-1 text-xs font-semibold text-muted-foreground">credits</span>
              </span>
            </div>
          )}
        </div>

        <div className="px-6 py-5">
          {showStripePayment && stripeClientSecret ? (
            <div className="space-y-4">
              <OrderSummary credits={selectedCredits} amountCents={selectedAmount} />
              <StripePaymentInline
                clientSecret={stripeClientSecret}
                amountLabel={`${selectedCredits} credits — $${(selectedAmount / 100).toFixed(2)}`}
                onSuccess={finalizeStripeCredits}
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
              <OrderSummary credits={selectedCredits} amountCents={selectedAmount} />
              <OnyxCardForm
                amountLabel={`${selectedCredits} credits — $${(selectedAmount / 100).toFixed(2)}`}
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
                  <OrderSummary credits={selectedCredits} amountCents={selectedAmount} />

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
                          onClick={() => handlePayWithCardClick()}
                          disabled={isLoading}
                        />
                      </>
                    )}

                    {fiatPaymentProcessor === 'moonpay' && (
                      <PaymentMethodCard
                        icon={<Wallet className="h-[18px] w-[18px]" />}
                        title="Pay with MoonPay"
                        subtitle="USDC, ETH, SOL & more"
                        onClick={() => handleMoonpayPayment()}
                        disabled={isLoading}
                      />
                    )}

                    {fiatPaymentProcessor === 'stripe' && (
                      <PaymentMethodCard
                        icon={<CreditCard className="h-[18px] w-[18px]" />}
                        title="Pay with card"
                        subtitle="Stripe — credit or debit card"
                        onClick={() => startStripeCredits()}
                        disabled={isLoading}
                      />
                    )}

                    {fiatPaymentProcessor === 'epoch' && (
                      <PaymentMethodCard
                        icon={<CreditCard className="h-[18px] w-[18px]" />}
                        title="Continue to checkout"
                        subtitle="Epoch secure checkout"
                        onClick={() => handleEpochCredits()}
                        disabled={isLoading}
                      />
                    )}

                    {fiatPaymentProcessor === 'uspaymate' && (
                      <PaymentMethodCard
                        icon={<CreditCard className="h-[18px] w-[18px]" />}
                        title="Continue to checkout"
                        subtitle="Pay by Card"
                        onClick={() => handleUsPaymateCredits()}
                        disabled={isLoading}
                      />
                    )}

                    {fiatPaymentProcessor === 'goat' && (
                      <PaymentMethodCard
                        icon={<CreditCard className="h-[18px] w-[18px]" />}
                        title="Pay with card"
                        subtitle="GOAT Payments — credit or debit card"
                        onClick={() => handlePayWithGoatCardClick()}
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
                            await handleAdminTestCredits();
                          } catch (err) {
                            console.error(err);
                            toast.error(err instanceof Error ? err.message : 'Admin test purchase failed');
                          } finally {
                            setIsLoading(false);
                          }
                        }}
                        disabled={isLoading}
                      />
                    )}
                  </div>

                  <p className="text-center text-[11px] text-muted-foreground">
                    Secure checkout · Credits added instantly
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {!creditMetaLoaded ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
                  <p className="text-sm">Loading packages…</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2.5">
                    {creditPackages.map((pkg, idx) => {
                      const isFeatured = idx === bestValueIndex;
                      const packagePriceCents = resolvePackagePriceCents(pkg, pricePerCreditCents);
                      const bonus = getBonusLabel(pkg, pricePerCreditCents);

                      return (
                        <button
                          key={pkg.amount}
                          type="button"
                          onClick={(e) => handlePackageSelect(pkg, e)}
                          className={cn(
                            'relative flex flex-col items-center rounded-[16px] border px-3 py-4 text-center transition-all',
                            'hover:border-[var(--brand-pink)] active:scale-[0.98]',
                            isFeatured
                              ? 'border-transparent'
                              : 'border-border/70 bg-background hover:bg-[var(--brand-grad-soft)]'
                          )}
                          style={
                            isFeatured
                              ? {
                                  background: 'var(--brand-grad-soft)',
                                  boxShadow: 'var(--brand-ring-money)',
                                }
                              : undefined
                          }
                        >
                          {isFeatured && (
                            <span
                              className="absolute -top-2.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white whitespace-nowrap"
                              style={{ background: 'var(--brand-grad)' }}
                            >
                              <Sparkles className="h-2.5 w-2.5" />
                              Best value
                            </span>
                          )}
                          <div
                            className="mb-2 flex h-9 w-9 items-center justify-center rounded-[9px]"
                            style={{
                              background: isFeatured ? 'var(--brand-grad)' : 'var(--brand-grad-soft)',
                              color: isFeatured ? '#fff' : 'var(--brand-gold)',
                            }}
                          >
                            <Coins className="h-4 w-4" />
                          </div>
                          <div className="font-display text-2xl font-extrabold tabular-nums leading-none">
                            {pkg.amount.toLocaleString()}
                          </div>
                          <div className="mt-0.5 text-[11px] font-semibold text-muted-foreground">
                            credits
                          </div>
                          {bonus ? (
                            <div
                              className="mt-1.5 text-[10.5px] font-bold"
                              style={{ color: 'var(--brand-pink)' }}
                            >
                              {bonus}
                            </div>
                          ) : (
                            <div className="mt-1.5 h-[15px]" />
                          )}
                          <div className="mt-2 font-display text-lg font-extrabold tabular-nums">
                            ${(packagePriceCents / 100).toFixed(2)}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <CustomAmountCard
                    value={customAmount}
                    packages={creditPackages}
                    pricePerCreditCents={pricePerCreditCents}
                    isLoading={isLoading}
                    disabled={!creditMetaLoaded || pricePerCreditCents <= 0}
                    onChange={setCustomAmount}
                    onSubmit={() => handleCustomAmountSubmit()}
                  />
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
