'use client';

import { memo } from 'react';
import Image from 'next/image';
import { DollarSign, Lock } from 'lucide-react';
import type { SlideImage } from 'yet-another-react-lightbox';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatUsdWithCreditsSuffix } from '@/lib/credits/monetization-display';
import { formatMessageContentForDisplay } from '@/lib/utils/format-message-content';
import { getCachedSignedUrl } from '@/lib/messages/media-url-cache';
import type { Profile } from '@/lib/types';

export interface ChatMessage {
  id: string;
  sender_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  sender_profile?: Profile;
  isPPV: boolean;
  PPV_price: number | null;
  PPV_transaction_id?: string;
}

export interface MessageBubbleProps {
  msg: ChatMessage;
  isMine: boolean;
  isLast: boolean;
  otherLastReadId: string | null;
  isImageLoading: boolean;
  isVideoLoading: boolean;
  videoAspectRatio?: number;
  creditOnlyEcosystem: boolean;
  pricePerCreditCents: number;
  isPpvUnlocking: boolean;
  isPpvUnlocked: boolean;
  onUnlockPpv: (msgId: string) => void;
  onOpenImage: (items: SlideImage[]) => void;
  onVideoMetadata: (msgId: string, e: React.SyntheticEvent<HTMLVideoElement, Event>) => void;
}

function MessageBubbleComponent({
  msg,
  isMine,
  isLast,
  otherLastReadId,
  isImageLoading,
  isVideoLoading,
  videoAspectRatio,
  creditOnlyEcosystem,
  pricePerCreditCents,
  isPpvUnlocking,
  isPpvUnlocked,
  onUnlockPpv,
  onOpenImage,
  onVideoMetadata,
}: MessageBubbleProps) {
  const isImage = msg.media_type?.startsWith('image/');
  const isVideo = msg.media_type?.startsWith('video/');
  const isTip = msg.content ? msg.content.startsWith('###TIP') : false;
  const tipAmount = isTip && msg.content ? msg.content.replace('###TIP ', '') : null;
  const ppvUnlockLabel =
    msg.PPV_price != null && msg.PPV_price > 0
      ? `UNLOCK FOR ${formatUsdWithCreditsSuffix(msg.PPV_price, creditOnlyEcosystem, pricePerCreditCents)}`
      : 'LOCKED';

  const getDisplayUrl = (mediaUrl: string | null) => {
    if (!mediaUrl) return null;
    const cachedUrl = getCachedSignedUrl(`signedurl_${msg.id}`);
    if (cachedUrl) return cachedUrl;
    if (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')) {
      return mediaUrl;
    }
    return null;
  };

  const displayUrl = getDisplayUrl(msg.media_url);
  const ppvLocked = msg.isPPV && !isMine && !msg.PPV_transaction_id && !isPpvUnlocked;

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex flex-col items-end max-w-xs w-full ${isMine ? 'items-end' : 'items-start'}`}>
        {msg.media_url && isImage && (
          <div
            className="mb-1 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity relative"
            onClick={() => {
              if (displayUrl && (!msg.isPPV || isMine || msg.PPV_transaction_id || isPpvUnlocked)) {
                onOpenImage([{ src: displayUrl, type: 'image' }]);
              }
            }}
            style={{ alignSelf: isMine ? 'flex-end' : 'flex-start' }}
          >
            <div
              className={cn(
                ppvLocked
                  ? 'w-full aspect-square bg-muted flex items-center justify-center p-8 transition-opacity duration-200 blur-sm'
                  : 'w-full aspect-square bg-muted flex items-center justify-center p-8 transition-opacity duration-200',
                isImageLoading ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0'
              )}
            >
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
            {!isImageLoading && displayUrl && (
              <Image
                src={displayUrl}
                alt="media"
                width={ppvLocked ? 256 : 192}
                height={ppvLocked ? 256 : 192}
                className={cn(
                  'object-cover',
                  ppvLocked ? 'blur-sm max-w-full max-h-64' : 'max-w-full max-h-48'
                )}
                loading="lazy"
                style={ppvLocked ? { filter: 'blur(12px)' } : {}}
              />
            )}
            {ppvLocked && (
              <div className="msg-lock-veil">
                <div className="text-white text-center px-4">
                  <Lock size={22} className="mx-auto mb-2 opacity-90" />
                  <Button
                    variant="ghost"
                    className="h-9 px-4 rounded-full text-[13px] font-semibold text-[var(--brand-on-accent)] hover:opacity-90 pointer-events-auto"
                    style={{ background: 'var(--brand-grad)' }}
                    onClick={() => onUnlockPpv(msg.id)}
                    disabled={isPpvUnlocking}
                  >
                    {ppvUnlockLabel}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
        {msg.media_url && isVideo && (
          <div
            className="mb-1 rounded-lg overflow-hidden relative"
            style={{
              alignSelf: isMine ? 'flex-end' : 'flex-start',
              width: '100%',
              maxWidth: ppvLocked ? '22rem' : '20rem',
              aspectRatio: videoAspectRatio ? `${videoAspectRatio}` : undefined,
              background: '#000',
            }}
          >
            <div
              className={cn(
                ppvLocked
                  ? 'w-full h-full bg-muted flex items-center justify-center p-8 transition-opacity duration-200 absolute inset-0 z-10 blur-sm'
                  : 'w-full h-full bg-muted flex items-center justify-center p-8 transition-opacity duration-200 absolute inset-0 z-10',
                isVideoLoading || !videoAspectRatio ? 'opacity-100' : 'opacity-0 pointer-events-none'
              )}
            >
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
            {msg.media_url && (
              <video
                src={getCachedSignedUrl(`signedurl_${msg.id}`) || msg.media_url}
                controls={!ppvLocked}
                className={cn(
                  'w-full h-full object-contain bg-black',
                  ppvLocked ? 'blur-sm' : ''
                )}
                preload="metadata"
                style={{
                  opacity: !isVideoLoading && videoAspectRatio ? 1 : 0,
                  borderRadius: '0.5rem',
                  transition: 'opacity 0.2s',
                  filter: ppvLocked ? 'blur(12px)' : undefined,
                }}
                onLoadedMetadata={(e) => onVideoMetadata(msg.id, e)}
              />
            )}
            {ppvLocked && (
              <div className="msg-lock-veil">
                <div className="text-white text-center px-4">
                  <Lock size={22} className="mx-auto mb-2 opacity-90" />
                  <Button
                    variant="ghost"
                    className="h-9 px-4 rounded-full text-[13px] font-semibold text-[var(--brand-on-accent)] hover:opacity-90 pointer-events-auto"
                    style={{ background: 'var(--brand-grad)' }}
                    onClick={() => onUnlockPpv(msg.id)}
                    disabled={isPpvUnlocking}
                  >
                    {ppvUnlockLabel}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
        {msg.content && (
          <div
            className={cn(
              'max-w-[76%] text-[14.5px] leading-[1.45] whitespace-pre-wrap break-words',
              isTip
                ? 'msg-tip-card flex items-center gap-2.5 px-4 py-3'
                : isMine
                  ? 'msg-bubble-out px-[15px] py-2.5 text-right'
                  : 'msg-bubble-in px-[15px] py-2.5 text-left'
            )}
            style={{ marginTop: msg.media_url ? 2 : 0 }}
          >
            {isTip ? (
              <>
                <span
                  className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] text-white"
                  style={{ background: 'linear-gradient(135deg, oklch(0.8 0.13 86), oklch(0.72 0.15 60))' }}
                >
                  <DollarSign size={17} />
                </span>
                <div>
                  <div className="font-display text-[17px] font-bold text-[var(--brand-gold)]">
                    {tipAmount != null && !Number.isNaN(Number.parseFloat(tipAmount))
                      ? formatUsdWithCreditsSuffix(
                          Math.round(Number.parseFloat(tipAmount) * 100),
                          creditOnlyEcosystem,
                          pricePerCreditCents
                        )
                      : `$${tipAmount}`}{' '}
                    tip
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {isMine ? 'You sent a tip' : 'Sent you a tip'}
                  </div>
                </div>
              </>
            ) : (
              formatMessageContentForDisplay(msg.content)
            )}
          </div>
        )}
        {(msg.content || (msg.media_url && (isImage || isVideo))) && (
          <div className={`flex items-center gap-2 mt-1 text-xs w-full ${isMine ? 'justify-end' : 'justify-start'}`}>
            <span className={`${isMine ? 'text-right flex-1' : 'text-left'} text-muted-foreground`}>
              {new Date(msg.created_at).toLocaleString(undefined, {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </span>
            {isLast && isMine && otherLastReadId === msg.id && (
              <span className="text-[var(--brand-pink)] text-right font-medium">Seen</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function propsAreEqual(prev: MessageBubbleProps, next: MessageBubbleProps): boolean {
  if (prev.msg.id !== next.msg.id) return false;
  if (prev.isMine !== next.isMine) return false;
  if (prev.isLast !== next.isLast) return false;
  if (prev.msg.content !== next.msg.content) return false;
  if (prev.msg.media_url !== next.msg.media_url) return false;
  if (prev.msg.media_type !== next.msg.media_type) return false;
  if (prev.msg.created_at !== next.msg.created_at) return false;
  if (prev.msg.isPPV !== next.msg.isPPV) return false;
  if (prev.msg.PPV_price !== next.msg.PPV_price) return false;
  if (prev.msg.PPV_transaction_id !== next.msg.PPV_transaction_id) return false;
  if (prev.isImageLoading !== next.isImageLoading) return false;
  if (prev.isVideoLoading !== next.isVideoLoading) return false;
  if (prev.videoAspectRatio !== next.videoAspectRatio) return false;
  if (prev.isPpvUnlocking !== next.isPpvUnlocking) return false;
  if (prev.isPpvUnlocked !== next.isPpvUnlocked) return false;
  if (prev.creditOnlyEcosystem !== next.creditOnlyEcosystem) return false;
  if (prev.pricePerCreditCents !== next.pricePerCreditCents) return false;
  if (prev.isLast && prev.isMine && prev.otherLastReadId !== next.otherLastReadId) return false;
  return true;
}

export const MessageBubble = memo(MessageBubbleComponent, propsAreEqual);
