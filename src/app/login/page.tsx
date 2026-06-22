'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shield, Loader2 } from 'lucide-react';
import { ThemeBtn } from '@/components/landing/_atoms';
import { LoginForm } from '@/components/login-form';
import { useUser } from '@/lib/contexts/user-context';

const displayFont: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  letterSpacing: '-0.02em',
  lineHeight: 1.04,
};

function AIBadgeInline() {
  return (
    <span
      className="ai-badge-anim inline-flex items-center gap-[5px] rounded-full text-white text-[11.5px] font-bold tracking-[.04em] [background-size:180%_180%]"
      style={{ padding: '5px 13px 5px 10px' }}
    >
      <svg className="shrink-0" width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
      AI
    </span>
  );
}

function SignInPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const wantsSignup = searchParams.get('mode') === 'signup';
  const [isSignUp, setIsSignUp] = useState(wantsSignup);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const { session, isLoading } = useUser();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setIsSignUp(searchParams.get('mode') === 'signup');
  }, [searchParams]);

  // Already signed in — hard navigate so we never sit on an empty sign-in shell.
  useEffect(() => {
    if (!isLoading && session) {
      setIsLeaving(true);
      window.location.replace('/home');
    }
  }, [isLoading, session]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 min-h-svh bg-background text-foreground">

      {/* ══════════════════════════════════════════════════
          LEFT — image brand panel (desktop only)
      ══════════════════════════════════════════════════ */}
      <div
        className="hidden lg:flex flex-col justify-between relative overflow-hidden"
        style={{ padding: 44 }}
      >
        {/* image fill */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'url(/avatars/auth-panel.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
          }}
        />
        {/* brand wash + dark overlay — keeps text readable */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(150deg, rgba(169, 50, 142, 0.28), rgba(94, 60, 188, 0.18))' }}
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(150deg, rgba(0,0,0,0.18), rgba(0,0,0,0.64))' }}
        />
        {/* subtle diagonal texture */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.035) 0 2px, transparent 2px 11px)' }}
        />
        {/* top-right glow */}
        <div
          className="absolute pointer-events-none"
          style={{ top: -120, right: -80, width: 480, height: 480, borderRadius: '50%', background: 'rgba(255,255,255,0.11)', filter: 'blur(80px)' }}
        />

        {/* ── top: wordmark ── */}
        <Link
          href="/"
          className="relative self-start no-underline"
        >
          <Image
            src="/logo.png"
            alt="Blabber"
            width={150}
            height={35}
            className="w-[130px] h-auto object-contain"
            priority
          />
        </Link>

        {/* ── middle: hero copy ── */}
        <div className="relative text-white max-w-[420px]">
          <div className="flex mb-[18px]">
            <AIBadgeInline />
          </div>

          <h2
            className="mb-3.5"
            style={{ ...displayFont, fontSize: 'clamp(28px, 3vw, 38px)', color: '#fff', lineHeight: 1.08 }}
          >
            {isSignUp
              ? 'Get closer to the\ncreators you love.'
              : 'Welcome back.'}
          </h2>

          <p className="text-base leading-[1.6] opacity-90">
            Exclusive content, live streams, tips, and 24/7 AI companions — all in one place.
          </p>
        </div>

        {/* ── bottom: trust line ── */}
        <div
          className="relative flex items-center gap-2.5 text-[13.5px] font-medium"
          style={{ color: 'rgba(255,255,255,0.78)' }}
        >
          <Shield size={16} className="shrink-0" />
          Private &amp; secure · 18+ age-verified platform
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          RIGHT — form panel
      ══════════════════════════════════════════════════ */}
      <div className="flex flex-col" style={{ padding: '28px 34px' }}>

        {/* top bar: theme toggle only (matches Dim) */}
        <div className="flex justify-between items-center mb-2">
          <Link
            href="/"
            className="text-[13.5px] font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 no-underline lg:invisible"
          >
            ← Blabber
          </Link>
          {mounted && <ThemeBtn />}
        </div>

        {/* mobile wordmark */}
        <div className="flex lg:hidden mb-7 mt-2">
          <Link href="/" className="no-underline">
            <Image
              src="/logo.png"
              alt="Blabber"
              width={150}
              height={35}
              className="w-[130px] h-auto object-contain"
              priority
            />
          </Link>
        </div>

        {/* ── centred form area ── */}
        <div className="sign-in-form flex-1 flex flex-col justify-center w-full max-w-[380px] mx-auto">
          {isLeaving || session ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10" role="status" aria-live="polite" aria-busy="true">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
              <p className="text-sm font-medium text-foreground">Signing you in…</p>
            </div>
          ) : (
            <>
              {!awaitingConfirmation && (
                <div className="mb-6">
                  <h1
                    className="mb-1.5"
                    style={{ ...displayFont, fontSize: 30, lineHeight: 1.1 }}
                  >
                    {isSignUp ? 'Create your account' : 'Log in'}
                  </h1>
                  <p className="text-muted-foreground text-[14.5px]">
                    {isSignUp
                      ? 'Free to join. No charges until you subscribe.'
                      : 'Pick up right where you left off.'}
                  </p>
                </div>
              )}

              <LoginForm
                hideHeader
                initialIsSignUp={wantsSignup}
                onModeChange={(next) => {
                  setIsSignUp(next);
                  router.replace(next ? '/login?mode=signup' : '/login', { scroll: false });
                }}
                onAwaitingConfirmationChange={setAwaitingConfirmation}
                onSignInStarted={() => setIsLeaving(true)}
              />
            </>
          )}
        </div>

        {/* bottom: terms note */}
        <p className="text-center text-[12px] text-muted-foreground mt-6">
          By continuing you agree to our{' '}
          <Link href="/terms-of-service" className="font-semibold no-underline hover:underline underline-offset-2" style={{ color: 'var(--brand-pink)' }}>Terms</Link>
          {' '}and{' '}
          <Link href="/privacy-policy" className="font-semibold no-underline hover:underline underline-offset-2" style={{ color: 'var(--brand-pink)' }}>Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
          <p className="text-sm">Loading…</p>
        </div>
      }
    >
      <SignInPageInner />
    </Suspense>
  );
}
