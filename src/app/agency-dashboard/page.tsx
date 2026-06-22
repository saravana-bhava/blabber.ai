'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

import { PageShell } from '@/components/layout/page-header';
import { RequireAuth } from '@/components/auth/require-auth';
import { useUser } from '@/lib/contexts/user-context';
import { cn } from '@/lib/utils';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import {
  DollarSign,
  ExternalLink,
  Mail,
  Settings,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import {
  AdminStatTile,
  AdminCard,
  AdminSectionTitle,
  AdminPill,
  AdminGradButton,
  AdminGhostButton,
  AdminLoadingSpinner,
  AdminStatusPill,
  AdminTableShell,
  AdminTableHeaderRow,
  AdminTh,
  adminTdClass,
  adminInputClass,
  adminTabTriggerClass,
  adminTabListClass,
} from '@/components/admin/admin-ui';

interface ManagedCreatorRow {
  profile_id: string;
  agency_split_pct_override: number | null;
  is_agency_operated: boolean;
  veriff_verification_status: string | null;
  can_monetize: boolean | null;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  lifetime_revenue_cents: number;
  lifetime_agency_share_cents: number;
}

const REVENUE_STATUS_TX_TABLES = [
  'subscription_payments',
  'tip_transactions',
  'ppv_transactions',
] as const;

function addCreatorLifetime(
  map: Map<string, { revenue: number; agencyShare: number }>,
  creatorId: string | null | undefined,
  revenue: number,
  agencyShare: number
) {
  if (!creatorId) return;
  const cur = map.get(creatorId) ?? { revenue: 0, agencyShare: 0 };
  cur.revenue += revenue;
  cur.agencyShare += agencyShare;
  map.set(creatorId, cur);
}

function dollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function AgencyDashboardInner() {
  const router = useRouter();
  const supabase = createClient();
  const { session, profile, agency, isAgency, isLoading: isUserLoading, refreshAccountRoles } = useUser();

  const [creators, setCreators] = useState<ManagedCreatorRow[]>([]);
  const [isCreatorsLoading, setIsCreatorsLoading] = useState(false);
  const [revenueByMonth, setRevenueByMonth] = useState<{ month: string; agency_cents: number }[]>([]);
  const [totalAgencyEarnings, setTotalAgencyEarnings] = useState(0);
  const [unpaidAgencyEarnings, setUnpaidAgencyEarnings] = useState(0);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFullName, setInviteFullName] = useState('');
  const [inviteSplitPct, setInviteSplitPct] = useState<string>('');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);

  const [operatedFullName, setOperatedFullName] = useState('');
  const [operatedUsername, setOperatedUsername] = useState('');
  const [operatedSplitPct, setOperatedSplitPct] = useState<string>('');
  const [operatedSubmitting, setOperatedSubmitting] = useState(false);

  const [settingsName, setSettingsName] = useState('');
  const [settingsSplit, setSettingsSplit] = useState('');
  const [settingsSolana, setSettingsSolana] = useState('');
  const [settingsEthereum, setSettingsEthereum] = useState('');
  const [settingsPolygon, setSettingsPolygon] = useState('');
  const [settingsBitcoin, setSettingsBitcoin] = useState('');
  const [settingsBankAcct, setSettingsBankAcct] = useState('');
  const [settingsBankRouting, setSettingsBankRouting] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);

  useEffect(() => {
    if (!isUserLoading && !session) {
      router.push('/');
      return;
    }
    if (!isUserLoading && session && !isAgency) {
      router.push('/become-an-agency');
    }
  }, [isUserLoading, session, isAgency, router]);

  useEffect(() => {
    if (agency) {
      setSettingsName(agency.name);
      setSettingsSplit(String(agency.default_split_pct));
      setSettingsSolana(agency.solana_address ?? '');
      setSettingsEthereum(agency.ethereum_address ?? '');
      setSettingsPolygon(agency.polygon_address ?? '');
      setSettingsBitcoin(agency.bitcoin_address ?? '');
      setSettingsBankAcct(agency.bank_account_number ?? '');
      setSettingsBankRouting(agency.bank_routing_number ?? '');
    }
  }, [agency]);

  const loadManagedCreators = useCallback(async () => {
    if (!profile?.id) return;
    setIsCreatorsLoading(true);
    try {
      const { data: creatorRows, error } = await supabase
        .from('creators')
        .select(
          'profile_id, agency_split_pct_override, is_agency_operated, veriff_verification_status, can_monetize'
        )
        .eq('agency_profile_id', profile.id);

      if (error) {
        console.error('Failed to load managed creators', error);
        return;
      }

      const creatorIds = (creatorRows ?? []).map((c) => c.profile_id);
      if (creatorIds.length === 0) {
        setCreators([]);
        return;
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', creatorIds);

      const profilesById = new Map(profiles?.map((p) => [p.id, p]) ?? []);

      const { data: posts } = await supabase
        .from('posts')
        .select('id, user_id')
        .in('user_id', creatorIds);

      const postIdToCreator = new Map(
        (posts ?? []).map((p) => [p.id, p.user_id as string])
      );

      const lifetimeByCreator = new Map<string, { revenue: number; agencyShare: number }>();
      for (const id of creatorIds) {
        lifetimeByCreator.set(id, { revenue: 0, agencyShare: 0 });
      }

      const { data: subTxs } = await supabase
        .from('subscription_payments')
        .select('creator_share_cents, agency_share_cents, creator_profile_id')
        .eq('agency_profile_id', profile.id)
        .eq('status', 'succeeded');
      for (const tx of subTxs ?? []) {
        addCreatorLifetime(
          lifetimeByCreator,
          tx.creator_profile_id,
          Number(tx.creator_share_cents) || 0,
          Number(tx.agency_share_cents) || 0
        );
      }

      const { data: tipTxs } = await supabase
        .from('tip_transactions')
        .select('creator_share_cents, agency_share_cents, creator_id, post_id')
        .eq('agency_profile_id', profile.id)
        .eq('status', 'succeeded');
      for (const tx of tipTxs ?? []) {
        const cid =
          tx.creator_id ?? (tx.post_id ? postIdToCreator.get(tx.post_id) : undefined);
        addCreatorLifetime(
          lifetimeByCreator,
          cid,
          Number(tx.creator_share_cents) || 0,
          Number(tx.agency_share_cents) || 0
        );
      }

      const { data: ppvTxs } = await supabase
        .from('ppv_transactions')
        .select('creator_share_cents, agency_share_cents, post_id')
        .eq('agency_profile_id', profile.id)
        .eq('status', 'succeeded');
      for (const tx of ppvTxs ?? []) {
        const cid = tx.post_id ? postIdToCreator.get(tx.post_id) : undefined;
        addCreatorLifetime(
          lifetimeByCreator,
          cid,
          Number(tx.creator_share_cents) || 0,
          Number(tx.agency_share_cents) || 0
        );
      }

      const { data: callTxs } = await supabase
        .from('call_transactions')
        .select('creator_share_cents, agency_share_cents, agency_profile_id, creator_profile_id')
        .eq('agency_profile_id', profile.id)
        .gt('credits_cents', 0);
      for (const tx of callTxs ?? []) {
        addCreatorLifetime(
          lifetimeByCreator,
          tx.creator_profile_id,
          Number(tx.creator_share_cents) || 0,
          Number(tx.agency_share_cents) || 0
        );
      }

      const { data: creatorProducts } = await supabase
        .from('creator_products')
        .select('id, creator_profile_id')
        .in('creator_profile_id', creatorIds);

      const productIdToCreator = new Map(
        (creatorProducts ?? []).map((p) => [p.id, p.creator_profile_id as string])
      );
      const productIds = [...productIdToCreator.keys()];

      if (productIds.length > 0) {
        const { data: productTxs } = await supabase
          .from('creator_product_transactions')
          .select('creator_share_cents, agency_share_cents, creator_product_id')
          .eq('agency_profile_id', profile.id)
          .eq('status', 'succeeded')
          .in('creator_product_id', productIds);

        for (const tx of productTxs ?? []) {
          addCreatorLifetime(
            lifetimeByCreator,
            productIdToCreator.get(tx.creator_product_id),
            Number(tx.creator_share_cents) || 0,
            Number(tx.agency_share_cents) || 0
          );
        }
      }

      const merged: ManagedCreatorRow[] = (creatorRows ?? []).map((c) => {
        const profileRow = profilesById.get(c.profile_id);
        const lifetime = lifetimeByCreator.get(c.profile_id) ?? { revenue: 0, agencyShare: 0 };
        return {
          profile_id: c.profile_id,
          agency_split_pct_override: c.agency_split_pct_override,
          is_agency_operated: !!c.is_agency_operated,
          veriff_verification_status: c.veriff_verification_status,
          can_monetize: c.can_monetize,
          username: profileRow?.username ?? null,
          full_name: profileRow?.full_name ?? null,
          avatar_url: profileRow?.avatar_url ?? null,
          lifetime_revenue_cents: lifetime.revenue,
          lifetime_agency_share_cents: lifetime.agencyShare,
        };
      });

      setCreators(merged);
    } finally {
      setIsCreatorsLoading(false);
    }
  }, [profile?.id, supabase]);

  const loadRevenue = useCallback(async () => {
    if (!profile?.id) return;
    let total = 0;
    let unpaid = 0;
    const monthlyMap = new Map<string, number>();
    for (const tableName of REVENUE_STATUS_TX_TABLES) {
      const { data: txs } = await supabase
        .from(tableName)
        .select('agency_share_cents, agency_payout_id, created_at')
        .eq('agency_profile_id', profile.id)
        .eq('status', 'succeeded');
      if (!txs) continue;
      for (const tx of txs as any[]) {
        const share = Number(tx.agency_share_cents) || 0;
        total += share;
        if (!tx.agency_payout_id) unpaid += share;
        const month = (tx.created_at as string)?.slice(0, 7);
        if (month) monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + share);
      }
    }

    const { data: callTxs } = await supabase
      .from('call_transactions')
      .select('agency_share_cents, agency_payout_id, created_at')
      .eq('agency_profile_id', profile.id)
      .gt('credits_cents', 0);
    for (const tx of callTxs ?? []) {
      const share = Number(tx.agency_share_cents) || 0;
      total += share;
      if (!tx.agency_payout_id) unpaid += share;
      const month = (tx.created_at as string)?.slice(0, 7);
      if (month) monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + share);
    }

    const { data: productTxs } = await supabase
      .from('creator_product_transactions')
      .select('agency_share_cents, agency_payout_id, created_at')
      .eq('agency_profile_id', profile.id)
      .eq('status', 'succeeded');
    for (const tx of productTxs ?? []) {
      const share = Number(tx.agency_share_cents) || 0;
      total += share;
      if (!tx.agency_payout_id) unpaid += share;
      const month = (tx.created_at as string)?.slice(0, 7);
      if (month) monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + share);
    }

    const monthly = Array.from(monthlyMap.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, 12)
      .map(([month, agency_cents]) => ({ month, agency_cents }));
    setRevenueByMonth(monthly);
    setTotalAgencyEarnings(total);
    setUnpaidAgencyEarnings(unpaid);
  }, [profile?.id, supabase]);

  useEffect(() => {
    if (profile?.id && isAgency) {
      void loadManagedCreators();
      void loadRevenue();
    }
  }, [profile?.id, isAgency, loadManagedCreators, loadRevenue]);

  const handleInviteCreator = async () => {
    if (!inviteEmail.trim()) {
      toast.error('Email is required');
      return;
    }
    setInviteSubmitting(true);
    try {
      const res = await fetch('/api/agency/invite-creator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          full_name: inviteFullName.trim() || undefined,
          agency_split_pct_override: inviteSplitPct ? Number(inviteSplitPct) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to invite creator');
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      setInviteFullName('');
      setInviteSplitPct('');
      void loadManagedCreators();
    } catch (e: any) {
      toast.error(e.message || 'Invite failed');
    } finally {
      setInviteSubmitting(false);
    }
  };

  const handleCreateOperated = async () => {
    if (!operatedFullName.trim() || !operatedUsername.trim()) {
      toast.error('Full name and username are required');
      return;
    }
    setOperatedSubmitting(true);
    try {
      const res = await fetch('/api/agency/create-operated-creator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: operatedFullName.trim(),
          username: operatedUsername.trim(),
          agency_split_pct_override: operatedSplitPct ? Number(operatedSplitPct) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create operated creator');
      toast.success('Operated creator created. Use “Open creator” to log in as them.');
      setOperatedFullName('');
      setOperatedUsername('');
      setOperatedSplitPct('');
      void loadManagedCreators();
    } catch (e: any) {
      toast.error(e.message || 'Create failed');
    } finally {
      setOperatedSubmitting(false);
    }
  };

  const handleOpenCreator = async (creatorProfileId: string) => {
    try {
      const res = await fetch('/api/agency/impersonate-creator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creator_profile_id: creatorProfileId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate magic link');
      window.open(data.action_link, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      toast.error(e.message || 'Could not open creator');
    }
  };

  const handleSaveSettings = async () => {
    if (!profile?.id) return;
    const splitNum = Number(settingsSplit);
    if (Number.isNaN(splitNum) || splitNum < 0 || splitNum > 100) {
      toast.error('Default split must be between 0 and 100');
      return;
    }
    setSettingsSaving(true);
    try {
      const { error } = await supabase
        .from('agencies')
        .update({
          name: settingsName,
          default_split_pct: splitNum,
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
      toast.success('Agency settings saved');
      void refreshAccountRoles();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setSettingsSaving(false);
    }
  };

  const numCreators = creators.length;
  const operatedCount = useMemo(
    () => creators.filter((c) => c.is_agency_operated).length,
    [creators]
  );
  const selfManagedCount = numCreators - operatedCount;

  return (
    <RequireAuth>
      <PageShell
        title="Agency dashboard"
        subtitle={
          agency?.name
            ? `${agency.name} · default split ${agency.default_split_pct}%`
            : 'Creator roster & revenue'
        }
        rightActions={
          agency?.name ? (
            <AdminPill variant="staff" className="hidden sm:inline-flex">
              <Users className="h-3.5 w-3.5" />
              {numCreators} managed
            </AdminPill>
          ) : null
        }
      >
        <div className="max-w-[980px] mx-auto px-5 md:px-6 py-5 pb-16 space-y-6">
          <div className="grid gap-3.5 grid-cols-1 sm:grid-cols-3 items-stretch">
            <AdminStatTile
              label="Managed creators"
              value={String(numCreators)}
              icon={Users}
              accent="var(--brand-grad-soft)"
              detail={
                numCreators > 0
                  ? `${operatedCount} operated · ${selfManagedCount} self-managed`
                  : undefined
              }
            />
            <AdminStatTile
              label="Lifetime agency earnings"
              value={dollars(totalAgencyEarnings)}
              icon={TrendingUp}
              accent="var(--brand-grad)"
            />
            <AdminStatTile
              label="Unpaid balance"
              value={dollars(unpaidAgencyEarnings)}
              icon={Wallet}
              accent="linear-gradient(135deg, oklch(0.8 0.13 86 / 0.25), oklch(0.72 0.15 60 / 0.25))"
              detail={unpaidAgencyEarnings > 0 ? 'Awaiting payout' : undefined}
            />
          </div>

          <Tabs defaultValue="creators" className="space-y-6">
            <TabsList className={adminTabListClass}>
              <TabsTrigger value="creators" className={adminTabTriggerClass}>
                <Users className="h-4 w-4" />
                Managed creators
              </TabsTrigger>
              <TabsTrigger value="add" className={adminTabTriggerClass}>
                <UserPlus className="h-4 w-4" />
                Add creator
              </TabsTrigger>
              <TabsTrigger value="revenue" className={adminTabTriggerClass}>
                <DollarSign className="h-4 w-4" />
                Revenue
              </TabsTrigger>
              <TabsTrigger value="settings" className={adminTabTriggerClass}>
                <Settings className="h-4 w-4" />
                Settings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="creators" className="mt-0">
              <AdminCard>
                <AdminSectionTitle
                  title="Your roster"
                  description={`Default split is ${agency?.default_split_pct ?? 0}%. Per-creator overrides shown below.`}
                />
                {isCreatorsLoading ? (
                  <AdminLoadingSpinner className="min-h-[160px]" />
                ) : creators.length === 0 ? (
                  <div
                    className="rounded-2xl border border-dashed border-border px-6 py-10 text-center"
                    style={{ background: 'var(--brand-grad-soft)' }}
                  >
                    <Users className="mx-auto h-8 w-8 text-[var(--brand-pink)] mb-3" />
                    <p className="text-sm font-semibold">No creators yet</p>
                    <p className="text-[12.5px] text-muted-foreground mt-1">
                      Use the Add creator tab to invite someone or create a fully operated account.
                    </p>
                  </div>
                ) : (
                  <AdminTableShell>
                    <Table>
                      <TableHeader>
                        <AdminTableHeaderRow>
                          <AdminTh>Creator</AdminTh>
                          <AdminTh>Status</AdminTh>
                          <AdminTh>Split %</AdminTh>
                          <AdminTh>Lifetime gross</AdminTh>
                          <AdminTh>Agency take</AdminTh>
                          <AdminTh>Action</AdminTh>
                        </AdminTableHeaderRow>
                      </TableHeader>
                      <TableBody>
                        {creators.map((c) => {
                          const effectiveSplit =
                            c.agency_split_pct_override ?? agency?.default_split_pct ?? 0;
                          return (
                            <TableRow key={c.profile_id} className="admin-row border-b border-border">
                              <TableCell className={adminTdClass}>
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-9 w-9 ring-2 ring-border">
                                    <AvatarImage src={c.avatar_url ?? undefined} />
                                    <AvatarFallback className="text-xs font-bold bg-secondary">
                                      {(c.full_name ?? c.username ?? '?').slice(0, 1).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="text-sm font-semibold leading-none">
                                      {c.full_name ?? c.username ?? 'Unnamed'}
                                    </p>
                                    <p className="text-[12px] text-muted-foreground mt-0.5">
                                      @{c.username ?? '—'}
                                    </p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className={adminTdClass}>
                                <div className="flex flex-wrap gap-1.5">
                                  <AdminStatusPill variant={c.can_monetize ? 'gold' : 'soft'}>
                                    {c.can_monetize ? 'Monetizing' : 'Onboarding'}
                                  </AdminStatusPill>
                                  {c.is_agency_operated && (
                                    <AdminStatusPill variant="staff">Operated</AdminStatusPill>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className={cn(adminTdClass, 'tabular-nums font-semibold text-sm')}>
                                {Number(effectiveSplit).toFixed(2)}%
                              </TableCell>
                              <TableCell className={cn(adminTdClass, 'tabular-nums text-sm')}>
                                {dollars(c.lifetime_revenue_cents)}
                              </TableCell>
                              <TableCell className={cn(adminTdClass, 'tabular-nums font-semibold text-sm')}>
                                {dollars(c.lifetime_agency_share_cents)}
                              </TableCell>
                              <TableCell className={adminTdClass}>
                                {c.is_agency_operated ? (
                                  <AdminGhostButton
                                    size="sm"
                                    className="h-8 px-3 text-[12.5px]"
                                    onClick={() => handleOpenCreator(c.profile_id)}
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    Open creator
                                  </AdminGhostButton>
                                ) : c.username ? (
                                  <AdminGhostButton size="sm" className="h-8 px-3 text-[12.5px]" asChild>
                                    <a href={`/u/${c.username}`} target="_blank" rel="noopener noreferrer">
                                      View profile
                                    </a>
                                  </AdminGhostButton>
                                ) : null}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </AdminTableShell>
                )}
              </AdminCard>
            </TabsContent>

            <TabsContent value="add" className="mt-0">
              <AdminCard>
                <AdminSectionTitle
                  title="Add a creator"
                  description="Invite by email or create a fully operated account you manage on their behalf."
                />
                <Tabs defaultValue="invite" className="w-full">
                  <TabsList className={adminTabListClass}>
                    <TabsTrigger value="invite" className={adminTabTriggerClass}>
                      <Mail className="h-4 w-4" />
                      Invite by email
                    </TabsTrigger>
                    <TabsTrigger value="operated" className={adminTabTriggerClass}>
                      <UserPlus className="h-4 w-4" />
                      Create operated account
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="invite" className="space-y-4 pt-5 mt-0">
                    <div className="space-y-2">
                      <Label htmlFor="invite-email" className="text-sm font-semibold">
                        Email
                      </Label>
                      <Input
                        id="invite-email"
                        type="email"
                        className={adminInputClass}
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="creator@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invite-name" className="text-sm font-semibold">
                        Full name (optional)
                      </Label>
                      <Input
                        id="invite-name"
                        className={adminInputClass}
                        value={inviteFullName}
                        onChange={(e) => setInviteFullName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invite-split" className="text-sm font-semibold">
                        Split % override (optional, default {agency?.default_split_pct ?? 0}%)
                      </Label>
                      <Input
                        id="invite-split"
                        type="number"
                        min={0}
                        max={100}
                        className={adminInputClass}
                        value={inviteSplitPct}
                        onChange={(e) => setInviteSplitPct(e.target.value)}
                      />
                    </div>
                    <AdminGradButton onClick={handleInviteCreator} disabled={inviteSubmitting}>
                      {inviteSubmitting ? 'Sending…' : 'Send invitation'}
                    </AdminGradButton>
                  </TabsContent>

                  <TabsContent value="operated" className="space-y-4 pt-5 mt-0">
                    <div className="space-y-2">
                      <Label htmlFor="op-name" className="text-sm font-semibold">
                        Full name
                      </Label>
                      <Input
                        id="op-name"
                        className={adminInputClass}
                        value={operatedFullName}
                        onChange={(e) => setOperatedFullName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="op-username" className="text-sm font-semibold">
                        Username
                      </Label>
                      <Input
                        id="op-username"
                        className={adminInputClass}
                        value={operatedUsername}
                        onChange={(e) => setOperatedUsername(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="op-split" className="text-sm font-semibold">
                        Split % override (optional, default {agency?.default_split_pct ?? 0}%)
                      </Label>
                      <Input
                        id="op-split"
                        type="number"
                        min={0}
                        max={100}
                        className={adminInputClass}
                        value={operatedSplitPct}
                        onChange={(e) => setOperatedSplitPct(e.target.value)}
                      />
                    </div>
                    <p className="text-[12.5px] text-muted-foreground leading-relaxed">
                      Operated creators are real auth users that you log into via a magic link in a new tab.
                      The creator can later claim the account themselves.
                    </p>
                    <AdminGradButton onClick={handleCreateOperated} disabled={operatedSubmitting}>
                      {operatedSubmitting ? 'Creating…' : 'Create operated account'}
                    </AdminGradButton>
                  </TabsContent>
                </Tabs>
              </AdminCard>
            </TabsContent>

            <TabsContent value="revenue" className="mt-0">
              <AdminCard>
                <AdminSectionTitle
                  title="Agency revenue"
                  description="Sum of agency share across all succeeded transactions attributed to your agency."
                />
                {revenueByMonth.length === 0 ? (
                  <div
                    className="rounded-2xl border border-dashed border-border px-6 py-10 text-center"
                    style={{ background: 'var(--brand-grad-soft)' }}
                  >
                    <DollarSign className="mx-auto h-8 w-8 text-[var(--brand-pink)] mb-3" />
                    <p className="text-sm font-semibold">No transactions yet</p>
                    <p className="text-[12.5px] text-muted-foreground mt-1">
                      Revenue will appear here once your creators start earning.
                    </p>
                  </div>
                ) : (
                  <AdminTableShell>
                    <Table>
                      <TableHeader>
                        <AdminTableHeaderRow>
                          <AdminTh>Month</AdminTh>
                          <AdminTh>Agency share</AdminTh>
                        </AdminTableHeaderRow>
                      </TableHeader>
                      <TableBody>
                        {revenueByMonth.map((row) => (
                          <TableRow key={row.month} className="admin-row border-b border-border">
                            <TableCell className={cn(adminTdClass, 'font-medium text-sm')}>
                              {row.month}
                            </TableCell>
                            <TableCell className={cn(adminTdClass, 'tabular-nums font-bold text-sm')}>
                              {dollars(row.agency_cents)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </AdminTableShell>
                )}
              </AdminCard>
            </TabsContent>

            <TabsContent value="settings" className="mt-0">
              <AdminCard>
                <AdminSectionTitle
                  title="Agency settings"
                  description="Default revenue split and payout destinations."
                />
                <div className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="set-name" className="text-sm font-semibold">
                        Agency name
                      </Label>
                      <Input
                        id="set-name"
                        className={adminInputClass}
                        value={settingsName}
                        onChange={(e) => setSettingsName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="set-split" className="text-sm font-semibold">
                        Default split %
                      </Label>
                      <Input
                        id="set-split"
                        type="number"
                        min={0}
                        max={100}
                        className={adminInputClass}
                        value={settingsSplit}
                        onChange={(e) => setSettingsSplit(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-bold mb-3">Crypto payout addresses</p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="set-sol" className="text-sm font-semibold">
                          Solana
                        </Label>
                        <Input
                          id="set-sol"
                          className={adminInputClass}
                          value={settingsSolana}
                          onChange={(e) => setSettingsSolana(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="set-eth" className="text-sm font-semibold">
                          Ethereum
                        </Label>
                        <Input
                          id="set-eth"
                          className={adminInputClass}
                          value={settingsEthereum}
                          onChange={(e) => setSettingsEthereum(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="set-poly" className="text-sm font-semibold">
                          Polygon
                        </Label>
                        <Input
                          id="set-poly"
                          className={adminInputClass}
                          value={settingsPolygon}
                          onChange={(e) => setSettingsPolygon(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="set-btc" className="text-sm font-semibold">
                          Bitcoin
                        </Label>
                        <Input
                          id="set-btc"
                          className={adminInputClass}
                          value={settingsBitcoin}
                          onChange={(e) => setSettingsBitcoin(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-bold mb-3">Bank payout</p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="set-bank" className="text-sm font-semibold">
                          Account #
                        </Label>
                        <Input
                          id="set-bank"
                          className={adminInputClass}
                          value={settingsBankAcct}
                          onChange={(e) => setSettingsBankAcct(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="set-routing" className="text-sm font-semibold">
                          Routing #
                        </Label>
                        <Input
                          id="set-routing"
                          className={adminInputClass}
                          value={settingsBankRouting}
                          onChange={(e) => setSettingsBankRouting(e.target.value)}
                        />
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

export default function AgencyDashboardPage() {
  return <AgencyDashboardInner />;
}
