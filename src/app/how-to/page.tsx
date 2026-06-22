'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

import { SideNav } from '@/components/layout/sidenav';
import { SuggestionsSidebar } from '@/components/layout/suggestions-sidebar';
import { SideNavSkeleton } from '@/components/layout/sidenav-skeleton';
import { SuggestionsSidebarSkeleton } from '@/components/layout/suggestions-sidebar-skeleton';
import { PageHeader } from '@/components/layout/page-header';
import { useUser } from '@/lib/contexts/user-context';
import { RequireAuth } from '@/components/auth/require-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WalkthroughVideo } from '@/components/how-to/WalkthroughVideo';
import { Zap, Video, HelpCircle } from 'lucide-react';

export default function HowToPage() {
  const supabase = createClient();
  const router = useRouter();
  const { session, profile, isLoading } = useUser();
  const [accessChecked, setAccessChecked] = useState(false);

  useEffect(() => {
    if (isLoading || !profile?.id) return;

    let cancelled = false;
    (async () => {
      const { data: creator } = await supabase
        .from('creators')
        .select('veriff_verification_status')
        .eq('profile_id', profile.id)
        .maybeSingle();

      if (cancelled) return;

      if (creator?.veriff_verification_status === 'completed') {
        router.replace('/creator-how-to');
        return;
      }

      setAccessChecked(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoading, profile?.id, router, supabase]);

  const faqs = [
    {
      q: 'What are credits?',
      a: 'Credits are the in-app currency for AI features — voice calls with creator AI twins, AI messages, and image generation. Buy more anytime from the pink credits badge in the sidebar.',
    },
    {
      q: 'How do I find and follow creators?',
      a: 'Use Search to browse creators. Open any profile to follow, subscribe, send a message, or start an AI voice call.',
    },
    {
      q: 'What is the Marketplace?',
      a: 'Creators sell digital products, exclusive drops, and bundles in the Marketplace — their own storefront on Blabber.',
    },
    {
      q: 'Can I become a creator too?',
      a: 'Yes. Tap Become a Creator in the sidebar to apply. You will watch a short overview, review earnings examples, accept the creator agreement, and complete identity verification.',
    },
  ];

  const quickStartTips = [
    'Buy credits from the badge in the sidebar before your first AI call.',
    'Use Search to discover creators and follow the ones you like.',
    'Check Messages for direct chats — some use the creator’s AI twin.',
    'Browse the Marketplace for exclusive products and drops.',
    'Tap the phone icon on a creator profile to try an AI voice call.',
  ];

  if (!accessChecked && !isLoading && profile?.id) {
    return (
      <RequireAuth>
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-pink-500 border-t-transparent" />
        </div>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth>
      <div className="flex min-h-screen bg-background">
        {isLoading ? (
          <SideNavSkeleton />
        ) : session && profile ? (
          <SideNav />
        ) : (
          <SideNavSkeleton />
        )}

        <main className="flex-1 md:ml-64 lg:mr-72">
          <PageHeader title="How to Use Blabber" />

          <div className="p-4 max-w-4xl mx-auto space-y-8">
            <div className="mb-6">
              <h1 className="text-3xl font-bold mb-2">Getting started on Blabber</h1>
              <p className="text-muted-foreground">
                Credits, discovering creators, messages, the marketplace, AI calls, and how to
                become a creator — everything you need as a fan.
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="h-5 w-5" />
                  Welcome to Blabber
                </CardTitle>
                <CardDescription>
                  A quick walkthrough of Blabber for new users: credits, finding creators,
                  messaging, the marketplace, AI calls, and the creator signup flow.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <WalkthroughVideo className="max-w-3xl mx-auto" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Quick-start tips
                </CardTitle>
                <CardDescription>Short checklist to get the most out of Blabber.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {quickStartTips.map((tip, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="text-muted-foreground shrink-0">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5" />
                  FAQ
                </CardTitle>
                <CardDescription>Common questions about using Blabber as a fan.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {faqs.map((faq, i) => (
                  <div
                    key={i}
                    className="border-b border-border last:border-0 last:pb-0 pb-4 last:pb-0"
                  >
                    <p className="font-medium mb-1">{faq.q}</p>
                    <p className="text-muted-foreground text-sm">{faq.a}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </main>

        {isLoading ? (
          <SuggestionsSidebarSkeleton />
        ) : (
          <SuggestionsSidebar />
        )}
      </div>
    </RequireAuth>
  );
}
