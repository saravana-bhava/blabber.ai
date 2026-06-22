import { cn } from '@/lib/utils';
import { BlabberLogoMark } from '@/components/brand/blabber-logo-mark';

type BlabberWordmarkSize = 'sm' | 'md' | 'lg';

const LOGO_SIZE: Record<BlabberWordmarkSize, 'sm' | 'md' | 'lg'> = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
};

const TEXT_SIZE: Record<BlabberWordmarkSize, number> = { sm: 18, md: 22, lg: 25 };

const gradientTextStyle: React.CSSProperties = {
  background: 'var(--brand-grad)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
};

/** Blabber wordmark — real icon from /icons + gradient BLABBER text. */
export function BlabberWordmark({
  size = 'md',
  className,
  hideText = false,
  light = false,
}: {
  size?: BlabberWordmarkSize;
  className?: string;
  hideText?: boolean;
  light?: boolean;
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <BlabberLogoMark size={LOGO_SIZE[size]} priority={size === 'lg'} />
      {!hideText && (
        <span
          className="font-display font-extrabold tracking-[-0.03em] select-none"
          style={{
            fontSize: TEXT_SIZE[size],
            ...(light
              ? { color: '#fff', background: 'none', WebkitTextFillColor: '#fff' }
              : gradientTextStyle),
          }}
        >
          BLABBER
        </span>
      )}
    </div>
  );
}
