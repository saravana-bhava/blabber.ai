'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Share2 } from 'lucide-react';
import { toast } from 'sonner';

const STORAGE_KEY = 'blabber_post_onboarding_share_shown';

export function markPostOnboardingShareShown() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, 'true');
  } catch (_) {}
}

export function wasPostOnboardingShareShown(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return sessionStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return true;
  }
}

interface PostOnboardingSharePopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareLink: string;
  suggestedAmount?: number;
}

const DEFAULT_AMOUNT = 50;

export function PostOnboardingSharePopup({
  open,
  onOpenChange,
  shareLink,
  suggestedAmount = DEFAULT_AMOUNT,
}: PostOnboardingSharePopupProps) {
  const amount = suggestedAmount;
  const preWrittenCopy = `I just set up my AI on Blabber — you can chat with it 24/7. Subscriptions, tips & more. Try it 👇\n${shareLink}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(preWrittenCopy).then(() => {
      toast.success('Copied to clipboard');
    });
  };

  const handleShare = () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator
        .share({
          title: 'Chat with my AI on Blabber',
          text: preWrittenCopy,
          url: shareLink,
        })
        .then(() => toast.success('Shared'))
        .catch(() => {});
    } else {
      handleCopy();
    }
  };

  const handleClose = () => {
    markPostOnboardingShareShown();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? handleClose() : onOpenChange(o))}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Post this now to make your first ${amount}</DialogTitle>
          <DialogDescription>
            Share your Blabber link so fans can find and subscribe. Copy the message below or use one-tap share.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">{preWrittenCopy}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
              <Copy className="h-4 w-4" />
              Copy
            </Button>
            {typeof navigator !== 'undefined' && 'share' in navigator && typeof navigator.share === 'function' && (
              <Button variant="default" size="sm" onClick={handleShare} className="gap-2 bg-pink-500 hover:bg-pink-600 text-white">
                <Share2 className="h-4 w-4" />
                Share
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
