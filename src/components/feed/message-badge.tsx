'use client';

import { useRouter } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUser } from '@/lib/contexts/user-context';

export function MessageBadge({ className = '' }: { className?: string }) {
  const { hasUnreadMessages } = useUser();
  const router = useRouter();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => router.push('/messages')}
      className={`relative ${className}`}
    >
      <MessageCircle className="h-5 w-5" />
      {hasUnreadMessages && (
        <span
          className="absolute -top-1 -right-1 h-2 w-2 animate-pulse rounded-full border-2 border-background"
          style={{ background: 'var(--brand-pink)' }}
        />
      )}
    </Button>
  );
}
