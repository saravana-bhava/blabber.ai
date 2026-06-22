'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Dialog } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AdminDialogPanel,
  AdminGhostButton,
  AdminGradButton,
  AdminLoadingSpinner,
  AdminSearchBar,
  AdminStatusPill,
  AdminTableHeaderRow,
  AdminTh,
  AdminTableShell,
  adminTdClass,
  brandCancelBtn,
} from '@/components/admin/admin-ui';
import { Button } from '@/components/ui/button';

interface CreatorBalance {
  profile_id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  payee_kind: 'creator' | 'agency';
  crypto_balance_cents: number;
  usd_balance_cents: number;
  crypto_transactions: TransactionReference[];
  usd_transactions: TransactionReference[];
  crypto_payout_method: 'solana' | 'ethereum' | 'polygon' | 'bitcoin' | null;
  crypto_blockchain: string | null; // The blockchain from MoonPay transactions (e.g., "ETH", "SOL", "POLYGON", "BITCOIN")
  solana_address: string | null;
  ethereum_address: string | null;
  polygon_address: string | null;
  bitcoin_address: string | null;
  bank_account_number: string | null;
  bank_routing_number: string | null;
}

interface TransactionReference {
  table: 'call_transactions' | 'creator_product_transactions' | 'ppv_transactions' | 'tip_transactions' | 'subscription_payments';
  id: string;
}

interface PayoutRequest {
  creator_profile_id: string;
  payee_kind: 'creator' | 'agency';
  amount_cents: number;
  currency: 'crypto' | 'usd';
  payout_method: 'solana' | 'ethereum' | 'polygon' | 'bitcoin' | 'bank' | null;
  blockchain?: string | null; // MoonPay blockchain value (e.g., "ETH", "SOL", "POLYGON", "BITCOIN") - used to match platform wallet
  solana_address?: string | null;
  ethereum_address?: string | null;
  polygon_address?: string | null;
  bitcoin_address?: string | null;
  bank_account_number?: string | null;
  bank_routing_number?: string | null;
  transactions: TransactionReference[];
  status: 'initiated';
  created_at: string;
}

interface MakePayoutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payoutRequests: PayoutRequest[]) => void;
}

export function MakePayoutsModal({ isOpen, onClose, onSubmit }: MakePayoutsModalProps) {
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(true);
  const [creators, setCreators] = useState<CreatorBalance[]>([]);
  const [filteredCreators, setFilteredCreators] = useState<CreatorBalance[]>([]);
  const [selectedCreators, setSelectedCreators] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  const fetchCreatorBalances = async () => {
    setIsLoading(true);
    try {
      // Get all creators
      const { data: creatorsData, error: creatorsError } = await supabase
        .from('creators')
        .select(`
          profile_id,
          solana_address,
          ethereum_address,
          polygon_address,
          bitcoin_address,
          bank_account_number,
          bank_routing_number,
          profile:profiles!creators_profile_id_fkey(username, full_name, avatar_url)
        `);

      if (creatorsError) {
        console.error('Error fetching creators:', creatorsError);
        return;
      }

      // Calculate balances for each creator
      const creatorsWithBalances = await Promise.all(
        (creatorsData || []).map(async (creator) => {
          const profileId = creator.profile_id;

          // Get creator's post IDs
          const { data: creatorPosts } = await supabase
            .from('posts')
            .select('id')
            .eq('user_id', profileId);

          const postIds = creatorPosts?.map(p => p.id) || [];

          // Get creator's product IDs
          const { data: creatorProducts } = await supabase
            .from('creator_products')
            .select('id')
            .eq('creator_profile_id', profileId);

          const productIds = creatorProducts?.map(p => p.id) || [];

          // Fetch unpaid transactions with payment_provider, IDs, and provider_specific_details (for blockchain info) - exclude pending
          const [callTransactions, productTransactions, ppvTransactions, tipTransactions, subscriptionPayments] = await Promise.all([
            supabase
              .from('call_transactions')
              .select('id, creator_share_cents, agency_share_cents')
              .eq('creator_profile_id', profileId)
              .gt('credits_cents', 0)
              .is('payout_id', null),
            productIds.length > 0
              ? supabase
                  .from('creator_product_transactions')
                  .select('id, creator_share_cents, agency_share_cents, payment_provider, provider_specific_details')
                  .in('creator_product_id', productIds)
                  .neq('status', 'pending')
                  .is('payout_id', null)
              : Promise.resolve({ data: [], error: null }),
            postIds.length > 0
              ? supabase
                  .from('ppv_transactions')
                  .select('id, creator_share_cents, agency_share_cents, payment_provider, provider_specific_details')
                  .in('post_id', postIds)
                  .neq('status', 'pending')
                  .is('payout_id', null)
              : Promise.resolve({ data: [], error: null }),
            postIds.length > 0
              ? supabase
                  .from('tip_transactions')
                  .select('id, creator_share_cents, agency_share_cents, payment_provider, provider_specific_details')
                  .or(`creator_id.eq.${profileId},post_id.in.(${postIds.join(',')})`)
                  .neq('status', 'pending')
                  .is('payout_id', null)
              : supabase
                  .from('tip_transactions')
                  .select('id, creator_share_cents, agency_share_cents, payment_provider, provider_specific_details')
                  .eq('creator_id', profileId)
                  .neq('status', 'pending')
                  .is('payout_id', null),
            supabase
              .from('subscription_payments')
              .select('id, creator_share_cents, agency_share_cents, payment_provider, provider_specific_details')
              .eq('creator_profile_id', profileId)
              .neq('status', 'pending')
              .is('payout_id', null),
          ]);

          // Get crypto transactions (moonpay)
          const cryptoTransactions = [
            ...((productTransactions as any)?.data || []).filter((tx: any) => tx.payment_provider === 'moonpay').map((tx: any) => ({ table: 'creator_product_transactions' as const, id: tx.id })),
            ...((ppvTransactions as any)?.data || []).filter((tx: any) => tx.payment_provider === 'moonpay').map((tx: any) => ({ table: 'ppv_transactions' as const, id: tx.id })),
            ...(tipTransactions.data || []).filter((tx: any) => tx.payment_provider === 'moonpay').map((tx: any) => ({ table: 'tip_transactions' as const, id: tx.id })),
            ...(subscriptionPayments.data || []).filter((tx: any) => tx.payment_provider === 'moonpay').map((tx: any) => ({ table: 'subscription_payments' as const, id: tx.id })),
          ];

          // Get USD transactions (stripe/epoch + all call transactions)
          const usdTransactions = [
            ...(callTransactions.data || []).map((tx: any) => ({ table: 'call_transactions' as const, id: tx.id })),
            ...((productTransactions as any)?.data || []).filter((tx: any) => tx.payment_provider === 'stripe' || tx.payment_provider === 'epoch' || tx.payment_provider === 'onyx' || tx.payment_provider === 'uspaymate').map((tx: any) => ({ table: 'creator_product_transactions' as const, id: tx.id })),
            ...((ppvTransactions as any)?.data || []).filter((tx: any) => tx.payment_provider === 'stripe' || tx.payment_provider === 'epoch' || tx.payment_provider === 'onyx' || tx.payment_provider === 'uspaymate').map((tx: any) => ({ table: 'ppv_transactions' as const, id: tx.id })),
            ...(tipTransactions.data || []).filter((tx: any) => tx.payment_provider === 'stripe' || tx.payment_provider === 'epoch' || tx.payment_provider === 'onyx' || tx.payment_provider === 'uspaymate').map((tx: any) => ({ table: 'tip_transactions' as const, id: tx.id })),
            ...(subscriptionPayments.data || []).filter((tx: any) => tx.payment_provider === 'stripe' || tx.payment_provider === 'epoch' || tx.payment_provider === 'onyx' || tx.payment_provider === 'uspaymate').map((tx: any) => ({ table: 'subscription_payments' as const, id: tx.id })),
          ];

          const takeHomeOf = (tx: any) =>
            Math.max(0, (tx.creator_share_cents || 0) - (tx.agency_share_cents || 0));

          // Calculate crypto balance (moonpay transactions); creator take-home only
          const cryptoBalance = [
            ...((productTransactions as any)?.data || []).filter((tx: any) => tx.payment_provider === 'moonpay'),
            ...((ppvTransactions as any)?.data || []).filter((tx: any) => tx.payment_provider === 'moonpay'),
            ...(tipTransactions.data || []).filter((tx: any) => tx.payment_provider === 'moonpay'),
            ...(subscriptionPayments.data || []).filter((tx: any) => tx.payment_provider === 'moonpay'),
          ].reduce((sum, tx) => sum + takeHomeOf(tx), 0);

          // Calculate USD balance (stripe/epoch transactions + all call transactions); creator take-home only
          const usdBalance = [
            ...(callTransactions.data || []), // All call transactions are USD
            ...((productTransactions as any)?.data || []).filter((tx: any) => tx.payment_provider === 'stripe' || tx.payment_provider === 'epoch' || tx.payment_provider === 'onyx' || tx.payment_provider === 'uspaymate'),
            ...((ppvTransactions as any)?.data || []).filter((tx: any) => tx.payment_provider === 'stripe' || tx.payment_provider === 'epoch' || tx.payment_provider === 'onyx' || tx.payment_provider === 'uspaymate'),
            ...(tipTransactions.data || []).filter((tx: any) => tx.payment_provider === 'stripe' || tx.payment_provider === 'epoch' || tx.payment_provider === 'onyx' || tx.payment_provider === 'uspaymate'),
            ...(subscriptionPayments.data || []).filter((tx: any) => tx.payment_provider === 'stripe' || tx.payment_provider === 'epoch' || tx.payment_provider === 'onyx' || tx.payment_provider === 'uspaymate'),
          ].reduce((sum, tx) => sum + takeHomeOf(tx), 0);

          // Determine crypto payout method based on transactions
          // Extract blockchain from MoonPay transactions to match platform network to creator wallet
          const allCryptoTransactions = [
            ...((productTransactions as any)?.data || []).filter((tx: any) => tx.payment_provider === 'moonpay'),
            ...((ppvTransactions as any)?.data || []).filter((tx: any) => tx.payment_provider === 'moonpay'),
            ...(tipTransactions.data || []).filter((tx: any) => tx.payment_provider === 'moonpay'),
            ...(subscriptionPayments.data || []).filter((tx: any) => tx.payment_provider === 'moonpay'),
          ];
          
          // Extract blockchain values from transactions (e.g., "ETH", "SOL", "POLYGON", "BITCOIN")
          const blockchains = allCryptoTransactions
            .map((tx: any) => {
              const blockchain = tx.provider_specific_details?.blockchain;
              return blockchain ? String(blockchain).toUpperCase() : null;
            })
            .filter(Boolean);
          
          // Map MoonPay blockchain values to our payout methods
          // MoonPay uses: "ETH", "SOL", "POLYGON", "BITCOIN" (or similar)
          const blockchainToMethodMap: { [key: string]: 'solana' | 'ethereum' | 'polygon' | 'bitcoin' } = {
            'ETH': 'ethereum',
            'ETHEREUM': 'ethereum',
            'SOL': 'solana',
            'SOLANA': 'solana',
            'POLYGON': 'polygon',
            'MATIC': 'polygon', // Polygon's native token
            'BITCOIN': 'bitcoin',
            'BTC': 'bitcoin',
          };
          
          // Find the most common blockchain from transactions
          let preferredBlockchain: string | null = null;
          if (blockchains.length > 0) {
            // Count occurrences of each blockchain
            const counts: { [key: string]: number } = {};
            blockchains.forEach(b => {
              if (b) counts[b] = (counts[b] || 0) + 1;
            });
            // Get the blockchain with the highest count
            preferredBlockchain = Object.keys(counts).reduce((a, b) => 
              counts[a] > counts[b] ? a : b
            );
          }
          
          // Determine payout method based on blockchain
          let cryptoPayoutMethod: 'solana' | 'ethereum' | 'polygon' | 'bitcoin' | null = null;
          
          if (preferredBlockchain && blockchainToMethodMap[preferredBlockchain]) {
            const method = blockchainToMethodMap[preferredBlockchain];
            // Only use if creator has that wallet configured
            if (
              (method === 'solana' && creator.solana_address) ||
              (method === 'ethereum' && creator.ethereum_address) ||
              (method === 'polygon' && creator.polygon_address) ||
              (method === 'bitcoin' && creator.bitcoin_address)
            ) {
              cryptoPayoutMethod = method;
            }
          }
          
          // Fallback to first available wallet if no blockchain match found
          if (!cryptoPayoutMethod) {
            cryptoPayoutMethod = creator.solana_address ? 'solana' : 
                               creator.ethereum_address ? 'ethereum' :
                               creator.polygon_address ? 'polygon' :
                               creator.bitcoin_address ? 'bitcoin' : null;
          }

          return {
            profile_id: profileId,
            payee_kind: 'creator' as const,
            username: (creator.profile as any)?.username || 'Unknown',
            full_name: (creator.profile as any)?.full_name || 'Unknown Creator',
            avatar_url: (creator.profile as any)?.avatar_url || '',
            crypto_balance_cents: cryptoBalance,
            usd_balance_cents: usdBalance,
            crypto_transactions: cryptoTransactions,
            usd_transactions: usdTransactions,
            crypto_payout_method: cryptoPayoutMethod,
            crypto_blockchain: preferredBlockchain || null, // Store the blockchain for payout processing
            solana_address: creator.solana_address,
            ethereum_address: creator.ethereum_address,
            polygon_address: creator.polygon_address,
            bitcoin_address: creator.bitcoin_address,
            bank_account_number: creator.bank_account_number,
            bank_routing_number: creator.bank_routing_number,
          };
        })
      );

      // Filter to only creators with balance > 0 (either crypto or USD)
      const creatorsWithBalance = creatorsWithBalances.filter(c => c.crypto_balance_cents > 0 || c.usd_balance_cents > 0);

      // Enumerate agencies and their unpaid agency_share_cents from each transaction table
      const { data: agenciesData, error: agenciesError } = await supabase
        .from('agencies')
        .select(`
          profile_id,
          name,
          solana_address,
          ethereum_address,
          polygon_address,
          bitcoin_address,
          bank_account_number,
          bank_routing_number,
          profile:profiles!agencies_profile_id_fkey(username, full_name, avatar_url)
        `);

      if (agenciesError) {
        console.error('Error fetching agencies:', agenciesError);
      }

      const agencyRows: CreatorBalance[] = await Promise.all(
        (agenciesData || []).map(async (ag) => {
          const agProfileId = ag.profile_id;

          const tableNames = [
            'call_transactions',
            'creator_product_transactions',
            'ppv_transactions',
            'tip_transactions',
            'subscription_payments',
          ] as const;

          const txResults = await Promise.all(
            tableNames.map((t) =>
              supabase
                .from(t)
                .select('id, agency_share_cents, payment_provider, provider_specific_details')
                .eq('agency_profile_id', agProfileId)
                .neq('status', 'pending')
                .is('agency_payout_id', null)
            )
          );

          let cryptoBalance = 0;
          let usdBalance = 0;
          const cryptoTransactions: TransactionReference[] = [];
          const usdTransactions: TransactionReference[] = [];
          const allCryptoTxsForBlockchain: any[] = [];

          tableNames.forEach((tableName, idx) => {
            const rows = (txResults[idx]?.data || []) as any[];
            for (const tx of rows) {
              const share = Number(tx.agency_share_cents) || 0;
              if (share <= 0) continue;
              if (tableName === 'call_transactions') {
                usdBalance += share;
                usdTransactions.push({ table: tableName, id: tx.id });
              } else if (tx.payment_provider === 'moonpay') {
                cryptoBalance += share;
                cryptoTransactions.push({ table: tableName, id: tx.id });
                allCryptoTxsForBlockchain.push(tx);
              } else if (tx.payment_provider === 'stripe' || tx.payment_provider === 'epoch' || tx.payment_provider === 'onyx' || tx.payment_provider === 'uspaymate') {
                usdBalance += share;
                usdTransactions.push({ table: tableName, id: tx.id });
              }
            }
          });

          const blockchainToMethodMap: { [key: string]: 'solana' | 'ethereum' | 'polygon' | 'bitcoin' } = {
            ETH: 'ethereum',
            ETHEREUM: 'ethereum',
            SOL: 'solana',
            SOLANA: 'solana',
            POLYGON: 'polygon',
            MATIC: 'polygon',
            BITCOIN: 'bitcoin',
            BTC: 'bitcoin',
          };

          const blockchains = allCryptoTxsForBlockchain
            .map((tx) => {
              const b = tx.provider_specific_details?.blockchain;
              return b ? String(b).toUpperCase() : null;
            })
            .filter(Boolean) as string[];
          let preferredBlockchain: string | null = null;
          if (blockchains.length > 0) {
            const counts: { [key: string]: number } = {};
            blockchains.forEach((b) => {
              counts[b] = (counts[b] || 0) + 1;
            });
            preferredBlockchain = Object.keys(counts).reduce((a, b) => (counts[a] > counts[b] ? a : b));
          }
          let cryptoPayoutMethod: 'solana' | 'ethereum' | 'polygon' | 'bitcoin' | null = null;
          if (preferredBlockchain && blockchainToMethodMap[preferredBlockchain]) {
            const method = blockchainToMethodMap[preferredBlockchain];
            if (
              (method === 'solana' && ag.solana_address) ||
              (method === 'ethereum' && ag.ethereum_address) ||
              (method === 'polygon' && ag.polygon_address) ||
              (method === 'bitcoin' && ag.bitcoin_address)
            ) {
              cryptoPayoutMethod = method;
            }
          }
          if (!cryptoPayoutMethod) {
            cryptoPayoutMethod = ag.solana_address
              ? 'solana'
              : ag.ethereum_address
                ? 'ethereum'
                : ag.polygon_address
                  ? 'polygon'
                  : ag.bitcoin_address
                    ? 'bitcoin'
                    : null;
          }

          return {
            profile_id: agProfileId,
            payee_kind: 'agency' as const,
            username: (ag.profile as any)?.username || ag.name,
            full_name: ag.name || (ag.profile as any)?.full_name || 'Agency',
            avatar_url: (ag.profile as any)?.avatar_url || '',
            crypto_balance_cents: cryptoBalance,
            usd_balance_cents: usdBalance,
            crypto_transactions: cryptoTransactions,
            usd_transactions: usdTransactions,
            crypto_payout_method: cryptoPayoutMethod,
            crypto_blockchain: preferredBlockchain,
            solana_address: ag.solana_address,
            ethereum_address: ag.ethereum_address,
            polygon_address: ag.polygon_address,
            bitcoin_address: ag.bitcoin_address,
            bank_account_number: ag.bank_account_number,
            bank_routing_number: ag.bank_routing_number,
          };
        })
      );

      const agenciesWithBalance = agencyRows.filter(
        (a) => a.crypto_balance_cents > 0 || a.usd_balance_cents > 0
      );

      const allRows = [...creatorsWithBalance, ...agenciesWithBalance];

      setCreators(allRows);
      setFilteredCreators(allRows);
    } catch (error) {
      console.error('Error fetching creator balances:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCreatorBalances();
      setSelectedCreators(new Set());
      setSearchTerm('');
    }
  }, [isOpen]);

  useEffect(() => {
    let filtered = [...creators];

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c =>
        c.username.toLowerCase().includes(term) ||
        c.full_name.toLowerCase().includes(term)
      );
    }

    setFilteredCreators(filtered);
  }, [searchTerm, creators]);

  const rowKey = (c: CreatorBalance) => `${c.payee_kind}:${c.profile_id}`;

  const handleToggleCreator = (key: string) => {
    const newSelected = new Set(selectedCreators);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedCreators(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedCreators.size === filteredCreators.length) {
      setSelectedCreators(new Set());
    } else {
      setSelectedCreators(new Set(filteredCreators.map(rowKey)));
    }
  };

  const handleSubmit = async () => {
    // Create payout requests for each selected creator
    // A creator can have both crypto and USD payouts if they have balances in both
    const payoutRequests: PayoutRequest[] = [];
    const now = new Date().toISOString();
    
    filteredCreators
      .filter(c => selectedCreators.has(`${c.payee_kind}:${c.profile_id}`))
      .forEach(creator => {
        // Add crypto payout if balance > 0
        if (creator.crypto_balance_cents > 0 && creator.crypto_transactions.length > 0) {
          const payoutMethod = creator.crypto_payout_method;
          payoutRequests.push({
            creator_profile_id: creator.profile_id,
            payee_kind: creator.payee_kind,
            amount_cents: creator.crypto_balance_cents,
            currency: 'crypto',
            payout_method: payoutMethod,
            blockchain: creator.crypto_blockchain, // Pass blockchain to match platform wallet (e.g., "ETH", "SOL", "POLYGON", "BITCOIN")
            solana_address: payoutMethod === 'solana' ? creator.solana_address : null,
            ethereum_address: payoutMethod === 'ethereum' ? creator.ethereum_address : null,
            polygon_address: payoutMethod === 'polygon' ? creator.polygon_address : null,
            bitcoin_address: payoutMethod === 'bitcoin' ? creator.bitcoin_address : null,
            bank_account_number: null,
            bank_routing_number: null,
            transactions: creator.crypto_transactions,
            status: 'initiated',
            created_at: now,
          });
        }
        
        // Add USD payout if balance > 0
        if (creator.usd_balance_cents > 0 && creator.usd_transactions.length > 0) {
          payoutRequests.push({
            creator_profile_id: creator.profile_id,
            payee_kind: creator.payee_kind,
            amount_cents: creator.usd_balance_cents,
            currency: 'usd',
            payout_method: (creator.bank_account_number && creator.bank_routing_number) ? 'bank' : null,
            solana_address: null,
            ethereum_address: null,
            polygon_address: null,
            bitcoin_address: null,
            bank_account_number: creator.bank_account_number || null,
            bank_routing_number: creator.bank_routing_number || null,
            transactions: creator.usd_transactions,
            status: 'initiated',
            created_at: now,
          });
        }
      });
    
    if (payoutRequests.length === 0) {
      return; // Should not happen due to disabled button, but safety check
    }
    
    onSubmit(payoutRequests);
  };

  const formatAmount = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const selectedCreatorsList = filteredCreators.filter(c => selectedCreators.has(rowKey(c)));
  
  const totalSelectedCrypto = selectedCreatorsList
    .reduce((sum, c) => sum + c.crypto_balance_cents, 0);

  const totalSelectedUSD = selectedCreatorsList
    .reduce((sum, c) => sum + c.usd_balance_cents, 0);
  
  // Count total payouts that will be created (a creator can have 2 payouts if they have both crypto and USD balances)
  const totalPayoutsToCreate = selectedCreatorsList.reduce((count, c) => {
    let payouts = 0;
    if (c.crypto_balance_cents > 0) payouts++;
    if (c.usd_balance_cents > 0) payouts++;
    return count + payouts;
  }, 0);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AdminDialogPanel
        icon={DollarSign}
        title="Make payouts"
        description="Select payees with outstanding balances. Crypto and USD balances create separate payout records."
        size="full"
        footer={
          <>
            <div className="flex-1 text-left text-[12.5px] text-muted-foreground hidden sm:block">
              {selectedCreators.size} selected · {totalPayoutsToCreate} payout{totalPayoutsToCreate !== 1 ? 's' : ''} · Crypto {formatAmount(totalSelectedCrypto)} · USD {formatAmount(totalSelectedUSD)}
            </div>
            <Button type="button" variant="outline" className={brandCancelBtn} onClick={onClose}>
              Cancel
            </Button>
            <AdminGradButton
              onClick={handleSubmit}
              disabled={selectedCreators.size === 0 || totalPayoutsToCreate === 0}
            >
              <DollarSign className="h-4 w-4" />
              Create {totalPayoutsToCreate} payout{totalPayoutsToCreate !== 1 ? 's' : ''}
            </AdminGradButton>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <AdminSearchBar
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search creators or agencies…"
            />
            <AdminGhostButton onClick={handleSelectAll} className="shrink-0">
              {selectedCreators.size === filteredCreators.length && filteredCreators.length > 0 ? 'Deselect all' : 'Select all'}
            </AdminGhostButton>
          </div>

          <p className="text-[12.5px] text-muted-foreground sm:hidden">
            {selectedCreators.size} selected · {totalPayoutsToCreate} payouts · Crypto {formatAmount(totalSelectedCrypto)} · USD {formatAmount(totalSelectedUSD)}
          </p>

          {isLoading ? (
            <AdminLoadingSpinner className="min-h-[320px]" />
          ) : filteredCreators.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No payees found with balance</div>
          ) : (
            <AdminTableShell>
              <Table>
                <TableHeader>
                  <AdminTableHeaderRow>
                    <AdminTh className="w-12">
                      <Checkbox
                        checked={selectedCreators.size === filteredCreators.length && filteredCreators.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </AdminTh>
                    <AdminTh>Payee</AdminTh>
                    <AdminTh className="text-right">Crypto balance</AdminTh>
                    <AdminTh className="text-right">USD balance</AdminTh>
                  </AdminTableHeaderRow>
                </TableHeader>
                <TableBody>
                  {filteredCreators.map((creator) => {
                    const key = rowKey(creator);
                    const isSelected = selectedCreators.has(key);
                    return (
                      <TableRow
                        key={key}
                        className={`admin-row border-b border-border cursor-pointer ${isSelected ? 'bg-[var(--brand-grad-soft)]' : ''}`}
                        onClick={() => handleToggleCreator(key)}
                      >
                        <TableCell className={adminTdClass} onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleCreator(key)}
                          />
                        </TableCell>
                        <TableCell className={adminTdClass}>
                          <div className="flex items-center gap-3 min-w-[180px]">
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={creator.avatar_url} />
                              <AvatarFallback>
                                {creator.full_name.charAt(0) || creator.username.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                                <span className="truncate">{creator.full_name}</span>
                                {creator.payee_kind === 'agency' && (
                                  <AdminStatusPill variant="violet">Agency</AdminStatusPill>
                                )}
                              </div>
                              <div className="text-[12.5px] text-muted-foreground">@{creator.username}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className={cn(adminTdClass, 'text-right')}>
                          <div className="font-bold tabular-nums text-[var(--brand-gold)]">
                            {formatAmount(creator.crypto_balance_cents)}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-1 font-mono">
                            {creator.solana_address && <div>SOL: {creator.solana_address.slice(0, 6)}…{creator.solana_address.slice(-4)}</div>}
                            {creator.ethereum_address && <div>ETH: {creator.ethereum_address.slice(0, 6)}…{creator.ethereum_address.slice(-4)}</div>}
                            {creator.polygon_address && <div>MATIC: {creator.polygon_address.slice(0, 6)}…{creator.polygon_address.slice(-4)}</div>}
                            {creator.bitcoin_address && <div>BTC: {creator.bitcoin_address.slice(0, 6)}…{creator.bitcoin_address.slice(-4)}</div>}
                            {!creator.solana_address && !creator.ethereum_address && !creator.polygon_address && !creator.bitcoin_address && (
                              <span className="italic">No crypto wallets</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className={cn(adminTdClass, 'text-right')}>
                          <div className="font-bold tabular-nums text-[var(--brand-gold)]">
                            {formatAmount(creator.usd_balance_cents)}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-1 font-mono">
                            {creator.bank_account_number && creator.bank_routing_number ? (
                              <span>Bank ****{creator.bank_account_number.slice(-4)}</span>
                            ) : (
                              <span className="italic">No bank account</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </AdminTableShell>
          )}
        </div>
      </AdminDialogPanel>
    </Dialog>
  );
}

