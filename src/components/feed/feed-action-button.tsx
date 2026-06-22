'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type FeedActionButtonProps = {
  icon: LucideIcon;
  label?: string | number;
  active?: boolean;
  activeColor?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
};

/** Dim FeedCard action control (like, comment, bookmark, share). */
export function FeedActionButton({
  icon: Icon,
  label,
  active = false,
  activeColor = 'var(--brand-pink)',
  onClick,
  disabled,
  className,
  ariaLabel,
}: FeedActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel ?? (typeof label === 'string' ? label : undefined)}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-[13.5px] font-semibold transition-colors',
        'text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:pointer-events-none',
        className
      )}
      style={active ? { color: activeColor } : undefined}
    >
      <Icon
        size={19}
        className={cn('shrink-0', active && 'fill-current')}
        strokeWidth={active ? 0 : 2}
        aria-hidden
      />
      {label != null && label !== '' && (
        <span className="tabular-nums">{label}</span>
      )}
    </button>
  );
}
