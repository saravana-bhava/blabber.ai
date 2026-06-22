'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

import { PageShell } from '@/components/layout/page-header';
import { RequireAuth } from '@/components/auth/require-auth';
import { useUser } from '@/lib/contexts/user-context';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Copy, DollarSign, ExternalLink, Link2, Settings, Share2, TrendingUp,
  Users, Wallet,
} from 'lucide-react';
import {
  AdminCard, AdminGradButton, AdminLoadingSpinner, AdminPill,
  AdminSectionTitle, AdminStatTile, AdminTableHeaderRow, AdminTableShell,
  AdminTh, adminInputClass, adminTabListClass, adminTabTriggerClass, adminTdClass,
} from '@/components/admin/admin-ui';

interface ReferralRow {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  via_username?: string | null;
}

function dollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://blabber.ai';

function AffiliateDashboardInner() {
  const router = useRouter();
  const supabase = createClient();
  const { session, profile, affiliateProfile, isAffiliate, isLoading: isUserLoading, refreshAccountRoles } = useUser();

  const [firstDegree, setFirstDegree] = useState<ReferralRow[]>([]);
  const [secondDegree, setSecondDegree] = useState<ReferralRow[]>([]);
  const [isReferralsLoading, setIsReferralsLoading] = useState(false);

  const [settingsName, setSettingsName] = useState('');
  const [settingsSolana, setSettingsSolana] = useState('');
  const [settingsEthereum, setSettingsEthereum] = useState('');
  const [settingsPolygon, setSettingsPolygon] = useState('');
  const [settingsBitcoin, setSettingsBitcoin] = useState('');
  const [settingsBankAcct, setSettingsBankAcct] = useState('');
  const [settingsBankRouting, setSettingsBankRouting] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);

  const affiliateLink = profile?.referral_code ? `${APP_URL}/ref/${profile.referral_code}` : null;

  useEffect(() => {
    if (!isUserLoading && !session) { router.push('/'); return; }
    if (!isUserLoading && session && !isAffiliate) { router.push('/become-an-affiliate'); }
  }, [isUserLoading, session, isAffiliate, router]);

  useEffect(() => {
    if (affiliateProfile) {
      setSettingsName(affiliateProfile.name);
      setSettingsSolana(affiliateProfile.solana_address ?? '');
      setSettingsEthereum(affiliateProfile.ethereum_address ?? '');
      setSettingsPolygon(affiliateProfile.polygon_address ?? '');
      setSettingsBitcoin(affiliateProfile.bitcoin_address ?? '');
      setSettingsBankAcct(affiliateProfile.bank_account_number ?? '');
      setSettingsBankRouting(affiliateProfile.bank_routing_number ?? '');
    }
  }, [affiliateProfile]);

  const loadReferrals = useCallback(async () => {
    if (!profile?.id) return;
    setIsReferralsLoading(true);
    try {
      // 1st degree: profiles directly referred by me
      const { data: direct } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, updated_at')
        .eq('referred_by_profile_id', profile.id)
        .order('updated_at', { ascending: false })
        .limit(200);

      const directRows: ReferralRow[] = (direct ?? []).map((p) => ({
        id: p.id,
        username: p.username,
        full_name: p.full_name,
        avatar_url: p.avatar_url,
        created_at: p.updated_at,
      }));
      setFirstDegree(directRows);

      // 2nd degree: profiles referred by my 1st-degree referrals
      const directIds = directRows.map((r) => r.id);
      if (directIds.length === 0) { setSecondDegree([]); return; }

      const { data: indirect } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, updated_at, referred_by_profile_id')
        .in('referred_by_profile_id', directIds)
        .order('updated_at', { ascending: false })
        .limit(500);

      const directById = new Map(directRows.map((r) => [r.id, r]));
      const secondRows: ReferralRow[] = (indirect ?? []).map((p) => ({
        id: p.id,
        username: p.username,
        full_name: p.full_name,
        avatar_url: p.avatar_url,
        created_at: p.updated_at,
        via_username: directById.get(p.referred_by_profile_id)?.username ?? null,
      }));
      setSecondDegree(secondRows);
    } finally {
      setIsReferralsLoading(false);
    }
  }, [profile?.id, supabase]);

  useEffect(() => {
    if (profile?.id && isAffiliate) void loadReferrals();
  }, [profile?.id, isAffiliate, loadReferrals]);

  const handleCopyLink = () => {
    if (!affiliateLink) return;
    void navigator.clipboard.writeText(affiliateLink).then(() => toast.success('Link copied!'));
  };

  const handleNativeShare = () => {
    if (!affiliateLink || !navigator.share) return;
    void navigator.share({ title: 'Join me on Blabber', url: affiliateLink });
  };

  const handleSaveSettings = async () => {
    if (!profile?.id) return;
    setSettingsSaving(true);
    try {
      const { error } = await supabase
        .from('affiliate_profiles')
        .update({
          name: settingsName,
          solana_address: settingsSolana || null,
          ethereum_address: settingsEthereum || null,
          polygon_address: settingsPolygon || null,
          bitcoin_address: settingsBitcoin || null,
          bank_account_number: settingsBankAcct || null,
          bank_routing_number: settingsBankRouting || null,
          updated_at: new Date().toISOString(),
        })
        .eq('profile_id', profile.id);
      if (error) throw error;
      toast.success('Settings saved');
      void refreshAccountRoles();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSettingsSaving(false);
    }
  };

  const referralRow = (r: ReferralRow, showVia = false) => (
    <TableRow key={r.id} className="admin-row border-b border-border">
      <TableCell className={adminTdClass}>
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 ring-2 ring-border">
            <AvatarImage src={r.avatar_url ?? undefined} />
            <AvatarFallback className="text-xs font-bold bg-secondary">
              {(r.full_name ?? r.username ?? '?').slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold leading-none">{r.full_name ?? r.username ?? 'Unnamed'}</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">@{r.username ?? '—'}</p>
          </div>
        </div>
      </TableCell>
      {showVia && (
        <TableCell className={cn(adminTdClass, 'text-[12.5px] text-muted-foreground')}>
          {r.via_username ? `@${r.via_username}` : '—'}
        </TableCell>
      )}
      <TableCell className={cn(adminTdClass, 'text-[12.5px] text-muted-foreground')}>
        {formatDate(r.created_at)}
      </TableCell>
      <TableCell className={adminTdClass}>
        {r.username ? (
          <a href={`/u/${r.username}`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground">
            <ExternalLink className="h-3.5 w-3.5" /> View
          </a>
        ) : null}
      </TableCell>
    </TableRow>
  );

  return (
    <RequireAuth>
      <PageShell
        title="Affiliate dashboard"
        subtitle={affiliateProfile?.name ?? 'Referral earnings'}
        rightActions={
          <AdminPill variant="staff" className="hidden sm:inline-flex">
            <Link2 className="h-3.5 w-3.5" />
            Affiliate
          </AdminPill>
        }
      >
        <div className="max-w-[980px] mx-auto px-5 md:px-6 py-5 pb-16 space-y-6">
          {/* Stat tiles */}
          <div className="grid gap-3.5 grid-cols-1 sm:grid-cols-4 items-stretch">
            <AdminStatTile
              label="Direct referrals"
              value={String(firstDegree.length)}
              icon={Users}
              accent="var(--brand-grad-soft)"
            />
            <AdminStatTile
              label="2nd-degree referrals"
              value={String(secondDegree.length)}
              icon={Share2}
              accent="var(--brand-grad-soft)"
            />
            <AdminStatTile
              label="Lifetime earnings"
              value={dollars(0)}
              icon={TrendingUp}
              accent="var(--brand-grad)"
              detail="Commission tracking coming soon"
            />
            <AdminStatTile
              label="Unpaid balance"
              value={dollars(0)}
              icon={Wallet}
              accent="linear-gradient(135deg, oklch(0.8 0.13 86 / 0.25), oklch(0.72 0.15 60 / 0.25))"
            />
          </div>

          <Tabs defaultValue="link" className="space-y-6">
            <TabsList className={adminTabListClass}>
              <TabsTrigger value="link" className={adminTabTriggerClass}>
                <Link2 className="h-4 w-4" /> Affiliate link
              </TabsTrigger>
              <TabsTrigger value="referrals" className={adminTabTriggerClass}>
                <Users className="h-4 w-4" /> Referrals
              </TabsTrigger>
              <TabsTrigger value="revenue" className={adminTabTriggerClass}>
                <DollarSign className="h-4 w-4" /> Revenue
              </TabsTrigger>
              <TabsTrigger value="settings" className={adminTabTriggerClass}>
                <Settings className="h-4 w-4" /> Settings
              </TabsTrigger>
            </TabsList>

            {/* Affiliate link tab */}
            <TabsContent value="link" className="mt-0 space-y-5">
              <AdminCard>
                <AdminSectionTitle
                  title="Your referral link"
                  description="Share this link anywhere. Anyone who signs up through it is credited to you."
                />
                <div
                  className="rounded-2xl border border-border p-5 space-y-4"
                  style={{ background: 'var(--brand-grad-soft)' }}
                >
                  <p className="text-[13px] font-semibold text-muted-foreground uppercase tracking-widest">Your link</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate text-sm font-mono font-bold text-foreground bg-background/60 rounded-xl px-4 py-3 border border-border">
                      {affiliateLink ?? '—'}
                    </code>
                    <button
                      onClick={handleCopyLink}
                      disabled={!affiliateLink}
                      className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-foreground text-background text-sm font-semibold shrink-0 hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      <Copy className="h-4 w-4" /> Copy
                    </button>
                    {typeof navigator !== 'undefined' && 'share' in navigator && (
                      <button
                        onClick={handleNativeShare}
                        disabled={!affiliateLink}
                        className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-border text-sm font-semibold shrink-0 hover:bg-muted/60 transition-colors disabled:opacity-50"
                      >
                        <Share2 className="h-4 w-4" /> Share
                      </button>
                    )}
                  </div>
                </div>

                {/* How it works */}
                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  {[
                    { step: '1', title: 'Share your link', body: 'Post it anywhere — social media, DMs, bio, wherever your audience is.' },
                    { step: '2', title: 'Friends join', body: 'When someone clicks your link and signs up, they\'re permanently attributed to you.' },
                    { step: '3', title: 'You earn', body: `${affiliateProfile?.commission_pct_1 ?? 5}% commission on their activity · ${affiliateProfile?.commission_pct_2 ?? 2}% on their referrals too.` },
                  ].map(({ step, title, body }) => (
                    <div key={step} className="rounded-2xl border border-border bg-muted/30 px-4 py-4 space-y-1.5">
                      <div
                        className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white"
                        style={{ background: 'var(--brand-grad)' }}
                      >
                        {step}
                      </div>
                      <p className="text-sm font-bold">{title}</p>
                      <p className="text-[12.5px] text-muted-foreground leading-relaxed">{body}</p>
                    </div>
                  ))}
                </div>
              </AdminCard>
            </TabsContent>

            {/* Referrals tab */}
            <TabsContent value="referrals" className="mt-0 space-y-5">
              <AdminCard>
                <AdminSectionTitle
                  title="Direct referrals"
                  description="Users who signed up using your link."
                />
                {isReferralsLoading ? (
                  <AdminLoadingSpinner className="min-h-[120px]" />
                ) : firstDegree.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center" style={{ background: 'var(--brand-grad-soft)' }}>
                    <Users className="mx-auto h-8 w-8 text-[var(--brand-pink)] mb-3" />
                    <p className="text-sm font-semibold">No referrals yet</p>
                    <p className="text-[12.5px] text-muted-foreground mt-1">Share your link to start bringing people in.</p>
                  </div>
                ) : (
                  <AdminTableShell>
                    <Table>
                      <TableHeader>
                        <AdminTableHeaderRow>
                          <AdminTh>User</AdminTh>
                          <AdminTh>Joined</AdminTh>
                          <AdminTh>{''}</AdminTh>
                        </AdminTableHeaderRow>
                      </TableHeader>
                      <TableBody>{firstDegree.map((r) => referralRow(r, false))}</TableBody>
                    </Table>
                  </AdminTableShell>
                )}
              </AdminCard>

              <AdminCard>
                <AdminSectionTitle
                  title="2nd-degree referrals"
                  description="Users referred by your direct referrals."
                />
                {isReferralsLoading ? (
                  <AdminLoadingSpinner className="min-h-[120px]" />
                ) : secondDegree.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center" style={{ background: 'var(--brand-grad-soft)' }}>
                    <Share2 className="mx-auto h-8 w-8 text-[var(--brand-pink)] mb-3" />
                    <p className="text-sm font-semibold">No 2nd-degree referrals yet</p>
                    <p className="text-[12.5px] text-muted-foreground mt-1">These appear when your referrals bring in others.</p>
                  </div>
                ) : (
                  <AdminTableShell>
                    <Table>
                      <TableHeader>
                        <AdminTableHeaderRow>
                          <AdminTh>User</AdminTh>
                          <AdminTh>Via</AdminTh>
                          <AdminTh>Joined</AdminTh>
                          <AdminTh>{''}</AdminTh>
                        </AdminTableHeaderRow>
                      </TableHeader>
                      <TableBody>{secondDegree.map((r) => referralRow(r, true))}</TableBody>
                    </Table>
                  </AdminTableShell>
                )}
              </AdminCard>
            </TabsContent>

            {/* Revenue tab */}
            <TabsContent value="revenue" className="mt-0">
              <AdminCard>
                <AdminSectionTitle
                  title="Commission revenue"
                  description="Cash earnings from your referral network."
                />
                <div
                  className="rounded-2xl border border-dashed border-border px-6 py-12 text-center space-y-2"
                  style={{ background: 'var(--brand-grad-soft)' }}
                >
                  <TrendingUp className="mx-auto h-8 w-8 text-[var(--brand-pink)] mb-1" />
                  <p className="text-sm font-semibold">Referral tracking is live</p>
                  <p className="text-[12.5px] text-muted-foreground leading-relaxed max-w-xs mx-auto">
                    Commission earnings will appear here once payment attribution is wired up.
                    Your referral chain is already being recorded.
                  </p>
                </div>
              </AdminCard>
            </TabsContent>

            {/* Settings tab */}
            <TabsContent value="settings" className="mt-0">
              <AdminCard>
                <AdminSectionTitle
                  title="Affiliate settings"
                  description="Your display name and payout destinations."
                />
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="set-name" className="text-sm font-semibold">Name</Label>
                    <Input id="set-name" className={adminInputClass} value={settingsName} onChange={(e) => setSettingsName(e.target.value)} />
                  </div>

                  <div>
                    <p className="text-sm font-bold mb-3">Commission rates (set by platform)</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Direct referral (1st)</span>
                        <span className="text-sm font-bold">{affiliateProfile?.commission_pct_1 ?? 5}%</span>
                      </div>
                      <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">2nd degree</span>
                        <span className="text-sm font-bold">{affiliateProfile?.commission_pct_2 ?? 2}%</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-bold mb-3">Crypto payout addresses</p>
                    <div className="grid gap-4 md:grid-cols-2">
                      {[
                        { id: 'sol', label: 'Solana', value: settingsSolana, set: setSettingsSolana },
                        { id: 'eth', label: 'Ethereum', value: settingsEthereum, set: setSettingsEthereum },
                        { id: 'poly', label: 'Polygon', value: settingsPolygon, set: setSettingsPolygon },
                        { id: 'btc', label: 'Bitcoin', value: settingsBitcoin, set: setSettingsBitcoin },
                      ].map(({ id, label, value, set }) => (
                        <div key={id} className="space-y-2">
                          <Label htmlFor={`set-${id}`} className="text-sm font-semibold">{label}</Label>
                          <Input id={`set-${id}`} className={adminInputClass} value={value} onChange={(e) => set(e.target.value)} />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-bold mb-3">Bank payout</p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="set-bank" className="text-sm font-semibold">Account #</Label>
                        <Input id="set-bank" className={adminInputClass} value={settingsBankAcct} onChange={(e) => setSettingsBankAcct(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="set-routing" className="text-sm font-semibold">Routing #</Label>
                        <Input id="set-routing" className={adminInputClass} value={settingsBankRouting} onChange={(e) => setSettingsBankRouting(e.target.value)} />
                      </div>
                    </div>
                  </div>

                  <AdminGradButton onClick={handleSaveSettings} disabled={settingsSaving} className="w-full sm:w-auto">
                    {settingsSaving ? 'Saving…' : 'Save settings'}
                  </AdminGradButton>
                </div>
              </AdminCard>
            </TabsContent>
          </Tabs>
        </div>
      </PageShell>
    </RequireAuth>
  );
}

export default function AffiliateDashboardPage() {
  return <AffiliateDashboardInner />;
}
