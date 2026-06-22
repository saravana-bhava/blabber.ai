import React, { useState, useTransition, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { CommentType } from '@/lib/types';
import { formatRelativeTime } from '@/lib/utils';
import { HeartIcon, Loader2 } from 'lucide-react';
import { toggleCommentLike, fetchCommentReplies } from '@/app/actions/postActions';
import { toast } from 'sonner';

interface CommentItemProps {
  comment: CommentType;
  isReply?: boolean;
  onStartReply: (comment: CommentType) => void;
  isShortOverlay?: boolean;
}

export function CommentItem({ comment, isReply = false, onStartReply, isShortOverlay = false }: CommentItemProps) {
  const commenter = comment.profiles;

  const [isLiked, setIsLiked] = useState(comment.user_has_liked_comment || false);
  const [currentLikeCount, setCurrentLikeCount] = useState(comment.like_count || 0);
  const [currentReplyCount, setCurrentReplyCount] = useState(comment.reply_count || 0);
  const [isLikingComment, setIsLikingComment] = useState(false);
  const [_, startTransitionLike] = useTransition();

  const [replies, setReplies] = useState<CommentType[]>([]);
  const [areRepliesVisible, setAreRepliesVisible] = useState(false);
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);
  const isLoadingRepliesRef = useRef(false);
  /** True after first successful fetch — distinguishes open vs. background refresh */
  const [hasLoadedRepliesOnce, setHasLoadedRepliesOnce] = useState(false);

  useEffect(() => {
    setIsLiked(comment.user_has_liked_comment || false);
    setCurrentLikeCount(comment.like_count || 0);
    setCurrentReplyCount(comment.reply_count || 0);
  }, [comment.user_has_liked_comment, comment.like_count, comment.reply_count]);

  const loadReplies = useCallback(async () => {
    if (isLoadingRepliesRef.current) return;

    isLoadingRepliesRef.current = true;
    setIsLoadingReplies(true);
    try {
      const result = await fetchCommentReplies(comment.id);
      if (result.success && result.replies) {
        setReplies(result.replies);
        setAreRepliesVisible(true);
        setHasLoadedRepliesOnce(true);
      } else {
        toast.error(result.error || 'Failed to fetch replies.');
      }
    } catch {
      toast.error('An error occurred while fetching replies.');
    } finally {
      isLoadingRepliesRef.current = false;
      setIsLoadingReplies(false);
    }
  }, [comment.id]);

  // Refresh thread when a new reply is added while replies are open
  useEffect(() => {
    if (
      areRepliesVisible &&
      hasLoadedRepliesOnce &&
      !isLoadingRepliesRef.current &&
      comment.reply_count > replies.length
    ) {
      void loadReplies();
    }
  }, [comment.reply_count, areRepliesVisible, replies.length, hasLoadedRepliesOnce, loadReplies]);

  const handleToggleReplies = () => {
    if (areRepliesVisible) {
      setAreRepliesVisible(false);
      return;
    }
    void loadReplies();
  };

  const isOpeningReplies = isLoadingReplies && !hasLoadedRepliesOnce;
  const isRefreshingReplies = isLoadingReplies && hasLoadedRepliesOnce && areRepliesVisible;

  const handleLikeComment = async () => {
    if (isLikingComment) return;
    setIsLikingComment(true);
    const originalLiked = isLiked;
    const originalLikeCount = currentLikeCount;
    setIsLiked(!originalLiked);
    setCurrentLikeCount(prev => originalLiked ? prev - 1 : prev + 1);
    startTransitionLike(async () => {
      try {
        const result = await toggleCommentLike(comment.id);
        if (result.success) {
          setIsLiked(result.newLikeState!);
          setCurrentLikeCount(result.newLikeCount!);
        } else {
          setIsLiked(originalLiked);
          setCurrentLikeCount(originalLikeCount);
          toast.error(result.error || "Failed to like comment.");
        }
      } catch (error) {
        setIsLiked(originalLiked);
        setCurrentLikeCount(originalLikeCount);
        toast.error("An error occurred while liking the comment.");
      }
      setIsLikingComment(false);
    });
  };

  const displayTime = formatRelativeTime(comment.created_at);

  return (
    <div className={`flex items-start border-b-0 space-x-2.5 py-2.5 ${isReply ? 'ml-6 pr-0' : 'pr-2'}`}>
      <Link href={`/u/${commenter.username}`} className="flex-shrink-0 mt-0.5">
        <Avatar className="h-7 w-7 border">
          <AvatarImage src={commenter.avatar_url || undefined} alt={commenter.full_name || commenter.username || 'User'} />
          <AvatarFallback>{(commenter.full_name || commenter.username || 'U').charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
      </Link>

      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start">
          <div className="text-sm pr-1 break-words">
            <Link href={`/u/${commenter.username}`} className={`hover:underline ${isShortOverlay ? 'text-white' : 'text-neutral-900 dark:text-neutral-100'}`}> 
              <span className={`font-semibold ${isShortOverlay ? 'text-white' : 'text-neutral-900 dark:text-neutral-100'}`}>
                {commenter.full_name || commenter.username}
              </span>
            </Link>
            <span className={`ml-1.5 ${isShortOverlay ? 'text-white/80' : 'text-neutral-800 dark:text-neutral-200'}`}>
              {comment.text_content}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLikeComment}
            disabled={isLikingComment}
            className={`p-0 h-5 w-5 min-w-0 min-h-0 text-muted-foreground hover:bg-transparent hover:text-pink-500 ${isLiked ? 'text-pink-500' : ''} ml-2 flex-shrink-0 mt-0.5`}
          >
            <HeartIcon size={16} className={`${isLiked ? 'fill-current' : ''}`} />
          </Button>
        </div>

        <div className="flex items-center space-x-3 mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          <span>{displayTime}</span>
          {currentLikeCount > 0 && (
            <span className="font-medium">{currentLikeCount} {currentLikeCount === 1 ? 'like' : 'likes'}</span>
          )}
          <button
            type="button"
            onClick={() => onStartReply(comment)}
            className="font-semibold text-muted-foreground transition-colors hover:text-[var(--brand-pink)]"
          >
            Reply
          </button>
          {currentReplyCount > 0 && (
            <button
              type="button"
              onClick={handleToggleReplies}
              disabled={isOpeningReplies}
              className="inline-flex items-center gap-1.5 font-semibold text-muted-foreground transition-colors hover:text-[var(--brand-violet)] disabled:opacity-50"
            >
              {isOpeningReplies ? (
                <>
                  <Loader2 size={14} className="animate-spin" aria-hidden />
                  <span>Loading…</span>
                </>
              ) : areRepliesVisible ? (
                'Hide replies'
              ) : (
                `View ${currentReplyCount} ${currentReplyCount === 1 ? 'reply' : 'replies'}`
              )}
            </button>
          )}
        </div>

        {areRepliesVisible && (
          <div className="relative mt-2">
            {isRefreshingReplies && (
              <div
                className="pointer-events-none absolute inset-0 z-[1] flex items-start justify-center rounded-lg bg-background/50 pt-2"
                aria-hidden
              >
                <Loader2 size={14} className="animate-spin text-muted-foreground" />
              </div>
            )}
            {replies.length > 0 ? (
              <div className="space-y-2">
                {replies.map((reply) => (
                  <CommentItem
                    key={reply.id}
                    comment={reply}
                    isReply
                    onStartReply={onStartReply}
                    isShortOverlay={isShortOverlay}
                  />
                ))}
              </div>
            ) : isOpeningReplies ? (
              <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                <Loader2 size={14} className="animate-spin" aria-hidden />
                Loading replies…
              </div>
            ) : (
              <p className="py-2 text-xs text-muted-foreground">No replies yet.</p>
            )}
          </div>
        )}

      </div>
    </div>
  );
} 