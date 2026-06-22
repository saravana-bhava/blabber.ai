'use client';

import type { RefObject } from 'react';
import { Loader2, SendHorizonal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CommentType } from '@/lib/types';
import { CommentItem } from '@/components/feed/CommentItem';
import { brandPrimaryBtn } from '@/components/feed/brand-dialog-shell';
import { cn } from '@/lib/utils';

type FeedCommentSectionProps = {
  comments: CommentType[];
  isLoading: boolean;
  newCommentText: string;
  onNewCommentTextChange: (value: string) => void;
  onSubmit: (e?: React.FormEvent<HTMLFormElement>) => void;
  isSubmitting: boolean;
  replyingTo?: { id: string; username: string } | null;
  onCancelReply?: () => void;
  onStartReply: (comment: CommentType) => void;
  commentInputRef?: RefObject<HTMLTextAreaElement | null>;
};

export function FeedCommentSection({
  comments,
  isLoading,
  newCommentText,
  onNewCommentTextChange,
  onSubmit,
  isSubmitting,
  replyingTo,
  onCancelReply,
  onStartReply,
  commentInputRef,
}: FeedCommentSectionProps) {

  return (
    <section
      className="mt-3 border-t border-border/80 pt-3"
      aria-label="Comments"
    >
      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          <span className="text-sm">Loading comments…</span>
        </div>
      )}

      {!isLoading && comments.length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No comments yet — start the conversation.
        </p>
      )}

      {!isLoading && comments.length > 0 && (
        <div className="scrollbar-hide max-h-[min(320px,40vh)] space-y-0.5 overflow-y-auto overflow-x-visible overscroll-contain pr-0.5">
          {comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} onStartReply={onStartReply} />
          ))}
        </div>
      )}

      {replyingTo && onCancelReply && (
        <div
          className="mt-3 flex items-center justify-between gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium"
          style={{ background: 'var(--brand-surface)' }}
        >
          <span className="text-muted-foreground">
            Replying to{' '}
            <span className="font-semibold text-foreground">@{replyingTo.username}</span>
          </span>
          <button
            type="button"
            onClick={onCancelReply}
            className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            aria-label="Cancel reply"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-3 flex items-end gap-2">
        <div
          className={cn(
            'flex min-w-0 flex-1 items-end gap-2 rounded-2xl border border-border px-3 py-2 transition-[box-shadow]',
            'focus-within:ring-2 focus-within:ring-[var(--brand-violet)]/25'
          )}
          style={{ background: 'var(--brand-surface)' }}
        >
          <Textarea
            ref={commentInputRef}
            value={newCommentText}
            onChange={(e) => onNewCommentTextChange(e.target.value)}
            placeholder={replyingTo ? `Reply to @${replyingTo.username}…` : 'Add a comment…'}
            rows={1}
            className="min-h-[40px] max-h-28 flex-1 resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSubmit();
              }
            }}
          />
        </div>
        <Button
          type="submit"
          disabled={isSubmitting || !newCommentText.trim()}
          className={cn(brandPrimaryBtn, 'h-10 w-10 shrink-0 p-0')}
          aria-label="Post comment"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SendHorizonal className="h-4 w-4" />
          )}
        </Button>
      </form>
    </section>
  );
}
