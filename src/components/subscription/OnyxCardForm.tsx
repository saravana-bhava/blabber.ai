'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreditCard, Loader2, Lock } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

export interface OnyxCardFormData {
  number: string;
  exp_month: string;
  exp_year: string;
  cvc: string;
}

export interface OnyxBillingFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

/** Placeholder billing sent to processor when we only collect card details */
export const PLACEHOLDER_BILLING: OnyxBillingFormData = {
  first_name: 'Customer',
  last_name: 'User',
  email: '',
  phone_number: '1',
  address: 'N/A',
  city: 'N/A',
  state: 'N/A',
  zip: '00000',
};

interface OnyxCardFormProps {
  amountLabel: string;
  /** Pre-fill optional; form only collects card number, expiry, CVV */
  billing?: Partial<OnyxBillingFormData> | null;
  /** Show "Save this card for future use" (subscriptions/rebilling) */
  showSaveCard?: boolean;
  onSubmit: (card: OnyxCardFormData, billing?: OnyxBillingFormData, saveCard?: boolean) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  variant?: 'default' | 'branded';
  hideAmountLabel?: boolean;
  hideCancel?: boolean;
}

function formatCardNumber(value: string): string {
  const v = value.replace(/\s/g, '').replace(/\D/g, '').slice(0, 19);
  return v.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

function formatExpiry(value: string): string {
  const v = value.replace(/\D/g, '').slice(0, 4);
  if (v.length >= 2) return `${v.slice(0, 2)}/${v.slice(2)}`;
  return v;
}

const brandedInputClass =
  'h-11 rounded-[12px] border-border/70 bg-background focus-visible:border-[var(--brand-pink)] focus-visible:ring-[var(--brand-pink)]/20';

export function OnyxCardForm({
  amountLabel,
  billing,
  showSaveCard = false,
  onSubmit,
  onCancel,
  isLoading,
  variant = 'default',
  hideAmountLabel = false,
  hideCancel = false,
}: OnyxCardFormProps) {
  const [number, setNumber] = useState('');
  const [exp, setExp] = useState('');
  const [cvc, setCvc] = useState('');
  const [saveCard, setSaveCard] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const branded = variant === 'branded';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const rawNumber = number.replace(/\s/g, '');
    if (rawNumber.length < 13) {
      setError('Enter a valid card number');
      return;
    }
    const [mm, yy] = exp.split('/');
    if (!mm || !yy || mm.length !== 2 || yy.length !== 2) {
      setError('Enter expiry as MM/YY');
      return;
    }
    if (cvc.length < 3) {
      setError('Enter a valid CVV');
      return;
    }
    const card: OnyxCardFormData = {
      number: rawNumber,
      exp_month: mm,
      exp_year: yy.length === 2 ? yy : yy.slice(-2),
      cvc,
    };
    const billingData: OnyxBillingFormData = {
      ...PLACEHOLDER_BILLING,
      first_name: billing?.first_name?.trim() || PLACEHOLDER_BILLING.first_name,
      last_name: billing?.last_name?.trim() || PLACEHOLDER_BILLING.last_name,
      email: billing?.email?.trim() || PLACEHOLDER_BILLING.email,
    };
    try {
      await onSubmit(card, billingData, showSaveCard ? saveCard : undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-4', branded && 'space-y-3.5')}>
      {!hideAmountLabel && (
        <p className={cn('text-sm text-muted-foreground', branded && 'sr-only')}>{amountLabel}</p>
      )}

      {branded && (
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Card details
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="onyx-card-number" className={cn(branded && 'text-xs font-semibold text-muted-foreground')}>
          Card number
        </Label>
        <div className="relative">
          <CreditCard className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="onyx-card-number"
            placeholder="1234 5678 9012 3456"
            value={number}
            onChange={(e) => setNumber(formatCardNumber(e.target.value))}
            maxLength={19}
            autoComplete="cc-number"
            className={cn(branded && brandedInputClass, branded && 'pl-10 font-mono tracking-wide')}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="space-y-2">
          <Label htmlFor="onyx-exp" className={cn(branded && 'text-xs font-semibold text-muted-foreground')}>
            Expiry
          </Label>
          <Input
            id="onyx-exp"
            placeholder="MM/YY"
            value={exp}
            onChange={(e) => setExp(formatExpiry(e.target.value))}
            maxLength={5}
            autoComplete="cc-exp"
            className={cn(branded && brandedInputClass, branded && 'font-mono')}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="onyx-cvc" className={cn(branded && 'text-xs font-semibold text-muted-foreground')}>
            CVV
          </Label>
          <Input
            id="onyx-cvc"
            placeholder="123"
            value={cvc}
            onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
            maxLength={4}
            autoComplete="cc-csc"
            className={cn(branded && brandedInputClass, branded && 'font-mono')}
          />
        </div>
      </div>

      {showSaveCard && (
        <div
          className={cn(
            'flex items-start gap-2.5',
            branded && 'rounded-[12px] border border-border/60 bg-secondary/40 px-3.5 py-3'
          )}
        >
          <Checkbox
            id="onyx-save-card"
            checked={saveCard}
            onCheckedChange={(checked) => setSaveCard(checked === true)}
            className="mt-0.5"
          />
          <Label htmlFor="onyx-save-card" className="cursor-pointer text-sm font-normal leading-snug">
            Save card for faster checkout next time
          </Label>
        </div>
      )}

      {error && (
        <p className="rounded-[10px] bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      <div className={cn('flex gap-2', branded && 'flex-col gap-2.5 pt-0.5')}>
        {branded ? (
          <button
            type="submit"
            disabled={isLoading}
            className={cn(
              'flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-white transition-[filter,transform]',
              'disabled:pointer-events-none disabled:opacity-50',
              'hover:brightness-110 active:scale-[0.98]'
            )}
            style={{ background: 'var(--brand-grad)', boxShadow: 'var(--brand-ring-money)' }}
          >
            {isLoading ? (
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
            {!hideCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isLoading}
                className="inline-flex h-9 flex-1 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium shadow-xs hover:bg-accent disabled:opacity-50"
              >
                Back
              </button>
            )}
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex h-9 flex-1 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Pay'}
            </button>
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
