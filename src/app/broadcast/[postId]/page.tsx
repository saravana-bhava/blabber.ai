'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getBroadcastStreamData } from '@/app/actions/liveActions';
import { toast } from 'sonner';
import { Video, VideoOff, Mic, MicOff, Send, Users, DollarSign, Clock } from 'lucide-react';

const WS_MAX_RECONNECTS = 3;
const WS_RECONNECT_DELAY_MS = 2000;

const RECORDER_MIME_CANDIDATES = [
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8',
  'video/webm',
];

function pickRecorderMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  return RECORDER_MIME_CANDIDATES.find(m => MediaRecorder.isTypeSupported(m)) ?? null;
}

function getIngestWebSocketUrl(baseUrl: string, streamKey: string) {
  const url = new URL(baseUrl);
  url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:';
  url.pathname = '/livestream';
  url.search = '';
  url.searchParams.set('video', 'vp8');
  url.searchParams.set('audio', 'opus');
  url.searchParams.set('key', streamKey);
  return url;
}

interface ChatMessage {
  id: string;
  user_id: string;
  text_content: string;
  created_at: string;
  profiles?: { full_name: string | null; username: string | null; avatar_url: string | null };
}

function normalizeChatMessage(
  row: Omit<ChatMessage, 'profiles'> & {
    profiles?: ChatMessage['profiles'] | ChatMessage['profiles'][];
  }
): ChatMessage {
  const profiles = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return { ...row, profiles: profiles ?? undefined };
}

interface StreamData {
  streamId: string;
  streamKey: string;
  playbackId: string;
}

export default function BroadcastPage() {
  const { postId } = useParams<{ postId: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [streamData, setStreamData] = useState<StreamData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const autoStartAttemptedRef = useRef(false);
  const isStreamingRef = useRef(false);

  // Stats
  const [viewers, setViewers] = useState(0);
  const [secs, setSecs] = useState(0);
  const [earned, setEarned] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const animFrameRef = useRef<number | undefined>(undefined);
  const dataIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const stoppingRef = useRef(false);
  const wsReconnectAttemptsRef = useRef(0);
  const intentionalStopRef = useRef(false);
  // Cache profile lookups so live chat doesn't fire one DB query per message
  const profileCacheRef = useRef<Map<string, ChatMessage['profiles']>>(new Map());

  const attachPreview = (ms: MediaStream) => {
    const video = videoRef.current;
    if (!video) return false;
    if (video.srcObject !== ms) video.srcObject = ms;
    video.play()
      .then(() => setPreviewReady(true))
      .catch(err => {
        if (err?.name !== 'AbortError') console.warn('Broadcast preview play error:', err);
      });
    return true;
  };

  // Camera init
  useEffect(() => {
    let cancelled = false;
    let attachRetryId: ReturnType<typeof setTimeout> | null = null;

    if (!navigator.mediaDevices?.getUserMedia) {
      const message = 'Camera not supported. Use HTTPS or localhost and a browser with camera access.';
      setCameraError(message);
      toast.error(message);
      return;
    }

    navigator.mediaDevices
      .getUserMedia({
        audio: true,
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      .then(ms => {
        if (cancelled) {
          ms.getTracks().forEach(t => t.stop());
          return;
        }
        mediaStreamRef.current = ms;
        setCameraError(null);
        setPreviewReady(false);
        if (!attachPreview(ms)) {
          let tries = 0;
          const retryAttach = () => {
            if (cancelled || !mediaStreamRef.current) return;
            if (attachPreview(mediaStreamRef.current)) return;
            tries += 1;
            if (tries < 20) attachRetryId = setTimeout(retryAttach, 50);
          };
          attachRetryId = setTimeout(retryAttach, 0);
        }
        setHasCameraPermission(true);
      })
      .catch(err => {
        const message =
          err?.name === 'NotAllowedError' ? 'Camera permission denied. Allow camera and microphone in your browser settings.' :
          err?.name === 'NotFoundError' ? 'No camera or microphone was found on this device.' :
          err?.name === 'NotReadableError' ? 'Camera or microphone is already in use by another app.' :
          'Camera permission is required for streaming.';
        setCameraError(message);
        setHasCameraPermission(false);
        toast.error(message);
      });

    return () => {
      cancelled = true;
      if (attachRetryId) clearTimeout(attachRetryId);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      mediaStreamRef.current?.getTracks().forEach(t => t.stop());
      setPreviewReady(false);
    };
  }, []);

  // Fetch stream data via server action (works when browser cannot reach local Supabase, e.g. ngrok)
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('You must be logged in'); setIsLoading(false); return; }
      setCurrentUserId(user.id);

      const result = await getBroadcastStreamData(postId);
      if ('error' in result) {
        toast.error(result.error);
        setIsLoading(false);
        return;
      }

      setStreamData(result.data);
      setIsLoading(false);
    };
    init();
  }, [postId]);

  // Fetch initial chat messages
  useEffect(() => {
    const loadMessages = async () => {
      const { data } = await supabase
        .from('comments')
        .select('id, user_id, text_content, created_at, profiles:profiles(full_name, username, avatar_url)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true })
        .limit(50);
      if (data) {
        const normalized = data.map(normalizeChatMessage);
        // Seed the profile cache from the initial JOIN results
        normalized.forEach(m => {
          if (m.profiles) profileCacheRef.current.set(m.user_id, m.profiles);
        });
        setMessages(normalized);
      }
    };
    loadMessages();

    const channel = supabase
      .channel(`broadcast-chat:${postId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments', filter: `post_id=eq.${postId}` },
        async (payload) => {
          const row = payload.new as ChatMessage;
          // Use cached profile if available — avoids one DB query per message
          let profile = profileCacheRef.current.get(row.user_id);
          if (!profile) {
            const { data } = await supabase
              .from('profiles')
              .select('full_name, username, avatar_url')
              .eq('id', row.user_id)
              .single();
            if (data) {
              profile = data;
              profileCacheRef.current.set(row.user_id, data);
            }
          }
          setMessages(prev => [...prev.slice(-99), { ...row, profiles: profile ?? undefined }]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [postId]);

  // Viewer count from post
  useEffect(() => {
    const ch = supabase
      .channel(`broadcast-viewers:${postId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'posts', filter: `id=eq.${postId}` },
        (payload) => setViewers((payload.new as any).view_count ?? 0)
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [postId]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  // Stream timer
  useEffect(() => {
    if (isStreaming) {
      timerRef.current = setInterval(() => setSecs(s => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isStreaming]);

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const updateCanvas = () => {
    const vid = videoRef.current;
    const canvas = canvasRef.current;
    if (!vid || !canvas || vid.ended) return;
    const w = vid.videoWidth || vid.clientWidth;
    const h = vid.videoHeight || vid.clientHeight;
    if (!w || !h || vid.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(updateCanvas);
      return;
    }
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(vid, 0, 0, w, h);
    // Timestamp overlay
    ctx.fillStyle = '#EC4899';
    ctx.font = 'bold 18px Arial';
    const d = new Date();
    ctx.fillText(`${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`, 12, 28);
    animFrameRef.current = requestAnimationFrame(updateCanvas);
  };

  const startStream = async (isReconnect = false) => {
    if (!hasCameraPermission || !streamData?.streamKey || !mediaStreamRef.current) {
      toast.error('Camera permission and stream data are required');
      return;
    }
    const recorderMime = pickRecorderMime();
    if (!recorderMime) {
      toast.error('This browser cannot record live video. Try Chrome or Firefox.');
      return;
    }
    const baseUrl = process.env.NEXT_PUBLIC_VOICE_AI_BASE_URL?.trim();
    if (!baseUrl) {
      toast.error('Streaming server is not configured (NEXT_PUBLIC_VOICE_AI_BASE_URL)');
      return;
    }
    await videoRef.current?.play().catch(() => {});
    let wsUrl: URL;
    try {
      wsUrl = getIngestWebSocketUrl(baseUrl, streamData.streamKey);
    } catch {
      toast.error('Streaming server URL is invalid');
      return;
    }

    if (!isReconnect) {
      wsReconnectAttemptsRef.current = 0;
      intentionalStopRef.current = false;
    }

    const ws = new WebSocket(wsUrl.toString());
    wsRef.current = ws;

    const scheduleReconnect = () => {
      if (intentionalStopRef.current) return;
      if (wsReconnectAttemptsRef.current >= WS_MAX_RECONNECTS) {
        toast.error('Lost connection to the streaming server. Tap Start Stream to try again.');
        void stopStream({ navigate: false, notify: false, endMux: false });
        return;
      }
      wsReconnectAttemptsRef.current += 1;
      toast.info(`Reconnecting to streaming server (${wsReconnectAttemptsRef.current}/${WS_MAX_RECONNECTS})…`);
      setTimeout(() => {
        if (!intentionalStopRef.current) void startStream(true);
      }, WS_RECONNECT_DELAY_MS);
    };

    ws.addEventListener('open', () => {
      wsReconnectAttemptsRef.current = 0;
      setIsConnected(true);
      if (!isReconnect) toast.success('Connected to streaming server');

      const canvas = canvasRef.current;
      const ms = mediaStreamRef.current;
      if (!canvas || !ms) {
        toast.error('Camera preview is not ready yet');
        ws.close();
        return;
      }

      if (videoRef.current) {
        const w = videoRef.current.videoWidth || videoRef.current.clientWidth;
        const h = videoRef.current.videoHeight || videoRef.current.clientHeight;
        canvas.width = w; canvas.height = h;
      }
      animFrameRef.current = requestAnimationFrame(updateCanvas);

      const videoOut = canvas.captureStream(30);
      const combined = new MediaStream([
        ...ms.getAudioTracks(),
        ...videoOut.getVideoTracks(),
      ]);

      const recorder = new MediaRecorder(combined, {
        mimeType: recorderMime,
        videoBitsPerSecond: 3_000_000,
        audioBitsPerSecond: 64_000,
      });
      mediaRecorderRef.current = recorder;

      recorder.addEventListener('dataavailable', e => {
        if (ws.readyState === WebSocket.OPEN && e.data.size > 0) ws.send(e.data);
      });
      recorder.addEventListener('start', () => {
        dataIntervalRef.current = setInterval(() => {
          if (recorder.state === 'recording') recorder.requestData();
        }, 1000);
      });
      recorder.addEventListener('stop', () => {
        if (dataIntervalRef.current) { clearInterval(dataIntervalRef.current); dataIntervalRef.current = null; }
      });

      recorder.start(1000);
      setIsStreaming(true);
      if (!isReconnect) toast.success('Stream started!');
    });

    ws.addEventListener('close', (ev) => {
      const wasStreaming = isStreamingRef.current;
      if (!wasStreaming && ev.code !== 1000) {
        toast.error('Could not connect to the streaming server');
      }
      setIsConnected(false);
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
      }
      if (dataIntervalRef.current) {
        clearInterval(dataIntervalRef.current);
        dataIntervalRef.current = null;
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = undefined;
      }
      setIsStreaming(false);
      isStreamingRef.current = false;

      if (!intentionalStopRef.current && wasStreaming) {
        scheduleReconnect();
      }
    });
    ws.addEventListener('error', () => {
      toast.error('Streaming connection error. Check NEXT_PUBLIC_VOICE_AI_BASE_URL.');
      setIsConnected(false);
    });
  };

  // Auto-start when arriving from Go Live (stream data + camera ready)
  useEffect(() => {
    if (
      autoStartAttemptedRef.current ||
      isLoading ||
      !streamData?.streamKey ||
      !hasCameraPermission ||
      !previewReady ||
      isStreaming
    ) {
      return;
    }
    autoStartAttemptedRef.current = true;
    startStream();
  }, [isLoading, streamData, hasCameraPermission, previewReady, isStreaming]);

  const stopStream = async ({
    navigate = true,
    notify = true,
    endMux = true,
  }: {
    navigate?: boolean;
    notify?: boolean;
    endMux?: boolean;
  } = {}) => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    intentionalStopRef.current = true;
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.close();
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = undefined; }

    if (endMux && streamData?.playbackId) {
      await fetch('/api/end-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mux_playback_id: streamData.playbackId, mux_stream_id: streamData.streamId }),
      }).catch(() => {});
    }

    setIsStreaming(false);
    setIsConnected(false);
    isStreamingRef.current = false;
    stoppingRef.current = false;
    if (notify) toast.info('Stream ended');
    if (navigate) router.push('/home');
  };

  const toggleVideo = () => {
    const track = mediaStreamRef.current?.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsVideoEnabled(track.enabled); }
  };

  const toggleAudio = () => {
    const track = mediaStreamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsAudioEnabled(track.enabled); }
  };

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text || !currentUserId || isSending) return;
    setIsSending(true);
    setChatInput('');
    const { error } = await supabase.from('comments').insert({
      post_id: postId,
      user_id: currentUserId,
      text_content: text,
    });
    if (error) toast.error('Failed to send message');
    setIsSending(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="w-8 h-8 rounded-full border-2 border-pink-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!streamData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white">
        Stream data not found
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex overflow-hidden">
      {/* Left: camera + controls */}
      <div className="flex-1 relative flex flex-col min-w-0">
        {/* Video / canvas */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={() => setPreviewReady(true)}
          onLoadedData={() => setPreviewReady(true)}
          onCanPlay={() => setPreviewReady(true)}
          onPlaying={() => setPreviewReady(true)}
          className={`absolute inset-0 w-full h-full object-cover scale-x-[-1] ${isStreaming ? 'opacity-0' : ''}`}
        />
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 w-full h-full pointer-events-none scale-x-[-1] ${isStreaming ? '' : 'hidden'}`}
          style={{ zIndex: 2 }}
        />

        {(!hasCameraPermission || !previewReady) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-10">
            <p className="text-white text-lg">
              {cameraError ?? (hasCameraPermission ? 'Starting camera...' : 'Camera permission required')}
            </p>
          </div>
        )}

        {/* LIVE + stats overlay */}
        {isStreaming && (
          <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-white bg-red-600">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              LIVE
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-white bg-black/50 backdrop-blur-sm">
              <Users size={11} />
              {viewers}
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-white bg-black/50 backdrop-blur-sm">
              {mmss(secs)}
            </span>
          </div>
        )}

        {/* Connected status (before streaming) */}
        {!isStreaming && isConnected && (
          <div className="absolute top-4 left-4 z-10">
            <span className="px-3 py-1 rounded-full text-xs font-bold text-white bg-green-600">
              Connected
            </span>
          </div>
        )}

        {/* Bottom controls */}
        <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-4 z-10">
          <CtrlBtn
            Icon={isVideoEnabled ? Video : VideoOff}
            on={isVideoEnabled}
            onClick={toggleVideo}
            label="Cam"
          />
          <CtrlBtn
            Icon={isAudioEnabled ? Mic : MicOff}
            on={isAudioEnabled}
            onClick={toggleAudio}
            label="Mic"
          />
          {isStreaming ? (
            <button
              onClick={() => stopStream()}
              className="h-[52px] px-6 rounded-full text-white font-bold text-sm bg-red-600 hover:bg-red-700 transition-colors"
            >
              End stream
            </button>
          ) : (
            <button
              onClick={() => startStream()}
              disabled={!hasCameraPermission}
              className="h-[52px] px-6 rounded-full text-white font-bold text-sm flex items-center gap-2 disabled:opacity-50"
              style={{ background: 'var(--brand-grad)' }}
            >
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              Start Stream
            </button>
          )}
        </div>
      </div>

      {/* Right panel: stats + chat */}
      <div
        className="w-[340px] shrink-0 flex flex-col border-l border-white/10"
        style={{ background: 'var(--background)' }}
      >
        {/* Stats */}
        <div className="p-4 border-b border-border">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Viewers', value: viewers.toString(), Icon: Users },
              { label: 'Time', value: mmss(secs), Icon: Clock },
              { label: 'Earned', value: `$${earned}`, Icon: DollarSign },
            ].map(({ label, value, Icon }) => (
              <div
                key={label}
                className="flex flex-col items-center justify-center rounded-xl p-2.5 text-center bg-muted/50"
              >
                <span className="text-[17px] font-extrabold tabular-nums leading-tight">{value}</span>
                <span className="text-[10px] font-semibold text-muted-foreground mt-0.5">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chat header */}
        <div className="px-4 py-3 text-[13.5px] font-bold border-b border-border">
          Live chat
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
          {messages.length === 0 && (
            <p className="text-xs text-muted-foreground text-center pt-4">
              No messages yet. Be the first to say hi!
            </p>
          )}
          {messages.map(m => (
            <div key={m.id} className="flex gap-2.5 items-start">
              <div className="w-6 h-6 rounded-full bg-muted shrink-0 overflow-hidden flex items-center justify-center text-[10px] font-bold">
                {m.profiles?.avatar_url ? (
                  <img src={m.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  (m.profiles?.full_name ?? '?').charAt(0).toUpperCase()
                )}
              </div>
              <div className="text-[13px] leading-snug">
                <span className="font-bold text-muted-foreground mr-1.5">
                  {m.profiles?.full_name ?? m.profiles?.username ?? 'Fan'}
                </span>
                <span>{m.text_content}</span>
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Chat input */}
        <div className="p-3 border-t border-border flex gap-2 shrink-0">
          <input
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
            placeholder="Say something to your fans…"
            className="flex-1 h-10 px-4 rounded-full border border-border bg-muted/40 text-sm outline-none focus:border-pink-500 text-foreground placeholder:text-muted-foreground"
          />
          <button
            onClick={sendChat}
            disabled={!chatInput.trim() || isSending}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white disabled:opacity-50 shrink-0"
            style={{ background: 'var(--brand-grad)' }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
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
        style={{ background: on ? 'rgba(255,255,255,0.18)' : '#dc2626' }}
      >
        <Icon size={21} />
      </span>
      <span className="text-[11px] font-semibold opacity-85">
        {on ? label : `${label} off`}
      </span>
    </button>
  );
}
