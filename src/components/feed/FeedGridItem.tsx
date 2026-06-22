'use client';

import { useState, useEffect } from 'react';
import { RemoteImage } from '@/components/ui/remote-image';
import { Post } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { FeedItem } from './FeedItem';
import { ShortGridPreview } from './ShortGridPreview';
import { ShortsModal } from './ShortsModal';
import { muxThumbnailUrl } from '@/lib/mux/thumbnail';
import { Images, Video, Smartphone, Lock } from 'lucide-react';
import { usePostFullAccess } from '@/lib/feed/use-post-full-access';
import { publicPostImageUrl } from '@/lib/feed/post-access';

interface FeedGridItemProps {
  post: Post;
  onPostClick?: (post: Post) => void;
  onPostDelete?: () => void;
}

export function FeedGridItem({ post, onPostClick, onPostDelete }: FeedGridItemProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isShortsModalOpen, setIsShortsModalOpen] = useState(false);
  const { hasFullAccess } = usePostFullAccess(post);

  // Check if this is the user's own post — used only for non-short image path
  const isShort = post.post_media?.[0]?.media_type === 'short';

  // Get the appropriate image for the post
  const getPostImage = (): string | null => {
    if (!post.post_media || post.post_media.length === 0) {
      return null;
    }

    const previewPathForMedia = (media: (typeof post.post_media)[number]): string | null => {
      if (hasFullAccess) {
        if (media.media_type === 'image' && media.storage_path) return media.storage_path;
        if ((media.media_type === 'video' || media.media_type === 'short') && media.mux_playback_id) {
          return muxThumbnailUrl(media.mux_playback_id, { time: 0, width: 400 });
        }
        return media.storage_path ?? null;
      }
      return media.blurred_storage_path ?? null;
    };

    // For carousel, get the first image
    if (post.content_type === 'carousel') {
      const firstImage = post.post_media.find(media => media.media_type === 'image');
      if (firstImage) {
        return previewPathForMedia(firstImage);
      }
      return null;
    }

    const media = post.post_media[0];
    return previewPathForMedia(media);
  };

  const imageUrl = getPostImage();
  const resolvedImageSrc = imageUrl
    ? imageUrl.startsWith('http')
      ? imageUrl
      : publicPostImageUrl(imageUrl)
    : null;

  // Determine grid item dimensions
  const gridItemClass = cn(
    "relative overflow-hidden cursor-pointer w-full h-full",
  );

  const handleClick = () => {
    if (isShort) {
      setIsShortsModalOpen(true);
    } else {
      setIsModalOpen(true);
    }
    onPostClick?.(post);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
  };

  const handleShortsModalClose = () => {
    setIsShortsModalOpen(false);
  };

  const handlePostDelete = () => {
    setIsModalOpen(false);
    setIsShortsModalOpen(false);
    onPostDelete?.();
  };

  // Cleanup when modal closes
  useEffect(() => {
    if (!isModalOpen && isShort) {
      // Force a small delay to ensure the FeedItemShort has time to unmount
      const timer = setTimeout(() => {
        // This will trigger a re-render and ensure the component is properly unmounted
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isModalOpen, isShort]);

  return (
    <>
      <div 
        className={gridItemClass}
        onClick={handleClick}
      >
        {isShort ? (
          <ShortGridPreview post={post} sizes="400px" />
        ) : resolvedImageSrc ? (
          <RemoteImage
            src={resolvedImageSrc}
            alt={post.text_content || 'Post content'}
            fill
            className={cn(
              "object-cover transition-opacity duration-200",
              imageLoaded ? "opacity-100" : "opacity-0"
            )}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <span className="text-muted-foreground text-sm">
              {post.content_type === 'text_only' ? 'Text Post' : 'No Image'}
            </span>
          </div>
        )}

        {/* Lock overlay for non-public content */}
        {!hasFullAccess && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="text-white text-center">
              <div className="bg-black/50 text-white p-2 rounded-full mb-2">
                <Lock size={16} />
              </div>
            </div>
          </div>
        )}

        {/* Overlay with post info */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity duration-200">
          <div className="absolute bottom-2 left-2 right-2">
            <div className="flex items-center gap-2 text-white text-xs">
              <span className="font-medium truncate">
                {post.profiles.full_name || post.profiles.username}
              </span>
              <span>•</span>
              <span>{post.like_count} likes</span>
            </div>
            {post.text_content && (
              <p className="text-white text-xs mt-1 line-clamp-2">
                {post.text_content}
              </p>
            )}
          </div>
        </div>

        {/* Content type indicator */}
        {(post.content_type === 'carousel' && post.post_media && post.post_media.length > 1) ||
         (post.content_type === 'video' && post.post_media?.[0]?.media_type !== 'short') ||
         (post.post_media?.[0]?.media_type === 'short') ? (
          <div className="absolute top-2 right-2">
            <div className="bg-black/50 text-white p-1 rounded-full">
              {post.content_type === 'carousel' && post.post_media && post.post_media.length > 1 && (
                <Images size={12} />
              )}
              {post.content_type === 'video' && post.post_media?.[0]?.media_type !== 'short' && (
                <Video size={12} />
              )}
              {post.post_media?.[0]?.media_type === 'short' && (
                <Smartphone size={12} />
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Regular Modal for non-short content */}
      {isModalOpen && !isShort && (
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-none w-auto max-h-[90vh] overflow-y-scroll p-0 [&>button:has(.sr-only)]:hidden flex justify-center items-start">
            <DialogTitle className="sr-only">Post Details</DialogTitle>
            <div className="w-[90vw] md:w-[40vw]"> 
              <FeedItem 
                post={post} 
                onPostDelete={handlePostDelete}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Shorts Modal for short content */}
      
      <ShortsModal 
        isOpen={isShortsModalOpen}
        onClose={handleShortsModalClose}
        initialPostId={isShort ? post.id : undefined}
      />

    </>
  );
} 