'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Moon, Search, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { NotificationBadge } from '@/components/notifications/NotificationBadge';
import { MessageBadge } from '@/components/feed/message-badge';

export type FeedTabId = 'home' | 'explore' | 'shorts';

const TABS: { id: FeedTabId; label: string; href: string }[] = [
  { id: 'home', label: 'Following', href: '/home' },
  { id: 'explore', label: 'Explore', href: '/explore' },
  { id: 'shorts', label: 'Shorts', href: '/shorts' },
];

function tabFromPathname(pathname: string): FeedTabId {
  if (pathname === '/explore' || pathname.startsWith('/explore/')) return 'explore';
  if (pathname === '/shorts' || pathname.startsWith('/shorts/')) return 'shorts';
  return 'home';
}

function ThemeToggleButton() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="h-10 w-10 shrink-0" aria-hidden />;
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      title="Toggle theme"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
    >
      {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );
}

type FeedHeaderProps = {
  searchQuery?: string;
  onSearchQueryChange?: (value: string) => void;
  searchPlaceholder?: string;
  showMobileActions?: boolean;
  /** When true, header stays fixed above the feed scroll region (home layout). */
  pinned?: boolean;
};

export function FeedHeader({
  searchQuery = '',
  onSearchQueryChange,
  searchPlaceholder = 'Search creators',
  showMobileActions = true,
  pinned = false,
}: FeedHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const activeTab = tabFromPathname(pathname);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (activeTab === 'explore') return;
    if (q) {
      router.push(`/explore?q=${encodeURIComponent(q)}`);
    } else {
      router.push('/explore');
    }
  };

  return (
    <header className={cn('shrink-0', pinned ? 'app-feed-header' : 'app-sticky-header')}>
      <div className="mx-auto flex w-full max-w-[840px] items-center gap-2 px-[22px] py-[11px] max-md:gap-1.5 md:gap-3.5">
        <div
          className="flex shrink-0 gap-1 rounded-full border border-border p-1"
          style={{ background: 'var(--brand-surface)' }}
          role="tablist"
          aria-label="Feed"
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => router.push(tab.href)}
                className={cn(
                  'shrink-0 rounded-full px-3 py-[7px] text-[12.5px] font-semibold transition-[color,background,box-shadow] duration-150 md:px-[17px] md:text-[13.5px]',
                  isActive
                    ? 'text-[var(--brand-on-accent)]'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                style={
                  isActive
                    ? {
                        background: 'var(--brand-grad)',
                        boxShadow: 'var(--brand-ring-money)',
                      }
                    : undefined
                }
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="min-w-0 flex-1" />

        <form
          onSubmit={handleSearchSubmit}
          className="feed-search hidden h-10 w-[210px] shrink-0 items-center gap-2 rounded-full border border-border px-3.5 md:flex"
          style={{ background: 'var(--brand-surface)' }}
        >
          <Search className="h-[17px] w-[17px] shrink-0 text-muted-foreground/70" aria-hidden />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange?.(e.target.value)}
            placeholder={searchPlaceholder}
            className="min-w-0 flex-1 border-0 bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-muted-foreground/70"
          />
        </form>

        {showMobileActions && (
          <div className="flex shrink-0 items-center gap-1 md:hidden">
            <NotificationBadge />
            <MessageBadge />
          </div>
        )}

        <ThemeToggleButton />
      </div>
    </header>
  );
}
