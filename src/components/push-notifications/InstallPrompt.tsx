'use client';

import { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';
import { BlabberLogoMark } from '@/components/brand/blabber-logo-mark';
import { cn } from '@/lib/utils';

function isIOSDevice() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes('Macintosh') && 'ontouchend' in document)
  );
}

function isStandaloneMode() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function InstallPrompt() {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('install-prompt-dismissed') === 'true';
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const standalone = isStandaloneMode();

    if (isMobile && !standalone && !dismissed) {
      const t = window.setTimeout(() => setShouldShow(true), 600);
      return () => clearTimeout(t);
    }
    setShouldShow(false);
  }, []);

  const handleDismiss = () => {
    setShouldShow(false);
    localStorage.setItem('install-prompt-dismissed', 'true');
  };

  if (!shouldShow) return null;

  const ios = isIOSDevice();

  return (
    <div
      className={cn(
        'fixed z-50 px-4 left-0 right-0',
        'bottom-[calc(1rem+env(safe-area-inset-bottom))]',
        'animate-in fade-in slide-in-from-bottom-3 duration-300',
      )}
      role="dialog"
      aria-labelledby="install-prompt-title"
    >
      <div
        className="relative mx-auto max-w-lg overflow-hidden rounded-[18px] border border-border shadow-[0_24px_70px_-24px_rgba(0,0,0,0.85)]"
        style={{
          background: 'color-mix(in oklch, var(--background) 90%, transparent)',
          backdropFilter: 'blur(20px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
        }}
      >
        <div className="absolute inset-0 [background:var(--brand-grad)] opacity-[0.09] pointer-events-none" />

        <div className="relative p-4 flex items-start gap-3">
          <div className="shrink-0 grid place-items-center w-11 h-11 rounded-[12px] [background:var(--brand-grad)] [box-shadow:var(--brand-ring-money)]">
            <Download className="w-5 h-5 text-white" strokeWidth={2.2} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <BlabberLogoMark size="sm" />
            </div>
            <h3 id="install-prompt-title" className="font-display text-[15px] tracking-tight mb-1">
              Install Blabber
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed mb-2">
              Add Blabber to your home screen for a faster, app-like experience.
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed mb-3 flex items-start gap-1.5">
              <Share className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[var(--brand-pink)]" />
              {ios
                ? 'Tap Share, then “Add to Home Screen”. Push notifications work after installing.'
                : 'Use your browser menu to install, or Add to Home Screen from the share sheet.'}
            </p>

            <button
              type="button"
              onClick={handleDismiss}
              className="land-btn-line h-9 px-4 text-xs font-semibold"
            >
              Got it
            </button>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            className="shrink-0 grid place-items-center w-9 h-9 rounded-full border border-border bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
