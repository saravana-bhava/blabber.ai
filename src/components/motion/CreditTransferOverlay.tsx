'use client';

import { useEffect, useState } from 'react';
import { BLABBER_CREDIT_MOTION, type CreditMotionDetail } from '@/lib/credit-motion-events';
import { usePulseUIOptional } from '@/lib/contexts/pulse-ui-context';

type Particle = { id: number; dx: number; dy: number; rot: number };

function rectCenter(el: Element | null) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 && r.height < 2) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export function CreditTransferOverlay() {
  const pulse = usePulseUIOptional();
  const [burst, setBurst] = useState<{
    particles: Particle[];
    from: { x: number; y: number };
    to: { x: number; y: number };
    label: string;
    labelAt: { x: number; y: number };
  } | null>(null);

  useEffect(() => {
    if (!pulse?.pulseEnabled) return;

    const onMotion = (e: Event) => {
      const detail = (e as CustomEvent<CreditMotionDetail>).detail;
      if (!detail?.creatorProfileId) return;

      requestAnimationFrame(() => {
        const fromEl = document.querySelector('[data-pulse-credit-badge]');
        const toEl = document.querySelector(
          `[data-pulse-earning-target="${detail.creatorProfileId}"]`
        );
        const from = rectCenter(fromEl) ?? { x: window.innerWidth * 0.85, y: 48 };
        const to = rectCenter(toEl) ?? { x: window.innerWidth / 2, y: window.innerHeight * 0.35 };

        const n = 8 + Math.floor(Math.random() * 8);
        const particles: Particle[] = Array.from({ length: n }, (_, i) => ({
          id: i,
          dx: (Math.random() - 0.5) * 56,
          dy: (Math.random() - 0.5) * 40,
          rot: (Math.random() - 0.5) * 40,
        }));

        setBurst({
          particles,
          from,
          to,
          label: detail.label,
          labelAt: to,
        });
        window.setTimeout(() => setBurst(null), 820);
      });
    };

    window.addEventListener(BLABBER_CREDIT_MOTION, onMotion);
    return () => window.removeEventListener(BLABBER_CREDIT_MOTION, onMotion);
  }, [pulse?.pulseEnabled]);

  if (!pulse?.pulseEnabled || !burst) return null;

  const dx = burst.to.x - burst.from.x;
  const dy = burst.to.y - burst.from.y;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[200] overflow-hidden"
      aria-hidden
    >
      {burst.particles.map((p) => (
        <span
          key={p.id}
          className="absolute h-2 w-2 rounded-full motion-safe:animate-[credit-particle_800ms_cubic-bezier(0.33,0,0.2,1)_forwards]"
          style={{
            left: burst.from.x,
            top: burst.from.y,
            marginLeft: -4,
            marginTop: -4,
            background: 'radial-gradient(circle, #FF2D9B 0%, #7A5CFF 100%)',
            boxShadow: '0 0 10px 2px color-mix(in oklab, #FF2D9B 50%, transparent)',
            ['--dx' as string]: `${dx + p.dx}px`,
            ['--dy' as string]: `${dy + p.dy}px`,
            ['--rot' as string]: `${p.rot}deg`,
            animationDelay: `${p.id * 18}ms`,
          }}
        />
      ))}
      <span
        className="pointer-events-none absolute text-xs font-bold text-foreground motion-safe:animate-[credit-float_900ms_ease-out_forwards]"
        style={{
          left: burst.labelAt.x,
          top: burst.labelAt.y - 8,
          textShadow: '0 1px 8px rgba(0,0,0,0.45)',
        }}
      >
        {burst.label}
      </span>
    </div>
  );
}
