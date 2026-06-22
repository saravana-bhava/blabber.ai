'use client';

// All work on this route happens client-side (auth, form state, Mux/Supabase
// uploads). Forcing a static shell means GET /new-post is served from the
// Vercel CDN edge instead of invoking a serverless function, which sidesteps
// the 4.5 MB function payload limit that has been intermittently rejecting
// hard navigations to this page with `FUNCTION_PAYLOAD_TOO_LARGE` (413).
export const dynamic = 'force-static';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/lib/contexts/user-context';

import { Button } from "@/components/ui/button";
import { NewPost } from '@/components/feed/NewPost';
import { NewPostSkeleton } from '@/components/feed/NewPostSkeleton';
import { PageShell } from '@/components/layout/page-header';
import { RequireAuth } from '@/components/auth/require-auth';

function NewPostWithOptionalGalleryImage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const galleryImageId = searchParams.get('galleryImage');

  const handleGalleryConsumed = useCallback(() => {
    router.replace('/new-post');
  }, [router]);

  return (
    <NewPost
      onPostSuccess={() => router.push('/home')}
      initialGalleryImageId={galleryImageId}
      onGalleryImageConsumed={handleGalleryConsumed}
    />
  );
}

export default function NewPostPage() {
  const supabase = createClient();
  const router = useRouter();
  const { session, profile: userProfile, isLoading } = useUser();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const getSessionAndProfile = async () => {
      setLoading(true);

      if (!session) {
        if (mounted) {
          setLoading(false);
          router.push('/');
        }
        return;
      }

      if (mounted) setLoading(false);
    };

    getSessionAndProfile();
    
    return () => {
      mounted = false;
    };
  }, [supabase, router, session]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (loading && !userProfile) {
    return (
      <main className="min-h-screen bg-background relative p-4 md:p-6">
          <h1 className="text-2xl font-bold mb-6">Create New Post</h1>
      </main>
    );
  }

  return (
    <RequireAuth>
      <PageShell title="New Post" subtitle="Create something for your fans">
        <div className="pb-16">
          {session && userProfile ? (
            <Suspense fallback={<NewPostSkeleton />}>
              <NewPostWithOptionalGalleryImage />
            </Suspense>
          ) : (
            <div className="text-center text-muted-foreground p-4">
              Please sign in to create a post.
            </div>
          )}
        </div>
      </PageShell>
    </RequireAuth>
  );
}
