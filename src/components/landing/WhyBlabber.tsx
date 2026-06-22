'use client';

import { Coins, Lock, Sparkles } from 'lucide-react';
import { InView } from './InView';
import { displayFont } from './_atoms';
import { WHY_CARDS } from './_data';

const ICONS = { lock: Lock, sparkles: Sparkles, coins: Coins };

export function WhyBlabber() {
  return (
    <section id="why" className="land-band-light py-14 sm:py-[76px]">
      <div className="max-w-[1140px] mx-auto px-4 sm:px-[34px]">
        <InView className="flex gap-8 sm:gap-12 items-end flex-wrap mb-10 sm:mb-11">
          <div className="flex-1 min-w-[280px]">
            <span className="land-pill bg-card border border-border text-foreground text-[12.5px] mb-[18px] px-3 py-1.5">
              <Sparkles size={13} className="text-[var(--brand-pink)]" /> Why Blabber?
            </span>
            <h2 style={{ ...displayFont, fontSize: 'clamp(30px, 5vw, 56px)', lineHeight: 1.02, letterSpacing: '-0.03em' }}>
              Built for creators, powered by AI
            </h2>
          </div>
          <p className="flex-1 min-w-[280px] text-base sm:text-lg text-muted-foreground leading-relaxed">
            Blabber is the first creator platform with true AI voice cloning for calls, monetized messaging, and a built-in marketplace. Our multimodal AI remembers every fan, every conversation — text or voice. And with the lowest fees, you keep more of what you earn.
          </p>
        </InView>

        <div className="land-why-grid grid grid-cols-1 md:grid-cols-3 gap-[18px]">
          {WHY_CARDS.map((c, i) => {
            const Ic = ICONS[c.icon];
            return (
              <InView key={c.title} delay={i * 80}>
                <div className="bg-card border border-border rounded-[20px] p-6 sm:p-7 h-full">
                  <div className="w-12 h-12 rounded-[14px] border border-border grid place-items-center mb-5">
                    <Ic size={22} />
                  </div>
                  <div className="font-display text-xl mb-2">{c.title}</div>
                  <p className="text-muted-foreground text-[14.5px] leading-relaxed">{c.desc}</p>
                </div>
              </InView>
            );
          })}
        </div>
      </div>
    </section>
  );
}
