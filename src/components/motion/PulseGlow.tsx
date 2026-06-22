'use client';

import { cn } from '@/lib/utils';
import { usePulseUIOptional } from '@/lib/contexts/pulse-ui-context';

type PulseGlowProps = {
  children: React.ReactNode;
  className?: string;
  /** Play outer glow + scale pulse once */
  active?: boolean;
};

/**
 * Soft neon glow (#FF2D9B → #7A5CFF), scale 1 → 1.04 → 1, 600ms ease-in-out.
 */
export function PulseGlow({ children, className, active = true }: PulseGlowProps) {
  const pulse = usePulseUIOptional();
  const on = active && pulse?.pulseEnabled !== false;

  return (
    <span
      className={cn(
        /* Match typical control rounding so box-shadow isn’t a sharp rectangle vs rounded children */
        'relative inline-flex rounded-md',
        on && 'motion-safe:animate-[pulse-glow_600ms_ease-in-out_1]',
        className
      )}
    >
      {children}
    </span>
  );
}
