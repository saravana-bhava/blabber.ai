'use client';

import type { LucideIcon } from 'lucide-react';
import { Play } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUser } from '@/lib/contexts/user-context';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  AdminCard,
  AdminGhostButton,
  AdminGradButton,
  AdminLoadingSpinner,
  AdminSectionTitle,
} from '@/components/admin/admin-ui';

export function OnboardingPageBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'brand-form max-w-[720px] mx-auto w-full min-w-0 px-5 md:px-6 py-5 pb-16',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function OnboardingLoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <OnboardingPageBody>
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <AdminLoadingSpinner className="min-h-[120px]" />
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </OnboardingPageBody>
  );
}

export function OnboardingErrorState({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <OnboardingPageBody>
      <AdminCard>
        <div className="text-center space-y-4">
          <p className="text-sm text-destructive rounded-2xl px-4 py-3 border border-destructive/20 bg-destructive/10">
            {error}
          </p>
          <AdminGradButton onClick={onRetry}>Try again</AdminGradButton>
        </div>
      </AdminCard>
    </OnboardingPageBody>
  );
}

type OnboardingHeroProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel: string;
  onCta: () => void;
  loading?: boolean;
  statusMessage?: { type: 'error' | 'info'; text: string };
};

export function OnboardingHero({
  icon: Icon,
  title,
  description,
  ctaLabel,
  onCta,
  loading,
  statusMessage,
}: OnboardingHeroProps) {
  return (
    <OnboardingPageBody>
      <AdminCard className="overflow-hidden p-0">
        <div className="px-6 pt-7 pb-6 text-center" style={{ background: 'var(--brand-grad-soft)' }}>
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-[var(--brand-on-accent)]"
            style={{ background: 'var(--brand-grad)', boxShadow: 'var(--brand-ring-money)' }}
          >
            <Icon className="h-6 w-6" aria-hidden />
          </div>
          <h2 className="font-display text-xl tracking-tight">{title}</h2>
          <p className="text-muted-foreground text-sm mt-1.5 max-w-md mx-auto leading-relaxed">
            {description}
          </p>
        </div>
        <div className="p-6 flex flex-col items-center gap-4">
          {statusMessage ? (
            <p
              className={cn(
                'text-sm text-center rounded-2xl px-4 py-2.5 w-full',
                statusMessage.type === 'error'
                  ? 'text-destructive bg-destructive/10 border border-destructive/20'
                  : 'text-[var(--brand-violet)] bg-secondary border border-border',
              )}
            >
              {statusMessage.text}
            </p>
          ) : null}
          <AdminGradButton onClick={onCta} disabled={loading} className="min-w-[220px]">
            {loading ? 'Processing…' : ctaLabel}
          </AdminGradButton>
        </div>
      </AdminCard>
    </OnboardingPageBody>
  );
}

type OnboardingStepCardProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function OnboardingStepCard({ title, description, children, footer }: OnboardingStepCardProps) {
  return (
    <OnboardingPageBody>
      <AdminCard>
        <AdminSectionTitle title={title} description={description} />
        <div className="space-y-4">{children}</div>
        {footer ? <div className="mt-5">{footer}</div> : null}
      </AdminCard>
    </OnboardingPageBody>
  );
}

export function OnboardingVideoPlaceholder({ caption }: { caption?: string }) {
  return (
    <div
      className="aspect-video w-full rounded-2xl bg-secondary flex flex-col items-center justify-center gap-3 text-muted-foreground border border-dashed border-border"
      aria-label="Video placeholder"
    >
      <Play className="h-12 w-12 opacity-50" />
      <p className="text-sm font-semibold">Video placeholder</p>
      {caption ? <p className="text-xs text-center px-4">{caption}</p> : null}
    </div>
  );
}

type OnboardingAgreementProps = {
  title: string;
  children: React.ReactNode;
  checkboxId: string;
  checkboxLabel: string;
  accepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  loading?: boolean;
};

export function OnboardingAgreement({
  title,
  children,
  checkboxId,
  checkboxLabel,
  accepted,
  onAcceptedChange,
  onCancel,
  onConfirm,
  confirmLabel = 'Next',
  loading,
}: OnboardingAgreementProps) {
  return (
    <OnboardingPageBody>
      <AdminCard>
        <AdminSectionTitle title={title} />
        <div className="rounded-2xl bg-secondary border border-border p-5 space-y-4 max-h-80 overflow-y-auto text-sm leading-relaxed">
          {children}
        </div>
        <div className="flex items-start gap-3 mt-5">
          <Checkbox
            id={checkboxId}
            checked={accepted}
            onCheckedChange={(checked) => onAcceptedChange(checked === true)}
            className="mt-0.5 data-[state=checked]:[background:var(--brand-grad)] data-[state=checked]:border-transparent"
          />
          <Label htmlFor={checkboxId} className="text-sm cursor-pointer select-none leading-snug font-normal">
            {checkboxLabel}
          </Label>
        </div>
        <div className="flex gap-3 mt-5">
          <AdminGhostButton onClick={onCancel} className="flex-1">
            Cancel
          </AdminGhostButton>
          <AdminGradButton
            onClick={onConfirm}
            disabled={!accepted || loading}
            className="flex-1"
          >
            {loading ? 'Processing…' : confirmLabel}
          </AdminGradButton>
        </div>
      </AdminCard>
    </OnboardingPageBody>
  );
}

export function OnboardingAgreementSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="font-semibold text-foreground">{title}</p>
      <div className="text-muted-foreground">{children}</div>
    </div>
  );
}

type OnboardingVeriffRedirectProps = {
  onError: (message: string) => void;
  endpoint: string;
  body: Record<string, unknown>;
  onUpdated?: (data: unknown) => void;
};

export function OnboardingVeriffRedirect({
  onError,
  endpoint,
  body,
  onUpdated,
}: OnboardingVeriffRedirectProps) {
  const { profile } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const startedRef = useRef(false);
  const bodyKey = useMemo(() => JSON.stringify(body), [body]);

  const startVerification = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (!profile?.id) {
      startedRef.current = false;
      onError('User profile not loaded.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyKey,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to create verification session' }));
        throw new Error(errorData.error || 'Failed to create verification session');
      }

      const data = await response.json();
      const { sessionUrl, creator, agency } = data;
      onUpdated?.(creator ?? agency ?? data);

      window.location.href = sessionUrl;
    } catch (error: unknown) {
      console.error('Error starting Veriff verification:', error);
      startedRef.current = false;
      onError(error instanceof Error ? error.message : 'Failed to start identity verification');
      setIsLoading(false);
    }
  }, [profile?.id, endpoint, bodyKey, onError, onUpdated]);

  useEffect(() => {
    void startVerification();
  }, [startVerification]);

  return (
    <OnboardingPageBody>
      <AdminCard>
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          {isLoading ? (
            <>
              <div
                className="h-12 w-12 rounded-full border-2 border-[var(--brand-pink)] border-t-transparent animate-spin"
                role="status"
                aria-label="Preparing verification"
              />
              <div className="text-center space-y-1">
                <p className="font-semibold">Preparing identity verification…</p>
                <p className="text-sm text-muted-foreground">You will be redirected to Veriff shortly</p>
              </div>
            </>
          ) : (
            <div className="text-center space-y-4">
              <p className="font-semibold">Ready to start verification</p>
              <AdminGradButton onClick={() => void startVerification()}>Start verification</AdminGradButton>
            </div>
          )}
        </div>
      </AdminCard>
    </OnboardingPageBody>
  );
}
