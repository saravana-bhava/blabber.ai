'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/lib/contexts/user-context';
import { ShieldCheck, Sparkles } from 'lucide-react';

import { Profile } from '@/lib/types';
import { markCreatorTourPending } from '@/components/onboarding/CreatorTour';
import { PageShell } from '@/components/layout/page-header';
import { RequireAuth } from '@/components/auth/require-auth';
import { Button } from '@/components/ui/button';
import { AdminGradButton, AdminPill } from '@/components/admin/admin-ui';
import {
  OnboardingAgreement,
  OnboardingAgreementSection,
  OnboardingErrorState,
  OnboardingHero,
  OnboardingLoadingState,
  OnboardingStepCard,
  OnboardingVeriffRedirect,
  OnboardingVideoPlaceholder,
} from '@/components/onboarding/onboarding-ui';

export interface Creator {
  profile_id: string;
  veriff_session_id?: string | null;
  veriff_verification_status: 'not_started' | 'in_progress' | 'completed' | 'rejected';
  can_monetize: boolean;
  application_notes?: string | null;
  created_at: string;
  updated_at: string;
  subscription_tier_enabled: boolean;
  subscription_price_cents?: number | null;
  subscription_interval?: 'day' | 'week' | 'month' | 'year' | null;
  payment_provider?: string | null;
  generic_account_id?: string | null;
  generic_product_id?: string | null;
  generic_price_id?: string | null;
  solana_address?: string | null;
  ethereum_address?: string | null;
  polygon_address?: string | null;
  bitcoin_address?: string | null;
  bank_account_number?: string | null;
  bank_routing_number?: string | null;
  veriff_estimated_age?: number | null;
  veriff_verification_results?: unknown | null;
}

export default function BecomeACreatorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-pink-500 border-t-transparent" />
        </div>
      }
    >
      <BecomeACreatorPageInner />
    </Suspense>
  );
}

function BecomeACreatorPageInner() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, profile: userProfile, isLoading: isUserLoading } = useUser();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [isCreatorLoading, setIsCreatorLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showVideoStep, setShowVideoStep] = useState(false);
  const [showEarningsStep, setShowEarningsStep] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [showOnboardingComponent, setShowOnboardingComponent] = useState(false);
  const [showIntroVerifyPreview, setShowIntroVerifyPreview] = useState(false);

  const handleVeriffError = useCallback((message: string) => {
    setError(`Verification Error: ${message}`);
    setShowAgreement(false);
    setShowOnboardingComponent(false);
    setActionLoading(false);
  }, []);

  const fetchCreatorData = useCallback(
    async (showGlobalLoader = true) => {
      if (!userProfile?.id) return;

      if (showGlobalLoader) {
        setIsCreatorLoading(true);
        setError(null);
      }

      try {
        const { data, error: dbError } = await supabase
          .from('creators')
          .select('*')
          .eq('profile_id', userProfile.id)
          .maybeSingle();

        if (dbError) {
          console.error('Supabase error:', dbError);
          throw new Error(dbError.message);
        }

        if (data?.veriff_verification_status === 'completed') {
          if (userProfile.id) markCreatorTourPending(userProfile.id);
          router.push('/creator-settings?onboarding_complete=1');
          return;
        }

        if (data?.veriff_verification_status === 'in_progress' && !showOnboardingComponent) {
          setCreator(data);
          return;
        }

        setCreator(data || null);
      } catch (e: unknown) {
        console.error('Error fetching creator data:', e);
        if (showGlobalLoader) {
          setError(e instanceof Error ? e.message : 'Failed to fetch creator details.');
        }
      } finally {
        if (showGlobalLoader) setIsCreatorLoading(false);
      }
    },
    [userProfile?.id, router, supabase, showOnboardingComponent],
  );

  useEffect(() => {
    const loadData = async () => {
      if (!isUserLoading && session?.user && userProfile?.id) {
        await fetchCreatorData();
      } else if (!isUserLoading && !session) {
        router.push('/');
      }
    };
    void loadData();
  }, [session?.user, userProfile?.id, isUserLoading, router, fetchCreatorData]);

  const handleBecomeCreatorClick = () => {
    if (!userProfile?.id) {
      setError('User profile not loaded.');
      return;
    }
    setError(null);
    setShowVideoStep(true);
  };

  const handleAgreementAccept = async () => {
    if (!agreementAccepted || !userProfile?.id) return;

    setActionLoading(true);
    setError(null);
    try {
      setShowAgreement(false);
      setShowOnboardingComponent(true);

      if (!creator || creator.veriff_verification_status !== 'in_progress') {
        setCreator({
          profile_id: userProfile.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          can_monetize: false,
          subscription_tier_enabled: false,
          veriff_verification_status: 'not_started',
          payment_provider: 'veriff',
        } as Creator);
      }
    } catch (e: unknown) {
      handleVeriffError(e instanceof Error ? e.message : 'An unexpected error occurred.');
    } finally {
      setActionLoading(false);
    }
  };

  const renderContent = () => {
    if (isUserLoading || isCreatorLoading) {
      return <OnboardingLoadingState label="Loading creator onboarding…" />;
    }

    if (error) {
      return (
        <OnboardingErrorState
          error={error}
          onRetry={() => {
            setError(null);
            void fetchCreatorData(true);
          }}
        />
      );
    }

    if (showIntroVerifyPreview) {
      return (
        <div
          className="flex flex-col items-center space-y-6 max-w-2xl w-full"
          data-intro-tour="become-creator-verify"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-pink-500/15 text-pink-500">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold text-center w-full">Identity verification</h2>
          <p className="text-muted-foreground text-center text-sm w-full">
            After accepting the creator agreement, you&apos;ll complete a quick ID check powered by Veriff.
            Have a valid photo ID ready — the process usually takes just a few minutes.
          </p>
          <div className="w-full rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center space-y-2">
            <p className="text-sm font-medium">What to expect</p>
            <ul className="text-sm text-muted-foreground space-y-1 text-left max-w-sm mx-auto list-disc list-inside">
              <li>Upload a photo of your government ID</li>
              <li>Take a quick selfie for face match</li>
              <li>Get approved and start monetizing</li>
            </ul>
          </div>
          <Button
            className="w-full bg-pink-500 hover:bg-pink-600 text-white pointer-events-none"
            tabIndex={-1}
            aria-hidden
          >
            Start Verification
          </Button>
        </div>
      );
    }

    if (showEarningsStep) {
      const defaultPricePerMonth = 9.99;
      const creatorSharePct = 0.9;
      const scenarios = [
        { fans: 10, label: '10 fans' },
        { fans: 100, label: '100 fans' },
        { fans: 500, label: '500 fans' },
      ];
      return (
        <OnboardingStepCard
          title="This is what you earn"
          description="Based on hypothetical fan engagement at default subscription pricing. You keep 90%; the platform takes 10%."
          footer={
            <AdminGradButton onClick={() => { setShowEarningsStep(false); setShowAgreement(true); }} className="w-full">
              Continue
            </AdminGradButton>
          }
        >
          {scenarios.map(({ fans, label }) => {
            const gross = defaultPricePerMonth * fans;
            const yourEarn = Math.round(gross * creatorSharePct * 100) / 100;
            return (
              <div key={fans} className="rounded-2xl border border-border bg-secondary/60 p-4">
                <p className="font-semibold text-sm">With {label} paying ${defaultPricePerMonth.toFixed(2)}/month</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Gross: ${gross.toFixed(2)}/month → you earn{' '}
                  <span className="font-semibold text-foreground">${yourEarn.toFixed(2)}/month</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">(90% creator share after platform fee)</p>
              </div>
            );
          })}
          <p className="text-sm text-muted-foreground">
            You can set your own subscription price and offer tips, PPV, and products too. This is just to show what&apos;s possible.
          </p>
        </OnboardingStepCard>
      );
    }

    if (showVideoStep) {
      return (
        <OnboardingStepCard
          title="Welcome to Blabber for creators"
          description="A quick walkthrough of how Blabber works from the creator side — profile setup, fan interactions, and payouts."
          footer={
            <AdminGradButton onClick={() => { setShowVideoStep(false); setShowEarningsStep(true); }} className="w-full">
              Continue
            </AdminGradButton>
          }
        >
          <OnboardingVideoPlaceholder caption="Welcome / explainer video will be embedded here." />
        </OnboardingStepCard>
      );
    }

    if (showAgreement) {
      return (
        <OnboardingAgreement
          title="Creator Agreement"
          checkboxId="agreement-checkbox"
          checkboxLabel="I have read and agree to the Creator Agreement terms above"
          accepted={agreementAccepted}
          onAcceptedChange={setAgreementAccepted}
          onCancel={() => {
            setShowAgreement(false);
            setAgreementAccepted(false);
          }}
          onConfirm={() => void handleAgreementAccept()}
          loading={actionLoading}
        >
          <p>By proceeding with the creator verification process, you acknowledge and agree to the following terms:</p>
          <OnboardingAgreementSection title="1. Age Verification">
            <p>I confirm that I am at least 18 years of age and have the legal capacity to enter into this agreement.</p>
          </OnboardingAgreementSection>
          <OnboardingAgreementSection title="2. Identity Verification">
            <p>I confirm that I am who I claim to be and that all information provided during the verification process is accurate and truthful.</p>
          </OnboardingAgreementSection>
          <OnboardingAgreementSection title="3. Content Guidelines">
            <p>I agree that I will not post, upload, or share any content that is:</p>
            <ul className="list-disc list-inside ml-2 mt-1 space-y-0.5">
              <li>Unauthorized, including content that infringes on intellectual property rights</li>
              <li>Gruesome, violent, or disturbing in nature</li>
              <li>Illegal or promotes illegal activities</li>
              <li>Harmful, abusive, or violates the rights of others</li>
            </ul>
          </OnboardingAgreementSection>
          <OnboardingAgreementSection title="4. Liability">
            <p>
              I understand and agree that I am solely responsible for all content I create, post, or share on this platform.
              I accept full liability for any consequences arising from my content. The platform and its operators shall not be held liable.
            </p>
          </OnboardingAgreementSection>
          <OnboardingAgreementSection title="5. Compliance">
            <p>
              I agree to comply with all applicable laws, regulations, and platform policies. Violations may result in immediate
              termination of my creator account and potential legal consequences.
            </p>
          </OnboardingAgreementSection>
        </OnboardingAgreement>
      );
    }

    if (showOnboardingComponent) {
      return (
        <OnboardingVeriffRedirect
          onError={handleVeriffError}
          endpoint="/api/veriff/create-session"
          body={{
            userId: userProfile?.id,
            username: (userProfile as Profile | null)?.username,
          }}
          onUpdated={(data) => {
            if (data && typeof data === 'object' && 'profile_id' in data) {
              setCreator(data as Creator);
            }
          }}
        />
      );
    }

    if (creator && creator.veriff_verification_status === 'completed') {
      return <OnboardingLoadingState label="Verification complete! Redirecting to your settings…" />;
    }

    const statusMessage =
      creator?.veriff_verification_status === 'rejected'
        ? { type: 'error' as const, text: 'Your previous verification was not approved. Please try again or contact support.' }
        : creator?.veriff_verification_status === 'in_progress'
          ? { type: 'info' as const, text: 'You have an incomplete verification process. Click below to continue where you left off.' }
          : undefined;

    return (
      <OnboardingHero
        icon={Sparkles}
        title="Become a Creator"
        description="Share content, connect with fans, and earn from subscriptions, tips, PPV, and more. We'll walk you through setup and identity verification."
        ctaLabel={
          creator?.veriff_verification_status === 'in_progress' ? 'Continue verification' : 'Get started'
        }
        onCta={handleBecomeCreatorClick}
        loading={actionLoading}
        statusMessage={statusMessage}
      />
    );
  };

  return (
    <RequireAuth>
      <PageShell
        title="Become a Creator"
        subtitle="Set up your profile & start earning"
        rightActions={
          <AdminPill variant="staff" className="hidden sm:inline-flex">
            Creator
          </AdminPill>
        }
      >
        {renderContent()}
      </PageShell>
    </RequireAuth>
  );
}
