'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { InView } from './InView';
import { Eyebrow, displayFont } from './_atoms';
import { FAQS } from './_data';

export function FaqSection() {
  const [open, setOpen] = useState(0);

  return (
    <section id="faqs" className="max-w-[1140px] mx-auto px-4 sm:px-[34px] py-14 sm:py-[84px]">
      <div className="land-faq-grid grid grid-cols-1 md:grid-cols-[0.85fr_1.15fr] gap-8 sm:gap-12">
        <InView>
          <Eyebrow>Blabber AI FAQ</Eyebrow>
          <h2 style={{ ...displayFont, fontSize: 'clamp(30px, 5vw, 54px)', letterSpacing: '-0.03em', lineHeight: 1.02 }}>
            About Blabber AI
          </h2>
          <p className="text-muted-foreground text-base mt-4 leading-relaxed max-w-[320px]">
            Everything you need to know about the platform. Can&apos;t find an answer? Reach out any time.
          </p>
        </InView>

        <InView delay={100}>
          {FAQS.map((f, i) => {
            const on = open === i;
            return (
              <div key={f.q} className="border-b border-border">
                <button
                  type="button"
                  onClick={() => setOpen(on ? -1 : i)}
                  className="flex items-center gap-4 w-full text-left py-5 sm:py-[22px] bg-transparent border-none cursor-pointer"
                >
                  <span
                    className="flex-1 transition-colors duration-200"
                    style={{ ...displayFont, fontSize: 19, lineHeight: 1.25, color: on ? 'var(--foreground)' : 'var(--muted-foreground)' }}
                  >
                    {f.q}
                  </span>
                  <span
                    className="shrink-0 w-[30px] h-[30px] rounded-full border border-border grid place-items-center transition-[transform,color] duration-250"
                    style={{ color: on ? 'var(--brand-pink)' : 'var(--muted-foreground)', transform: on ? 'rotate(45deg)' : 'none' }}
                  >
                    <Plus size={16} />
                  </span>
                </button>
                <div
                  className="overflow-hidden transition-[max-height,opacity] duration-350 ease-out"
                  style={{ maxHeight: on ? 220 : 0, opacity: on ? 1 : 0 }}
                >
                  <p className="text-[15.5px] text-muted-foreground leading-relaxed pb-6 max-w-[560px]">{f.a}</p>
                </div>
              </div>
            );
          })}
        </InView>
      </div>
    </section>
  );
}
