'use client';

import Link from 'next/link';
import { RemoteImage } from '@/components/ui/remote-image';
import { Post, UserQuizAttempt, CommentType, Profile } from '@/lib/types'; // Add CommentType, Profile
import { formatRelativeTime } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'; // Using Card for structure
import { Textarea } from '@/components/ui/textarea'; // Added Textarea import
import { MessageCircle, Heart, Repeat, DollarSign, Bookmark, SendHorizonalIcon, Loader2 as LoaderIcon, XIcon, Lock, MoreHorizontal, Trash2, Send } from 'lucide-react'; // Icons for like, comment, tip, REPEAT, and BOOKMARK
import Carousel from '@/components/ui/carousel'; // Import the Carousel component
import MuxPlayer from '@mux/mux-player-react/lazy';
import React, { useState, useEffect, useRef, useTransition, forwardRef } from 'react'; // Import useState, useEffect, useRef, useTransition
import { useRouter } from 'next/navigation';

import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import Zoom from "yet-another-react-lightbox/plugins/zoom"; // Re-enable Zoom plugin
// We still need to find the correct CSS path for Zoom if it's not bundled
// For now, let's assume its JS is enough or main CSS covers it, pending previous error.

import { PollDisplay } from './PollDisplay'; // Added import
import { QuizDisplay } from './QuizDisplay'; // Added import
import { CommentItem } from './CommentItem'; // Import CommentItem

// Import server actions
import { toggleLikePost, toggleBookmarkPost, fetchComments, addComment, deletePost } from '@/app/actions/postActions';
import { createPostLikeNotification, createPostCommentNotification, createCommentReplyNotification } from '@/app/actions/notificationActions';
import { toast } from 'sonner'; // For displaying error/success messages
import { useUser } from '@/lib/contexts/user-context';
import { useCreditMonetization } from '@/lib/contexts/credit-monetization-context';
import { formatUsdWithCreditsSuffix } from '@/lib/credits/monetization-display';
import { createClient } from '@/lib/supabase/client';
import { computeHasFullPostAccess, publicPostImageUrl } from '@/lib/feed/post-access';
import { SubscribeModal } from '@/components/subscription/SubscribeModal';
import { PPVModal } from '@/components/subscription/PPVModal';
import { TipModal } from '@/components/subscription/TipModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SharePostDialog, DeletePostDialog } from './feed-post-dialogs';
import { FeedSubscribeGateDialog, FeedUnlockGateDialog } from './post-access-dialogs';
import {
  FeedPaywallActions,
  FeedPaywallOverlay,
  FeedPaywallPlaceholder,
  feedPaywallFrameClass,
} from './feed-paywall-ui';

interface FeedItemShortProps {
  post: Post;
  onPostDelete?: () => void;
  shouldPlay?: boolean; // New prop
  shouldRender?: boolean; // Optional prop to control rendering of the video player
  // currentUserProfile might be needed for optimistic comment updates if not globally available
  // currentUserProfile?: Profile | null; 
}

export function FeedItemShort({ post, onPostDelete, shouldPlay = true, shouldRender = true }: FeedItemShortProps) {
  const router = useRouter();
  const { profile } = useUser();
  const isOwnPost = profile?.id === post.user_id;
  const creator = post.profiles; // Creator profile is nested
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0); // For single image, index is 0
  const [lightboxSlidesState, setLightboxSlidesState] = useState<{src: string}[]>([]); // State for current lightbox slides

  // State for optimistic updates
  const [isLiked, setIsLiked] = useState(post.user_has_liked);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [isBookmarked, setIsBookmarked] = useState(post.user_has_bookmarked);
  const [bookmarkCount, setBookmarkCount] = useState(post.bookmark_count);
  const [currentCommentCount, setCurrentCommentCount] = useState(post.comment_count); // For optimistic updates
  const [isLiking, setIsLiking] = useState(false);
  const [isBookmarking, setIsBookmarking] = useState(false);
  const [isTransitioning, startTransition] = useTransition(); // General transition

  // Comment section state
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CommentType[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  // State for replying to a specific comment
  const [replyingToCommentInfo, setReplyingToCommentInfo] = useState<{ id: string; username: string; userId: string } | null>(null);

  // State for live stream status and metadata
  const [liveStreamStatus, setLiveStreamStatus] = useState<string | undefined>(() => {
    const liveStreamMedia = post.post_media?.find(media => media.media_type === 'live_stream');
    return liveStreamMedia?.metadata?.status;
  });
  const [liveStreamMeta, setLiveStreamMeta] = useState<any>(() => {
    const liveStreamMedia = post.post_media?.find(media => media.media_type === 'live_stream');
    return liveStreamMedia?.metadata;
  });

  // State for subscribe modal
  const [isSubscribeGateOpen, setIsSubscribeGateOpen] = useState(false);
  const [isUnlockGateOpen, setIsUnlockGateOpen] = useState(false);
  const [isSubscribeModalOpen, setIsSubscribeModalOpen] = useState(false);

  // State for creator details
  const [creatorDetails, setCreatorDetails] = useState<any | null>(null);
  const [isLoadingCreator, setIsLoadingCreator] = useState(false);

  // Add new state for subscription status
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(false);

  // Add new state for PPV
  const [isPPVModalOpen, setIsPPVModalOpen] = useState(false);
  const [hasPPVAccess, setHasPPVAccess] = useState(false);
  const [isCheckingPPV, setIsCheckingPPV] = useState(false);

  // Add new state for tip
  const [isTipModalOpen, setIsTipModalOpen] = useState(false);
  const [tipAmount, setTipAmount] = useState<number>(0);
  const [hasCreatorRecord, setHasCreatorRecord] = useState<boolean>(false);
  const [isCreatorDemo, setIsCreatorDemo] = useState<boolean>(false);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const dialogCleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const supabase = createClient();
  const { creditOnlyEcosystem, pricePerCreditCents } = useCreditMonetization();
  const ppvPriceLabel = (cents: number) =>
    formatUsdWithCreditsSuffix(cents, creditOnlyEcosystem, pricePerCreditCents);

  const hasFullAccess = computeHasFullPostAccess({
    accessLevel: post.access_level,
    isOwnPost,
    isAdmin: profile?.isAdmin,
    isAllAccess: profile?.isAllAccess,
    isSubscribed,
    hasPPVAccess,
  });

  const creatorDisplayName = creator.full_name || creator.username || 'this creator';
  const subscriptionPriceCents =
    post.creator?.subscription_price_cents ?? creatorDetails?.subscription_price_cents ?? 0;
  const subscriptionInterval =
    post.creator?.subscription_interval ?? creatorDetails?.subscription_interval ?? 'month';
  const subscriptionIntervalLabel = subscriptionInterval === 'year' ? 'yearly' : 'monthly';

  const handleSubscribePaywallClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!post.creator && !creatorDetails) {
      await fetchCreatorDetails();
    }
    setIsSubscribeGateOpen(true);
  };

  const handleUnlockPaywallClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsUnlockGateOpen(true);
  };

  const muxPlayerRef = useRef<any>(null); // Ref for MuxPlayer
  const isMountedRef = useRef(true); // Track if component is mounted

  // Cleanup function to ensure pointer-events are restored
  const cleanupPointerEvents = () => {
    if (dialogCleanupTimeoutRef.current) {
      clearTimeout(dialogCleanupTimeoutRef.current);
    }
    dialogCleanupTimeoutRef.current = setTimeout(() => {
      document.body.style.removeProperty('pointer-events');
    }, 100);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (dialogCleanupTimeoutRef.current) {
        clearTimeout(dialogCleanupTimeoutRef.current);
      }
      document.body.style.removeProperty('pointer-events');
      // (Removed forcibly removing mux player, as it doesn't help and may cause issues)
    };
  }, []);

  // Effect to update local state if post prop changes (e.g., due to parent re-fetch after revalidation)
  useEffect(() => {
    if (!isMountedRef.current) return;
    setIsLiked(post.user_has_liked);
    setLikeCount(post.like_count);
    setIsBookmarked(post.user_has_bookmarked);
    setBookmarkCount(post.bookmark_count);
    setCurrentCommentCount(post.comment_count); // Initialize comment count

    // Check if post author has a creator record
    const checkCreatorRecord = async () => {
      const { data, error } = await supabase
        .from('creators')
        .select('profile_id, is_demo')
        .eq('profile_id', post.user_id)
        .maybeSingle();
      
      setHasCreatorRecord(!error && !!data);
      setIsCreatorDemo(data?.is_demo || false);
    };

    checkCreatorRecord();
  }, [post.user_has_liked, post.like_count, post.user_has_bookmarked, post.bookmark_count, post.comment_count, post.user_id]);

  useEffect(() => {
    // Only subscribe for live_stream posts
    const liveStreamMedia = post.post_media?.find(media => media.media_type === 'live_stream');
    if (!liveStreamMedia) return;
    const subscription = supabase
      .channel(`post_media:${liveStreamMedia.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'post_media',
          filter: `id=eq.${liveStreamMedia.id}`,
        },
        (payload) => {
          if (payload.new && payload.new.metadata) {
            setLiveStreamStatus(payload.new.metadata.status);
            setLiveStreamMeta(payload.new.metadata);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(subscription);
    };
  }, [post.post_media]);

  // Add function to check subscription status
  const checkSubscriptionStatus = async () => {
    if (!profile?.id || !post.user_id) return;
    setIsCheckingSubscription(true);
    const { data, error } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('follower_id', profile.id)
      .eq('following_id', post.user_id)
      .eq('status', 'active')
      .maybeSingle();
    setIsCheckingSubscription(false);
    setIsSubscribed(!!data);
  };

  // Add effect to check subscription status when needed
  useEffect(() => {
    if (post.access_level === 'subscribers_only' && !isOwnPost && profile?.id) {
      checkSubscriptionStatus();
    }
  }, [post.access_level, post.user_id, profile?.id, isOwnPost]);

  // Add function to check PPV access
  const checkPPVAccess = async () => {
    if (!profile?.id || !post.id) return;
    setIsCheckingPPV(true);
    const { data, error } = await supabase
      .from('ppv_transactions')
      .select('id')
      .eq('user_id', profile.id)
      .eq('post_id', post.id)
      .eq('status', 'succeeded')
      .maybeSingle();
    setIsCheckingPPV(false);
    setHasPPVAccess(!!data);
  };

  // Add effect to check PPV access when needed
  useEffect(() => {
    if (post.access_level === 'ppv' && !isOwnPost && profile?.id) {
      checkPPVAccess();
    }
  }, [post.access_level, post.id, profile?.id, isOwnPost]);

  // Add this after other useEffect hooks
  useEffect(() => {
    const fetchTipAmount = async () => {
      const { data, error } = await supabase
        .from('tip_transactions')
        .select('amount_cents')
        .eq('post_id', post.id)
        .eq('status', 'succeeded');

      if (!error && data) {
        const totalCents = data.reduce((sum, transaction) => sum + transaction.amount_cents, 0);
        setTipAmount(totalCents);
      }
    };

    fetchTipAmount();
  }, [post.id]);

  const handleStartReply = (commentToReply: CommentType) => {
    setReplyingToCommentInfo({
      id: commentToReply.id,
      username: commentToReply.profiles.username || 'user',
      userId: commentToReply.user_id
    });
    setNewCommentText(`@${commentToReply.profiles.username || 'user'} `);
    if (!showComments) {
        setShowComments(true); // Ensure comment section is open
    }
    // Delay focus slightly to ensure textarea is visible and ready
    setTimeout(() => commentInputRef.current?.focus(), 0);
  };

  const handleCancelReply = () => {
    setReplyingToCommentInfo(null);
    setNewCommentText('');
  };

  const handleLike = async () => {
    if (isLiking) return;
    setIsLiking(true);

    const originalLiked = isLiked;
    const originalLikeCount = likeCount;

    // Optimistic update
    setIsLiked(!originalLiked);
    setLikeCount(originalLiked ? originalLikeCount - 1 : originalLikeCount + 1);

    startTransition(async () => {
      try {
        const result = await toggleLikePost(post.id);
        if (result.success) {
          setIsLiked(result.newLikeState!);
          setLikeCount(result.newLikeCount!);
          
          // Create notification when liking (not when unliking)
          if (result.newLikeState && !originalLiked && !isOwnPost && profile?.username) {
            try {
              await createPostLikeNotification({
                postCreatorId: post.user_id,
                likerId: profile.id,
                likerUsername: profile.username,
                postId: post.id
              });
            } catch (notificationError) {
              console.error('Failed to create like notification:', notificationError);
              // Don't show error to user as the like was successful
            }
          }
        } else {
          // Revert optimistic update on failure
          setIsLiked(originalLiked);
          setLikeCount(originalLikeCount);
          toast.error(result.error || "Failed to update like status.");
        }
      } catch (error) {
        setIsLiked(originalLiked);
        setLikeCount(originalLikeCount);
        toast.error("An error occurred while liking the post.");
        console.error("Like error:", error);
      }
      setIsLiking(false);
    });
  };

  const handleCommentToggle = async () => {
    const newShowCommentsState = !showComments;
    setShowComments(newShowCommentsState);
    if (newShowCommentsState && comments.length === 0 && post.comment_count > 0) { 
      setIsLoadingComments(true);
      startTransition(async () => {
        const result = await fetchComments(post.id);
        if (result.success && result.comments) {
          setComments(result.comments);
        } else {
          toast.error(result.error || 'Failed to load comments.');
          // setShowComments(false); // Don't close if fetch fails, user might want to see input
        }
        setIsLoadingComments(false);
      });
    }
  };

  const handleNewCommentSubmit = async (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (!newCommentText.trim() || isSubmittingComment) return;

    setIsSubmittingComment(true);
    const tempId = `temp-${Date.now()}`;
    const originalCommentText = newCommentText.trim(); // Trimmed text for submission
    const isReply = !!replyingToCommentInfo;
    const parentId = replyingToCommentInfo?.id || null;

    // Optimistic update
    if (!isReply) {
      const optimisticComment: CommentType = {
        id: tempId,
        post_id: post.id,
        text_content: originalCommentText,
        created_at: new Date().toISOString(),
        user_id: "current_user_placeholder_id", 
        profiles: { id: "", username: "You", full_name: "You", avatar_url: "" }, 
        parent_comment_id: null,
        like_count: 0,
        reply_count: 0,
        user_has_liked_comment: false,
      };
      setComments(prev => [...prev, optimisticComment]);
      setCurrentCommentCount(prev => prev + 1); // Post's total count
    } else {
      // Parent comment's reply_count
      setComments(prevComments => 
        prevComments.map(c => 
          c.id === parentId 
            ? { ...c, reply_count: (c.reply_count || 0) + 1 } 
            : c
        )
      );
      setCurrentCommentCount(prev => prev + 1); // Post's total count also increments for a reply
    }
    
    setNewCommentText('');
    const replyingToUsername = replyingToCommentInfo?.username; // Store before clearing
    const replyingToUserId = replyingToCommentInfo?.userId; // Store before clearing
    const replyingToCommentId = replyingToCommentInfo?.id; // Store before clearing
    if (isReply) {
        handleCancelReply(); // Clear reply mode
    }

    startTransition(async () => {
      const result = await addComment(post.id, originalCommentText, parentId);
      if (result.success && result.comment) {
        if (isReply) {
           toast.success(`Replied to @${replyingToUsername}`);
           // Parent's reply_count was optimistically updated. Post's total comment_count also optimistically updated.
           // The new useEffect in CommentItem should handle refreshing its replies list if visible.
        } else { // Top-level comment success
          toast.success("Comment added!");
          setComments(prev => prev.map(c => c.id === tempId ? result.comment! : c));
          // Post's total comment_count was already optimistically updated.
          // No need to call setCurrentCommentCount here from result.
          
          // Create notification for top-level comments (not replies)
          if (!isReply && !isOwnPost && profile?.username) {
            try {
              await createPostCommentNotification({
                postCreatorId: post.user_id,
                commenterId: profile.id,
                commenterUsername: profile.username,
                postId: post.id
              });
            } catch (notificationError) {
              console.error('Failed to create comment notification:', notificationError);
              // Don't show error to user as the comment was successful
            }
          }
          
          // Create notification for comment replies
          if (isReply && !isOwnPost && profile?.username && replyingToUserId && replyingToCommentId) {
            try {
              await createCommentReplyNotification({
                commentAuthorId: replyingToUserId, // Use the stored comment author's user ID
                replierId: profile.id,
                replierUsername: profile.username,
                postId: post.id,
                commentId: replyingToCommentId
              });
            } catch (notificationError) {
              console.error('Failed to create comment reply notification:', notificationError);
              // Don't show error to user as the comment was successful
            }
          }
        }
      } else {
        toast.error(result.error || 'Failed to post.');
        // Revert optimistic updates
        if (!isReply) {
          setComments(prev => prev.filter(c => c.id !== tempId));
          setCurrentCommentCount(prev => prev - 1);
        }
        else {
             setComments(prevComments => 
                prevComments.map(c => 
                c.id === parentId 
                    ? { ...c, reply_count: (c.reply_count || 1) - 1 } // Revert increment
                    : c
                )
            );
        }
        setNewCommentText(originalCommentText); // Restore text
        if (isReply && replyingToUsername && replyingToUserId && replyingToCommentId) {
            setReplyingToCommentInfo({ id: replyingToCommentId, username: replyingToUsername, userId: replyingToUserId }); // Restore reply mode
            setNewCommentText(`@${replyingToUsername} ${originalCommentText}`);
        } else {
             setNewCommentText(originalCommentText);
        }
      }
      setIsSubmittingComment(false);
    });
  };

  const handleTip = () => {
    setIsTipModalOpen(true);
  };

  const handleBookmark = async () => {
    if (isBookmarking) return;
    setIsBookmarking(true);

    const originalBookmarked = isBookmarked;
    const originalBookmarkCount = bookmarkCount;

    // Optimistic update
    setIsBookmarked(!originalBookmarked);
    setBookmarkCount(originalBookmarked ? originalBookmarkCount - 1 : originalBookmarkCount + 1);

    startTransition(async () => {
      try {
        const result = await toggleBookmarkPost(post.id);
        if (result.success) {
          setIsBookmarked(result.newBookmarkState!);
          setBookmarkCount(result.newBookmarkCount!);
          // Optionally show a toast for bookmarking
          // toast.success(result.newBookmarkState ? "Post saved!" : "Post unsaved.");
        } else {
          // Revert optimistic update
          setIsBookmarked(originalBookmarked);
          setBookmarkCount(originalBookmarkCount);
          toast.error(result.error || "Failed to update bookmark status.");
        }
      } catch (error) {
        setIsBookmarked(originalBookmarked);
        setBookmarkCount(originalBookmarkCount);
        toast.error("An error occurred while bookmarking the post.");
        console.error("Bookmark error:", error);
      }
      setIsBookmarking(false);
    });
  };

  const fetchCreatorDetails = async () => {
    setIsLoadingCreator(true);
    const { data, error } = await supabase
      .from('creators')
      .select('profile_id, subscription_tier_enabled, subscription_price_cents, subscription_interval')
      .eq('profile_id', post.user_id)
      .maybeSingle();
    setIsLoadingCreator(false);
    if (!error && data) setCreatorDetails(data);
  };

  const handleDeletePost = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      const result = await deletePost(post.id);
      if (result.success) {
        toast.success('Post deleted successfully');
        router.refresh(); // Re-fetch server data like in NewPost
        if (onPostDelete) {
          onPostDelete(); // Trigger client-side feed refresh
        }
      } else {
        toast.error(result.error || 'Failed to delete post');
      }
    } catch (error) {
      console.error('Error deleting post:', error);
      toast.error('An unexpected error occurred while deleting the post');
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  const renderPostContent = () => {
    const videoMedia = post.post_media?.find(media => media.media_type === 'short');
    if (videoMedia?.mux_playback_id) {
      return (
        <div className={feedPaywallFrameClass} style={{ width: 'calc(78vh * 9/16)', height: '78vh' }}>
          <div className="relative mx-auto" style={{ width: 'calc(78vh * 9/16)', height: '78vh' }}>
            {!hasFullAccess ? (
              <>
                {videoMedia.blurred_storage_path ? (
                  <RemoteImage
                    src={publicPostImageUrl(videoMedia.blurred_storage_path)}
                    alt="Short preview"
                    fill
                    className="object-cover"
                    sizes="400px"
                  />
                ) : (
                  <FeedPaywallPlaceholder />
                )}
                <FeedPaywallOverlay className="z-[4]">
                  <FeedPaywallActions
                    accessLevel={post.access_level}
                    ppvPriceLabel={post.ppv_price_cents ? ppvPriceLabel(post.ppv_price_cents) : undefined}
                    onSubscribe={handleSubscribePaywallClick}
                    onUnlock={handleUnlockPaywallClick}
                    isCheckingSubscription={isCheckingSubscription}
                    isCheckingPPV={isCheckingPPV}
                    isLoadingCreator={isLoadingCreator}
                  />
                </FeedPaywallOverlay>
              </>
            ) : (
              shouldRender && (
                <MuxPlayer
                  loading="viewport"
                  ref={muxPlayerRef}
                  playbackId={videoMedia.mux_playback_id}
                  preferPlayback="mse"
                  streamType="on-demand"
                  className="absolute inset-0 w-full h-full"
                  autoPlay={shouldPlay}
                  paused={!shouldPlay}
                  muted={false}
                  loop={true}
                  metadata={{
                    video_title: "Short Video",
                    video_id: videoMedia.mux_playback_id,
                  }}
                  theme="minimal"
                  style={{
                    '--media-controls-display': 'none',
                    '--media-controls-background': 'transparent',
                    '--media-controls-padding': '0',
                    '--media-controls-margin': '0',
                    '--media-controls-opacity': '0',
                    '--media-controls-visibility': 'hidden',
                    '--fullscreen-button': 'none',
                    '--controls': 'none',
                  } as React.CSSProperties}
                />
              )
            )}
            {/* Vertical Interaction Buttons INSIDE video container */}
            <div className="absolute right-2 bottom-2 z-[8] flex flex-col items-center gap-2">
              <Button 
                variant="link" 
                size="icon" 
                onClick={handleLike} 
                disabled={isLiking}
                className={`h-12 w-12 text-white/80 hover:text-pink-500 rounded-full p-0 ${isLiked ? 'text-pink-500' : ''}`}>
                <Heart size={24} className={isLiked ? 'fill-current' : ''} />
              </Button>
              <Button 
                variant="link" 
                size="icon" 
                onClick={handleCommentToggle} 
                className="h-12 w-12 text-white/80 hover:text-blue-500 rounded-full p-0">
                <MessageCircle size={24} />
              </Button>
              {hasCreatorRecord && (
                <Button 
                  variant="link" 
                  size="icon" 
                  onClick={handleTip} 
                  className="h-12 w-12 text-white/80 hover:text-green-500 rounded-full p-0">
                  <DollarSign size={24} />
                </Button>
              )}
              <Button 
                variant="link" 
                size="icon" 
                onClick={handleBookmark} 
                disabled={isBookmarking}
                className={`h-12 w-12 text-white/80 hover:text-yellow-500 rounded-full p-0 ${isBookmarked ? 'text-yellow-500' : ''}`}>
                <Bookmark size={24} className={isBookmarked ? 'fill-current' : ''} />
              </Button>
              {/* Share button under bookmark */}
              <Button
                variant="link"
                size="icon"
                onClick={() => setIsShareModalOpen(true)}
                className="h-12 w-12 text-white/80 hover:text-blue-500 rounded-full p-0"
                aria-label="Share post"
              >
                <Send size={24} />
              </Button>
            </div>
          </div>
        </div>
      );
    } else if (videoMedia?.mux_upload_id) {
      // mux_upload_id is present, but no playback_id yet means it's processing
      return (
        <div className="mt-0 p-4 bg-muted rounded-lg border border-border aspect-video flex flex-col items-center justify-center">
          <p className="text-sm text-foreground/90 font-medium">Video is processing...</p>
          <p className="text-xs text-muted-foreground mt-1">It will be available shortly.</p>
        </div>
      );
    }
    return <p className="text-sm text-muted-foreground p-4 bg-muted rounded-md">[Video not available]</p>;
  };

  // Helper to get the direct post URL
  const getPostUrl = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/p/${post.id}`;
    }
    return '';
  };

  return (
    <Card className="overflow-hidden bg-transparent duration-200 p-0 rounded-none shadow-none border-t-0 border-l-0 border-r-0 border-b-0 border-border/60 gap-y-0">
      {/* Render Lightbox here, outside of the conditional rendering of post types, 
          so it's always available and its 'slides' prop can be updated from anywhere. */}
      {lightboxOpen && (
        <Lightbox
          open={lightboxOpen}
          close={() => setLightboxOpen(false)}
          slides={lightboxSlidesState}
          index={lightboxIndex}
          plugins={[Zoom]}
          render={{
            buttonPrev: lightboxSlidesState.length <= 1 ? () => null : undefined,
            buttonNext: lightboxSlidesState.length <= 1 ? () => null : undefined,
          }}
          animation={{ 
            fade: lightboxSlidesState.length <= 1 ? 0 : undefined,
            swipe: lightboxSlidesState.length <= 1 ? 0 : undefined
          }}
          controller={{
            closeOnBackdropClick: lightboxSlidesState.length > 0
          }}
        />
      )}
      <div className="relative px-4 py-4">
        {/* Creator Info Overlay */}
        <div className="absolute top-4 left-4 right-4 z-[5] bg-gradient-to-b from-black/60 to-transparent rounded-t-lg"  style={{ width: 'calc(78vh * 9/16)'}}>
          <div className="flex items-start justify-between p-4">
            <div className="flex items-center space-x-3">
              <Avatar
                className="h-10 w-10 border flex-shrink-0"
                profileId={creator.id}
                data-pulse-earning-target={creator.id}
              >
                <AvatarImage src={creator.avatar_url || undefined} alt={creator.full_name || creator.username || 'User'} />
                <AvatarFallback className="h-10 w-10"></AvatarFallback>
              </Avatar>
              <div>
                <Link href={`/u/${creator.username}`} className="hover:underline block">
                  <h4 className="text-sm font-semibold text-white leading-tight pb-1">{creator.full_name || creator.username}</h4>
                </Link>
                {creator.username && (
                  <span className="text-xs text-white/80 block">
                    @{creator.username}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-xs text-white/80 leading-tight">{formatRelativeTime(post.created_at)}</p>
              {(isOwnPost || profile?.isAdmin) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-white/80 hover:text-white">
                      <MoreHorizontal size={16} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setIsDeleteDialogOpen(true)}
                    >
                      <Trash2 size={16} className="mr-2" />
                      Delete Post
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>

        {/* Video Content */}
        <div className="relative" style={{ width: 'calc(78vh * 9/16)', height: '78vh' }}>
          {renderPostContent()}

          {/* Interaction Elements Overlay - Only show when comments are not active */}
          {!showComments && (
            <div className="absolute bottom-0 left-0 right-0 z-[5] bg-gradient-to-t from-black/60 to-transparent rounded-b-lg">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-0.4 text-xs text-white/80">
                  <span className="hover:underline cursor-pointer" onClick={handleCommentToggle}>
                    {currentCommentCount} Comments
                  </span>
                  <span className="text-white/50 mx-1">•</span>
                  <span className="hover:underline cursor-pointer" onClick={handleLike}>
                    {likeCount} Likes
                  </span>
                  {tipAmount > 0 && (
                    <>
                      <span className="text-white/50 mx-1">•</span>
                      <span className="text-white/80">
                        ${(tipAmount / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} in tips
                      </span>
                    </>
                  )}
                </div>
                {/* Bookmark button or other right-aligned actions can go here if needed */}
              </div>
            </div>
          )}

          {/* Comment Section Overlay */}
          {showComments && (
            <div className="absolute inset-0 z-[10] bg-black/90 backdrop-blur-sm rounded-md">
              <div className="h-full flex flex-col">
                {/* Comment Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/20">
                  <h3 className="text-white font-semibold">Comments ({currentCommentCount})</h3>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setShowComments(false)}
                    className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10"
                  >
                    <XIcon size={18} />
                  </Button>
                </div>

                {/* Comments List */}
                <div className="flex-1 overflow-y-auto">
                  {isLoadingComments && (
                    <div className="flex items-center justify-center py-4">
                      <LoaderIcon size={20} className="animate-spin text-white/80" /> 
                      <span className="ml-2 text-sm text-white/80">Loading comments...</span>
                    </div>
                  )}
                  {!isLoadingComments && comments.length === 0 && (
                    <p className="text-sm text-white/60 text-center py-3">No comments yet. Be the first!</p>
                  )}
                  {!isLoadingComments && comments.length > 0 && (
                    <div className="p-4 space-y-3">
                      {comments.map(comment => (
                        <CommentItem key={comment.id} comment={comment} onStartReply={handleStartReply} isShortOverlay={true} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Comment Input */}
                <div className="p-4 border-t border-white/20">
                  <form onSubmit={handleNewCommentSubmit} className="flex items-start space-x-2">
                    <Textarea
                      ref={commentInputRef}
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      placeholder={replyingToCommentInfo ? `Replying to @${replyingToCommentInfo.username}...` : "Add a comment..."}
                      rows={1}
                      className="flex-1 resize-none text-sm p-2 min-h-[40px] bg-white/10 border-white/20 text-white placeholder:text-white/60 focus-visible:ring-1 focus-visible:ring-white/50"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleNewCommentSubmit();
                        }
                      }}
                    />
                    <Button type="submit" size="icon" disabled={isSubmittingComment || !newCommentText.trim()} className="h-10 w-10 p-0 min-h-0 min-w-0 bg-white/10 hover:bg-white/20 text-white">
                      {isSubmittingComment ? <LoaderIcon size={16} className="animate-spin"/> : <SendHorizonalIcon size={16} />}
                    </Button>
                    {replyingToCommentInfo && (
                      <Button type="button" variant="ghost" size="icon" onClick={handleCancelReply} className="h-10 w-10 p-0 min-h-0 min-w-0 text-white/60 hover:text-white">
                        <XIcon size={18} />
                      </Button>
                    )}
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <FeedSubscribeGateDialog
        open={isSubscribeGateOpen}
        onOpenChange={setIsSubscribeGateOpen}
        creatorName={creatorDisplayName}
        priceLabel={ppvPriceLabel(subscriptionPriceCents)}
        intervalLabel={subscriptionIntervalLabel}
        isLoading={isLoadingCreator}
        onContinue={() => {
          setIsSubscribeGateOpen(false);
          setIsSubscribeModalOpen(true);
        }}
      />

      {post.access_level === 'ppv' && post.ppv_price_cents && (
        <FeedUnlockGateDialog
          open={isUnlockGateOpen}
          onOpenChange={setIsUnlockGateOpen}
          creatorName={creatorDisplayName}
          priceLabel={ppvPriceLabel(post.ppv_price_cents)}
          onContinue={() => {
            setIsUnlockGateOpen(false);
            setIsPPVModalOpen(true);
          }}
        />
      )}

      {/* Add SubscribeModal at the end of the component */}
      {(post.creator || creatorDetails) && (
        <SubscribeModal
          isOpen={isSubscribeModalOpen}
          onClose={() => setIsSubscribeModalOpen(false)}
          creator={{
            id: post.creator?.profile_id || creatorDetails?.profile_id || post.user_id,
            name: post.profiles.full_name || post.profiles.username || undefined,
            subscription_price_cents: post.creator?.subscription_price_cents ?? creatorDetails?.subscription_price_cents ?? 0,
            subscription_interval: post.creator?.subscription_interval ?? creatorDetails?.subscription_interval ?? 'month',
          }}
          isDemo={isCreatorDemo}
          onSubscriptionSuccess={async () => {
            setIsSubscribeModalOpen(false);
            // Refresh subscription status after successful subscription
            await checkSubscriptionStatus();
          }}
        />
      )}

      {/* Add PPVModal at the end of the component */}
      {post.access_level === 'ppv' && post.ppv_price_cents && (
        <PPVModal
          isOpen={isPPVModalOpen}
          onClose={() => setIsPPVModalOpen(false)}
          post={{
            id: post.id,
            ppv_price_cents: post.ppv_price_cents,
            creator: {
              id: post.user_id,
              name: post.profiles.full_name || post.profiles.username || undefined,
            },
          }}
          isDemo={isCreatorDemo}
          onPaymentSuccess={async () => {
            await checkPPVAccess();
          }}
        />
      )}

      <TipModal
        isOpen={isTipModalOpen}
        onClose={() => setIsTipModalOpen(false)}
        post={post}
        isDemo={isCreatorDemo}
        onPaymentSuccess={() => {
          // Refresh tip amount after successful payment
          const fetchTipAmount = async () => {
            const { data, error } = await supabase
              .from('tip_transactions')
              .select('amount_cents')
              .eq('post_id', post.id)
              .eq('status', 'succeeded');

            if (!error && data) {
              const totalCents = data.reduce((sum, transaction) => sum + transaction.amount_cents, 0);
              setTipAmount(totalCents);
            }
          };

          fetchTipAmount();
        }}
      />

      {/* Add Delete Confirmation Dialog */}
      <DeletePostDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        isDeleting={isDeleting}
        onConfirm={handleDeletePost}
      />

      <SharePostDialog
        open={isShareModalOpen}
        onOpenChange={setIsShareModalOpen}
        postUrl={getPostUrl()}
      />
    </Card>
  );
} 