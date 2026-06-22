'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useBetaMode } from '@/lib/contexts/beta-mode-context';
import { ThemeBtn } from './_atoms';
import { scrollToId } from './_utils';

const LINKS = [
  ['realai', 'Features'],
  ['voice', 'Voice AI'],
  ['why', 'Why Us'],
  ['faqs', 'FAQs'],
  ['pricing', 'Pricing'],
] as const;

export function LandingHeader({ onWaitlist }: { onWaitlist: () => void }) {
  const pathname = usePathname();
  const isLanding = pathname === '/';
  const isBeta = useBetaMode();
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', f, { passive: true });
    f();
    return () => window.removeEventListener('scroll', f);
  }, []);

  return (
    <header
      className="land-header fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 sm:gap-4 transition-[top,box-shadow] duration-300"
      style={{
        top: scrolled ? 10 : 16,
        width: 'min(1180px, calc(100% - 20px))',
        padding: '10px 12px 10px 20px',
        borderRadius: 999,
        backdropFilter: 'blur(20px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
        background: 'color-mix(in oklch, var(--background) 78%, transparent)',
        border: '1px solid var(--border)',
        boxShadow: scrolled
          ? '0 12px 40px -16px rgba(0,0,0,0.55)'
          : '0 6px 24px -16px rgba(0,0,0,0.4)',
      }}
    >
      {isLanding ? (
        <button type="button" onClick={() => scrollToId('__top')} className="bg-transparent border-none cursor-pointer p-0 shrink-0">
          <Image
            src="/logo.png"
            alt="Blabber"
            width={150}
            height={35}
            className="w-[130px] sm:w-[130px] h-auto object-contain"
            priority
          />
        </button>
      ) : (
        <Link href="/" className="shrink-0 no-underline">
          <Image
            src="/logo.png"
            alt="Blabber"
            width={150}
            height={35}
            className="w-[130px] sm:w-[130px] h-auto object-contain"
            priority
          />
        </Link>
      )}

      <nav className="land-nav hidden md:flex gap-0.5 ml-4">
        {LINKS.map(([id, label]) =>
          isLanding ? (
            <button
              key={id}
              type="button"
              onClick={() => scrollToId(id)}
              className="land-nav-link px-3.5 py-2 rounded-[10px] text-sm font-semibold text-muted-foreground bg-transparent border-none cursor-pointer"
            >
              {label}
            </button>
          ) : (
            <Link
              key={id}
              href={id === 'pricing' ? '/pricing' : `/#${id}`}
              className="land-nav-link px-3.5 py-2 rounded-[10px] text-sm font-semibold text-muted-foreground no-underline hover:text-foreground"
            >
              {label}
            </Link>
          ),
        )}
      </nav>

      <div className="flex-1 min-w-0" />

      {mounted && <ThemeBtn className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 border-none bg-transparent" />}

      {!isBeta && (
        <>
          <Link
            href="/login"
            className="land-login hidden md:inline text-sm font-semibold text-muted-foreground px-1.5 no-underline hover:text-foreground"
          >
            Log in
          </Link>

          <Link
            href="/signup"
            className="land-login hidden md:inline text-sm font-semibold px-1.5 no-underline hover:underline underline-offset-2"
            style={{ color: 'var(--brand-pink)' }}
          >
            Join free
          </Link>
        </>
      )}

      {isBeta && (
        <button
          type="button"
          onClick={onWaitlist}
          className="land-btn-beta land-header-cta h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-[13.5px] shrink-0"
        >
          <span className="land-cta-long">JOIN BETA WAITLIST</span>
          <span className="land-cta-short">JOIN BETA</span>
        </button>
      )}
    </header>
  );
}
