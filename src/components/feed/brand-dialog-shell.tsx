'use client';

import type { LucideIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export const brandPrimaryBtn =
  'h-10 rounded-full px-5 text-sm font-semibold text-[var(--brand-on-accent)] [background:var(--brand-grad)] [box-shadow:var(--brand-ring-money)] hover:brightness-110 disabled:opacity-50';

export const brandCancelBtn = 'h-10 rounded-full px-5';

export const brandDestructiveBtn =
  'h-10 rounded-full px-5 text-sm font-semibold text-white bg-destructive hover:bg-destructive/90 disabled:opacity-50';

type BrandDialogShellProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: LucideIcon;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  /** Wider layout for payment method grids */
  size?: 'default' | 'wide';
};

export function BrandDialogShell({
  open,
  onOpenChange,
  icon: Icon,
  title,
  description,
  children,
  footer,
  className,
  size = 'default',
}: BrandDialogShellProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'gap-0 overflow-hidden rounded-2xl border-border/80 p-0 [box-shadow:var(--brand-ring-money)]',
          size === 'wide' ? 'sm:max-w-[440px]' : 'sm:max-w-[400px]',
          className
        )}
      >
        <div className="px-6 pt-6 pb-4" style={{ background: 'var(--brand-grad-soft)' }}>
          <div className="flex items-start gap-3.5">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--brand-on-accent)]"
              style={{
                background: 'var(--brand-grad)',
                boxShadow: 'var(--brand-ring-money)',
              }}
            >
              <Icon className="h-5 w-5" aria-hidden />
            </div>
            <DialogHeader className="space-y-1.5 p-0 text-left">
              <DialogTitle className="text-lg font-semibold tracking-tight">{title}</DialogTitle>
              {description ? (
                <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                  {description}
                </DialogDescription>
              ) : (
                <DialogDescription className="sr-only">{title}</DialogDescription>
              )}
            </DialogHeader>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">{children}</div>

        {footer ? (
          <DialogFooter className="gap-2 border-t border-border/60 bg-muted/20 px-6 py-4 sm:justify-end">
            {footer}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function BrandInfoRow({
  icon: Icon,
  children,
  accent = 'var(--brand-pink)',
}: {
  icon: LucideIcon;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <li className="flex gap-3 text-sm text-muted-foreground">
      <span
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-card"
        style={{ color: accent }}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      <span className="pt-0.5 leading-snug">{children}</span>
    </li>
  );
}
