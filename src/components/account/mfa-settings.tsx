'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Shield, Smartphone, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AdminCard,
  AdminSectionTitle,
  AdminGradButton,
  AdminGhostButton,
  AdminStatusPill,
  AdminAlertPanel,
  AdminAlertCancel,
  AdminAlertConfirm,
  adminInputClass,
} from '@/components/admin/admin-ui';

interface MFASettingsProps {
  userId: string;
}

function FormFeedback({ type, text }: { type: 'success' | 'error'; text: string }) {
  return (
    <p
      className={cn(
        'text-sm rounded-2xl px-4 py-3 border',
        type === 'error'
          ? 'text-destructive bg-destructive/10 border-destructive/20'
          : 'text-[var(--brand-gold)] bg-secondary border-border',
      )}
    >
      {text}
    </p>
  );
}

export function MFASettings({ userId }: MFASettingsProps) {
  const supabase = createClient();

  const [isMFAEnabled, setIsMFAEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isEnabling, setIsEnabling] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<{ qr_code: string; secret: string; factorId: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    checkMFAStatus();
    cleanupUnverifiedFactors();
  }, []);

  const checkMFAStatus = async () => {
    try {
      const { data: factors, error } = await supabase.auth.mfa.listFactors();

      if (error) {
        console.error('Error fetching MFA factors:', error);
        return;
      }

      const totpFactor = factors?.totp?.find(factor => factor.status === 'verified') ||
                        factors?.all?.find(factor => factor.factor_type === 'totp' && factor.status === 'verified');

      setIsMFAEnabled(!!totpFactor);
    } catch (error) {
      console.error('Error checking MFA status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const cleanupUnverifiedFactors = async () => {
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      if (factors?.all) {
        const unverifiedFactors = factors.all.filter(
          (factor) => factor.status === "unverified"
        );
        for (const factor of unverifiedFactors) {
          await supabase.auth.mfa.unenroll({ factorId: factor.id });
        }
      }
    } catch (error) {
      console.error('Error cleaning up unverified factors:', error);
    }
  };

  const handleEnableMFA = async () => {
    setIsEnabling(true);
    setMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage({ type: 'error', text: 'You must be signed in to enable MFA.' });
        return;
      }

      const { data: factors } = await supabase.auth.mfa.listFactors();
      if (factors?.all) {
        const unverifiedFactors = factors.all.filter(
          (factor) => factor.status === "unverified"
        );
        for (const factor of unverifiedFactors) {
          await supabase.auth.mfa.unenroll({ factorId: factor.id });
        }
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Authenticator App'
      });

      if (error) {
        setMessage({ type: 'error', text: error.message });
        return;
      }

      if (data) {
        setQrCodeData({
          qr_code: data.totp.qr_code,
          secret: data.totp.secret,
          factorId: data.id
        });
        setShowQRCode(true);
      }
    } catch (error: any) {
      console.error('MFA enrollment error:', error);
      setMessage({ type: 'error', text: error.message || 'An unexpected error occurred. Please try again.' });
    } finally {
      setIsEnabling(false);
    }
  };

  const handleVerifyAndEnableMFA = async () => {
    if (!totpCode || !qrCodeData) return;

    setIsEnabling(true);
    setMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage({ type: 'error', text: 'You must be signed in to verify MFA.' });
        return;
      }

      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: qrCodeData.factorId
      });

      if (challengeError) {
        console.error('MFA challenge creation error:', challengeError);
        setMessage({ type: 'error', text: challengeError.message });
        return;
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: qrCodeData.factorId,
        challengeId: challengeData.id,
        code: totpCode
      });

      if (verifyError) {
        console.error('MFA verification error:', verifyError);
        setMessage({ type: 'error', text: verifyError.message });
        return;
      }

      const { data: factors } = await supabase.auth.mfa.listFactors();

      const totpFactor = factors?.totp?.find(factor => factor.id === qrCodeData.factorId) ||
                        factors?.all?.find(factor => factor.id === qrCodeData.factorId);

      if (totpFactor && totpFactor.status === 'verified') {
        setMessage({ type: 'success', text: 'Multi-factor authentication enabled successfully!' });
        setIsMFAEnabled(true);
        setShowQRCode(false);
        setQrCodeData(null);
        setTotpCode('');

        try {
          await supabase.auth.refreshSession();
        } catch (refreshError) {
          console.warn('Session refresh failed, but MFA was enabled:', refreshError);
        }

        await checkMFAStatus();
      } else {
        console.error('MFA factor not verified after verification');
        setMessage({ type: 'error', text: 'MFA verification failed. Please try again.' });
      }
    } catch (error: any) {
      console.error('MFA verification error:', error);
      setMessage({ type: 'error', text: error.message || 'An unexpected error occurred. Please try again.' });
    } finally {
      setIsEnabling(false);
    }
  };

  const handleDisableMFA = async () => {
    setIsDisabling(true);
    setMessage(null);

    try {
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) {
        setMessage({ type: 'error', text: factorsError.message });
        return;
      }

      const totpFactor = factors.totp.find(factor => factor.status === 'verified');
      if (!totpFactor) {
        setMessage({ type: 'error', text: 'No verified TOTP factor found.' });
        return;
      }

      const { error } = await supabase.auth.mfa.unenroll({
        factorId: totpFactor.id
      });

      if (error) {
        setMessage({ type: 'error', text: error.message });
        return;
      }

      setMessage({ type: 'success', text: 'Multi-factor authentication disabled successfully!' });
      setIsMFAEnabled(false);
    } catch {
      setMessage({ type: 'error', text: 'An unexpected error occurred. Please try again.' });
    } finally {
      setIsDisabling(false);
    }
  };

  const handleCancelEnrollment = () => {
    setShowQRCode(false);
    setQrCodeData(null);
    setTotpCode('');
    setMessage(null);
  };

  if (isLoading) {
    return (
      <AdminCard>
        <AdminSectionTitle
          title="Multi-factor authentication"
          description="Add an extra layer of security to your account"
        />
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-secondary rounded-full w-3/4" />
          <div className="h-10 bg-secondary rounded-full w-1/2" />
        </div>
      </AdminCard>
    );
  }

  return (
    <AdminCard>
      <AdminSectionTitle
        title="Multi-factor authentication"
        description="Protect your account with an authenticator app"
      />
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold">Status</p>
            <div className="flex items-center gap-2">
              {isMFAEnabled ? (
                <>
                  <CheckCircle className="h-4 w-4 text-[var(--brand-gold)]" />
                  <AdminStatusPill variant="gold">Enabled</AdminStatusPill>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                  <AdminStatusPill variant="soft">Disabled</AdminStatusPill>
                </>
              )}
            </div>
          </div>
          <Shield className="h-5 w-5 text-[var(--brand-violet)] shrink-0" />
        </div>

        <p className="text-sm text-muted-foreground">
          {isMFAEnabled
            ? "Your account is protected with multi-factor authentication. You'll need to enter a code from your authenticator app when signing in."
            : 'Add an extra layer of security to your account by enabling multi-factor authentication using an authenticator app.'
          }
        </p>

        {message && <FormFeedback type={message.type} text={message.text} />}

        {!isMFAEnabled && !showQRCode && (
          <AdminGradButton
            onClick={handleEnableMFA}
            disabled={isEnabling}
            className="w-full"
          >
            <Smartphone className="h-4 w-4 mr-2" />
            {isEnabling ? 'Setting up…' : 'Enable MFA'}
          </AdminGradButton>
        )}

        {showQRCode && qrCodeData && (
          <div className="space-y-4 p-4 border border-border rounded-2xl bg-secondary/40">
            <div className="text-left">
              <h4 className="font-semibold text-sm mb-2">Set up your authenticator app</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Scan this QR code with your authenticator app (like Google Authenticator, Authy, or 1Password)
              </p>

              <div className="flex justify-center mb-4">
                <div className="p-4 bg-card rounded-2xl border border-border">
                  <img
                    src={qrCodeData.qr_code}
                    alt="QR Code for MFA setup"
                    className="w-48 h-48"
                  />
                </div>
              </div>

              <div className="p-3 bg-secondary/60 border border-border rounded-xl space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground">Backup secret key</p>
                <p className="text-xs font-mono break-all text-foreground select-all">{qrCodeData.secret}</p>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(qrCodeData!.secret)}
                  className="text-xs text-[var(--brand-violet)] hover:underline"
                >
                  Copy key
                </button>
                <p className="text-xs text-muted-foreground">
                  Save this key somewhere safe. If you lose your authenticator device, you can re-add your account manually using this key.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="totp-code" className="text-sm font-semibold">Enter the 6-digit code from your app</Label>
                <Input
                  id="totp-code"
                  type="text"
                  className={cn(adminInputClass, 'text-center text-lg tracking-widest')}
                  placeholder="000000"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                />
              </div>

              <div className="flex gap-2 mt-4">
                <AdminGradButton
                  onClick={handleVerifyAndEnableMFA}
                  disabled={isEnabling || totpCode.length !== 6}
                  className="flex-1"
                >
                  {isEnabling ? 'Verifying…' : 'Verify & enable'}
                </AdminGradButton>
                <AdminGhostButton
                  onClick={handleCancelEnrollment}
                  disabled={isEnabling}
                >
                  Cancel
                </AdminGhostButton>
              </div>
            </div>
          </div>
        )}

        {isMFAEnabled && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <AdminGhostButton className="w-full text-destructive hover:text-destructive hover:border-destructive/50">
                Disable MFA
              </AdminGhostButton>
            </AlertDialogTrigger>
            <AdminAlertPanel
              title="Disable multi-factor authentication?"
              description="This will remove the extra security layer from your account. You'll only need your password to sign in."
              footer={
                <>
                  <AdminAlertCancel>Cancel</AdminAlertCancel>
                  <AdminAlertConfirm
                    destructive
                    onClick={handleDisableMFA}
                    disabled={isDisabling}
                  >
                    {isDisabling ? 'Disabling…' : 'Disable MFA'}
                  </AdminAlertConfirm>
                </>
              }
            />
          </AlertDialog>
        )}
      </div>
    </AdminCard>
  );
}
