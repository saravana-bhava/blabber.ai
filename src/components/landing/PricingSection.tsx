'use client';

import { InView } from './InView';
import { Eyebrow, LandingPrimaryCta, displayFont } from './_atoms';
import { PRICING_ROWS } from './_data';

export function PricingSection({ onWaitlist }: { onWaitlist: () => void }) {
  return (
    <section id="pricing" className="max-w-[1140px] mx-auto px-4 sm:px-[34px] pt-5 pb-14 sm:pb-[84px]">
      <InView className="text-center mb-8 sm:mb-10">
        <Eyebrow color="var(--brand-pink)">Pricing</Eyebrow>
        <h2 style={{ ...displayFont, fontSize: 'clamp(28px, 5vw, 50px)', letterSpacing: '-0.03em' }}>
          The lowest fees in the industry
        </h2>
        <p className="text-muted-foreground text-base sm:text-[17px] mt-3.5">
          No monthly fees. No setup costs. You only pay when you earn.
        </p>
      </InView>

      <InView delay={80}>
        <div className="max-w-[720px] mx-auto border border-border rounded-[22px] overflow-hidden bg-card">
          <div className="hidden sm:flex px-6 py-4 bg-secondary border-b border-border text-[12.5px] font-bold tracking-[.04em] uppercase text-muted-foreground">
            <span className="flex-1">Revenue type</span>
            <span className="w-[130px] text-right">You keep</span>
            <span className="w-[180px] text-right">Detail</span>
          </div>
          {PRICING_ROWS.map(([l, k, d]) => (
            <div key={l} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0 px-4 sm:px-6 py-4 border-b border-border">
              <span className="flex-1 font-semibold text-[15px]">{l}</span>
              <span className="font-display text-xl sm:text-[22px] text-[var(--brand-pink)] sm:w-[130px] sm:text-right">{k}</span>
              <span className="text-[13px] text-muted-foreground sm:w-[180px] sm:text-right">{d}</span>
            </div>
          ))}
          <div className="p-5 sm:p-[22px] text-center">
            <LandingPrimaryCta onWaitlist={onWaitlist} className="h-12 px-7 text-[15px]" />
          </div>
        </div>
      </InView>
    </section>
  );
}
