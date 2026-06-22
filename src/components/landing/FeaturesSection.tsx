'use client';

import { Check } from 'lucide-react';
import { InView } from './InView';
import { Eyebrow, LandingPrimaryCta, displayFont } from './_atoms';
import { FEATURE_ROWS } from './_data';
import { AIMock, DashboardMock, StoreMock } from './_mocks';

const MOCKS = { dashboard: DashboardMock, ai: AIMock, store: StoreMock };

function FeatureRow({
  eyebrow, title, body, bullets, flip, mock, onWaitlist,
}: (typeof FEATURE_ROWS)[number] & { onWaitlist: () => void }) {
  const Mock = MOCKS[mock];
  return (
    <InView className="max-w-[1140px] mx-auto px-4 sm:px-[34px] py-10 sm:py-[60px]">
      <div className={`land-feat-row flex gap-8 sm:gap-14 items-center ${flip ? 'flex-col-reverse md:flex-row-reverse' : 'flex-col md:flex-row'}`}>
        <div className="flex-1 min-w-0">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="mb-[18px]" style={{ ...displayFont, fontSize: 'clamp(28px, 4.5vw, 52px)', lineHeight: 1.04, letterSpacing: '-0.03em' }}>
            {title}
          </h2>
          <p className="text-base sm:text-[17px] text-muted-foreground leading-relaxed mb-5 sm:mb-[22px] max-w-[460px]">{body}</p>
          <div className="flex flex-col gap-[11px] mb-6 sm:mb-7">
            {bullets.map(b => (
              <div key={b} className="flex items-center gap-[11px] text-[15px] font-medium">
                <span className="w-[22px] h-[22px] rounded-full [background:var(--brand-grad-soft)] grid place-items-center text-[var(--brand-pink)] shrink-0">
                  <Check size={13} strokeWidth={3} />
                </span>
                {b}
              </div>
            ))}
          </div>
          <LandingPrimaryCta onWaitlist={onWaitlist} className="h-12 px-6 text-sm" />
        </div>
        <div className="flex-1 min-w-0 w-full overflow-hidden">
          <Mock />
        </div>
      </div>
    </InView>
  );
}

export function FeaturesSection({ onWaitlist }: { onWaitlist: () => void }) {
  return (
    <section id="realai">
      <InView className="text-center max-w-[760px] mx-auto px-4 sm:px-7 pt-10 sm:pt-[60px] pb-2.5">
        <h2 style={{ ...displayFont, fontSize: 'clamp(28px, 5vw, 50px)', letterSpacing: '-0.03em', lineHeight: 1.05 }}>
          The creator platform, reinvented
        </h2>
        <p className="text-base sm:text-[17px] text-muted-foreground mt-3.5 leading-relaxed">
          Everything you need to earn — subscriptions, messaging, calls, and a store — supercharged by AI that never sleeps.
        </p>
      </InView>
      {FEATURE_ROWS.map(row => (
        <FeatureRow key={row.id} {...row} onWaitlist={onWaitlist} />
      ))}
    </section>
  );
}
