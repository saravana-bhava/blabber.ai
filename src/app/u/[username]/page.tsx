'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/lib/contexts/user-context';
import { toast } from 'sonner';

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, Settings, Phone, MoreVertical, LayoutGrid, Film, ShoppingBag, MapPin, Link2 } from 'lucide-react';
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from '@/components/layout/page-header';
import { Feed } from '@/components/feed/Feed'; // Import the Feed component
import { RequireAuth } from '@/components/auth/require-auth';
import { SubscribeModal } from '@/components/subscription/SubscribeModal';
import { CallModal } from '@/components/call/CallModal';
import { CreatorStore } from '@/components/feed/CreatorStore'; // Import the CreatorStore component
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StoryRecorder } from '@/components/feed/StoryRecorder';
import { AgeVerificationModal } from '@/components/auth/AgeVerificationModal';
import { ShareModal } from '@/components/feed/ShareModal';
import { PulseGlow } from '@/components/motion/PulseGlow';
import { usePulseUI } from '@/lib/contexts/pulse-ui-context';
import { BLABBER_SUBSCRIBE_BUTTON_PULSE } from '@/lib/credit-motion-events';
import { cn } from '@/lib/utils';
import {
  brandPrimaryBtn,
  brandCancelBtn,
  brandDestructiveBtn,
} from '@/components/feed/brand-dialog-shell';
import { AdminGradButton, AdminGhostButton } from '@/components/admin/admin-ui';

function formatCompactCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return n.toLocaleString();
}

function ProfileStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center flex-1 min-w-0 px-1">
      <div className="font-display text-lg tabular-nums tracking-tight">{value}</div>
      <div className="text-xs font-semibold text-muted-foreground capitalize">{label}</div>
    </div>
  );
}

const profileTabClass = (active: boolean) =>
  cn(
    'flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors min-w-0',
    active
      ? 'text-foreground border-[var(--brand-pink)]'
      : 'text-muted-foreground border-transparent hover:text-foreground',
  );

const ProfilePageSkeleton = () => (
  <main className="min-h-screen bg-background flex flex-col">
    <div className="page-header flex shrink-0 items-center gap-3 min-h-[56px] px-4 py-4 border-b border-border">
      <Skeleton className="h-10 w-10 rounded-full" />
      <Skeleton className="h-6 w-32" />
    </div>
    <div className="max-w-[760px] mx-auto w-full px-6 pb-16">
      <Skeleton className="h-[200px] w-full rounded-none" />
      <div className="flex justify-between items-end -mt-11 mb-4 gap-4">
        <Skeleton className="w-[104px] h-[104px] rounded-full border-4 border-background" />
        <Skeleton className="h-[42px] w-32 rounded-full" />
      </div>
      <Skeleton className="h-7 w-48 mb-2" />
      <Skeleton className="h-4 w-28 mb-4" />
      <Skeleton className="h-16 w-full rounded-[18px] mb-4" />
      <Skeleton className="h-10 w-full" />
    </div>
  </main>
);
interface Profile {
  id: string;
  updated_at?: string;
  full_name?: string | null;
  username?: string | null;
  credits?: number | null;
  avatar_url?: string | null; // Assuming you might add avatar_url to profiles table
  banner_url?: string | null; // Assuming you might add banner_url to profiles table
  bio?: string | null;
  website?: string | null;
  location?: string | null;
}

interface Creator {
  profile_id: string;
  subscription_tier_enabled: boolean;
  subscription_price_cents: number | null;
  subscription_interval: 'month' | 'year' | null;
  ai_call_enabled: boolean;
  personality_prompt: string;
  cartesia_voice_id: string;
  eleven_voice_id: string;
  is_demo: boolean;
  solana_address?: string | null;
  ethereum_address?: string | null;
  polygon_address?: string | null;
  bitcoin_address?: string | null;
  bank_account_number?: string | null;
  bank_routing_number?: string | null;
}

interface Subscription {
  id: string;
  status: 'active' | 'canceled';
  current_period_ends_at: string;
  provider_subscription_id: string;
}

const UnsubscribeModal = ({ isOpen, onClose, onConfirm, isUnsubscribing }: {
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm: () => void;
  isUnsubscribing: boolean;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border/80 bg-background [box-shadow:var(--brand-ring-money)]">
        <div className="px-6 pt-6 pb-4" style={{ background: 'var(--brand-grad-soft)' }}>
          <h2 className="font-display text-lg tracking-tight">Unsubscribe?</h2>
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
            You will lose access to exclusive content and features. This action cannot be undone.
          </p>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border/60 bg-muted/20">
          <Button variant="outline" className={brandCancelBtn} onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={onConfirm}
            className={brandPrimaryBtn}
            disabled={isUnsubscribing}
          >
            {isUnsubscribing ? 'Unsubscribing…' : 'Unsubscribe'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default function UserProfilePage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const usernameFromParams = params.username as string;
  const { session, profile: currentUserProfile, isLoading } = useUser();
  const { pulseEnabled } = usePulseUI();

  const isAuthenticated = session && currentUserProfile;

  const [activeTab, setActiveTab] = useState<'home' | 'explore' | 'shorts' | 'store'>(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('store')) return 'store';
    if (searchParams && searchParams.has('store')) return 'store';
    return 'home';
  });

  const [viewedProfile, setViewedProfile] = useState<Profile | null>(null);
  const [viewedCreator, setViewedCreator] = useState<Creator | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubscribeModalOpen, setIsSubscribeModalOpen] = useState(false);
  const [isUnsubscribing, setIsUnsubscribing] = useState(false);
  const [isUnsubscribeDialogOpen, setIsUnsubscribeDialogOpen] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState<number>(0);
  const [postsCount, setPostsCount] = useState(0);
  const [mediaCount, setMediaCount] = useState(0);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [hasProducts, setHasProducts] = useState(false);
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [isStoryRecorderOpen, setIsStoryRecorderOpen] = useState(false);
  const [storyVersion, setStoryVersion] = useState(0);
  const [isAgeVerificationOpen, setIsAgeVerificationOpen] = useState(false);
  const [hasVerifiedAge, setHasVerifiedAge] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [subscribeButtonGlow, setSubscribeButtonGlow] = useState(false);

  useEffect(() => {
    const onSubscribePulse = (e: Event) => {
      const id = (e as CustomEvent<{ creatorProfileId: string }>).detail?.creatorProfileId;
      if (!viewedProfile?.id || id !== viewedProfile.id) return;
      setSubscribeButtonGlow(true);
      window.setTimeout(() => setSubscribeButtonGlow(false), 650);
    };
    window.addEventListener(BLABBER_SUBSCRIBE_BUTTON_PULSE, onSubscribePulse);
    return () => window.removeEventListener(BLABBER_SUBSCRIBE_BUTTON_PULSE, onSubscribePulse);
  }, [viewedProfile?.id]);

  const handleStoryComplete = () => {
    setIsStoryRecorderOpen(false);
    setStoryVersion(v => v + 1);
  };

  const handleAgeVerification = () => {
    setHasVerifiedAge(true);
    setIsAgeVerificationOpen(false);
  };

  const fetchSubscriberCount = async (creatorId: string) => {
    const { count, error: countError } = await supabase
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', creatorId)
      .eq('status', 'active');

    if (!countError && count !== null) {
      setSubscriberCount(count);
    }
  };

  const fetchProductCount = async (creatorId: string) => {
    const { count, error: countError } = await supabase
      .from('creator_products')
      .select('*', { count: 'exact', head: true })
      .eq('creator_profile_id', creatorId)
      .eq('is_active', true);

    if (!countError && count !== null) {
      setHasProducts(count > 0);
    }
  };

  const fetchProfileStats = async (userId: string) => {
    const [postsRes, mediaRes] = await Promise.all([
      supabase.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('post_media').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    ]);
    if (!postsRes.error && postsRes.count != null) setPostsCount(postsRes.count);
    if (!mediaRes.error && mediaRes.count != null) setMediaCount(mediaRes.count);
  };

  const renderTabs = () => {
    const isOwnProfile = session && currentUserProfile?.id === viewedProfile?.id;
    
    return (
      <div className="flex border-b border-border mb-4">
        <button type="button" onClick={() => setActiveTab('home')} className={profileTabClass(activeTab === 'home')}>
          <LayoutGrid className="h-4 w-4 shrink-0" />
          Posts
        </button>
        <button type="button" onClick={() => setActiveTab('shorts')} className={profileTabClass(activeTab === 'shorts')}>
          <Film className="h-4 w-4 shrink-0" />
          Shorts
        </button>
        {(isOwnProfile || hasProducts) && (
          <button type="button" onClick={() => setActiveTab('store')} className={profileTabClass(activeTab === 'store')}>
            <ShoppingBag className="h-4 w-4 shrink-0" />
            Store
          </button>
        )}
      </div>
    );
  };

  const fetchSubscription = async () => {
    if (!session?.user || !viewedProfile) return;

    const { data: subscriptionData, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('follower_id', session.user.id)
      .eq('following_id', viewedProfile.id)
      .eq('status', 'active')
      .single();

    if (!subscriptionError && subscriptionData) {
      setSubscription(subscriptionData as Subscription);
    } else {
      setSubscription(null);
    }
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setViewedProfile(null);
    setViewedCreator(null);
    setSubscription(null);
    setError(null);
    setSubscriberCount(0);
    setPostsCount(0);
    setMediaCount(0);
    setHasProducts(false);

    const fetchData = async () => {
      if (!mounted) return;

      // Fetch profile of the user whose page is being viewed
      if (usernameFromParams) {
        const { data: viewedProfData, error: viewedProfError } = await supabase
          .from('profiles')
          .select('*')
          .eq('username', usernameFromParams)
          .single();
        
        if (viewedProfError && mounted) {
          setError('User not found or an error occurred.');
          console.error("Viewed profile error:", viewedProfError.message);
        } else if (viewedProfData && mounted) {
          setViewedProfile(viewedProfData as Profile);
          
          // Fetch creator data if profile exists
          const { data: creatorData, error: creatorError } = await supabase
            .from('creators')
            .select('*, is_demo')
            .eq('profile_id', viewedProfData.id)
            .single();
            
          if (!creatorError && creatorData && mounted) {
            setViewedCreator(creatorData as Creator);
            // Fetch subscriber count when we have the creator data
            await fetchSubscriberCount(viewedProfData.id);
          }
          
          // Fetch product count for store tab visibility
          await fetchProductCount(viewedProfData.id);
          await fetchProfileStats(viewedProfData.id);
        }
      } else if (mounted) {
        setError("No username provided in URL.");
      }
      
      if (mounted) setLoading(false);
    };

    fetchData();

    return () => {
      mounted = false;
    };
  }, [supabase, usernameFromParams, router]);

  // Separate useEffect for subscription fetching
  useEffect(() => {
    if (session?.user && viewedProfile) {
      fetchSubscription();
    } else {
      setSubscription(null);
    }
  }, [session, viewedProfile]);

  // Reset age verification when viewing a different profile
  useEffect(() => {
    setHasVerifiedAge(false);
    setIsAgeVerificationOpen(false);
  }, [usernameFromParams]);

  // Show age verification for unauthenticated users
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !hasVerifiedAge) {
      setIsAgeVerificationOpen(true);
    }
  }, [isLoading, isAuthenticated, hasVerifiedAge, usernameFromParams]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleUnsubscribe = async () => {
    if (!subscription || !session?.user) return;

    try {
      setIsUnsubscribing(true);

      // Update subscription status in database
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          status: 'canceled',
          canceled_at: new Date().toISOString(),
        })
        .eq('id', subscription.id);

      if (updateError) throw updateError;

      // Cancel the subscription in Stripe
      const response = await fetch('/api/stripe/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptionId: subscription.provider_subscription_id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to cancel subscription in Stripe');
      }

      setSubscription(null);
      // Refresh subscriber count after unsubscribe
      if (viewedProfile) {
        await fetchSubscriberCount(viewedProfile.id);
      }
      toast.success('Successfully unsubscribed');
    } catch (error) {
      console.error('Error unsubscribing:', error);
      toast.error('Failed to unsubscribe. Please try again.');
    } finally {
      setIsUnsubscribing(false);
      setIsUnsubscribeDialogOpen(false);
    }
  };

  const handleBlockUser = async () => {
    if (!session?.user || !currentUserProfile || !viewedProfile) return;
    if (currentUserProfile.id === viewedProfile.id) {
      toast.error("You can't block yourself.");
      setIsBlockDialogOpen(false);
      return;
    }
    setIsBlocking(true);
    try {
      const { error } = await supabase.from('blocked_users').insert({
        blocker_profile_id: currentUserProfile.id,
        blockee_profile_id: viewedProfile.id,
      });
      if (error) throw error;
      toast.success('User blocked successfully');
      router.push('/home');
    } catch (err) {
      toast.error('Failed to block user.');
    } finally {
      setIsBlocking(false);
      setIsBlockDialogOpen(false);
    }
  };

  // Helper to get the profile URL for sharing
  const getProfileUrl = () => {
    if (!viewedProfile?.username) return '';
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/u/${viewedProfile.username}`;
    }
    return `https://blabber.ai/u/${viewedProfile.username}`;
  };

  const formatSubPrice = () => {
    if (!viewedCreator?.subscription_price_cents || !viewedCreator.subscription_interval) return null;
    const dollars = (viewedCreator.subscription_price_cents / 100).toFixed(2);
    const interval = viewedCreator.subscription_interval === 'year' ? 'yr' : 'mo';
    return `$${dollars}/${interval}`;
  };

  let mainPageContent;
  if (loading || isLoading) {
    mainPageContent = <ProfilePageSkeleton />;
  } else if (error && !viewedProfile) {
    mainPageContent = (
      <main className="min-h-screen bg-background flex justify-center items-center px-4">
        <div className="admin-card max-w-md w-full p-6 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </main>
    );
  } else if (!viewedProfile) {
    mainPageContent = (
      <main className="min-h-screen bg-background flex justify-center items-center px-4">
        <div className="admin-card max-w-md w-full p-6 text-center">
          <p className="font-display text-lg tracking-tight mb-1">User not found</p>
          <p className="text-sm text-muted-foreground">This profile may have been removed or the username changed.</p>
        </div>
      </main>
    );
  } else {
    // viewedProfile is available
    const isOwnProfile = session && currentUserProfile?.id === viewedProfile.id;
    mainPageContent = (
      <main className="min-h-screen bg-background flex flex-col">
        <PageHeader
          title={isOwnProfile ? 'My profile' : (viewedProfile.full_name || viewedProfile.username || 'Profile')}
          rightActions={
            isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full shrink-0">
                    <MoreVertical size={20} className="text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-2xl border-border/80">
                  <DropdownMenuItem onClick={() => setIsShareModalOpen(true)}>
                    Share profile
                  </DropdownMenuItem>
                  {!isOwnProfile && (
                    <DropdownMenuItem
                      onClick={() => setIsBlockDialogOpen(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      Block user
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null
          }
        />

        <Dialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
          <DialogContent className="gap-0 overflow-hidden rounded-2xl border-border/80 p-0 sm:max-w-md [box-shadow:var(--brand-ring-money)]">
            <div className="px-6 pt-6 pb-4" style={{ background: 'var(--brand-grad-soft)' }}>
              <DialogHeader className="space-y-1.5 p-0 text-left">
                <DialogTitle className="font-display text-lg tracking-tight">Block user</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Are you sure you want to block this user? You will no longer see their content and they won&apos;t be able to interact with you.
              </p>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-border/60 bg-muted/20">
              <Button variant="outline" className={brandCancelBtn} onClick={() => setIsBlockDialogOpen(false)} disabled={isBlocking}>
                Cancel
              </Button>
              <Button className={brandDestructiveBtn} onClick={handleBlockUser} disabled={isBlocking}>
                {isBlocking ? 'Blocking…' : 'Block'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="max-w-[760px] mx-auto w-full pb-16">
          {viewedProfile.banner_url ? (
            <div
              className="relative h-[200px] overflow-hidden bg-muted bg-cover bg-center"
              style={{ backgroundImage: `url(${viewedProfile.banner_url})` }}
            />
          ) : (
            <div
              className="relative h-[200px] overflow-hidden [background:var(--brand-grad)]"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(135deg, oklch(0.5 0.08 320 / 0.10) 0 2px, transparent 2px 11px), linear-gradient(135deg, var(--brand-violet), var(--brand-pink))',
              }}
            />
          )}

          <div className="px-6">
            <div className="flex items-end justify-between gap-4 flex-wrap -mt-11 mb-3.5">
              <div className="rounded-full border-4 border-background shrink-0">
                <Avatar
                  key={storyVersion}
                  className="w-[104px] h-[104px] bg-muted"
                  profileId={viewedProfile.id}
                  isOwnProfilePage={isOwnProfile!}
                  onPlusClick={() => setIsStoryRecorderOpen(true)}
                  data-pulse-earning-target={viewedProfile.id}
                >
                  <AvatarImage src={viewedProfile.avatar_url || undefined} alt={viewedProfile.full_name || viewedProfile.username || 'User avatar'} />
                  <AvatarFallback className="text-3xl font-display">
                    {(viewedProfile.full_name || viewedProfile.username || 'U').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>

              <div className="flex items-center gap-2 flex-wrap pb-1">
                {session && isOwnProfile && (
                  <AdminGhostButton className="h-[42px] px-5" onClick={() => router.push('/profile-settings')}>
                    <Settings className="h-4 w-4" />
                    Edit profile
                  </AdminGhostButton>
                )}
                {session && !isOwnProfile && (
                  <>
                    {viewedCreator?.ai_call_enabled && (
                      <AdminGhostButton
                        className="h-[42px] px-4 profile-call-attention"
                        onClick={() => setIsCallModalOpen(true)}
                      >
                        <Phone className="h-4 w-4" />
                        Call
                      </AdminGhostButton>
                    )}
                    <AdminGhostButton
                      className="h-[42px] w-[42px] p-0 rounded-full"
                      onClick={async () => {
                        if (!session || !currentUserProfile || !viewedProfile) return;
                        const supabase = createClient();
                        const { data: existingConvs, error } = await supabase
                          .from('conversation_participants')
                          .select('conversation_id, conversation:conversations(is_group, participants:conversation_participants(user_id))')
                          .eq('user_id', currentUserProfile.id);
                        if (!error && existingConvs) {
                          for (const row of existingConvs) {
                            let conv = row.conversation;
                            // @ts-expect-error supabase nested relation shape
                            if (Array.isArray(conv)) conv = conv[0];
                            if (!conv || Array.isArray(conv) || typeof conv !== 'object') continue;
                            const c: any = conv;
                            if (
                              c &&
                              c.is_group === false &&
                              Array.isArray(c.participants) &&
                              c.participants.length === 2
                            ) {
                              const hasOther = c.participants.some((p: any) => p.user_id === viewedProfile.id);
                              if (hasOther) {
                                router.push(`/messages/${row.conversation_id}`);
                                return;
                              }
                            }
                          }
                        }
                        const newConversationId = crypto.randomUUID();
                        const { error: convError } = await supabase
                          .from('conversations')
                          .insert({ id: newConversationId, is_group: false });
                        if (convError) {
                          console.error('Error creating conversation:', convError);
                          return;
                        }
                        const { error: currentParticipantError } = await supabase
                          .from('conversation_participants')
                          .insert({ conversation_id: newConversationId, user_id: currentUserProfile.id });
                        if (currentParticipantError) {
                          console.error('Error adding current conversation participant:', currentParticipantError);
                          return;
                        }
                        const { error: otherParticipantError } = await supabase
                          .from('conversation_participants')
                          .insert({ conversation_id: newConversationId, user_id: viewedProfile.id });
                        if (otherParticipantError) {
                          console.error('Error adding other conversation participant:', otherParticipantError);
                          return;
                        }
                        router.push(`/messages/${newConversationId}`);
                      }}
                    >
                      <MessageSquare className="h-4 w-4" />
                    </AdminGhostButton>
                    {viewedCreator?.subscription_tier_enabled && viewedCreator.subscription_price_cents && viewedCreator.subscription_interval && (
                      <PulseGlow className="rounded-full" active={pulseEnabled && subscribeButtonGlow}>
                        {subscription ? (
                          <AdminGhostButton
                            className={cn('h-[42px] px-5 font-semibold', pulseEnabled && 'pulse-money-btn')}
                            onClick={() => setIsUnsubscribeDialogOpen(true)}
                            disabled={isUnsubscribing}
                          >
                            Subscribed ✓
                          </AdminGhostButton>
                        ) : (
                          <AdminGradButton
                            className={cn('h-[42px] px-5 text-[14.5px]', pulseEnabled && 'pulse-money-btn')}
                            onClick={() => setIsSubscribeModalOpen(true)}
                          >
                            Subscribe{formatSubPrice() ? ` · ${formatSubPrice()}` : ''}
                          </AdminGradButton>
                        )}
                      </PulseGlow>
                    )}
                  </>
                )}
                {!isAuthenticated && (
                  <>
                    {viewedCreator?.ai_call_enabled && (
                      <AdminGhostButton className="h-[42px] w-[42px] p-0 rounded-full profile-call-attention" onClick={() => router.push('/home')}>
                        <Phone className="h-4 w-4" />
                      </AdminGhostButton>
                    )}
                    <AdminGhostButton className="h-[42px] w-[42px] p-0 rounded-full" onClick={() => router.push('/home')}>
                      <MessageSquare className="h-4 w-4" />
                    </AdminGhostButton>
                    <AdminGradButton className={cn('h-[42px] px-5', pulseEnabled && 'pulse-money-btn')} onClick={() => router.push('/home')}>
                      Subscribe
                    </AdminGradButton>
                  </>
                )}
              </div>
            </div>

            <h2 className="font-display text-2xl tracking-tight leading-tight">
              {viewedProfile.full_name || viewedProfile.username}
            </h2>
            {viewedProfile.username && (
              <Link
                href={`/u/${viewedProfile.username}`}
                className="block text-sm text-muted-foreground mt-0.5 hover:text-[var(--brand-pink)] hover:underline"
              >
                @{viewedProfile.username}
              </Link>
            )}
            {viewedProfile.bio && (
              <p className="text-[14.5px] leading-relaxed mt-3 max-w-[520px] text-foreground/90 whitespace-pre-wrap">
                {viewedProfile.bio}
              </p>
            )}
            <div className="flex flex-wrap gap-x-[18px] gap-y-1.5 text-[13px] text-muted-foreground mt-3 mb-4">
              {viewedProfile.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {viewedProfile.location}
                </span>
              )}
              {viewedProfile.website && (
                <a
                  href={viewedProfile.website.startsWith('http') ? viewedProfile.website : `https://${viewedProfile.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-semibold text-[var(--brand-pink)] hover:underline"
                >
                  <Link2 className="h-3.5 w-3.5 shrink-0" />
                  {viewedProfile.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>

            <div className="admin-card flex items-stretch py-3.5 px-2.5 mb-[18px]">
              <ProfileStat
                value={viewedCreator ? formatCompactCount(subscriberCount) : '—'}
                label="subscribers"
              />
              <span className="w-px bg-border self-stretch shrink-0" aria-hidden />
              <ProfileStat value={formatCompactCount(postsCount)} label="posts" />
              <span className="w-px bg-border self-stretch shrink-0" aria-hidden />
              <ProfileStat value={formatCompactCount(mediaCount)} label="media" />
            </div>

            {renderTabs()}
            {activeTab === 'store' ? (
              <CreatorStore
                creatorProfileId={viewedProfile.id}
                isOwnStore={!!isOwnProfile}
                isDemo={viewedCreator?.is_demo}
              />
            ) : (
              <Feed profileUserId={viewedProfile.id} key={viewedProfile.id} activeTab={activeTab} />
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <RequireAuth allowAnonymous>
      {mainPageContent}
      {viewedCreator && viewedCreator.subscription_price_cents && viewedCreator.subscription_interval && (
        <SubscribeModal
          isOpen={isSubscribeModalOpen}
          onClose={() => setIsSubscribeModalOpen(false)}
          creator={{
            id: viewedCreator.profile_id,
            name: viewedProfile?.full_name || viewedProfile?.username || undefined,
            subscription_price_cents: viewedCreator.subscription_price_cents,
            subscription_interval: viewedCreator.subscription_interval,
          }}
          isDemo={viewedCreator.is_demo}
          onSubscriptionSuccess={async () => {
            await fetchSubscription();
            if (viewedProfile) {
              await fetchSubscriberCount(viewedProfile.id);
            }
          }}
        />
      )}
      <UnsubscribeModal
        isOpen={isUnsubscribeDialogOpen}
        onClose={() => setIsUnsubscribeDialogOpen(false)}
        onConfirm={handleUnsubscribe}
        isUnsubscribing={isUnsubscribing}
      />
      {viewedCreator && (
        <CallModal
          isOpen={isCallModalOpen}
          onClose={() => setIsCallModalOpen(false)}
          personalityPrompt={viewedCreator.personality_prompt}
          elevenVoiceId={viewedCreator.eleven_voice_id}
          creatorId={viewedCreator.profile_id}
          isDemo={viewedCreator.is_demo}
        />
      )}
      {viewedProfile && (
        <StoryRecorder
          isOpen={isStoryRecorderOpen}
          onClose={() => setIsStoryRecorderOpen(false)}
          onComplete={handleStoryComplete}
          profileId={viewedProfile.id}
        />
      )}
      <AgeVerificationModal
        isOpen={isAgeVerificationOpen}
        onClose={() => setIsAgeVerificationOpen(false)}
        onVerified={handleAgeVerification}
      />
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        postUrl={getProfileUrl()}
      />
    </RequireAuth>
  );
} 
