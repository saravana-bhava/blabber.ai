'use client';

import { Lock, Star, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { brandPrimaryBtn } from '@/components/feed/brand-dialog-shell';
import { cn } from '@/lib/utils';
import type { PostAccessLevel } from '@/lib/types';

export const brandPaywallOverlayBtn = cn(
  brandPrimaryBtn,
  'h-10 px-6 text-sm font-bold shadow-md hover:brightness-110'
);

/** Locked feed media — tinted surface + visible edge in dark mode */
export const feedPaywallFrameClass = cn(
  'mt-0 overflow-hidden rounded-lg border border-border relative',
  'bg-muted [background-image:var(--brand-grad-soft)]',
  'dark:border-white/20 dark:bg-secondary'
);

/** Empty preview behind lock icon (no blurred thumbnail) */
export const feedPaywallPlaceholderClass = cn(
  'absolute inset-0 flex items-center justify-center',
  'bg-muted/90 [background-image:var(--brand-grad-soft)]',
  'dark:bg-secondary/80'
);

type FeedPaywallActionsProps = {
  accessLevel: PostAccessLevel;
  ppvPriceLabel?: string;
  onSubscribe: (e: React.MouseEvent) => void;
  onUnlock: (e: React.MouseEvent) => void;
  isCheckingSubscription?: boolean;
  isCheckingPPV?: boolean;
  isLoadingCreator?: boolean;
  pulseEnabled?: boolean;
  className?: string;
};

export function FeedPaywallActions({
  accessLevel,
  ppvPriceLabel,
  onSubscribe,
  onUnlock,
  isCheckingSubscription = false,
  isCheckingPPV = false,
  isLoadingCreator = false,
  pulseEnabled = false,
  className,
}: FeedPaywallActionsProps) {
  return (
    <div className={cn('text-white text-center', className)}>
      {accessLevel === 'subscribers_only' && (
        <Button
          type="button"
          className={cn(brandPaywallOverlayBtn, pulseEnabled && 'pulse-money-btn')}
          onClick={onSubscribe}
          disabled={isLoadingCreator || isCheckingSubscription}
        >
          <Star size={16} className="mr-2 shrink-0" aria-hidden />
          {isLoadingCreator || isCheckingSubscription ? 'Loading…' : 'Subscribe to view'}
        </Button>
      )}
      {accessLevel === 'ppv' && ppvPriceLabel && (
        <Button
          type="button"
          className={cn(brandPaywallOverlayBtn, pulseEnabled && 'pulse-money-btn')}
          onClick={onUnlock}
          disabled={isCheckingPPV}
        >
          <Unlock size={16} className="mr-2 shrink-0" aria-hidden />
          {isCheckingPPV ? 'Loading…' : `Unlock · ${ppvPriceLabel}`}
        </Button>
      )}
    </div>
  );
}

export function FeedPaywallOverlay({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'absolute inset-0 flex items-center justify-center backdrop-blur-[2px]',
        'bg-foreground/20 dark:bg-background/55',
        className
      )}
    >
      {children}
    </div>
  );
}

export function FeedPaywallPlaceholder({
  children,
}: {
  children?: React.ReactNode;
}) {
  return (
    <div className={feedPaywallPlaceholderClass}>
      {children ?? <FeedPaywallLockIcon />}
    </div>
  );
}

export function FeedPaywallLockIcon() {
  return <Lock size={32} className="text-foreground/55 dark:text-white/80" aria-hidden />;
}
