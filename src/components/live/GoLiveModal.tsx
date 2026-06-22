'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { X, Users, Star, Lock, Check, Video, VideoOff, Mic, MicOff } from 'lucide-react';
import { createLiveStream } from '@/app/actions/liveActions';

interface GoLiveModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AccessLevel = 'public' | 'subscribers_only' | 'ppv';

const ACCESS_OPTIONS: { id: AccessLevel; label: string; Icon: React.ElementType }[] = [
  { id: 'public', label: 'Everyone', Icon: Users },
  { id: 'subscribers_only', label: 'Subscribers only', Icon: Star },
  { id: 'ppv', label: 'Ticketed · 200 credits', Icon: Lock },
];

export function GoLiveModal({ isOpen, onClose }: GoLiveModalProps) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [access, setAccess] = useState<AccessLevel>('public');
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [camReady, setCamReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamReady(false);
  };

  const attachStreamToPreview = (ms: MediaStream) => {
    const video = videoRef.current;
    if (!video) return false;
    if (video.srcObject !== ms) video.srcObject = ms;
    video.play().then(() => setCamReady(true)).catch(err => {
      if (err?.name !== 'AbortError') console.warn('Video play error:', err);
    });
    return true;
  };

  useEffect(() => {
    if (!isOpen || !camOn) {
      stopCamera();
      return stopCamera;
    }

    let cancelled = false;
    let attachRetryId: ReturnType<typeof setTimeout> | null = null;

    const acquireCamera = (attempt = 0) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error('Camera not supported — make sure the page is served over HTTPS or localhost');
        setCamOn(false);
        return;
      }

      navigator.mediaDevices
        .getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        .then(ms => {
          if (cancelled) { ms.getTracks().forEach(t => t.stop()); return; }
          streamRef.current = ms;
          setCamReady(false);
          if (!attachStreamToPreview(ms)) {
            let tries = 0;
            const retryAttach = () => {
              if (cancelled || !streamRef.current) return;
              if (attachStreamToPreview(streamRef.current)) return;
              tries += 1;
              if (tries < 20) attachRetryId = setTimeout(retryAttach, 50);
            };
            attachRetryId = setTimeout(retryAttach, 0);
          }
        })
        .catch(err => {
          if (cancelled) return;
          // NotFoundError in dev = React Strict Mode double-mount race; retry once
          if (err?.name === 'NotFoundError' && attempt === 0) {
            setTimeout(() => { if (!cancelled) acquireCamera(1); }, 300);
            return;
          }
          const msg =
            err?.name === 'NotFoundError' ? 'No camera found on this device' :
            err?.name === 'NotAllowedError' ? 'Camera permission denied — allow it in your browser settings' :
            err?.name === 'NotReadableError' ? 'Camera is in use by another app' :
            `Camera error: ${err?.message ?? err?.name}`;
          toast.error(msg);
          setCamOn(false);
        });
    };

    acquireCamera();

    return () => {
      cancelled = true;
      if (attachRetryId) clearTimeout(attachRetryId);
      stopCamera();
    };
  }, [isOpen, camOn]);

  // Re-attach when the video element mounts after stream is already acquired
  useEffect(() => {
    if (!isOpen || !camOn || !streamRef.current) return;
    attachStreamToPreview(streamRef.current);
  }, [isOpen, camOn]);

  const handleGoLive = async () => {
    setIsCreating(true);
    try {
      const result = await createLiveStream(title || undefined, access);
      if ('error' in result) {
        toast.error(result.error);
        return;
      }
      toast.success('Stream created — going live!');
      stopCamera();
      onClose();
      router.push(`/broadcast/${result.postId}`);
    } catch {
      toast.error('Failed to create live stream');
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center p-6 animate-in fade-in duration-200"
      style={{ background: 'rgba(8,4,14,0.72)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="flex rounded-2xl overflow-hidden shadow-2xl bg-background"
        style={{ width: 'min(880px, 94vw)', height: 'min(540px, 86vh)' }}
      >
        {/* Left pane: camera preview */}
        <div className="relative flex-[1_1_58%] flex flex-col overflow-hidden bg-black">
          {/* Video always visible — hiding it with display:none breaks autoPlay in many browsers */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onLoadedMetadata={() => setCamReady(true)}
            onPlaying={() => setCamReady(true)}
            className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
          />

          {/* Overlay sits on top of video; disappears once camera is live */}
          {(!camOn || !camReady) && (
            <div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center text-white/60 gap-2"
              style={{ background: 'linear-gradient(135deg, oklch(0.42 0.13 285), oklch(0.3 0.14 260))' }}
            >
              {camOn ? (
                <div className="w-6 h-6 rounded-full border-2 border-white/40 border-t-white/80 animate-spin" />
              ) : (
                <VideoOff size={40} />
              )}
              <span className="text-sm font-medium">{camOn ? 'Starting camera…' : 'Camera off'}</span>
            </div>
          )}

          {/* Bottom controls */}
          <div className="absolute bottom-5 left-0 right-0 flex justify-center gap-4 z-10">
            <CtrlBtn
              Icon={camOn ? Video : VideoOff}
              on={camOn}
              onClick={() => setCamOn(v => !v)}
              label="Cam"
            />
            <CtrlBtn
              Icon={micOn ? Mic : MicOff}
              on={micOn}
              onClick={() => setMicOn(v => !v)}
              label="Mic"
            />
          </div>
        </div>

        {/* Right pane: settings */}
        <div className="flex-[1_1_42%] max-w-[360px] flex flex-col p-6 border-l border-border overflow-y-auto">
          <div className="flex items-start justify-between mb-1">
            <h2 className="text-[22px] font-extrabold tracking-tight">Go live</h2>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0 -mr-1 -mt-1"
            >
              <X size={16} />
            </button>
          </div>
          <p className="text-sm text-muted-foreground mb-5">
            Set up your stream, then go live to your fans.
          </p>

          <label className="text-[13px] font-bold text-muted-foreground mb-2 block">
            Stream title
          </label>
          <textarea
            value={title}
            onChange={e => setTitle(e.target.value)}
            rows={2}
            placeholder="What's your stream about?"
            className="w-full resize-none rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm outline-none focus:border-pink-500 mb-5 text-foreground placeholder:text-muted-foreground"
          />

          <label className="text-[13px] font-bold text-muted-foreground mb-2 block">
            Who can watch
          </label>
          <div className="flex flex-col gap-2 mb-6">
            {ACCESS_OPTIONS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setAccess(id)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all"
                style={
                  access === id
                    ? {
                        border: '1.5px solid transparent',
                        background: 'var(--brand-grad-soft)',
                        boxShadow: 'var(--brand-ring-money)',
                      }
                    : {
                        border: '1px solid var(--border)',
                        background: 'transparent',
                      }
                }
              >
                <Icon
                  size={16}
                  style={{ color: access === id ? 'var(--brand-pink)' : 'var(--muted-foreground)' }}
                />
                <span className="flex-1 text-[13.5px] font-semibold">{label}</span>
                {access === id && (
                  <Check size={16} style={{ color: 'var(--brand-pink)' }} />
                )}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          <button
            onClick={handleGoLive}
            disabled={isCreating}
            className="w-full h-[50px] rounded-full text-white font-bold text-[15.5px] flex items-center justify-center gap-2 transition-[filter] hover:brightness-110 disabled:opacity-60"
            style={{
              background: 'var(--brand-grad)',
              boxShadow: 'var(--brand-ring-money)',
            }}
          >
            {isCreating ? (
              'Creating stream…'
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                Go live now
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function CtrlBtn({
  Icon,
  on,
  onClick,
  label,
}: {
  Icon: React.ElementType;
  on: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 text-white"
    >
      <span
        className="w-[52px] h-[52px] rounded-full flex items-center justify-center border border-white/25 transition-colors"
        style={{
          background: on ? 'rgba(255,255,255,0.18)' : 'var(--brand-pink)',
        }}
      >
        <Icon size={21} />
      </span>
      <span className="text-[11px] font-semibold opacity-85">
        {on ? label : `${label} off`}
      </span>
    </button>
  );
}
