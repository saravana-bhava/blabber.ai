'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/lib/contexts/user-context';
import { computeHasFullPostAccess } from '@/lib/feed/post-access';
import type { Post } from '@/lib/types';

export function usePostFullAccess(post: Post) {
  const { profile } = useUser();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [hasPPVAccess, setHasPPVAccess] = useState(false);

  const isOwnPost = post.user_id === profile?.id;

  useEffect(() => {
    if (post.access_level !== 'subscribers_only' || isOwnPost || !profile?.id) return;

    let cancelled = false;
    const supabase = createClient();
    supabase
      .from('subscriptions')
      .select('id')
      .eq('follower_id', profile.id)
      .eq('following_id', post.user_id)
      .eq('status', 'active')
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setIsSubscribed(!!data);
      });

    return () => {
      cancelled = true;
    };
  }, [post.access_level, post.user_id, profile?.id, isOwnPost]);

  useEffect(() => {
    if (post.access_level !== 'ppv' || isOwnPost || !profile?.id) return;

    let cancelled = false;
    const supabase = createClient();
    supabase
      .from('ppv_transactions')
      .select('id')
      .eq('user_id', profile.id)
      .eq('post_id', post.id)
      .eq('status', 'succeeded')
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setHasPPVAccess(!!data);
      });

    return () => {
      cancelled = true;
    };
  }, [post.access_level, post.id, profile?.id, isOwnPost]);

  const hasFullAccess = computeHasFullPostAccess({
    accessLevel: post.access_level,
    isOwnPost,
    isAdmin: profile?.isAdmin,
    isAllAccess: profile?.isAllAccess,
    isSubscribed,
    hasPPVAccess,
  });

  return { hasFullAccess, isSubscribed, hasPPVAccess, isOwnPost };
}
