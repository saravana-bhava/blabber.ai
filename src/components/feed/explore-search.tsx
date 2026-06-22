'use client';

import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ExploreSearchProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

/** Dim ExploreTab: pill search (surface-2, 52px, full-width). */
export function ExploreSearch({ value, onChange, className }: ExploreSearchProps) {
  return (
    <div
      className={cn(
        'mb-[22px] flex h-[52px] items-center gap-2.5 rounded-full border border-border px-[18px]',
        className
      )}
      style={{ background: 'var(--brand-surface)' }}
    >
      <Search className="h-5 w-5 shrink-0 text-muted-foreground/70" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus
        placeholder="Search creators, @handles, tags…"
        className="min-w-0 flex-1 border-0 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/70"
      />
      {value.length > 0 && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          <X className="h-[18px] w-[18px]" />
        </button>
      )}
    </div>
  );
}
