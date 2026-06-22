'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface InViewProps {
  children: React.ReactNode;
  className?: string;
  /** Extra Tailwind classes applied only once visible */
  visibleClass?: string;
  /** ms delay before animation triggers */
  delay?: number;
  /** How much of the element must be visible (0–1) */
  threshold?: number;
}

/**
 * Wraps children and fades them up when they scroll into view.
 * Respects prefers-reduced-motion — invisible state only applies
 * when the user hasn't opted out of motion.
 */
export function InView({
  children,
  className,
  delay = 0,
  threshold = 0.12,
}: InViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold, rootMargin: '0px 0px -40px 0px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return (
    <div
      ref={ref}
      className={cn(
        'motion-safe:transition-[opacity,transform] motion-safe:duration-[560ms] motion-safe:ease-out',
        visible
          ? 'opacity-100 translate-y-0'
          : 'motion-safe:opacity-0 motion-safe:translate-y-4',
        className,
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
