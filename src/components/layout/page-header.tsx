'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  rightActions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, rightActions }: PageHeaderProps) {
  const router = useRouter();

  return (
    <header
      className="page-header flex shrink-0 items-center gap-3 min-h-[56px] px-4 py-4 z-10 border-b border-border backdrop-blur-[18px] [-webkit-backdrop-filter:blur(18px)]"
      style={{ background: "color-mix(in oklch, var(--background) 78%, transparent)" }}
    >
      <Button 
        variant="ghost" 
        size="icon" 
        className="shrink-0 rounded-full"
        onClick={() => router.push('/home')}
      >
        <ArrowLeft size={20} className="text-muted-foreground" />
        <span className="sr-only">Back to Home</span>
      </Button>
      <div className="flex-1 min-w-0">
        <h1 className="font-display text-base md:text-lg tracking-tight capitalize">{title}</h1>
        {subtitle && (
          <p className="text-muted-foreground text-[12.5px] font-medium truncate">{subtitle}</p>
        )}
      </div>
      {rightActions && <div className="flex items-center gap-2 shrink-0">{rightActions}</div>}
    </header>
  );
}

interface PageShellProps {
  title: string;
  subtitle?: string;
  rightActions?: React.ReactNode;
  children: React.ReactNode;
  scrollClassName?: string;
  className?: string;
}

/** Pinned page header + scrollable body (Dim / HomeFeedLayout pattern). */
export function PageShell({
  title,
  subtitle,
  rightActions,
  children,
  scrollClassName,
  className,
}: PageShellProps) {
  return (
    <main className={cn('page-shell flex flex-col flex-1 min-h-0 h-full w-full bg-background', className)}>
      <PageHeader title={title} subtitle={subtitle} rightActions={rightActions} />
      <div
        className={cn(
          'page-shell-scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain',
          scrollClassName,
        )}
      >
        {children}
      </div>
    </main>
  );
}
