'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Coins, Heart, Phone, Sparkles, Video } from 'lucide-react';
import { InView } from './InView';
import { AIBadge, Eyebrow, GradientText, LandingPrimaryCta, VerifiedBadge, displayFont } from './_atoms';
import { VOICE_FEATURES } from './_data';

const ICONS = { sparkles: Sparkles, coins: Coins, heart: Heart };
const BARS = [0.5, 0.8, 0.35, 1, 0.6, 0.9, 0.45, 0.75, 0.55, 0.95, 0.4, 0.7];

export function VoiceCallDemo({ onWaitlist }: { onWaitlist: () => void }) {
  const [secs, setSecs] = useState(73);
  const [credits, setCredits] = useState(1820);

  useEffect(() => {
    const t = setInterval(() => {
      setSecs(s => s + 1);
      setCredits(c => c + 25);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const mmss = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

  return (
    <section id="voice" className="relative overflow-hidden py-12 sm:py-[70px]">
      <div
        className="land-aurora"
        style={{ top: '10%', left: '-6%', width: 460, height: 460, background: 'var(--brand-violet)', opacity: 0.16, animationDuration: '22s' }}
      />
      <div className="max-w-[1140px] mx-auto px-4 sm:px-[34px]">
        <div className="land-voice-row flex gap-10 sm:gap-[60px] items-center flex-col md:flex-row">
          <InView className="flex-1 min-w-0">
            <Eyebrow color="var(--brand-pink)">The Blabber difference</Eyebrow>
            <h2 className="mb-5" style={{ ...displayFont, fontSize: 'clamp(30px, 5vw, 58px)', lineHeight: 1.02, letterSpacing: '-0.03em' }}>
              Your voice, earning <GradientText>while you sleep</GradientText>
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed mb-6 sm:mb-[26px] max-w-[480px]">
              Clone your voice once. Then your AI persona takes live calls and answers DMs in your exact tone — billed by the minute, remembering every fan. It&apos;s you, scaled infinitely.
            </p>
            <div className="flex flex-col gap-3.5 mb-7 sm:mb-[30px]">
              {VOICE_FEATURES.map(([t, d, icon]) => {
                const Ic = ICONS[icon];
                return (
                  <div key={t} className="flex gap-3 items-start">
                    <span className="w-[38px] h-[38px] rounded-[11px] [background:var(--brand-grad-soft)] grid place-items-center text-[var(--brand-pink)] shrink-0">
                      <Ic size={18} />
                    </span>
                    <div>
                      <div className="font-bold text-[15px]">{t}</div>
                      <div className="text-[13.5px] text-muted-foreground mt-0.5">{d}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <LandingPrimaryCta
              onWaitlist={onWaitlist}
              betaLabel="CLONE YOUR VOICE → JOIN BETA"
              liveLabel="Clone your voice → Join free"
              className="h-12 px-6 text-sm sm:text-[14.5px]"
            />
          </InView>

          <InView delay={120} className="flex-1 min-w-0 w-full">
            <div className="relative w-full max-w-[300px] mx-auto">
              <div className="absolute -inset-[30px] [background:var(--brand-grad)] opacity-35 blur-[60px] rounded-[60px] pointer-events-none" />
              <div className="relative rounded-[42px] p-3 bg-[#0c0810] border border-white/14 shadow-2xl">
                <div
                  className="land-ph rounded-[32px] overflow-hidden relative h-[480px] sm:h-[540px]"
                  style={{ '--ph-a': 'oklch(0.42 0.18 320)', '--ph-b': 'oklch(0.34 0.18 285)' } as React.CSSProperties}
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-[rgba(10,6,16,0.2)] to-[rgba(10,6,16,0.78)]" />
                  <div className="relative h-full flex flex-col items-center px-6 pt-10 pb-7 text-white">
                    <span className="land-pill bg-white/16 text-white text-[11px] font-bold backdrop-blur-sm mb-6">
                      <AIBadge small /> AI VOICE CALL
                    </span>
                    <div className="relative mb-[18px]">
                      {[0, 0.6, 1.2].map(d => (
                        <span
                          key={d}
                          className="absolute inset-0 rounded-full border-2 border-white/50 land-pulse-ring"
                          style={{ animationDelay: `${d}s` }}
                        />
                      ))}
                      <div className="relative w-[104px] h-[104px] rounded-full overflow-hidden border-2 border-white/30">
                        <Image
                          src="/avatars/hero-sienna.jpg"
                          alt="Sienna Vale"
                          fill
                          className="object-cover object-[center_20%]"
                          sizes="104px"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-1 font-bold text-lg">Sienna Vale <VerifiedBadge size={15} /></div>
                    <div className="text-[13px] opacity-70 mb-5">speaking in her own cloned voice…</div>
                    <div className="flex items-center gap-1 h-[46px] text-white mb-5">
                      {BARS.map((h, i) => (
                        <span key={i} className="land-wavebar" style={{ height: 46 * h, animationDelay: `${i * 0.08}s` }} />
                      ))}
                    </div>
                    <div className="flex gap-2.5 mb-auto">
                      <span className="land-pill bg-black/40 text-white text-xs backdrop-blur-sm">{mmss}</span>
                      <span className="land-pill bg-black/40 text-[var(--brand-gold)] text-xs backdrop-blur-sm">
                        <Coins size={12} /> <span className="tabular-nums">{credits.toLocaleString()}</span> credits
                      </span>
                    </div>
                    <div className="flex gap-4 items-center">
                      <span className="w-[52px] h-[52px] rounded-full bg-white/16 border border-white/25 grid place-items-center"><Video size={20} /></span>
                      <span className="w-[62px] h-[62px] rounded-full bg-[var(--brand-live)] grid place-items-center shadow-lg"><Phone size={24} /></span>
                      <span className="w-[52px] h-[52px] rounded-full bg-white/16 border border-white/25 grid place-items-center"><Sparkles size={20} /></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </InView>
        </div>
      </div>
    </section>
  );
}
