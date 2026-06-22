'use client';

import { useEffect, useState } from 'react';
import { DollarSign, Eye, Lock, Star, Unlock, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  BrandDialogShell,
  BrandInfoRow,
  brandCancelBtn,
  brandPrimaryBtn,
} from '@/components/feed/brand-dialog-shell';
import { PurchasePriceSummary } from '@/components/payments/brand-payment-ui';
import { cn } from '@/lib/utils';

const PPV_PRESETS_CENTS = [300, 500, 1000, 1500, 2500] as const;

function formatPresetLabel(cents: number) {
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}

type SubscriberOnlyDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function SubscriberOnlyDialog({
  open,
  onOpenChange,
  onConfirm,
}: SubscriberOnlyDialogProps) {
  return (
    <BrandDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Users}
      title="Subscribers only"
      description="Lock this post behind your subscription. Everyone else sees a preview."
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            className={brandCancelBtn}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" className={brandPrimaryBtn} onClick={onConfirm}>
            Enable for subscribers
          </Button>
        </>
      }
    >
      <ul className="space-y-3" role="list">
        <BrandInfoRow icon={Lock}>
          Only active subscribers can view the full post.
        </BrandInfoRow>
        <BrandInfoRow icon={Eye}>
          Non-subscribers still see a preview so they know what they are missing.
        </BrandInfoRow>
        <BrandInfoRow icon={Users}>
          Works alongside your subscription price — no extra setup per post.
        </BrandInfoRow>
      </ul>
    </BrandDialogShell>
  );
}

type PpvPriceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPriceCents?: number | null;
  onConfirm: (priceCents: number) => void;
};

export function PpvPriceDialog({
  open,
  onOpenChange,
  initialPriceCents,
  onConfirm,
}: PpvPriceDialogProps) {
  const [draftDollars, setDraftDollars] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initialPriceCents && initialPriceCents > 0) {
      setDraftDollars((initialPriceCents / 100).toFixed(2));
      setSelectedPreset(
        PPV_PRESETS_CENTS.some((p) => p === initialPriceCents) ? initialPriceCents : null
      );
    } else {
      setDraftDollars('');
      setSelectedPreset(null);
    }
  }, [open, initialPriceCents]);

  const priceCents = (() => {
    const value = parseFloat(draftDollars);
    if (Number.isNaN(value) || value <= 0) return null;
    return Math.round(value * 100);
  })();

  const isValid = priceCents !== null && priceCents >= 1;

  const handlePreset = (cents: number) => {
    setSelectedPreset(cents);
    setDraftDollars((cents / 100).toFixed(cents % 100 === 0 ? 0 : 2));
  };

  const handleDraftChange = (raw: string) => {
    setSelectedPreset(null);
    setDraftDollars(raw);
  };

  return (
    <BrandDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={DollarSign}
      title="Pay-per-view"
      description="Set a one-time price for fans who are not subscribed to unlock this post."
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            className={brandCancelBtn}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className={brandPrimaryBtn}
            disabled={!isValid}
            onClick={() => priceCents && onConfirm(priceCents)}
          >
            Set unlock price
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Quick amounts
        </p>
        <div className="flex flex-wrap gap-2">
          {PPV_PRESETS_CENTS.map((cents) => {
            const active = selectedPreset === cents;
            return (
              <button
                key={cents}
                type="button"
                onClick={() => handlePreset(cents)}
                className={cn(
                  'rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors',
                  active
                    ? 'border-transparent text-[var(--brand-on-accent)] [background:var(--brand-grad)] [box-shadow:var(--brand-ring-money)]'
                    : 'border-border bg-card text-foreground hover:border-[var(--brand-pink)]/40'
                )}
              >
                {formatPresetLabel(cents)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="ppv-price-input" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Custom price
        </label>
        <div
          className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 focus-within:ring-2 focus-within:ring-[var(--brand-violet)]/30"
          style={{ boxShadow: isValid ? 'var(--brand-ring-money)' : undefined }}
        >
          <span className="text-lg font-semibold text-muted-foreground">$</span>
          <Input
            id="ppv-price-input"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={draftDollars}
            onChange={(e) => handleDraftChange(e.target.value)}
            className="h-auto border-0 bg-transparent p-0 text-2xl font-semibold shadow-none focus-visible:ring-0"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {isValid
            ? `Fans pay ${formatPresetLabel(priceCents!)} once to unlock this post.`
            : 'Enter at least $0.01 to continue.'}
        </p>
      </div>
    </BrandDialogShell>
  );
}

type FeedSubscribeGateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creatorName: string;
  priceLabel: string;
  intervalLabel: string;
  onContinue: () => void;
  isLoading?: boolean;
};

/** Viewer-facing: subscribe to unlock locked feed content. */
export function FeedSubscribeGateDialog({
  open,
  onOpenChange,
  creatorName,
  priceLabel,
  intervalLabel,
  onContinue,
  isLoading = false,
}: FeedSubscribeGateDialogProps) {
  return (
    <BrandDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Star}
      title="Subscribers only"
      description={`Subscribe to ${creatorName} to unlock this post and their exclusive content.`}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            className={brandCancelBtn}
            onClick={() => onOpenChange(false)}
          >
            Not now
          </Button>
          <Button
            type="button"
            className={brandPrimaryBtn}
            onClick={onContinue}
            disabled={isLoading}
          >
            {isLoading ? 'Loading…' : 'Continue'}
          </Button>
        </>
      }
    >
      <PurchasePriceSummary
        icon={Star}
        priceLabel={priceLabel}
        subtitle={`Billed ${intervalLabel} · Cancel anytime`}
      />
      <ul className="space-y-3" role="list">
        <BrandInfoRow icon={Lock}>Full posts, videos, and shorts from this creator.</BrandInfoRow>
        <BrandInfoRow icon={Eye}>Your feed updates as soon as you subscribe.</BrandInfoRow>
      </ul>
    </BrandDialogShell>
  );
}

type FeedUnlockGateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creatorName: string;
  priceLabel: string;
  onContinue: () => void;
  isLoading?: boolean;
};

/** Viewer-facing: pay-per-view unlock for locked feed content. */
export function FeedUnlockGateDialog({
  open,
  onOpenChange,
  creatorName,
  priceLabel,
  onContinue,
  isLoading = false,
}: FeedUnlockGateDialogProps) {
  return (
    <BrandDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Unlock}
      title="Unlock this post"
      description={`One-time purchase from ${creatorName}. Content unlocks instantly after payment.`}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            className={brandCancelBtn}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className={brandPrimaryBtn}
            onClick={onContinue}
            disabled={isLoading}
          >
            {isLoading ? 'Loading…' : 'Continue to payment'}
          </Button>
        </>
      }
    >
      <PurchasePriceSummary
        icon={Unlock}
        priceLabel={priceLabel}
        subtitle="One-time unlock · Keep access forever"
      />
      <ul className="space-y-3" role="list">
        <BrandInfoRow icon={Lock}>Pay once to view the full post.</BrandInfoRow>
        <BrandInfoRow icon={Eye}>Secure checkout — no subscription required.</BrandInfoRow>
      </ul>
    </BrandDialogShell>
  );
}
