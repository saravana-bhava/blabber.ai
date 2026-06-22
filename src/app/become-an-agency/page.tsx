'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/contexts/user-context';
import { toast } from 'sonner';
import { Briefcase } from 'lucide-react';

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

interface Agency {
  profile_id: string;
  name: string;
  default_split_pct: number;
  veriff_session_id?: string | null;
  veriff_verification_status: 'not_started' | 'in_progress' | 'completed' | 'rejected';
  created_at: string;
  updated_at: string;
}

export default function BecomeAnAgencyPage() {
  const supabase = createClient();
  const router = useRouter();
  const { session, profile: userProfile, isLoading: isUserLoading, refreshAccountRoles } = useUser();

  const [agency, setAgency] = useState<Agency | null>(null);
  const [isAgencyLoading, setIsAgencyLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showVideoStep, setShowVideoStep] = useState(false);
  const [showNameStep, setShowNameStep] = useState(false);
  const [agencyName, setAgencyName] = useState('');
  const [showAgreement, setShowAgreement] = useState(false);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [showOnboardingComponent, setShowOnboardingComponent] = useState(false);

  const handleVeriffError = useCallback((message: string) => {
    setError(`Verification Error: ${message}`);
    setShowAgreement(false);
    setShowOnboardingComponent(false);
    setActionLoading(false);
  }, []);

  const handleAdminBypass = useCallback(
    (bypassedAgency: Agency) => {
      setAgency(bypassedAgency);
      toast.success('Admin KYC bypass applied. Your agency is now verified.');
      void refreshAccountRoles();
      router.push('/agency-dashboard');
    },
    [router, refreshAccountRoles]
  );

  const fetchAgencyData = useCallback(
    async (showGlobalLoader = true) => {
      if (!userProfile?.id) return;

      if (showGlobalLoader) {
        setIsAgencyLoading(true);
        setError(null);
      }

      try {
        const { data, error: dbError } = await supabase
          .from('agencies')
          .select('*')
          .eq('profile_id', userProfile.id)
          .maybeSingle();

        if (dbError) {
          console.error('Supabase error:', dbError);
          throw new Error(dbError.message);
        }

        if (data?.veriff_verification_status === 'completed') {
          router.push('/agency-dashboard');
          return;
        }

        setAgency(data || null);
        if (data?.name) setAgencyName(data.name);
      } catch (e: unknown) {
        console.error('Error fetching agency data:', e);
        if (showGlobalLoader) {
          setError(e instanceof Error ? e.message : 'Failed to fetch agency details.');
        }
      } finally {
        if (showGlobalLoader) setIsAgencyLoading(false);
      }
    },
    [userProfile?.id, router, supabase],
  );

  useEffect(() => {
    const loadData = async () => {
      if (!isUserLoading && session?.user && userProfile?.id) {
        await fetchAgencyData();
      } else if (!isUserLoading && !session) {
        router.push('/');
      }
    };
    void loadData();
  }, [session?.user, userProfile?.id, isUserLoading, router, fetchAgencyData]);

  const handleBecomeAgencyClick = () => {
    if (!userProfile?.id) {
      setError('User profile not loaded.');
      return;
    }
    setError(null);
    setShowVideoStep(true);
  };

  const handleNameStepContinue = () => {
    if (!agencyName.trim()) {
      toast.error('Please enter an agency name.');
      return;
    }
    setShowNameStep(false);
    setShowAgreement(true);
  };

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
    if (isUserLoading || isAgencyLoading) {
      return <OnboardingLoadingState label="Loading agency onboarding…" />;
    }

    if (error) {
      return (
        <OnboardingErrorState
          error={error}
          onRetry={() => {
            setError(null);
            void fetchAgencyData(true);
          }}
        />
      );
    }

    if (showVideoStep) {
      return (
        <OnboardingStepCard
          title="Welcome to Blabber for agencies"
          description="Run a roster of creators on Blabber. Invite or fully operate creator accounts and earn a configurable percentage of their earnings."
          footer={
            <AdminGradButton onClick={() => { setShowVideoStep(false); setShowNameStep(true); }} className="w-full">
              Continue
            </AdminGradButton>
          }
        >
          <OnboardingVideoPlaceholder caption="Agency explainer video will be embedded here." />
        </OnboardingStepCard>
      );
    }

    if (showNameStep) {
      return (
        <OnboardingStepCard
          title="Name your agency"
          description="This is the name your managed creators will see when they're linked to your agency."
          footer={
            <AdminGradButton onClick={handleNameStepContinue} disabled={!agencyName.trim()} className="w-full">
              Continue
            </AdminGradButton>
          }
        >
          <div className="space-y-2">
            <Label htmlFor="agency-name" className="text-sm font-semibold">
              Agency name
            </Label>
            <Input
              id="agency-name"
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              placeholder="e.g. Sunset Talent"
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
          title="Agency Agreement"
          checkboxId="agency-agreement-checkbox"
          checkboxLabel="I have read and agree to the Agency Agreement terms above"
          accepted={agreementAccepted}
          onAcceptedChange={setAgreementAccepted}
          onCancel={() => {
            setShowAgreement(false);
            setAgreementAccepted(false);
          }}
          onConfirm={() => void handleAgreementAccept()}
          loading={actionLoading}
        >
          <p>By proceeding with the agency verification process, you acknowledge and agree to the following terms:</p>
          <OnboardingAgreementSection title="1. Authority">
            <p>
              I confirm that I have legal authority to operate this agency and to manage the creators I onboard or invite onto Blabber.
            </p>
          </OnboardingAgreementSection>
          <OnboardingAgreementSection title="2. Identity Verification">
            <p>
              I confirm that I am at least 18 years of age and that all information I provide during the verification process is accurate.
            </p>
          </OnboardingAgreementSection>
          <OnboardingAgreementSection title="3. Creator Consent">
            <p>
              Any creator I onboard via invite or operated mode has consented to my agency representing them, and any documents I upload on
              their behalf for KYC are authentic and authorized.
            </p>
          </OnboardingAgreementSection>
          <OnboardingAgreementSection title="4. Splits & Payouts">
            <p>
              I understand that the platform share is unchanged and my agency share is taken from the creator share. Splits and payouts settle to
              the addresses I configure in agency settings.
            </p>
          </OnboardingAgreementSection>
          <OnboardingAgreementSection title="5. Compliance">
            <p>
              I agree to comply with all applicable laws, regulations, and platform policies. Violations may result in immediate termination of
              my agency account.
            </p>
          </OnboardingAgreementSection>
        </OnboardingAgreement>
      );
    }

    if (showOnboardingComponent) {
      return (
        <OnboardingVeriffRedirect
          onError={handleVeriffError}
          endpoint="/api/agency/create-session"
          body={{
            userId: userProfile?.id,
            name: agencyName || agency?.name || 'My Agency',
          }}
          onUpdated={(data) => {
            if (data && typeof data === 'object' && 'profile_id' in data) {
              setAgency(data as Agency);
            }
          }}
        />
      );
    }

    if (agency && agency.veriff_verification_status === 'completed') {
      void refreshAccountRoles();
      return <OnboardingLoadingState label="Verification complete! Redirecting to your agency dashboard…" />;
    }

    const statusMessage =
      agency?.veriff_verification_status === 'rejected'
        ? { type: 'error' as const, text: 'Your previous verification was not approved. Please try again or contact support.' }
        : agency?.veriff_verification_status === 'in_progress'
          ? { type: 'info' as const, text: 'You have an incomplete verification process. Click below to continue where you left off.' }
          : undefined;

    return (
      <OnboardingHero
        icon={Briefcase}
        title="Become an Agency"
        description="Manage a roster of creators, configure revenue splits, and earn automatically from your creators' earnings on Blabber."
        ctaLabel={
          agency?.veriff_verification_status === 'in_progress' ? 'Continue verification' : 'Get started'
        }
        onCta={handleBecomeAgencyClick}
        loading={actionLoading}
        statusMessage={statusMessage}
      />
    );
  };

  return (
    <RequireAuth>
      <PageShell
        title="Become an Agency"
        subtitle="Manage creators & earn agency splits"
        rightActions={
          <AdminPill variant="staff" className="hidden sm:inline-flex">
            Agency
          </AdminPill>
        }
      >
        {renderContent()}
      </PageShell>
    </RequireAuth>
  );
}
