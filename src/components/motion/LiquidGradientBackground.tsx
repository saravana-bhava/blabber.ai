'use client';

import { cn } from '@/lib/utils';
import { usePulseUIOptional } from '@/lib/contexts/pulse-ui-context';

type LiquidGradientBackgroundProps = {
  className?: string;
  /** 8–12s loop */
  durationSec?: number;
};

/**
 * Very subtle moving gradient (opacity &lt; 20%), left→right drift.
 */
export function LiquidGradientBackground({
  className,
  durationSec = 10,
}: LiquidGradientBackgroundProps) {
  const pulse = usePulseUIOptional();
  if (!pulse?.pulseEnabled) return null;

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]',
        className
      )}
      aria-hidden
    >
      <div
        className="absolute -inset-[40%] opacity-[0.14] motion-safe:animate-[liquid-gradient-move_ease-in-out_infinite_alternate]"
        style={{
          background:
            'linear-gradient(110deg, #FF2D9B 0%, #7A5CFF 35%, transparent 55%, #7A5CFF 75%, #FF2D9B 100%)',
          backgroundSize: '200% 100%',
          animationDuration: `${durationSec}s`,
        }}
      />
    </div>
  );
}
