'use client';

import Link from 'next/link';
import { RemoteImage } from '@/components/ui/remote-image';
// Note: Assuming `Profile` type from '@/lib/types' now includes optional `isAdmin` and `isAllAccess` booleans.
import { Post, UserQuizAttempt, CommentType, Profile } from '@/lib/types'; 
import { formatRelativeTime, cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  MessageCircle,
  Heart,
  DollarSign,
  Bookmark,
  Loader2 as LoaderIcon,
  Lock,
  MoreHorizontal,
  Trash2,
  Send,
  Pencil,
  Coins,
} from 'lucide-react';
import { FeedActionButton } from '@/components/feed/feed-action-button';
import { AIBadge } from '@/components/landing/_atoms';
import Carousel from '@/components/ui/carousel';
import React, { useState, useEffect, useRef, useTransition } from 'react';
import { LazyMuxFeedPlayer } from '@/components/feed/lazy-mux-feed-player';
import { PpvLiveStreamPlayer } from '@/components/feed/ppv-live-stream-player';
import { useRouter } from 'next/navigation';
import ReactPlayer from 'react-player';

import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import Zoom from "yet-another-react-lightbox/plugins/zoom";

import { PollDisplay } from './PollDisplay';
import { QuizDisplay } from './QuizDisplay';
import { SharePostDialog, EditPostDialog, DeletePostDialog } from './feed-post-dialogs';
import { FeedSubscribeGateDialog, FeedUnlockGateDialog } from './post-access-dialogs';
import {
  FeedPaywallActions,
  FeedPaywallOverlay,
  FeedPaywallPlaceholder,
  feedPaywallFrameClass,
} from './feed-paywall-ui';
import { FeedCommentSection } from './feed-comment-section';

import { toggleLikePost, toggleBookmarkPost, fetchComments, addComment, deletePost, updatePostText } from '@/app/actions/postActions';
import { createPostLikeNotification, createPostCommentNotification, createCommentReplyNotification } from '@/app/actions/notificationActions';
import { toast } from 'sonner';
import { useUser } from '@/lib/contexts/user-context';
import { useCreditMonetization } from '@/lib/contexts/credit-monetization-context';
import { formatUsdWithCreditsSuffix } from '@/lib/credits/monetization-display';
import { usePulseUI } from '@/lib/contexts/pulse-ui-context';
import { computeHasFullPostAccess, publicPostImageUrl } from '@/lib/feed/post-access';
import { createClient } from '@/lib/supabase/client';
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

interface FeedItemProps {
  post: Post;
  onPostDelete?: () => void;
}

interface ImageDimensions {
  width: number;
  height: number;
}

interface LightboxSlide {
  src: string;
  aspectRatio?: number;
}

function linkifyText(text: string): React.ReactNode {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+)|(www\.[\w\-._~:/?#[\]@!$&'()*+,;=%]+)/gi;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (!part) return null;
    if (urlRegex.test(part)) {
      let href = part;
      if (!href.startsWith('http')) href = 'https://' + href;
      return <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all">{part}</a>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

export function FeedItem({ post, onPostDelete }: FeedItemProps) {
  const { pulseEnabled } = usePulseUI();
  const router = useRouter();
  const { profile, session } = useUser();
  const isOwnPost = profile?.id === post.user_id;
  const creator = post.profiles;
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxSlidesState, setLightboxSlidesState] = useState<LightboxSlide[]>([]);
  const [imageDimensions, setImageDimensions] = useState<Record<string, ImageDimensions>>({});

  const [isLiked, setIsLiked] = useState(post.user_has_liked);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [isBookmarked, setIsBookmarked] = useState(post.user_has_bookmarked);
  const [bookmarkCount, setBookmarkCount] = useState(post.bookmark_count);
  const [currentCommentCount, setCurrentCommentCount] = useState(post.comment_count);
  const [isLiking, setIsLiking] = useState(false);
  const [isBookmarking, setIsBookmarking] = useState(false);
  const [isTransitioning, startTransition] = useTransition();

  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CommentType[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  const [replyingToCommentInfo, setReplyingToCommentInfo] = useState<{ id: string; username: string; userId: string } | null>(null);

  const [liveStreamStatus, setLiveStreamStatus] = useState<string | undefined>(() => {
    const liveStreamMedia = post.post_media?.find(media => media.media_type === 'live_stream');
    return liveStreamMedia?.metadata?.status;
  });
  const [liveStreamMeta, setLiveStreamMeta] = useState<any>(() => {
    const liveStreamMedia = post.post_media?.find(media => media.media_type === 'live_stream');
    return liveStreamMedia?.metadata;
  });

  const [isSubscribeGateOpen, setIsSubscribeGateOpen] = useState(false);
  const [isUnlockGateOpen, setIsUnlockGateOpen] = useState(false);
  const [isSubscribeModalOpen, setIsSubscribeModalOpen] = useState(false);
  const [creatorDetails, setCreatorDetails] = useState<any | null>(null);
  const [isLoadingCreator, setIsLoadingCreator] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(false);

  const [isPPVModalOpen, setIsPPVModalOpen] = useState(false);
  const [hasPPVAccess, setHasPPVAccess] = useState(false);
  const [isCheckingPPV, setIsCheckingPPV] = useState(false);

  const [isTipModalOpen, setIsTipModalOpen] = useState(false);
  const [tipAmount, setTipAmount] = useState<number>(0);
  const [hasCreatorRecord, setHasCreatorRecord] = useState<boolean>(false);
  const [creatorCanImgGen, setCreatorCanImgGen] = useState(false);
  const [isCreatorDemo, setIsCreatorDemo] = useState<boolean>(false);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number } | null>(null);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const dialogCleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editedText, setEditedText] = useState(post.text_content || '');
  
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

  const cleanupPointerEvents = () => {
    if (dialogCleanupTimeoutRef.current) {
      clearTimeout(dialogCleanupTimeoutRef.current);
    }
    dialogCleanupTimeoutRef.current = setTimeout(() => {
      document.body.style.removeProperty('pointer-events');
    }, 100);
  };

  useEffect(() => {
    return () => {
      if (dialogCleanupTimeoutRef.current) {
        clearTimeout(dialogCleanupTimeoutRef.current);
      }
      document.body.style.removeProperty('pointer-events');
    };
  }, []);

  useEffect(() => {
    setIsLiked(post.user_has_liked);
    setLikeCount(post.like_count);
    setIsBookmarked(post.user_has_bookmarked);
    setBookmarkCount(post.bookmark_count);
    setCurrentCommentCount(post.comment_count);

    const checkCreatorRecord = async () => {
      const { data, error } = await supabase
        .from('creators')
        .select('profile_id, is_demo, can_img_gen')
        .eq('profile_id', post.user_id)
        .maybeSingle();
      
      setHasCreatorRecord(!error && !!data);
      setCreatorCanImgGen(!!data?.can_img_gen);
      setIsCreatorDemo(data?.is_demo || false);
    };

    checkCreatorRecord();
  }, [post.user_has_liked, post.like_count, post.user_has_bookmarked, post.bookmark_count, post.comment_count, post.user_id]);

  useEffect(() => {
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

  useEffect(() => {
    if (post.access_level === 'subscribers_only' && !isOwnPost && profile?.id) {
      checkSubscriptionStatus();
    }
  }, [post.access_level, post.user_id, profile?.id, isOwnPost]);

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

  useEffect(() => {
    if (post.access_level === 'ppv' && !isOwnPost && profile?.id) {
      checkPPVAccess();
    }
  }, [post.access_level, post.id, profile?.id, isOwnPost]);

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

  useEffect(() => {
    if (post.content_type === 'image' && post.post_media && post.post_media.length > 0) {
      const imageMedia = post.post_media.find(media => media.media_type === 'image');
      if (imageMedia && imageMedia.storage_path) {
        const imagePath = hasFullAccess
          ? imageMedia.storage_path
          : imageMedia.blurred_storage_path;
        if (imagePath) {
          const imageUrl = publicPostImageUrl(imagePath);
          if (!imageDimensions[imageMedia.id]) {
            loadImageDimensions(imageUrl, imageMedia.id);
          }
        }
      }
    }
  }, [post, isOwnPost, isSubscribed, hasPPVAccess, imageDimensions, hasFullAccess]);

  useEffect(() => {
    if (post.content_type === 'carousel' && post.post_media && post.post_media.length > 0) {
      const carouselMedia = post.post_media
        .filter(media => media.media_type === 'image' && media.storage_path)
        .sort((a, b) => a.order_index - b.order_index);
      carouselMedia.forEach(media => {
        const imagePath = media.storage_path;
        if (imagePath) {
          const imageUrl = imagePath.startsWith('http')
            ? imagePath
            : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/post-images/${imagePath}`;
          if (!imageDimensions[media.id]) {
            loadImageDimensions(imageUrl, media.id);
          }
        }
      });
    }
  }, [post, imageDimensions]);

  const handleStartReply = (commentToReply: CommentType) => {
    setReplyingToCommentInfo({
      id: commentToReply.id,
      username: commentToReply.profiles.username || 'user',
      userId: commentToReply.user_id
    });
    setNewCommentText(`@${commentToReply.profiles.username || 'user'} `);
    if (!showComments) {
        setShowComments(true);
    }
    setTimeout(() => commentInputRef.current?.focus(), 0);
  };

  const handleCancelReply = () => {
    setReplyingToCommentInfo(null);
    setNewCommentText('');
  };

  const handleLike = async () => {
    if (!session) {
      router.push('/home');
      return;
    }
    if (isLiking) return;
    setIsLiking(true);

    const originalLiked = isLiked;
    const originalLikeCount = likeCount;

    setIsLiked(!originalLiked);
    setLikeCount(originalLiked ? originalLikeCount - 1 : originalLikeCount + 1);

    startTransition(async () => {
      try {
        const result = await toggleLikePost(post.id);
        if (result.success) {
          setIsLiked(result.newLikeState!);
          setLikeCount(result.newLikeCount!);
          
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
            }
          }
        } else {
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
    if (!session) {
      router.push('/home');
      return;
    }
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
    const originalCommentText = newCommentText.trim();
    const isReply = !!replyingToCommentInfo;
    const parentId = replyingToCommentInfo?.id || null;

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
      setCurrentCommentCount(prev => prev + 1);
    } else {
      setComments(prevComments => 
        prevComments.map(c => 
          c.id === parentId 
            ? { ...c, reply_count: (c.reply_count || 0) + 1 } 
            : c
        )
      );
      setCurrentCommentCount(prev => prev + 1);
    }
    
    setNewCommentText('');
    const replyingToUsername = replyingToCommentInfo?.username;
    if (isReply) {
        handleCancelReply();
    }

    startTransition(async () => {
      const result = await addComment(post.id, originalCommentText, parentId);
      if (result.success && result.comment) {
        if (isReply) {
           toast.success(`Replied to @${replyingToUsername}`);
        } else {
          toast.success("Comment added!");
          setComments(prev => prev.map(c => c.id === tempId ? result.comment! : c));
        }
        
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
          }
        }
        
        if (isReply && !isOwnPost && profile?.username && replyingToCommentInfo) {
          try {
            await createCommentReplyNotification({
              commentAuthorId: replyingToCommentInfo.userId,
              replierId: profile.id,
              replierUsername: profile.username,
              postId: post.id,
              commentId: replyingToCommentInfo.id
            });
          } catch (notificationError) {
            console.error('Failed to create comment reply notification:', notificationError);
          }
        }
      } else {
        toast.error(result.error || 'Failed to post.');
        if (!isReply) {
          setComments(prev => prev.filter(c => c.id !== tempId));
          setCurrentCommentCount(prev => prev - 1);
        }
        else {
             setComments(prevComments => 
                prevComments.map(c => 
                c.id === parentId 
                    ? { ...c, reply_count: (c.reply_count || 1) - 1 }
                    : c
                )
            );
        }
        setNewCommentText(originalCommentText);
        if (isReply && replyingToUsername) {
            setReplyingToCommentInfo({ id: parentId!, username: replyingToUsername, userId: replyingToCommentInfo.userId });
            setNewCommentText(`@${replyingToUsername} ${originalCommentText}`);
        } else {
             setNewCommentText(originalCommentText);
        }
      }
      setIsSubmittingComment(false);
    });
  };

  const handleTip = () => {
    if (!session) {
      router.push('/home');
      return;
    }
    setIsTipModalOpen(true);
  };

  const handleBookmark = async () => {
    if (!session) {
      router.push('/home');
      return;
    }
    if (isBookmarking) return;
    setIsBookmarking(true);

    const originalBookmarked = isBookmarked;
    const originalBookmarkCount = bookmarkCount;

    setIsBookmarked(!originalBookmarked);
    setBookmarkCount(originalBookmarked ? originalBookmarkCount - 1 : originalBookmarkCount + 1);

    startTransition(async () => {
      try {
        const result = await toggleBookmarkPost(post.id);
        if (result.success) {
          setIsBookmarked(result.newBookmarkState!);
          setBookmarkCount(result.newBookmarkCount!);
        } else {
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

  const creatorDisplayName = creator.full_name || creator.username || 'this creator';
  const subscriptionPriceCents =
    post.creator?.subscription_price_cents ?? creatorDetails?.subscription_price_cents ?? 0;
  const subscriptionInterval =
    post.creator?.subscription_interval ?? creatorDetails?.subscription_interval ?? 'month';
  const subscriptionIntervalLabel = subscriptionInterval === 'year' ? 'yearly' : 'monthly';

  const handleSubscribePaywallClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!session) {
      router.push('/home');
      return;
    }
    if (!post.creator && !creatorDetails) {
      await fetchCreatorDetails();
    }
    setIsSubscribeGateOpen(true);
  };

  const handleUnlockPaywallClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!session) {
      router.push('/home');
      return;
    }
    setIsUnlockGateOpen(true);
  };

  const paywallActions = (
    <FeedPaywallActions
      accessLevel={post.access_level}
      ppvPriceLabel={post.ppv_price_cents ? ppvPriceLabel(post.ppv_price_cents) : undefined}
      onSubscribe={handleSubscribePaywallClick}
      onUnlock={handleUnlockPaywallClick}
      isCheckingSubscription={isCheckingSubscription}
      isCheckingPPV={isCheckingPPV}
      isLoadingCreator={isLoadingCreator}
      pulseEnabled={pulseEnabled}
    />
  );

  const handleDeletePost = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      const result = await deletePost(post.id);
      if (result.success) {
        toast.success('Post deleted successfully');
        router.refresh();
        if (onPostDelete) {
          onPostDelete();
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

  const loadImageDimensions = (url: string, imageId: string) => {
    const img = new window.Image();
    img.onload = () => {
      setImageDimensions(prev => ({
        ...prev,
        [imageId]: {
          width: img.width,
          height: img.height
        }
      }));
    };
    img.src = url;
  };

  const getPostUrl = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/p/${post.id}`;
    }
    return '';
  };

  const renderPostContent = () => {
    switch (post.content_type) {
      case 'text_only': {
        const text = post.text_content || '';
        const urlRegex = /(https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+)|(www\.[\w\-._~:/?#[\]@!$&'()*+,;=%]+)/gi;
        const urls = text.match(urlRegex) || [];
        const videoUrl = urls.find(url =>
          /(?:youtube\.com\/watch\?v=|youtu\.be\/|vimeo\.com\/)\S+/i.test(url)
        );
        return (
          <>
            {videoUrl && (
              <div className="mt-4 rounded-lg overflow-hidden border border-border">
                <ReactPlayer url={videoUrl.startsWith('http') ? videoUrl : `https://${videoUrl}`} width="100%" height={360} controls={true} style={{ maxWidth: '100%' }} />
              </div>
            )}
          </>
        );
      }
      case 'image':
        if (post.post_media && post.post_media.length > 0) {
          const imageMedia = post.post_media.find(media => media.media_type === 'image');
          if (imageMedia && imageMedia.storage_path) {
            const previewPath = hasFullAccess
              ? imageMedia.storage_path
              : imageMedia.blurred_storage_path;
            if (!previewPath) {
              if (!hasFullAccess) {
                const width = imageMedia.width || imageMedia.metadata?.width || imageDimensions[imageMedia.id]?.width;
                const height = imageMedia.height || imageMedia.metadata?.height || imageDimensions[imageMedia.id]?.height;
                const aspectRatio = (width && height) ? (height / width) * 100 : 100;
                return (
                  <div
                    className={feedPaywallFrameClass}
                    style={{ paddingBottom: `${aspectRatio}%` }}
                  >
                    <FeedPaywallOverlay>{paywallActions}</FeedPaywallOverlay>
                  </div>
                );
              }
              return null;
            }

            const imageUrl = publicPostImageUrl(previewPath);
            
            const width = imageMedia.width || imageMedia.metadata?.width || imageDimensions[imageMedia.id]?.width;
            const height = imageMedia.height || imageMedia.metadata?.height || imageDimensions[imageMedia.id]?.height;
            const aspectRatio = (width && height) ? (height / width) * 100 : 100;
            
            const singleImageSlide = [{ src: imageUrl }]; 

            return (
              <div 
                className={cn(feedPaywallFrameClass, 'cursor-pointer')}
                onClick={() => { 
                  if (!hasFullAccess) {
                    return;
                  }
                  setLightboxSlidesState(singleImageSlide); 
                  setLightboxIndex(0);
                  setLightboxOpen(true);
                }}
              >
                <div className="relative w-full" style={{ paddingBottom: `${aspectRatio}%` }}>
                <RemoteImage 
                  src={imageUrl} 
                  alt={imageMedia.alt_text || post.text_content?.substring(0,50) || 'Post image'} 
                  fill 
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
                </div>
                {!hasFullAccess && <FeedPaywallOverlay>{paywallActions}</FeedPaywallOverlay>}
              </div>
            );
          }
        }
        return <p className="text-sm text-muted-foreground">[Image not available]</p>;
      case 'carousel':
        if (post.post_media && post.post_media.length > 0) {
          const carouselMedia = post.post_media
            .filter(media => media.media_type === 'image' && media.storage_path)
            .sort((a, b) => a.order_index - b.order_index);

          const carouselImagesForDisplay = carouselMedia.flatMap(media => {
            const imagePath = hasFullAccess ? media.storage_path : media.blurred_storage_path;
            if (!imagePath) return [];
            const width = media.width || media.metadata?.width || imageDimensions[media.id]?.width;
            const height = media.height || media.metadata?.height || imageDimensions[media.id]?.height;
            const aspectRatio = (width && height) ? (height / width) * 100 : 100;
            return [{
              src: publicPostImageUrl(imagePath),
              alt: media.alt_text || post.text_content?.substring(0, 50) || `Carousel image ${media.order_index + 1}`,
              aspectRatio
            }];
          });
          
          const lightboxSlides = carouselMedia.flatMap(media => {
            const imagePath = hasFullAccess ? media.storage_path : media.blurred_storage_path;
            if (!imagePath) return [];
            const width = media.width || media.metadata?.width || imageDimensions[media.id]?.width;
            const height = media.height || media.metadata?.height || imageDimensions[media.id]?.height;
            const aspectRatio = (width && height) ? (height / width) * 100 : 100;
            return [{
              src: publicPostImageUrl(imagePath),
              aspectRatio
            }];
          });

          if (!hasFullAccess && carouselImagesForDisplay.length === 0) {
            return (
              <div className={feedPaywallFrameClass} style={{ paddingBottom: '100%' }}>
                <FeedPaywallPlaceholder />
                <FeedPaywallOverlay>{paywallActions}</FeedPaywallOverlay>
              </div>
            );
          }

          if (carouselImagesForDisplay.length > 0) {
            return (
              <div className={feedPaywallFrameClass}>
                <div className="relative w-full">
                  <Carousel 
                    images={carouselImagesForDisplay} 
                    options={{ loop: carouselImagesForDisplay.length > 1 }} 
                    onImageClick={(clickedIndex) => {
                      if (!hasFullAccess) {
                        return;
                      }
                      setLightboxSlidesState(lightboxSlides);
                      setLightboxIndex(clickedIndex);
                      setLightboxOpen(true);
                    }}
                  />
                </div>
                  {!hasFullAccess && (
                    <FeedPaywallOverlay className="pointer-events-none [&_button]:pointer-events-auto">
                      {paywallActions}
                    </FeedPaywallOverlay>
                  )}
              </div>
            );
          }
        }
        return <p className="text-sm text-muted-foreground p-4 bg-muted rounded-md">[Carousel not available or no images]</p>;
      case 'video':
        const videoMedia = post.post_media?.find(media => media.media_type === 'video');
        if (videoMedia?.mux_playback_id) {
          let aspectRatio = 56.25;
          if (videoMedia.width && videoMedia.height) {
            aspectRatio = (videoMedia.height / videoMedia.width) * 100;
          } else if (videoDimensions && videoDimensions.width && videoDimensions.height) {
            aspectRatio = (videoDimensions.height / videoDimensions.width) * 100;
          }

          return (
            <div
              className={cn(
                'mt-0 overflow-hidden rounded-lg relative',
                hasFullAccess ? 'border-0 bg-black' : feedPaywallFrameClass
              )}
            >
              {hasFullAccess ? (
                <LazyMuxFeedPlayer
                  playbackId={videoMedia.mux_playback_id}
                  streamType="on-demand"
                  aspectRatioPercent={aspectRatio}
                  metadata={{
                    video_title: 'Feed video',
                    video_id: videoMedia.mux_playback_id,
                  }}
                  onLoadedData={(e) => {
                    const video = (e as Event).target as HTMLVideoElement;
                    if (video?.videoWidth > 0 && video?.videoHeight > 0) {
                      setVideoDimensions({
                        width: video.videoWidth,
                        height: video.videoHeight,
                      });
                    }
                  }}
                />
              ) : (
                <div className="relative w-full" style={{ paddingBottom: `${aspectRatio}%` }}>
                  {videoMedia.blurred_storage_path ? (
                    <RemoteImage
                      src={publicPostImageUrl(videoMedia.blurred_storage_path)}
                      alt="Video preview"
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  ) : (
                    <FeedPaywallPlaceholder />
                  )}
                  <FeedPaywallOverlay>{paywallActions}</FeedPaywallOverlay>
                </div>
              )}
            </div>
          );
        } else if (videoMedia?.mux_upload_id) {
          return (
            <div className="mt-0 overflow-hidden rounded-lg border border-border relative bg-muted">
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-sm text-foreground/90 font-medium">Video is processing...</p>
                  <p className="text-xs text-muted-foreground mt-1">It will be available shortly.</p>
                </div>
              </div>
            </div>
          );
        }
        return <p className="text-sm text-muted-foreground p-4 bg-muted rounded-md">[Video not available]</p>;
      case 'poll':
        if (post.metadata && post.metadata.options && Array.isArray(post.metadata.options)) {
          return (
            <PollDisplay 
              postId={post.id} 
              options={post.metadata.options} 
              initialResults={post.poll_results} 
              initialUserVote={post.user_poll_vote}
            />
          );
        }
        return <p className="text-sm text-muted-foreground p-4 bg-muted rounded-md">[Poll data missing or malformed]</p>;
      case 'quiz':
        if (post.metadata && post.metadata.options && Array.isArray(post.metadata.options)) {
          const initialAttemptForDisplay: UserQuizAttempt | null = post.user_quiz_attempt 
            ? { 
                selectedOptionId: (post.user_quiz_attempt as any).selected_option_id, 
                isCorrect: (post.user_quiz_attempt as any).is_correct 
              }
            : null;

          return (
            <QuizDisplay 
              postId={post.id} 
              options={post.metadata.options} 
              initialAttempt={initialAttemptForDisplay}
            />
          );
        }
        return <p className="text-sm text-muted-foreground p-4 bg-muted rounded-md">[Quiz data missing or malformed]</p>;
      case 'live_stream':
        const liveStreamMedia = post.post_media?.find(media => media.media_type === 'live_stream');
        if (liveStreamMedia?.mux_playback_id) {
          const status = liveStreamStatus ?? liveStreamMedia.metadata?.status;
          const isLive = status === 'live';
          const meta = liveStreamMeta ?? liveStreamMedia.metadata;
          const playbackId = meta?.asset_playback_id || liveStreamMedia.mux_playback_id;
          const streamAspectRatio = meta?.aspect_ratio || 56.25;

          if (!hasFullAccess) {
            return (
              <div
                className={feedPaywallFrameClass}
                style={{ paddingBottom: `${streamAspectRatio}%` }}
              >
                <FeedPaywallOverlay>{paywallActions}</FeedPaywallOverlay>
              </div>
            );
          }
          
          const liveOverlay = (isLive || status === 'ended') ? (
            <div
              className={`absolute top-2 left-2 z-[3] flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                isLive ? 'bg-pink-500 text-white' : 'bg-black text-white'
              }`}
            >
              <span className={`h-2 w-2 rounded-full bg-white ${isLive ? 'animate-pulse' : ''}`} />
              {isLive ? 'LIVE' : 'ENDED'}
            </div>
          ) : null;

          // PPV streams use signed Mux playback tokens — the token is fetched
          // server-side after verifying the user has paid, preventing HLS URL leakage.
          if (post.access_level === 'ppv') {
            return (
              <div className="mt-0 overflow-hidden rounded-lg border-0 p-0 border-border relative bg-black">
                <PpvLiveStreamPlayer
                  postId={post.id}
                  playbackId={playbackId}
                  streamType={isLive ? 'live' : 'on-demand'}
                  aspectRatioPercent={streamAspectRatio}
                  metadata={{
                    video_title: isLive ? 'Live stream' : 'Stream replay',
                    video_id: playbackId,
                  }}
                  overlay={liveOverlay}
                />
              </div>
            );
          }

          return (
            <div className="mt-0 overflow-hidden rounded-lg border-0 p-0 border-border relative bg-black">
              <LazyMuxFeedPlayer
                playbackId={playbackId}
                streamType={isLive ? 'live' : 'on-demand'}
                aspectRatioPercent={streamAspectRatio}
                autoPlayWhenInView={isLive}
                metadata={{
                  video_title: isLive ? 'Live stream' : 'Stream replay',
                  video_id: playbackId,
                }}
                overlay={liveOverlay}
              />
            </div>
          );
        }
        return <p className="text-sm text-muted-foreground p-4 bg-muted rounded-md">[Live stream not available]</p>;
      default:
        return <p className="text-sm text-muted-foreground">[Unsupported post type]</p>;
    }
  };

  const hasVisualMedia = ['image', 'video', 'carousel', 'short', 'live_stream'].includes(
    post.content_type
  );
  const accessPill =
    post.access_level === 'subscribers_only' ? (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-muted/80 px-2.5 py-1 text-[11.5px] font-semibold text-muted-foreground">
        <Lock className="h-2.5 w-2.5" aria-hidden />
        Subscribers
      </span>
    ) : post.access_level === 'ppv' && post.ppv_price_cents ? (
      <span
        className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
        style={{
          background: 'var(--brand-grad-soft)',
          color: 'var(--brand-pink)',
        }}
      >
        <Lock className="h-2.5 w-2.5" aria-hidden />
        {ppvPriceLabel(post.ppv_price_cents)}
      </span>
    ) : null;

  return (
    <article className="feed-card border-b border-border px-[22px] py-[18px]">
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
      <header className="mb-2.5 flex items-center gap-[11px]">
        <Avatar
          className="h-[46px] w-[46px] shrink-0 border-0"
          profileId={creator.id}
          username={creator.username!}
          data-pulse-earning-target={creator.id}
        >
          <AvatarImage src={creator.avatar_url || undefined} alt={creator.full_name || creator.username || 'User'} />
          <AvatarFallback className="h-[46px] w-[46px]" />
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <Link
              href={`/u/${creator.username}`}
              className="truncate text-[15px] font-bold text-foreground hover:underline"
            >
              {creator.full_name || creator.username}
            </Link>
            {creatorCanImgGen && <AIBadge small />}
          </div>
          <p className="truncate text-[13px] text-muted-foreground">
            @{creator.username}
            <span aria-hidden> · </span>
            {formatRelativeTime(post.created_at)}
          </p>
        </div>
        {accessPill}
        {(isOwnPost || profile?.isAdmin) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Post options"
              >
                <MoreHorizontal size={19} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setEditedText(post.text_content || '');
                  setIsEditDialogOpen(true);
                }}
              >
                <Pencil size={16} className="mr-2" />
                Edit Post
              </DropdownMenuItem>
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
      </header>

      {post.text_content && (
        <p
          className={cn(
            'cursor-pointer whitespace-pre-wrap text-[15.5px] leading-[1.55] text-foreground',
            hasVisualMedia && 'mb-3'
          )}
          onClick={handleCommentToggle}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleCommentToggle();
            }
          }}
          role="button"
          tabIndex={0}
        >
          {linkifyText(post.text_content)}
        </p>
      )}

      {post.content_type !== 'text_only' && renderPostContent()}
      {post.content_type === 'text_only' && renderPostContent()}

      {tipAmount > 0 && (
        <div
          className="mt-3 flex items-center gap-1.5 text-[13px] font-semibold whitespace-nowrap"
          style={{ color: 'var(--brand-gold)' }}
        >
          <Coins size={15} className="shrink-0" aria-hidden />
          <span>
            ${(tipAmount / 100).toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            in tips from fans
          </span>
        </div>
      )}

      <div className="-ml-2.5 mt-2 flex items-center gap-0.5">
        <FeedActionButton
          icon={Heart}
          label={likeCount}
          active={isLiked}
          activeColor="var(--brand-pink)"
          onClick={handleLike}
          disabled={isLiking}
          ariaLabel="Like"
        />
        <FeedActionButton
          icon={MessageCircle}
          label={currentCommentCount}
          onClick={handleCommentToggle}
          ariaLabel="Comments"
        />
        {hasCreatorRecord && (
          <button
            type="button"
            onClick={handleTip}
            className="ml-1 inline-flex h-[34px] items-center gap-1.5 rounded-full border border-border px-3.5 text-[13.5px] font-semibold transition-[filter] hover:brightness-105"
            style={{
              background: 'var(--brand-grad-soft)',
              color: 'var(--brand-pink)',
            }}
          >
            <DollarSign size={16} aria-hidden />
            Tip
          </button>
        )}
        <div className="min-w-2 flex-1" />
        <FeedActionButton
          icon={Bookmark}
          active={isBookmarked}
          activeColor="var(--brand-violet)"
          onClick={handleBookmark}
          disabled={isBookmarking}
          ariaLabel="Bookmark"
        />
        <FeedActionButton
          icon={Send}
          onClick={() => setIsShareModalOpen(true)}
          ariaLabel="Share post"
        />
      </div>

      {showComments && (
        <FeedCommentSection
          comments={comments}
          isLoading={isLoadingComments}
          newCommentText={newCommentText}
          onNewCommentTextChange={setNewCommentText}
          onSubmit={handleNewCommentSubmit}
          isSubmitting={isSubmittingComment}
          replyingTo={replyingToCommentInfo}
          onCancelReply={handleCancelReply}
          onStartReply={handleStartReply}
          commentInputRef={commentInputRef}
        />
      )}

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
            await checkSubscriptionStatus();
          }}
        />
      )}

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

      <DeletePostDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        isDeleting={isDeleting}
        onConfirm={handleDeletePost}
      />

      <EditPostDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        initialText={post.text_content || ''}
        onSave={async (text) => {
          const result = await updatePostText(post.id, text);
          if (result.success) {
            post.text_content = text;
            setEditedText(text);
            router.refresh();
          }
          return result;
        }}
      />

      <SharePostDialog
        open={isShareModalOpen}
        onOpenChange={setIsShareModalOpen}
        postUrl={getPostUrl()}
      />
    </article>
  );
}