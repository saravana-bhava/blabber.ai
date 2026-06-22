'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { isEmailConfirmed } from '@/lib/auth/email-confirmed';

import { LandingHeader }       from '@/components/landing/LandingHeader';
import { Hero }                  from '@/components/landing/Hero';
import { StatsBand }             from '@/components/landing/StatsBand';
import { FeaturesSection }       from '@/components/landing/FeaturesSection';
import { VoiceCallDemo }         from '@/components/landing/VoiceCallDemo';
import { WhyBlabber }            from '@/components/landing/WhyBlabber';
import { TestimonialsSection }   from '@/components/landing/TestimonialsSection';
import { FaqSection }            from '@/components/landing/FaqSection';
import { PricingSection }        from '@/components/landing/PricingSection';
import { FinalCTA }              from '@/components/landing/FinalCTA';
import { LandingFooter }         from '@/components/landing/LandingFooter';
import { WaitlistModal }         from '@/components/landing/WaitlistModal';
import Image from 'next/image';
import { useBetaMode } from '@/lib/contexts/beta-mode-context';

function LandingContent() {
  const router   = useRouter();
  const params   = useSearchParams();
  const supabase = createClient();
  const isBeta = useBetaMode();
  const [waitlist, setWaitlist] = useState(false);
  const onWaitlist = () => {
    if (isBeta) setWaitlist(true);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const code = params.get('code');
    const error = params.get('error');
    const hash = window.location.hash;

    // Email confirm links sometimes fall back to site root — forward to /auth/confirm.
    if (code || hash.includes('access_token') || error) {
      const next = params.get('next') ?? '/home';
      const qs = new URLSearchParams();
      if (code) qs.set('code', code);
      if (error) qs.set('error', error);
      const errDesc = params.get('error_description');
      if (errDesc) qs.set('error_description', errDesc);
      qs.set('next', next);
      const target = `/auth/confirm?${qs.toString()}${hash}`;
      router.replace(target);
      return;
    }

    const t = setTimeout(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && isEmailConfirmed(user)) router.push('/home');
    }, 100);
    return () => clearTimeout(t);
  }, [router, supabase, params]);

  return (
    <div id="__top" className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <LandingHeader onWaitlist={onWaitlist} />
      <Hero onWaitlist={onWaitlist} />
      <StatsBand />
      <FeaturesSection onWaitlist={onWaitlist} />
      <VoiceCallDemo onWaitlist={onWaitlist} />
      <WhyBlabber />
      <TestimonialsSection />
      <FaqSection />
      <PricingSection onWaitlist={onWaitlist} />
      <FinalCTA onWaitlist={onWaitlist} />
      <LandingFooter />
      {isBeta && waitlist && <WaitlistModal onClose={() => setWaitlist(false)} />}
    </div>
  );
}

export default function LandingPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Image
          src="/logo.png"
          alt="Blabber"
          width={150}
          height={35}
          className="w-[150px] h-auto object-contain"
          priority
        />
      </div>
    }>
      <LandingContent />
    </Suspense>
  );
}
