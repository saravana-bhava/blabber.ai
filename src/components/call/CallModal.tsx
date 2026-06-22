import { useEffect, useLayoutEffect, useState, useRef, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { X, Mic, MicOff, PhoneOff } from 'lucide-react';
import Image from 'next/image';
import { useUser } from '@/lib/contexts/user-context';
import { useCreditsModal } from '@/lib/contexts/credits-modal-context';
import { createClient } from '@/lib/supabase/client';
import { getCommunicationHistory } from '@/lib/utils/communication-history';
import React from 'react';
import { LiquidGradientBackground } from '@/components/motion/LiquidGradientBackground';
import { AnimatedInteger } from '@/components/motion/AnimatedInteger';
import { usePulseUI } from '@/lib/contexts/pulse-ui-context';
import { cn } from '@/lib/utils';
import { toVoiceAiWebSocketUrl } from '@/lib/voice-ai-url';

interface CallModalProps {
  isOpen: boolean;
  onClose: () => void;
  personalityPrompt: string | null;
  elevenVoiceId: string | null;
  creatorId: string;
  isDemo?: boolean;
  /** When true, no credits are deducted and no call_transaction row is created (creator testing their own call). */
  testMode?: boolean;
}

const formatTime = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const TimerDisplay = React.memo(({ seconds }: { seconds: number }) => {
  return <p className="text-lg leading-none">{formatTime(seconds)}</p>;
});

TimerDisplay.displayName = 'TimerDisplay';

const DEFAULT_CALL_PERSONALITY_PROMPT =
  'You are a friendly, engaging creator on a live voice call with a fan. Keep responses natural, concise, and warm.';

function callStatusLabel({
  isLoading,
  error,
  isConnected,
}: {
  isLoading: boolean;
  error: string | null;
  isConnected: boolean;
}): string {
  if (isLoading) return 'CONNECTING...';
  if (error === 'INSUFFICIENT CREDITS') return 'INSUFFICIENT CREDITS';
  if (error === 'UNAVAILABLE') return 'UNAVAILABLE';
  if (error) return 'UNAVAILABLE';
  if (isConnected) return 'CONNECTED';
  return 'DISCONNECTED';
}

const CreditsDisplay = React.memo(
  ({
    credits,
    pulseEnabled,
    deductFlash,
  }: {
    credits: number | null | undefined;
    pulseEnabled: boolean;
    deductFlash: boolean;
  }) => {
    return (
      <p
        className={cn(
          'mb-1 text-sm font-bold tabular-nums text-foreground transition-transform duration-200',
          pulseEnabled && deductFlash && 'motion-safe:scale-105'
        )}
      >
        <AnimatedInteger value={credits ?? 0} durationMs={320} />{' '}
        <span className="text-xs font-medium text-muted-foreground">credits</span>
      </p>
    );
  }
);

CreditsDisplay.displayName = 'CreditsDisplay';

interface UseCallTimerProps {
  isConnected: boolean;
  callCreditInterval: number;
  pricePerCredit: number;
  platformSplit: number;
  callTransactionId: string | null;
  onInsufficientCredits: () => void;
  updateCallTransaction: (transactionId: string, callLength: number, creditsUsed: number) => Promise<void>;
  deductCredit: (creditsToDeduct?: number) => Promise<boolean>;
  aiCallMulti?: number;
}

function useCallTimer({
  isConnected,
  callCreditInterval,
  pricePerCredit,
  platformSplit,
  callTransactionId,
  onInsufficientCredits,
  updateCallTransaction,
  deductCredit,
  aiCallMulti = 1
}: UseCallTimerProps) {
  const [displayTimer, setDisplayTimer] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const currentTimerRef = useRef(0);
  const lastCreditDeductionRef = useRef<number>(0);

  // Update display timer every second
  useEffect(() => {
    if (isConnected) {
      const displayInterval = setInterval(() => {
        setDisplayTimer(currentTimerRef.current);
      }, 1000);

      return () => clearInterval(displayInterval);
    } else {
      setDisplayTimer(0);
    }
  }, [isConnected]);

  // Handle credit deduction and timer updates
  useEffect(() => {
    if (isConnected) {
      timerRef.current = setInterval(() => {
        currentTimerRef.current += 1;
        // Use the original callCreditInterval for deduction timing
        if (currentTimerRef.current - lastCreditDeductionRef.current >= callCreditInterval) {
          // Deduct aiCallMulti credits at each interval
          deductCredit(aiCallMulti).then(success => {
            if (success) {
              lastCreditDeductionRef.current = currentTimerRef.current;
              // Update call transaction with new duration and credits
              if (callTransactionId) {
                // creditsUsed = number of intervals * aiCallMulti
                const intervals = Math.floor(currentTimerRef.current / callCreditInterval);
                const creditsUsed = intervals * (aiCallMulti || 1);
                updateCallTransaction(callTransactionId, currentTimerRef.current, creditsUsed);
              }
            } else {
              onInsufficientCredits();
            }
          });
        }
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      currentTimerRef.current = 0;
      lastCreditDeductionRef.current = 0;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isConnected, callCreditInterval, callTransactionId, pricePerCredit, platformSplit, deductCredit, updateCallTransaction, onInsufficientCredits, aiCallMulti]);

  return displayTimer;
}

interface UseCreditsProps {
  profileId: string | undefined;
  initialCredits: number | null | undefined;
  onInsufficientCredits: () => void;
  aiCallMulti?: number;
}

function useCredits({ profileId, initialCredits, onInsufficientCredits, aiCallMulti = 1, isDemo = false }: UseCreditsProps & { isDemo?: boolean }) {
  const [credits, setCredits] = useState<number>(initialCredits ?? 0);
  const supabase = createClient();

  const deductCredit = async (creditsToDeduct?: number) => {
    if (isDemo) return true;
    if (!profileId) return false;

    const toDeduct = creditsToDeduct || aiCallMulti || 1;
    try {
      const { data, error } = await supabase.rpc('debit_credits_if_sufficient', {
        p_user_id: profileId,
        p_credits: toDeduct,
      });

      if (error) {
        console.error('Error deducting credits:', error);
        return false;
      }

      const result = data as { ok: boolean; error?: string; credits_remaining?: number };

      if (!result?.ok) {
        if (result?.error === 'insufficient_credits') onInsufficientCredits();
        return false;
      }

      if (result.credits_remaining !== undefined) {
        setCredits(result.credits_remaining);
      }
      return true;
    } catch (err) {
      console.error('Error in deductCredit:', err);
      return false;
    }
  };

  return {
    credits,
    deductCredit
  };
}

// Audio source management for cleanup
interface AudioSourceNode {
  source: AudioBufferSourceNode;
  startTime: number;
  duration: number;
  id: number;
}

export function CallModal({ isOpen, onClose, personalityPrompt, elevenVoiceId, creatorId, isDemo, testMode }: CallModalProps) {
  const [websocketUrl, setWebsocketUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<{ stop: () => void } | null>(null);
  const [sourceBuffer, setSourceBuffer] = useState<AudioBuffer | null>(null);
  const [creatorProfile, setCreatorProfile] = useState<{
    avatar_url: string | null;
    full_name: string | null;
    username: string | null;
    ai_call_multi: number | null;
    call_modal_image_url: string | null;
  } | null>(null);
  const [callTransactionId, setCallTransactionId] = useState<string | null>(null);
  const [platformSplit, setPlatformSplit] = useState<number>(30);
  const [callCreditInterval, setCallCreditInterval] = useState<number>(4);
  const [pricePerCredit, setPricePerCredit] = useState<number>(0);
  const [agencyProfileId, setAgencyProfileId] = useState<string | null>(null);
  const [agencySplitPct, setAgencySplitPct] = useState<number>(0);
  const { profile } = useUser();
  const supabase = createClient();
  
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isProcessingRef = useRef(false);
  const nextStartTimeRef = useRef(0);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const isSourceStartedRef = useRef(false);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<AudioNode | null>(null);
  const { setIsBuyCreditsModalOpen } = useCreditsModal();

  // Audio cleanup refs
  const audioSourceNodesRef = useRef<AudioSourceNode[]>([]);
  const audioSourceIdCounterRef = useRef(0);
  const cleanupIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Heartbeat/keepalive ref
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Constants for audio cleanup
  const MAX_AUDIO_QUEUE_SIZE = 10; // Maximum audio chunks to keep in queue
  const MAX_AUDIO_SOURCES = 20; // Maximum audio sources before cleanup
  const CLEANUP_INTERVAL_MS = 5000; // Cleanup every 5 seconds
  const SOURCE_CLEANUP_THRESHOLD_MS = 10000; // Remove sources older than 10 seconds

  const handleInsufficientCredits = useCallback(() => {
    stopRecording();
    setWebsocketUrl(null);
    setError('INSUFFICIENT CREDITS');
    setIsBuyCreditsModalOpen(true);
  }, [setIsBuyCreditsModalOpen]);

  // ai_call_multi is always sourced from the creator's profile, not the user's profile
  const aiCallMulti = creatorProfile?.ai_call_multi || 1;
  const { credits, deductCredit } = useCredits({
    profileId: profile?.id,
    initialCredits: profile?.credits,
    onInsufficientCredits: handleInsufficientCredits,
    aiCallMulti,
    isDemo: isDemo || testMode
  });

  const { pulseEnabled } = usePulseUI();
  const [deductFlash, setDeductFlash] = useState(false);
  const [showDrainLine, setShowDrainLine] = useState(false);
  const [connBeat, setConnBeat] = useState(false);
  const prevCreditsForAnim = useRef(credits);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const creditsDrainAnchorRef = useRef<HTMLDivElement | null>(null);
  const callWindowAnchorRef = useRef<HTMLDivElement | null>(null);
  const [creditDrainGeom, setCreditDrainGeom] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    w: number;
    h: number;
  } | null>(null);
  const [drainCycleKey, setDrainCycleKey] = useState(0);

  const measureCreditDrainLine = useCallback(() => {
    const card = cardRef.current;
    const fromEl = creditsDrainAnchorRef.current;
    const toEl = callWindowAnchorRef.current;
    if (!card || !fromEl || !toEl) return null;
    const c = card.getBoundingClientRect();
    const a = fromEl.getBoundingClientRect();
    const b = toEl.getBoundingClientRect();
    const x1 = a.left + a.width / 2 - c.left;
    const y1 = a.top + a.height / 2 - c.top;
    const x2 = b.left + b.width / 2 - c.left;
    const y2 = b.top + b.height / 2 - c.top;
    return { x1, y1, x2, y2, w: c.width, h: c.height };
  }, []);

  useLayoutEffect(() => {
    if (!showDrainLine) {
      setCreditDrainGeom(null);
      return;
    }
    const run = () => {
      const g = measureCreditDrainLine();
      if (g) setCreditDrainGeom(g);
    };
    run();
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(run);
    });
    const ro =
      typeof ResizeObserver !== 'undefined' && cardRef.current
        ? new ResizeObserver(run)
        : null;
    if (ro && cardRef.current) ro.observe(cardRef.current);
    window.addEventListener('resize', run);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      ro?.disconnect();
      window.removeEventListener('resize', run);
    };
  }, [showDrainLine, measureCreditDrainLine, creatorProfile?.call_modal_image_url, creatorProfile?.avatar_url]);

  useEffect(() => {
    const prev = prevCreditsForAnim.current;
    if (credits < prev) {
      setDrainCycleKey((k) => k + 1);
      setDeductFlash(true);
      setShowDrainLine(true);
      window.setTimeout(() => setDeductFlash(false), 220);
      window.setTimeout(() => setShowDrainLine(false), 1100);
    }
    prevCreditsForAnim.current = credits;
  }, [credits]);

  useEffect(() => {
    if (!isConnected || !pulseEnabled) return;
    const id = window.setInterval(() => setConnBeat((b) => !b), 3000);
    return () => clearInterval(id);
  }, [isConnected, pulseEnabled]);

  const updateCallTransaction = async (transactionId: string, callLength: number, creditsUsed: number) => {
    if (!profile?.id) return;

    try {
      const creditsCents = creditsUsed * pricePerCredit;
      const platformShareCents = Math.floor(creditsCents * (platformSplit / 100));
      const creatorShareCents = creditsCents - platformShareCents;
      const rawAgencyShare = agencyProfileId && agencySplitPct > 0
        ? Math.floor(creatorShareCents * (agencySplitPct / 100))
        : 0;
      const agencyShareCents = Math.max(
        0,
        Math.min(rawAgencyShare, creatorShareCents)
      );

      const { error } = await supabase
        .from('call_transactions')
        .update({
          call_length_seconds: callLength,
          credits_used: creditsUsed,
          credits_cents: creditsCents,
          creator_share_cents: creatorShareCents,
          platform_share_cents: platformShareCents,
          agency_share_cents: agencyShareCents > 0 ? agencyShareCents : null,
          agency_profile_id: agencyProfileId,
        })
        .eq('id', transactionId);

      if (error) {
        console.error('Error updating call transaction:', error);
      }
    } catch (err) {
      console.error('Error in updateCallTransaction:', err);
    }
  };

  const displayTimer = useCallTimer({
    isConnected,
    callCreditInterval,
    pricePerCredit,
    platformSplit,
    callTransactionId,
    onInsufficientCredits: handleInsufficientCredits,
    updateCallTransaction,
    deductCredit,
    aiCallMulti
  });

  const sampleRate = 48000; // Our sample rate

  // Audio cleanup functions
  const cleanupOldAudioSources = useCallback(() => {
    if (!audioContextRef.current) return;
    
    const currentTime = audioContextRef.current.currentTime;
    const cutoffTime = currentTime - (SOURCE_CLEANUP_THRESHOLD_MS / 1000);
    
    // Remove old audio sources
    audioSourceNodesRef.current = audioSourceNodesRef.current.filter(node => {
      const nodeEndTime = node.startTime + node.duration;
      if (nodeEndTime < cutoffTime) {
        try {
          // Disconnect and clean up old source
          if (node.source) {
            node.source.disconnect();
          }
        } catch (e) {
          // Source might already be disconnected/stopped
        }
        return false; // Remove from array
      }
      return true; // Keep in array
    });

    // Limit queue size to prevent memory buildup
    if (audioQueueRef.current.length > MAX_AUDIO_QUEUE_SIZE) {
      audioQueueRef.current = audioQueueRef.current.slice(-MAX_AUDIO_QUEUE_SIZE);
    }
  }, []);

  const addAudioSourceNode = useCallback((source: AudioBufferSourceNode, startTime: number, duration: number) => {
    const node: AudioSourceNode = {
      source,
      startTime,
      duration,
      id: audioSourceIdCounterRef.current++
    };
    
    audioSourceNodesRef.current.push(node);
    
    // Trigger cleanup if we have too many sources
    if (audioSourceNodesRef.current.length > MAX_AUDIO_SOURCES) {
      cleanupOldAudioSources();
    }
  }, [cleanupOldAudioSources]);

  const cleanupAllAudioSources = useCallback(() => {
    // Stop and disconnect all audio sources
    audioSourceNodesRef.current.forEach(node => {
      try {
        if (node.source) {
          node.source.stop();
          node.source.disconnect();
        }
      } catch (e) {
        // Source might already be stopped/disconnected
      }
    });
    
    // Clear the array
    audioSourceNodesRef.current = [];
    
    // Clear audio queue
    audioQueueRef.current = [];
  }, []);

  // Setup periodic cleanup
  useEffect(() => {
    if (isConnected) {
      cleanupIntervalRef.current = setInterval(() => {
        cleanupOldAudioSources();
      }, CLEANUP_INTERVAL_MS);
    } else {
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
        cleanupIntervalRef.current = null;
      }
    }

    return () => {
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
      }
    };
  }, [isConnected, cleanupOldAudioSources]);

  useEffect(() => {
    if (isOpen && !websocketUrl) {
      initializeSession();
      // Fetch creator profile
      const fetchCreatorProfile = async () => {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('avatar_url, full_name, username')
          .eq('id', creatorId)
          .single();
        const { data: creatorData } = await supabase
          .from('creators')
          .select(
            'ai_call_multi, ai_call_image_primary_path, ai_call_image_secondary_path, agency_profile_id, agency_split_pct_override'
          )
          .eq('profile_id', creatorId)
          .single();

        if (creatorData?.agency_profile_id) {
          setAgencyProfileId(creatorData.agency_profile_id);
          if (
            creatorData.agency_split_pct_override !== null &&
            creatorData.agency_split_pct_override !== undefined
          ) {
            setAgencySplitPct(Number(creatorData.agency_split_pct_override));
          } else {
            const { data: agencyRow } = await supabase
              .from('agencies')
              .select('default_split_pct')
              .eq('profile_id', creatorData.agency_profile_id)
              .maybeSingle();
            setAgencySplitPct(
              agencyRow?.default_split_pct != null
                ? Number(agencyRow.default_split_pct)
                : 0
            );
          }
        } else {
          setAgencyProfileId(null);
          setAgencySplitPct(0);
        }

        const bucket = supabase.storage.from('creator-content');
        const overrideUrls: string[] = [];
        if (creatorData?.ai_call_image_primary_path) {
          overrideUrls.push(bucket.getPublicUrl(creatorData.ai_call_image_primary_path).data.publicUrl);
        }
        if (creatorData?.ai_call_image_secondary_path) {
          overrideUrls.push(bucket.getPublicUrl(creatorData.ai_call_image_secondary_path).data.publicUrl);
        }
        const callModalImageUrl =
          overrideUrls.length > 0
            ? overrideUrls[Math.floor(Math.random() * overrideUrls.length)]
            : null;

        if (!profileError && profileData) {
          setCreatorProfile({
            ...profileData,
            ai_call_multi: creatorData?.ai_call_multi ?? 1,
            call_modal_image_url: callModalImageUrl,
          });
        }
      };
      fetchCreatorProfile();
    }
    return () => {
      cleanup();
    };
  }, [isOpen, creatorId]);

  const cleanup = () => {
    stopRecording();
    setWebsocketUrl(null);
    setError(null);
  };

  const processAudioQueue = () => {
    if (audioQueueRef.current.length > 0) {
      const arrayBuffer = audioQueueRef.current.shift();
      if (!arrayBuffer || !audioContextRef.current) return;

      audioContextRef.current.decodeAudioData(arrayBuffer, (decodedData) => {
        const newSource = audioContextRef.current!.createBufferSource();
        newSource.buffer = decodedData;
        newSource.connect(audioContextRef.current!.destination);
        
        const currentTime = audioContextRef.current!.currentTime;
        const startTime = nextStartTimeRef.current > currentTime ? nextStartTimeRef.current : currentTime;
        
        newSource.start(startTime);
        isSourceStartedRef.current = true;
        nextStartTimeRef.current = startTime + newSource.buffer.duration;
        currentSourceRef.current = newSource;
        
        // Add to managed audio sources for cleanup
        addAudioSourceNode(newSource, startTime, newSource.buffer.duration);
        
        newSource.onended = () => {
          processAudioQueue();
        };
      }, (error) => {
        console.error('Error decoding audio data:', error);
        processAudioQueue();
      });
    }
  };

  const initializeSession = async () => {
    if (!elevenVoiceId) {
      setError('UNAVAILABLE');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    const effectivePrompt = personalityPrompt?.trim() || DEFAULT_CALL_PERSONALITY_PROMPT;
    let canStartCall = false;

    if (isDemo || testMode) {
      // Demo / test mode: skip credit checks
      canStartCall = true;
    } else {
      // Regular mode: check credits
      const { data: currentData, error: fetchError } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', profile?.id)
        .single();

      if (currentData?.credits <= 0) {
        // If user has no credits, stop the call and show buy credits modal
        setError('INSUFFICIENT CREDITS');
        setIsBuyCreditsModalOpen(true);
        setIsLoading(false);
      } else {
        canStartCall = true;
      }

      if (fetchError || !currentData) {
        console.error('Error fetching credits', fetchError);
        setError('ERROR');
        return false;
      }
    }

    if (canStartCall) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_VOICE_AI_BASE_URL;
        if (!baseUrl) {
          throw new Error('Voice AI base URL not configured');
        }

        // Fetch platform settings
        const { data: platformSettings, error: settingsError } = await supabase
          .from('platform_settings')
          .select('key, value')
          .in('key', ['prompt_prefix', 'call_credit_interval', 'price_per_credit', 'platform_split_ai']);

        if (settingsError) {
          console.error('Error fetching platform settings:', settingsError);
        }

        const settings = platformSettings?.reduce((acc, setting) => {
          acc[setting.key] = setting.value;
          return acc;
        }, {} as Record<string, string>) || {};

        const promptPrefix = settings['prompt_prefix'] || '';
        setCallCreditInterval(parseInt(settings['call_credit_interval'] || '4', 10));
        setPricePerCredit(parseInt(settings['price_per_credit'] || '0', 10));
        setPlatformSplit(parseInt(settings['platform_split_ai'] || '30', 10));

        const conversationHistory = await getCommunicationHistory(profile?.id || '', creatorId, 200);
        const response = await fetch('/api/voice-ai/get-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            creator_prompt: effectivePrompt,
            voice_id: elevenVoiceId,
            prompt_prefix: promptPrefix,
            user_name: profile?.full_name || profile?.username || '',
            conversation_history: conversationHistory,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to initialize call session');
        }

        const { sessionId } = await response.json();
        const cleanSessionId = sessionId.replace(/[\[\]"\/\s]/g, '');
        const wsUrl = toVoiceAiWebSocketUrl(baseUrl, cleanSessionId);
        // Create the call transaction record and set the transaction ID (skip in test mode)
        if (!testMode) {
          const transactionId = await createCallTransaction();
          setCallTransactionId(transactionId);
        }
        setWebsocketUrl(wsUrl);
        initializeWebSocket(wsUrl);
      } catch (err) {
        console.error('Error initializing call session:', err);
        setError('UNAVAILABLE');
        setIsLoading(false);
      } finally {
        // setIsLoading(false);
      }
    }
  };

  const initializeWebSocket = (url: string) => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      const startMessage = {
        type: 'websocket_audio_config_start',
        input_audio_config: {
          sampling_rate: sampleRate,
          audio_encoding: 'linear16',
          chunk_size: 4096
        },
        output_audio_config: {
          sampling_rate: sampleRate,
          audio_encoding: 'linear16',
        },
        conversation_id: Date.now().toString(),
        subscribe_transcript: true,
      };
      ws.send(JSON.stringify(startMessage));

      // Start heartbeat to keep the connection alive
      heartbeatIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'websocket_base' }));
        }
      }, 30000); // Send keepalive every 30 seconds

      setIsLoading(false);
      setIsConnected(true);
      startRecording();
    };

    ws.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'websocket_ready') {
        } else if (message.type === 'websocket_audio') {
          const base64Audio = message.data;
          const arrayBuffer = base64ToArrayBuffer(base64Audio);
          
          // Convert the raw bytes to Int16Array (LINEAR16 PCM)
          const pcmData = new Int16Array(arrayBuffer);
          
          const audioContext = audioContextRef.current;
          if (!audioContext) return;
          
          // Create audio buffer with correct number of samples
          const audioBuffer = audioContext.createBuffer(1, pcmData.length, sampleRate);
          const channelData = audioBuffer.getChannelData(0);
          
          // Convert Int16 PCM to Float32 for Web Audio API
          for (let i = 0; i < pcmData.length; i++) {
            channelData[i] = pcmData[i] / 32768.0;
          }
          
          // Create and play the audio source
          const newSource = audioContext.createBufferSource();
          newSource.buffer = audioBuffer;
          newSource.connect(audioContext.destination);
          
          const currentTime = audioContext.currentTime;
          const startTime = nextStartTimeRef.current > currentTime ? nextStartTimeRef.current : currentTime;
          
          newSource.start(startTime);
          isSourceStartedRef.current = true;
          nextStartTimeRef.current = startTime + audioBuffer.duration;
          currentSourceRef.current = newSource;
          
          // Add to managed audio sources for cleanup
          addAudioSourceNode(newSource, startTime, audioBuffer.duration);
          
          newSource.onended = () => {
            processAudioQueue();
          };
        } else if (message.type === 'websocket_clear') {
          if (currentSourceRef.current && isSourceStartedRef.current) {
            currentSourceRef.current.stop();
            currentSourceRef.current.disconnect();
          }
          // Clean up all audio sources and queue
          cleanupAllAudioSources();
          nextStartTimeRef.current = 0;
        } else if (message.type === 'websocket_transcript') {
          // Store transcript in database
          const { error } = await supabase
            .from('call_transcripts')
            .insert({
              user_id: profile?.id,
              creator_profile_id: creatorId,
              content: message.text,
              is_user: message.sender === 'human'
            });

          if (error) {
            console.error('Error storing transcript:', error);
          }
        } else if (message.type === 'websocket_stop') {
          stopRecording();
          setWebsocketUrl(null);
          setError(null);
        }
      } catch (e) {
        console.error('Error handling message:', e);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('Connection error occurred');
    };

    ws.onclose = (event) => {
      setIsConnected(false);
      cleanup();
    };
  };

  const cleanupAudioContext = () => {
    if (audioContextRef.current) {
      const context = audioContextRef.current;
      audioContextRef.current = null; // Clear reference first to prevent multiple cleanup attempts
      
      if (context.state !== 'closed') {
        try {
          context.close();
        } catch (e) {
        }
      }
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    
    // Stop and cleanup media recorder
    if (mediaRecorder) {
      mediaRecorder.stop();
      setMediaRecorder(null);
    }

    // Stop and cleanup audio stream
    if (audioStream) {
      audioStream.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
      setAudioStream(null);
    }

    // Disconnect and cleanup audio processor
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    // Disconnect and cleanup audio source
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    // Stop and cleanup current audio source
    if (currentSourceRef.current) {
      currentSourceRef.current.stop();
      currentSourceRef.current.disconnect();
      currentSourceRef.current = null;
    }

    // Clean up all managed audio sources
    cleanupAllAudioSources();

    // Stop audio cleanup interval
    if (cleanupIntervalRef.current) {
      clearInterval(cleanupIntervalRef.current);
      cleanupIntervalRef.current = null;
    }

    // Stop heartbeat interval
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    // Cleanup audio context
    cleanupAudioContext();

    // Clear timing references
    nextStartTimeRef.current = 0;
    isSourceStartedRef.current = false;

    // Close WebSocket
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'websocket_stop' }));
      }
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);

    if (callTransactionId && !testMode) {
      void supabase
        .from('call_transactions')
        .delete()
        .eq('id', callTransactionId)
        .eq('credits_used', 0);
    }
  };

  const startRecording = async () => {
    try {
      // Cleanup any existing audio context
      cleanupAudioContext();

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1
        } 
      });
      setIsRecording(true);
      setAudioStream(stream);

      const audioContext = new AudioContext({ sampleRate });
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;
      
      // AudioWorkletNode processes audio on a dedicated thread — avoids the
      // main-thread blocking that ScriptProcessorNode (deprecated) caused.
      // The worklet accumulates 4096 samples before posting (matching the
      // backend's chunk_size) to keep message frequency the same as before.
      const workletCode = `
        class PCMProcessor extends AudioWorkletProcessor {
          constructor() {
            super();
            this._buf = new Float32Array(4096);
            this._offset = 0;
          }
          process(inputs) {
            const ch = inputs[0]?.[0];
            if (!ch) return true;
            let i = 0;
            while (i < ch.length) {
              const space = 4096 - this._offset;
              const n = Math.min(space, ch.length - i);
              this._buf.set(ch.subarray(i, i + n), this._offset);
              this._offset += n;
              i += n;
              if (this._offset === 4096) {
                this.port.postMessage(this._buf.slice(0));
                this._offset = 0;
              }
            }
            return true;
          }
        }
        registerProcessor('pcm-processor', PCMProcessor);
      `;
      const workletBlob = new Blob([workletCode], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(workletBlob);
      await audioContext.audioWorklet.addModule(workletUrl);
      URL.revokeObjectURL(workletUrl);

      const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');
      processorRef.current = workletNode;

      workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) return;
        const inputData = event.data;

        // Float32 → Int16 PCM
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        // Int16 buffer → base64 without intermediate Array allocation
        const bytes = new Uint8Array(pcmData.buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);

        wsRef.current.send(JSON.stringify({ type: 'websocket_audio', data: btoa(binary) }));
      };

      source.connect(workletNode);
      // Connect to destination so the browser does not silently garbage-collect the node
      workletNode.connect(audioContext.destination);

      setMediaRecorder({
        stop: () => {
          workletNode.port.close();
          source.disconnect();
          workletNode.disconnect();
          cleanupAudioContext();
        },
      });
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Failed to start recording');
    }
  };

  const createCallTransaction = async () => {
    if (!profile?.id) {
      console.error('No profile ID available');
      return null;
    }

    try {
      // Log the data we're trying to insert
      const transactionData = {
        user_id: profile.id,
        creator_profile_id: creatorId,
        call_length_seconds: 0,
        credits_used: 0,
        credits_cents: 0,
        creator_share_cents: 0,
        platform_share_cents: 0,
        agency_share_cents: null as number | null,
        agency_profile_id: agencyProfileId,
      };

      const { data, error } = await supabase
        .from('call_transactions')
        .insert(transactionData)
        .select('id')
        .single();

      if (error) {
        console.error('Error creating call transaction:', {
          error,
          errorMessage: error.message,
          errorDetails: error.details,
          errorHint: error.hint,
          errorCode: error.code
        });
        return null;
      }

      if (!data?.id) {
        console.error('No transaction ID returned after successful insert');
        return null;
      }

      return data.id;
    } catch (err) {
      console.error('Error in createCallTransaction:', err);
      return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/80" onClick={onClose} />
      <div
        ref={cardRef}
        className={cn(
          'relative mx-4 w-full max-w-xs overflow-hidden rounded-lg bg-background shadow-lg transition-transform duration-500 ease-out',
          pulseEnabled && (isConnected ? 'scale-100' : 'scale-[0.97]')
        )}
      >
        <LiquidGradientBackground />
        <div className="relative z-10">
          <div ref={callWindowAnchorRef} className="relative aspect-square w-full">
            {(creatorProfile?.call_modal_image_url || creatorProfile?.avatar_url) ? (
              <Image 
                src={creatorProfile.call_modal_image_url || creatorProfile.avatar_url!} 
                alt={creatorProfile?.full_name || 'Creator Avatar'} 
                fill
                className="object-cover"
                priority
                onLoadingComplete={() => {
                  requestAnimationFrame(() => {
                    const g = measureCreditDrainLine();
                    if (g) setCreditDrainGeom(g);
                  });
                }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-muted text-4xl font-semibold">
                {(creatorProfile?.full_name || creatorProfile?.username || 'C').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>

        <div className="relative z-10 flex flex-row justify-between gap-2 px-3 pt-3 pb-4">
          <div className="flex min-w-0 flex-col items-start">
            <h3 className="truncate text-base font-bold leading-tight">
              {creatorProfile?.full_name || creatorProfile?.username}
            </h3>
            <p className="truncate text-sm font-medium leading-tight text-muted-foreground">
              @{creatorProfile?.username}
            </p>
            <div className="mt-4">
              <TimerDisplay seconds={displayTimer} />
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end justify-start">
            <div className="mb-1 flex items-center gap-1 text-xs font-medium leading-none">
              <span>
                {callStatusLabel({ isLoading, error, isConnected })}
              </span>
              <div
                className={cn(
                  'h-3 w-3 rounded-full transition-[transform,box-shadow] duration-300',
                  isLoading && 'animate-pulse bg-yellow-500',
                  error && 'bg-red-500',
                  !isLoading && !error && isConnected && 'bg-green-500',
                  !isLoading && !error && !isConnected && 'bg-red-500',
                  pulseEnabled && isConnected && connBeat && 'scale-110 shadow-[0_0_10px_rgba(34,197,94,0.55)]'
                )}
              />
            </div>
            <div ref={creditsDrainAnchorRef}>
              <CreditsDisplay
                credits={credits}
                pulseEnabled={pulseEnabled}
                deductFlash={deductFlash}
              />
            </div>
          </div>
        </div>

        {creditDrainGeom && showDrainLine ? (
          <div
            key={drainCycleKey}
            className="pointer-events-none absolute z-[28] h-2.5 w-2.5 rounded-full bg-[rgb(236,72,153)] motion-reduce:hidden motion-safe:animate-[credit-bubble-drain_0.85s_ease-out_forwards] motion-safe:shadow-[0_0_8px_rgba(236,72,153,0.35)]"
            style={{
              left: creditDrainGeom.x1,
              top: creditDrainGeom.y1,
              ['--drain-dx' as string]: `${creditDrainGeom.x2 - creditDrainGeom.x1}px`,
              ['--drain-dy' as string]: `${creditDrainGeom.y2 - creditDrainGeom.y1}px`,
            }}
            aria-hidden
          />
        ) : null}

        <Button 
          variant="destructive" 
          size="icon" 
          onClick={onClose}
          className={`absolute bottom-3 right-3 z-30 rounded-full ${!isConnected ? 'opacity-50' : ''}`}
        >
          <PhoneOff size={20} />
        </Button>
      </div>
    </div>
  );
}

// Helper function to convert base64 to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}