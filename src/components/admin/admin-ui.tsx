'use client';

import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { TableHead, TableRow } from '@/components/ui/table';

export {
  brandPrimaryBtn,
  brandCancelBtn,
  brandDestructiveBtn,
} from '@/components/feed/brand-dialog-shell';

/* ── Shared Dim form / dialog tokens ─────────────────────────────────── */

export const adminInputClass =
  'h-10 rounded-full bg-secondary border-border focus-visible:ring-[var(--brand-pink)]';

export const adminTextareaClass =
  'rounded-2xl bg-secondary border-border focus-visible:ring-[var(--brand-pink)] min-h-[88px]';

export const adminSelectTriggerClass =
  'h-10 rounded-full bg-secondary border-border focus:ring-[var(--brand-pink)]';

export const adminDialogContentClass =
  'gap-0 overflow-hidden rounded-2xl border-border/80 p-0 [box-shadow:var(--brand-ring-money)]';

export const adminThClass =
  'text-[11px] font-bold uppercase tracking-[0.04em] text-muted-foreground py-3 px-4 h-auto';

export const adminTdClass = 'py-3 px-4 align-middle';

export function AdminTableHeaderRow({ children }: { children: React.ReactNode }) {
  return (
    <TableRow className="hover:bg-transparent border-b border-border bg-secondary/40">
      {children}
    </TableRow>
  );
}

export function AdminTh({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <TableHead className={cn(adminThClass, className)}>{children}</TableHead>;
}

export function AdminSortBtn({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 font-bold uppercase tracking-[0.04em] text-[11px] text-muted-foreground hover:text-foreground transition-colors"
    >
      {children}
    </button>
  );
}

export function AdminLoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center min-h-[240px]', className)}>
      <div
        className="h-9 w-9 rounded-full border-2 border-[var(--brand-pink)] border-t-transparent animate-spin"
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}

export function AdminDialogPanel({
  icon: Icon,
  title,
  description,
  children,
  footer,
  className,
  size = 'default',
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  size?: 'default' | 'wide' | 'full';
}) {
  const sizeClass =
    size === 'full'
      ? 'sm:max-w-[min(95vw,1100px)] max-h-[90vh] flex flex-col'
      : size === 'wide'
        ? 'sm:max-w-[min(95vw,720px)] max-h-[85vh] flex flex-col'
        : 'sm:max-w-[440px]';

  return (
    <DialogContent className={cn(adminDialogContentClass, sizeClass, className)}>
      <div className="px-6 pt-6 pb-4 shrink-0" style={{ background: 'var(--brand-grad-soft)' }}>
        <div className="flex items-start gap-3.5">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--brand-on-accent)]"
            style={{ background: 'var(--brand-grad)', boxShadow: 'var(--brand-ring-money)' }}
          >
            <Icon className="h-5 w-5" aria-hidden />
          </div>
          <DialogHeader className="space-y-1.5 p-0 text-left">
            <DialogTitle className="text-lg font-semibold tracking-tight">{title}</DialogTitle>
            {description ? (
              <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                {description}
              </DialogDescription>
            ) : null}
          </DialogHeader>
        </div>
      </div>
      <div className={cn('min-h-0 flex-1 overflow-y-auto px-6 py-5', size !== 'default' && 'overflow-x-hidden')}>
        {children}
      </div>
      {footer ? (
        <DialogFooter className="gap-2 shrink-0 border-t border-border/60 bg-muted/20 px-6 py-4 sm:justify-end">
          {footer}
        </DialogFooter>
      ) : null}
    </DialogContent>
  );
}

export function AdminAlertPanel({
  title,
  description,
  children,
  footer,
  className,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer: React.ReactNode;
  className?: string;
}) {
  return (
    <AlertDialogContent className={cn(adminDialogContentClass, 'sm:max-w-md', className)}>
      <div className="px-6 pt-6 pb-4" style={{ background: 'var(--brand-grad-soft)' }}>
        <AlertDialogHeader className="space-y-1.5 p-0 text-left">
          <AlertDialogTitle className="text-lg font-semibold tracking-tight">{title}</AlertDialogTitle>
          {description ? (
            <AlertDialogDescription className="text-sm leading-relaxed text-muted-foreground">
              {description}
            </AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
      </div>
      {children ? <div className="px-6 py-4">{children}</div> : null}
      <AlertDialogFooter className="gap-2 border-t border-border/60 bg-muted/20 px-6 py-4 sm:justify-end">
        {footer}
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}

export function AdminAlertCancel(props: React.ComponentProps<typeof AlertDialogCancel>) {
  return <AlertDialogCancel className={cn('rounded-full h-10 px-5', props.className)} {...props} />;
}

export function AdminAlertConfirm({
  destructive,
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogAction> & { destructive?: boolean }) {
  return (
    <AlertDialogAction
      className={cn(
        destructive
          ? 'rounded-full h-10 px-5 text-sm font-semibold text-white bg-destructive hover:bg-destructive/90'
          : 'rounded-full h-10 px-5 text-sm font-semibold text-[var(--brand-on-accent)] [background:var(--brand-grad)] [box-shadow:var(--brand-ring-money)] hover:brightness-110',
        className,
      )}
      {...props}
    />
  );
}

export function AdminStatusPill({
  children,
  variant = 'soft',
  className,
}: {
  children: React.ReactNode;
  variant?: 'soft' | 'gold' | 'live' | 'staff' | 'violet';
  className?: string;
}) {
  const variants = {
    soft: 'bg-secondary text-muted-foreground border border-border',
    gold: 'bg-secondary text-[var(--brand-gold)] border border-border',
    live: 'bg-[color-mix(in_oklch,var(--brand-live)_18%,transparent)] text-[var(--brand-live)] border border-[color-mix(in_oklch,var(--brand-live)_35%,var(--border))]',
    staff: 'bg-[var(--brand-grad-soft)] text-[var(--brand-pink)] border-0',
    violet: 'bg-[color-mix(in_oklch,var(--brand-violet)_14%,transparent)] text-[var(--brand-violet)] border border-border',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap capitalize',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ── Dim admin console atoms ─────────────────────────────────────────── */

export function AdminStatTile({
  label,
  value,
  icon: Icon,
  accent,
  delta,
  deltaUp,
  detail,
  className,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  accent?: string;
  delta?: string;
  deltaUp?: boolean;
  detail?: string;
  className?: string;
}) {
  return (
    <div className={cn('admin-card p-[18px] h-full flex flex-col', className)}>
      <div className="flex items-center justify-between mb-3 min-h-9">
        <span
          className="grid place-items-center w-9 h-9 rounded-[10px] shrink-0 text-[var(--brand-pink)]"
          style={{ background: accent ?? 'var(--brand-grad-soft)' }}
        >
          <Icon size={18} />
        </span>
        {delta != null ? (
          <span
            className={cn(
              'text-xs font-bold flex items-center gap-0.5',
              deltaUp ? 'text-[var(--brand-gold)]' : 'text-muted-foreground',
            )}
          >
            {deltaUp ? '▲' : '▼'} {delta}
          </span>
        ) : (
          <span className="w-0" aria-hidden />
        )}
      </div>
      <div className="font-display text-[26px] tabular-nums leading-none tracking-tight">{value}</div>
      <div className="text-muted-foreground text-[12.5px] font-semibold mt-0.5">{label}</div>
      <div className="text-[11px] text-muted-foreground font-semibold mt-2 min-h-4">
        {detail ?? '\u00A0'}
      </div>
    </div>
  );
}

export function AdminCard({
  children,
  className,
  padding = 'default',
}: {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'default' | 'lg';
}) {
  return (
    <div
      className={cn(
        'admin-card',
        padding === 'default' && 'p-5',
        padding === 'lg' && 'p-[18px]',
        padding === 'none' && 'overflow-hidden',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AdminSectionTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
      <div>
        <h3 className="font-bold text-[15px]">{title}</h3>
        {description && (
          <p className="text-muted-foreground text-[12.5px] mt-0.5">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function AdminPill({
  children,
  className,
  variant = 'soft',
}: {
  children: React.ReactNode;
  className?: string;
  variant?: 'soft' | 'staff' | 'gold' | 'live';
}) {
  const variants = {
    soft: 'bg-secondary text-muted-foreground border border-border',
    staff: 'bg-[var(--brand-grad-soft)] text-[var(--brand-pink)] border-0 font-bold',
    gold: 'bg-secondary text-[var(--brand-gold)] border border-border',
    live: 'bg-[var(--brand-live)] text-white border-0',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold whitespace-nowrap',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function AdminGradButton({
  children,
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      className={cn(
        'rounded-full h-10 px-[18px] font-semibold text-white border-0 hover:brightness-110',
        '[background:var(--brand-grad)] [box-shadow:var(--brand-ring-money)]',
        className,
      )}
      {...props}
    >
      {children}
    </Button>
  );
}

export function AdminGhostButton({
  children,
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      variant="outline"
      className={cn(
        'rounded-full h-10 px-4 font-semibold bg-secondary border-border hover:border-[var(--brand-pink)] hover:text-[var(--brand-pink)]',
        className,
      )}
      {...props}
    >
      {children}
    </Button>
  );
}

export function AdminSearchBar({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn('relative flex-1 min-w-[200px]', className)}>
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-10 h-10 rounded-full bg-secondary border-border focus-visible:ring-[var(--brand-pink)]"
      />
    </div>
  );
}

export function AdminToolbar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', className)}>
      {children}
    </div>
  );
}

export function AdminTableShell({ children }: { children: React.ReactNode }) {
  return (
    <AdminCard padding="none" className="overflow-x-auto">
      {children}
    </AdminCard>
  );
}

export function AdminHealthRow({
  label,
  status,
  ok,
}: {
  label: string;
  status: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-t border-border first:border-t-0 first:pt-0">
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: ok ? 'var(--brand-gold)' : 'var(--brand-live)' }}
      />
      <span className="flex-1 font-semibold text-sm">{label}</span>
      <span
        className={cn(
          'text-[13px] font-semibold',
          ok ? 'text-muted-foreground' : 'text-[var(--brand-live)]',
        )}
      >
        {status}
      </span>
    </div>
  );
}

export const adminTabTriggerClass =
  'rounded-full h-[38px] px-4 text-[13px] font-semibold shrink-0 data-[state=active]:[background:var(--brand-grad)] data-[state=active]:text-white data-[state=active]:border-transparent data-[state=inactive]:bg-secondary data-[state=inactive]:text-muted-foreground border border-border transition-colors';

export const adminTabListClass =
  'scroll-x flex flex-nowrap justify-start gap-1.5 h-auto p-0 bg-transparent w-full max-w-full overflow-x-auto';
