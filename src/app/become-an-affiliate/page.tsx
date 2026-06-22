'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/contexts/user-context';
import { toast } from 'sonner';
import { Link2 } from 'lucide-react';

import { PageShell } from '@/components/layout/page-header';
import { RequireAuth } from '@/components/auth/require-auth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AdminGradButton, AdminPill, adminInputClass } from '@/components/admin/admin-ui';
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

interface AffiliateProfile {
  profile_id: string;
  name: string;
  veriff_status: 'not_started' | 'in_progress' | 'completed' | 'rejected';
  veriff_session_id?: string | null;
}

export default function BecomeAnAffiliatePage() {
  const supabase = createClient();
  const router = useRouter();
  const { session, profile: userProfile, isLoading: isUserLoading, refreshAccountRoles } = useUser();

  const [affiliate, setAffiliate] = useState<AffiliateProfile | null>(null);
  const [isAffiliateLoading, setIsAffiliateLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showVideoStep, setShowVideoStep] = useState(false);
  const [showNameStep, setShowNameStep] = useState(false);
  const [affiliateName, setAffiliateName] = useState('');
  const [showAgreement, setShowAgreement] = useState(false);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [showOnboardingComponent, setShowOnboardingComponent] = useState(false);

  const handleVeriffError = useCallback((message: string) => {
    setError(`Verification Error: ${message}`);
    setShowAgreement(false);
    setShowOnboardingComponent(false);
    setActionLoading(false);
  }, []);

  const handleBypass = useCallback(
    (bypassedAffiliate: AffiliateProfile) => {
      setAffiliate(bypassedAffiliate);
      toast.success('Affiliate account verified.');
      void refreshAccountRoles();
      router.push('/affiliate-dashboard');
    },
    [router, refreshAccountRoles]
  );

  const fetchAffiliateData = useCallback(
    async (showGlobalLoader = true) => {
      if (!userProfile?.id) return;
      if (showGlobalLoader) { setIsAffiliateLoading(true); setError(null); }
      try {
        const { data, error: dbError } = await supabase
          .from('affiliate_profiles')
          .select('*')
          .eq('profile_id', userProfile.id)
          .maybeSingle();

        if (dbError) throw new Error(dbError.message);

        if (data?.veriff_status === 'completed') {
          router.push('/affiliate-dashboard');
          return;
        }
        setAffiliate(data || null);
        if (data?.name) setAffiliateName(data.name);
      } catch (e: unknown) {
        if (showGlobalLoader) setError(e instanceof Error ? e.message : 'Failed to fetch affiliate details.');
      } finally {
        if (showGlobalLoader) setIsAffiliateLoading(false);
      }
    },
    [userProfile?.id, router, supabase]
  );

  useEffect(() => {
    if (!isUserLoading && session?.user && userProfile?.id) {
      void fetchAffiliateData();
    } else if (!isUserLoading && !session) {
      router.push('/');
    }
  }, [session?.user, userProfile?.id, isUserLoading, router, fetchAffiliateData]);

  const handleAgreementAccept = async () => {
    if (!agreementAccepted || !userProfile?.id) return;
    setActionLoading(true);
    setError(null);
    try {
      setShowAgreement(false);
      setShowOnboardingComponent(true);
    } catch (e: unknown) {
      handleVeriffError(e instanceof Error ? e.message : 'An unexpected error occurred.');
    } finally {
      setActionLoading(false);
    }
  };

  const renderContent = () => {
    if (isUserLoading || isAffiliateLoading) {
      return <OnboardingLoadingState label="Loading affiliate onboarding…" />;
    }

    if (error) {
      return (
        <OnboardingErrorState
          error={error}
          onRetry={() => { setError(null); void fetchAffiliateData(true); }}
        />
      );
    }

    if (showVideoStep) {
      return (
        <OnboardingStepCard
          title="Welcome to Blabber Affiliates"
          description="Share your unique referral link and earn cash commissions on the activity of everyone you bring to the platform — plus a second-degree cut from their referrals too."
          footer={
            <AdminGradButton
              onClick={() => { setShowVideoStep(false); setShowNameStep(true); }}
              className="w-full"
            >
              Continue
            </AdminGradButton>
          }
        >
          <OnboardingVideoPlaceholder caption="Affiliate explainer video will be embedded here." />
        </OnboardingStepCard>
      );
    }

    if (showNameStep) {
      return (
        <OnboardingStepCard
          title="Name your affiliate account"
          description="This is for your records and any future affiliate communications."
          footer={
            <AdminGradButton
              onClick={() => { if (!affiliateName.trim()) { toast.error('Please enter a name.'); return; } setShowNameStep(false); setShowAgreement(true); }}
              disabled={!affiliateName.trim()}
              className="w-full"
            >
              Continue
            </AdminGradButton>
          }
        >
          <div className="space-y-2">
            <Label htmlFor="affiliate-name" className="text-sm font-semibold">Your name or brand</Label>
            <Input
              id="affiliate-name"
              value={affiliateName}
              onChange={(e) => setAffiliateName(e.target.value)}
              placeholder="e.g. Jane Smith"
              maxLength={80}
              className={adminInputClass}
            />
          </div>
        </OnboardingStepCard>
      );
    }

    if (showAgreement) {
      return (
        <OnboardingAgreement
          title="Affiliate Agreement"
          checkboxId="affiliate-agreement-checkbox"
          checkboxLabel="I have read and agree to the Affiliate Agreement terms above"
          accepted={agreementAccepted}
          onAcceptedChange={setAgreementAccepted}
          onCancel={() => { setShowAgreement(false); setAgreementAccepted(false); }}
          onConfirm={() => void handleAgreementAccept()}
          loading={actionLoading}
        >
          <p>By proceeding, you acknowledge and agree to the following terms:</p>
          <OnboardingAgreementSection title="1. Identity">
            <p>I confirm I am at least 18 years of age and that all information I provide is accurate.</p>
          </OnboardingAgreementSection>
          <OnboardingAgreementSection title="2. Commission Structure">
            <p>
              I understand that I earn a percentage of the platform&apos;s revenue share from users I directly refer (1st degree)
              and a smaller percentage from users referred by my referrals (2nd degree). Commission rates are set by the platform
              and are subject to change with notice.
            </p>
          </OnboardingAgreementSection>
          <OnboardingAgreementSection title="3. Payouts">
            <p>
              Commissions are tracked automatically. Payouts settle to the crypto or bank addresses I configure in my affiliate
              settings on a schedule determined by the platform.
            </p>
          </OnboardingAgreementSection>
          <OnboardingAgreementSection title="4. Prohibited Conduct">
            <p>
              I will not use spam, misleading advertising, or any deceptive practices to generate referrals. Violations may result
              in immediate termination and forfeiture of unpaid commissions.
            </p>
          </OnboardingAgreementSection>
          <OnboardingAgreementSection title="5. Compliance">
            <p>I agree to comply with all applicable laws and platform policies.</p>
          </OnboardingAgreementSection>
        </OnboardingAgreement>
      );
    }

    if (showOnboardingComponent) {
      return (
        <OnboardingVeriffRedirect
          onError={handleVeriffError}
          endpoint="/api/affiliate/create-session"
          body={{ userId: userProfile?.id, name: affiliateName || affiliate?.name || 'My Affiliate' }}
          onUpdated={(data) => {
            if (data && typeof data === 'object') {
              if ('bypassed' in data && data.bypassed && 'affiliate' in data) {
                handleBypass(data.affiliate as AffiliateProfile);
              } else if ('profile_id' in data) {
                setAffiliate(data as AffiliateProfile);
              }
            }
          }}
        />
      );
    }

    if (affiliate?.veriff_status === 'completed') {
      void refreshAccountRoles();
      return <OnboardingLoadingState label="Verification complete! Redirecting to your affiliate dashboard…" />;
    }

    const statusMessage =
      affiliate?.veriff_status === 'rejected'
        ? { type: 'error' as const, text: 'Your previous verification was not approved. Please try again or contact support.' }
        : affiliate?.veriff_status === 'in_progress'
          ? { type: 'info' as const, text: 'You have an incomplete verification. Click below to continue.' }
          : undefined;

    return (
      <OnboardingHero
        icon={Link2}
        title="Become an Affiliate"
        description="Share your referral link. Earn cash commissions from everyone you bring to Blabber, plus a second-degree cut from their referrals."
        ctaLabel={affiliate?.veriff_status === 'in_progress' ? 'Continue verification' : 'Get started'}
        onCta={() => { if (!userProfile?.id) { setError('User profile not loaded.'); return; } setError(null); setShowVideoStep(true); }}
        loading={actionLoading}
        statusMessage={statusMessage}
      />
    );
  };

  return (
    <RequireAuth>
      <PageShell
        title="Become an Affiliate"
        subtitle="Share your link & earn commissions"
        rightActions={
          <AdminPill variant="staff" className="hidden sm:inline-flex">Affiliate</AdminPill>
        }
      >
        {renderContent()}
      </PageShell>
    </RequireAuth>
  );
}
