'use client';

import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';

import { FeedItem } from '@/components/feed/FeedItem';
import { FeedItemShort } from '@/components/feed/FeedItemShort';
import { FeedItemSkeleton } from '@/components/feed/FeedItemSkeleton';
import { useUser } from '@/lib/contexts/user-context';
import { RequireAuth } from '@/components/auth/require-auth';
import { Post } from '@/lib/types';
import { AgeVerificationModal } from '@/components/auth/AgeVerificationModal';

export default function PostPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const postId = params.postId as string;
  const { session, profile, isLoading } = useUser();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAgeVerificationOpen, setIsAgeVerificationOpen] = useState(false);
  const [hasVerifiedAge, setHasVerifiedAge] = useState(false);

  const isAuthenticated = session;

  const handleAgeVerification = () => {
    setHasVerifiedAge(true);
    setIsAgeVerificationOpen(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  useEffect(() => {
    if (!postId) {
      setError('Post ID is required');
      setLoading(false);
      return;
    }

    const fetchPost = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        let query = supabase
          .from('posts')
          .select(`
            *,
            profiles:user_id (
              id,
              username,
              full_name,
              avatar_url,
              bio
            ),
            post_media (
              id,
              media_type,
              storage_path,
              mux_playback_id,
              metadata,
              order_index
            ),
            quiz_attempts (
              id,
              selected_option_id,
              is_correct,
              attempted_at
            )
          `)
          .eq('id', postId)
          .single();

        const { data, error } = await query;

        if (error) {
          console.error('Error fetching post:', error);
          setError('Post not found');
          setLoading(false);
          return;
        }

        if (!data) {
          setError('Post not found');
          setLoading(false);
          return;
        }

        // If user is authenticated, fetch additional data
        if (user) {
          // Fetch like status
          const { data: likeData } = await supabase
            .from('post_likes')
            .select('id')
            .eq('post_id', postId)
            .eq('user_id', user.id)
            .maybeSingle();

          // Fetch bookmark status
          const { data: bookmarkData } = await supabase
            .from('post_bookmarks')
            .select('id')
            .eq('post_id', postId)
            .eq('user_id', user.id)
            .maybeSingle();

          // Add user interaction data to post
          data.user_has_liked = !!likeData;
          data.user_has_bookmarked = !!bookmarkData;
        } else {
          data.user_has_liked = false;
          data.user_has_bookmarked = false;
        }

        setPost(data);
      } catch (err) {
        console.error('Error fetching post:', err);
        setError('Failed to load post');
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [postId]);

  // Reset age verification when viewing a different post
  useEffect(() => {
    setHasVerifiedAge(false);
    setIsAgeVerificationOpen(false);
  }, [postId]);

  // Show age verification for unauthenticated users
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !hasVerifiedAge) {
      setIsAgeVerificationOpen(true);
    }
  }, [isLoading, isAuthenticated, hasVerifiedAge, postId]);

  const handlePostDelete = () => {
    // Redirect to home page after post deletion
    router.push('/home');
  };

  if (loading) {
    return (
      <RequireAuth allowAnonymous>
        <main className="min-h-screen bg-background">
          <header className="flex justify-between items-center mb-0 h-10 p-4 py-6 sticky top-0 bg-background/80 backdrop-blur-md z-10 border-b border-border/60 supports-[height:100dvh]:top-0">
            <Image 
              src="/logo.png" 
              alt="Blabber AI Logo" 
              width={130} 
              height={30} 
              className="object-contain cursor-pointer"
              onClick={() => router.push('/home')}
            />
          </header>
          <div className="flex items-center justify-center min-h-screen">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </main>
      </RequireAuth>
    );
  }

  if (error || !post) {
    return (
      <RequireAuth allowAnonymous>
        <main className="min-h-screen bg-background">
          <header className="flex justify-between items-center mb-0 h-10 p-4 py-6 sticky top-0 bg-background/80 backdrop-blur-md z-10 border-b border-border/60 supports-[height:100dvh]:top-0">
            <Image 
              src="/logo.png" 
              alt="Blabber AI Logo" 
              width={130} 
              height={30} 
              className="object-contain cursor-pointer"
              onClick={() => router.push('/home')}
            />
          </header>
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-2">Post Not Found</h1>
              <p className="text-muted-foreground mb-4">{error}</p>
              <button 
                onClick={() => router.push('/home')}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                Go Home
              </button>
            </div>
          </div>
        </main>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth allowAnonymous>
      <main className="min-h-screen bg-background">
        <header className="flex justify-between items-center mb-0 h-10 p-4 py-6 sticky top-0 bg-background/80 backdrop-blur-md z-10 border-b border-border/60">
          <Image 
            src="/logo.png" 
            alt="Blabber AI Logo" 
            width={130} 
            height={30} 
            className="object-contain cursor-pointer"
            onClick={() => router.push('/home')}
          />
        </header>
        <div className="p-0">
          {(post.content_type as string) === 'short' ? (
            <FeedItemShort 
              post={post} 
              onPostDelete={handlePostDelete}
              shouldPlay={true}
              shouldRender={true}
            />
          ) : (
            <FeedItem 
              post={post} 
              onPostDelete={handlePostDelete}
            />
          )}
        </div>
      </main>
      <AgeVerificationModal
        isOpen={isAgeVerificationOpen}
        onClose={() => setIsAgeVerificationOpen(false)}
        onVerified={handleAgeVerification}
      />
    </RequireAuth>
  );
} 