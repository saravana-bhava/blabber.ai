'use client';

import { useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowUpDown,
  Building2,
  CheckCircle2,
  Clock,
  XCircle,
  Search,
  RefreshCw,
  Users,
  MoreVertical,
  ShieldCheck,
  ShieldX,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export interface AgencyData {
  profile_id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  email: string;
  name: string;
  default_split_pct: number;
  veriff_verification_status: string;
  payment_provider: string | null;
  solana_address: string | null;
  ethereum_address: string | null;
  polygon_address: string | null;
  bitcoin_address: string | null;
  bank_account_number: string | null;
  bank_routing_number: string | null;
  created_at: string;
  managedCreatorCount: number;
  totalAgencyEarnings: number;
  unpaidAgencyEarnings: number;
}

interface ManagedCreator {
  profile_id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_agency_operated: boolean;
  agency_split_pct_override: number | null;
  veriff_verification_status: string | null;
  can_monetize: boolean | null;
  lifetime_agency_share_cents: number;
}

type AgencyVerificationStatus = 'not_started' | 'in_progress' | 'completed' | 'rejected';

interface AgenciesTableProps {
  agencies: AgencyData[];
  onRefresh: () => void;
  onSetVerificationStatus: (profileId: string, status: AgencyVerificationStatus) => void;
  onDeleteAgency: (profileId: string) => void;
  isLoading?: boolean;
}

const TX_TABLES = [
  'call_transactions',
  'subscription_payments',
  'tip_transactions',
  'ppv_transactions',
  'creator_product_transactions',
] as const;

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString();

function VerificationBadge({ status }: { status: string }) {
  if (status === 'completed') {
    return (
      <Badge variant="default" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
        <CheckCircle2 className="h-3 w-3 mr-1" /> Verified
      </Badge>
    );
  }
  if (status === 'in_progress') {
    return (
      <Badge variant="secondary">
        <Clock className="h-3 w-3 mr-1" /> Pending
      </Badge>
    );
  }
  if (status === 'rejected') {
    return (
      <Badge variant="destructive">
        <XCircle className="h-3 w-3 mr-1" /> Rejected
      </Badge>
    );
  }
  return (
    <Badge variant="outline">
      <Clock className="h-3 w-3 mr-1" /> Not started
    </Badge>
  );
}

function AgencyDetailModal({
  agency,
  open,
  onOpenChange,
}: {
  agency: AgencyData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const supabase = createClient();
  const [creators, setCreators] = useState<ManagedCreator[]>([]);
  const [loadingCreators, setLoadingCreators] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!open || !agency) return;

    const loadCreators = async () => {
      setLoadingCreators(true);
      try {
        const { data: creatorRows, error } = await supabase
          .from('creators')
          .select(
            'profile_id, agency_split_pct_override, is_agency_operated, veriff_verification_status, can_monetize'
          )
          .eq('agency_profile_id', agency.profile_id);

        if (error) throw error;

        const creatorIds = (creatorRows ?? []).map((c) => c.profile_id);
        if (creatorIds.length === 0) {
          if (!cancelled) setCreators([]);
          return;
        }

        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .in('id', creatorIds);
        const profilesById = new Map(profiles?.map((p) => [p.id, p]) ?? []);

        const lifetimeShareByCreator = new Map<string, number>();
        for (const id of creatorIds) lifetimeShareByCreator.set(id, 0);
        for (const tableName of TX_TABLES) {
          const { data: txs } = await supabase
            .from(tableName)
            .select('agency_share_cents, creator_profile_id')
            .eq('agency_profile_id', agency.profile_id)
            .eq('status', 'succeeded');
          if (!txs) continue;
          for (const tx of txs as any[]) {
            const cid = tx.creator_profile_id as string | null;
            if (!cid) continue;
            lifetimeShareByCreator.set(
              cid,
              (lifetimeShareByCreator.get(cid) ?? 0) + (Number(tx.agency_share_cents) || 0)
            );
          }
        }

        const merged: ManagedCreator[] = (creatorRows ?? []).map((c) => {
          const p = profilesById.get(c.profile_id);
          return {
            profile_id: c.profile_id,
            username: p?.username ?? null,
            full_name: p?.full_name ?? null,
            avatar_url: p?.avatar_url ?? null,
            is_agency_operated: !!c.is_agency_operated,
            agency_split_pct_override: c.agency_split_pct_override,
            veriff_verification_status: c.veriff_verification_status,
            can_monetize: c.can_monetize,
            lifetime_agency_share_cents: lifetimeShareByCreator.get(c.profile_id) ?? 0,
          };
        });

        if (!cancelled) setCreators(merged);
      } catch (err) {
        console.error('Error loading agency creators', err);
        toast.error('Failed to load agency creators');
      } finally {
        if (!cancelled) setLoadingCreators(false);
      }
    };

    void loadCreators();
    return () => {
      cancelled = true;
    };
  }, [open, agency, supabase]);

  if (!agency) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {agency.name}
          </DialogTitle>
          <DialogDescription>Agency details and managed creators</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={agency.avatar_url || ''} />
                <AvatarFallback>
                  {agency.full_name?.charAt(0) || agency.username?.charAt(0) || 'A'}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">{agency.full_name || 'Unknown'}</div>
                <div className="text-sm text-muted-foreground">@{agency.username || 'unknown'}</div>
                {agency.email && <div className="text-sm text-muted-foreground">{agency.email}</div>}
              </div>
            </div>
            <VerificationBadge status={agency.veriff_verification_status} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <DetailStat label="Default split" value={`${Number(agency.default_split_pct).toFixed(2)}%`} />
            <DetailStat label="Creators" value={agency.managedCreatorCount.toString()} />
            <DetailStat label="Total earned" value={formatCurrency(agency.totalAgencyEarnings)} />
            <DetailStat label="Unpaid" value={formatCurrency(agency.unpaidAgencyEarnings)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <DetailRow label="Joined" value={formatDate(agency.created_at)} />
            <DetailRow label="Payment provider" value={agency.payment_provider || '—'} />
            <DetailRow label="Solana" value={agency.solana_address || '—'} mono />
            <DetailRow label="Ethereum" value={agency.ethereum_address || '—'} mono />
            <DetailRow label="Polygon" value={agency.polygon_address || '—'} mono />
            <DetailRow label="Bitcoin" value={agency.bitcoin_address || '—'} mono />
            <DetailRow
              label="Bank account"
              value={agency.bank_account_number ? `••••${agency.bank_account_number.slice(-4)}` : '—'}
            />
            <DetailRow
              label="Routing"
              value={agency.bank_routing_number ? `••••${agency.bank_routing_number.slice(-4)}` : '—'}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium flex items-center gap-2">
                <Users className="h-4 w-4" /> Managed creators
              </h4>
              <span className="text-xs text-muted-foreground">{creators.length} creator(s)</span>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Creator</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Split</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Agency earnings</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingCreators ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                        Loading creators…
                      </TableCell>
                    </TableRow>
                  ) : creators.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                        This agency has no managed creators yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    creators.map((c) => (
                      <TableRow key={c.profile_id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={c.avatar_url || ''} />
                              <AvatarFallback>
                                {c.full_name?.charAt(0) || c.username?.charAt(0) || 'C'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="text-sm font-medium">{c.full_name || 'Unknown'}</div>
                              <div className="text-xs text-muted-foreground">
                                @{c.username || 'unknown'}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {c.is_agency_operated ? (
                            <Badge variant="secondary">Operated</Badge>
                          ) : (
                            <Badge variant="outline">Invited</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {c.agency_split_pct_override != null
                            ? `${Number(c.agency_split_pct_override).toFixed(2)}%`
                            : `${Number(agency.default_split_pct).toFixed(2)}% (default)`}
                        </TableCell>
                        <TableCell>
                          <VerificationBadge status={c.veriff_verification_status || 'not_started'} />
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium text-green-600">
                          {formatCurrency(c.lifetime_agency_share_cents)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`break-all ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  );
}

export function AgenciesTable({
  agencies,
  onRefresh,
  onSetVerificationStatus,
  onDeleteAgency,
  isLoading = false,
}: AgenciesTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof AgencyData>('totalAgencyEarnings');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedAgency, setSelectedAgency] = useState<AgencyData | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const handleSort = (field: keyof AgencyData) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredAgencies = agencies.filter(
    (a) =>
      a.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedAgencies = [...filteredAgencies].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    }
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }
    return 0;
  });

  const openDetail = (agency: AgencyData) => {
    setSelectedAgency(agency);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row items-center justify-between w-full">
        <div className="flex items-center gap-4 w-full">
          <div className="relative w-full">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search agencies..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 w-full md:w-64"
            />
          </div>
        </div>
        <div className="flex items-center gap-4 w-full justify-between">
          <span className="text-sm text-muted-foreground">
            {filteredAgencies.length} of {agencies.length} agencies
          </span>
          <Button onClick={onRefresh} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agency</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('default_split_pct')}
                  className="h-auto p-0 font-medium text-xs"
                >
                  Default split
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('managedCreatorCount')}
                  className="h-auto p-0 font-medium text-xs"
                >
                  Creators
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('totalAgencyEarnings')}
                  className="h-auto p-0 font-medium text-xs"
                >
                  Earnings
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('created_at')}
                  className="h-auto p-0 font-medium text-xs"
                >
                  Joined
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedAgencies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Agencies Found</h3>
                  <p className="text-muted-foreground">
                    {agencies.length === 0
                      ? 'There are no agencies in the database yet.'
                      : 'No agencies match your search criteria.'}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              sortedAgencies.map((agency) => {
                const status = agency.veriff_verification_status;
                return (
                  <TableRow
                    key={agency.profile_id}
                    onClick={() => openDetail(agency)}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell>
                      <div className="font-medium text-sm">{agency.name}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={agency.avatar_url || ''} />
                          <AvatarFallback className="h-7 w-7 text-xs">
                            {agency.full_name?.charAt(0) || agency.username?.charAt(0) || 'A'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-xs font-medium">{agency.full_name || 'Unknown'}</div>
                          <div className="text-xs text-muted-foreground">
                            @{agency.username || 'unknown'}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">
                        {Number(agency.default_split_pct).toFixed(2)}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm font-medium">{agency.managedCreatorCount}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium text-green-600">
                        {formatCurrency(agency.totalAgencyEarnings)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <VerificationBadge status={status} />
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(agency.created_at)}
                      </div>
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          {status !== 'completed' && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                  <ShieldCheck className="h-4 w-4 mr-2 text-emerald-600" />
                                  Force approve KYC
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Force approve {agency.name}?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Mark {agency.name} (owned by {agency.full_name} @{agency.username})
                                    as a fully verified agency without Veriff. They&apos;ll be able to
                                    invite and operate creators immediately.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() =>
                                      onSetVerificationStatus(agency.profile_id, 'completed')
                                    }
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                  >
                                    Force approve
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}

                          {status === 'completed' && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                  <ShieldX className="h-4 w-4 mr-2 text-red-600" />
                                  Suspend (revoke KYC)
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Suspend {agency.name}?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This sets the agency&apos;s verification status to{' '}
                                    <span className="font-mono">rejected</span>, which blocks new
                                    creator invites and operated-creator creation. Existing managed
                                    creators stay linked but can be unlinked from the modal.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() =>
                                      onSetVerificationStatus(agency.profile_id, 'rejected')
                                    }
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Suspend agency
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}

                          {status === 'rejected' && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                  <RotateCcw className="h-4 w-4 mr-2" />
                                  Reset KYC to not started
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Reset KYC?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Reset {agency.name}&apos;s verification status to{' '}
                                    <span className="font-mono">not_started</span> so the owner can
                                    redo Veriff.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() =>
                                      onSetVerificationStatus(agency.profile_id, 'not_started')
                                    }
                                  >
                                    Reset KYC
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}

                          <DropdownMenuSeparator />

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                onSelect={(e) => e.preventDefault()}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete agency
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete {agency.name}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This permanently removes the agency record. All managed creators
                                  ({agency.managedCreatorCount}) will be unlinked but their
                                  creator accounts will remain. Past transactions retain their
                                  agency attribution. This cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => onDeleteAgency(agency.profile_id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Delete agency
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <AgencyDetailModal agency={selectedAgency} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
}
