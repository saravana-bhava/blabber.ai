'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { getStripe } from '@/lib/stripe/load-stripe';
import { Loader2, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

function Inner({
  amountLabel,
  onSuccess,
  onCancel,
  variant = 'default',
  hideAmountLabel = false,
  hideCancel = false,
}: {
  amountLabel?: string;
  onSuccess: (paymentIntentId: string) => void | Promise<void>;
  onCancel: () => void;
  variant?: 'default' | 'branded';
  hideAmountLabel?: boolean;
  hideCancel?: boolean;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const branded = variant === 'branded';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: 'if_required',
      });
      if (error) {
        const { toast } = await import('sonner');
        toast.error(error.message || 'Payment failed');
        return;
      }
      if (paymentIntent?.status === 'succeeded' && paymentIntent.id) {
        await onSuccess(paymentIntent.id);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className={cn('space-y-4', branded && 'space-y-3.5')}>
      {!hideAmountLabel && amountLabel ? (
        <p className={cn('text-sm text-muted-foreground', branded && 'sr-only')}>{amountLabel}</p>
      ) : null}

      {branded && (
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Payment details
        </p>
      )}

      <div
        className={cn(
          branded &&
            'rounded-[14px] border border-border/70 bg-background p-3.5 [&_.Input]:rounded-[10px]'
        )}
      >
        <PaymentElement
          options={
            branded
              ? {
                  layout: 'tabs',
                }
              : undefined
          }
        />
      </div>

      <div className={cn('flex gap-2', branded && 'flex-col gap-2.5')}>
        {branded ? (
          <button
            type="submit"
            disabled={!stripe || busy}
            className={cn(
              'flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-white transition-[filter,transform]',
              'disabled:pointer-events-none disabled:opacity-50',
              'hover:brightness-110 active:scale-[0.98]'
            )}
            style={{ background: 'var(--brand-grad)', boxShadow: 'var(--brand-ring-money)' }}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Lock className="h-3.5 w-3.5" />
                Pay securely
              </>
            )}
          </button>
        ) : (
          <>
            <button
              type="submit"
              disabled={!stripe || busy}
              className="inline-flex h-9 flex-1 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? 'Processing…' : 'Pay'}
            </button>
            {!hideCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={busy}
                className="inline-flex h-9 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium shadow-xs hover:bg-accent disabled:opacity-50"
              >
                Back
              </button>
            )}
          </>
        )}
      </div>

      {branded && (
        <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
          <Lock className="h-3 w-3 shrink-0" />
          Encrypted & secure · Credits added instantly
        </p>
      )}
    </form>
  );
}

export function StripePaymentInline({
  clientSecret,
  amountLabel,
  onSuccess,
  onCancel,
  variant = 'default',
  hideAmountLabel = false,
  hideCancel = false,
}: {
  clientSecret: string;
  amountLabel?: string;
  onSuccess: (paymentIntentId: string) => void | Promise<void>;
  onCancel: () => void;
  variant?: 'default' | 'branded';
  hideAmountLabel?: boolean;
  hideCancel?: boolean;
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
      <Inner
        amountLabel={amountLabel}
        onSuccess={onSuccess}
        onCancel={onCancel}
        variant={variant}
        hideAmountLabel={hideAmountLabel}
        hideCancel={hideCancel}
      />
    </Elements>
  );
}
