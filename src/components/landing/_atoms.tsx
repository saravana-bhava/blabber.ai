'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTheme } from 'next-themes';
import { ChevronRight, Sparkles, Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBetaMode } from '@/lib/contexts/beta-mode-context';

export const displayFont: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  letterSpacing: '-0.02em',
  lineHeight: 1.04,
};

/** Accent word gradient — only use on short highlights, not full headings */
export function GradientText({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={className}
      style={{
        background: 'var(--brand-grad)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        color: 'transparent',
        ...style,
      }}
    >
      {children}
    </span>
  );
}

type BtnSize = 'sm' | 'md' | 'lg';
interface BtnProps {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  outline?: boolean;
  size?: BtnSize;
  className?: string;
  style?: React.CSSProperties;
}

const BTN_SIZE: Record<BtnSize, string> = {
  sm: 'h-9 px-3.5 text-[12.5px]',
  md: 'h-11 px-5 text-[14.5px]',
  lg: 'h-[52px] px-7 text-base',
};

export function Btn({ href, onClick, children, outline, size = 'md', className, style }: BtnProps) {
  const cls = cn(
    'inline-flex items-center justify-center gap-1.5 rounded-full font-semibold whitespace-nowrap cursor-pointer transition-[filter,border-color,color]',
    BTN_SIZE[size],
    outline
      ? 'border-[1.5px] border-border text-foreground bg-transparent hover:border-[var(--brand-pink)] hover:text-[var(--brand-pink)]'
      : '[background:var(--brand-grad)] text-white border-none [box-shadow:var(--brand-ring-money)] hover:brightness-110',
    className,
  );
  if (href) return <Link href={href} className={cls} style={style}>{children}</Link>;
  return <button type="button" onClick={onClick} className={cls} style={style}>{children}</button>;
}

export function Eyebrow({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <div
      className="inline-flex items-center gap-2 text-[13.5px] font-bold mb-[18px]"
      style={{ color: color || 'var(--foreground)' }}
    >
      <span className="inline-flex items-end gap-0.5 h-[15px]">
        {[7, 13, 5, 11, 8].map((h, i) => (
          <span
            key={i}
            className="w-[2.5px] rounded-full bg-[var(--brand-pink)]"
            style={{ height: h, opacity: 0.55 + i * 0.09 }}
          />
        ))}
      </span>
      {children}
    </div>
  );
}

export function Tag({ children, color = 'var(--brand-pink)' }: { children: React.ReactNode; color?: string }) {
  return (
    <div className="inline-flex items-center gap-[7px] text-[12.5px] font-bold tracking-[.08em] uppercase mb-3.5" style={{ color }}>
      <span className="w-[22px] h-0.5 rounded-full" style={{ background: 'currentColor' }} />
      {children}
    </div>
  );
}

export function AIBadge({ small }: { small?: boolean }) {
  return (
    <span
      className="ai-badge-anim inline-flex items-center gap-1 font-bold tracking-[.04em] rounded-full text-white [background-size:180%_180%]"
      style={{ fontSize: small ? 10 : 11.5, padding: small ? '3px 8px 3px 6px' : '4px 10px 4px 8px' }}
    >
      <Sparkles size={small ? 10 : 12} /> AI
    </span>
  );
}

export function VerifiedBadge({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="var(--brand-pink)" className="shrink-0">
      <circle cx="7" cy="7" r="7" />
      <path d="M4 7l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function NavLink({
  id, label, active, onPress,
}: { id: string; label: string; active: boolean; onPress: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPress(id)}
      className="relative px-3.5 py-2 text-sm border-none cursor-pointer bg-transparent text-muted-foreground hover:text-foreground transition-colors duration-[180ms]"
    >
      <span
        style={
          active
            ? { background: 'var(--brand-grad)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', fontWeight: 700 }
            : undefined
        }
      >
        {label}
      </span>
      <span
        className="absolute left-1/2 -translate-x-1/2 rounded-full transition-[width,opacity] duration-[220ms] ease-out"
        style={{ bottom: 2, height: 2.5, width: active ? 20 : 0, opacity: active ? 1 : 0, background: 'var(--brand-grad)' }}
      />
    </button>
  );
}

export function ThemeBtn({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [hover, setHover] = useState(false);
  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={cn(
        'w-10 h-10 rounded-full border bg-secondary grid place-items-center cursor-pointer text-muted-foreground transition-[border-color,color] duration-200',
        className,
      )}
      style={{ borderColor: hover ? 'var(--brand-pink)' : 'var(--border)' }}
    >
      <span className="inline-flex transition-transform duration-[400ms]" style={{ transform: hover ? 'rotate(35deg)' : 'rotate(0deg)' }}>
        {isDark ? <Sun size={17} /> : <Moon size={17} />}
      </span>
    </button>
  );
}

/** Primary landing CTA — waitlist in beta mode, signup when live. */
export function LandingPrimaryCta({
  onWaitlist,
  betaLabel = 'JOIN BETA WAITLIST',
  liveLabel = 'Join free',
  liveHref = '/signup',
  className,
}: {
  onWaitlist: () => void;
  betaLabel?: string;
  liveLabel?: string;
  liveHref?: string;
  className?: string;
}) {
  const isBeta = useBetaMode();

  if (isBeta) {
    return (
      <button type="button" onClick={onWaitlist} className={cn('land-btn-beta', className)}>
        {betaLabel}
      </button>
    );
  }

  return (
    <Link href={liveHref} className={cn('land-btn-beta no-underline inline-flex items-center justify-center', className)}>
      {liveLabel}
    </Link>
  );
}

export function CTABtn({ label = 'Join free', href = '/signup', className }: { label?: string; href?: string; className?: string }) {
  const [hover, setHover] = useState(false);
  return (
    <Link
      href={href}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={cn(
        'h-10 px-[18px] rounded-full text-sm font-semibold inline-flex items-center gap-1.5 text-white border-none [background:var(--brand-grad)] [box-shadow:var(--brand-ring-money)] transition-[filter] duration-150 hover:brightness-[1.07]',
        className,
      )}
    >
      {label}
      <span className="inline-flex transition-transform duration-200" style={{ transform: hover ? 'translateX(3px)' : 'translateX(0)' }}>
        <ChevronRight size={15} />
      </span>
    </Link>
  );
}
