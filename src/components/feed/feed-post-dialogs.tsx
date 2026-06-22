'use client';

import { useEffect, useState } from 'react';
import { Copy, Link2, Pencil, Share2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  BrandDialogShell,
  brandCancelBtn,
  brandDestructiveBtn,
  brandPrimaryBtn,
} from '@/components/feed/brand-dialog-shell';

type SharePostDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postUrl: string;
};

export function SharePostDialog({ open, onOpenChange, postUrl }: SharePostDialogProps) {
  const [canShare, setCanShare] = useState(false);
  const [canCopy, setCanCopy] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
    setCanCopy(typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function');
  }, []);

  const handleNativeShare = async () => {
    if (!canShare) return;
    try {
      await navigator.share({
        title: 'Check out this post on Blabber',
        url: postUrl,
      });
      toast.success('Post shared!');
      onOpenChange(false);
    } catch {
      /* user cancelled */
    }
  };

  const handleCopy = async () => {
    if (!canCopy) {
      toast.error('Clipboard not supported on this device.');
      return;
    }
    try {
      await navigator.clipboard.writeText(postUrl);
      toast.success('Link copied!');
    } catch {
      toast.error('Failed to copy link.');
    }
  };

  return (
    <BrandDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Share2}
      title="Share this post"
      description="Send the link to friends or copy it to your clipboard."
      footer={
        <>
          {canShare && (
            <Button type="button" variant="outline" className={brandCancelBtn} onClick={handleNativeShare}>
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
          )}
          <Button type="button" className={brandPrimaryBtn} onClick={handleCopy}>
            <Copy className="mr-2 h-4 w-4" />
            Copy link
          </Button>
        </>
      }
    >
      <div
        className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 focus-within:ring-2 focus-within:ring-[var(--brand-violet)]/25"
        style={{ background: 'var(--brand-surface)' }}
      >
        <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          type="text"
          readOnly
          value={postUrl}
          className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-foreground outline-none"
          onFocus={(e) => e.target.select()}
        />
      </div>
    </BrandDialogShell>
  );
}

type EditPostDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialText: string;
  onSave: (text: string) => Promise<{ success: boolean; error?: string }>;
};

export function EditPostDialog({ open, onOpenChange, initialText, onSave }: EditPostDialogProps) {
  const [text, setText] = useState(initialText);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) setText(initialText);
  }, [open, initialText]);

  const unchanged = text.trim() === initialText.trim();
  const isEmpty = !text.trim();

  const handleSave = async () => {
    setIsSaving(true);
    const result = await onSave(text.trim());
    setIsSaving(false);
    if (result.success) {
      toast.success('Post updated');
      onOpenChange(false);
    } else {
      toast.error(result.error || 'Failed to update post');
    }
  };

  return (
    <BrandDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Pencil}
      title="Edit post"
      description="Update your caption. Media stays the same."
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            className={brandCancelBtn}
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className={brandPrimaryBtn}
            disabled={isSaving || unchanged || isEmpty}
            onClick={handleSave}
          >
            {isSaving ? 'Saving…' : 'Save changes'}
          </Button>
        </>
      }
    >
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        autoFocus
        placeholder="What's on your mind?"
        className="min-h-[120px] resize-y rounded-xl border-border bg-card text-[15px] leading-relaxed focus-visible:ring-[var(--brand-violet)]/30"
      />
    </BrandDialogShell>
  );
}

type DeletePostDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  isDeleting?: boolean;
};

export function DeletePostDialog({
  open,
  onOpenChange,
  onConfirm,
  isDeleting = false,
}: DeletePostDialogProps) {
  return (
    <BrandDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Trash2}
      title="Delete post?"
      description="This permanently removes the post, comments, and tips tied to it. You can't undo this."
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            className={brandCancelBtn}
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button type="button" className={brandDestructiveBtn} disabled={isDeleting} onClick={onConfirm}>
            {isDeleting ? 'Deleting…' : 'Delete post'}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground">
        Fans who unlocked pay-per-view content will lose access to this post.
      </p>
    </BrandDialogShell>
  );
}
