'use client';

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/contexts/user-context";
import { toast } from "sonner";
import { MessageSquare } from "lucide-react";
import { BlabberToastCard } from "@/components/ui/blabber-toast";
import { usePathname } from "next/navigation";
import { MobileNav } from "./mobile-nav";
import { SideNav } from "./sidenav";
import { SideNavSkeleton } from "./sidenav-skeleton";
import { SuggestionsSidebar } from "./suggestions-sidebar";
import { Toaster } from "@/components/ui/sonner";
import { PWAProvider } from "@/components/push-notifications/PWAProvider";
import { cn } from "@/lib/utils";
import SmoothScroll from "@/components/front/animations/smooth-scroll";
import { PaymentStatusToast } from "@/components/layout/payment-status-toast";
import { BecomeACreatorPopup } from "@/components/onboarding/BecomeACreatorPopup";
import { IntroOnboardingModal } from "@/components/onboarding/IntroOnboardingModal";
import { CreatorTour } from "@/components/onboarding/CreatorTour";
import { CreditTransferOverlay } from "@/components/motion/CreditTransferOverlay";
import { OperatedCreatorBanner } from "@/components/layout/OperatedCreatorBanner";
import { OPERATED_CREATOR_BAR_OFFSET_CSS } from '@/components/layout/operated-banner-layout';
import { installNoisyConsoleWarningFilter } from '@/lib/dev/filter-noisy-console-warnings';

// Routes that bypass the app shell entirely (no sidenav, no grid)
const SHELL_BYPASS_ROUTES = [
  '/',
  '/pricing',
  '/login',
  '/signup',
  '/terms-of-service',
  '/privacy-policy',
  '/refund-policy',
  '/content-removal',
  '/custodian-of-records',
];

// Routes that show the right suggestions rail
const RAIL_ROUTES = ['/home', '/explore', '/notifications', '/bookmarks', '/subscriptions', '/shorts'];

/** Routes that use HomeFeedLayout: one inner scroll surface, not whole-column scroll */
const PINNED_FEED_ROUTES = ['/home', '/explore', '/shorts', '/messages'];

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const { session, profile, isLoading, creator, setProfile, hasUnreadMessages, setHasUnreadMessages } = useUser();
  const [mounted, setMounted] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const prevHasUnreadMessages = useRef(false);
  const lastNotificationTime = useRef(0);
  const prevCreditsRef = useRef<number | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    installNoisyConsoleWarningFilter();
    setMounted(true);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Mac') && 'ontouchend' in document);
    setIsStandalone(standalone);
    setIsIOS(ios);
  }, []);

  useEffect(() => {
    if (profile?.id === session?.user?.id && typeof profile?.credits === 'number') {
      if (prevCreditsRef.current === null) {
        prevCreditsRef.current = profile.credits;
      }
    }
  }, [profile?.credits, profile?.id, session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id) {
      prevCreditsRef.current = null;
      return;
    }
    const supabase = createClient();

    const profileSubscription = supabase
      .channel('profile_changes')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'profiles',
        filter: `id=eq.${session.user.id}`,
      }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          const newProfile = payload.new as NonNullable<Parameters<typeof setProfile>[0]>;
          if (!newProfile) return;

          // Only toast on real credit purchases. Compare against our last known balance —
          // never payload.old (often partial) and never assume 0 before baseline is set.
          if (typeof newProfile.credits === 'number') {
            if (prevCreditsRef.current === null) {
              prevCreditsRef.current = newProfile.credits;
            } else {
              const creditsAdded = newProfile.credits - prevCreditsRef.current;
              if (creditsAdded > 0 && mounted) {
                const now = Date.now();
                if (now - lastNotificationTime.current > 400) {
                  toast.success('Credits added', {
                    description: `+${creditsAdded} credits · balance now ${newProfile.credits.toLocaleString()}`,
                    duration: 4500,
                  });
                  lastNotificationTime.current = now;
                }
              }
              prevCreditsRef.current = newProfile.credits;
            }
          }

          setProfile(newProfile);
          const newHasUnread = !!newProfile.hasUnreadMsg;
          setHasUnreadMessages(newHasUnread);

          if (newHasUnread && !prevHasUnreadMessages.current && mounted) {
            const now = Date.now();
            if (now - lastNotificationTime.current > 400) {
              toast.custom(
                (id) => (
                  <BlabberToastCard
                    title="New message"
                    description="Tap to open your inbox"
                    href="/messages"
                    onClick={() => toast.dismiss(id)}
                    icon={<MessageSquare className="h-4 w-4" strokeWidth={2.2} />}
                  />
                ),
                { duration: 4500 },
              );
              lastNotificationTime.current = now;
            }
          }
          prevHasUnreadMessages.current = newHasUnread;
        }
      })
      .subscribe();

    return () => { profileSubscription.unsubscribe(); };
  }, [session?.user?.id, setProfile, setHasUnreadMessages, mounted]);

  // Landing / pricing: full-page, no app shell
  if (SHELL_BYPASS_ROUTES.includes(pathname)) {
    return (
      <>
        <SmoothScroll />
        <Toaster />
        {children}
      </>
    );
  }

  const showOperatedCreatorBar = !!(creator?.is_agency_operated && creator.agency_profile_id);
  const showRail = RAIL_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'));
  const isPinnedFeedRoute = PINNED_FEED_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + '/')
  );
  const showSideNav = mounted && !isLoading && !!profile;

  return (
    <div
      className={cn(
        'app-viewport relative flex min-h-0 flex-col overflow-hidden',
        isStandalone && isIOS && 'pb-8'
      )}
      style={{ ['--operated-banner-offset' as string]: showOperatedCreatorBar ? OPERATED_CREATOR_BAR_OFFSET_CSS : '0px' }}
    >
      <OperatedCreatorBanner />

      {/* ── 3-column app shell (Dim: 264 | feed | 300 rail; independent column scroll md+) ─ */}
      <div
        className={cn(
          'app-shell mx-auto grid min-h-0 w-full max-w-[1440px] flex-1',
          showRail
            ? 'grid-cols-1 md:grid-cols-[var(--app-nav-width)_minmax(0,1fr)] lg:grid-cols-[var(--app-nav-width)_minmax(0,1fr)_var(--app-rail-width)]'
            : 'grid-cols-1 md:grid-cols-[var(--app-nav-width)_minmax(0,1fr)]'
        )}
      >
        {/* Left: SideNav */}
        {showSideNav ? <SideNav isStandalone={isStandalone} isIOS={isIOS} /> : <SideNavSkeleton />}

        {/* Middle: page content */}
        <div
          {...(isPinnedFeedRoute ? { 'data-pinned-feed': 'true' as const } : {})}
          className={cn(
            'app-main min-h-0 min-w-0 flex flex-col h-full overflow-hidden bg-background',
            showRail ? 'border-x border-border' : 'md:border-l border-border'
          )}
        >
          {children}
        </div>

        {/* Right: Suggestions rail (lg+ only; hidden below lg so 2-col grid stays correct) */}
        {showRail && <SuggestionsSidebar />}
      </div>

      <MobileNav />
      <CreditTransferOverlay />
      <Toaster />
      <PaymentStatusToast />
      {session && pathname !== '/' && <IntroOnboardingModal />}
      {session && pathname !== '/' && <BecomeACreatorPopup />}
      {session && pathname !== '/' && <CreatorTour />}
      {session && <PWAProvider />}
    </div>
  );
}
