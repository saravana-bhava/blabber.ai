'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

import { PageShell } from '@/components/layout/page-header';
import { useUser } from '@/lib/contexts/user-context';
import { RequireAuth } from '@/components/auth/require-auth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { BlockedUsersTable } from '@/components/account/blocked-users-table';
import { MFASettings } from '@/components/account/mfa-settings';
import { CreditCard, Trash2, Star } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  AdminCard,
  AdminSectionTitle,
  AdminPill,
  AdminGradButton,
  AdminGhostButton,
  AdminLoadingSpinner,
  AdminStatusPill,
  AdminAlertPanel,
  AdminAlertCancel,
  AdminAlertConfirm,
  adminInputClass,
} from '@/components/admin/admin-ui';

type PaymentMethodRow = { id: string; last4: string; brand: string | null; exp_month: number | null; exp_year: number | null; is_default: boolean };

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

export default function AccountPage() {
  const supabase = createClient();
  const router = useRouter();
  const { session, profile, isLoading } = useUser();

  const [newEmail, setNewEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMessage, setEmailMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRow[]>([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(true);

  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;
    setPaymentMethodsLoading(true);
    supabase
      .from('user_payment_methods')
      .select('id, last4, brand, exp_month, exp_year, is_default')
      .eq('user_id', session.user.id)
      .order('is_default', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setPaymentMethods((data as PaymentMethodRow[]) || []);
        setPaymentMethodsLoading(false);
      });
  }, [session?.user?.id]);

  const setDefaultPaymentMethod = async (id: string) => {
    if (!session?.user?.id) return;
    await supabase.from('user_payment_methods').update({ is_default: false }).eq('user_id', session.user.id);
    const { error } = await supabase.from('user_payment_methods').update({ is_default: true }).eq('id', id).eq('user_id', session.user.id);
    if (!error) {
      setPaymentMethods(prev => prev.map(p => ({ ...p, is_default: p.id === id })));
      toast.success('Default payment method updated');
    } else toast.error('Failed to update');
  };

  const removePaymentMethod = async (id: string) => {
    if (!session?.user?.id) return;
    const { error } = await supabase.from('user_payment_methods').delete().eq('id', id).eq('user_id', session.user.id);
    if (!error) {
      setPaymentMethods(prev => prev.filter(p => p.id !== id));
      toast.success('Payment method removed');
    } else toast.error('Failed to remove');
  };

  const handleEmailChange = async () => {
    if (!newEmail || !session?.user) return;

    setEmailLoading(true);
    setEmailMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });

      if (error) {
        setEmailMessage({ type: 'error', text: error.message });
      } else {
        setEmailMessage({ type: 'success', text: 'Check your email for a confirmation link to update your email address.' });
        setNewEmail('');
      }
    } catch {
      setEmailMessage({ type: 'error', text: 'An unexpected error occurred. Please try again.' });
    } finally {
      setEmailLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword || !session?.user) return;

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 6 characters long.' });
      return;
    }

    setPasswordLoading(true);
    setPasswordMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        setPasswordMessage({ type: 'error', text: error.message });
      } else {
        setPasswordMessage({ type: 'success', text: 'Password updated successfully!' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch {
      setPasswordMessage({ type: 'error', text: 'An unexpected error occurred. Please try again.' });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleAccountDeletion = async () => {
    if (!session?.user) return;

    setDeleteLoading(true);
    setDeleteMessage(null);

    try {
      const { error } = await supabase.auth.admin.deleteUser(session.user.id);

      if (error) {
        setDeleteMessage({ type: 'error', text: error.message });
      } else {
        setDeleteMessage({ type: 'success', text: 'Account deleted successfully. You will be redirected to the home page.' });
        setTimeout(() => {
          router.push('/');
        }, 2000);
      }
    } catch {
      setDeleteMessage({ type: 'error', text: 'An unexpected error occurred. Please try again.' });
    } finally {
      setDeleteLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <AdminLoadingSpinner className="min-h-[200px]" />
        <p className="text-sm text-muted-foreground">Loading account settings…</p>
      </div>
    );
  }

  return (
    <RequireAuth>
      <PageShell
        title="Account settings"
        subtitle={session?.user?.email ?? 'Security & preferences'}
        rightActions={
          <AdminPill variant="staff" className="hidden sm:inline-flex">
            Account
          </AdminPill>
        }
      >
        <div className="brand-form max-w-[720px] mx-auto w-full min-w-0 px-5 md:px-6 py-5 pb-16 space-y-5">
          <AdminCard>
            <AdminSectionTitle
              title="Change email address"
              description="We'll send a confirmation link to your new address"
            />
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-email" className="text-sm font-semibold">New email address</Label>
                <Input
                  id="new-email"
                  type="email"
                  className={adminInputClass}
                  placeholder="Enter new email address"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
              {emailMessage && <FormFeedback type={emailMessage.type} text={emailMessage.text} />}
              <AdminGradButton
                onClick={handleEmailChange}
                disabled={emailLoading || !newEmail}
                className="w-full"
              >
                {emailLoading ? 'Updating…' : 'Update email'}
              </AdminGradButton>
            </div>
          </AdminCard>

          <AdminCard>
            <AdminSectionTitle
              title="Change password"
              description="Use a strong password you don't use elsewhere"
            />
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password" className="text-sm font-semibold">Current password</Label>
                <Input
                  id="current-password"
                  type="password"
                  className={adminInputClass}
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-sm font-semibold">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  className={adminInputClass}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-sm font-semibold">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  className={adminInputClass}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              {passwordMessage && <FormFeedback type={passwordMessage.type} text={passwordMessage.text} />}
              <AdminGradButton
                onClick={handlePasswordChange}
                disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
                className="w-full"
              >
                {passwordLoading ? 'Updating…' : 'Update password'}
              </AdminGradButton>
            </div>
          </AdminCard>

          <MFASettings userId={profile?.id || ''} />

          <AdminCard>
            <AdminSectionTitle
              title="Blocked users"
              description="People you've blocked can't see your content or message you"
            />
            <BlockedUsersTable currentUserId={profile?.id || ''} />
          </AdminCard>

          <AdminCard>
            <AdminSectionTitle
              title="Payment methods"
              description="Saved cards are used for subscription renewals and one-click checkout"
            />
            <p className="text-sm text-muted-foreground -mt-2 mb-4">
              You can also manage these in{' '}
              <Link href="/profile-settings" className="font-semibold text-[var(--brand-pink)] hover:underline underline-offset-2">
                profile settings
              </Link>
              .
            </p>
            {paymentMethodsLoading ? (
              <AdminLoadingSpinner className="min-h-[80px]" />
            ) : paymentMethods.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No saved payment methods. Add one when you make a purchase and choose to save your card.
              </p>
            ) : (
              <ul className="space-y-2">
                {paymentMethods.map((pm) => (
                  <li key={pm.id} className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-secondary/40 p-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <CreditCard className="h-4 w-4 text-[var(--brand-violet)] shrink-0" />
                      <span className="font-mono text-sm tabular-nums">•••• {pm.last4}</span>
                      <span className="text-sm text-muted-foreground capitalize">{pm.brand || 'Card'}</span>
                      {pm.exp_month != null && pm.exp_year != null && (
                        <span className="text-sm text-muted-foreground tabular-nums">{String(pm.exp_month).padStart(2, '0')}/{pm.exp_year}</span>
                      )}
                      {pm.is_default && <AdminStatusPill variant="gold">Default</AdminStatusPill>}
                    </div>
                    <div className="flex items-center gap-1">
                      {!pm.is_default && (
                        <AdminGhostButton size="sm" className="h-8 w-8 p-0" onClick={() => setDefaultPaymentMethod(pm.id)} title="Set as default">
                          <Star className="w-4 h-4" />
                        </AdminGhostButton>
                      )}
                      <AdminGhostButton size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => removePaymentMethod(pm.id)} title="Remove">
                        <Trash2 className="w-4 h-4" />
                      </AdminGhostButton>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>

          <AdminCard className="border-destructive/30">
            <AdminSectionTitle
              title="Delete account"
              description="This action cannot be undone. All your data will be permanently removed."
            />
            <div className="space-y-4">
              {deleteMessage && <FormFeedback type={deleteMessage.type} text={deleteMessage.text} />}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <AdminGhostButton className="w-full text-destructive hover:text-destructive hover:border-destructive/50">
                    Delete account
                  </AdminGhostButton>
                </AlertDialogTrigger>
                <AdminAlertPanel
                  title="Are you absolutely sure?"
                  description="This action cannot be undone. This will permanently delete your account and remove all your data from our servers."
                  footer={
                    <>
                      <AdminAlertCancel>Cancel</AdminAlertCancel>
                      <AdminAlertConfirm
                        destructive
                        onClick={handleAccountDeletion}
                        disabled={deleteLoading}
                      >
                        {deleteLoading ? 'Deleting…' : 'Delete account'}
                      </AdminAlertConfirm>
                    </>
                  }
                />
              </AlertDialog>
            </div>
          </AdminCard>
        </div>
      </PageShell>
    </RequireAuth>
  );
}
