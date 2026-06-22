'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { InView } from '@/components/landing/InView';
import { Eyebrow, displayFont } from '@/components/landing/_atoms';
import { LandingPageShell } from '@/components/landing/LandingPageShell';
import { cn } from '@/lib/utils';

export function LandingDocPage({ children }: { children: ReactNode }) {
  return (
    <LandingPageShell>
      <main className="max-w-[900px] mx-auto px-4 sm:px-[34px] pt-28 pb-14 sm:pt-32 sm:pb-[84px]">
        {children}
      </main>
    </LandingPageShell>
  );
}

export function LandingDocHeader({
  eyebrow = 'Legal',
  title,
  description,
  updated,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  updated?: string;
}) {
  return (
    <InView className="text-center mb-8 sm:mb-10">
      <Eyebrow color="var(--brand-pink)">{eyebrow}</Eyebrow>
      <h1
        style={{
          ...displayFont,
          fontSize: 'clamp(28px, 4.5vw, 44px)',
          letterSpacing: '-0.03em',
        }}
      >
        {title}
      </h1>
      {description ? (
        <p className="text-muted-foreground text-base sm:text-[17px] mt-3.5 max-w-2xl mx-auto leading-relaxed">
          {description}
        </p>
      ) : null}
      {updated ? (
        <p className="text-sm text-muted-foreground mt-3">Last updated: {updated}</p>
      ) : null}
    </InView>
  );
}

export function LandingDocBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <InView delay={60}>
      <div
        className={cn(
          'rounded-[22px] border border-border bg-card px-5 sm:px-8 py-6 sm:py-8',
          className,
        )}
      >
        <div className="landing-doc-prose">{children}</div>
      </div>
    </InView>
  );
}

export function LandingDocPanel({
  children,
  className,
  delay = 100,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <InView delay={delay}>
      <div
        className={cn(
          'rounded-[22px] border border-border bg-card px-5 sm:px-8 py-6 sm:py-8',
          className,
        )}
      >
        {children}
      </div>
    </InView>
  );
}

export function LandingDocSuccess({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <LandingDocPage>
      <InView className="text-center">
        <div
          className="mx-auto max-w-md rounded-[22px] border border-border bg-card px-6 py-10"
          style={{ boxShadow: 'var(--brand-ring-money)' }}
        >
          <div
            className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl text-[var(--brand-on-accent)]"
            style={{ background: 'var(--brand-grad)', boxShadow: 'var(--brand-ring-money)' }}
          >
            <Icon className="h-7 w-7" aria-hidden />
          </div>
          <h2 className="font-display text-2xl font-extrabold tracking-tight">{title}</h2>
          <p className="text-muted-foreground mt-2 mb-6 leading-relaxed">{description}</p>
          {action}
        </div>
      </InView>
    </LandingDocPage>
  );
}
