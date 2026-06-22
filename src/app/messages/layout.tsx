import { MessagesShell } from '@/components/messages/MessagesShell';
import { RequireAuth } from '@/components/auth/require-auth';

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <MessagesShell>{children}</MessagesShell>
    </RequireAuth>
  );
}
