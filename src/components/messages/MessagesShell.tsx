'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { Plus, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Profile } from '@/lib/types';
import { ConversationsList } from '@/components/messages/ConversationsList';
import { MessagesThemeToggle } from '@/components/messages/messages-theme-toggle';
import { useUser } from '@/lib/contexts/user-context';
import { cn } from '@/lib/utils';

export function MessagesShell({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const { session, profile, isLoading } = useUser();
  const [newConversationActive, setNewConversationActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [matchingProfiles, setMatchingProfiles] = useState<Profile[]>([]);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [blockedLoaded, setBlockedLoaded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isThreadRoute = /^\/messages\/[^/]+$/.test(pathname);
  const mobilePane = isThreadRoute ? 'show-thread' : 'show-list';

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

  const handleStartConversation = async (targetProfile: Profile) => {
    if (!targetProfile || !session) return;
    const client = createClient();
    const { data: existingConvs, error } = await client
      .from('conversation_participants')
      .select('conversation_id, conversation:conversations(is_group, participants:conversation_participants(user_id))')
      .eq('user_id', targetProfile.id);
    if (!error && existingConvs) {
      for (const row of existingConvs) {
        const conv = Array.isArray(row.conversation) ? row.conversation[0] : row.conversation;
        if (!conv || Array.isArray(conv)) continue;
        if (!conv.is_group && conv.participants && conv.participants.length === 2) {
          const hasOther = conv.participants.some((p: { user_id: string }) => p.user_id === targetProfile.id);
          if (hasOther) {
            setNewConversationActive(false);
            setSearchQuery('');
            setMatchingProfiles([]);
            router.push(`/messages/${row.conversation_id}`);
            return;
          }
        }
      }
    }
    const newConversationId = crypto.randomUUID();
    const { error: convError } = await client
      .from('conversations')
      .insert({ id: newConversationId, is_group: false });
    if (convError) {
      console.error('Error creating conversation:', convError);
      return;
    }
    const { error: currentParticipantError } = await client
      .from('conversation_participants')
      .insert({ conversation_id: newConversationId, user_id: session.user.id });
    if (currentParticipantError) {
      console.error('Error adding current conversation participant:', currentParticipantError);
      return;
    }
    const { error: otherParticipantError } = await client
      .from('conversation_participants')
      .insert({ conversation_id: newConversationId, user_id: targetProfile.id });
    if (otherParticipantError) {
      console.error('Error adding other conversation participant:', otherParticipantError);
      return;
    }
    setNewConversationActive(false);
    setSearchQuery('');
    setMatchingProfiles([]);
    router.push(`/messages/${newConversationId}`);
  };

  useEffect(() => {
    let isMounted = true;
    setBlockedLoaded(false);
    fetchBlockedUsers(isMounted);
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    const searchUsers = async () => {
      if (!newConversationActive || !searchQuery.trim()) {
        setMatchingProfiles([]);
        return;
      }

      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .or(`username.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`)
        .neq('id', profile?.id)
        .limit(5);

      if (error) {
        console.error('Error searching users:', error);
        return;
      }

      let filteredProfiles = profiles || [];
      if (blockedUserIds.length > 0) {
        filteredProfiles = filteredProfiles.filter(p => !blockedUserIds.includes(p.id));
      }

      setMatchingProfiles(filteredProfiles);
    };

    if (blockedLoaded) {
      const debounceTimer = setTimeout(searchUsers, 300);
      return () => clearTimeout(debounceTimer);
    }
  }, [searchQuery, profile?.id, supabase, blockedUserIds, blockedLoaded, newConversationActive]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center flex-1 min-h-0">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <main className={cn('page-shell msg-page flex flex-col flex-1 min-h-0 h-full w-full bg-background', mobilePane)}>
      {/* 1. Page header — title, search, new chat, theme (Dim PageHead) */}
      <header
        className="msg-page-header page-header relative flex shrink-0 items-center gap-2 min-h-[56px] px-4 py-3 z-20 border-b border-border backdrop-blur-[18px] [-webkit-backdrop-filter:blur(18px)] md:gap-3 md:px-6 md:py-3.5"
        style={{ background: 'color-mix(in oklch, var(--background) 78%, transparent)' }}
      >
        <h1 className="font-display text-lg tracking-tight shrink-0 md:text-[21px]">Messages</h1>

        <div className="min-w-0 flex-1" />

        <div className="relative w-[168px] shrink-0 sm:w-[200px] md:w-[220px]">
          <label className="msg-search-pill w-full">
            <Search size={17} className="text-muted-foreground shrink-0" aria-hidden />
            <input
              ref={searchInputRef}
              type="search"
              placeholder={
                newConversationActive
                  ? 'Search users to start a conversation…'
                  : 'Search messages'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>
          {newConversationActive && matchingProfiles.length > 0 && (
            <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 border border-border rounded-[14px] bg-card shadow-lg max-h-60 overflow-y-auto">
              {matchingProfiles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-secondary transition-colors text-left first:rounded-t-[14px] last:rounded-b-[14px]"
                  onClick={() => handleStartConversation(p)}
                >
                  {p.avatar_url ? (
                    <Image
                      src={p.avatar_url}
                      width={40}
                      height={40}
                      className="rounded-full w-10 h-10 object-cover shrink-0"
                      alt={p.full_name || p.username || 'User'}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-bold shrink-0 border border-border">
                      {(p.full_name || p.username || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-bold text-sm truncate">{p.full_name || p.username}</div>
                    <div className="text-xs text-muted-foreground truncate">@{p.username}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-10 w-10 shrink-0 rounded-full',
            newConversationActive && 'bg-secondary ring-1 ring-[var(--brand-pink)]/30'
          )}
          onClick={() => {
            setNewConversationActive((v) => !v);
            setSearchQuery('');
            setMatchingProfiles([]);
            setTimeout(() => searchInputRef.current?.focus(), 50);
          }}
          aria-label="New Conversation"
        >
          <Plus
            size={17}
            className={newConversationActive ? 'text-[var(--brand-pink)]' : 'text-muted-foreground'}
          />
        </Button>

        <MessagesThemeToggle />
      </header>

      {/* 2. Sidebar (list) + 3. Main bar (thread) */}
      <div className={cn('msg-wrap', mobilePane)}>
        <aside className="msg-list" aria-label="Conversations">
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain pb-16 md:pb-2">
            {session && profile && (
              <ConversationsList searchQuery={newConversationActive ? '' : searchQuery} />
            )}
          </div>
        </aside>

        <div className="msg-thread">
          {children}
        </div>
      </div>
    </main>
  );
}
