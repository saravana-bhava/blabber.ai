'use client';

import {
  useEffect,
  useState,
  useCallback,
  useRef,
  Suspense,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/lib/contexts/user-context';
import { useCreditsModal } from '@/lib/contexts/credits-modal-context';
import { Button } from '@/components/ui/button';
import { AdminGradButton } from '@/components/admin/admin-ui';
import {
  CheckCircle2,
  Coins,
  FileText,
  MessageCircle,
  PhoneCall,
  Play,
  ShieldCheck,
  Sparkles,
  Store,
  TrendingUp,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/**
 * The intro tour walks new users through the main features:
 * Credits → Buy Credits modal → Search → Messages → Marketplace → Calls.
 *
 * URL params:
 *   - `?intro_tour=1`       Replay the tour manually (open even after completed)
 *   - `?intro_tour=auto`    Auto-advance for screen-recording how-to videos
 *   - `&dwell=8000`         Override per-step dwell time (default 6000ms)
 *
 * In replay/auto modes the DB flag `has_completed_intro_onboarding` is NOT
 * mutated, so you can record against a real account that's already past
 * onboarding without breaking its state.
 */
const FORCE_PARAM = 'intro_tour';
const DWELL_PARAM = 'dwell';
const CREATOR_STEP_PARAM = 'intro_creator_step';
const INTRO_TOUR_DEMO_CREATOR = 'NatalieSnow';
const DEFAULT_DWELL_MS = 6000;

type Step = {
  id?: string;
  title: string;
  body?: string;
  description?: string;
  ctaLabel?: string;
  icon: LucideIcon;
  /** CSS selector for the element to highlight. If multiple match, the first visible one is used. */
  selector?: string;
  /** Required route. The tour will router.push() here before locating the target. */
  path?: string;
  /** Demo sub-step on /become-a-creator (video, earnings, agreement, verify). */
  introCreatorStep?: string;
  /** Run once when entering this step (after navigation completes, before measuring). */
  onEnter?: (ctx: StepContext) => void;
  /** Run once when leaving this step (before the next step's onEnter). */
  onLeave?: (ctx: StepContext) => void;
  /** If true, skip the spotlight and show the popover centered. */
  centered?: boolean;
};

type StepContext = {
  openCreditsModal: () => void;
  closeCreditsModal: () => void;
};

const STEPS: Step[] = [
  {
    id: 'welcome',
    title: 'Welcome to Blabber',
    description:
      'The next-generation creator platform — AI voice, messaging, and a built-in marketplace so you can connect with creators in one place.',
    icon: Sparkles,
    centered: true,
  },
  {
    id: 'credits',
    title: 'Credits',
    description:
      'Credits power AI experiences: DMs, voice calls, and image generation. Buy bundles anytime from your profile menu.',
    icon: Coins,
    selector: '[data-intro-tour="credits-badge"]',
  },
  {
    title: 'AI voice calls',
    description:
      'Call creators you follow with lifelike AI voice. Fans spend credits; creators earn per minute — personal conversations around the clock.',
    icon: PhoneCall,
  },
  {
    title: 'Feed & messages',
    description:
      'Follow creators, explore the feed, subscribe to favorites, and keep the conversation going in DMs.',
    icon: MessageCircle,
    selector: '[data-intro-tour="messages-nav"]',
  },
  {
    id: 'marketplace',
    title: 'Marketplace',
    description:
      'Shop digital and physical drops from creator storefronts — subscriptions, PPV, tips, and products all in one place.',
    icon: Store,
    selector: '[data-intro-tour="marketplace-nav"]',
  },
  {
    id: 'calls',
    title: 'AI Calls',
    body: 'Tap the phone icon on a creator\u2019s profile to start a voice call with their AI twin. Calls use credits from your balance.',
    ctaLabel: 'Next',
    icon: PhoneCall,
    path: `/u/${INTRO_TOUR_DEMO_CREATOR}`,
    selector: '[data-intro-tour="profile-call-button"]',
  },
  {
    id: 'creator-intro',
    title: 'Want to earn on Blabber?',
    body: 'Anyone can apply to become a creator. Here\u2019s a quick walkthrough of the signup flow — from the sidebar link through identity verification.',
    ctaLabel: 'Show me',
    icon: UserPlus,
    centered: true,
  },
  {
    id: 'creator-nav',
    title: 'Become a Creator',
    body: 'Tap this link in the sidebar whenever you\u2019re ready to start. It\u2019s always here until you finish verification.',
    ctaLabel: 'Next',
    icon: UserPlus,
    selector: '[data-intro-tour="become-creator-nav"]',
  },
  {
    id: 'creator-start',
    title: 'Start your application',
    body: 'This is the Become a Creator page. Tap the button to begin — you\u2019ll watch a short welcome video, see earning examples, agree to terms, then verify your identity.',
    ctaLabel: 'Next',
    icon: UserPlus,
    path: '/become-a-creator',
    introCreatorStep: 'start',
    selector: '[data-intro-tour="become-creator-start"]',
  },
  {
    id: 'creator-video',
    title: 'Welcome video',
    body: 'A quick explainer walks you through how Blabber works for creators: profiles, fan interactions, and how money flows. Hit Continue when you\u2019re ready.',
    ctaLabel: 'Next',
    icon: Play,
    path: '/become-a-creator',
    introCreatorStep: 'video',
    selector: '[data-intro-tour="become-creator-video"]',
  },
  {
    id: 'creator-earnings',
    title: 'See what you could earn',
    body: 'Blabber shows example earnings at different fan counts. You keep 90% of what fans pay — subscriptions, tips, PPV, and marketplace sales all count.',
    ctaLabel: 'Next',
    icon: TrendingUp,
    path: '/become-a-creator',
    introCreatorStep: 'earnings',
    selector: '[data-intro-tour="become-creator-earnings"]',
  },
  {
    id: 'creator-agreement',
    title: 'Creator agreement',
    body: 'Read and accept the creator terms — age confirmation, content guidelines, and liability. Check the box, then tap Next to proceed to identity verification.',
    ctaLabel: 'Next',
    icon: FileText,
    path: '/become-a-creator',
    introCreatorStep: 'agreement',
    selector: '[data-intro-tour="become-creator-agreement"]',
  },
  {
    id: 'creator-verify',
    title: 'Identity verification',
    body: 'The final step is a quick ID check powered by Veriff. You\u2019ll upload a photo ID and take a selfie — usually done in a few minutes. Once approved, you can monetize immediately.',
    ctaLabel: 'Next',
    icon: ShieldCheck,
    path: '/become-a-creator',
    introCreatorStep: 'verify',
    selector: '[data-intro-tour="become-creator-verify"]',
  },
  {
    id: 'done',
    title: 'You\u2019re all set',
    body: 'That\u2019s the tour. Explore the feed, follow creators, or start your own creator application whenever you\u2019re ready.',
    ctaLabel: 'Start exploring',
    icon: CheckCircle2,
    centered: true,
  },
];

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

function buildStepTargetUrl(
  s: Step,
  replay: boolean,
  autoMode: boolean,
  dwellMs: number
): string | null {
  if (!s.path) return null;
  const params = new URLSearchParams();
  if (replay) {
    params.set(FORCE_PARAM, autoMode ? 'auto' : '1');
    if (autoMode && dwellMs !== DEFAULT_DWELL_MS) {
      params.set(DWELL_PARAM, String(dwellMs));
    }
  }
  if (s.introCreatorStep) {
    params.set(CREATOR_STEP_PARAM, s.introCreatorStep);
  }
  const qs = params.toString();
  return qs ? `${s.path}?${qs}` : s.path;
}

function stepRouteMatches(
  pathname: string,
  searchParams: URLSearchParams | null,
  s: Step,
  replay: boolean,
  autoMode: boolean
): boolean {
  if (!s.path || pathname !== s.path) return false;
  const current = searchParams ?? new URLSearchParams();
  if (
    s.introCreatorStep &&
    current.get(CREATOR_STEP_PARAM) !== s.introCreatorStep
  ) {
    return false;
  }
  if (replay) {
    const expectedForce = autoMode ? 'auto' : '1';
    if (current.get(FORCE_PARAM) !== expectedForce) return false;
  }
  return true;
}

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

function IntroTourInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { session, profile, refreshProfile } = useUser();
  const { setIsBuyCreditsModalOpen } = useCreditsModal();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [targetMissing, setTargetMissing] = useState(false);

  const onEnterFiredRef = useRef<number>(-1);
  const navTriggeredForRef = useRef<number>(-1);
  const forceConsumedRef = useRef(false);
  const isFinishingRef = useRef(false);
  const lastStepRef = useRef<number>(-1);

  const forceValue = searchParams?.get(FORCE_PARAM) ?? null;
  const replay = forceValue === '1' || forceValue === 'auto';
  const autoMode = forceValue === 'auto';
  const dwellMs = (() => {
    const raw = parseInt(searchParams?.get(DWELL_PARAM) || '', 10);
    return Number.isFinite(raw) && raw >= 1000 ? raw : DEFAULT_DWELL_MS;
  })();

  const stepCtx: StepContext = {
    openCreditsModal: () => setIsBuyCreditsModalOpen(true),
    closeCreditsModal: () => setIsBuyCreditsModalOpen(false),
  };

  // Decide whether to open. Never close from this effect — only `finish()` closes.
  useEffect(() => {
    if (!replay) forceConsumedRef.current = false;

    if (open) return;
    if (!session?.user?.id) return;

    if (replay) {
      if (forceConsumedRef.current) return;
      forceConsumedRef.current = true;
      setStep(0);
      onEnterFiredRef.current = -1;
      navTriggeredForRef.current = -1;
      lastStepRef.current = -1;
      setOpen(true);
      return;
    }

    if (profile?.has_completed_intro_onboarding === false && !isFinishingRef.current) {
      setStep(0);
      onEnterFiredRef.current = -1;
      navTriggeredForRef.current = -1;
      lastStepRef.current = -1;
      setOpen(true);
    }
  }, [
    open,
    session?.user?.id,
    profile?.has_completed_intro_onboarding,
    replay,
  ]);

  const finish = useCallback(() => {
    // Run any pending onLeave so e.g. an open modal is closed before we exit.
    const lastStep = lastStepRef.current;
    if (lastStep >= 0 && lastStep < STEPS.length) {
      try {
        STEPS[lastStep]?.onLeave?.(stepCtx);
      } catch (_) {}
    }

    // Set before setOpen(false) so the re-open effect is blocked while the
    // DB write + refreshProfile() are in flight (profile still has false).
    if (!replay) isFinishingRef.current = true;

    setOpen(false);

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      const hadTourParams =
        url.searchParams.has(FORCE_PARAM) ||
        url.searchParams.has(DWELL_PARAM) ||
        url.searchParams.has(CREATOR_STEP_PARAM);
      if (hadTourParams) {
        url.searchParams.delete(FORCE_PARAM);
        url.searchParams.delete(DWELL_PARAM);
        url.searchParams.delete(CREATOR_STEP_PARAM);
        router.replace(url.pathname + (url.search || ''));
      }
    }

    if (replay) {
      return;
    }

    // First-run completion: persist the flag.
    if (!session?.user?.id) {
      isFinishingRef.current = false;
      return;
    }
    void (async () => {
      try {
        const supabase = createClient();
        const { error } = await supabase
          .from('profiles')
          .update({ has_completed_intro_onboarding: true })
          .eq('id', session.user.id);
        if (error) {
          console.error('Intro tour: failed to persist completion', error);
          return;
        }
        await refreshProfile();
      } catch (err) {
        console.error('Intro tour: persistence error', err);
      } finally {
        isFinishingRef.current = false;
      }
    })();
  }, [replay, router, session?.user?.id, refreshProfile]);

  // Navigate to the step's required path (preserve intro_tour=… if forced).
  useEffect(() => {
    if (!open) return;
    const s = STEPS[step];
    const target = buildStepTargetUrl(s, replay, autoMode, dwellMs);
    if (!target) return;
    if (stepRouteMatches(pathname, searchParams, s, replay, autoMode)) return;
    if (navTriggeredForRef.current === step) return;
    navTriggeredForRef.current = step;
    router.push(target);
  }, [open, step, pathname, searchParams, router, replay, autoMode, dwellMs]);

  // Handle onLeave when leaving a step (before measuring the next).
  useEffect(() => {
    const prev = lastStepRef.current;
    if (open && prev >= 0 && prev !== step && prev < STEPS.length) {
      try {
        STEPS[prev]?.onLeave?.(stepCtx);
      } catch (_) {}
    }
    if (open) lastStepRef.current = step;
  }, [open, step]);

  // Find target element with retries; track its rect through resize/scroll.
  useEffect(() => {
    if (!open) return;
    const s = STEPS[step];
    if (!s) return;

    if (s.centered || !s.selector) {
      // Fire onEnter for centered steps too (so e.g. a step that just runs an
      // action with no spotlight still works).
      if (onEnterFiredRef.current !== step) {
        try {
          s.onEnter?.(stepCtx);
        } catch (_) {}
        onEnterFiredRef.current = step;
      }
      setRect(null);
      setTargetMissing(false);
      return;
    }
    if (s.path && pathname !== s.path) {
      setRect(null);
      setTargetMissing(false);
      return;
    }

    setRect(null);
    setTargetMissing(false);
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 80;
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
      if (onEnterFiredRef.current !== step) {
        try {
          s.onEnter?.(stepCtx);
        } catch (_) {}
      }
      const el = findVisibleEl(selector);
      if (el) {
        onEnterFiredRef.current = step;
        try {
          el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        } catch (_) {}
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
        setRect(null);
        setTargetMissing(true);
      }
    };
    tick();

    const update = () => measure();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      cancelled = true;
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, step, pathname]);

  // Lock body scroll while the tour is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Auto-advance, gated on the step being "ready" (centered or rect set).
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

  const Icon = STEPS[step]?.icon ?? Sparkles;
  const current = STEPS[step];

  return (
    <Dialog open={open}>
      <DialogContent
        className="gap-0 overflow-hidden rounded-2xl border-border/80 p-0 sm:max-w-md [box-shadow:var(--brand-ring-money)]"
        hideCloseButton
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
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
              <DialogTitle className="font-display text-xl font-extrabold tracking-tight leading-snug">
                {current.title}
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                {current.description ?? current.body}
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        <div className="flex justify-center gap-1.5 px-6 py-5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-2 w-2 rounded-full transition-colors',
                i === step ? '[background:var(--brand-grad)]' : 'bg-muted',
              )}
              aria-hidden
            />
          ))}
        </div>

        <DialogFooter className="flex-col gap-2 border-t border-border/60 bg-muted/20 px-6 py-4 sm:flex-col">
          <AdminGradButton
            type="button"
            className="w-full bg-pink-500 text-white hover:bg-pink-600"
            onClick={handleNext}
          >
            {current.ctaLabel ?? (isLast ? 'Get started' : 'Next')}
          </AdminGradButton>
          <Button
            type="button"
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={handleSkip}
          >
            Skip tour
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function IntroOnboardingModal() {
  return (
    <Suspense fallback={null}>
      <IntroTourInner />
    </Suspense>
  );
}
