'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, Link2, Share2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useUser } from '@/lib/contexts/user-context';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://blabber.ai';

interface InviteFriendsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteFriendsModal({ open, onOpenChange }: InviteFriendsModalProps) {
  const router = useRouter();
  const { profile, isAffiliate } = useUser();
  const supabase = createClient();

  const [creditAmount, setCreditAmount] = useState<number>(1000);
  const [creditsEnabled, setCreditsEnabled] = useState(true);
  const [referralCount, setReferralCount] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const referralLink = profile?.referral_code ? `${APP_URL}/ref/${profile.referral_code}` : null;
  const shortCode = profile?.referral_code ?? null;

  useEffect(() => {
    if (!open) return;
    setCopied(false);

    void fetch('/api/affiliate/platform-settings')
      .then((r) => r.json())
      .then((data) => {
        if (typeof data.referral_credit_amount === 'number') setCreditAmount(data.referral_credit_amount);
        if (typeof data.referral_credits_enabled === 'boolean') setCreditsEnabled(data.referral_credits_enabled);
      })
      .catch(() => {});

    if (profile?.id) {
      void supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('referred_by_profile_id', profile.id)
        .then(({ count }) => {
          if (count !== null) setReferralCount(count);
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, profile?.id]);

  const handleCopy = () => {
    if (!referralLink) return;
    void navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      toast.success('Link copied!');
      window.setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleShare = () => {
    if (!referralLink || !navigator.share) return;
    void navigator.share({
      title: 'Join me on Blabber',
      text: creditsEnabled
        ? `Join me on Blabber and we both get ${creditAmount.toLocaleString()} credits!`
        : 'Join me on Blabber',
      url: referralLink,
    });
  };

  const canShare = typeof navigator !== 'undefined' && 'share' in navigator;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden rounded-2xl">

        {/* Header band */}
        <div
          className="px-6 pt-6 pb-5 text-white"
          style={{ background: 'var(--brand-grad)' }}
        >
          <DialogHeader>
            <DialogTitle className="text-white text-[17px] font-bold leading-tight">
              Invite friends
            </DialogTitle>
          </DialogHeader>

          {creditsEnabled ? (
            <div className="mt-3 flex items-center gap-4">
              <div className="text-center">
                <p className="text-[28px] font-extrabold leading-none tabular-nums">
                  {creditAmount.toLocaleString()}
                </p>
                <p className="text-[11px] font-semibold opacity-80 mt-0.5">you earn</p>
              </div>
              <div className="flex-1 h-px bg-white/30" />
              <div className="text-center">
                <p className="text-[28px] font-extrabold leading-none tabular-nums">
                  {creditAmount.toLocaleString()}
                </p>
                <p className="text-[11px] font-semibold opacity-80 mt-0.5">they get</p>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm opacity-85">
              Share your link and grow your network.
            </p>
          )}
        </div>

        <div className="px-5 py-5 space-y-4">

          {/* Referral code pill */}
          {shortCode && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/30 px-4 py-2.5">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Your code</p>
                <p className="text-base font-bold font-mono tracking-wide">{shortCode}</p>
              </div>
              <div className="text-[10.5px] text-muted-foreground truncate text-right max-w-[120px] hidden xs:block">
                {referralLink}
              </div>
            </div>
          )}

          {/* Primary CTA */}
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              disabled={!referralLink}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.97] disabled:opacity-50',
                copied ? 'bg-emerald-500' : ''
              )}
              style={!copied ? { background: 'var(--brand-grad)' } : undefined}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy invite link
                </>
              )}
            </button>

            {canShare && (
              <button
                onClick={handleShare}
                disabled={!referralLink}
                title="Share"
                className="flex items-center justify-center w-11 h-11 rounded-xl border border-border hover:bg-muted/60 transition-colors disabled:opacity-50 shrink-0"
              >
                <Share2 className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Stats */}
          {referralCount !== null && referralCount > 0 && (
            <div className="flex items-center gap-2.5 rounded-xl border border-border px-3.5 py-2.5 bg-muted/20">
              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground">
                <span className="font-bold text-foreground">{referralCount}</span>
                {' '}{referralCount === 1 ? 'friend has' : 'friends have'} joined via your link
              </span>
            </div>
          )}

          {/* Affiliate upsell / link */}
          <div className="border-t border-border pt-4">
            {isAffiliate ? (
              <button
                onClick={() => { onOpenChange(false); router.push('/affiliate-dashboard'); }}
                className="w-full text-sm font-semibold text-center"
                style={{ color: 'var(--brand-pink)' }}
              >
                View affiliate dashboard →
              </button>
            ) : (
              <button
                onClick={() => { onOpenChange(false); router.push('/become-an-affiliate'); }}
                className="w-full flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-left hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0 text-white"
                    style={{ background: 'var(--brand-grad)' }}
                  >
                    <Link2 className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Earn cash commissions</p>
                    <p className="text-[11.5px] text-muted-foreground">Become an affiliate →</p>
                  </div>
                </div>
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
