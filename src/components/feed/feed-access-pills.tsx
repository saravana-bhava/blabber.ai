'use client';

import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

export type FeedAccessLevel = 'public' | 'subscribers_only' | 'ppv';

const OPTIONS: { id: FeedAccessLevel; label: string; locked?: boolean }[] = [
  { id: 'public', label: 'Public' },
  { id: 'subscribers_only', label: 'Subscribers', locked: true },
  { id: 'ppv', label: 'Pay-per-view', locked: true },
];

type FeedAccessPillsProps = {
  value: FeedAccessLevel;
  onChange: (level: FeedAccessLevel) => void;
  disabled?: boolean;
};

export function FeedAccessPills({ value, onChange, disabled }: FeedAccessPillsProps) {
  return (
    <div
      className="flex gap-0.5 rounded-full border border-border p-0.5"
      style={{ background: 'var(--brand-surface)' }}
      role="group"
      aria-label="Post access"
    >
      {OPTIONS.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.id)}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors',
              active
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {opt.locked && <Lock className="h-2.5 w-2.5 shrink-0" aria-hidden />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
