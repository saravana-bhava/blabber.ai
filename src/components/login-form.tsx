'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Captcha } from '@/components/ui/captcha';
import { Checkbox } from '@/components/ui/checkbox';
import type { Session } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';
import { isEmailConfirmed } from '@/lib/auth/email-confirmed';

/* ── Google SVG ────────────────────────────────── */
const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0">
    <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" fill="currentColor" />
  </svg>
);

const AppleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0">
    <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" fill="currentColor" />
  </svg>
);

interface LoginFormProps extends React.ComponentProps<'div'> {
  hideHeader?: boolean;
  /** Pre-select the signup tab when true (e.g. coming from a referral link) */
  initialIsSignUp?: boolean;
  onModeChange?: (isSignUp: boolean) => void;
  /** Fired when signup succeeds and the user must confirm email before signing in */
  onAwaitingConfirmationChange?: (awaiting: boolean) => void;
  /** Fired when password sign-in succeeds and we are about to leave the page */
  onSignInStarted?: () => void;
}

function getReferralCode(): string | null {
  if (typeof document === 'undefined') return null;
  return document.cookie.split('; ').find((c) => c.startsWith('blabber_ref='))?.split('=')[1] ?? null;
}

function getEmailConfirmRedirect(): string {
  const origin =
    (typeof window !== 'undefined' ? window.location.origin : null) ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'http://127.0.0.1:3000';
  const base = `${origin.replace(/\/$/, '')}/auth/confirm?next=/home`;
  const ref = getReferralCode();
  return ref ? `${base}&ref=${encodeURIComponent(ref)}` : base;
}

function isLocalDevHost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

export function LoginForm({
  className,
  hideHeader,
  initialIsSignUp = false,
  onModeChange,
  onAwaitingConfirmationChange,
  onSignInStarted,
  ...props
}: LoginFormProps) {
  const supabase = useMemo(() => createClient(), []);

  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');

  const [showMFAPrompt, setShowMFAPrompt] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifyingMfa, setIsVerifyingMfa] = useState(false);
  const [isSignUp, setIsSignUp] = useState(initialIsSignUp);
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [ageVerified, setAgeVerified] = useState(false);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState<string | null>(null);
  const [confirmOtpCode, setConfirmOtpCode] = useState('');
  const [isResendingConfirmation, setIsResendingConfirmation] = useState(false);
  const [isVerifyingSignupOtp, setIsVerifyingSignupOtp] = useState(false);
  const [confirmationNotice, setConfirmationNotice] = useState<string | null>(null);

  const goHome = useCallback(() => {
    window.location.assign('/home');
  }, []);

  /** MFA + redirect — always run outside onAuthStateChange (deferred one tick). */
  const finishSignIn = useCallback(
    async (session: Session) => {
      await new Promise<void>(resolve => window.setTimeout(resolve, 0));

      if (!isEmailConfirmed(session.user)) {
        await supabase.auth.signOut();
        setError('Please confirm your email using the link we sent you, then sign in.');
        return;
      }

      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) {
        goHome();
        return;
      }

      const verifiedTotp =
        factors?.totp?.find(f => f.status === 'verified') ||
        factors?.all?.find(f => f.factor_type === 'totp' && f.status === 'verified');

      if (verifiedTotp) {
        let aal = 'aal1';
        try {
          if (session.access_token) {
            const payload = JSON.parse(atob(session.access_token.split('.')[1]));
            aal = payload.aal || 'aal1';
          }
        } catch {
          /* ignore */
        }
        if (aal === 'aal2') {
          goHome();
        } else {
          setMfaFactorId(verifiedTotp.id);
          setShowMFAPrompt(true);
          setIsSubmitting(false);
        }
        return;
      }

      goHome();
    },
    [goHome, supabase]
  );

  useEffect(() => {
    const { data: authListenerData } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'MFA_CHALLENGE_VERIFIED') {
        setShowMFAPrompt(false);
        setMfaCode('');
        setMfaFactorId(null);
        setError(null);
        goHome();
      }
    });

    return () => authListenerData.subscription.unsubscribe();
  }, [goHome, supabase]);

  const handleAuthAction = async () => {
    setIsSubmitting(true);
    setError(null);
    let keepSubmitting = false;
    try {
      if (isSignUp) {
        if (!captchaVerified) {
          setError('Please complete the captcha verification.');
          return;
        }
        if (!ageVerified) {
          setError('Please confirm that you are over the age of 18.');
          return;
        }
        if (signUpPassword.length < 6) {
          setError('Password must be at least 6 characters.');
          return;
        }

        const emailRedirectTo = getEmailConfirmRedirect();
        const response = await supabase.auth.signUp({
          email: signUpEmail,
          password: signUpPassword,
          options: {
            data: { full_name: signUpName },
            emailRedirectTo,
          },
        });
        if (response.data.user && response.data.user.identities?.length === 0) {
          setError('An account with this email already exists. Sign in, or use a different email.');
        } else if (response.error) {
          setError(response.error.message);
        } else if (response.data.user) {
          if (response.data.session) await supabase.auth.signOut();
          setPendingConfirmationEmail(signUpEmail.trim());
          onAwaitingConfirmationChange?.(true);
          setConfirmationNotice(
            'We sent a confirmation link to your email. Open it to activate your account, or enter the 6-digit code from that email below.',
          );
          setConfirmOtpCode('');
          setError(null);
        }
      } else {
        const response = await supabase.auth.signInWithPassword({
          email: signInEmail,
          password: signInPassword,
        });
        if (response.error) {
          const msg = response.error.message;
          if (msg.toLowerCase().includes('email not confirmed')) {
            setPendingConfirmationEmail(signInEmail.trim());
            onAwaitingConfirmationChange?.(true);
            setConfirmationNotice(
              'This email is registered but not confirmed yet. Check your inbox for the confirmation link, or resend it below.',
            );
            setError(null);
          } else {
            setError(msg);
          }
        } else if (response.data.session) {
          onSignInStarted?.();
          keepSubmitting = true;
          await finishSignIn(response.data.session);
        } else {
          setError('Sign-in succeeded but no session was returned. Please try again.');
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      if (!keepSubmitting) setIsSubmitting(false);
    }
  };

  const handleMFAVerification = async () => {
    if (!mfaCode || !mfaFactorId) return;
    setIsVerifyingMfa(true);
    setError(null);
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: mfaFactorId,
      });
      if (challengeError) {
        setError(challengeError.message);
        return;
      }
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challengeData.id,
        code: mfaCode,
      });
      if (verifyError) {
        setError(verifyError.message);
        return;
      }
      setMfaCode('');
      onSignInStarted?.();
      await new Promise<void>(resolve => window.setTimeout(resolve, 100));
      try {
        await supabase.auth.refreshSession();
      } catch {
        /* ignore */
      }
      goHome();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'An unexpected error occurred during MFA verification.');
    } finally {
      setIsVerifyingMfa(false);
    }
  };

  const clearPendingConfirmation = () => {
    setPendingConfirmationEmail(null);
    onAwaitingConfirmationChange?.(false);
    setConfirmOtpCode('');
    setConfirmationNotice(null);
  };

  const handleResendConfirmation = async () => {
    if (!pendingConfirmationEmail) return;
    setIsResendingConfirmation(true);
    setError(null);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: pendingConfirmationEmail,
        options: { emailRedirectTo: getEmailConfirmRedirect() },
      });
      if (resendError) {
        setError(resendError.message);
      } else {
        setConfirmationNotice('Confirmation email sent again. Check your inbox (and spam).');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not resend confirmation email.');
    } finally {
      setIsResendingConfirmation(false);
    }
  };

  const handleVerifySignupOtp = async () => {
    if (!pendingConfirmationEmail || confirmOtpCode.length !== 6) return;
    setIsVerifyingSignupOtp(true);
    setError(null);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: pendingConfirmationEmail,
        token: confirmOtpCode,
        type: 'signup',
      });
      if (verifyError) {
        setError(verifyError.message);
        return;
      }

      const refCode = getReferralCode();
      await fetch('/api/auth/bootstrap-session', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referral_code: refCode }),
      });
      clearPendingConfirmation();
      onSignInStarted?.();
      goHome();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not verify code. Please try again.');
    } finally {
      setIsVerifyingSignupOtp(false);
    }
  };

  const toggleMode = () => {
    const next = !isSignUp;
    setIsSignUp(next);
    onModeChange?.(next);
    setError(null);
    setCaptchaVerified(false);
    setAgeVerified(false);
    setShowMFAPrompt(false);
    setMfaCode('');
    setMfaFactorId(null);
    clearPendingConfirmation();
    setSignInEmail('');
    setSignInPassword('');
    setSignUpName('');
    setSignUpEmail('');
    setSignUpPassword('');
  };

  const inputCls =
    'h-12 rounded-xl bg-secondary border-border text-[15px] text-foreground px-4 placeholder:text-[var(--input-placeholder)] placeholder:opacity-100 focus-visible:ring-1 focus-visible:ring-[var(--brand-violet)] focus-visible:border-[var(--brand-violet)] transition-[border-color,box-shadow]';

  return (
    <div className={cn('w-full', className)} {...props}>
      {!hideHeader && !showMFAPrompt && (
        <div className="mb-6">
          <h1 className="text-[22px] font-bold tracking-tight mb-1.5" style={{ fontFamily: 'var(--font-display)' }}>
            {isSignUp ? 'Create your account' : 'Log in'}
          </h1>
          <p className="text-muted-foreground text-[14px]">
            {isSignUp ? 'Free to join. No charges until you subscribe.' : 'Pick up right where you left off.'}
          </p>
        </div>
      )}

      {error && (
        <Alert className="mb-4 border-destructive/40 bg-destructive/10">
          <AlertDescription className="text-destructive text-sm">{error}</AlertDescription>
        </Alert>
      )}

      {pendingConfirmationEmail ? (
        <div className="space-y-5">
          <div>
            <h3 className="text-lg font-semibold mb-1.5" style={{ fontFamily: 'var(--font-display)' }}>
              Check your email
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We sent a confirmation link to{' '}
              <span className="font-semibold text-foreground">{pendingConfirmationEmail}</span>.
              Open the link to finish creating your account.
            </p>
          </div>

          {confirmationNotice && (
            <p className="text-sm rounded-xl px-4 py-3 border text-[var(--brand-gold)] bg-secondary border-border">
              {confirmationNotice}
            </p>
          )}

          {isLocalDevHost() && (
            <p className="text-sm rounded-xl px-4 py-3 border border-border bg-secondary/60 text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">Local dev:</span> confirmation emails are captured by{' '}
              <a
                href="http://127.0.0.1:54324"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold hover:underline underline-offset-2"
                style={{ color: 'var(--brand-pink)' }}
              >
                Mailpit
              </a>
              , not a real inbox. Open Mailpit and search for{' '}
              <span className="font-semibold text-foreground">{pendingConfirmationEmail}</span> to get the
              confirmation link or 6-digit code.
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="confirm-otp" className="text-sm font-medium">
              Or enter the 6-digit code from the email
            </Label>
            <Input
              id="confirm-otp"
              type="text"
              inputMode="numeric"
              placeholder="000000"
              value={confirmOtpCode}
              onChange={e => setConfirmOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              className={cn(inputCls, 'text-center text-xl tracking-[0.35em] font-semibold')}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleVerifySignupOtp();
                }
              }}
            />
          </div>

          <button
            type="button"
            onClick={handleVerifySignupOtp}
            disabled={isVerifyingSignupOtp || confirmOtpCode.length !== 6}
            className="w-full h-[50px] rounded-xl text-white font-semibold text-[15.5px] transition-[filter] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            style={{ background: 'var(--brand-grad)', boxShadow: 'var(--brand-ring-money)' }}
          >
            {isVerifyingSignupOtp ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                Verifying…
              </>
            ) : (
              'Confirm & sign in'
            )}
          </button>

          <button
            type="button"
            onClick={handleResendConfirmation}
            disabled={isResendingConfirmation}
            className="w-full h-11 rounded-xl border border-border text-sm font-semibold hover:bg-secondary transition-colors disabled:opacity-50"
          >
            {isResendingConfirmation ? 'Sending…' : 'Resend confirmation email'}
          </button>

          <p className="text-center text-[14px] text-muted-foreground">
            Already confirmed?{' '}
            <button
              type="button"
              onClick={() => {
                const email = pendingConfirmationEmail;
                clearPendingConfirmation();
                setIsSignUp(false);
                onModeChange?.(false);
                if (email) setSignInEmail(email);
              }}
              className="font-bold hover:underline underline-offset-4"
              style={{ color: 'var(--brand-pink)' }}
            >
              Log in
            </button>
          </p>
        </div>
      ) : showMFAPrompt ? (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-1.5">Two-factor authentication</h3>
            <p className="text-sm text-muted-foreground">Enter the 6-digit code from your authenticator app.</p>
          </div>
          <Input
            id="mfa-code"
            type="text"
            placeholder="000 000"
            value={mfaCode}
            onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            maxLength={6}
            className={cn(inputCls, 'text-center text-xl tracking-[0.35em] font-semibold')}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleMFAVerification();
              }
            }}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleMFAVerification}
              disabled={isVerifyingMfa || mfaCode.length !== 6}
              className="flex-1 h-12 rounded-xl text-white font-semibold text-[15px] transition-[filter] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'var(--brand-grad)', boxShadow: 'var(--brand-ring-money)' }}
            >
              {isVerifyingMfa ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Verifying…
                </span>
              ) : (
                'Verify'
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowMFAPrompt(false);
                setMfaCode('');
                setMfaFactorId(null);
                setError(null);
              }}
              disabled={isVerifyingMfa}
              className="h-12 px-5 rounded-xl border border-border text-sm font-semibold hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 mb-5">
            <button
              type="button"
              onClick={async () => {
                const { error: oauthError } = await supabase.auth.signInWithOAuth({
                  provider: 'google',
                  options: {
                    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/auth/callback?next=/home`,
                  },
                });
                if (oauthError) setError(oauthError.message);
              }}
              className="flex items-center justify-center gap-3 w-full h-12 rounded-xl border border-border bg-transparent text-[14.5px] font-semibold hover:bg-secondary transition-colors"
            >
              <GoogleIcon /> Continue with Google
            </button>
            <button
              type="button"
              className="flex items-center justify-center gap-3 w-full h-12 rounded-xl border border-border bg-transparent text-[14.5px] font-semibold hover:bg-secondary transition-colors"
            >
              <AppleIcon /> Continue with Apple
            </button>
          </div>

          <div className="flex items-center gap-3 mb-5">
            <span className="flex-1 h-px bg-border" />
            <span className="text-[12.5px] text-muted-foreground font-medium">or</span>
            <span className="flex-1 h-px bg-border" />
          </div>

          <div className="flex flex-col gap-4 mb-5">
            {isSignUp && (
              <div className="grid gap-1.5">
                <Label htmlFor="name" className="text-sm font-medium">
                  Full Name
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={signUpName}
                  onChange={e => setSignUpName(e.target.value)}
                  className={inputCls}
                  required
                />
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={isSignUp ? signUpEmail : signInEmail}
                onChange={e => (isSignUp ? setSignUpEmail(e.target.value) : setSignInEmail(e.target.value))}
                className={inputCls}
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                {!isSignUp && (
                  <a href="#" className="text-[13px] font-semibold hover:underline" style={{ color: 'var(--brand-pink)' }}>
                    Forgot password?
                  </a>
                )}
              </div>
              <Input
                id="password"
                type="password"
                placeholder={isSignUp ? 'Min. 8 characters' : '••••••••'}
                value={isSignUp ? signUpPassword : signInPassword}
                onChange={e => (isSignUp ? setSignUpPassword(e.target.value) : setSignInPassword(e.target.value))}
                className={inputCls}
                disabled={isSubmitting}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAuthAction();
                  }
                }}
                required
              />
            </div>

            {isSignUp && <Captcha key="signup-captcha" onVerified={setCaptchaVerified} className="mt-0" />}

            {isSignUp && (
              <label className="flex items-start gap-3 cursor-pointer group">
                <Checkbox
                  id="age-verification"
                  checked={ageVerified}
                  onCheckedChange={checked => setAgeVerified(checked === true)}
                  className="mt-0.5 data-[state=checked]:[background:var(--brand-grad)] data-[state=checked]:border-transparent"
                />
                <span className="text-[13px] text-muted-foreground leading-relaxed group-hover:text-foreground transition-colors">
                  I confirm I am at least 18 years old and agree to the{' '}
                  <a href="/terms-of-service" className="underline underline-offset-2" style={{ color: 'var(--brand-pink)' }}>
                    Terms
                  </a>{' '}
                  and{' '}
                  <a href="/privacy-policy" className="underline underline-offset-2" style={{ color: 'var(--brand-pink)' }}>
                    Privacy Policy
                  </a>
                  .
                </span>
              </label>
            )}
          </div>

          <button
            type="button"
            onClick={handleAuthAction}
            disabled={isSubmitting || (isSignUp && (!captchaVerified || !ageVerified))}
            aria-busy={isSubmitting}
            className="w-full h-[50px] rounded-xl text-white font-semibold text-[15.5px] transition-[filter] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            style={{ background: 'var(--brand-grad)', boxShadow: 'var(--brand-ring-money)' }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                <span>{isSignUp ? 'Creating account…' : 'Signing in…'}</span>
              </>
            ) : isSignUp ? (
              'Create account'
            ) : (
              'Log in'
            )}
          </button>

          <p className="text-center text-[14px] text-muted-foreground mt-5">
            {isSignUp ? 'Already have an account? ' : 'New to Blabber? '}
            <button
              type="button"
              onClick={toggleMode}
              disabled={isSubmitting}
              className="font-bold hover:underline underline-offset-4"
              style={{ color: 'var(--brand-pink)' }}
            >
              {isSignUp ? 'Log in' : 'Join free'}
            </button>
          </p>
        </>
      )}
    </div>
  );
}
