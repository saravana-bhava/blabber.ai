'use client';

import { useState, type ReactNode } from 'react';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { WaitlistModal } from '@/components/landing/WaitlistModal';
import { useBetaMode } from '@/lib/contexts/beta-mode-context';

export function LandingPageShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const isBeta = useBetaMode();
  const [waitlist, setWaitlist] = useState(false);

  return (
    <div className={`min-h-screen overflow-x-hidden bg-background text-foreground ${className ?? ''}`}>
      <LandingHeader onWaitlist={() => isBeta && setWaitlist(true)} />
      {children}
      <LandingFooter />
      {isBeta && waitlist && <WaitlistModal onClose={() => setWaitlist(false)} />}
    </div>
  );
}
