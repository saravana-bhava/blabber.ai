'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

/** Shared shell for `toast.custom()` — matches the Sonner Blabber theme */
export function BlabberToastCard({
  title,
  description,
  href,
  onClick,
  icon,
  className,
}: {
  title: string;
  description?: string;
  href?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  className?: string;
}) {
  const body = (
    <>
      {icon && (
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] [background:var(--brand-grad)] text-white [box-shadow:var(--brand-ring-money)]">
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold leading-snug text-foreground">{title}</div>
        {description && (
          <div className="text-xs text-muted-foreground leading-relaxed mt-0.5">{description}</div>
        )}
      </div>
    </>
  );

  const shell = cn(
    'flex w-full min-w-[280px] max-w-[380px] items-start gap-3 overflow-hidden rounded-2xl border border-border px-4 py-3.5',
    'border-l-[3px] border-l-[var(--brand-pink)]',
    'bg-[color-mix(in_oklch,var(--background)_92%,transparent)] text-foreground',
    'shadow-[0_18px_50px_-20px_rgba(0,0,0,0.55)] backdrop-blur-xl backdrop-saturate-150',
    'transition-[transform,opacity] duration-200 ease-out',
    href || onClick ? 'cursor-pointer hover:border-[var(--brand-pink)]/40' : '',
    className,
  );

  if (href) {
    return (
      <Link href={href} onClick={onClick} className={cn(shell, 'no-underline')}>
        {body}
      </Link>
    );
  }

  return (
    <div className={shell} onClick={onClick} role={onClick ? 'button' : undefined}>
      {body}
    </div>
  );
}
