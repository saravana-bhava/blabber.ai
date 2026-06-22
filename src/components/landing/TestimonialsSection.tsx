'use client';

import { Heart, Star } from 'lucide-react';
import { InView } from './InView';
import { VerifiedBadge, displayFont } from './_atoms';
import { TESTIMONIALS } from './_data';
import { MockAvatarChip } from './_mocks';

export function TestimonialsSection() {
  return (
    <section className="land-band-light py-14 sm:py-[76px]">
      <div className="max-w-[1140px] mx-auto px-4 sm:px-[34px]">
        <InView className="text-center mb-8 sm:mb-10">
          <span className="land-pill bg-card border border-border text-foreground text-[12.5px] mb-4 px-3 py-1.5">
            <Heart size={13} className="text-[var(--brand-pink)]" /> Creator stories
          </span>
          <h2 style={{ ...displayFont, fontSize: 'clamp(28px, 5vw, 50px)', letterSpacing: '-0.03em' }}>
            Creators are earning more
          </h2>
        </InView>

        <div className="land-why-grid grid grid-cols-1 md:grid-cols-3 gap-[18px]">
          {TESTIMONIALS.map((it, i) => (
            <InView key={it.handle} delay={i * 80}>
              <div className="bg-card border border-border rounded-[20px] p-6 sm:p-[26px] h-full flex flex-col">
                <div className="flex gap-0.5 mb-4 text-[var(--brand-gold)]">
                  {[0, 1, 2, 3, 4].map(s => <Star key={s} size={16} fill="currentColor" strokeWidth={0} />)}
                </div>
                <p className="text-[15.5px] leading-relaxed flex-1 mb-5">&ldquo;{it.quote}&rdquo;</p>
                <div className="flex items-center gap-[11px]">
                  <MockAvatarChip handle={it.handle} />
                  <div>
                    <div className="flex items-center gap-1 font-bold text-sm">
                      {it.name} <VerifiedBadge size={12} />
                    </div>
                    <div className="text-[12.5px] text-muted-foreground">{it.meta}</div>
                  </div>
                </div>
              </div>
            </InView>
          ))}
        </div>
      </div>
    </section>
  );
}
