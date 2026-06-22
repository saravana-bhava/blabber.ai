'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, DollarSign, MoreHorizontal, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser } from '@/lib/contexts/user-context';
import { useCreditsModal } from '@/lib/contexts/credits-modal-context';
import { SideNav } from './sidenav';

const MNAV_BEFORE_POST = [
  { href: '/home', icon: Home, label: 'Home' },
  { href: '/explore', icon: Search, label: 'Explore' },
] as const;

const MNAV_AFTER_POST = [
  { href: '/marketplace', icon: DollarSign, label: 'Marketplace', creatorTour: true },
] as const;

function isNavActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileNav() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const pathname = usePathname();
  const { profile, session, isLoading } = useUser();
  const { isBuyCreditsModalOpen } = useCreditsModal();

  useEffect(() => {
    setMounted(true);

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    const ios =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.userAgent.includes('Mac') && 'ontouchend' in document);

    setIsStandalone(standalone);
    setIsIOS(ios);
  }, []);

  useEffect(() => {
    if (isBuyCreditsModalOpen) {
      setIsDrawerOpen(false);
    }
  }, [isBuyCreditsModalOpen]);

  useEffect(() => {
    setIsDrawerOpen(false);
  }, [pathname]);

  if (!mounted) {
    return null;
  }

  if (pathname === '/' || pathname === '/login') {
    return null;
  }

  return (
    <>
      <nav
        className={cn(
          'mobile-nav fixed bottom-0 left-0 right-0 z-50 flex items-center md:hidden',
          'h-[calc(58px+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)]',
          'border-t border-border'
        )}
      >
        {MNAV_BEFORE_POST.map((item) => {
          const active = isNavActive(pathname, item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                'flex flex-1 items-center justify-center py-2',
                active ? 'text-[var(--brand-pink)]' : 'text-muted-foreground'
              )}
            >
              <item.icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.3 : 1.9} />
              <span className="sr-only">{item.label}</span>
            </Link>
          );
        })}

        <Link
          href="/new-post"
          className="flex flex-1 items-center justify-center"
          aria-label="New post"
        >
          <span
            className="-mt-4 grid h-12 w-12 place-items-center rounded-full border-4 border-background text-white"
            style={{
              background: 'var(--brand-grad)',
              boxShadow: 'var(--brand-ring-money)',
            }}
          >
            <Plus className="h-[23px] w-[23px]" strokeWidth={2.6} />
          </span>
        </Link>

        {MNAV_AFTER_POST.map((item) => {
          const active = isNavActive(pathname, item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              data-creator-tour={item.creatorTour ? 'marketplace-nav' : undefined}
              className={cn(
                'flex flex-1 items-center justify-center py-2',
                active ? 'text-[var(--brand-pink)]' : 'text-muted-foreground'
              )}
            >
              <item.icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.3 : 1.9} />
              <span className="sr-only">{item.label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => {
            if (!isBuyCreditsModalOpen) {
              setIsDrawerOpen(true);
            }
          }}
          className="flex flex-1 items-center justify-center py-2 text-muted-foreground"
          aria-label="Menu"
        >
          <MoreHorizontal className="h-[22px] w-[22px]" strokeWidth={1.9} />
        </button>
      </nav>

      <div
        className={cn(
          'fixed inset-0 bg-black/50 transition-opacity duration-300 md:hidden',
          isDrawerOpen && !isBuyCreditsModalOpen ? 'z-[100] opacity-100' : '-z-10 pointer-events-none opacity-0'
        )}
        onClick={() => setIsDrawerOpen(false)}
      />
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-[82%] max-w-[320px] bg-background transition-transform duration-300 ease-in-out md:hidden',
          isDrawerOpen && !isBuyCreditsModalOpen ? 'z-[101] translate-x-0' : '-z-10 translate-x-full'
        )}
      >
        <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
          {!isLoading && session && profile && (
            <div className="flex h-full min-h-0 w-full flex-1 flex-col">
              <SideNav
                isInDrawer={true}
                onLinkClick={() => setIsDrawerOpen(false)}
                isStandalone={isStandalone}
                isIOS={isIOS}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
