'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Upload, Check, RefreshCcw, Loader2, SwitchCamera } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { v4 as uuidv4 } from 'uuid';
import ReactDOM from 'react-dom';

interface StoryRecorderProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (data: { file: File, publicUrl: string, type: 'image' | 'video' }) => void;
  profileId: string;
}

const MAX_DURATION_S = 10;

// Overlay type
type Overlay = {
  id: string;
  text: string;
  x: number; // 0-1 (relative to width)
  y: number; // 0-1
  rotation: number; // degrees
  scale: number; // 1 = normal
  isEditing?: boolean;
};

export function StoryRecorder({ isOpen, onClose, onComplete, profileId }: StoryRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedFileType, setUploadedFileType] = useState<'image' | 'video' | null>(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [videoBlobExt, setVideoBlobExt] = useState<'mp4' | 'webm'>('webm');
  const [hasBackCamera, setHasBackCamera] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isPhotoFlash, setIsPhotoFlash] = useState(false);
  const photoFlashTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const longPressActiveRef = useRef(false);
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [draggingOverlayId, setDraggingOverlayId] = useState<string | null>(null);
  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [activeTouches, setActiveTouches] = useState<null | { id: string; start: [number, number, number, number]; initial: Overlay }>(null);

  const previewContainerRef = useRef<HTMLDivElement>(null);
  const overlayPortalRef = useRef<HTMLDivElement | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  const prevDeps = useRef<Record<string, any>>({});

  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    async function checkBackCamera() {
      if (typeof window === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
        setHasBackCamera(false);
        return;
      }
      try {
        let needToRequest = true;
        if (navigator.permissions && navigator.permissions.query) {
          try {
            const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
            if (result.state === 'granted' || result.state === 'prompt') {
              needToRequest = false;
            }
          } catch (e) {
            // Permissions API not supported or failed, fallback to requesting
            needToRequest = true;
          }
        }
        if (needToRequest) {
          // This will prompt the user if not already granted
          await navigator.mediaDevices.getUserMedia({ video: true });
        }
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasBack = devices.some(
          (d) => d.kind === 'videoinput' && d.label.toLowerCase().includes('back')
        );
        setHasBackCamera(hasBack);
      } catch (e) {
        setHasBackCamera(false);
      }
    }
    if (isOpen) checkBackCamera();
  }, [isOpen]);

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
    }
    if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
    }
    setStream(null);
  }, []);

  const setupStream = useCallback(async (mode: 'user' | 'environment' = facingMode) => {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      toast.error('Camera is not available in this environment.');
      onClose();
      return;
    }
    try {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      const constraints = {
        video: {
          facingMode: mode,
          ...(isMobile ? {
            // Mobile: let camera use natural orientation
            aspectRatio: 16/9,
          } : {
            // Desktop: force portrait
            width: { ideal: 1080, min: 480 },
            height: { ideal: 1920, min: 640 },
            aspectRatio: 9/16,
          })
        },
        audio: true,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = mediaStream;
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast.error("Could not access camera. Please check permissions.");
      onClose();
    }
  }, [onClose, facingMode]);

  useEffect(() => {
    if (isOpen) {
      setupStream(facingMode);
    } else {
      cleanupStream();
      setVideoBlob(null);
      setUploadedFile(null);
      setUploadedFileType(null);
      setUploadedFileUrl(null);
    }

    return () => {
      cleanupStream();
    };
  }, [isOpen, setupStream, cleanupStream, facingMode]);

  const handleStartRecording = () => {
    if (!stream) return;
    chunksRef.current = [];
    try {
      let mimeType = '';
      if (MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4';
      } else if (MediaRecorder.isTypeSupported('video/webm')) {
        mimeType = 'video/webm';
      } else {
        toast.error('No supported video format for recording.');
        return;
      }
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      mediaRecorderRef.current.onstop = () => {
        const ext = mimeType === 'video/mp4' ? 'mp4' : 'webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        cleanupStream();
        setVideoBlob(blob);
        setVideoBlobExt(ext);
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setCountdown(MAX_DURATION_S);
      countdownIntervalRef.current = setInterval(() => {
        setCountdown(prev => (prev !== null ? prev - 1 : null));
      }, 1000);
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
            handleStopRecording();
        }
      }, MAX_DURATION_S * 1000);
    } catch (error) {
        console.error("Error starting recording:", error);
        toast.error("Could not start recording.");
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      setCountdown(null);
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 200 * 1024 * 1024) {
      toast.error("File is too large. Please select a file smaller than 200MB.");
      return;
    }
    if (file.type.startsWith('video/') && file.type !== 'video/mp4' && file.type !== 'video/quicktime') {
      toast.error('Only MP4 and MOV video uploads are supported for stories.');
      return;
    }

    // Create preview URL and set file info
    const fileType: 'image' | 'video' = file.type.startsWith('image') ? 'image' : 'video';
    const previewUrl = URL.createObjectURL(file);
    
    setUploadedFile(file);
    setUploadedFileType(fileType);
    setUploadedFileUrl(previewUrl);

    // Clear the input
    if (uploadInputRef.current) {
      uploadInputRef.current.value = '';
    }
  };

  const handleRetake = () => {
    setVideoBlob(null);
    setUploadedFile(null);
    setUploadedFileType(null);
    if (uploadedFileUrl) {
      URL.revokeObjectURL(uploadedFileUrl);
      setUploadedFileUrl(null);
    }
    setupStream();
  };

  const handleNext = async () => {
    if (isPreparing) return;
    
    setIsPreparing(true);
    toast.info('Uploading your story...');
    
    try {
      const supabase = createClient();
      const folder = `${profileId}`;
      const overlaysData = overlays.length > 0 ? overlays.map(({id, text, x, y, rotation, scale}) => ({id, text, x, y, rotation, scale})) : [];
      
      if (videoBlob) {
        // Handle recorded video
        const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${videoBlobExt}`;
        const videoFile = new File([videoBlob], `story.${videoBlobExt}`, { type: videoBlobExt === 'mp4' ? 'video/mp4' : 'video/webm' });
        const { error } = await supabase.storage.from('story-media').upload(fileName, videoFile, { upsert: true, contentType: videoFile.type });
        if (error) {
          toast.error('Failed to upload video.');
          setIsPreparing(false);
          return;
        }
        const { data: { publicUrl } } = supabase.storage.from('story-media').getPublicUrl(fileName);
        const { error: dbError } = await supabase.from('stories').insert({
          profile_id: profileId,
          media_url: publicUrl,
          overlays: overlaysData,
        });
        if (dbError) {
          toast.error('Failed to save story record.');
          setIsPreparing(false);
          return;
        }
        onComplete({ file: videoFile, publicUrl, type: 'video' });
      } else if (uploadedFile) {
        // Handle uploaded file
        const ext = uploadedFileType === 'video' ? 'mp4' : uploadedFile.name.split('.').pop();
        const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        
        if (uploadedFileType === 'video') {
          // Validate video duration
          const video = document.createElement('video');
          video.preload = 'metadata';
          video.onloadedmetadata = async () => {
            window.URL.revokeObjectURL(video.src);
            if (video.duration > MAX_DURATION_S) {
              toast.error(`Video is too long. Maximum duration is ${MAX_DURATION_S} seconds.`);
              setIsPreparing(false);
            } else {
              const { error } = await supabase.storage.from('story-media').upload(fileName, uploadedFile, { upsert: true, contentType: uploadedFile.type });
              if (error) {
                toast.error('Failed to upload video.');
                setIsPreparing(false);
                return;
              }
              const { data: { publicUrl } } = supabase.storage.from('story-media').getPublicUrl(fileName);
              const { error: dbError } = await supabase.from('stories').insert({
                profile_id: profileId,
                media_url: publicUrl,
                overlays: overlaysData,
              });
              if (dbError) {
                toast.error('Failed to save story record.');
                setIsPreparing(false);
                return;
              }
              onComplete({ file: uploadedFile, publicUrl, type: 'video' });
            }
          };
          video.src = URL.createObjectURL(uploadedFile);
        } else {
          // Handle image upload
          const { error } = await supabase.storage.from('story-media').upload(fileName, uploadedFile, { upsert: true, contentType: uploadedFile.type });
          if (error) {
            toast.error('Failed to upload image.');
            setIsPreparing(false);
            return;
          }
          const { data: { publicUrl } } = supabase.storage.from('story-media').getPublicUrl(fileName);
          const { error: dbError } = await supabase.from('stories').insert({
            profile_id: profileId,
            media_url: publicUrl,
            overlays: overlaysData,
          });
          if (dbError) {
            toast.error('Failed to save story record.');
            setIsPreparing(false);
            return;
          }
          onComplete({ file: uploadedFile, publicUrl, type: 'image' });
        }
      }
    } catch (e: any) {
      toast.error(`Error uploading story: ${e.message}`);
    } finally {
      setIsPreparing(false);
    }
  };

  const handleSwitchCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  // Helper to capture a photo from the video stream
  const handleTakePhoto = useCallback(() => {
    if (!videoElementRef.current) return;
    const video = videoElementRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `story.jpg`, { type: 'image/jpeg' });
      const previewUrl = URL.createObjectURL(file);
      setUploadedFile(file);
      setUploadedFileType('image');
      setUploadedFileUrl(previewUrl);
      // Flash effect
      setIsPhotoFlash(true);
      if (photoFlashTimeoutRef.current) clearTimeout(photoFlashTimeoutRef.current);
      photoFlashTimeoutRef.current = setTimeout(() => setIsPhotoFlash(false), 200);
    }, 'image/jpeg', 0.95);
  }, []);

  // Clean up flash timeout on unmount
  useEffect(() => {
    return () => {
      if (photoFlashTimeoutRef.current) clearTimeout(photoFlashTimeoutRef.current);
      if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
    };
  }, []);

  // Button event handlers for tap/hold
  const handleRecordButtonDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (isUploading || isPreparing) return;
    longPressActiveRef.current = false;
    longPressTimeoutRef.current = setTimeout(() => {
      longPressActiveRef.current = true;
      handleStartRecording();
    }, 200); // 200ms threshold for long press
  };

  const handleRecordButtonUp = (e: React.MouseEvent | React.TouchEvent) => {
    if (isUploading || isPreparing) return;
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    if (isRecording) {
      handleStopRecording();
    } else if (!longPressActiveRef.current) {
      // Short tap: take photo
      handleTakePhoto();
    }
  };

  // Prevent context menu on long press (mobile)
  const handleRecordButtonContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  const hasPreview = videoBlob || uploadedFile;

  // Ensure recorded video preview autoplays with sound
  useEffect(() => {
    if (videoBlob && previewVideoRef.current) {
      const video = previewVideoRef.current;
      const playPromise = video.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.catch(() => {});
      }
      // Prevent pausing after play
      const preventPause = (e: Event) => {
        if (!video.paused) return;
        video.play();
      };
      video.addEventListener('pause', preventPause);
      return () => {
        video.removeEventListener('pause', preventPause);
      };
    }
  }, [videoBlob]);

  // Helper to get relative coordinates from click/tap on preview
  function getRelativeCoordsFromEvent(e: React.MouseEvent | React.TouchEvent, el: HTMLElement | null) {
    if (!el) return { x: 0.5, y: 0.5 };
    const rect = el.getBoundingClientRect();
    let clientX = 0, clientY = 0;
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  }

  // Add overlay on preview click/tap (image/video only)
  const handlePreviewMediaPointer = (e: React.MouseEvent | React.TouchEvent) => {
    // Only add if not clicking on an overlay or input
    if ((e.target as HTMLElement).dataset.overlayid || (e.target as HTMLElement).tagName === 'INPUT') return;
    // Use the event target (image or video)
    const el = e.target as HTMLElement;
    // For touch, use the first touch point
    let clientX = 0, clientY = 0;
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    setOverlays((prev) => [
      ...prev,
      {
        id: uuidv4(),
        text: 'Text',
        x,
        y,
        rotation: 0,
        scale: 1,
        isEditing: true,
      },
    ]);
  };

  // Edit overlay text
  const handleOverlayTextChange = (id: string, newText: string) => {
    setOverlays((prev) => prev.map(o => o.id === id ? { ...o, text: newText } : o));
  };
  const handleOverlayEditDone = (id: string) => {
    setOverlays((prev) => prev.map(o => o.id === id ? { ...o, isEditing: false } : o));
  };
  const handleOverlayClick = (id: string) => {
    setOverlays((prev) => prev.map(o => o.id === id ? { ...o, isEditing: true } : o));
  };

  // Drag start
  const handleOverlayPointerDown = (
    e: React.MouseEvent | React.TouchEvent,
    overlay: Overlay
  ) => {
    e.stopPropagation();
    setDraggingOverlayId(overlay.id);
    setIsDragging(true);
    if ('touches' in e && e.touches.length === 1) {
      const touch = e.touches[0];
      const container = previewContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = (touch.clientX - rect.left) / rect.width;
      const y = (touch.clientY - rect.top) / rect.height;
      dragOffset.current = { x: overlay.x - x, y: overlay.y - y };
    } else if ('clientX' in e) {
      const container = previewContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      dragOffset.current = { x: overlay.x - x, y: overlay.y - y };
    }
    // Pinch start
    if ('touches' in e && e.touches.length === 2) {
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      setActiveTouches({
        id: overlay.id,
        start: [t0.clientX, t0.clientY, t1.clientX, t1.clientY],
        initial: { ...overlay },
      });
    }
  };

  // Drag move
  const handleOverlayPointerMove = (
    e: React.MouseEvent | React.TouchEvent
  ) => {
    if (!isDragging || !draggingOverlayId) return;
    let x = 0, y = 0;
    const container = previewContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if ('touches' in e && e.touches.length === 1) {
      const touch = e.touches[0];
      x = (touch.clientX - rect.left) / rect.width;
      y = (touch.clientY - rect.top) / rect.height;
    } else if ('clientX' in e) {
      x = (e.clientX - rect.left) / rect.width;
      y = (e.clientY - rect.top) / rect.height;
    } else {
      return;
    }
    x = Math.max(0, Math.min(1, x + dragOffset.current.x));
    y = Math.max(0, Math.min(1, y + dragOffset.current.y));
    setOverlays((prev) =>
      prev.map((o) =>
        o.id === draggingOverlayId ? { ...o, x, y } : o
      )
    );
  };

  // Drag end
  const handleOverlayPointerUp = (
    e: React.MouseEvent | React.TouchEvent
  ) => {
    if (!isDragging || !draggingOverlayId) return;
    setIsDragging(false);
    const overlay = overlays.find((o) => o.id === draggingOverlayId);
    setDraggingOverlayId(null);
    if (!overlay) return;
    // Delete if near edge (within 5%)
    if (
      overlay.x < 0.05 ||
      overlay.x > 0.95 ||
      overlay.y < 0.05 ||
      overlay.y > 0.95
    ) {
      setOverlays((prev) => prev.filter((o) => o.id !== overlay.id));
    }
  };

  // Pinch/rotate/scale
  const handleOverlayTouchMove = (e: React.TouchEvent, overlay: Overlay) => {
    if (e.touches.length === 2 && activeTouches && activeTouches.id === overlay.id) {
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const [sx0, sy0, sx1, sy1] = activeTouches.start;
      const dx0 = t0.clientX - sx0;
      const dy0 = t0.clientY - sy0;
      const dx1 = t1.clientX - sx1;
      const dy1 = t1.clientY - sy1;
      // Center
      const cx0 = (sx0 + sx1) / 2;
      const cy0 = (sy0 + sy1) / 2;
      const cx1 = (t0.clientX + t1.clientX) / 2;
      const cy1 = (t0.clientY + t1.clientY) / 2;
      // Move
      const container = previewContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      let x = (cx1 - rect.left) / rect.width;
      let y = (cy1 - rect.top) / rect.height;
      x = Math.max(0, Math.min(1, x));
      y = Math.max(0, Math.min(1, y));
      // Scale
      const dist0 = Math.hypot(sx1 - sx0, sy1 - sy0);
      const dist1 = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      let scale = activeTouches.initial.scale * (dist1 / (dist0 || 1));
      scale = Math.max(0.5, Math.min(3, scale));
      // Rotation
      const angle0 = Math.atan2(sy1 - sy0, sx1 - sx0);
      const angle1 = Math.atan2(t1.clientY - t0.clientY, t1.clientX - t0.clientX);
      let rotation = activeTouches.initial.rotation + ((angle1 - angle0) * 180) / Math.PI;
      setOverlays((prev) =>
        prev.map((o) =>
          o.id === overlay.id ? { ...o, x, y, scale, rotation } : o
        )
      );
    }
  };
  const handleOverlayTouchEnd = (e: React.TouchEvent, overlay: Overlay) => {
    setActiveTouches(null);
    setIsDragging(false);
    setDraggingOverlayId(null);
    // Delete if near edge
    if (
      overlay.x < 0.05 ||
      overlay.x > 0.95 ||
      overlay.y < 0.05 ||
      overlay.y > 0.95
    ) {
      setOverlays((prev) => prev.filter((o) => o.id !== overlay.id));
    }
  };

  // Video preview playback fix
  useEffect(() => {
    // Always try to play the preview video when videoBlob or uploadedFileUrl changes
    if ((videoBlob || (uploadedFile && uploadedFileType === 'video')) && previewVideoRef.current) {
      const video = previewVideoRef.current;
      const playPromise = video.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.catch(() => {
          // Fallback: mute and try again (for autoplay policy)
          video.muted = true;
          video.play();
        });
      }
      // Prevent pausing after play
      const preventPause = (e: Event) => {
        if (!video.paused) return;
        video.play();
      };
      video.addEventListener('pause', preventPause);
      return () => {
        video.removeEventListener('pause', preventPause);
      };
    }
  }, [videoBlob, uploadedFile, uploadedFileUrl, uploadedFileType]);

  // Imperatively manage the video element
  useEffect(() => {
    if (!videoContainerRef.current) return;
    // Remove any existing video or image
    while (videoContainerRef.current.firstChild) {
      videoContainerRef.current.removeChild(videoContainerRef.current.firstChild);
    }
    // Log which dependencies changed
    const deps = {
      hasPreview,
      uploadedFileType,
      uploadedFileUrl,
      videoBlob,
      recordedVideoUrl,
      uploadedFile,
      facingMode,
      stream,
    };
    const changedDeps = Object.entries(deps)
      .filter(([key, value]) => prevDeps.current[key] !== value)
      .map(([key]) => key);
    prevDeps.current = deps;
    if (videoBlob && recordedVideoUrl) {
      const video = document.createElement('video');
      video.src = recordedVideoUrl!;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = false;
      video.controls = false;
      video.loop = true;
      video.className = 'absolute inset-0 w-full h-full object-cover bg-black';
      video.style.pointerEvents = 'auto';
      video.style.zIndex = '1';
      video.addEventListener('canplay', () => video.play());
      video.addEventListener('loadeddata', () => {
        video.play();
      });
      video.addEventListener('error', (e) => {
        // Log error for debugging
        // @ts-ignore
        console.error('Video failed to load:', e, video.src);
      });
      video.load();
      videoContainerRef.current.appendChild(video);
      videoElementRef.current = video;
    } else if (hasPreview && uploadedFileType === 'video' && uploadedFileUrl) {
      const video = document.createElement('video');
      video.src = uploadedFileUrl!;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = false;
      video.controls = true;
      video.loop = false;
      video.className = 'absolute inset-0 w-full h-full object-cover bg-black';
      video.style.pointerEvents = 'auto';
      video.style.zIndex = '1';
      video.addEventListener('canplay', () => video.play());
      video.addEventListener('loadeddata', () => {
        video.play();
      });
      video.addEventListener('error', (e) => {
        // Log error for debugging
        // @ts-ignore
        console.error('Video failed to load:', e, video.src);
      });
      video.load();
      videoContainerRef.current.appendChild(video);
      videoElementRef.current = video;
    } else if (!hasPreview && stream) {
      // Show camera feed only if stream is available
      const video = document.createElement('video');
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      video.className = 'absolute inset-0 w-full h-full object-cover bg-black';
      video.style.pointerEvents = 'auto';
      video.style.zIndex = '1';
      if (facingMode === 'user') {
        video.style.transform = 'scaleX(-1)';
      }
      video.srcObject = stream;
      videoContainerRef.current.appendChild(video);
      videoElementRef.current = video;
    } else if (hasPreview && uploadedFileType === 'image' && uploadedFileUrl) {
      // Show image
      const img = document.createElement('img');
      img.src = uploadedFileUrl!;
      img.alt = 'Story preview';
      img.className = 'absolute inset-0 w-full h-full object-cover bg-black';
      img.style.pointerEvents = 'auto';
      img.style.zIndex = '1';
      img.draggable = false;
      videoContainerRef.current.appendChild(img);
      videoElementRef.current = null;
    } else {
    }
    // Clean up on unmount
    return () => {
      if (videoContainerRef.current) {
        while (videoContainerRef.current.firstChild) {
          videoContainerRef.current.removeChild(videoContainerRef.current.firstChild);
        }
      }
    };
  }, [hasPreview, uploadedFileType, uploadedFileUrl, videoBlob, recordedVideoUrl, uploadedFile, facingMode, stream]);

  // Release camera when dialog closes or component unmounts
  useEffect(() => {
    function releaseCamera() {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
    if (!isOpen) {
      releaseCamera();
    }
    // Release camera if tab is closed
    window.addEventListener('beforeunload', releaseCamera);
    return () => {
      releaseCamera();
      window.removeEventListener('beforeunload', releaseCamera);
    };
  }, [isOpen]);

  // Only update recordedVideoUrl when videoBlob changes
  useEffect(() => {
    if (videoBlob) {
      const url = URL.createObjectURL(videoBlob);
      setRecordedVideoUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setRecordedVideoUrl(undefined);
    }
  }, [videoBlob]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-black border-none p-0 flex items-center justify-center overflow-hidden max-h-[85vh] [&>button:has(.sr-only)]:hidden" style={{ aspectRatio: '9/16', height: '85vh', width: 'auto' }}>
        <DialogHeader className="sr-only">
          <DialogTitle>Story Recorder</DialogTitle>
          <DialogDescription>
            Record or upload a short video (up to 10 seconds) or image.
          </DialogDescription>
        </DialogHeader>
        <div
          ref={previewContainerRef}
          className="relative w-full h-full flex items-center justify-center overflow-hidden"
          style={{ touchAction: 'manipulation', overflow: 'hidden' }}
        >
          {/* --- Imperative media/camera layer --- */}
          <div
            ref={videoContainerRef}
            className="absolute inset-0 w-full h-full"
            style={{ zIndex: 1, pointerEvents: 'auto' }}
            onClick={handlePreviewMediaPointer}
            onTouchStart={handlePreviewMediaPointer}
          />

          {/* --- Overlay portal target --- */}
          <div
            ref={overlayPortalRef}
            className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden"
            style={{ zIndex: 2, overflow: 'hidden' }}
          />

          {/* --- Render overlays in portal --- */}
          {hasPreview && overlayPortalRef.current && ReactDOM.createPortal(
            overlays.map((overlay) => (
              <div
                key={overlay.id}
                data-overlayid={overlay.id}
                style={{
                  position: 'absolute',
                  left: `${overlay.x * 100}%`,
                  top: `${overlay.y * 100}%`,
                  transform: `translate(-50%, -50%) rotate(${overlay.rotation}deg) scale(${overlay.scale})`,
                  zIndex: 10,
                  cursor: isDragging && draggingOverlayId === overlay.id ? 'grabbing' : 'grab',
                  userSelect: 'none',
                  minWidth: 40,
                  minHeight: 30,
                  maxWidth: '80%',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 28 * overlay.scale,
                  padding: '2px 8px',
                  borderRadius: 8,
                  touchAction: 'none',
                  pointerEvents: 'auto',
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                }}
                onClick={(e) => { e.stopPropagation(); handleOverlayClick(overlay.id); }}
                onMouseDown={e => handleOverlayPointerDown(e, overlay)}
                onMouseMove={isDragging && draggingOverlayId === overlay.id ? handleOverlayPointerMove : undefined}
                onMouseUp={handleOverlayPointerUp}
                onMouseLeave={handleOverlayPointerUp}
                onTouchStart={e => handleOverlayPointerDown(e, overlay)}
                onTouchMove={e => {
                  if (e.touches.length === 2) handleOverlayTouchMove(e, overlay);
                  else handleOverlayPointerMove(e);
                }}
                onTouchEnd={e => handleOverlayTouchEnd(e, overlay)}
              >
                {overlay.isEditing ? (
                  <input
                    type="text"
                    value={overlay.text}
                    autoFocus
                    onChange={e => handleOverlayTextChange(overlay.id, e.target.value)}
                    onBlur={() => handleOverlayEditDone(overlay.id)}
                    onClick={e => e.stopPropagation()}
                    style={{
                      fontSize: 28 * overlay.scale,
                      fontWeight: 600,
                      color: '#fff',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: 8,
                      outline: 'none',
                      padding: '2px 8px',
                      minWidth: 40,
                      boxSizing: 'border-box',
                      overflow: 'hidden',
                    }}
                    maxLength={100}
                  />
                ) : overlay.text}
              </div>
            )),
            overlayPortalRef.current
          )}

          {!hasPreview && stream && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
          )}

          <Button variant="ghost" size="icon" onClick={onClose} className="absolute top-4 right-4 text-white bg-black/30 hover:bg-black/50 hover:text-white z-50 rounded-full">
            <X size={24} />
          </Button>

          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center justify-center gap-8 z-50">
            {hasPreview ? (
              <>
                <Button onClick={handleRetake} disabled={isPreparing} className="bg-white/90 hover:bg-white text-black font-semibold rounded-full px-8 py-6 text-base">
                    <RefreshCcw size={18} className="mr-2" />
                    Retake
                </Button>
                <Button onClick={handleNext} disabled={isPreparing} className="bg-pink-500 hover:bg-pink-600 text-white font-semibold rounded-full px-8 py-6 text-base min-w-[160px]">
                    {isPreparing ? (
                      <Loader2 size={24} className="animate-spin" />
                    ) : (
                      <>
                        Next
                        <Check size={20} className="ml-2" />
                      </>
                    )}
                </Button>
              </>
            ) : (
              <>
                <Button 
                  variant="ghost" 
                  className="text-white hover:text-white/80 p-0 h-auto" 
                  onClick={() => uploadInputRef.current?.click()} 
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <Loader2 size={28} className="animate-spin" />
                  ) : (
                    <Upload size={28} />
                  )}
                </Button>
                <input type="file" ref={uploadInputRef} accept="video/mp4,video/quicktime,image/*" onChange={handleUpload} className="hidden" />

                <Button
                  onMouseDown={handleRecordButtonDown}
                  onMouseUp={handleRecordButtonUp}
                  onMouseLeave={handleRecordButtonUp}
                  onTouchStart={handleRecordButtonDown}
                  onTouchEnd={handleRecordButtonUp}
                  onTouchCancel={handleRecordButtonUp}
                  onContextMenu={handleRecordButtonContextMenu}
                  className="w-20 h-20 rounded-full bg-transparent border-4 border-white flex items-center justify-center select-none"
                  disabled={isUploading || isPreparing}
                >
                  <div className={`
                    ${isRecording ? 'w-8 h-8 rounded-md' : 'w-16 h-16 rounded-full'}
                    bg-pink-500 transition-all duration-200 flex-shrink-0
                  `}></div>
                  {isPhotoFlash && (
                    <div className="absolute inset-0 bg-white/80 pointer-events-none animate-fade-out" style={{ borderRadius: '50%' }} />
                  )}
                </Button>

                {hasBackCamera ? (
                  <Button variant="ghost" size="icon" onClick={handleSwitchCamera} className="text-white hover:text-white/80 p-0 h-auto">
                    <SwitchCamera size={28} />
                  </Button>
                ) : (
                  <div className="w-7 h-7" /> // Same size as SwitchCamera icon
                )}

                {isRecording && countdown !== null &&
                    <div className="absolute -top-8 text-white bg-black/50 px-2 py-1 rounded-sm text-sm font-mono">
                        0:{countdown.toString().padStart(2, '0')}
                    </div>
                }
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 