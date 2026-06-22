"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Profile } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Image as ImageIcon, UploadCloud, ArrowUp, Plus, Video, Gift, Phone, MessageSquare, DollarSign, Lock } from 'lucide-react';
// Shell (SideNav / right rail) is provided by ClientLayout.
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import "yet-another-react-lightbox/plugins/thumbnails.css";
import type { SlideImage } from "yet-another-react-lightbox";
import { cn } from "@/lib/utils";
import { createPortal } from 'react-dom';
import { ChatSkeleton } from './ChatSkeleton';
import { useUser } from '@/lib/contexts/user-context';
import { getAIResponse } from '@/lib/ai-dm-response';
import { CallModal } from '@/components/call/CallModal';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { TipModal } from '@/components/subscription/TipModal';
import { createTipNotification } from '@/app/actions/notificationActions';
import { PPVModal } from '@/components/subscription/PPVModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCreditsModal } from '@/lib/contexts/credits-modal-context';
import { useCreditMonetization } from '@/lib/contexts/credit-monetization-context';
import { formatUsdWithCreditsSuffix } from '@/lib/credits/monetization-display';
import { MessagesThemeToggle } from '@/components/messages/messages-theme-toggle';
import { MessageList } from '@/components/messages/MessageList';
import type { ChatMessage } from '@/components/messages/MessageBubble';
import { getCachedSignedUrl, setCachedSignedUrl } from '@/lib/messages/media-url-cache';

type Message = ChatMessage;

// Header component
const ConversationHeader = ({ 
  otherProfile, 
  router, 
  isCurrentUserCreator, 
  isAIDMEnabled, 
  handleAIDMsToggle, 
  isAICallEnabled, 
  setShowCallModal 
}: { 
  otherProfile: Profile | null;
  router: any;
  isCurrentUserCreator: boolean;
  isAIDMEnabled: boolean;
  handleAIDMsToggle: (enabled: boolean) => void;
  isAICallEnabled: boolean;
  setShowCallModal: (show: boolean) => void;
}) => (
  <header
    className="msg-thread-header flex shrink-0 items-center justify-between gap-3 min-h-[56px] px-3 md:px-[18px] py-3 z-10 border-b border-border backdrop-blur-[18px] [-webkit-backdrop-filter:blur(18px)]"
    style={{ background: "color-mix(in oklch, var(--background) 78%, transparent)" }}
  >
    <div className="flex items-center gap-2 min-w-0">
      <Button variant="ghost" size="icon" className="msg-back shrink-0 rounded-full" onClick={() => router.push('/messages')}>
        <ArrowLeft size={20} className="text-muted-foreground" />
      </Button>
      {otherProfile ? (
        <div
          className="flex items-center gap-3 cursor-pointer min-w-0"
          onClick={() => {
            if (otherProfile.username) {
              router.push(`/u/${otherProfile.username}`);
            } else {
              router.push(`/u/${otherProfile.id}`);
            }
          }}
        >
          <Avatar className="h-[42px] w-[42px] border flex-shrink-0" profileId={otherProfile.id}>
              <AvatarImage src={otherProfile.avatar_url || undefined} alt={otherProfile.full_name || otherProfile.username || 'User'} />
              <AvatarFallback className="h-[42px] w-[42px] text-sm font-bold">{(otherProfile.full_name || otherProfile.username || 'U').charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <span className="font-bold text-[15px] hover:underline truncate block">{otherProfile.full_name || otherProfile.username || "User"}</span>
            <span className="text-[12.5px] text-muted-foreground">Active recently</span>
          </div>
        </div>
      ) : (
        <span className="font-bold">Conversation</span>
      )}
    </div>
    
    <div className="flex items-center gap-2 shrink-0">
      <MessagesThemeToggle className="md:hidden" />
      {isCurrentUserCreator && (
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-muted-foreground" />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Switch
                    checked={isAIDMEnabled}
                    onCheckedChange={handleAIDMsToggle}
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="end" className="z-50">
                {isAIDMEnabled ? "AI messaging enabled" : "AI messaging disabled"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
      
      {isAICallEnabled && otherProfile && (
        <Button
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            setShowCallModal(true);
          }}
          aria-label="Start voice call"
          className="profile-call-attention hidden sm:inline-flex h-[38px] gap-1.5 rounded-full px-4 text-[13px] font-semibold text-[var(--brand-on-accent)] hover:opacity-90"
          style={{ background: 'var(--brand-grad)', boxShadow: 'var(--brand-ring-money)' }}
        >
          <Phone size={15} />
          Call
        </Button>
      )}
      {isAICallEnabled && otherProfile && (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            setShowCallModal(true);
          }}
          aria-label="Start voice call"
          className="profile-call-attention sm:hidden h-10 w-10 shrink-0 rounded-full text-[var(--brand-on-accent)] hover:opacity-90"
          style={{ background: 'var(--brand-grad)' }}
        >
          <Phone size={18} />
        </Button>
      )}
    </div>
  </header>
);

// MessageInput component
const MessageInput = ({
  input,
  handleInputChange,
  sending,
  handleSend,
  dragActive,
  setDragActive,
  inputRowRef,
  openDrawer,
  imageInputRef,
  videoInputRef,
  drawerVisible,
  drawerPosition,
  drawerRef,
  drawerReady,
  drawerOpen,
  closeDrawer,
  ANIMATION_DURATION,
  isOtherUserCreator,
  setIsTipModalOpen,
  isCurrentUserCreator,
  setIsPPVModalOpen,
  isPPVModalOpen,
  PPVMessage,
  setPPVMessage,
  PPVPrice,
  setPPVPrice,
  ppvDraftChipLabel
}: {
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  sending: boolean;
  handleSend: (mediaFile?: File) => Promise<void>;
  dragActive: boolean;
  setDragActive: (active: boolean) => void;
  inputRowRef: React.RefObject<HTMLDivElement | null>;
  openDrawer: () => void;
  imageInputRef: React.RefObject<HTMLInputElement | null>;
  videoInputRef: React.RefObject<HTMLInputElement | null>;
  drawerVisible: boolean;
  drawerPosition: { left: number; top: number; width: number } | null;
  drawerRef: React.RefObject<HTMLDivElement | null>;
  drawerReady: boolean;
  drawerOpen: boolean;
  closeDrawer: () => void;
  ANIMATION_DURATION: number;
  isOtherUserCreator: boolean;
  setIsTipModalOpen: (open: boolean) => void;
  isCurrentUserCreator: boolean;
  setIsPPVModalOpen: (open: boolean) => void;
  isPPVModalOpen: boolean;
  PPVMessage: boolean;
  setPPVMessage: (open: boolean) => void;
  PPVPrice: number;
  setPPVPrice: (price: number) => void;
  ppvDraftChipLabel: string;
}) => (
  <form
    className={`shrink-0 border-t border-border bg-background px-[18px] py-3 ${dragActive ? 'z-20' : ''}`}
    onSubmit={e => {
      e.preventDefault();
      handleSend();
    }}
    onDragOver={e => {
      e.preventDefault();
      setDragActive(true);
    }}
    onDragLeave={e => {
      e.preventDefault();
      setDragActive(false);
    }}
    onDrop={e => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
        handleSend(file);
      }
    }}
  >
    <div className="relative w-full">
      {PPVMessage && PPVPrice > 0 && (
        <div className="mb-2.5 flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-semibold" style={{ background: 'var(--brand-grad-soft)' }}>
          <Lock size={14} className="text-[var(--brand-pink)] shrink-0" />
          <span>Pay-per-view price</span>
          <span className="text-muted-foreground">{ppvDraftChipLabel}</span>
          <button
            type="button"
            className="ml-auto text-muted-foreground text-[12.5px] font-semibold hover:text-foreground"
            onClick={() => { setPPVMessage(false); }}
            aria-label="Deactivate PPV"
          >
            Remove
          </button>
        </div>
      )}
      <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 pointer-events-none ${dragActive ? 'opacity-100' : 'opacity-0'}`}
        style={{ background: 'rgba(236, 72, 153, 0.15)', zIndex: 10 }}
      >
        <div className="flex items-center gap-2">
          <UploadCloud size={20} className="text-pink-500" />
          <span className="text-pink-500 font-medium text-sm">Drop to upload</span>
        </div>
      </div>
      <div ref={inputRowRef} className={`flex items-center gap-2.5 w-full transition-opacity duration-200 ${dragActive ? 'opacity-0' : 'opacity-100'}`}>
        <button
          type="button"
          className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary focus:outline-none shrink-0"
          onClick={openDrawer}
          aria-label="Open more options"
        >
          <Plus size={21} />
        </button>
        <input
          type="text"
          className="msg-composer-input"
          placeholder={PPVMessage ? "Add a caption…" : "Type a message…"}
          value={input}
          onChange={handleInputChange}
          disabled={sending}
          autoComplete="off"
        />
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) handleSend(file);
            e.target.value = '';
          }}
          disabled={sending}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) handleSend(file);
            e.target.value = '';
          }}
          disabled={sending}
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="msg-send-btn shrink-0"
          data-active={!sending && !!input.trim()}
          aria-label="Send message"
        >
          <ArrowUp size={18} />
        </button>
      </div>
      {drawerVisible && drawerPosition && typeof window !== 'undefined' && createPortal(
        <>
          <div
            className="fixed inset-0 z-[100]"
            onClick={closeDrawer}
            style={{ pointerEvents: 'auto' }}
          />
          <div
            ref={drawerRef}
            className={`z-[110] w-56 bg-background/80 backdrop-blur-md border border-border/60 rounded-xl p-2 flex flex-col gap-2 transition-all duration-200
              ${drawerReady && drawerOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}
            style={{
              position: 'absolute',
              left: drawerPosition.left,
              top: drawerPosition.top,
              pointerEvents: 'auto',
            }}
          >
            <button
              className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted transition"
              onClick={() => {
                closeDrawer();
                setTimeout(() => imageInputRef.current?.click(), ANIMATION_DURATION + 50);
              }}
            >
              <ImageIcon size={18} className="text-pink-500" />
              <span className="text-sm">Send image</span>
            </button>
            <button
              className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted transition"
              onClick={() => {
                closeDrawer();
                setTimeout(() => videoInputRef.current?.click(), ANIMATION_DURATION + 50);
              }}
            >
              <Video size={18} className="text-pink-500" />
              <span className="text-sm">Send video</span>
            </button>
            {isOtherUserCreator && (
              <>
                <button
                  className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted transition"
                  onClick={() => {
                    closeDrawer();
                    setTimeout(() => setIsTipModalOpen(true), ANIMATION_DURATION + 50);
                  }}
                >
                  <Gift size={18} className="text-pink-500" />
                  <span className="text-sm">Send tip</span>
                </button>
                <button
                  className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted transition"
                  onClick={() => {
                    closeDrawer();
                    setTimeout(() => setIsPPVModalOpen(true), ANIMATION_DURATION + 50);
                  }}
                >
                  <DollarSign size={18} className="text-pink-500" />
                  <span className="text-sm">Activate PPV</span>
                </button>
              </>
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  </form>
);

export default function ConversationPage() {
  const { conversationId } = useParams();
  const convId = Array.isArray(conversationId) ? conversationId[0] : (conversationId ?? '');
  const router = useRouter();
  const supabase = useRef(createClient()).current;
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<any>(null);
  const [otherProfile, setOtherProfile] = useState<Profile | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const { session, profile } = useUser();
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [otherParticipant, setOtherParticipant] = useState<any>(null);
  const [otherLastReadId, setOtherLastReadId] = useState<string | null>(null);
  const [myLastReadId, setMyLastReadId] = useState<string | null>(null);
  const [isAIDMEnabled, setIsAIDMEnabled] = useState(false);
  const [creatorPersonalityPrompt, setCreatorPersonalityPrompt] = useState<string | null>(null);
  const [isAICallEnabled, setIsAICallEnabled] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [creatorVoiceId, setCreatorVoiceId] = useState<string | null>(null);
  const [isCurrentUserCreator, setIsCurrentUserCreator] = useState(false);
  const [isTipModalOpen, setIsTipModalOpen] = useState(false);
  const [isOtherUserCreator, setIsOtherUserCreator] = useState(false);
  const [isOtherCreatorDemo, setIsOtherCreatorDemo] = useState(false);
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [mediaItems, setMediaItems] = useState<SlideImage[]>([]);
  const [loadingImages, setLoadingImages] = useState<Record<string, boolean>>({});
  const [loadingVideos, setLoadingVideos] = useState<Record<string, boolean>>({});
  const [allMediaLoaded, setAllMediaLoaded] = useState(false);
  const [videoAspectRatios, setVideoAspectRatios] = useState<Record<string, number>>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerReady, setDrawerReady] = useState(false);
  const ANIMATION_DURATION = 180; // ms
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const inputRowRef = useRef<HTMLDivElement | null>(null);
  const [drawerPosition, setDrawerPosition] = useState<{ left: number; top: number; width: number } | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const hasFetchedRef = useRef<string | null>(null);
  const mediaInitRef = useRef<Set<string>>(new Set());
  const [isPPVModalOpen, setIsPPVModalOpen] = useState(false);
  const [PPVMessage, setPPVMessage] = useState(false);
  const [PPVPrice, setPPVPrice] = useState<number>(0);
  const [PPVPriceInput, setPPVPriceInput] = useState('');
  const [unlockingPPVMessageId, setUnlockingPPVMessageId] = useState<string | null>(null);
  const [unlockedPPVMessages, setUnlockedPPVMessages] = useState<Set<string>>(new Set());
  const { setIsBuyCreditsModalOpen } = useCreditsModal();
  const { creditOnlyEcosystem, pricePerCreditCents } = useCreditMonetization();
  const ppvDraftChipLabel =
    PPVPrice > 0
      ? `PPV ${formatUsdWithCreditsSuffix(PPVPrice, creditOnlyEcosystem, pricePerCreditCents)}`
      : '';

  // Robust fetch effect
  useEffect(() => {
    if (!profile || !convId) return;
    
    // Only reset states if this is a new conversation
    if (hasFetchedRef.current !== convId) {
      setLoading(true);
      setInitialLoadComplete(false);
      hasFetchedRef.current = convId;
    }
    
    let mounted = true;
    async function fetchData() {
      if (!profile) return;
      try {
        // Get conversation and messages in parallel
        const [convResponse, msgsResponse] = await Promise.all([
          supabase
            .from('conversations')
            .select('*, participants:conversation_participants(id, user_id, profiles:profiles(*), last_read_message_id, is_typing)')
            .eq('id', convId)
            .single(),
          supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', convId)
            .order('created_at', { ascending: true })
        ]);

        if (!mounted) return;

        if (!convResponse.data) {
          setMessages([]);
          setLoading(false);
          setInitialLoadComplete(true);
          return;
        }

        const conv = convResponse.data;
        setConversation(conv);
        
        // Find the other participant's participant row robustly (for 1:1)
        const myId = profile.id;
        const otherPart = (conv.participants || []).find((p: any) => p.user_id !== myId);
        setOtherParticipant(otherPart || null);
        
        // Find the other participant's profile (for display)
        const others = (conv.participants || []).map((p: any) => p.profiles).filter((p: Profile) => p.id !== myId);
        const otherProfile = others[0] || null;
        setOtherProfile(otherProfile);

        // Check if other participant is a creator with AI DMs enabled
        if (otherProfile) {
          const { data: creatorData } = await supabase
            .from('creators')
            .select('ai_dms_enabled, personality_prompt, ai_call_enabled, eleven_voice_id, is_demo')
            .eq('profile_id', otherProfile.id)
            .maybeSingle();

          if (creatorData) {
            setIsAIDMEnabled(creatorData.ai_dms_enabled);
            setCreatorPersonalityPrompt(creatorData.personality_prompt);
            setIsAICallEnabled(creatorData.ai_call_enabled);
            setCreatorVoiceId(creatorData.eleven_voice_id);
            setIsOtherCreatorDemo(creatorData.is_demo || false);
            setIsOtherUserCreator(true);
          } else {
            setIsOtherUserCreator(false);
            setIsOtherCreatorDemo(false);
            setIsAIDMEnabled(false);
          }
        }

        // Check if current user is a creator
        if (profile) {
          const { data: currentUserCreatorData } = await supabase
            .from('creators')
            .select('ai_dms_enabled')
            .eq('profile_id', profile.id)
            .maybeSingle();

          if (currentUserCreatorData) {
            setIsCurrentUserCreator(true);
          }
        }

        // Get all messages that need signed URLs
        const messages = msgsResponse.data || [];
        const messagesNeedingUrls = messages.filter(msg => 
          msg.media_url && !msg.media_url.startsWith('https://')
        );

        // Generate signed URLs for all media messages
        if (messagesNeedingUrls.length > 0) {
          await Promise.all(
            messagesNeedingUrls.map(async (msg) => {
              const { data: signedUrlData } = await supabase.storage
                .from('message-media')
                .createSignedUrl(msg.media_url!, 3600);
              
              if (signedUrlData?.signedUrl) {
                setCachedSignedUrl(`signedurl_${msg.id}`, signedUrlData.signedUrl, 3600);
                msg.media_url = signedUrlData.signedUrl;
              }
            })
          );
        }

        // Set messages and update loading state
        setMessages(messages);
        
        // Always set loading to false after data is fetched
        setLoading(false);
        setInitialLoadComplete(true);
      } catch (error) {
        console.error('Error fetching conversation data:', error);
        if (mounted) {
          setMessages([]);
          setLoading(false);
          setInitialLoadComplete(true);
        }
      }
    }
    fetchData();
    return () => { mounted = false; };
  }, [profile, convId, supabase]);

  // Subscribe to new messages
  useEffect(() => {
    if (!convId || !profile) return;
    const channel = supabase.channel(`messages-${convId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${convId}`
      }, async (payload) => {
        // Don't set loading state for new messages
        const newMessage = payload.new as Message;
        
        // Check if we already have this message (from local state)
        setMessages(prev => {
          // More robust duplicate check
          const isDuplicate = prev.some(msg => 
            msg.id === newMessage.id || 
            (msg.content === newMessage.content && 
             msg.media_url === newMessage.media_url && 
             msg.created_at === newMessage.created_at &&
             msg.sender_id === newMessage.sender_id)
          );
          if (isDuplicate) {
            return prev;
          }
          
          // If it's a new message, add it to the state
          const updatedMessages = [...prev, newMessage];
          
          // If this is a media message, ensure we have a signed URL
          if (newMessage.media_url && !newMessage.media_url.startsWith('https://')) {
            // Handle signed URL generation in a separate effect
            setTimeout(async () => {
              const { data: signedUrlData } = await supabase.storage
                .from('message-media')
                .createSignedUrl(newMessage.media_url!, 3600);
              
              if (signedUrlData?.signedUrl) {
                setCachedSignedUrl(`signedurl_${newMessage.id}`, signedUrlData.signedUrl, 3600);
                setMessages(current => 
                  current.map(msg => 
                    msg.id === newMessage.id 
                      ? { ...msg, media_url: signedUrlData.signedUrl }
                      : msg
                  )
                );
              }
            }, 0);
          }
          
          return updatedMessages;
        });

        // Check if we're near top before scrolling (since we're in reverse order)
        if (messagesContainerRef.current) {
          const { scrollTop } = messagesContainerRef.current;
          const isNearTop = scrollTop < 100; // 100px threshold from top
          if (isNearTop) {
            messagesContainerRef.current.scrollTop = 0;
          }
        }
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('Messages realtime subscription error');
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [convId, profile?.id, supabase]);

  // Subscribe to is_typing changes for other participants
  useEffect(() => {
    if (!convId || !profile) return;
    const channel = supabase.channel(`typing-${convId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversation_participants',
        filter: `conversation_id=eq.${convId}`
      }, async () => {
        const { data: participants } = await supabase
          .from('conversation_participants')
          .select('user_id, is_typing')
          .eq('conversation_id', convId);
        // If any participant (not the current user) is typing, show indicator
        const someoneTyping = (participants || []).some(
          (p) => p.user_id !== profile.id && p.is_typing
        );
        setIsOtherTyping(someoneTyping);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [convId, profile?.id, supabase]);

  // Update last_read_message_id when messages change
  useEffect(() => {
    if (!profile || !messages.length || !convId) return;

    // Get the latest message that's not from the current user
    const lastUnreadMessage = [...messages].reverse().find(msg => msg.sender_id !== profile.id);
    if (!lastUnreadMessage) return;

    // Fetch current participant row to check last_read_message_id
    supabase.from('conversation_participants')
      .select('last_read_message_id')
      .match({ conversation_id: convId, user_id: profile.id })
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error('Error fetching participant data:', error);
          return;
        }

        // Update if last_read_message_id is NULL or different from the current message
        if (!data?.last_read_message_id || data.last_read_message_id !== lastUnreadMessage.id) {
          // Update the database without triggering a refetch
          supabase.from('conversation_participants')
            .update({ last_read_message_id: lastUnreadMessage.id })
            .match({ conversation_id: convId, user_id: profile.id })
            .select()
            .single()
            .then(({ data: updatedData }) => {
              if (updatedData) {
                // Update local state to avoid refetch
                setMyLastReadId(updatedData.last_read_message_id);
              }
            });
        } else {
          // Update local state with current value
          setMyLastReadId(data.last_read_message_id);
        }
      });
  }, [messages, convId, profile?.id, supabase]);

  // Subscribe to other participant's last_read_message_id
  useEffect(() => {
    if (!convId || !otherParticipant || !otherParticipant.id) return;
    const channel = supabase.channel(`read-receipt-${convId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversation_participants',
        filter: `id=eq.${otherParticipant.id}`
      }, (payload) => {
        // Only update if it's the other participant's read status
        if (payload.new.user_id !== profile?.id) {
          setOtherLastReadId(payload.new.last_read_message_id);
        }
      })
      .subscribe();
    // Always fetch the latest value on mount
    supabase.from('conversation_participants')
      .select('last_read_message_id')
      .eq('id', otherParticipant.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setOtherLastReadId(data.last_read_message_id);
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [convId, otherParticipant, supabase, profile?.id]);

  // Update media loading effect — only initialize loaders for newly seen messages
  useEffect(() => {
    if (!messages.length) return;

    const imageMsgs = messages.filter(
      (msg) => msg.media_url && msg.media_type?.startsWith('image/') && !mediaInitRef.current.has(msg.id)
    );
    const videoMsgs = messages.filter(
      (msg) => msg.media_url && msg.media_type?.startsWith('video/') && !mediaInitRef.current.has(msg.id)
    );

    if (!imageMsgs.length && !videoMsgs.length) {
      return;
    }

    for (const msg of [...imageMsgs, ...videoMsgs]) {
      mediaInitRef.current.add(msg.id);
    }

    if (imageMsgs.length) {
      setLoadingImages((prev) => {
        const next = { ...prev };
        for (const msg of imageMsgs) {
          if (msg.media_url) next[msg.media_url] = true;
        }
        return next;
      });
    }
    if (videoMsgs.length) {
      setLoadingVideos((prev) => {
        const next = { ...prev };
        for (const msg of videoMsgs) {
          if (msg.media_url) next[msg.media_url] = true;
        }
        return next;
      });
    }

    const markImageDone = (url: string) => {
      setLoadingImages((prev) => ({ ...prev, [url]: false }));
    };
    const markVideoDone = (url: string) => {
      setLoadingVideos((prev) => ({ ...prev, [url]: false }));
    };

    const loadPromises = [
      ...imageMsgs.map((msg) => {
        const displayUrl = msg.media_url!;
        if (!displayUrl.startsWith('https://')) {
          markImageDone(msg.media_url!);
          return Promise.resolve();
        }
        return new Promise<void>((resolve) => {
          const img = new window.Image();
          img.onload = () => {
            markImageDone(msg.media_url!);
            resolve();
          };
          img.onerror = () => {
            markImageDone(msg.media_url!);
            resolve();
          };
          img.src = displayUrl;
        });
      }),
      ...videoMsgs.map((msg) => {
        const displayUrl = msg.media_url!;
        if (!displayUrl.startsWith('https://')) {
          markVideoDone(msg.media_url!);
          return Promise.resolve();
        }
        return new Promise<void>((resolve) => {
          const video = document.createElement('video');
          video.preload = 'metadata';
          video.onloadedmetadata = () => {
            markVideoDone(msg.media_url!);
            resolve();
          };
          video.onerror = () => {
            markVideoDone(msg.media_url!);
            resolve();
          };
          video.src = displayUrl;
        });
      }),
    ];

    Promise.all(loadPromises).then(() => {
      setAllMediaLoaded(true);
    });
  }, [messages]);

  // After the drawer renders, measure its height and update the position, then set drawerReady
  useEffect(() => {
    if (drawerVisible && drawerRef.current && drawerPosition) {
      const drawerHeight = drawerRef.current.offsetHeight;
      const inputTop = inputRowRef.current?.getBoundingClientRect().top ?? 0;
      if (drawerPosition.top !== inputTop - drawerHeight - 8) {
        setDrawerPosition(pos => {
          if (!pos) return pos;
          return { ...pos, top: inputTop - drawerHeight - 8 };
        });
      } else {
        setDrawerReady(true);
        setDrawerOpen(true);
      }
    }
  }, [drawerVisible, drawerPosition]);

  useEffect(() => {
    hasFetchedRef.current = null;
    mediaInitRef.current = new Set();
    setLoadingImages({});
    setLoadingVideos({});
    setVideoAspectRatios({});
  }, [convId]);

  // Update the URL refresh interval to be more frequent
  useEffect(() => {
    const interval = setInterval(() => {
      if (messages.length > 0) {
        refreshMessageUrls(messages);
      }
    }, 45 * 60 * 1000); // Refresh every 45 minutes (before 1-hour expiry)

    return () => clearInterval(interval);
  }, [messages.length]);

  // Update media items when messages change
  useEffect(() => {
    const items = messages
      .filter(msg => msg.media_url && msg.media_type?.startsWith('image/'))
      .map(msg => ({
        src: getCachedSignedUrl(`signedurl_${msg.id}`) || msg.media_url!,
        type: 'image' as const
      }));
    setMediaItems(items);
  }, [messages]);

  // After the drawer renders, measure its height and update the position, then set drawerReady
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (!profile) return;
    supabase.from('conversation_participants').update({ is_typing: true })
      .eq('conversation_id', convId)
      .eq('user_id', profile.id)
      .then(() => {});
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      supabase.from('conversation_participants').update({ is_typing: false })
        .eq('conversation_id', convId)
        .eq('user_id', profile.id)
        .then(() => {});
    }, 2000);
  };

  const triggerAiDmResponse = useCallback(
    async (message: string) => {
      if (!isAIDMEnabled || !otherProfile || !profile || !convId) {
        return;
      }
      setIsOtherTyping(true);
      try {
        const { message: aiMessage } = await getAIResponse({
          message,
          creatorId: otherProfile.id,
          personalityPrompt: creatorPersonalityPrompt || '',
          conversationId: convId,
          userId: profile.id,
          userName: profile.full_name || profile.username || '',
        });

        if (aiMessage) {
          setMessages((prev) =>
            prev.some((m) => m.id === aiMessage.id)
              ? prev
              : [
                  ...prev,
                  {
                    id: aiMessage.id,
                    sender_id: aiMessage.sender_id,
                    content: aiMessage.content,
                    media_url: null,
                    media_type: null,
                    created_at: aiMessage.created_at,
                    isPPV: false,
                    PPV_price: null,
                  } as Message,
                ]
          );
        }
      } catch (error) {
        // Fail silently so fans don't know the reply was AI-generated
        console.error('AI DM response failed:', error);
      } finally {
        setIsOtherTyping(false);
      }
    },
    [isAIDMEnabled, creatorPersonalityPrompt, otherProfile, profile, convId]
  );

  const handleSend = async (mediaFile?: File) => {
    if (!profile) return;
    setSending(true);
    let media_url = null;
    let media_type = null;
    let media_description = null;
    let isPPV = false;
    let PPV_price = null;

    if (mediaFile) {
      const fileExt = mediaFile.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${convId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('message-media')
        .upload(filePath, mediaFile);

      if (uploadError) {
        console.error('Error uploading file:', uploadError);
        setSending(false);
        return;
      }

      media_url = filePath;
      media_type = mediaFile.type;

      // If PPVMessage is true, set PPV fields
      if (PPVMessage && PPVPrice > 0) {
        isPPV = true;
        PPV_price = PPVPrice;
        setPPVMessage(false); // Reset after sending
      }
    }

    const textContent = input.trim();

    try {
      if (isAIDMEnabled && otherProfile && !isOtherCreatorDemo) {
        if ((profile.credits ?? 0) < 1) {
          setIsBuyCreditsModalOpen(true);
          setSending(false);
          return;
        }
      }

      if (media_url && media_type?.startsWith('image/')) {
        const { data: signedUrlData } = await supabase.storage
          .from('message-media')
          .createSignedUrl(media_url, 3600);

        const response = await fetch('/api/voice-ai/get-image-description', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_url: signedUrlData?.signedUrl }),
        });

        if (!response.ok) {
          throw new Error('Failed to get image description');
        }

        const { description } = await response.json();
        media_description = description;
      } else if (media_url && media_type?.startsWith('video/')) {
        media_description = `###USER SENT VIDEO RESPOND THAT YOU AREN'T ABLE TO SEE IT AT THE MOMENT`;
      }

      const { data: msg, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: convId,
          sender_id: profile.id,
          content: textContent || null,
          media_url,
          media_type,
          media_description,
          isPPV,
          PPV_price,
        })
        .select()
        .single();

      if (error) {
        console.error('Error sending message:', error);
        throw error;
      }

      if (!msg) {
        throw new Error('No message data returned');
      }

      // Generate signed URL for immediate display
      if (msg.media_url) {
        const { data: signedUrlData } = await supabase.storage
          .from('message-media')
          .createSignedUrl(msg.media_url, 3600);
        
        if (signedUrlData?.signedUrl) {
          setCachedSignedUrl(`signedurl_${msg.id}`, signedUrlData.signedUrl, 3600);
          msg.media_url = signedUrlData.signedUrl;
        }
      }

      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      setInput('');

      await supabase
        .from('conversations')
        .update({
          last_message_id: msg.id,
          last_message_at: msg.created_at,
        })
        .eq('id', convId);

      if (isAIDMEnabled && otherProfile) {
        if (!isOtherCreatorDemo) {
          const { data: debitData, error: debitError } = await supabase.rpc(
            'debit_credits_if_sufficient',
            { p_user_id: profile!.id, p_credits: 1 }
          );
          const debitResult = debitData as { ok: boolean; error?: string } | null;
          if (debitError || !debitResult?.ok) {
            if (debitResult?.error === 'insufficient_credits') setIsBuyCreditsModalOpen(true);
            setSending(false);
            return;
          }
        }

        let aiPayload = textContent;
        if (media_description) {
          aiPayload = media_type?.startsWith('image/')
            ? `###USER SENT IMAGE_DESCRIPTION: ${media_description}`
            : media_description;
        }
        if (aiPayload) {
          void triggerAiDmResponse(aiPayload);
        }
      }

      if (messagesContainerRef.current) {
        const { scrollTop } = messagesContainerRef.current;
        if (scrollTop < 100) {
          messagesContainerRef.current.scrollTop = 0;
        }
      }
    } catch (error) {
      console.error('Error in message creation:', error);
    } finally {
      setSending(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleUnlockPpv = useCallback((msgId: string) => {
    setUnlockingPPVMessageId(msgId);
  }, []);

  const handleOpenImage = useCallback((items: SlideImage[]) => {
    setMediaItems(items);
    setSelectedImageIndex(0);
    setLightboxOpen(true);
  }, []);

  const handleVideoMetadata = useCallback((msgId: string, e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = e.currentTarget;
    if (video.videoWidth && video.videoHeight) {
      setVideoAspectRatios((prev) => ({ ...prev, [msgId]: video.videoWidth / video.videoHeight }));
    }
  }, []);

  // Replace openDrawer with a function that sets position before showing
  const openDrawer = () => {
    if (inputRowRef.current) {
      const rect = inputRowRef.current.getBoundingClientRect();
      setDrawerPosition({ left: rect.left + 8, top: rect.top, width: rect.width });
      setDrawerVisible(true);
      setDrawerReady(false);
    }
  };

  // On close, animate out then unmount
  const closeDrawer = () => {
    setDrawerOpen(false);
    setTimeout(() => setDrawerVisible(false), ANIMATION_DURATION);
  };

  // Update refreshMessageUrls to handle file paths correctly
  const refreshMessageUrls = async (messages: Message[]) => {
    const updatedMessages = await Promise.all(
      messages.map(async (msg) => {
        if (!msg.media_url || !msg.media_type) return msg;
        
        const cacheKey = `signedurl_${msg.id}`;
        const cachedUrl = getCachedSignedUrl(cacheKey);
        
        // If we have a valid cached URL, use it
        if (cachedUrl) {
          return { ...msg, media_url: cachedUrl };
        }

        // Check if the URL is already a signed URL
        if (msg.media_url.startsWith('https://')) {
          return msg;
        }

        // Generate a new signed URL from the stored file path
        const { data } = await supabase.storage
          .from('message-media')
          .createSignedUrl(msg.media_url, 3600);
        
        if (data?.signedUrl) {
          setCachedSignedUrl(cacheKey, data.signedUrl, 3600);
          return { ...msg, media_url: data.signedUrl };
        }
        
        return msg;
      })
    );
    setMessages(updatedMessages);
  };

  // Add function to handle AI DMs toggle
  const handleAIDMsToggle = async (enabled: boolean) => {
    if (!profile) return;
    
    const { error } = await supabase
      .from('creators')
      .update({ ai_dms_enabled: enabled })
      .eq('profile_id', profile.id);

    if (error) {
      console.error('Error updating AI DMs setting:', error);
      toast.error('Failed to update AI messaging setting.');
      return;
    }

    setIsAIDMEnabled(enabled);
    toast.success(enabled ? 'AI messaging enabled.' : 'AI messaging disabled.');
  };

  const header = (
    <ConversationHeader
      otherProfile={otherProfile}
      router={router}
      isCurrentUserCreator={isCurrentUserCreator}
      isAIDMEnabled={isAIDMEnabled}
      handleAIDMsToggle={handleAIDMsToggle}
      isAICallEnabled={isAICallEnabled}
      setShowCallModal={setShowCallModal}
    />
  );
  
  if (loading || !initialLoadComplete) {
    return (
      <div className="flex flex-col flex-1 min-h-0 h-full w-full bg-background">
        {header}
        <div className="flex-1 min-h-0 overflow-y-auto px-[18px] py-[18px]">
          <ChatSkeleton />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col flex-1 min-h-0 h-full w-full bg-background">
        {header}
        <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain px-[18px] py-[18px] bg-background flex flex-col-reverse gap-2.5">
          <MessageList
            messages={messages}
            profileId={profile?.id}
            otherLastReadId={otherLastReadId}
            loadingImages={loadingImages}
            loadingVideos={loadingVideos}
            videoAspectRatios={videoAspectRatios}
            creditOnlyEcosystem={creditOnlyEcosystem}
            pricePerCreditCents={pricePerCreditCents}
            unlockingPPVMessageId={unlockingPPVMessageId}
            unlockedPPVMessages={unlockedPPVMessages}
            onUnlockPpv={handleUnlockPpv}
            onOpenImage={handleOpenImage}
            onVideoMetadata={handleVideoMetadata}
          />
        </div>
        {isOtherTyping && (
          <div className="shrink-0 px-[18px] pb-2">
            <div className="msg-bubble-in msg-typing-dots inline-flex gap-1 px-3.5 py-2.5">
              <span /><span /><span />
            </div>
          </div>
        )}
        <MessageInput
          input={input}
          handleInputChange={handleInputChange}
          sending={sending}
          handleSend={handleSend}
          dragActive={dragActive}
          setDragActive={setDragActive}
          inputRowRef={inputRowRef}
          openDrawer={openDrawer}
          imageInputRef={imageInputRef}
          videoInputRef={videoInputRef}
          drawerVisible={drawerVisible}
          drawerPosition={drawerPosition}
          drawerRef={drawerRef}
          drawerReady={drawerReady}
          drawerOpen={drawerOpen}
          closeDrawer={closeDrawer}
          ANIMATION_DURATION={ANIMATION_DURATION}
          isOtherUserCreator={isOtherUserCreator}
          setIsTipModalOpen={setIsTipModalOpen}
          isCurrentUserCreator={isCurrentUserCreator}
          setIsPPVModalOpen={setIsPPVModalOpen}
          isPPVModalOpen={isPPVModalOpen}
          PPVMessage={PPVMessage}
          setPPVMessage={setPPVMessage}
          PPVPrice={PPVPrice}
          setPPVPrice={setPPVPrice}
          ppvDraftChipLabel={ppvDraftChipLabel}
        />
      </div>
      <Lightbox
          open={lightboxOpen}
          close={() => setLightboxOpen(false)}
          slides={mediaItems}
          index={selectedImageIndex}
          plugins={[Zoom, Thumbnails]}
          carousel={{ finite: true }}
          controller={{ closeOnBackdropClick: true }}
        />
        {otherProfile && (
          <CallModal
            isOpen={showCallModal}
            onClose={() => setShowCallModal(false)}
            creatorId={otherProfile.id}
            personalityPrompt={creatorPersonalityPrompt}
            elevenVoiceId={creatorVoiceId}
            isDemo={isOtherCreatorDemo}
          />
        )}
      {otherProfile && (
        <TipModal
          isOpen={isTipModalOpen}
          onClose={() => setIsTipModalOpen(false)}
          creatorId={otherProfile.id}
          isDemo={isOtherCreatorDemo}
          onTipSuccess={async (amount) => {
              const formattedAmount = (amount / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              
              // Create tip notification
              try {
                if (profile?.username) {
                  await createTipNotification({
                    creatorId: otherProfile.id,
                    tipperId: profile.id,
                    tipperUsername: profile.username,
                    amount: amount / 100, // Convert cents to dollars
                    postId: undefined // No post for direct message tips
                  });
                }
              } catch (notificationError) {
                console.error('Failed to create tip notification:', notificationError);
                // Don't show error to user as the tip was successful
              }

              const tipContent = `###TIP ${formattedAmount}`;
              const { data: msg, error } = await supabase
                .from('messages')
                .insert({
                  conversation_id: convId,
                  sender_id: profile?.id,
                  content: tipContent,
                })
                .select()
                .single();

              if (error) {
                console.error('Error sending tip message:', error);
                return;
              }

              if (msg) {
                setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
                await supabase
                  .from('conversations')
                  .update({
                    last_message_id: msg.id,
                    last_message_at: msg.created_at,
                  })
                  .eq('id', convId);

                if (isAIDMEnabled && otherProfile) {
                  void triggerAiDmResponse(tipContent);
                }
              }
            }}
          />
        )}
        {/* PPV Modal for creators */}
        <Dialog open={isPPVModalOpen} onOpenChange={open => {
          if (!open) setIsPPVModalOpen(false);
          if (open) setPPVPriceInput(PPVPrice ? (PPVPrice / 100).toFixed(2) : '');
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Activate PPV for Next Media</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label htmlFor="ppv-price" className="text-sm font-medium">Price (USD)</label>
                <Input
                  id="ppv-price"
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={PPVPriceInput}
                  onChange={e => {
                    setPPVPriceInput(e.target.value);
                    const value = parseFloat(e.target.value);
                    if (!isNaN(value) && value >= 0.01) {
                      setPPVPrice(Math.round(value * 100));
                    } else {
                      setPPVPrice(0);
                    }
                  }}
                  placeholder="Enter price in dollars"
                />
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  setIsPPVModalOpen(false);
                  setPPVMessage(true);
                }}
                disabled={PPVPrice < 1}
              >
                Activate PPV
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        {unlockingPPVMessageId && (
          <PPVModal
            isOpen={!!unlockingPPVMessageId}
            onClose={() => setUnlockingPPVMessageId(null)}
            isMessage={true}
            messageId={unlockingPPVMessageId}
            priceCents={messages.find(m => m.id === unlockingPPVMessageId)?.PPV_price || 0}
            onPaymentSuccess={async () => {
              // Refetch the unlocked message
              const { data: updatedMsg } = await supabase
                .from('messages')
                .select('*')
                .eq('id', unlockingPPVMessageId)
                .single();
              if (updatedMsg) {
                setMessages(prevMsgs => prevMsgs.map(m => m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m));
              }
              setUnlockingPPVMessageId(null);
          }}
        />
      )}
    </>
  );
} 