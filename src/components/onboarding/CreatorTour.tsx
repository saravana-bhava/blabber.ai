'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/lib/contexts/user-context';
import { Button } from '@/components/ui/button';
import {
  Coins,
  DollarSign,
  PhoneCall,
  Store,
  BarChart3,
  Sparkles,
  Play,
  PenSquare,
  Image as ImageIcon,
  Video as VideoIcon,
  Film as FilmIcon,
  Vote as PollIcon,
  Users as UsersIcon,
  Send as SendIcon,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Add `?creator_tour=1` to any authenticated page URL to force-show the
 * creator monetization tour without going through the verification flow.
 *
 * Add `?creator_tour=auto` to also auto-advance through every step on a timer
 * (for screen-recording how-to videos). Override the per-step dwell time with
 * `&dwell=8000` (default 7000ms). The dwell only starts once the spotlight
 * has actually settled on the target element — so navigation between routes
 * doesn't eat into your recording budget.
 *
 * Setting the localStorage flag below also causes the tour to auto-open the
 * next time the user is on creator-settings (we set this when verification
 * completes inside /become-a-creator).
 */
const FORCE_PARAM = 'creator_tour';
const DWELL_PARAM = 'dwell';
const DEFAULT_AUTO_DWELL_MS = 7000;
const PENDING_KEY_PREFIX = 'blabber_creator_tour_pending_';
const COMPLETED_KEY_PREFIX = 'blabber_creator_tour_completed_';

/** Mark that the creator tour should auto-open next time this user is on the dashboard. */
export function markCreatorTourPending(userId: string) {
  if (typeof window === 'undefined' || !userId) return;
  try {
    localStorage.setItem(`${PENDING_KEY_PREFIX}${userId}`, 'true');
    localStorage.removeItem(`${COMPLETED_KEY_PREFIX}${userId}`);
  } catch (_) {}
}

type Step = {
  id: string;
  title: string;
  body: string;
  ctaLabel: string;
  icon: LucideIcon;
  /** CSS selector for the element to highlight. If multiple match, the first visible one is used. */
  selector?: string;
  /** Required route. The tour will router.push() here before locating the target. */
  path?: string;
  /** Run once when entering this step (after navigation completes). Use to flip tabs etc. */
  onEnter?: () => void;
  /** If true, skip spotlight and show the popover centered. */
  centered?: boolean;
};

const STEPS: Step[] = [
  {
    id: 'credits',
    title: 'Credits',
    body: 'Credits are the in-app currency for AI usage. Fans buy credits to spend on calls with your AI twin, and you’ll spend them on AI image generation. Subscriptions, tips, and marketplace sales pay out as real money — not credits.',
    ctaLabel: 'Next',
    icon: Coins,
    selector: '[data-creator-tour="credits-badge"]',
    path: '/creator-settings',
  },
  {
    id: 'monetization',
    title: 'Monetize 6+ ways at once',
    body: 'Subscriptions, tips, AI calls, AI DMs, paid posts, marketplace drops — you can run them all in parallel. Most platforms only give creators 1 or 2 levers.',
    ctaLabel: 'Next',
    icon: DollarSign,
    selector: '[data-creator-tour="subscription-card"]',
    path: '/creator-settings',
  },
  {
    id: 'ai-calls',
    title: 'AI Calls',
    body: 'AI Calls let fans talk to your digital twin in your voice. Fully scalable, hands-off revenue — even while you sleep.',
    ctaLabel: 'Next',
    icon: PhoneCall,
    selector: '[data-creator-tour="ai-call-toggle"]',
    path: '/creator-settings',
    onEnter: () => {
      const trigger = document.querySelector<HTMLElement>(
        '[data-creator-tour="ai-tab-trigger"]'
      );
      if (!trigger) return;
      // Already active? Nothing to do.
      if (trigger.getAttribute('data-state') === 'active') return;
      // Radix Tabs activates on `mousedown` (not click), and also on focus
      // when activationMode is automatic (the default). Fire all three so
      // we don't depend on a specific Radix version.
      try {
        trigger.dispatchEvent(
          new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 })
        );
        trigger.dispatchEvent(
          new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0 })
        );
      } catch (_) {}
      try {
        trigger.focus();
      } catch (_) {}
      try {
        trigger.click();
      } catch (_) {}
    },
  },
  {
    id: 'marketplace',
    title: 'Marketplace',
    body: 'Sell digital products, bundles, exclusive access, or limited drops directly to your fans — your own storefront.',
    ctaLabel: 'Next',
    icon: Store,
    selector: '[data-creator-tour="marketplace-nav"]',
  },
  {
    id: 'revenue',
    title: 'Revenue dashboard',
    body: 'Track revenue per fan, conversion rates, and projected earnings. Spot what works and double down on it.',
    ctaLabel: 'Next',
    icon: BarChart3,
    selector: '[data-creator-tour="analytics-overview"]',
    path: '/creator-dashboard',
  },
  {
    id: 'newpost-intro',
    title: 'Now let\u2019s create a post',
    body: 'Posting on Blabber gives you many more options than other platforms. Here\u2019s a tour of every button on the composer.',
    ctaLabel: 'Show me',
    icon: PenSquare,
    centered: true,
    path: '/new-post',
  },
  {
    id: 'newpost-image',
    title: 'Upload images',
    body: 'Upload one or more photos. Combine with text for a classic post, or pair with PPV for a paid photo set.',
    ctaLabel: 'Next',
    icon: ImageIcon,
    selector: '[data-creator-tour="newpost-image"]',
    path: '/new-post',
  },
  {
    id: 'newpost-video',
    title: 'Upload video',
    body: 'Upload a long-form video. Great for behind-the-scenes, vlogs, or paid drops behind a PPV gate.',
    ctaLabel: 'Next',
    icon: VideoIcon,
    selector: '[data-creator-tour="newpost-video"]',
    path: '/new-post',
  },
  {
    id: 'newpost-short',
    title: 'Record a Short',
    body: 'Open the in-app recorder to capture a vertical Short. Built-in trimming and overlays — no third-party app needed.',
    ctaLabel: 'Next',
    icon: FilmIcon,
    selector: '[data-creator-tour="newpost-short"]',
    path: '/new-post',
  },
  {
    id: 'newpost-aigen',
    title: 'AI image studio',
    body: 'Generate images from a text prompt using your AI twin\u2019s style. Costs credits per generation, then you can post or save them to your gallery.',
    ctaLabel: 'Next',
    icon: Sparkles,
    selector: '[data-creator-tour="newpost-aigen"]',
    path: '/new-post',
  },
  {
    id: 'newpost-poll',
    title: 'Create a poll',
    body: 'Ask your audience a question with up to 4 options. Fans can vote and you\u2019ll see live results.',
    ctaLabel: 'Next',
    icon: PollIcon,
    selector: '[data-creator-tour="newpost-poll"]',
    path: '/new-post',
  },
  {
    id: 'newpost-subscribers-only',
    title: 'Subscribers only',
    body: 'Lock this post to your paying subscribers. Free fans see a teaser and a subscribe prompt — recurring revenue from your best content.',
    ctaLabel: 'Next',
    icon: UsersIcon,
    selector: '[data-creator-tour="newpost-subscribers-only"]',
    path: '/new-post',
  },
  {
    id: 'newpost-ppv',
    title: 'Pay-per-view (PPV)',
    body: 'Set a one-time price on a single post. Anyone — even non-subscribers — can unlock it for that price. Perfect for premium drops.',
    ctaLabel: 'Next',
    icon: DollarSign,
    selector: '[data-creator-tour="newpost-ppv"]',
    path: '/new-post',
  },
  {
    id: 'newpost-submit',
    title: 'Hit POST',
    body: 'When you\u2019re ready, tap POST to publish. Your post goes live to your followers immediately.',
    ctaLabel: 'Next',
    icon: SendIcon,
    selector: '[data-creator-tour="newpost-submit"]',
    path: '/new-post',
  },
  {
    id: 'end',
    title: 'You’re ready to monetize.',
    body: 'You’ve got more earning levers than any other platform gives you. Time to put them to work.',
    ctaLabel: 'Start Earning',
    icon: Sparkles,
    centered: true,
  },
];

/**
 * Pink fill bar that animates from 0 → 100% over `dwellMs`. Remounts whenever
 * `stepKey` changes so each step gets a fresh animation.
 */
function DwellProgressBar({
  dwellMs,
  stepKey,
  active,
}: {
  dwellMs: number;
  stepKey: number | string;
  active: boolean;
}) {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    setPct(0);
    if (!active) return;
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setPct(100));
    });
    return () => window.cancelAnimationFrame(id);
  }, [stepKey, dwellMs, active]);
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full bg-pink-500"
        style={{
          width: `${pct}%`,
          transition: active ? `width ${dwellMs}ms linear` : 'none',
        }}
      />
    </div>
  );
}

function findVisibleEl(selector: string): HTMLElement | null {
  const all = Array.from(document.querySelectorAll<HTMLElement>(selector));
  for (const el of all) {
    if (el.offsetParent !== null) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return el;
    }
  }
  return all[0] ?? null;
}

export function CreatorTour() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { session, profile, isLoading } = useUser();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [targetMissing, setTargetMissing] = useState(false);
  const [creatorChecked, setCreatorChecked] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const onEnterFiredRef = useRef<number>(-1);
  const navTriggeredForRef = useRef<number>(-1);
  /**
   * Prevents the force-open branch from re-firing after `finish()`.
   * `setOpen(false)` flushes before `router.replace` clears `?creator_tour=1`
   * from `useSearchParams`, so without this ref the effect would re-open the
   * tour while `force` is briefly still true. Resets when `force` goes back
   * to false so adding the param again re-triggers the tour.
   */
  const forceConsumedRef = useRef(false);

  const forceValue = searchParams?.get(FORCE_PARAM) ?? null;
  const force = forceValue === '1' || forceValue === 'auto';
  const autoMode = forceValue === 'auto';
  const dwellMs = (() => {
    const raw = parseInt(searchParams?.get(DWELL_PARAM) || '', 10);
    return Number.isFinite(raw) && raw >= 1000 ? raw : DEFAULT_AUTO_DWELL_MS;
  })();
  const onboardingFlag = searchParams?.get('onboarding_complete') === '1';

  // Determine creator status (only used for non-forced auto-open).
  useEffect(() => {
    if (isLoading || !profile?.id) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('creators')
        .select('profile_id')
        .eq('profile_id', profile.id)
        .maybeSingle();
      if (cancelled) return;
      setIsCreator(!!data);
      setCreatorChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoading, profile?.id]);

  // Decide whether to open. We never close from this effect — only `finish()` closes.
  useEffect(() => {
    // Reset the force latch as soon as the URL param goes away so a future
    // `?creator_tour=1` re-trigger works again in the same session.
    if (!force) forceConsumedRef.current = false;

    if (open) return;
    if (!session?.user?.id || !profile?.id) return;

    if (force) {
      if (forceConsumedRef.current) return;
      forceConsumedRef.current = true;
      try {
        localStorage.removeItem(`${COMPLETED_KEY_PREFIX}${session.user.id}`);
      } catch (_) {}
      setStep(0);
      onEnterFiredRef.current = -1;
      navTriggeredForRef.current = -1;
      setOpen(true);
      return;
    }

    if (!creatorChecked || !isCreator) return;
    // Defer until the post-onboarding share popup has been dismissed.
    if (onboardingFlag) return;

    let pending = false;
    let completed = false;
    try {
      pending =
        localStorage.getItem(`${PENDING_KEY_PREFIX}${session.user.id}`) === 'true';
      completed =
        localStorage.getItem(`${COMPLETED_KEY_PREFIX}${session.user.id}`) === 'true';
    } catch (_) {}

    if (pending && !completed) {
      setStep(0);
      onEnterFiredRef.current = -1;
      navTriggeredForRef.current = -1;
      setOpen(true);
    }
  }, [
    open,
    session?.user?.id,
    profile?.id,
    creatorChecked,
    isCreator,
    force,
    onboardingFlag,
  ]);

  const finish = useCallback(() => {
    setOpen(false);
    if (session?.user?.id) {
      try {
        localStorage.setItem(`${COMPLETED_KEY_PREFIX}${session.user.id}`, 'true');
        localStorage.removeItem(`${PENDING_KEY_PREFIX}${session.user.id}`);
      } catch (_) {}
    }
    if (force && typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete(FORCE_PARAM);
      url.searchParams.delete(DWELL_PARAM);
      router.replace(url.pathname + (url.search || ''));
    }
  }, [session?.user?.id, force, router]);

  // Navigate to the step's required path (preserve creator_tour=… if forced).
  useEffect(() => {
    if (!open) return;
    const s = STEPS[step];
    if (!s?.path) return;
    if (pathname === s.path) return;
    if (navTriggeredForRef.current === step) return;
    navTriggeredForRef.current = step;
    let target = s.path;
    if (force) {
      const params = new URLSearchParams();
      params.set(FORCE_PARAM, autoMode ? 'auto' : '1');
      if (autoMode && dwellMs !== DEFAULT_AUTO_DWELL_MS) {
        params.set(DWELL_PARAM, String(dwellMs));
      }
      target = `${s.path}?${params.toString()}`;
    }
    router.push(target);
  }, [open, step, pathname, router, force, autoMode, dwellMs]);

  // Find target element with retries; track its rect through resize/scroll.
  // onEnter (e.g. clicking the AI tab) runs inside the loop so we keep retrying
  // until the trigger element is actually in the DOM (creator-settings can
  // still be loading right after we router.push there).
  useEffect(() => {
    if (!open) return;
    const s = STEPS[step];
    if (!s) return;
    if (s.centered || !s.selector) {
      // Reset onEnter latch so re-entering this step (back nav) re-fires.
      onEnterFiredRef.current = step;
      setRect(null);
      setTargetMissing(false);
      return;
    }
    if (s.path && pathname !== s.path) {
      setRect(null);
      setTargetMissing(false);
      return;
    }

    // Clear the previous step's spotlight while we wait for the new target
    // (e.g. while Radix is mounting the AI tab content).
    setRect(null);
    setTargetMissing(false);

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 80; // ~4s total
    const selector = s.selector;

    const measure = () => {
      const el = findVisibleEl(selector);
      if (!el) return false;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return false;
      setRect(r);
      return true;
    };

    const tick = () => {
      if (cancelled) return;

      // Try to fire onEnter (e.g. switch the AI tab). Repeat until the
      // dependencies it relies on are mounted: we only flip the latch once
      // the target itself is locatable.
      if (onEnterFiredRef.current !== step) {
        try {
          s.onEnter?.();
        } catch (_) {}
      }

      const el = findVisibleEl(selector);
      if (el) {
        onEnterFiredRef.current = step;
        try {
          el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        } catch (_) {}
        // Allow scroll to settle before measuring.
        setTimeout(() => {
          if (cancelled) return;
          if (!measure()) {
            attempts++;
            if (attempts < maxAttempts) setTimeout(tick, 60);
          }
        }, 250);
        return;
      }
      attempts++;
      if (attempts < maxAttempts) setTimeout(tick, 50);
      else {
        // Target never showed up (e.g. button hidden behind a feature flag).
        // Mark as missing so auto-mode can advance instead of stalling.
        setRect(null);
        setTargetMissing(true);
      }
    };
    tick();

    const update = () => {
      measure();
    };
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      cancelled = true;
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, step, pathname]);

  // Lock body scroll while the tour is open so the spotlight doesn't drift.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Auto-advance for screen recordings. Only starts once the step is "ready":
  // either it's a centered (no-target) step, or the spotlight rect is set.
  // That way, navigation transitions and DOM-mount waits don't eat the dwell.
  const stepReadyForAuto =
    open &&
    (STEPS[step]?.centered === true || rect !== null || targetMissing);
  useEffect(() => {
    if (!open || !autoMode || !stepReadyForAuto) return;
    const id = window.setTimeout(() => {
      const isLast = step === STEPS.length - 1;
      if (isLast) {
        finish();
        return;
      }
      onEnterFiredRef.current = -1;
      navTriggeredForRef.current = -1;
      setStep((v) => v + 1);
    }, dwellMs);
    return () => window.clearTimeout(id);
  }, [open, autoMode, stepReadyForAuto, dwellMs, step, finish]);

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const Icon = s.icon;

  const handleNext = () => {
    if (isLast) {
      finish();
      return;
    }
    onEnterFiredRef.current = -1;
    navTriggeredForRef.current = -1;
    setStep((v) => v + 1);
  };

  const handleSkip = () => finish();

  // Position popover near the spotlight, with smart top/bottom flip.
  const popoverWidth = 360;
  const padding = 16;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 0;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 0;
  const width = Math.min(popoverWidth, Math.max(280, vw - padding * 2));

  const popoverStyle: React.CSSProperties = {
    position: 'fixed',
    width,
    zIndex: 10001,
  };

  if (rect) {
    const spaceBelow = vh - rect.bottom;
    const spaceAbove = rect.top;
    if (spaceBelow >= 220 || spaceBelow >= spaceAbove) {
      popoverStyle.top = Math.min(rect.bottom + 16, vh - 220 - padding);
    } else {
      popoverStyle.bottom = Math.max(vh - rect.top + 16, padding);
    }
    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(padding, Math.min(left, vw - width - padding));
    popoverStyle.left = left;
  } else {
    popoverStyle.left = '50%';
    popoverStyle.top = '50%';
    popoverStyle.transform = 'translate(-50%, -50%)';
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[10000]"
      role="dialog"
      aria-modal="true"
      aria-label={s.title}
    >
      {rect ? (
        <>
          {/* Four panels around the spotlight rect (block all clicks outside it). */}
          <div
            className="fixed left-0 right-0 top-0 bg-black/70 backdrop-blur-[1px]"
            style={{ height: Math.max(0, rect.top - 8) }}
          />
          <div
            className="fixed left-0 right-0 bg-black/70 backdrop-blur-[1px]"
            style={{ top: rect.bottom + 8, bottom: 0 }}
          />
          <div
            className="fixed left-0 bg-black/70 backdrop-blur-[1px]"
            style={{
              top: Math.max(0, rect.top - 8),
              height: rect.height + 16,
              width: Math.max(0, rect.left - 8),
            }}
          />
          <div
            className="fixed bg-black/70 backdrop-blur-[1px]"
            style={{
              top: Math.max(0, rect.top - 8),
              left: rect.right + 8,
              right: 0,
              height: rect.height + 16,
            }}
          />
          {/* Spotlight ring */}
          <div
            className="fixed pointer-events-none rounded-xl ring-2 ring-pink-500 transition-[top,left,width,height] duration-300"
            style={{
              top: rect.top - 8,
              left: rect.left - 8,
              width: rect.width + 16,
              height: rect.height + 16,
              boxShadow:
                '0 0 0 4px rgba(236, 72, 153, 0.18), 0 0 24px 4px rgba(236, 72, 153, 0.45)',
            }}
          />
        </>
      ) : (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-[1px]" />
      )}

      <div
        style={popoverStyle}
        className="rounded-2xl border border-border bg-background p-5 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pink-500/15 text-pink-500">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold leading-snug">{s.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {s.body}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === step ? 'w-6 bg-pink-500' : 'w-1.5 bg-muted'
              )}
            />
          ))}
        </div>

        {autoMode ? (
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Play className="h-3 w-3" aria-hidden />
                Auto-playing tour
              </span>
              <span>
                {stepReadyForAuto ? `${dwellMs / 1000}s` : 'Loading…'}
              </span>
            </div>
            <DwellProgressBar
              dwellMs={dwellMs}
              stepKey={step}
              active={stepReadyForAuto}
            />
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-between gap-2">
          {!isLast ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="text-muted-foreground"
            >
              {autoMode ? 'Stop' : 'Skip'}
            </Button>
          ) : (
            <span />
          )}
          <div className="text-xs text-muted-foreground">
            {step + 1} / {STEPS.length}
          </div>
          <Button
            onClick={handleNext}
            className="bg-pink-500 text-white hover:bg-pink-600"
          >
            {s.ctaLabel} →
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
