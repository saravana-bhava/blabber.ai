'use client';

import { MessageSquare } from 'lucide-react';

export function MessagesEmptyThread() {
  return (
    <div className="hidden md:flex flex-1 flex-col items-center justify-center text-muted-foreground p-8 min-h-0">
      <div
        className="w-20 h-20 mb-5 rounded-[22px] flex items-center justify-center border border-border"
        style={{ background: 'var(--brand-grad-soft)' }}
      >
        <MessageSquare size={32} className="text-muted-foreground opacity-80" />
      </div>
      <p className="font-bold text-foreground text-base">Select a conversation</p>
      <p className="text-[13px] mt-1.5 text-center max-w-[280px]">
        Choose from your existing chats or tap + to start a new one.
      </p>
    </div>
  );
}
