"use client";

import { useEffect, useState, useRef, useMemo, useCallback, memo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import { Profile } from '@/lib/types';
import { ConversationsListSkeleton } from './ConversationsListSkeleton';
import { useUser } from '@/lib/contexts/user-context';
import Image from 'next/image';
import { DollarSign, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatMessagePreview } from '@/lib/utils/format-message-content';

interface ConversationsListProps {
  searchQuery?: string;
}

interface Conversation {
  id: string;
  is_group: boolean;
  name: string | null;
  last_message_id: string | null;
  last_message_at: string | null;
  participants: Profile[];
  last_message: {
    id: string;
    content: string | null;
    media_url: string | null;
    media_type: string | null;
    created_at: string;
    sender_id: string;
    isPPV?: boolean;
  } | null;
  unread: boolean;
  typing?: boolean;
}

function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getPreviewText(conv: Conversation): { text: string; isTip: boolean; isPpv: boolean } {
  const content = conv.last_message?.content;
  if (content?.startsWith('###TIP ')) {
    const amount = content.split(' ')[1];
    return { text: `Sent you a $${amount} tip!`, isTip: true, isPpv: false };
  }
  const isPpv = !!(conv.last_message?.isPPV && conv.last_message?.media_url);
  if (content) return { text: formatMessagePreview(content), isTip: false, isPpv };
  if (conv.last_message?.media_type) {
    return { text: `[${conv.last_message.media_type}]`, isTip: false, isPpv };
  }
  return { text: 'No messages yet', isTip: false, isPpv };
}

const ConversationItem = memo(({ 
  conv, 
  profile, 
  isTyping, 
  isActive,
  onClick 
}: { 
  conv: Conversation; 
  profile: Profile; 
  isTyping: boolean;
  isActive: boolean;
  onClick: () => void;
}) => {
  const other = conv.participants[0];
  const showUnread = conv.unread && conv.last_message?.sender_id !== profile.id;
  const preview = getPreviewText(conv);

  return (
    <button
      type="button"
      className="msg-convo-item"
      data-active={isActive}
      onClick={onClick}
    >
      {other?.avatar_url ? (
        <Image
          src={other.avatar_url}
          width={48}
          height={48}
          className="rounded-full w-12 h-12 object-cover shrink-0"
          alt={other.full_name || "User"}
        />
      ) : (
        <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-base font-bold shrink-0 border border-border">
          {(other?.full_name || other?.username || "U").charAt(0).toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="font-bold text-sm truncate">
            {other?.full_name || other?.username || "User"}
          </span>
          <span className="flex-1" />
          <span className="text-[11.5px] text-muted-foreground shrink-0">
            {conv.last_message?.created_at ? formatMessageTime(conv.last_message.created_at) : ''}
          </span>
        </div>
        <div className={cn(
          "text-[13px] mt-0.5 flex items-center gap-1.5 min-w-0",
          showUnread ? "font-semibold text-foreground" : "text-muted-foreground font-normal"
        )}>
          {isTyping ? (
            <span className="text-[var(--brand-pink)] italic">typing…</span>
          ) : (
            <>
              {preview.isTip && (
                <DollarSign size={12} className="text-[var(--brand-gold)] shrink-0" />
              )}
              {preview.isPpv && (
                <Lock size={11} className="text-[var(--brand-pink)] shrink-0" />
              )}
              <span className="truncate">{preview.text}</span>
            </>
          )}
        </div>
      </div>
      {showUnread && <span className="msg-unread-dot" aria-label="Unread" />}
    </button>
  );
});

ConversationItem.displayName = 'ConversationItem';

export function ConversationsList({ searchQuery }: ConversationsListProps) {
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [typingMap, setTypingMap] = useState<Record<string, boolean>>({});
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [blockedLoaded, setBlockedLoaded] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useRef(createClient()).current;
  const { profile } = useUser();
  const profileRef = useRef<Profile | null>(profile);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  async function fetchBlockedUsers(isMounted = true) {
    if (profile?.id) {
      const { data: blocked, error: blockedError } = await supabase
        .from('blocked_users')
        .select('blockee_profile_id')
        .eq('blocker_profile_id', profile.id);
      if (!blockedError && blocked && isMounted) {
        setBlockedUserIds(blocked.map((b: { blockee_profile_id: string }) => b.blockee_profile_id));
      } else if (isMounted) {
        setBlockedUserIds([]);
      }
    } else if (isMounted) {
      setBlockedUserIds([]);
    }
    if (isMounted) setBlockedLoaded(true);
  }

  const fetchConversations = useCallback(async (isInitialLoad = true) => {
    const currentProfile = profileRef.current;
    if (!currentProfile) return;
    if (isInitialLoad) {
      setInitialLoading(true);
    }
    try {
      const { data: participantRows, error: participantError } = await supabase
        .from('conversation_participants')
        .select('conversation_id, last_read_message_id, is_typing, conversation:conversations(*)')
        .eq('user_id', currentProfile.id);
      if (participantError || !participantRows) {
        setConversations([]);
        return;
      }
      const convIds = participantRows.map((r) => (r.conversation as any).id);

      // Batch-fetch all participants and last messages in two queries instead of 2×N.
      const [{ data: allParticipants }, { data: allMessages }] = await Promise.all([
        supabase
          .from('conversation_participants')
          .select('conversation_id, user_id, profiles:profiles(*)')
          .in('conversation_id', convIds),
        supabase
          .from('messages')
          .select('*')
          .in('id', participantRows
            .map((r) => (r.conversation as any).last_message_id)
            .filter(Boolean)),
      ]);

      const participantsByConv = new Map<string, any[]>();
      for (const p of allParticipants || []) {
        const list = participantsByConv.get(p.conversation_id) || [];
        list.push(p);
        participantsByConv.set(p.conversation_id, list);
      }

      const messagesById = new Map<string, any>();
      for (const m of allMessages || []) {
        messagesById.set(m.id, m);
      }

      const convs: Conversation[] = [];
      for (const row of participantRows) {
        const conv = row.conversation as any;
        const participants = participantsByConv.get(conv.id) || [];
        let otherParticipants = participants
          .filter((p) => p.user_id !== currentProfile.id)
          .map((p) => p.profiles);

        if (blockedUserIds.length > 0) {
          otherParticipants = otherParticipants.filter(p => !blockedUserIds.includes(p.id));
        }

        if (otherParticipants.length === 0) {
          continue;
        }

        const lastMessage = conv.last_message_id ? (messagesById.get(conv.last_message_id) ?? null) : null;
        const unread = row.last_read_message_id !== conv.last_message_id && !!conv.last_message_id;
        convs.push({
          id: conv.id,
          is_group: conv.is_group,
          name: conv.name,
          last_message_id: conv.last_message_id,
          last_message_at: conv.last_message_at,
          participants: otherParticipants,
          last_message: lastMessage,
          unread,
        });
      }
      setConversations(convs);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setConversations([]);
    } finally {
      if (isInitialLoad) {
        setInitialLoading(false);
      }
    }
  }, [supabase, blockedUserIds]);

  useEffect(() => {
    let isMounted = true;
    setBlockedLoaded(false);
    fetchBlockedUsers(isMounted);
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    const currentProfile = profileRef.current;
    if (currentProfile && blockedLoaded) {
      fetchConversations(true);
    }
  }, [fetchConversations, blockedLoaded]);

  useEffect(() => {
    const currentProfile = profileRef.current;
    if (!conversations || !currentProfile) return;
    const fetchTypingStates = async () => {
      const ids = conversations.map(c => c.id);
      if (ids.length === 0) return;
      const { data: participants } = await supabase
        .from('conversation_participants')
        .select('conversation_id, user_id, is_typing')
        .in('conversation_id', ids);
      const typingMapInit: Record<string, boolean> = {};
      ids.forEach(id => {
        typingMapInit[id] = (participants || []).some((p: { conversation_id: string; user_id: string; is_typing: boolean }) => p.conversation_id === id && p.user_id !== currentProfile.id && p.is_typing);
      });
      setTypingMap(typingMapInit);
    };
    fetchTypingStates();
  }, [conversations, supabase]);

  useEffect(() => {
    const currentProfile = profileRef.current;
    if (!currentProfile) return;
    const channel = supabase.channel('conversations-typing')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversation_participants',
      }, async (payload) => {
        const { conversation_id } = payload.new as { conversation_id: string };
        const { data: participants } = await supabase
          .from('conversation_participants')
          .select('user_id, is_typing')
          .eq('conversation_id', conversation_id);
        const someoneTyping = (participants || []).some((p: { user_id: string; is_typing: boolean }) => p.user_id !== currentProfile.id && p.is_typing);
        setTypingMap((prev) => ({ ...prev, [conversation_id]: someoneTyping }));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  useEffect(() => {
    const channel = supabase.channel('conversations-updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversations',
      }, async (payload) => {
        const updatedId = payload.new.id as string;
        if ((payload.new as { last_message_id: string }).last_message_id !== (payload.old as { last_message_id: string }).last_message_id) {
          const { data: msg } = await supabase
            .from('messages')
            .select('*')
            .eq('id', (payload.new as { last_message_id: string }).last_message_id)
            .single();
          
          if (!msg) return;

          setConversations((prev) => {
            if (!prev) return prev;
            const convIndex = prev.findIndex(c => c.id === updatedId);
            if (convIndex === -1) return prev;

            const updated = [...prev];
            updated[convIndex] = {
              ...updated[convIndex],
              last_message_id: (payload.new as { last_message_id: string }).last_message_id,
              last_message_at: (payload.new as { last_message_at: string }).last_message_at,
              last_message: msg,
              unread: updated[convIndex].last_message_id !== (payload.new as { last_message_id: string }).last_message_id && !!(payload.new as { last_message_id: string }).last_message_id,
            };
            return updated;
          });
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const filteredConversations = useMemo(() => {
    if (!conversations) return null;
    let filtered = conversations;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = conversations.filter(conv =>
        conv.participants.some(
          p =>
            (p.full_name && p.full_name.toLowerCase().includes(q)) ||
            (p.username && p.username.toLowerCase().includes(q))
        )
      );
    }
    return filtered.sort((a, b) => {
      const timeA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const timeB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return timeB - timeA;
    });
  }, [conversations, searchQuery]);

  if (initialLoading) {
    return <ConversationsListSkeleton />;
  }

  const currentProfile = profileRef.current;
  if (!currentProfile) {
    return null;
  }

  if (!filteredConversations || filteredConversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-muted-foreground py-20 px-6">
        <div
          className="w-20 h-20 mb-5 rounded-[22px] flex items-center justify-center border border-border"
          style={{ background: 'var(--brand-grad-soft)' }}
        >
          <span className="text-3xl">💬</span>
        </div>
        <p className="text-base font-bold text-foreground">No conversations yet</p>
        <p className="text-[13px] mt-1.5 text-center max-w-[260px]">
          Tap + to start a new chat and your messages will show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {filteredConversations.map((conv) => (
        <ConversationItem
          key={conv.id}
          conv={conv}
          profile={currentProfile}
          isTyping={typingMap[conv.id]}
          isActive={pathname === `/messages/${conv.id}`}
          onClick={() => router.push(`/messages/${conv.id}`)}
        />
      ))}
    </div>
  );
}
