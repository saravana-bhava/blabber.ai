'use client';

import { useState, useRef, useTransition, useCallback, useEffect } from 'react';
import NextImage from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  ImageIcon,
  VideoIcon,
  BarChart3Icon,
  Sparkles,
  UsersIcon,
  DollarSignIcon,
  XIcon,
  Loader2,
  GripVertical,
  UploadCloud,
  FilmIcon,
  AlignLeftIcon,
  LayoutGridIcon,
  StarIcon,
  LockIcon,
  SendIcon,
} from 'lucide-react';
import { createPost, createMuxDirectUploadUrl } from '@/app/actions/postActions';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/contexts/user-context';
import { usePulseUI } from '@/lib/contexts/pulse-ui-context';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { PpvPriceDialog, SubscriberOnlyDialog } from '@/components/feed/post-access-dialogs';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ShortRecorder } from './ShortRecorder';
import { CreatorImageGenDialog } from '@/components/creator/CreatorImageGenDialog';
import { FeedAccessPills, type FeedAccessLevel } from '@/components/feed/feed-access-pills';
import Image from 'next/image';
import { RemoteImage } from '@/components/ui/remote-image';
import {
  uploadPostImageDirect,
  type PreparedPostImage,
} from '@/lib/post-media/client-upload';

const MAX_CAROUSEL_ITEMS = 10;
const MAX_FILE_SIZE_MB = 50;
const MAX_VIDEO_FILE_SIZE_MB = 2000;
const MAX_POLL_OPTIONS = 5;

type PostTypeId = 'text' | 'image' | 'video' | 'carousel' | 'poll' | 'short';

const POST_TYPES: Array<{ id: PostTypeId; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = [
  { id: 'text',     label: 'Text',     icon: AlignLeftIcon },
  { id: 'image',    label: 'Photo',    icon: ImageIcon },
  { id: 'video',    label: 'Video',    icon: VideoIcon },
  { id: 'carousel', label: 'Carousel', icon: LayoutGridIcon },
  { id: 'poll',     label: 'Poll',     icon: BarChart3Icon },
  { id: 'short',    label: 'Short',    icon: FilmIcon },
];

const ACCESS_OPTIONS: Array<{ id: 'public' | 'subscribers_only' | 'ppv'; label: string; desc: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = [
  { id: 'public',           label: 'Public',       desc: 'Everyone',      icon: UsersIcon },
  { id: 'subscribers_only', label: 'Subscribers',  desc: 'Paying fans',   icon: StarIcon },
  { id: 'ppv',              label: 'Pay-per-view', desc: 'One-time unlock', icon: LockIcon },
];

interface MediaPreview {
  file: File;
  type: 'image' | 'video' | 'short';
  previewUrl: string;
  id: string;
  muxUploadId?: string;
  muxUploadUrl?: string;
  width?: number;
  height?: number;
}

interface NewPostProps {
  onPostSuccess?: () => void;
  /** When set (e.g. from /new-post?galleryImage=…), loads that gallery image into the composer once. */
  initialGalleryImageId?: string | null;
  /** Called after a gallery image is attached or if loading fails (parent can strip the query param). */
  onGalleryImageConsumed?: () => void;
  /** Dim home feed composer layout */
  variant?: 'default' | 'feed';
}

interface Creator {
  profile_id: string;
  can_monetize: boolean;
  can_img_gen: boolean;
  image_gen_source_path: string | null;
}

function generateUUID() {
  // Try to use crypto.randomUUID() first
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback for browsers that don't support crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function SortableMediaItem({ item, isPending, onRemove }: {
  item: MediaPreview;
  isPending: boolean;
  onRemove: (id: string) => void;
}) {
  const { 
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging 
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      className="relative group aspect-square touch-none"
    >
      {!isPending && (
        <button {...listeners} className="absolute top-1 left-1 z-20 p-1 cursor-grab active:cursor-grabbing touch-none">
            <GripVertical size={16} className="text-white/70 hover:text-white" />
        </button>
      )}
      
      {item.type === 'image' ? (
        <NextImage 
          src={item.previewUrl} 
          alt={`Preview ${item.file.name}`}
          fill 
          sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 20vw, 16vw"
          className="rounded-lg object-cover border" 
        />
      ) : (
        <div className="w-full h-full rounded-lg border bg-muted flex items-center justify-center p-2 relative">
          <span className="text-xs text-muted-foreground truncate">{item.file.name} ({item.type})</span>
          {item.type === 'short' && 
            <div className="absolute top-1.5 left-1.5 bg-pink-500 text-white text-[10px] px-1.5 py-0.5 rounded-sm font-bold leading-none">SHORT</div>
          }
        </div>
      )}
      {!isPending && (
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute top-1 right-1 h-6 w-6 bg-black/60 hover:bg-black/80 text-white rounded-full group-hover:opacity-100 opacity-0 transition-opacity z-10"
          onClick={() => onRemove(item.id)}
        >
          <XIcon size={14}/>
        </Button>
      )}
    </div>
  );
}

export type ActiveContentType = 'none' | 'text' | 'image' | 'video' | 'carousel' | 'poll' | 'short';

interface PollOption {
  id: string;
  value: string;
}

export function NewPost({
  onPostSuccess,
  initialGalleryImageId,
  onGalleryImageConsumed,
  variant = 'default',
}: NewPostProps) {
  const { session, profile, isLoading } = useUser();
  const { pulseEnabled } = usePulseUI();
  const [text, setText] = useState('');
  const [mediaItems, setMediaItems] = useState<MediaPreview[]>([]);
  const [isPending, startTransition] = useTransition();
  const [isPreparingVideo, setIsPreparingVideo] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  /**
   * Tracks browser-direct image uploads to Supabase Storage. We upload images
   * before invoking the createPost server action so the action receives only
   * the resulting storage paths (small JSON) instead of multi-MB blobs —
   * avoiding Vercel's 4.5 MB function request payload cap.
   */
  const [imageUploadStatus, setImageUploadStatus] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [creator, setCreator] = useState<Creator | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const [accessLevel, setAccessLevel] = useState<'public' | 'subscribers_only' | 'ppv'>('public');
  const [ppvPrice, setPpvPrice] = useState<number | null>(null);
  const [isSubscriberModalOpen, setIsSubscriberModalOpen] = useState(false);
  const [isPpvModalOpen, setIsPpvModalOpen] = useState(false);
  const [isShortRecorderOpen, setIsShortRecorderOpen] = useState(false);
  const [isImageGenDialogOpen, setIsImageGenDialogOpen] = useState(false);
  const lastGalleryImportedId = useRef<string | null>(null);

  const [activeContentType, setActiveContentType] = useState<'none' | 'poll' | 'short'>('none');

  // default-variant only state
  const [postType, setPostType] = useState<PostTypeId>('image');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [ppvPriceInput, setPpvPriceInput] = useState('');
  
  const [pollOptions, setPollOptions] = useState<PollOption[]>([
    { id: generateUUID(), value: '' },
    { id: generateUUID(), value: '' }
  ]);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
        activationConstraint: {
          distance: 10,
        },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const [dragActive, setDragActive] = useState(false);

  // Add useEffect to fetch creator record
  useEffect(() => {
    const fetchCreatorRecord = async () => {
      if (!session?.user) return;

      try {
        const { data, error } = await supabase
          .from('creators')
          .select('profile_id, can_monetize, can_img_gen, image_gen_source_path')
          .eq('profile_id', session.user.id)
          .maybeSingle();

        if (!error && data) {
          setCreator(data);
        }
      } catch (error) {
        console.error('Error fetching creator record:', error);
      }
    };

    fetchCreatorRecord();
  }, [session?.user, supabase]);

  // Fresh reference path when opening AI image gen (feed composer mounts once; path may have been added in settings/studio).
  useEffect(() => {
    if (!isImageGenDialogOpen || !session?.user?.id) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('creators')
        .select('profile_id, can_monetize, can_img_gen, image_gen_source_path')
        .eq('profile_id', session.user.id)
        .maybeSingle();
      if (cancelled) return;
      if (!error && data) {
        setCreator(data);
      } else if (!error && !data) {
        setCreator(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isImageGenDialogOpen, session?.user?.id, supabase]);

  useEffect(() => {
    if (!initialGalleryImageId) {
      lastGalleryImportedId.current = null;
      return;
    }
  }, [initialGalleryImageId]);

  useEffect(() => {
    if (!initialGalleryImageId || !session?.user?.id) return;
    const importGalleryId = initialGalleryImageId;
    if (lastGalleryImportedId.current === importGalleryId) return;

    let cancelled = false;

    const run = async () => {
      try {
        const { data, error } = await supabase
          .from('creator_image_gen_gallery')
          .select('id, storage_path')
          .eq('id', importGalleryId)
          .eq('profile_id', session.user.id)
          .maybeSingle();

        if (cancelled) return;

        if (error || !data) {
          toast.error('Could not load image from your studio gallery.');
          onGalleryImageConsumed?.();
          return;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from('creator-content').getPublicUrl(data.storage_path);
        const res = await fetch(publicUrl);
        if (!res.ok) throw new Error('fetch failed');
        const blob = await res.blob();
        const file = new File([blob], `studio-${data.id}.png`, {
          type: blob.type || 'image/png',
        });

        await new Promise<void>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const previewUrl = reader.result as string;
            const img = new window.Image();
            img.onload = () => {
              if (cancelled) {
                resolve();
                return;
              }
              lastGalleryImportedId.current = importGalleryId;
              setMediaItems((prev) => {
                if (prev.length >= MAX_CAROUSEL_ITEMS) {
                  toast.error(`You can attach at most ${MAX_CAROUSEL_ITEMS} images.`);
                  return prev;
                }
                if (prev.some((item) => item.type === 'video')) {
                  toast.error('Remove the video attachment before adding images.');
                  return prev;
                }
                if (activeContentType !== 'none') {
                  toast.error(`Clear ${activeContentType} content before adding images.`);
                  return prev;
                }
                return [
                  ...prev,
                  {
                    file,
                    type: 'image' as const,
                    previewUrl,
                    id: crypto.randomUUID(),
                    width: img.width,
                    height: img.height,
                  },
                ];
              });
              resolve();
            };
            img.onerror = () => reject(new Error('decode'));
            img.src = previewUrl;
          };
          reader.onerror = () => reject(new Error('read'));
          reader.readAsDataURL(blob);
        });

        if (!cancelled) {
          toast.success('Image added from studio');
          onGalleryImageConsumed?.();
        }
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          toast.error('Failed to attach studio image');
          onGalleryImageConsumed?.();
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [initialGalleryImageId, session?.user?.id, supabase, onGalleryImageConsumed, activeContentType]);

  const handleShortComplete = (data: { file: File, muxUploadId: string, muxUploadUrl: string }) => {
    setIsShortRecorderOpen(false);
    clearAllSelections();

    setMediaItems([{
        file: data.file,
        type: 'short',
        previewUrl: URL.createObjectURL(data.file),
        id: crypto.randomUUID(),
        muxUploadId: data.muxUploadId,
        muxUploadUrl: data.muxUploadUrl,
    }]);
    setActiveContentType('short');
    setAccessLevel('public');
  };

  const handleFilesChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    if (activeContentType !== 'none') {
        toast.error(`You cannot add media when creating a ${activeContentType}.`);
        if (event.target) event.target.value = '';
        return;
    }
    const files = event.target.files;
    if (!files) return;

    if (mediaItems.some(item => item.type === 'video')) {
      toast.error("You can only attach one video per post.");
      if (event.target) event.target.value = '';
      return;
    }
    if (type === 'image' && mediaItems.some(item => item.type === 'video')) {
        toast.error("You cannot add images to a video post.");
        if (event.target) event.target.value = '';
        return;
    }
    if (type === 'video' && mediaItems.some(item => item.type === 'image')) {
        toast.error("You cannot add a video to an image/carousel post.");
        if (event.target) event.target.value = '';
        return;
    }
    if (type === 'video' && files.length > 1) {
        toast.error("You can only upload one video file at a time.");
        if (event.target) event.target.value = '';
        return;
    }

    for (const file of Array.from(files)) {
      const uniqueId = crypto.randomUUID();
      if (type === 'image') {
        if (mediaItems.length >= MAX_CAROUSEL_ITEMS) {
          toast.error(`You can select a maximum of ${MAX_CAROUSEL_ITEMS} images.`);
          break;
        }
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
          toast.error(`Image \"${file.name}\" is too large. Max ${MAX_FILE_SIZE_MB}MB allowed.`);
          continue;
        }
        if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
          toast.error(`Invalid image type for \"${file.name}\". Only JPG, PNG, GIF, WEBP allowed.`);
          continue;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
          // Extract image dimensions
          const img = new window.Image();
          img.onload = () => {
            setMediaItems(prev => [...prev, {
              file,
              type: 'image',
              previewUrl: reader.result as string,
              id: uniqueId,
              width: img.width,
              height: img.height,
            }]);
          };
          img.src = reader.result as string;
        };
        reader.readAsDataURL(file);
      } else if (type === 'video') {
        if (file.size > MAX_VIDEO_FILE_SIZE_MB * 1024 * 1024) {
          toast.error(`Video \"${file.name}\" is too large. Max ${MAX_VIDEO_FILE_SIZE_MB}MB allowed.`);
          continue;
        }
        if (!file.type.startsWith('video/')) {
            toast.error(`File \"${file.name}\" does not appear to be a video.`);
            continue;
        }

        setIsPreparingVideo(true);
        toast.info('Preparing video for upload...');
        try {
          const muxUploadDataResult = await createMuxDirectUploadUrl();
          
          if ('error' in muxUploadDataResult) {
            toast.error(`Failed to prepare video upload: ${muxUploadDataResult.error}`);
            setIsPreparingVideo(false);
            continue; 
          } 
          const { data: muxData } = muxUploadDataResult;

          if (!muxData || !muxData.upload_url || !muxData.upload_id) {
            toast.error('Failed to prepare video upload: Invalid Mux data received.');
            setIsPreparingVideo(false);
            continue;
          }

          // Extract video dimensions
          const video = document.createElement('video');
          video.preload = 'metadata';
          video.onloadedmetadata = () => {
            setMediaItems(prev => [...prev, {
              file,
              type: 'video',
              previewUrl: file.name,
              id: uniqueId,
              muxUploadId: muxData.upload_id,
              muxUploadUrl: muxData.upload_url,
              width: video.videoWidth,
              height: video.videoHeight,
            }]);
            URL.revokeObjectURL(video.src);
          };
          video.src = URL.createObjectURL(file);
        } catch (e: any) {
          toast.error(`Error preparing video: ${e.message}`);
        } finally {
          setIsPreparingVideo(false);
        }
      }
    }
    if (event.target) event.target.value = '';
  }, [mediaItems, activeContentType]);

  const removeMediaItem = (idToRemove: string) => {
    setMediaItems(prev => prev.filter(item => item.id !== idToRemove));
  };

  const clearAllSelections = () => {
    setText('');
    setMediaItems([]);
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
    setPollOptions([
        { id: generateUUID(), value: '' },
        { id: generateUUID(), value: '' },
    ]);
    setActiveContentType('none'); 
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const {active, over} = event;
    if (over && active.id !== over.id) {
      setMediaItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handlePostSubmit = async () => {
    const commonFormData = new FormData();
    if (text.trim()) {
      commonFormData.append('textContent', text.trim());
    }

    let postTypeForAction: string = 'TEXT_ONLY'; // Default, will be overridden
    let metadataForAction: string | null = null;

    if (activeContentType === 'poll') {
      if (!text.trim()) {
        toast.error('Please enter a question for your poll.');
        return;
      }
      const filledPollOptions = pollOptions.filter(opt => opt.value.trim() !== '');
      if (filledPollOptions.length < 2) {
        toast.error('Polls must have at least 2 options.');
        return;
      }
      postTypeForAction = 'POLL';
      const pollMetadata = {
        type: "POLL",
        options: filledPollOptions.map((opt, index) => ({ 
          id: opt.id, // Keep original ID for potential future use
          text: opt.value.trim(), 
          order: index 
        }))
      };
      metadataForAction = JSON.stringify(pollMetadata);

    } else if (mediaItems.length > 0) {
        const videoItem = mediaItems.find(item => item.type === 'video' || item.type === 'short');
        if (videoItem && !videoItem.muxUploadUrl) {
            toast.error("Video is still being prepared. Please wait.");
            return;
        }
        if (isPreparingVideo) {
            toast.info("Please wait, video is being prepared for upload.");
            return;
        }
        let muxVideoUploadId: string | undefined = undefined;
        if (videoItem && videoItem.muxUploadUrl && videoItem.file) {
            setIsUploadingVideo(true);
            setUploadProgress(0);
            toast.info(`Uploading "${videoItem.file.name}"... This may take a moment.`);
            try {
                const xhr = new XMLHttpRequest();
                
                // Create a promise to handle the upload
                const uploadPromise = new Promise<void>((resolve, reject) => {
                    xhr.upload.addEventListener('progress', (event) => {
                        if (event.lengthComputable) {
                            const progress = Math.round((event.loaded / event.total) * 100);
                            setUploadProgress(progress);
                        }
                    });
                    
                    xhr.addEventListener('load', () => {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            resolve();
                        } else {
                            reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText}`));
                        }
                    });
                    
                    xhr.addEventListener('error', () => {
                        reject(new Error('Upload failed'));
                    });
                    
                    xhr.addEventListener('abort', () => {
                        reject(new Error('Upload was aborted'));
                    });
                });
                
                xhr.open('PUT', videoItem.muxUploadUrl);
                xhr.setRequestHeader('Content-Type', videoItem.file.type);
                xhr.send(videoItem.file);
                
                await uploadPromise;
                
                toast.success(`"${videoItem.file.name}" uploaded to Mux.`);
                muxVideoUploadId = videoItem.muxUploadId;
            } catch (uploadError: any) {
                console.error('Mux upload error:', uploadError);
                toast.error(`Error uploading video: ${uploadError.message}`);
                return;
            } finally {
                setIsUploadingVideo(false);
                setUploadProgress(0);
            }
        }

        if (muxVideoUploadId) {
            commonFormData.append('muxUploadId', muxVideoUploadId);
            // Send width/height for mux video
            if (videoItem?.width && videoItem?.height) {
                commonFormData.append('muxVideoDimensions', JSON.stringify({ width: videoItem.width, height: videoItem.height }));
            }
            postTypeForAction = videoItem?.type === 'short' ? 'SHORT' : 'VIDEO';
        } else if (mediaItems.some(item => item.type === 'image')){
            const imageItems = mediaItems.filter(item => item.type === 'image');
            const userId = session?.user?.id;
            if (!userId) {
                toast.error('Please sign in again before posting.');
                return;
            }

            const needsBlurredVersion = accessLevel !== 'public';
            setImageUploadStatus({ current: 0, total: imageItems.length });

            let preparedImages: PreparedPostImage[] = [];
            try {
                let completed = 0;
                preparedImages = await Promise.all(
                    imageItems.map(async (item) => {
                        const result = await uploadPostImageDirect({
                            supabase,
                            userId,
                            file: item.file,
                            width: item.width,
                            height: item.height,
                            needsBlurredVersion,
                        });
                        completed += 1;
                        setImageUploadStatus({ current: completed, total: imageItems.length });
                        return result;
                    })
                );
            } catch (uploadErr) {
                console.error('Image upload error:', uploadErr);
                const msg = uploadErr instanceof Error ? uploadErr.message : 'Image upload failed';
                toast.error(`Failed to upload images: ${msg}`);
                setImageUploadStatus(null);
                return;
            } finally {
                setImageUploadStatus(null);
            }

            commonFormData.append('preparedImages', JSON.stringify(preparedImages));
            postTypeForAction = imageItems.length > 1 ? 'CAROUSEL' : 'IMAGE';
        }
    } else if (!text.trim()) {
        toast.error('Please add some content to your post.');
        return;
    }
    if (postTypeForAction === 'TEXT_ONLY' && !text.trim()) {
        toast.error('Cannot create an empty post.');
        return;
    }

    commonFormData.append('postContentType', postTypeForAction);
    if (metadataForAction) {
      commonFormData.append('metadata', metadataForAction);
    }
    commonFormData.append('accessLevel', accessLevel);
    if (accessLevel === 'ppv' && ppvPrice) {
      commonFormData.append('ppvPriceCents', ppvPrice.toString());
    }

    startTransition(async () => {
      try {
        const result = await createPost(commonFormData);
        if (result.error) {
          toast.error(`Failed to create post: ${result.error}`);
        } else {
          toast.success('Post created successfully!');
          clearAllSelections();
          setAccessLevel('public');
          setPpvPrice(null);
          router.refresh();
          if (onPostSuccess) {
            onPostSuccess();
          }
        }
      } catch (e: any) {
        console.error('Post creation error:', e);
        toast.error(`An unexpected error occurred while posting: ${e.message}`);
      }
    });
  };

  const handlePollOptionChange = (id: string, value: string) => {
    setPollOptions(prev => prev.map(opt => opt.id === id ? { ...opt, value } : opt));
  };

  const addPollOption = () => {
    if (pollOptions.length < MAX_POLL_OPTIONS) {
      setPollOptions(prev => [...prev, { id: generateUUID(), value: '' }]);
    } else {
      toast.error(`Maximum of ${MAX_POLL_OPTIONS} poll options allowed.`);
    }
  };

  const removePollOption = (id: string) => {
    if (pollOptions.length > 2) {
      setPollOptions(prev => prev.filter(opt => opt.id !== id));
    } else {
      toast.error('Polls must have at least 2 options.');
    }
  };

  const handlePollModeSelect = () => {
    if (mediaItems.length > 0) {
      toast.error('Clear existing media before creating a poll.');
      return;
    }
    setActiveContentType('poll');
    setPollOptions([
      { id: generateUUID(), value: '' },
      { id: generateUUID(), value: '' },
    ]);
  };

  const renderPollCreator = () => (
    <div className="mt-3 p-4 border border-border rounded-lg bg-muted/30">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-md font-semibold text-foreground flex items-center">
          <BarChart3Icon size={18} className="mr-2" /> Poll Options
        </h3>
        <Button variant="ghost" size="icon" onClick={() => setActiveContentType('none')} className="h-7 w-7">
          <XIcon size={16} />
        </Button>
      </div>
      <div className="space-y-2">
        {pollOptions.map((option, index) => (
          <div key={option.id} className="flex items-center space-x-2">
            <Input 
                type="text" 
                placeholder={`Option ${index + 1}`}
                value={option.value}
                onChange={(e) => handlePollOptionChange(option.id, e.target.value)}
                className="w-full bg-background border-border/70 focus:border-primary flex-grow"
                maxLength={80}
                disabled={isPending || isUploadingVideo}
            />
            {pollOptions.length > 2 && (
              <Button variant="ghost" size="icon" onClick={() => removePollOption(option.id)} className="h-8 w-8 flex-shrink-0" disabled={isPending || isUploadingVideo}>
                <XIcon size={16} />
              </Button>
            )}
          </div>
        ))}
      </div>
      {pollOptions.length < MAX_POLL_OPTIONS && (
        <Button variant="link" onClick={addPollOption} className="mt-2 px-0 text-pink-500 hover:text-pink-600" disabled={isPending || isUploadingVideo}>
          + Add another option
        </Button>
      )}
    </div>
  );

  const handleSubscribersOnly = () => {
    if (accessLevel === 'subscribers_only') {
      // If already subscriber-only, toggle it off
      setAccessLevel('public');
      setPpvPrice(null);
    } else {
      // If not subscriber-only, open modal to confirm
      setIsSubscriberModalOpen(true);
    }
  };

  const handlePPV = () => {
    if (accessLevel === 'ppv') {
      // If already PPV, toggle it off
      setAccessLevel('public');
      setPpvPrice(null);
    } else {
      // If not PPV, open modal to set price
      setIsPpvModalOpen(true);
    }
  };

  const handleSubscriberModalConfirm = () => {
    setAccessLevel('subscribers_only');
    setPpvPrice(null); // Clear any PPV price when setting to subscriber-only
    setIsSubscriberModalOpen(false);
  };

  const handlePpvModalConfirm = (price: number) => {
    setAccessLevel('ppv');
    setPpvPrice(price);
    setIsPpvModalOpen(false);
  };

  // default-variant handlers
  const handlePostTypeChange = (type: PostTypeId) => {
    setPostType(type);
    setMediaItems([]);
    if (type === 'poll') {
      setActiveContentType('poll');
      setPollOptions([{ id: generateUUID(), value: '' }, { id: generateUUID(), value: '' }]);
    } else {
      setActiveContentType('none');
    }
  };

  const addTag = () => {
    const t = tagInput.trim().replace(/\s+/g, '-');
    if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
    setTagInput('');
  };

  const removeTag = (tag: string) => setTags(prev => prev.filter(t => t !== tag));

  const handleAccessCardClick = (level: 'public' | 'subscribers_only' | 'ppv') => {
    if (accessLevel === level) {
      setAccessLevel('public');
      setPpvPrice(null);
      setPpvPriceInput('');
    } else {
      setAccessLevel(level);
      if (level !== 'ppv') {
        setPpvPrice(null);
        setPpvPriceInput('');
      }
    }
  };

  const handleInlinePpvChange = (value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    setPpvPriceInput(cleaned);
    const num = parseFloat(cleaned);
    if (!isNaN(num) && num > 0) {
      setPpvPrice(Math.round(num * 100));
    } else {
      setPpvPrice(null);
    }
  };

  const isMediaDisabled = activeContentType !== 'none' || mediaItems.length >= MAX_CAROUSEL_ITEMS || (mediaItems.length > 0 && activeContentType === 'none' && mediaItems.some(item => item.type === 'video'));
  const isVideoDisabled = activeContentType !== 'none' || mediaItems.length > 0;
  const isPollMediaBlocked = mediaItems.length > 0;
  const isShortsDisabled = activeContentType !== 'none' || mediaItems.length > 0;
  const isMonetizationDisabled = isPending || isUploadingVideo || mediaItems.some(item => item.type === 'short');

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(true);
  };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;
    if (files.every(f => f.type.startsWith('image/'))) {
      const dt = new DataTransfer();
      files.forEach(f => dt.items.add(f));
      const event = { target: { files: dt.files } } as React.ChangeEvent<HTMLInputElement>;
      handleFilesChange(event, 'image');
    } else if (files.length === 1 && files[0].type.startsWith('video/')) {
      const dt = new DataTransfer();
      dt.items.add(files[0]);
      const event = { target: { files: dt.files } } as React.ChangeEvent<HTMLInputElement>;
      handleFilesChange(event, 'video');
    } else {
      toast.error('Please drop only images or a single video.');
    }
  };

  const handleAccessPillChange = (level: FeedAccessLevel) => {
    if (level === 'public') {
      setAccessLevel('public');
      setPpvPrice(null);
      return;
    }
    if (level === 'subscribers_only') {
      if (accessLevel === 'subscribers_only') {
        setAccessLevel('public');
        setPpvPrice(null);
      } else {
        setIsSubscriberModalOpen(true);
      }
      return;
    }
    if (accessLevel === 'ppv') {
      setAccessLevel('public');
      setPpvPrice(null);
    } else {
      setIsPpvModalOpen(true);
    }
  };

  // ── Dim design: full-page new-post layout ──────────────────────────────────
  if (variant === 'default') {
    const needsMedia = ['image', 'video', 'carousel', 'short'].includes(postType);
    const dropZoneHeight = postType === 'short' ? 320 : 220;

    const dropLabel =
      postType === 'carousel' ? 'Drop photos (up to 10)' :
      postType === 'video'    ? 'Drop a video — uploads to Mux' :
      postType === 'short'    ? 'Drop a vertical clip' :
                                'Drop a photo or click to upload';

    const DropIcon = (postType === 'video' || postType === 'short') ? VideoIcon
      : postType === 'carousel' ? LayoutGridIcon
      : ImageIcon;

    const canPublish =
      !isPending && !isPreparingVideo && !isUploadingVideo &&
      !(postType !== 'poll' && mediaItems.length === 0 && !text.trim()) &&
      !(postType === 'poll' && pollOptions.filter(o => o.value.trim()).length < 2 && !text.trim()) &&
      !(accessLevel === 'ppv' && (!ppvPrice || ppvPrice <= 0));

    return (
      <>
        <div
          className="relative"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Drag overlay */}
          <div
            className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 pointer-events-none z-10 ${dragActive ? 'opacity-100' : 'opacity-0'}`}
            style={{ background: 'rgba(236, 72, 153, 0.15)' }}
          >
            <div className="flex items-center gap-2">
              <UploadCloud size={20} className="text-pink-500" />
              <span className="text-pink-500 font-medium text-sm">Drop to upload</span>
            </div>
          </div>

          {/* Video upload progress overlay */}
          {isUploadingVideo && (
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-20">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg max-w-sm w-full mx-4">
                <div className="flex items-center gap-3 mb-4">
                  <Loader2 size={20} className="animate-spin text-pink-500" />
                  <span className="font-medium text-foreground">Uploading video...</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
                  <div
                    className="bg-pink-500 h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <div className="text-sm text-muted-foreground text-center">{uploadProgress}% complete</div>
              </div>
            </div>
          )}

          <div className={cn('max-w-2xl mx-auto px-5 pb-20 pt-5', (dragActive || isUploadingVideo) && 'opacity-50 pointer-events-none')}>

            {/* ① Post type selector */}
            <div className="flex gap-2 flex-wrap mb-5">
              {POST_TYPES.map((pt) => {
                const PtIcon = pt.icon;
                return (
                  <button
                    key={pt.id}
                    onClick={() => handlePostTypeChange(pt.id)}
                    className={cn(
                      'inline-flex h-[38px] items-center gap-1.5 px-3.5 rounded-full text-[13px] font-semibold transition-all border',
                      postType === pt.id
                        ? 'border-transparent text-[var(--brand-on-accent)] [background:var(--brand-grad)]'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/80'
                    )}
                  >
                    <PtIcon size={15} />
                    {pt.label}
                  </button>
                );
              })}
              {creator?.can_img_gen && (
                <button
                  onClick={() => setIsImageGenDialogOpen(true)}
                  className="inline-flex h-[38px] items-center gap-1.5 px-3.5 rounded-full text-[13px] font-semibold transition-all border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/80"
                >
                  <Sparkles size={15} />
                  AI Image
                </button>
              )}
            </div>

            {/* ② Caption card */}
            <div className="rounded-2xl border border-border bg-card p-4 mb-4">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                placeholder="Write a caption…"
                className="w-full border-none resize-none bg-transparent focus-visible:ring-0 shadow-none text-base p-0"
                disabled={isPending || isUploadingVideo}
              />
            </div>

            {/* ③ Media dropzone */}
            {needsMedia && (
              <div
                className="relative rounded-2xl mb-4 border-[1.5px] border-dashed border-border/60 bg-card cursor-pointer overflow-hidden"
                style={{ height: dropZoneHeight }}
                onClick={() => {
                  if (postType === 'short') setIsShortRecorderOpen(true);
                  else if (postType === 'video') videoInputRef.current?.click();
                  else imageInputRef.current?.click();
                }}
              >
                {mediaItems.length > 0 ? (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={mediaItems.map(i => i.id)} strategy={rectSortingStrategy}>
                      <div className="p-4 grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {mediaItems.map((item) => (
                          <SortableMediaItem key={item.id} item={item} isPending={isPending} onRemove={removeMediaItem} />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground select-none gap-2">
                    <DropIcon size={32} className="text-muted-foreground/30" />
                    <div className="font-[650] text-sm">{dropLabel}</div>
                    <div className="text-xs text-muted-foreground/50">JPG, PNG, MP4 · max 2GB</div>
                  </div>
                )}
              </div>
            )}

            {/* ④ Poll builder */}
            {postType === 'poll' && (
              <div className="rounded-2xl border border-border bg-card p-4 mb-4">
                <div className="font-bold text-sm mb-3">Poll options</div>
                <div className="space-y-2">
                  {pollOptions.map((option, index) => (
                    <div key={option.id} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder={`Option ${index + 1}`}
                        value={option.value}
                        onChange={(e) => handlePollOptionChange(option.id, e.target.value)}
                        className="flex-1 h-11 px-3.5 rounded-xl border border-border/70 bg-muted/30 text-foreground outline-none text-sm focus:border-[var(--brand-pink)]"
                        maxLength={80}
                        disabled={isPending || isUploadingVideo}
                      />
                      {pollOptions.length > 2 && (
                        <button onClick={() => removePollOption(option.id)} className="text-muted-foreground/50 hover:text-muted-foreground" disabled={isPending || isUploadingVideo}>
                          <XIcon size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {pollOptions.length < MAX_POLL_OPTIONS && (
                  <button onClick={addPollOption} className="mt-2.5 text-[var(--brand-pink)] font-semibold text-[13.5px] hover:opacity-80" disabled={isPending || isUploadingVideo}>
                    + Add option
                  </button>
                )}
              </div>
            )}

            {/* ⑤ Access level cards — only for monetizable creators */}
            {creator?.can_monetize && (
              <>
                <div className="font-bold text-[13.5px] mb-2.5 text-muted-foreground">Who can see this?</div>
                <div className="grid grid-cols-3 gap-2.5 mb-4">
                  {ACCESS_OPTIONS.map((opt) => {
                    const OptIcon = opt.icon;
                    const isActive = accessLevel === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => handleAccessCardClick(opt.id)}
                        disabled={isMonetizationDisabled}
                        className={cn(
                          'w-full p-3.5 rounded-2xl text-left border transition-all disabled:opacity-40',
                          isActive ? 'border-transparent' : 'border-border'
                        )}
                        style={isActive ? { background: 'var(--brand-grad-soft)', boxShadow: 'var(--brand-ring-money)' } : { background: 'var(--card)' }}
                      >
                        <OptIcon size={18} className={isActive ? 'text-[var(--brand-pink)]' : 'text-muted-foreground'} />
                        <div className="font-bold text-[13.5px] mt-2">{opt.label}</div>
                        <div className="text-[11.5px] text-muted-foreground/70 mt-0.5">{opt.desc}</div>
                      </button>
                    );
                  })}
                </div>

                {/* PPV inline price */}
                {accessLevel === 'ppv' && (
                  <div
                    className="flex items-center gap-2.5 mb-4 px-3.5 py-3 rounded-xl"
                    style={{ background: 'var(--brand-grad-soft)' }}
                  >
                    <DollarSignIcon size={16} className="text-[var(--brand-pink)] shrink-0" />
                    <span className="font-semibold text-sm">Unlock price</span>
                    <span className="text-muted-foreground">$</span>
                    <input
                      type="text"
                      value={ppvPriceInput}
                      onChange={(e) => handleInlinePpvChange(e.target.value)}
                      placeholder="8.99"
                      className="w-20 h-9 px-3 rounded-lg border border-border/60 bg-background text-foreground outline-none text-sm focus:border-[var(--brand-pink)]"
                    />
                    {ppvPriceInput && !isNaN(parseFloat(ppvPriceInput)) && parseFloat(ppvPriceInput) > 0 && (
                      <span className="text-xs text-muted-foreground ml-1">
                        ≈ {Math.round(parseFloat(ppvPriceInput) * 10)} credits
                      </span>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ⑥ Tags */}
            <div className="font-bold text-[13.5px] mb-2.5 text-muted-foreground">Tags</div>
            <div className="flex flex-wrap gap-2 items-center mb-6">
              {tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 h-7 px-3 rounded-full bg-muted/60 border border-border text-sm font-medium">
                  #{tag}
                  <button onClick={() => removeTag(tag)} className="text-muted-foreground/50 hover:text-muted-foreground flex items-center ml-0.5">
                    <XIcon size={12} />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                placeholder="add tag…"
                className="h-8 px-3 rounded-full border border-dashed border-border/60 bg-transparent text-foreground outline-none text-[13px] w-28 placeholder:text-muted-foreground/50 focus:border-[var(--brand-pink)]"
              />
            </div>

            {/* ⑦ Publish row */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="h-12 shrink-0 px-5 rounded-full text-sm font-semibold"
                onClick={() => {
                  clearAllSelections();
                  setPostType('image');
                  setTags([]);
                  setTagInput('');
                  toast.info('Draft cleared');
                }}
                disabled={isPending || isUploadingVideo}
              >
                Save draft
              </Button>
              <Button
                onClick={handlePostSubmit}
                className="flex-1 h-12 rounded-full text-[15.5px] font-semibold text-[var(--brand-on-accent)] [background:var(--brand-grad)] hover:brightness-110 [box-shadow:var(--brand-ring-money)] gap-2"
                disabled={!canPublish}
              >
                {isPending ? (
                  <><Loader2 size={18} className="animate-spin" />Posting...</>
                ) : isUploadingVideo ? (
                  <><Loader2 size={18} className="animate-spin" />Uploading...</>
                ) : (
                  <><SendIcon size={17} />Publish post</>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Hidden file inputs */}
        <input type="file" ref={imageInputRef} accept="image/jpeg,image/png,image/gif,image/webp" onChange={(e) => handleFilesChange(e, 'image')} multiple className="hidden" disabled={isPending || isPreparingVideo || isUploadingVideo} />
        <input type="file" ref={videoInputRef} accept="video/*" onChange={(e) => handleFilesChange(e, 'video')} className="hidden" disabled={isPending || isPreparingVideo || isUploadingVideo} />

        {isShortRecorderOpen && (
          <ShortRecorder isOpen={isShortRecorderOpen} onClose={() => setIsShortRecorderOpen(false)} onComplete={handleShortComplete} />
        )}

        {session?.user?.id && creator?.can_img_gen && (
          <CreatorImageGenDialog
            open={isImageGenDialogOpen}
            onOpenChange={setIsImageGenDialogOpen}
            profileId={session.user.id}
            hasReferencePhoto={!!creator?.image_gen_source_path}
            onNavigateToNewPost={(galleryImageId) => {
              setIsImageGenDialogOpen(false);
              router.push(`/new-post?galleryImage=${galleryImageId}`);
            }}
          />
        )}

        <SubscriberOnlyDialog open={isSubscriberModalOpen} onOpenChange={setIsSubscriberModalOpen} onConfirm={handleSubscriberModalConfirm} />
        <PpvPriceDialog open={isPpvModalOpen} onOpenChange={setIsPpvModalOpen} initialPriceCents={ppvPrice} onConfirm={handlePpvModalConfirm} />
      </>
    );
  }
  // ── End default variant ─────────────────────────────────────────────────────

  const composerShellClass =
    variant === 'feed'
      ? 'relative px-[22px] py-[18px]'
      : 'mb-0 rounded-none border-b border-border/60 p-2 md:p-4 pt-8 relative';

  const feedToolBtnClass =
    'inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] text-muted-foreground transition-colors hover:bg-muted/80 hover:text-[var(--brand-pink)] disabled:opacity-40';

  return (
    <>
      <div
        className={composerShellClass}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 pointer-events-none ${dragActive ? 'opacity-100' : 'opacity-0'}`}
          style={{ background: 'rgba(236, 72, 153, 0.15)', zIndex: 10 }}
        >
          <div className="flex items-center gap-2">
            <UploadCloud size={20} className="text-pink-500" />
            <span className="text-pink-500 font-medium text-sm">Drop to upload</span>
          </div>
        </div>
        
        {/* Video upload progress overlay */}
        {isUploadingVideo && (
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-20">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg max-w-sm w-full mx-4">
              <div className="flex items-center gap-3 mb-4">
                <Loader2 size={20} className="animate-spin text-pink-500" />
                <span className="font-medium text-foreground">Uploading video...</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
                <div 
                  className="bg-pink-500 h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <div className="text-sm text-muted-foreground text-center">
                {uploadProgress}% complete
              </div>
            </div>
          </div>
        )}
        {/* Main input area, faded out when dragging */}
        <div
          className={cn(
            'transition-opacity duration-200',
            dragActive ? 'opacity-0' : 'opacity-100',
            variant === 'feed' && 'flex gap-3'
          )}
        >
          {variant === 'feed' && profile && (
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-muted">
              {profile.avatar_url ? (
                <RemoteImage
                  src={profile.avatar_url}
                  alt=""
                  width={44}
                  height={44}
                  className="h-full w-full object-cover"
                  priority
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-sm font-bold text-muted-foreground">
                  {(profile.full_name || profile.username || 'U').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
          )}
          <div className={variant === 'feed' ? 'min-w-0 flex-1' : 'w-full'}>
          {variant === 'feed' ? (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={1}
              placeholder={
                activeContentType === 'poll'
                  ? 'Ask your question or describe your content…'
                  : 'Share something with your fans…'
              }
              className="w-full resize-none border-0 bg-transparent pt-2 text-[16.5px] leading-normal text-foreground outline-none placeholder:text-muted-foreground"
              disabled={isPending || isPreparingVideo || isUploadingVideo}
            />
          ) : (
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={activeContentType === 'poll' ? "Ask your question or describe your content..." : "What's on your mind?"}
            className="w-full min-h-[80px] p-3 pt-0 text-base resize-none border-none focus:ring-0 focus:border-none focus-visible:ring-0 focus-visible:shadow-none shadow-none text-neutral-900 dark:bg-transparent dark:text-neutral-50"
            disabled={isPending || isPreparingVideo || isUploadingVideo}
          />
          )}
          {mediaItems.length > 0 && (activeContentType === 'none' || activeContentType === 'short') && (
            <DndContext 
              sensors={sensors} 
              collisionDetection={closestCenter} 
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={mediaItems.map(item => item.id)} strategy={rectSortingStrategy}>
                <div className="mt-2 mb-3 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                  {mediaItems.map((item) => (
                    <SortableMediaItem 
                      key={item.id} 
                      item={item} 
                      isPending={isPending} 
                      onRemove={removeMediaItem}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
          {activeContentType === 'poll' && renderPollCreator()}
          <div
            className={cn(
              'flex items-center',
              variant === 'feed' ? 'mt-2.5 flex-wrap gap-1.5' : 'justify-between pt-3'
            )}
          >
            <div
              className={cn(
                'flex items-center text-muted-foreground',
                variant === 'feed' ? 'gap-1' : 'space-x-1'
              )}
            >
              {variant === 'feed' ? (
                <>
                  <button
                    type="button"
                    title="Photo"
                    className={feedToolBtnClass}
                    disabled={isPending || isPreparingVideo || isUploadingVideo || isMediaDisabled}
                    onClick={() => imageInputRef.current?.click()}
                  >
                    <ImageIcon size={20} />
                  </button>
                  <button
                    type="button"
                    title="Video"
                    className={feedToolBtnClass}
                    disabled={isPending || isPreparingVideo || isUploadingVideo || isVideoDisabled}
                    onClick={() => videoInputRef.current?.click()}
                  >
                    <VideoIcon size={20} />
                  </button>
                  <button
                    type="button"
                    title="Short"
                    className={feedToolBtnClass}
                    disabled={isPending || isUploadingVideo || isShortsDisabled}
                    onClick={() => setIsShortRecorderOpen(true)}
                  >
                    <FilmIcon size={20} />
                  </button>
                  {creator?.can_img_gen && (
                    <button
                      type="button"
                      title="AI"
                      className={feedToolBtnClass}
                      disabled={isPending || isUploadingVideo || isPollMediaBlocked}
                      onClick={() => setIsImageGenDialogOpen(true)}
                    >
                      <Sparkles size={20} />
                    </button>
                  )}
                  <button
                    type="button"
                    title="Poll"
                    className={feedToolBtnClass}
                    disabled={isPending || isUploadingVideo || isPollMediaBlocked}
                    onClick={handlePollModeSelect}
                  >
                    <BarChart3Icon size={20} />
                  </button>
                  <input type="file" ref={imageInputRef} accept="image/jpeg,image/png,image/gif,image/webp" onChange={(e) => handleFilesChange(e, 'image')} multiple className="hidden" disabled={isPending || isPreparingVideo || isUploadingVideo || mediaItems.some(item => item.type === 'video')} />
                  <input type="file" ref={videoInputRef} accept="video/*" onChange={(e) => handleFilesChange(e, 'video')} className="hidden" disabled={isPending || isPreparingVideo || isUploadingVideo || mediaItems.length > 0} />
                </>
              ) : (
                <>
              <Button variant="ghost" size="icon" onClick={() => !isPending && !isPreparingVideo && !isUploadingVideo && imageInputRef.current?.click()} className="hover:text-pink-500 hover:bg-pink-500/10 rounded-full h-9 w-9" disabled={isPending || isPreparingVideo || isUploadingVideo || isMediaDisabled}>
                <ImageIcon size={20} />
                <span className="sr-only">Add Image</span>
              </Button>
              <input type="file" ref={imageInputRef} accept="image/jpeg,image/png,image/gif,image/webp" onChange={(e) => handleFilesChange(e, 'image')} multiple className="hidden" disabled={isPending || isPreparingVideo || isUploadingVideo || mediaItems.some(item => item.type === 'video')} />
              <Button data-creator-tour="newpost-video" variant="ghost" size="icon" onClick={() => !isPending && !isPreparingVideo && !isUploadingVideo && videoInputRef.current?.click()} className="hover:text-pink-500 hover:bg-pink-500/10 rounded-full h-9 w-9" disabled={isPending || isPreparingVideo || isUploadingVideo || isVideoDisabled}>
                <VideoIcon size={20} />
                <span className="sr-only">Add Video</span>
              </Button>
              <input type="file" ref={videoInputRef} accept="video/*" onChange={(e) => handleFilesChange(e, 'video')} className="hidden" disabled={isPending || isPreparingVideo || isUploadingVideo || mediaItems.length > 0} />
              <Button data-creator-tour="newpost-short" variant="ghost" size="icon" onClick={() => setIsShortRecorderOpen(true)} className="hover:text-pink-500 hover:bg-pink-500/10 rounded-full h-9 w-9" disabled={isPending || isUploadingVideo || isShortsDisabled}>
                <FilmIcon size={20} />
                <span className="sr-only">Create a Short</span>
              </Button>
              {creator?.can_img_gen && (
                <Button
                  data-creator-tour="newpost-aigen"
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsImageGenDialogOpen(true)}
                  className="hover:text-pink-500 hover:bg-pink-500/10 rounded-full h-9 w-9"
                  disabled={isPending || isUploadingVideo || isPollMediaBlocked}
                >
                  <Sparkles size={20} />
                  <span className="sr-only">AI image studio</span>
                </Button>
              )}
              <Button data-creator-tour="newpost-poll" variant="ghost" size="icon" onClick={handlePollModeSelect} className="hover:text-pink-500 hover:bg-pink-500/10 rounded-full h-9 w-9" disabled={isPending || isUploadingVideo || isPollMediaBlocked}>
                <BarChart3Icon size={20} />
                <span className="sr-only">Create Poll</span>
              </Button>
              {creator?.can_monetize && (
                <>
                  <Button 
                    data-creator-tour="newpost-subscribers-only"
                    variant="ghost" 
                    size="icon" 
                    onClick={handleSubscribersOnly} 
                    className={cn(
                      'rounded-full h-9 w-9 hover:text-[var(--brand-pink)] hover:bg-[var(--brand-grad-soft)]',
                      accessLevel === 'subscribers_only' && 'text-[var(--brand-pink)] bg-[var(--brand-grad-soft)]'
                    )}
                    disabled={isPending || isMonetizationDisabled}
                  >
                    <UsersIcon size={20} />
                    <span className="sr-only">Subscribers Only</span>
                  </Button>
                  <Button 
                    data-creator-tour="newpost-ppv"
                    variant="ghost" 
                    size="icon" 
                    onClick={handlePPV} 
                    className={cn(
                      'rounded-full h-9 w-9 hover:text-[var(--brand-pink)] hover:bg-[var(--brand-grad-soft)]',
                      accessLevel === 'ppv' && 'text-[var(--brand-pink)] bg-[var(--brand-grad-soft)]'
                    )}
                    disabled={isPending || isMonetizationDisabled}
                  >
                    <DollarSignIcon size={20} />
                    <span className="sr-only">Set PPV Price</span>
                  </Button>
                </>
              )}
                </>
              )}
            </div>
            {variant === 'feed' && <div className="min-w-2 flex-1" />}
            {variant === 'feed' && creator?.can_monetize && (
              <FeedAccessPills
                value={accessLevel}
                onChange={handleAccessPillChange}
                disabled={isMonetizationDisabled}
              />
            )}
            <Button 
              data-creator-tour="newpost-submit"
              onClick={handlePostSubmit} 
              className={cn(
                variant === 'feed'
                  ? 'h-10 shrink-0 rounded-full px-[18px] text-sm font-semibold text-[var(--brand-on-accent)] [background:var(--brand-grad)] [box-shadow:var(--brand-ring-money)] hover:brightness-110'
                  : 'bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-full px-6 py-2 text-sm',
                pulseEnabled && variant !== 'feed' && 'pulse-money-btn'
              )}
              disabled={isPending || isPreparingVideo || isUploadingVideo || imageUploadStatus !== null ||
                (activeContentType === 'none' && mediaItems.length === 0 && !text.trim()) ||
                (activeContentType === 'poll' && pollOptions.filter(opt => opt.value.trim() !== '').length < 2 && !text.trim())
              }
            >
              {isPending ? <><Loader2 size={18} className="animate-spin mr-2" />Posting...</> : 
               isUploadingVideo ? <><Loader2 size={18} className="animate-spin mr-2" />Uploading...</> : variant === 'feed' ? 'Post' : 'POST'}
            </Button>
          </div>
          </div>
        </div>
      </div>

      {isShortRecorderOpen && (
        <ShortRecorder 
          isOpen={isShortRecorderOpen}
          onClose={() => setIsShortRecorderOpen(false)}
          onComplete={handleShortComplete}
        />
      )}

      {session?.user?.id && creator?.can_img_gen && (
        <CreatorImageGenDialog
          open={isImageGenDialogOpen}
          onOpenChange={setIsImageGenDialogOpen}
          profileId={session.user.id}
          hasReferencePhoto={!!creator?.image_gen_source_path}
          onNavigateToNewPost={(galleryImageId) => {
            setIsImageGenDialogOpen(false);
            router.push(`/new-post?galleryImage=${galleryImageId}`);
          }}
        />
      )}

      <SubscriberOnlyDialog
        open={isSubscriberModalOpen}
        onOpenChange={setIsSubscriberModalOpen}
        onConfirm={handleSubscriberModalConfirm}
      />

      <PpvPriceDialog
        open={isPpvModalOpen}
        onOpenChange={setIsPpvModalOpen}
        initialPriceCents={ppvPrice}
        onConfirm={handlePpvModalConfirm}
      />
    </>
  );
} 
