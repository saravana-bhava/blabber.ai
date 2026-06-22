'use client';

import { memo, useMemo } from 'react';
import type { SlideImage } from 'yet-another-react-lightbox';
import { MessageBubble, type ChatMessage } from '@/components/messages/MessageBubble';

export interface MessageListProps {
  messages: ChatMessage[];
  profileId: string | undefined;
  otherLastReadId: string | null;
  loadingImages: Record<string, boolean>;
  loadingVideos: Record<string, boolean>;
  videoAspectRatios: Record<string, number>;
  creditOnlyEcosystem: boolean;
  pricePerCreditCents: number;
  unlockingPPVMessageId: string | null;
  unlockedPPVMessages: Set<string>;
  onUnlockPpv: (msgId: string) => void;
  onOpenImage: (items: SlideImage[]) => void;
  onVideoMetadata: (msgId: string, e: React.SyntheticEvent<HTMLVideoElement, Event>) => void;
}

function MessageListComponent({
  messages,
  profileId,
  otherLastReadId,
  loadingImages,
  loadingVideos,
  videoAspectRatios,
  creditOnlyEcosystem,
  pricePerCreditCents,
  unlockingPPVMessageId,
  unlockedPPVMessages,
  onUnlockPpv,
  onOpenImage,
  onVideoMetadata,
}: MessageListProps) {
  const reversed = useMemo(() => messages.slice().reverse(), [messages]);

  return (
    <>
      {reversed.map((msg, idx) => {
        const isMine = msg.sender_id === profileId;
        const isLast = idx === 0;
        const mediaUrl = msg.media_url;

        return (
          <MessageBubble
            key={msg.id}
            msg={msg}
            isMine={isMine}
            isLast={isLast}
            otherLastReadId={otherLastReadId}
            isImageLoading={mediaUrl ? !!loadingImages[mediaUrl] : false}
            isVideoLoading={mediaUrl ? !!loadingVideos[mediaUrl] : false}
            videoAspectRatio={videoAspectRatios[msg.id]}
            creditOnlyEcosystem={creditOnlyEcosystem}
            pricePerCreditCents={pricePerCreditCents}
            isPpvUnlocking={unlockingPPVMessageId === msg.id}
            isPpvUnlocked={unlockedPPVMessages.has(msg.id)}
            onUnlockPpv={onUnlockPpv}
            onOpenImage={onOpenImage}
            onVideoMetadata={onVideoMetadata}
          />
        );
      })}
    </>
  );
}

export const MessageList = memo(MessageListComponent);
