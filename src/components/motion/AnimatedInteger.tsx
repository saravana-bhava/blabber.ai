'use client';

import { useEffect, useRef, useState } from 'react';

type AnimatedIntegerProps = {
  value: number;
  durationMs?: number;
  className?: string;
};

export function AnimatedInteger({
  value,
  durationMs = 400,
  className,
}: AnimatedIntegerProps) {
  const [display, setDisplay] = useState(value);
  const prevTarget = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = prevTarget.current;
    if (from === value) return;

    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = t * t * (3 - 2 * t);
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevTarget.current = value;
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, durationMs]);

  return <span className={className}>{display}</span>;
}
