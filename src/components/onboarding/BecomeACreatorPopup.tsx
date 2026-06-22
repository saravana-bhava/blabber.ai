'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/lib/contexts/user-context';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const STORAGE_KEY_PREFIX = 'blabber_become_creator_popup_shown_';
const DELAY_MIN_MS = 20_000;
const DELAY_MAX_MS = 30_000;
const DELAY_TARGET_MS = 25_000;
const WINDOW_END_MS = 45_000;

/** Add ?show_become_creator_popup=1 to any authenticated page URL to force-show the popup for testing (no new account needed). */
const FORCE_SHOW_PARAM = 'show_become_creator_popup';

export function BecomeACreatorPopup() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, profile, isLoading } = useUser();
  const [open, setOpen] = useState(false);
  const [creatorChecked, setCreatorChecked] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const forceShow = searchParams.get(FORCE_SHOW_PARAM) === '1';

  const markShown = useCallback((userId: string) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, 'true');
    } catch (_) {}
  }, []);

  const wasAlreadyShown = useCallback((userId: string) => {
    if (typeof window === 'undefined') return true;
    try {
      return localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`) === 'true';
    } catch {
      return true;
    }
  }, []);

  useEffect(() => {
    if (isLoading || !session?.user?.id || !profile?.id) return;
    if (profile.has_completed_intro_onboarding === false) return;

    const supabase = createClient();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      const { data: creator } = await supabase
        .from('creators')
        .select('profile_id')
        .eq('profile_id', profile.id)
        .maybeSingle();
      setCreatorChecked(true);
      if (creator) {
        setIsCreator(true);
        return;
      }

      if (forceShow) {
        setOpen(true);
        return;
      }

      if (wasAlreadyShown(session.user.id)) return;

      const createdAt = session.user.created_at;
      if (!createdAt) return;
      const createdMs = new Date(createdAt).getTime();
      const now = Date.now();
      const elapsed = now - createdMs;

      const show = () => {
        setOpen(true);
        markShown(session.user.id);
      };

      if (elapsed >= WINDOW_END_MS) return;
      if (elapsed >= DELAY_MIN_MS) {
        show();
        return;
      }
      const waitMs = Math.min(DELAY_TARGET_MS - elapsed, DELAY_MAX_MS - elapsed);
      if (waitMs > 0) {
        timeoutId = setTimeout(show, waitMs);
      }
    };

    run();
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isLoading, session?.user?.id, session?.user?.created_at, profile?.id, profile?.has_completed_intro_onboarding, wasAlreadyShown, markShown, forceShow]);

  const clearForceShowParam = useCallback(() => {
    if (typeof window === 'undefined' || !forceShow) return;
    const u = new URL(window.location.href);
    u.searchParams.delete(FORCE_SHOW_PARAM);
    window.history.replaceState({}, '', u.pathname + u.search);
  }, [forceShow]);

  const handleDismiss = () => {
    if (!forceShow && session?.user?.id) markShown(session.user.id);
    setOpen(false);
    clearForceShowParam();
  };

  const handleGetStarted = () => {
    if (!forceShow && session?.user?.id) markShown(session.user.id);
    setOpen(false);
    clearForceShowParam();
    router.push('/become-a-creator');
  };

  if (!creatorChecked || isCreator) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleDismiss()}>
      <DialogContent hideCloseButton={false} onPointerDownOutside={handleDismiss}>
        <DialogHeader>
          <DialogTitle>Become a Creator</DialogTitle>
          <DialogDescription>
            Share content, connect with fans, and earn from subscriptions, tips, and more. Get started in a few steps—we’ll walk you through setup and how Blabber works for creators.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-3 flex-wrap">
          <Button variant="outline" onClick={handleDismiss}>
            Maybe later
          </Button>
          <Button onClick={handleGetStarted} className="bg-pink-500 hover:bg-pink-600 text-white">
            Get Started
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
