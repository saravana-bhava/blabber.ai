'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { 
  RefreshCw,
  Download,
  DollarSign,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle
} from 'lucide-react';
import {
  AdminSectionTitle,
  AdminSearchBar,
  AdminGhostButton,
  AdminGradButton,
  AdminTableShell,
  AdminToolbar,
  AdminLoadingSpinner,
  AdminTableHeaderRow,
  AdminTh,
  AdminStatusPill,
  adminTdClass,
} from '@/components/admin/admin-ui';

interface PayoutRecord {
  id: string;
  creator_profile_id: string;
  amount_cents: number;
  currency: string;
  status: string;
  payout_method: string | null;
  created_at: string;
  completed_at: string | null;
  solana_address: string | null;
  ethereum_address: string | null;
  polygon_address: string | null;
  bitcoin_address: string | null;
  bank_account_number: string | null;
  bank_routing_number: string | null;
  creator?: {
    username: string;
    full_name: string;
    avatar_url: string;
  };
}

interface AdminPayoutsProps {
  onMakePayouts: () => void;
}

export function AdminPayouts({ onMakePayouts }: AdminPayoutsProps) {
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(true);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [filteredPayouts, setFilteredPayouts] = useState<PayoutRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchPayouts = async () => {
    setIsLoading(true);
    try {
      const { data: payoutsData, error } = await supabase
        .from('payouts')
        .select(`
          *,
          creator:profiles!creator_profile_id(username, full_name, avatar_url)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching payouts:', error);
        return;
      }

      setPayouts(payoutsData || []);
      setFilteredPayouts(payoutsData || []);
    } catch (error) {
      console.error('Error fetching payouts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPayouts();
  }, []);

  useEffect(() => {
    let filtered = [...payouts];

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === statusFilter);
    }

    // Apply method filter
    if (methodFilter !== 'all') {
      filtered = filtered.filter(p => p.payout_method === methodFilter);
    }

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.creator?.username?.toLowerCase().includes(term) ||
        p.creator?.full_name?.toLowerCase().includes(term) ||
        p.id.toLowerCase().includes(term)
      );
    }

    setFilteredPayouts(filtered);
  }, [statusFilter, methodFilter, searchTerm, payouts]);

  const formatAmount = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatDestination = (payout: PayoutRecord) => {
    if (payout.payout_method === 'solana' && payout.solana_address) {
      return `${payout.solana_address.slice(0, 8)}...${payout.solana_address.slice(-8)}`;
    }
    if (payout.payout_method === 'ethereum' && payout.ethereum_address) {
      return `${payout.ethereum_address.slice(0, 8)}...${payout.ethereum_address.slice(-8)}`;
    }
    if (payout.payout_method === 'polygon' && payout.polygon_address) {
      return `${payout.polygon_address.slice(0, 8)}...${payout.polygon_address.slice(-8)}`;
    }
    if (payout.payout_method === 'bitcoin' && payout.bitcoin_address) {
      return `${payout.bitcoin_address.slice(0, 8)}...${payout.bitcoin_address.slice(-8)}`;
    }
    if (payout.payout_method === 'bank' && payout.bank_account_number) {
      return `****${payout.bank_account_number.slice(-4)}`;
    }
    return 'N/A';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <AdminStatusPill variant="gold"><CheckCircle2 className="h-3 w-3" />Completed</AdminStatusPill>;
      case 'processing':
        return <AdminStatusPill variant="violet"><Clock className="h-3 w-3" />Processing</AdminStatusPill>;
      case 'failed':
        return <AdminStatusPill variant="live"><XCircle className="h-3 w-3" />Failed</AdminStatusPill>;
      case 'pending':
      default:
        return <AdminStatusPill variant="soft"><AlertCircle className="h-3 w-3" />Pending</AdminStatusPill>;
    }
  };

  if (isLoading) {
    return <AdminLoadingSpinner className="min-h-[400px]" />;
  }

  return (
    <div className="space-y-4">
      <AdminToolbar>
        <AdminSectionTitle
          title="Payouts"
          description="Manage and track all creator payouts"
          action={
            <AdminGradButton onClick={onMakePayouts}>
              <DollarSign className="h-4 w-4" />
              Make payouts
            </AdminGradButton>
          }
        />
      </AdminToolbar>

      <div className="flex items-center gap-2 flex-wrap">
        <AdminSearchBar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search by creator or payout ID…"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 px-3 rounded-full border border-border bg-secondary text-sm font-medium"
        >
          <option value="all">All status</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
        <select
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          className="h-10 px-3 rounded-full border border-border bg-secondary text-sm font-medium"
        >
          <option value="all">All methods</option>
          <option value="solana">Solana</option>
          <option value="ethereum">Ethereum</option>
          <option value="polygon">Polygon</option>
          <option value="bitcoin">Bitcoin</option>
          <option value="bank">Bank</option>
        </select>
        <AdminGhostButton onClick={fetchPayouts}>
          <RefreshCw className="h-4 w-4" />
        </AdminGhostButton>
        <AdminGhostButton>
          <Download className="h-4 w-4" />
        </AdminGhostButton>
      </div>

      <AdminTableShell>
        <Table>
          <TableHeader>
            <AdminTableHeaderRow>
              <AdminTh>Date</AdminTh>
              <AdminTh>Creator</AdminTh>
              <AdminTh>Status</AdminTh>
              <AdminTh>Method</AdminTh>
              <AdminTh>Destination</AdminTh>
              <AdminTh className="text-right">Amount</AdminTh>
            </AdminTableHeaderRow>
          </TableHeader>
          <TableBody>
            {filteredPayouts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No payouts found
                </TableCell>
              </TableRow>
            ) : (
              filteredPayouts.map((payout) => (
                <TableRow key={payout.id} className="admin-row border-b border-border">
                  <TableCell className={adminTdClass}>
                    {new Date(payout.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </TableCell>
                  <TableCell className={adminTdClass}>
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={payout.creator?.avatar_url || ''} />
                        <AvatarFallback>
                          {payout.creator?.full_name?.charAt(0) || payout.creator?.username?.charAt(0) || 'C'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-sm">{payout.creator?.full_name || 'Unknown'}</div>
                        <div className="text-xs text-muted-foreground">@{payout.creator?.username || 'unknown'}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className={adminTdClass}>{getStatusBadge(payout.status)}</TableCell>
                  <TableCell className={adminTdClass}>
                    <AdminStatusPill variant="soft" className="capitalize">
                      {payout.payout_method || 'N/A'}
                    </AdminStatusPill>
                  </TableCell>
                  <TableCell className={adminTdClass}>
                    <span className="text-sm font-mono text-muted-foreground">{formatDestination(payout)}</span>
                  </TableCell>
                  <TableCell className={cn(adminTdClass, 'text-right font-bold tabular-nums text-[var(--brand-gold)]')}>
                    {formatAmount(payout.amount_cents)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </AdminTableShell>
    </div>
  );
}

