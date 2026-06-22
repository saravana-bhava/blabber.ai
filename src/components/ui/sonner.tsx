'use client';

import React from 'react';
import { useTheme } from 'next-themes';
import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { AlertCircle, Check, Info, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

function useResponsiveToastPosition() {
  const [position, setPosition] = React.useState<ToasterProps['position']>('top-right');

  React.useEffect(() => {
    const check = () => {
      setPosition(window.matchMedia('(max-width: 768px)').matches ? 'top-center' : 'top-right');
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return position;
}

const toastShell = cn(
  'group/toast relative flex w-full items-start gap-3 overflow-hidden rounded-2xl border border-border px-4 py-3.5',
  'bg-[color-mix(in_oklch,var(--background)_92%,transparent)] text-foreground',
  'shadow-[0_18px_50px_-20px_rgba(0,0,0,0.55)] backdrop-blur-xl backdrop-saturate-150',
  'font-sans transition-[transform,opacity] duration-200 ease-out',
);

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme();
  const position = useResponsiveToastPosition();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      position={position}
      expand
      gap={10}
      offset={16}
      mobileOffset={{ top: 14, bottom: 88, left: 14, right: 14 }}
      visibleToasts={4}
      duration={4000}
      closeButton
      icons={{
        success: (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] [background:var(--brand-grad-soft)] text-[var(--brand-pink)]">
            <Check className="h-4 w-4" strokeWidth={2.5} />
          </span>
        ),
        error: (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-destructive/12 text-destructive">
            <AlertCircle className="h-4 w-4" strokeWidth={2.2} />
          </span>
        ),
        info: (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] [background:var(--brand-grad-soft)] text-[var(--brand-violet)]">
            <Info className="h-4 w-4" strokeWidth={2.2} />
          </span>
        ),
        loading: (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] [background:var(--brand-grad-soft)] text-[var(--brand-pink)]">
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />
          </span>
        ),
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: toastShell,
          title: 'text-sm font-semibold leading-snug text-foreground pr-6',
          description: 'text-xs text-muted-foreground leading-relaxed',
          content: 'flex flex-col gap-0.5 min-w-0',
          icon: 'shrink-0',
          actionButton: cn(
            'land-btn-beta !h-8 !min-h-8 !px-3 !text-xs !font-bold shrink-0',
          ),
          cancelButton: 'text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors',
          closeButton: cn(
            'absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-full',
            'border border-border bg-secondary text-muted-foreground',
            'hover:text-foreground transition-colors',
          ),
          success: '!border-l-[3px] !border-l-[var(--brand-pink)]',
          error: '!border-l-[3px] !border-l-destructive',
          info: '!border-l-[3px] !border-l-[var(--brand-violet)]',
          warning: '!border-l-[3px] !border-l-[var(--brand-gold)]',
          loading: '!border-l-[3px] !border-l-[var(--brand-violet)]',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
