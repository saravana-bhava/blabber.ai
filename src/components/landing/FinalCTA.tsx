'use client';

import Link from 'next/link';
import { InView } from './InView';
import { LandingPrimaryCta, displayFont } from './_atoms';
import { useBetaMode } from '@/lib/contexts/beta-mode-context';

export function FinalCTA({ onWaitlist }: { onWaitlist: () => void }) {
  const isBeta = useBetaMode();

  return (
    <section className="max-w-[1140px] mx-auto px-4 sm:px-[34px] pb-14 sm:pb-20">
      <InView>
        <div className="relative overflow-hidden rounded-[28px] border border-border bg-secondary px-6 sm:px-[34px] py-12 sm:py-[60px] text-center">
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[520px] h-[320px] [background:var(--brand-grad)] opacity-16 blur-[90px] pointer-events-none" />
          <div className="relative">
            <h2 className="mb-3.5" style={{ ...displayFont, fontSize: 'clamp(28px, 5vw, 48px)', letterSpacing: '-0.03em' }}>
              {isBeta ? 'Join the beta waitlist' : 'Start creating on Blabber'}
            </h2>
            <p className="text-base sm:text-[17px] text-muted-foreground max-w-[480px] mx-auto mb-7 leading-relaxed">
              {isBeta
                ? "Drop your email and socials — we're onboarding creators in waves and will be in touch when your spot opens up."
                : 'Free to join. Set up your profile, connect with fans, and start earning with subscriptions, messaging, and AI.'}
            </p>
            {isBeta ? (
              <LandingPrimaryCta onWaitlist={onWaitlist} className="h-12 sm:h-[54px] px-7 sm:px-[34px] text-base" />
            ) : (
              <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                <Link
                  href="/signup"
                  className="land-btn-beta no-underline inline-flex items-center justify-center h-12 sm:h-[54px] px-7 sm:px-[34px] text-base"
                >
                  Join free
                </Link>
                <Link
                  href="/login"
                  className="land-btn-line no-underline inline-flex items-center justify-center h-12 sm:h-[54px] px-6 text-base"
                >
                  Log in
                </Link>
              </div>
            )}
          </div>
        </div>
      </InView>
    </section>
  );
}
