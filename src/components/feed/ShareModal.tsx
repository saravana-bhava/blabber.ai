'use client';

import { SharePostDialog } from '@/components/feed/feed-post-dialogs';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  postUrl: string;
}

/** @deprecated Use SharePostDialog — kept for existing isOpen/onClose call sites */
export function ShareModal({ isOpen, onClose, postUrl }: ShareModalProps) {
  return (
    <SharePostDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      postUrl={postUrl}
    />
  );
}
