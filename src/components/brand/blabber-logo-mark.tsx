import Image from 'next/image';
import { cn } from '@/lib/utils';

export const BLABBER_ICON_SRC = '/icons/icon-192x192.png';

type BlabberLogoMarkSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_MAP: Record<BlabberLogoMarkSize, { px: number; rounded: string }> = {
  sm: { px: 28, rounded: 'rounded-[8px]' },
  md: { px: 30, rounded: 'rounded-[9px]' },
  lg: { px: 32, rounded: 'rounded-[9px]' },
  xl: { px: 48, rounded: 'rounded-[12px]' },
};

export function BlabberLogoMark({
  size = 'lg',
  className,
  priority = false,
}: {
  size?: BlabberLogoMarkSize;
  className?: string;
  priority?: boolean;
}) {
  const { px, rounded } = SIZE_MAP[size];

  return (
    <Image
      src={BLABBER_ICON_SRC}
      alt="Blabber"
      width={px}
      height={px}
      className={cn('shrink-0 object-cover', rounded, className)}
      priority={priority}
    />
  );
}
