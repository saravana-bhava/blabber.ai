'use client';

import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export function PaymentMethodCard({
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
            : 'border-border/70 bg-background hover:border-[var(--brand-pink)] hover:bg-[var(--brand-grad-soft)]',
      )}
    >
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-white',
          variant === 'admin' && 'bg-amber-500',
          variant === 'saved' && 'bg-emerald-600',
          variant === 'default' && '[background:var(--brand-grad)]',
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

export function BrandPaymentDialogHeader({
  icon: Icon,
  title,
  description,
  showBack,
  onBack,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  showBack?: boolean;
  onBack?: () => void;
}) {
  return (
    <div className="relative px-6 pt-6 pb-5" style={{ background: 'var(--brand-grad-soft)' }}>
      {showBack && onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
      ) : null}

      <DialogHeader className="gap-2 text-left">
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] text-white shadow-sm"
            style={{ background: 'var(--brand-grad)', boxShadow: 'var(--brand-ring-money)' }}
          >
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <DialogTitle className="font-display text-xl font-extrabold tracking-tight">{title}</DialogTitle>
            <DialogDescription className="mt-1 text-[13px] leading-snug">{description}</DialogDescription>
          </div>
        </div>
      </DialogHeader>
    </div>
  );
}

export function PurchasePriceSummary({
  priceLabel,
  subtitle,
  icon: Icon,
}: {
  priceLabel: string;
  subtitle: string;
  icon: LucideIcon;
}) {
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
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Purchase summary</span>
      </div>
      <div className="text-center">
        <div className="font-display text-3xl font-extrabold tabular-nums leading-none">{priceLabel}</div>
        <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

export function BrandPaymentContinueButton({
  children,
  onClick,
  disabled,
  loading,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'flex h-11 w-full items-center justify-center rounded-full text-sm font-semibold text-white transition-[filter,transform]',
        'disabled:pointer-events-none disabled:opacity-40',
        'hover:brightness-110 active:scale-[0.98]',
      )}
      style={{
        background: 'var(--brand-grad)',
        boxShadow: disabled ? 'none' : 'var(--brand-ring-money)',
      }}
    >
      {loading ? 'Processing…' : children}
    </button>
  );
}

export const brandPaymentDialogContentClass =
  'gap-0 overflow-hidden rounded-[20px] border-border/60 p-0 sm:max-w-[440px] !translate-x-[-50%] !translate-y-[-50%] !top-[50%] !left-[50%]';
