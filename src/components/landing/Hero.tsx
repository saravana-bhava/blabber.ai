'use client';

import { Play, Sparkles } from 'lucide-react';
import { InView } from './InView';
import { GradientText, LandingPrimaryCta, displayFont } from './_atoms';
import { FeedShowcase } from './_mocks';
import { scrollToId } from './_utils';

const TRUST = ['90% to creators', 'True AI voice cloning', '18+ age-verified'];

export function Hero({ onWaitlist }: { onWaitlist: () => void }) {
  return (
    <section className="relative max-w-[1180px] mx-auto px-4 sm:px-7 pt-28 sm:pt-[150px] pb-8 sm:pb-10 text-center overflow-x-hidden">
      <div
        className="land-aurora"
        style={{ top: -60, left: '10%', width: 360, height: 360, background: 'var(--brand-violet)', opacity: 0.16 }}
      />
      <div
        className="land-aurora"
        style={{ top: 0, right: '8%', width: 420, height: 420, background: 'var(--brand-pink)', opacity: 0.15, animationDirection: 'reverse', animationDuration: '26s' }}
      />

      <InView className="relative" threshold={0.05}>
        <span className="land-pill [background:var(--brand-grad-soft)] text-[var(--brand-pink)] mb-5 sm:mb-[22px] px-3.5 py-[7px] text-[13px]">
          <Sparkles size={14} /> Now onboarding creators in waves
        </span>

        <h1
          className="mx-auto mb-5 sm:mb-[22px] max-w-[900px]"
          style={{ ...displayFont, fontSize: 'clamp(36px, 8vw, 88px)', lineHeight: 0.98, letterSpacing: '-0.04em' }}
        >
          Creator Economy <GradientText>2.0</GradientText>
        </h1>

        <p className="text-base sm:text-[clamp(17px,2.2vw,21px)] text-muted-foreground max-w-[600px] mx-auto mb-7 sm:mb-8 leading-normal">
          The all-in-one monetization platform for modern creators — with true AI voice cloning, monetized messaging, and the lowest fees in the industry.
        </p>

        <div className="flex gap-2.5 sm:gap-3 justify-center flex-wrap mb-4 sm:mb-[18px]">
          <LandingPrimaryCta
            onWaitlist={onWaitlist}
            liveLabel="Join free"
            className="h-12 sm:h-[54px] px-6 sm:px-[30px] text-sm sm:text-[15.5px]"
          />
          <button type="button" onClick={() => scrollToId('realai')} className="land-btn-line h-12 sm:h-[54px] px-5 sm:px-[26px] text-sm sm:text-[15.5px]">
            <Play size={15} fill="currentColor" strokeWidth={0} /> See it in action
          </button>
        </div>

        <div className="flex gap-2 justify-center flex-wrap text-muted-foreground text-[13px] font-semibold">
          {TRUST.map((t, i) => (
            <span key={t} className="inline-flex items-center gap-2">
              {i > 0 && <span className="opacity-40">·</span>}
              {t}
            </span>
          ))}
        </div>
      </InView>

      <InView delay={120} className="relative mt-10 sm:mt-[54px] min-w-0 w-full">
        <FeedShowcase />
      </InView>
    </section>
  );
}
