'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/contexts/user-context';

interface RequireAuthProps {
  children: React.ReactNode;
  allowAnonymous?: boolean;
}

export function RequireAuth({ children, allowAnonymous = false }: RequireAuthProps) {
  const router = useRouter();
  const { session, isLoading } = useUser();

  useEffect(() => {
    if (!isLoading && !session && !allowAnonymous) {
      router.push('/');
    }
  }, [session, isLoading, router, allowAnonymous]);

  // While auth is resolving, render children — they show their own skeletons.
  // This keeps the full app shell visible and avoids a jarring spinner overlay.
  if (isLoading) {
    return <>{children}</>;
  }

  if (allowAnonymous || session) {
    return <>{children}</>;
  }

  // Unauthenticated and not anonymous — redirecting to landing page.
  return null;
}
