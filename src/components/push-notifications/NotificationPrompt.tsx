'use client';

import { useEffect, useState } from 'react';
import { Bell, X, Sparkles, Smartphone, Monitor, AlertCircle } from 'lucide-react';
import { subscribeUser } from '@/app/actions/pushNotifications';
import { BlabberLogoMark } from '@/components/brand/blabber-logo-mark';
import { cn } from '@/lib/utils';
import { MobileDebug } from './MobileDebug';

/** How long after subscription check before the prompt appears */
const SHOW_DELAY_MS = 800;

export function NotificationPrompt() {
  const [isSupported, setIsSupported] = useState(false);
  const [currentDeviceSubscribed, setCurrentDeviceSubscribed] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [hasCheckedSubscription, setHasCheckedSubscription] = useState(false);
  const [deviceType, setDeviceType] = useState<'mobile' | 'desktop'>('desktop');
  const [error, setError] = useState<string | null>(null);
  const [isSafari, setIsSafari] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('notification-prompt-dismissed') === 'true';
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isSafariBrowser = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    setDeviceType(isMobile ? 'mobile' : 'desktop');
    setIsSafari(isSafariBrowser);

    if (!isStandalone) return;

    const checks = {
      hasWindow: typeof window !== 'undefined',
      hasServiceWorker: 'serviceWorker' in navigator,
      hasPushManager: 'PushManager' in window,
      hasNotification: 'Notification' in window,
    };

    if (checks.hasWindow && checks.hasServiceWorker && checks.hasPushManager && checks.hasNotification) {
      setIsSupported(true);
      if (!dismissed) registerServiceWorker(isMobile ? 'mobile' : 'desktop', isSafariBrowser);
    } else {
      setError(
        `Push notifications aren't supported here. Missing: ${Object.entries(checks)
          .filter(([, supported]) => !supported)
          .map(([feature]) => feature)
          .join(', ')}`,
      );
    }
  }, []);

  const scheduleShow = () => {
    window.setTimeout(() => setShowPrompt(true), SHOW_DELAY_MS);
  };

  const registerServiceWorker = async (device: 'mobile' | 'desktop', safari: boolean) => {
    try {
      if (safari && device === 'mobile' && window.location.protocol !== 'https:') {
        setError('Push notifications require HTTPS on mobile Safari.');
        return;
      }

      const reg = await navigator.serviceWorker.register(`/sw.js?v=${Date.now()}`, { scope: '/' });
      setRegistration(reg);

      const check = () => checkCurrentDeviceSubscription(reg);

      if (reg.installing) {
        reg.installing.addEventListener('statechange', (e) => {
          if ((e.target as ServiceWorker).state === 'installed') check();
        });
      } else {
        check();
      }
    } catch (err) {
      console.error('Service Worker registration failed:', err);
      setError(`Failed to register service worker: ${(err as Error).message}`);
      setHasCheckedSubscription(true);
    }
  };

  const checkCurrentDeviceSubscription = async (swRegistration: ServiceWorkerRegistration) => {
    try {
      const subscription = await swRegistration.pushManager.getSubscription();
      setCurrentDeviceSubscribed(!!subscription);
      setHasCheckedSubscription(true);
      if (!subscription) scheduleShow();
    } catch (err) {
      console.error('Error checking subscription:', err);
      setHasCheckedSubscription(true);
      scheduleShow();
    }
  };

  const subscribeToNotifications = async () => {
    if (!registration) {
      setError('Service worker not ready.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setError('Permission denied. Enable notifications in your browser settings.');
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });

      await subscribeUser({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!))),
          auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')!))),
        },
      });

      setCurrentDeviceSubscribed(true);
      setIsDismissed(true);
    } catch (err) {
      console.error('Failed to subscribe:', err);
      setError('Failed to enable notifications. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('notification-prompt-dismissed', 'true');
  };

  if (!isSupported || isDismissed || currentDeviceSubscribed || !hasCheckedSubscription || !showPrompt) {
    return null;
  }

  const DeviceIcon = deviceType === 'mobile' ? Smartphone : Monitor;

  return (
    <div
      className={cn(
        'fixed z-50 px-4 md:px-0 md:right-4 md:left-auto md:w-[min(360px,calc(100vw-2rem))]',
        'bottom-[calc(4.25rem+env(safe-area-inset-bottom))] md:bottom-6',
        'left-0 right-0 md:left-auto',
        'animate-in fade-in slide-in-from-bottom-3 duration-300',
      )}
      role="dialog"
      aria-labelledby="notification-prompt-title"
    >
      <div
        className="relative overflow-hidden rounded-[18px] border border-border shadow-[0_24px_70px_-24px_rgba(0,0,0,0.85)]"
        style={{
          background: 'color-mix(in oklch, var(--background) 90%, transparent)',
          backdropFilter: 'blur(20px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
        }}
      >
        <div className="absolute inset-0 [background:var(--brand-grad)] opacity-[0.09] pointer-events-none" />

        <div className="relative p-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 grid place-items-center w-11 h-11 rounded-[12px] [background:var(--brand-grad)] [box-shadow:var(--brand-ring-money)]">
              <Bell className="w-5 h-5 text-white" strokeWidth={2.2} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <BlabberLogoMark size="sm" />
                <span className="land-pill [background:var(--brand-grad-soft)] text-[var(--brand-pink)] text-[10px] font-bold py-0.5 px-2">
                  <DeviceIcon className="w-3 h-3" />
                  {deviceType === 'mobile' ? 'Mobile' : 'Desktop'}
                </span>
              </div>

              <h3 id="notification-prompt-title" className="font-display text-[15px] tracking-tight mb-1">
                Never miss an update
              </h3>

              {error ? (
                <div className="flex items-start gap-2 mb-3 p-2.5 rounded-xl border border-destructive/30 bg-destructive/10">
                  <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                  <p className="text-xs text-destructive leading-relaxed">{error}</p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                  Get alerts for new messages, posts, and tips on{' '}
                  {deviceType === 'mobile' ? 'this phone' : 'this device'}.
                </p>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={subscribeToNotifications}
                  disabled={isLoading}
                  className="land-btn-beta h-9 px-4 text-xs font-bold disabled:opacity-60"
                >
                  {isLoading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Enabling…
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      Enable notifications
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleDismiss}
                  className="grid place-items-center w-9 h-9 rounded-full border border-border bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {isSafari && deviceType === 'mobile' && (
                <p className="text-[11px] text-muted-foreground mt-2.5 leading-relaxed">
                  Tip: open Blabber from your home screen for the best notification experience.
                </p>
              )}
            </div>
          </div>

          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4 pt-3 border-t border-border">
              <MobileDebug />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
