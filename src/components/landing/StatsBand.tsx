'use client';

import { useEffect, useRef, useState } from 'react';
import { InView } from './InView';
import { displayFont } from './_atoms';
import { LANDING_STATS } from './_data';

function fmtN(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return Math.round(n / 1_000) + 'K';
  return Math.round(n).toString();
}

const statNumberStyle: React.CSSProperties = {
  ...displayFont,
  fontSize: 'clamp(26px, 4vw, 44px)',
  letterSpacing: '-0.02em',
  background: 'var(--brand-grad)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
};

function CountUp({ to, prefix, suffix }: { to: number; prefix: string; suffix: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let done = false;
    const run = () => {
      if (done) return;
      done = true;
      const t0 = performance.now();
      const D = 1400;
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / D);
        const e = 1 - Math.pow(1 - p, 3);
        setVal(to * e);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    const el = ref.current;
    if (!el) { run(); return; }
    const io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && run()), { threshold: 0.4 });
    io.observe(el);
    const hard = setTimeout(() => setVal(to), 2200);
    return () => { io.disconnect(); clearTimeout(hard); };
  }, [to]);

  return (
    <span ref={ref} className="tabular-nums inline-block" style={statNumberStyle}>
      {prefix}{fmtN(val)}{suffix}
    </span>
  );
}

export function StatsBand() {
  return (
    <section className="max-w-[1140px] mx-auto px-4 sm:px-[34px] py-2 sm:pb-10">
      <InView>
        <div className="land-stats-grid grid grid-cols-2 md:grid-cols-4 gap-px bg-border border border-border rounded-[22px] overflow-hidden">
          {LANDING_STATS.map(({ prefix, to, suffix, label }) => (
            <div key={label} className="bg-card px-4 sm:px-[22px] py-6 sm:py-[30px] text-center">
              <CountUp to={to} prefix={prefix} suffix={suffix} />
              <div className="text-[13.5px] text-muted-foreground font-semibold mt-1.5">{label}</div>
            </div>
          ))}
        </div>
      </InView>
    </section>
  );
}
