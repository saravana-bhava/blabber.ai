'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Video, Upload, Circle, Check, RefreshCcw, Loader2, SwitchCamera } from 'lucide-react';
import { toast } from 'sonner';
import { createMuxDirectUploadUrl } from '@/app/actions/postActions';

interface ShortRecorderProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (data: { file: File, muxUploadId: string, muxUploadUrl: string }) => void;
}

const MAX_DURATION_S = 45;

export function ShortRecorder({ isOpen, onClose, onComplete }: ShortRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [hasBackCamera, setHasBackCamera] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

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
    async function checkBackCamera() {
      if (typeof window === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
        setHasBackCamera(false);
        return;
      }
      try {
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

  useEffect(() => {
    if (isOpen) {
      setupStream(facingMode);
    } else {
      cleanupStream();
      setVideoBlob(null);
    }

    return () => {
      cleanupStream();
    };
  }, [isOpen, setupStream, cleanupStream, facingMode]);

  const handleStartRecording = () => {
    if (!stream) return;
    chunksRef.current = [];
    try {
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'video/webm' });
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        cleanupStream();
        setVideoBlob(blob);
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

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 200 * 1024 * 1024) { // ~200MB limit
        toast.error("File is too large. Please select a file smaller than 200MB.");
        return;
      }
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        if (video.duration > MAX_DURATION_S) {
          toast.error(`Video is too long. Maximum duration is ${MAX_DURATION_S} seconds.`);
        } else {
          cleanupStream();
          setVideoBlob(file);
        }
      }
      video.src = URL.createObjectURL(file);
    }
  };

  const handleRetake = () => {
    setVideoBlob(null);
    setupStream();
  };

  const handleNext = async () => {
    if (videoBlob && !isPreparing) {
      setIsPreparing(true);
      toast.info('Preparing your short...');
      try {
        const muxUploadDataResult = await createMuxDirectUploadUrl();
        if ('error' in muxUploadDataResult) {
          toast.error(`Failed to prepare short: ${muxUploadDataResult.error}`);
          return;
        }
        const { data: muxData } = muxUploadDataResult;

        if (!muxData || !muxData.upload_url || !muxData.upload_id) {
          toast.error('Failed to prepare short: Invalid data received.');
          return;
        }

        const videoFile = new File([videoBlob], "short.webm", { type: "video/webm" });
        onComplete({
          file: videoFile,
          muxUploadId: muxData.upload_id,
          muxUploadUrl: muxData.upload_url,
        });
      } catch (e: any) {
        toast.error(`Error preparing short: ${e.message}`);
      } finally {
        setIsPreparing(false);
      }
    }
  };

  const handleSwitchCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const videoUrl = videoBlob ? URL.createObjectURL(videoBlob) : undefined;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-black border-none p-0 flex items-center justify-center overflow-hidden max-h-[85vh] [&>button:has(.sr-only)]:hidden" style={{ aspectRatio: '9/16', height: '85vh', width: 'auto' }}>
        <DialogHeader className="sr-only">
          <DialogTitle>Short Video Recorder</DialogTitle>
          <DialogDescription>
            Record or upload a short video of up to 45 seconds. You can also upload an existing video file.
          </DialogDescription>
        </DialogHeader>
        <div className="relative w-full h-full flex items-center justify-center">
          <video
            ref={videoRef}
            src={videoUrl}
            autoPlay
            playsInline
            muted={!videoBlob}
            controls={!!videoBlob}
            className="absolute inset-0 w-full h-full object-cover bg-black"
            style={{ transform: !videoBlob && facingMode === 'user' ? 'scaleX(-1)' : undefined }}
          />
          {!videoBlob && stream && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
          )}

          <Button variant="ghost" size="icon" onClick={onClose} className="absolute top-4 right-4 text-white bg-black/30 hover:bg-black/50 hover:text-white z-50 rounded-full">
            <X size={24} />
          </Button>

          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center justify-center gap-8 z-50">
            {videoBlob ? (
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
                <Button variant="ghost" className="text-white hover:text-white/80 p-0 h-auto" onClick={() => uploadInputRef.current?.click()}>
                    <Upload size={28} />
                </Button>
                <input type="file" ref={uploadInputRef} accept="video/*" onChange={handleUpload} className="hidden" />

                <Button
                  onClick={isRecording ? handleStopRecording : handleStartRecording}
                  className="w-20 h-20 rounded-full bg-transparent border-4 border-white flex items-center justify-center"
                >
                  <div className={`
                    ${isRecording ? 'w-8 h-8 rounded-md' : 'w-16 h-16 rounded-full'}
                    bg-pink-500 transition-all duration-200 flex-shrink-0
                  `}></div>
                </Button>

                {hasBackCamera ? (
                  <Button variant="ghost" size="icon" onClick={handleSwitchCamera} className="text-white hover:text-white/80 p-0 h-auto">
                    <SwitchCamera size={28} />
                  </Button>
                ) : (
                  <div className="w-7 h-7" />
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