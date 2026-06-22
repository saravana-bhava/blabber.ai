'use client';

import NextImage from 'next/image';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { 
  DollarSign, 
  Users, 
  TrendingUp, 
  Settings, 
  Crown, 
  BarChart3,
  Activity,
  CreditCard,
  ShoppingCart,
  Heart,
  MessageSquare,
  Eye,
  Download,
  RefreshCw,
  Package,
  UserCheck,
  Mic,
  Upload,
  StopCircle,
  ExternalLink,
  Share2,
  Copy,
  Phone,
  Sparkles,
  Camera
} from 'lucide-react';
import { toast } from 'sonner';
import { PieChart as RechartsPieChart, Pie, Cell } from 'recharts';
import { CartesiaClient } from "@cartesia/cartesia-js";

import { PageShell } from '@/components/layout/page-header';
import { useUser } from '@/lib/contexts/user-context';
import { RequireAuth } from '@/components/auth/require-auth';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { MonthlyStatements } from "@/components/admin/monthly-statements";
import { useTheme } from 'next-themes';
import { PersonalityCalibrationUI } from '@/components/creator-settings/PersonalityCalibrationUI';
import { CallModal } from '@/components/call/CallModal';
import { AiCallHourlyEarningsHint } from '@/components/creator/AiCallHourlyEarningsHint';
import { getRandomTemplates } from '@/data/marketing-templates';
import { cloneElevenVoiceFromStoragePath } from '@/lib/clone-eleven-voice-request';
import { uploadCreatorVoiceSample } from '@/lib/voice-sample-upload';
import { displayOrderStatus, shouldRepairOrderToPaid } from '@/lib/marketplace/order-status';
import {
  AdminCard,
  AdminSectionTitle,
  AdminPill,
  AdminStatTile,
  AdminGradButton,
  AdminGhostButton,
  AdminLoadingSpinner,
  AdminStatusPill,
  AdminTableShell,
  AdminTableHeaderRow,
  AdminTh,
  AdminSortBtn,
  adminTdClass,
  adminInputClass,
  adminSelectTriggerClass,
  adminTabTriggerClass,
  adminTabListClass,
} from '@/components/admin/admin-ui';
import { cn } from '@/lib/utils';

// Initialize Cartesia client with API key
const cartesiaApiKey = process.env.NEXT_PUBLIC_CARTESIA_API_KEY;
if (!cartesiaApiKey) {
  console.error('Cartesia API key is not set in environment variables');
}

const client = new CartesiaClient({ 
  apiKey: cartesiaApiKey || ''
});

interface CreatorAnalyticsData {
  grossRevenue: number;
  netRevenue: number;
  totalSubscribers: number;
  totalSubscribersCount: number;
  totalTransactions: number;
  subscriberLifetimeValue: number;
  netSubscriberChange: number;
  revenueByType: {
    tips: number;
    ppv: number;
    subscriptions: number;
    products: number;
    calls: number;
  };
  /** BLB-046: projected net earnings this month at current pace (from last 30d) */
  projectedMonthlyEarnings: number;
  /** BLB-047: time saved from AI */
  timeSaved: { aiDmCount: number; aiCallMinutes: number };
  /** BLB-048: growth and benchmarks */
  growth: {
    revenueGrowthRatePercent: number | null;
    benchmarkText: string;
  };
}

interface SubscriberData {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  email: string;
  subscribed_at: string;
  subscription_status: string;
  total_spent: number;
  last_payment: string;
}

interface OrderData {
  id: string;
  user_id: string;
  creator_product_id: string;
  order_status: string;
  created_at: string;
  shipping_address: any;
  tracking_number?: string | null;
  estimated_delivery_date?: string | null;
  product?: {
    product_name: string;
    main_photo: string | null;
    price_cents: number;
  } | null;
  buyer?: {
    username: string;
    full_name: string | null;
  } | null;
  transaction?: {
    amount_cents: number;
    currency: string;
    status: string;
  } | null;
}

interface CreatorSettings {
  subscription_tier_enabled: boolean;
  subscription_price_cents: number | null;
  subscription_interval: 'week' | 'month' | 'year' | null;
  ai_call_enabled: boolean;
  ai_dms_enabled: boolean;
  personality_prompt: string | null;
  voice_sample_path: string | null;
  image_gen_source_path: string | null;
  cartesia_voice_id: string | null;
  eleven_voice_id: string | null;
  ai_call_multi: number | null;
  ethereum_address?: string | null;
  polygon_address?: string | null;
  solana_address?: string | null;
  bitcoin_address?: string | null;
  bank_account_number?: string | null;
  bank_routing_number?: string | null;
}

async function deleteElevenLabsVoice(voiceId: string) {
  const response = await fetch('/api/voice-ai/delete-voice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voiceId }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error('Failed to delete ElevenLabs voice: ' + err);
  }
  return await response.json();
}

// Payouts Component
interface PayoutRecord {
  id: string;
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
  blockchain_tx_hash: string | null;
}

const PayoutsComponent = ({ creatorProfileId }: { creatorProfileId: string }) => {
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(true);
  const [totalBalance, setTotalBalance] = useState(0);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [filteredPayouts, setFilteredPayouts] = useState<PayoutRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [amountFilter, setAmountFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');

  const fetchPayoutsData = async () => {
    if (!creatorProfileId) return;

    setIsLoading(true);
    try {
      // Calculate total balance from unpaid transactions
      // Get creator's post IDs
      const { data: creatorPosts } = await supabase
        .from('posts')
        .select('id')
        .eq('user_id', creatorProfileId);

      const postIds = creatorPosts?.map(p => p.id) || [];

      // Get creator's product IDs
      const { data: creatorProducts } = await supabase
        .from('creator_products')
        .select('id')
        .eq('creator_profile_id', creatorProfileId);

      const productIds = creatorProducts?.map(p => p.id) || [];

      // Fetch unpaid transactions (always all-time, no date filter) - exclude pending
      const [callTransactions, productTransactions, ppvTransactions, tipTransactions, subscriptionPayments] = await Promise.all([
        // Call transactions
        supabase
          .from('call_transactions')
          .select('creator_share_cents')
          .eq('creator_profile_id', creatorProfileId)
          .gt('credits_cents', 0)
          .is('payout_id', null),
        
        // Product transactions
        productIds.length > 0
          ? supabase
              .from('creator_product_transactions')
              .select('creator_share_cents')
              .in('creator_product_id', productIds)
              .neq('status', 'pending')
              .is('payout_id', null)
          : Promise.resolve({ data: [], error: null }),
        
        // PPV transactions
        postIds.length > 0
          ? supabase
              .from('ppv_transactions')
              .select('creator_share_cents')
              .in('post_id', postIds)
              .neq('status', 'pending')
              .is('payout_id', null)
          : Promise.resolve({ data: [], error: null }),
        
        // Tip transactions
        postIds.length > 0
          ? supabase
              .from('tip_transactions')
              .select('creator_share_cents')
              .or(`creator_id.eq.${creatorProfileId},post_id.in.(${postIds.join(',')})`)
              .neq('status', 'pending')
              .is('payout_id', null)
          : supabase
              .from('tip_transactions')
              .select('creator_share_cents')
              .eq('creator_id', creatorProfileId)
              .neq('status', 'pending')
              .is('payout_id', null),
        
        // Subscription payments
        supabase
          .from('subscription_payments')
          .select('creator_share_cents')
          .eq('creator_profile_id', creatorProfileId)
          .neq('status', 'pending')
          .is('payout_id', null),
      ]);

      // Calculate total balance
      const total = [
        ...(callTransactions.data || []),
        ...((productTransactions as any)?.data || []),
        ...((ppvTransactions as any)?.data || []),
        ...(tipTransactions.data || []),
        ...(subscriptionPayments.data || []),
      ].reduce((sum, tx) => sum + (tx.creator_share_cents || 0), 0);

      setTotalBalance(total);

      // Fetch payouts
      const { data: payoutsData, error: payoutsError } = await supabase
        .from('payouts')
        .select('*')
        .eq('creator_profile_id', creatorProfileId)
        .order('created_at', { ascending: false });

      if (payoutsError) {
        console.error('Error fetching payouts:', payoutsError);
      } else {
        setPayouts(payoutsData || []);
        setFilteredPayouts(payoutsData || []);
      }
    } catch (error) {
      console.error('Error fetching payouts data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPayoutsData();
  }, [creatorProfileId]);

  useEffect(() => {
    let filtered = [...payouts];

    // Apply filters
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === statusFilter);
    }
    if (methodFilter !== 'all') {
      filtered = filtered.filter(p => p.payout_method === methodFilter);
    }
    if (amountFilter !== 'all') {
      // Simple amount filtering - could be enhanced
      const [min, max] = amountFilter.split('-').map(Number);
      filtered = filtered.filter(p => {
        const amount = p.amount_cents / 100;
        if (max) {
          return amount >= min && amount <= max;
        }
        return amount >= min;
      });
    }
    if (dateFilter !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      if (dateFilter === '7d') {
        filterDate.setDate(now.getDate() - 7);
      } else if (dateFilter === '30d') {
        filterDate.setDate(now.getDate() - 30);
      } else if (dateFilter === '90d') {
        filterDate.setDate(now.getDate() - 90);
      }
      filtered = filtered.filter(p => new Date(p.created_at) >= filterDate);
    }

    setFilteredPayouts(filtered);
  }, [statusFilter, methodFilter, amountFilter, dateFilter, payouts]);

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

  const getBlockchainExplorerUrl = (payout: PayoutRecord): string | null => {
    if (!payout.blockchain_tx_hash) return null;

    const txHash = payout.blockchain_tx_hash;

    switch (payout.payout_method) {
      case 'ethereum':
        return `https://etherscan.io/tx/${txHash}`;
      case 'polygon':
        return `https://polygonscan.com/tx/${txHash}`;
      case 'solana':
        return `https://solscan.io/tx/${txHash}`;
      case 'bitcoin':
        return `https://blockstream.info/tx/${txHash}`;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] space-y-4">
        <AdminLoadingSpinner className="min-h-[120px]" />
        <p className="text-muted-foreground text-sm">Loading payouts…</p>
      </div>
    );
  }

  return (
    <AdminCard>
      <AdminSectionTitle
        title="Total balance"
        description="Unpaid creator earnings awaiting payout"
        action={
          <AdminGhostButton onClick={fetchPayoutsData} size="sm" className="h-9">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </AdminGhostButton>
        }
      />
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <p className="font-display text-[clamp(28px,4vw,36px)] tabular-nums tracking-tight">
          {formatAmount(totalBalance)}
        </p>
        {totalBalance > 0 && <AdminPill variant="staff">On hold</AdminPill>}
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className={`${adminSelectTriggerClass} w-[130px]`}>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className={`${adminSelectTriggerClass} w-[130px]`}>
            <SelectValue placeholder="Method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Methods</SelectItem>
            <SelectItem value="solana">Solana</SelectItem>
            <SelectItem value="ethereum">Ethereum</SelectItem>
            <SelectItem value="polygon">Polygon</SelectItem>
            <SelectItem value="bitcoin">Bitcoin</SelectItem>
            <SelectItem value="bank">Bank</SelectItem>
          </SelectContent>
        </Select>

        <Select value={amountFilter} onValueChange={setAmountFilter}>
          <SelectTrigger className={`${adminSelectTriggerClass} w-[130px]`}>
            <SelectValue placeholder="Amount" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Amounts</SelectItem>
            <SelectItem value="0-100">$0 - $100</SelectItem>
            <SelectItem value="100-500">$100 - $500</SelectItem>
            <SelectItem value="500-1000">$500 - $1,000</SelectItem>
            <SelectItem value="1000">$1,000+</SelectItem>
          </SelectContent>
        </Select>

        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className={`${adminSelectTriggerClass} w-[130px]`}>
            <SelectValue placeholder="Date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>

        <AdminGhostButton size="sm" className="ml-auto h-9">
          <Download className="h-4 w-4" />
          Export
        </AdminGhostButton>
      </div>

      <AdminTableShell>
        <Table>
          <TableHeader>
            <AdminTableHeaderRow>
              <AdminTh>Date</AdminTh>
              <AdminTh>Status</AdminTh>
              <AdminTh>Destination</AdminTh>
              <AdminTh className="text-right">Amount</AdminTh>
              <AdminTh className="w-[100px]">Transaction</AdminTh>
            </AdminTableHeaderRow>
          </TableHeader>
          <TableBody>
            {filteredPayouts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No payouts found
                </TableCell>
              </TableRow>
            ) : (
              filteredPayouts.map((payout) => {
                const explorerUrl = getBlockchainExplorerUrl(payout);
                const isCrypto = ['solana', 'ethereum', 'polygon', 'bitcoin'].includes(payout.payout_method || '');
                
                return (
                  <TableRow 
                    key={payout.id}
                    className={explorerUrl ? 'cursor-pointer hover:bg-muted/50' : ''}
                    onClick={() => {
                      if (explorerUrl) {
                        window.open(explorerUrl, '_blank', 'noopener,noreferrer');
                      }
                    }}
                  >
                    <TableCell className={adminTdClass}>
                      {new Date(payout.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </TableCell>
                    <TableCell className={adminTdClass}>
                      <AdminStatusPill
                        variant={
                          payout.status === 'completed'
                            ? 'gold'
                            : payout.status === 'processing'
                              ? 'soft'
                              : payout.status === 'failed'
                                ? 'live'
                                : 'soft'
                        }
                      >
                        {payout.status.charAt(0).toUpperCase() + payout.status.slice(1)}
                      </AdminStatusPill>
                    </TableCell>
                    <TableCell className={adminTdClass}>
                      {formatDestination(payout)}
                    </TableCell>
                    <TableCell className={cn(adminTdClass, 'text-right font-semibold tabular-nums')}>
                      {formatAmount(payout.amount_cents)}
                    </TableCell>
                    <TableCell className={adminTdClass}>
                      {explorerUrl && isCrypto ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(explorerUrl, '_blank', 'noopener,noreferrer');
                          }}
                          title="View on blockchain explorer"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </AdminTableShell>
    </AdminCard>
  );
};

export default function CreatorDashboardPage() {
  const supabase = createClient();
  const router = useRouter();
  const { session, profile, isLoading, creator } = useUser();
  const [agencyForCreator, setAgencyForCreator] = useState<{ name: string; default_split_pct: number } | null>(
    null
  );

  useEffect(() => {
    const loadAgency = async () => {
      if (!creator?.agency_profile_id) {
        setAgencyForCreator(null);
        return;
      }
      const supabase = createClient();
      const { data } = await supabase
        .from('agencies')
        .select('name, default_split_pct')
        .eq('profile_id', creator.agency_profile_id)
        .maybeSingle();
      setAgencyForCreator(data ?? null);
    };
    void loadAgency();
  }, [creator?.agency_profile_id]);

  const effectiveAgencySplit =
    creator?.agency_split_pct_override ?? agencyForCreator?.default_split_pct ?? null;
  
  const [analyticsData, setAnalyticsData] = useState<CreatorAnalyticsData | null>(null);
  const [subscribers, setSubscribers] = useState<SubscriberData[]>([]);
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [creatorSettings, setCreatorSettings] = useState<CreatorSettings | null>(null);
  const [editedSettings, setEditedSettings] = useState<CreatorSettings | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [timeframe, setTimeframe] = useState('all');
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Sorting state for subscribers table
  const [subscriberSortField, setSubscriberSortField] = useState<'total_spent' | 'subscribed_at' | 'last_payment' | 'username'>('total_spent');
  const [subscriberSortDirection, setSubscriberSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showTestCallModal, setShowTestCallModal] = useState(false);
  const [marketingTemplates] = useState(() => getRandomTemplates());

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [imageGenPublicUrl, setImageGenPublicUrl] = useState<string | null>(null);
  const [isUploadingImageGen, setIsUploadingImageGen] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Check creator access — require completed age verification
  useEffect(() => {
    if (!isLoading && profile) {
      const checkCreatorStatus = async () => {
        const { data: creator, error } = await supabase
          .from('creators')
          .select('profile_id, veriff_verification_status')
          .eq('profile_id', profile.id)
          .single();

        if (error || !creator || creator.veriff_verification_status !== 'completed') {
          router.push('/become-a-creator');
        }
      };
      checkCreatorStatus();
    }
  }, [profile, isLoading, router]);

  // Generate audio URL when voice sample path changes
  useEffect(() => {
    if (editedSettings?.voice_sample_path) {
      const { data: { publicUrl } } = supabase.storage
        .from('creator-content')
        .getPublicUrl(editedSettings.voice_sample_path, {
          download: false
        });
      setAudioUrl(publicUrl);
    } else {
      setAudioUrl(null);
    }
  }, [editedSettings?.voice_sample_path, supabase.storage]);

  useEffect(() => {
    if (editedSettings?.image_gen_source_path) {
      const { data: { publicUrl } } = supabase.storage
        .from('creator-content')
        .getPublicUrl(editedSettings.image_gen_source_path, { download: false });
      setImageGenPublicUrl(publicUrl);
    } else {
      setImageGenPublicUrl(null);
    }
  }, [editedSettings?.image_gen_source_path, supabase.storage]);

  // Load analytics data
  const loadAnalyticsData = async () => {
    if (!profile?.id) return;
    
    setIsLoadingData(true);
    try {
      let startDate: Date | null = null;
      if (timeframe !== 'all') {
        const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : timeframe === '90d' ? 90 : timeframe === '1y' ? 365 : 365;
        startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      }

      // Get creator's gross revenue (before splits)
      // First get post IDs for this creator
      const { data: creatorPosts } = await supabase
        .from('posts')
        .select('id')
        .eq('user_id', profile.id);

      const postIds = creatorPosts?.map(p => p.id) || [];

      // Get tip transactions with creator_id - exclude pending
      let tipQueryWithCreatorId = supabase
        .from('tip_transactions')
        .select('amount_cents')
        .eq('creator_id', profile.id)
        .neq('status', 'pending');
      if (startDate) {
        tipQueryWithCreatorId = tipQueryWithCreatorId.gte('created_at', startDate.toISOString());
      }
      const { data: tipDataWithCreatorId } = await tipQueryWithCreatorId;

      // Then get tip transactions without creator_id but where the post belongs to this creator - exclude pending
      let tipQueryFromPosts = supabase
        .from('tip_transactions')
        .select('amount_cents')
        .is('creator_id', null)
        .in('post_id', postIds)
        .neq('status', 'pending');
      if (startDate) {
        tipQueryFromPosts = tipQueryFromPosts.gte('created_at', startDate.toISOString());
      }
      const { data: tipDataFromPosts } = await tipQueryFromPosts;

      // Combine both tip data sources
      const tipData = [...(tipDataWithCreatorId || []), ...(tipDataFromPosts || [])];

      // Get PPV transactions - first get post IDs, then get transactions - exclude pending
      let ppvData: any[] = [];
      if (postIds.length > 0) {
        let ppvQuery = supabase
          .from('ppv_transactions')
          .select('amount_cents')
          .in('post_id', postIds)
          .neq('status', 'pending');
        if (startDate) {
          ppvQuery = ppvQuery.gte('created_at', startDate.toISOString());
        }
        const { data: ppvTransactions } = await ppvQuery;
        ppvData = ppvTransactions || [];
      }

      let subQuery = supabase
        .from('subscription_payments')
        .select('amount_cents')
        .eq('creator_profile_id', profile.id)
        .neq('status', 'pending');
      if (startDate) {
        subQuery = subQuery.gte('created_at', startDate.toISOString());
      }
      const { data: subData } = await subQuery;

      // Get product transactions - first get product IDs, then get transactions
      const { data: creatorProducts } = await supabase
        .from('creator_products')
        .select('id')
        .eq('creator_profile_id', profile.id);

      const productIds = creatorProducts?.map(p => p.id) || [];
      let productData: any[] = [];
      if (productIds.length > 0) {
        let productQuery = supabase
          .from('creator_product_transactions')
          .select('amount_cents')
          .in('creator_product_id', productIds)
          .neq('status', 'pending');
        if (startDate) {
          productQuery = productQuery.gte('created_at', startDate.toISOString());
        }
        const { data: productTransactions } = await productQuery;
        productData = productTransactions || [];
      }

      // Get call transactions for gross revenue (total credits_cents) - exclude pending
      let callQuery = supabase
        .from('call_transactions')
        .select('credits_cents')
        .eq('creator_profile_id', profile.id)
        .gt('credits_cents', 0);
      if (startDate) {
        callQuery = callQuery.gte('created_at', startDate.toISOString());
      }
      const { data: callData } = await callQuery;

      // Get call transactions for net revenue (creator_share_cents) - exclude pending
      let callNetQuery = supabase
        .from('call_transactions')
        .select('creator_share_cents, agency_share_cents')
        .eq('creator_profile_id', profile.id)
        .gt('credits_cents', 0);
      if (startDate) {
        callNetQuery = callNetQuery.gte('created_at', startDate.toISOString());
      }
      const { data: callNetData } = await callNetQuery;

      // Get creator's net revenue (creator share)
      // Get tip transactions with creator_id for net revenue - exclude pending
      let tipNetQueryWithCreatorId = supabase
        .from('tip_transactions')
        .select('creator_share_cents, agency_share_cents')
        .eq('creator_id', profile.id)
        .neq('status', 'pending');
      if (startDate) {
        tipNetQueryWithCreatorId = tipNetQueryWithCreatorId.gte('created_at', startDate.toISOString());
      }
      const { data: tipNetDataWithCreatorId } = await tipNetQueryWithCreatorId;

      // Get tip transactions without creator_id but where the post belongs to this creator - exclude pending
      let tipNetQueryFromPosts = supabase
        .from('tip_transactions')
        .select('creator_share_cents, agency_share_cents')
        .is('creator_id', null)
        .in('post_id', postIds)
        .neq('status', 'pending');
      if (startDate) {
        tipNetQueryFromPosts = tipNetQueryFromPosts.gte('created_at', startDate.toISOString());
      }
      const { data: tipNetDataFromPosts } = await tipNetQueryFromPosts;

      // Combine both tip net data sources
      const tipNetData = [...(tipNetDataWithCreatorId || []), ...(tipNetDataFromPosts || [])];

      let ppvNetData: any[] = [];
      if (postIds.length > 0) {
        let ppvNetQuery = supabase
          .from('ppv_transactions')
          .select('creator_share_cents, agency_share_cents')
          .in('post_id', postIds)
          .neq('status', 'pending');
        if (startDate) {
          ppvNetQuery = ppvNetQuery.gte('created_at', startDate.toISOString());
        }
        const { data: ppvNetTransactions } = await ppvNetQuery;
        ppvNetData = ppvNetTransactions || [];
      }

      let subNetQuery = supabase
        .from('subscription_payments')
        .select('creator_share_cents, agency_share_cents')
        .eq('creator_profile_id', profile.id)
        .neq('status', 'pending');
      if (startDate) {
        subNetQuery = subNetQuery.gte('created_at', startDate.toISOString());
      }
      const { data: subNetData } = await subNetQuery;

      let productNetData: any[] = [];
      if (productIds.length > 0) {
        let productNetQuery = supabase
          .from('creator_product_transactions')
          .select('creator_share_cents, agency_share_cents')
          .in('creator_product_id', productIds)
          .neq('status', 'pending');
        if (startDate) {
          productNetQuery = productNetQuery.gte('created_at', startDate.toISOString());
        }
        const { data: productNetTransactions } = await productNetQuery;
        productNetData = productNetTransactions || [];
      }

      // Calculate totals
      const grossRevenue = (tipData?.reduce((sum, t) => sum + (t.amount_cents || 0), 0) || 0) +
                          (ppvData?.reduce((sum, p) => sum + (p.amount_cents || 0), 0) || 0) +
                          (subData?.reduce((sum, s) => sum + (s.amount_cents || 0), 0) || 0) +
                          (productData?.reduce((sum, p) => sum + (p.amount_cents || 0), 0) || 0) +
                          (callData?.reduce((sum, c) => sum + (c.credits_cents || 0), 0) || 0);

      const takeHomeOf = (rows: any[] | null | undefined) =>
        (rows || []).reduce(
          (sum, r) => sum + Math.max(0, (r.creator_share_cents || 0) - (r.agency_share_cents || 0)),
          0
        );

      const netRevenue =
        takeHomeOf(tipNetData) +
        takeHomeOf(ppvNetData) +
        takeHomeOf(subNetData) +
        takeHomeOf(productNetData) +
        takeHomeOf(callNetData);

      // Get subscriber counts
      const { count: totalSubscribers } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', profile.id)
        .eq('status', 'active');

      // Calculate net subscriber change in the time period
      // Only calculate if we have a startDate (not "all time")
      let subscribersBeforePeriod: number | null = null;
      if (startDate) {
        const { count } = await supabase
          .from('subscriptions')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', profile.id)
          .eq('status', 'active')
          .lt('created_at', startDate.toISOString());
        subscribersBeforePeriod = count;
      }

      const netSubscriberChange = (totalSubscribers || 0) - (subscribersBeforePeriod || 0);

      // Calculate subscriber lifetime value (average revenue per subscriber)
      const subscriberLifetimeValue = totalSubscribers && totalSubscribers > 0 ? netRevenue / totalSubscribers : 0;

      // BLB-046: Projected earnings this month = so far this month + (daily rate × days left)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const daysRemaining = Math.max(0, daysInMonth - now.getDate());
      const monthStartIso = startOfMonth.toISOString();
      const thirtyDaysIso = thirtyDaysAgo.toISOString();

      const { data: subNet30 } = await supabase.from('subscription_payments').select('creator_share_cents').eq('creator_profile_id', profile.id).neq('status', 'pending').gte('created_at', thirtyDaysIso);
      const { data: tipNet30WithCreator } = await supabase.from('tip_transactions').select('creator_share_cents').eq('creator_id', profile.id).neq('status', 'pending').gte('created_at', thirtyDaysIso);
      const { data: tipNet30FromPosts } = postIds.length
        ? await supabase.from('tip_transactions').select('creator_share_cents').is('creator_id', null).in('post_id', postIds).neq('status', 'pending').gte('created_at', thirtyDaysIso)
        : { data: [] };
      const net30Tips = (tipNet30WithCreator || []).reduce((s: number, t: any) => s + (t.creator_share_cents || 0), 0) + (tipNet30FromPosts || []).reduce((s: number, t: any) => s + (t.creator_share_cents || 0), 0);
      const net30Sub = (subNet30 || []).reduce((s: number, t: any) => s + (t.creator_share_cents || 0), 0);
      const { data: callNet30 } = await supabase.from('call_transactions').select('creator_share_cents').eq('creator_profile_id', profile.id).gt('credits_cents', 0).gte('created_at', thirtyDaysIso);
      const net30Calls = (callNet30 || []).reduce((s: number, t: any) => s + (t.creator_share_cents || 0), 0);
      let ppvNet30 = 0;
      if (postIds.length) {
        const { data: ppv30 } = await supabase.from('ppv_transactions').select('creator_share_cents').in('post_id', postIds).neq('status', 'pending').gte('created_at', thirtyDaysIso);
        ppvNet30 = (ppv30 || []).reduce((s: number, t: any) => s + (t.creator_share_cents || 0), 0);
      }
      let productNet30 = 0;
      if (productIds.length) {
        const { data: prod30 } = await supabase.from('creator_product_transactions').select('creator_share_cents').in('creator_product_id', productIds).neq('status', 'pending').gte('created_at', thirtyDaysIso);
        productNet30 = (prod30 || []).reduce((s: number, t: any) => s + (t.creator_share_cents || 0), 0);
      }
      const netLast30 = net30Tips + net30Sub + net30Calls + ppvNet30 + productNet30;
      const dailyRateCents = netLast30 / 30;

      const { data: subMonth } = await supabase.from('subscription_payments').select('creator_share_cents').eq('creator_profile_id', profile.id).neq('status', 'pending').gte('created_at', monthStartIso);
      const { data: tipMonthWithCreator } = await supabase.from('tip_transactions').select('creator_share_cents').eq('creator_id', profile.id).neq('status', 'pending').gte('created_at', monthStartIso);
      const { data: tipMonthFromPosts } = postIds.length ? await supabase.from('tip_transactions').select('creator_share_cents').is('creator_id', null).in('post_id', postIds).neq('status', 'pending').gte('created_at', monthStartIso) : { data: [] };
      const { data: callMonth } = await supabase.from('call_transactions').select('creator_share_cents').eq('creator_profile_id', profile.id).gt('credits_cents', 0).gte('created_at', monthStartIso);
      const monthTips = (tipMonthWithCreator || []).reduce((s: number, t: any) => s + (t.creator_share_cents || 0), 0) + (tipMonthFromPosts || []).reduce((s: number, t: any) => s + (t.creator_share_cents || 0), 0);
      const monthSub = (subMonth || []).reduce((s: number, t: any) => s + (t.creator_share_cents || 0), 0);
      const monthCalls = (callMonth || []).reduce((s: number, t: any) => s + (t.creator_share_cents || 0), 0);
      let monthPpv = 0, monthProd = 0;
      if (postIds.length) {
        const { data: ppvMonth } = await supabase.from('ppv_transactions').select('creator_share_cents').in('post_id', postIds).neq('status', 'pending').gte('created_at', monthStartIso);
        monthPpv = (ppvMonth || []).reduce((s: number, t: any) => s + (t.creator_share_cents || 0), 0);
      }
      if (productIds.length) {
        const { data: prodMonth } = await supabase.from('creator_product_transactions').select('creator_share_cents').in('creator_product_id', productIds).neq('status', 'pending').gte('created_at', monthStartIso);
        monthProd = (prodMonth || []).reduce((s: number, t: any) => s + (t.creator_share_cents || 0), 0);
      }
      const earnedThisMonthCents = monthTips + monthSub + monthCalls + monthPpv + monthProd;
      const projectedMonthlyEarnings = earnedThisMonthCents + dailyRateCents * daysRemaining;

      // BLB-047: Time saved — AI DMs (messages sent by creator = AI replies) and AI call minutes
      let aiDmCount = 0;
      const { count: aiDmCountRes } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('sender_id', profile.id);
      aiDmCount = aiDmCountRes ?? 0;
      let aiCallMinutes = 0;
      const { data: callLengths } = await supabase.from('call_transactions').select('call_length_seconds').eq('creator_profile_id', profile.id);
      aiCallMinutes = (callLengths || []).reduce((s, c) => s + ((c as any).call_length_seconds || 0) / 60, 0);

      // BLB-048: Revenue growth (last 30d vs previous 30d) and benchmark
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const prev30Start = sixtyDaysAgo.toISOString();
      const prev30End = thirtyDaysAgo.toISOString();
      const { data: subNetPrev30 } = await supabase.from('subscription_payments').select('creator_share_cents').eq('creator_profile_id', profile.id).neq('status', 'pending').gte('created_at', prev30Start).lt('created_at', prev30End);
      const { data: callNetPrev30 } = await supabase.from('call_transactions').select('creator_share_cents').eq('creator_profile_id', profile.id).gt('credits_cents', 0).gte('created_at', prev30Start).lt('created_at', prev30End);
      const prev30Sub = (subNetPrev30 || []).reduce((s: number, t: any) => s + (t.creator_share_cents || 0), 0);
      const prev30Calls = (callNetPrev30 || []).reduce((s: number, t: any) => s + (t.creator_share_cents || 0), 0);
      const { data: tipPrevWithCreator } = await supabase.from('tip_transactions').select('creator_share_cents').eq('creator_id', profile.id).neq('status', 'pending').gte('created_at', prev30Start).lt('created_at', prev30End);
      const { data: tipPrevFromPosts } = postIds.length ? await supabase.from('tip_transactions').select('creator_share_cents').is('creator_id', null).in('post_id', postIds).neq('status', 'pending').gte('created_at', prev30Start).lt('created_at', prev30End) : { data: [] };
      const prev30Tips = (tipPrevWithCreator || []).reduce((s: number, t: any) => s + (t.creator_share_cents || 0), 0) + (tipPrevFromPosts || []).reduce((s: number, t: any) => s + (t.creator_share_cents || 0), 0);
      let prev30Ppv = 0, prev30Prod = 0;
      if (postIds.length) {
        const { data: ppvPrev } = await supabase.from('ppv_transactions').select('creator_share_cents').in('post_id', postIds).neq('status', 'pending').gte('created_at', prev30Start).lt('created_at', prev30End);
        prev30Ppv = (ppvPrev || []).reduce((s: number, t: any) => s + (t.creator_share_cents || 0), 0);
      }
      if (productIds.length) {
        const { data: prodPrev } = await supabase.from('creator_product_transactions').select('creator_share_cents').in('creator_product_id', productIds).neq('status', 'pending').gte('created_at', prev30Start).lt('created_at', prev30End);
        prev30Prod = (prodPrev || []).reduce((s: number, t: any) => s + (t.creator_share_cents || 0), 0);
      }
      const netPrev30 = prev30Tips + prev30Sub + prev30Calls + prev30Ppv + prev30Prod;
      const revenueGrowthRatePercent = netPrev30 > 0 ? ((netLast30 - netPrev30) / netPrev30) * 100 : null;
      const benchmarkText = totalSubscribers && totalSubscribers >= 10
        ? `Creators like you typically hit $${Math.max(50, Math.round(subscriberLifetimeValue * 20) / 10)} by month 3.`
        : 'Grow to 10+ subscribers to see your benchmark.';

      setAnalyticsData({
        grossRevenue,
        netRevenue,
        totalSubscribers: totalSubscribers || 0,
        totalSubscribersCount: totalSubscribers || 0,
        totalTransactions: (tipData?.length || 0) + (ppvData?.length || 0) + (subData?.length || 0) + (productData?.length || 0) + (callData?.length || 0),
        subscriberLifetimeValue,
        netSubscriberChange,
        revenueByType: {
          tips: tipData?.reduce((sum, t) => sum + (t.amount_cents || 0), 0) || 0,
          ppv: ppvData?.reduce((sum, p) => sum + (p.amount_cents || 0), 0) || 0,
          subscriptions: subData?.reduce((sum, s) => sum + (s.amount_cents || 0), 0) || 0,
          products: productData?.reduce((sum, p) => sum + (p.amount_cents || 0), 0) || 0,
          calls: callData?.reduce((sum, c) => sum + (c.credits_cents || 0), 0) || 0,
        },
        projectedMonthlyEarnings,
        timeSaved: { aiDmCount, aiCallMinutes },
        growth: { revenueGrowthRatePercent, benchmarkText },
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setIsLoadingData(false);
    }
  };

  // Load subscribers data
  const loadSubscribersData = async () => {
    if (!profile?.id) return;
    
    try {
      const { data: subscriptions, error } = await supabase
        .from('subscriptions')
        .select(`
          follower_id,
          created_at,
          status,
          follower:profiles!follower_id(
            id,
            username,
            full_name,
            avatar_url
          )
        `)
        .eq('following_id', profile.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calculate total spent for each subscriber
      const subscribersWithSpending = await Promise.all(
        (subscriptions || []).map(async (sub: any) => {
          // Get subscription payments
          const { data: payments } = await supabase
            .from('subscription_payments')
            .select('amount_cents, created_at')
            .eq('creator_profile_id', profile.id)
            .eq('user_id', sub.follower_id)
            .order('created_at', { ascending: false });

          // Get tip transactions where this subscriber is the payor
          const { data: tipTransactions } = await supabase
            .from('tip_transactions')
            .select('amount_cents, created_at')
            .eq('user_id', sub.follower_id)
            .eq('creator_id', profile.id)
            .order('created_at', { ascending: false });

          // Get creator's posts to match with post tips
          const { data: creatorPosts } = await supabase
            .from('posts')
            .select('id')
            .eq('user_id', profile.id);

          const creatorPostIds = creatorPosts?.map(p => p.id) || [];

          // Get tip transactions without creator_id but linked to creator's posts
          const { data: postTipTransactions } = await supabase
            .from('tip_transactions')
            .select('amount_cents, created_at')
            .eq('user_id', sub.follower_id)
            .is('creator_id', null)
            .in('post_id', creatorPostIds)
            .order('created_at', { ascending: false });

          // Combine all tip transactions
          const allTipTransactions = [...(tipTransactions || []), ...(postTipTransactions || [])];

          const totalSpent = (payments?.reduce((sum, p) => sum + (p.amount_cents || 0), 0) || 0) +
                           (allTipTransactions?.reduce((sum, t) => sum + (t.amount_cents || 0), 0) || 0);
          
          const lastPayment = payments?.[0]?.created_at || allTipTransactions?.[0]?.created_at || '';

          return {
            id: sub.follower_id,
            username: sub.follower?.username || 'Unknown',
            full_name: sub.follower?.full_name || 'Unknown User',
            avatar_url: sub.follower?.avatar_url || '',
            email: '', // profiles table doesn't have email column
            subscribed_at: sub.created_at,
            subscription_status: sub.status,
            total_spent: totalSpent,
            last_payment: lastPayment,
          };
        })
      );

      setSubscribers(subscribersWithSpending);
    } catch (error) {
      console.error('Error loading subscribers:', error);
      toast.error('Failed to load subscribers data');
    }
  };

  // Load orders data
  const loadOrdersData = async () => {
    if (!profile?.id) return;
    
    try {
      // First get all products created by this creator
      const { data: creatorProducts, error: productsError } = await supabase
        .from('creator_products')
        .select('id')
        .eq('creator_profile_id', profile.id);

      if (productsError) throw productsError;

      const productIds = creatorProducts?.map(p => p.id) || [];
      
      if (productIds.length === 0) {
        setOrders([]);
        return;
      }

      // Then get orders for those products
      const { data: ordersData, error } = await supabase
        .from('creator_product_orders')
        .select(`
          *,
          product:creator_products!creator_product_id(
            product_name,
            main_photo,
            price_cents,
            creator_profile_id
          ),
          buyer:profiles!user_id(
            username,
            full_name
          )
        `)
        .in('creator_product_id', productIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get transaction data separately since there's no direct relationship
      const ordersWithTransactions = await Promise.all(
        (ordersData || []).map(async (order: any) => {
          const { data: transaction } = await supabase
            .from('creator_product_transactions')
            .select('amount_cents, currency, status')
            .eq('id', order.creator_product_transaction_id)
            .single();

          return {
            ...order,
            transaction: transaction || null,
          };
        })
      );

      let orders = ordersWithTransactions;
      const stuckPaid = orders.filter(shouldRepairOrderToPaid);
      if (stuckPaid.length > 0) {
        const { error: repairError } = await supabase
          .from('creator_product_orders')
          .update({ order_status: 'paid', updated_at: new Date().toISOString() })
          .in('id', stuckPaid.map((o) => o.id));
        if (!repairError) {
          orders = orders.map((o) =>
            shouldRepairOrderToPaid(o) ? { ...o, order_status: 'paid' } : o
          );
        }
      }
      setOrders(orders);
    } catch (error) {
      console.error('Error loading orders:', error);
      toast.error('Failed to load orders data');
    }
  };

  // Load creator settings
  const loadCreatorSettings = async () => {
    if (!profile?.id) return;
    
    try {
      const { data: settings, error } = await supabase
        .from('creators')
        .select('*')
        .eq('profile_id', profile.id)
        .single();

      if (error) throw error;

      setCreatorSettings(settings);
      setEditedSettings(JSON.parse(JSON.stringify(settings))); // Deep copy
      setIsDirty(false);
    } catch (error) {
      console.error('Error loading creator settings:', error);
      toast.error('Failed to load creator settings');
    }
  };

  // Load all data on mount
  useEffect(() => {
    if (profile?.id) {
      loadAnalyticsData();
      loadSubscribersData();
      loadOrdersData();
      loadCreatorSettings();
    }
  }, [profile?.id, timeframe]);

  // Settings functions
  const handleSettingsChange = (key: keyof CreatorSettings, value: any) => {
    if (!editedSettings) return;
    
    setEditedSettings(prev => prev ? { ...prev, [key]: value } : null);
    setIsDirty(true);
  };

  const handleSaveSettings = async () => {
    if (!editedSettings || !profile?.id) return;

    try {
      const { error } = await supabase
        .from('creators')
        .update(editedSettings)
        .eq('profile_id', profile.id);

      if (error) throw error;
      
      toast.success('Settings saved successfully!');
      loadCreatorSettings(); // Reload to sync state
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings.');
    }
  };

  // Voice recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
          channelCount: 2
        } 
      });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: 'audio/webm;codecs=opus'
        });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 20) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to start recording. Please check your microphone permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast.error('File size must be less than 10MB');
        return;
      }
      setAudioBlob(file);
    }
  };

  const uploadAudio = async () => {
    if (!audioBlob || !session?.user) {
      toast.error('No audio data or user session available');
      return;
    }

    setIsUploading(true);
    try {

      const filePath = await uploadCreatorVoiceSample(
        supabase,
        session.user.id,
        audioBlob
      );

      // Update creator record with the new voice sample path
      const { error: updateError } = await supabase
        .from('creators')
        .update({ voice_sample_path: filePath })
        .eq('profile_id', session.user.id);

      if (updateError) {
        console.error('Database update error:', updateError);
        throw new Error(`Failed to update creator record: ${updateError.message}`);
      }

      const voiceId = await cloneElevenVoiceFromStoragePath(filePath);
      const { error: elevenUpdateError } = await supabase
        .from('creators')
        .update({ eleven_voice_id: voiceId })
        .eq('profile_id', session.user.id);
      if (elevenUpdateError) {
        console.error('Error updating ElevenLabs voice ID:', elevenUpdateError);
        throw new Error(
          `Voice cloned but failed to save voice id: ${elevenUpdateError.message}`
        );
      }
      if (editedSettings) {
        setEditedSettings({
          ...editedSettings,
          voice_sample_path: filePath,
          eleven_voice_id: voiceId,
        });
      }

      // --- Cartesia logic (commented out for rollback) ---
      /*
      try {
        const response = await fetch(publicUrl);
        const audioData = await response.arrayBuffer();
        // Create a File object instead of a Blob
        const audioFile = new File([audioData], fileName, { type: audioBlob.type });
        const voiceMetadata = await client.voices.clone(audioFile, {
          name: session.user.id,
          mode: "similarity",
          language: "en",
        });
        // Update creator record with the Cartesia voice ID
        const { error: voiceUpdateError } = await supabase
          .from('creators')
          .update({ cartesia_voice_id: voiceMetadata.id })
          .eq('profile_id', session.user.id);
        if (voiceUpdateError) {
          console.error('Error updating voice ID:', voiceUpdateError);
          toast.error('Voice sample uploaded but failed to save voice ID');
        }
      } catch (cloneError) {
        console.error('Voice cloning error:', cloneError);
        // Don't throw here, as the upload was successful
        toast.error('Voice sample uploaded but cloning failed. Please try again later.');
      }
      */
      // --- End Cartesia logic ---

      setAudioBlob(null);
      toast.success('Voice sample uploaded successfully');
    } catch (error) {
      console.error('Error uploading audio:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload voice sample');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteVoiceSample = async () => {
    if (!editedSettings?.voice_sample_path || !session?.user) return;

    try {
      // Get the creator record to get the ElevenLabs voice ID
      const { data: creator, error: fetchError } = await supabase
        .from('creators')
        .select('eleven_voice_id')
        .eq('profile_id', session.user.id)
        .single();

      if (fetchError) throw fetchError;

      // Delete from ElevenLabs if we have a voice ID
      if (creator?.eleven_voice_id) {
        try {
          await deleteElevenLabsVoice(creator.eleven_voice_id);
        } catch (elevenError) {
          console.error('Error deleting voice from ElevenLabs:', elevenError);
          // Continue with local deletion even if ElevenLabs deletion fails
        }
      }

      // --- Cartesia logic (commented out for rollback) ---
      /*
      // Get the creator record to get the Cartesia voice ID
      const { data: creator, error: fetchError } = await supabase
        .from('creators')
        .select('cartesia_voice_id')
        .eq('profile_id', session.user.id)
        .single();
      if (fetchError) throw fetchError;
      // Delete from Cartesia if we have a voice ID
      if (creator?.cartesia_voice_id) {
        try {
          await client.voices.delete(creator.cartesia_voice_id);
        } catch (cartesiaError) {
          console.error('Error deleting voice from Cartesia:', cartesiaError);
          // Continue with local deletion even if Cartesia deletion fails
        }
      }
      */
      // --- End Cartesia logic ---

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('creator-content')
        .remove([editedSettings.voice_sample_path]);

      if (storageError) throw storageError;

      // Update creator record
      const { error: updateError } = await supabase
        .from('creators')
        .update({ 
          voice_sample_path: null,
          eleven_voice_id: null 
        })
        .eq('profile_id', session.user.id);

      if (updateError) throw updateError;

      if (editedSettings) {
        setEditedSettings({
          ...editedSettings,
          voice_sample_path: null,
          eleven_voice_id: null
        });
      }
      setAudioUrl(null);
      toast.success('Voice sample deleted successfully');
    } catch (error) {
      console.error('Error deleting voice sample:', error);
      toast.error('Failed to delete voice sample');
    }
  };

  const handleImageGenReferenceFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (event.target) event.target.value = '';
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error('Image must be 15MB or smaller.');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      toast.error('Use JPG, PNG, WEBP, or GIF.');
      return;
    }
    void uploadImageGenReference(file);
  };

  const uploadImageGenReference = async (file: File) => {
    if (!session?.user) {
      toast.error('You must be signed in.');
      return;
    }
    setIsUploadingImageGen(true);
    try {
      const prevPath = editedSettings?.image_gen_source_path;
      const ext = file.name.split('.').pop() || (file.type.split('/')[1] ?? 'jpg');
      const fileName = `${session.user.id}-${Date.now()}.${ext}`;
      const filePath = `image-gen-reference/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('creator-content')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw new Error(uploadError.message);

      const { error: updateError } = await supabase
        .from('creators')
        .update({ image_gen_source_path: filePath })
        .eq('profile_id', session.user.id);

      if (updateError) throw new Error(updateError.message);

      if (prevPath && prevPath !== filePath) {
        await supabase.storage.from('creator-content').remove([prevPath]);
      }

      if (editedSettings) {
        setEditedSettings({ ...editedSettings, image_gen_source_path: filePath });
      }
      toast.success('Reference photo saved for image generation.');
    } catch (error) {
      console.error('Image gen reference upload:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload reference photo');
    } finally {
      setIsUploadingImageGen(false);
    }
  };

  const handleDeleteImageGenReference = async () => {
    if (!editedSettings?.image_gen_source_path || !session?.user) return;
    try {
      const { error: storageError } = await supabase.storage
        .from('creator-content')
        .remove([editedSettings.image_gen_source_path]);
      if (storageError) throw storageError;

      const { error: updateError } = await supabase
        .from('creators')
        .update({ image_gen_source_path: null })
        .eq('profile_id', session.user.id);
      if (updateError) throw updateError;

      if (editedSettings) {
        setEditedSettings({ ...editedSettings, image_gen_source_path: null });
      }
      setImageGenPublicUrl(null);
      toast.success('Reference photo removed.');
    } catch (error) {
      console.error('Error deleting image gen reference:', error);
      toast.error('Failed to remove reference photo');
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <AdminLoadingSpinner className="min-h-[200px]" />
        <p className="text-sm text-muted-foreground">Loading dashboard…</p>
      </div>
    );
  }

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  // Sort subscribers function
  const sortSubscribers = (subscribers: SubscriberData[]) => {
    return [...subscribers].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (subscriberSortField) {
        case 'total_spent':
          aValue = a.total_spent;
          bValue = b.total_spent;
          break;
        case 'subscribed_at':
          aValue = new Date(a.subscribed_at).getTime();
          bValue = new Date(b.subscribed_at).getTime();
          break;
        case 'last_payment':
          aValue = a.last_payment ? new Date(a.last_payment).getTime() : 0;
          bValue = b.last_payment ? new Date(b.last_payment).getTime() : 0;
          break;
        case 'username':
          aValue = a.username.toLowerCase();
          bValue = b.username.toLowerCase();
          break;
        default:
          return 0;
      }

      if (subscriberSortDirection === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });
  };

  // Handle sort change
  const handleSubscriberSort = (field: 'total_spent' | 'subscribed_at' | 'last_payment' | 'username') => {
    if (subscriberSortField === field) {
      setSubscriberSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSubscriberSortField(field);
      setSubscriberSortDirection('desc');
    }
  };

  return (
    <RequireAuth>
      <PageShell
        title="Creator dashboard"
        subtitle={
          profile?.username
            ? `@${profile.username} · analytics & earnings`
            : 'Analytics & earnings'
        }
        rightActions={
          <AdminPill variant="staff" className="hidden sm:inline-flex">
            <Crown className="h-3.5 w-3.5" />
            Creator
          </AdminPill>
        }
      >
        <div className="max-w-[980px] mx-auto w-full min-w-0 px-5 md:px-6 py-5 pb-16 space-y-6 overflow-x-hidden">
            {effectiveAgencySplit != null && agencyForCreator ? (
              <div
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-[color-mix(in_oklch,var(--brand-gold)_40%,var(--border))] px-4 py-3"
                style={{ background: 'var(--brand-grad-soft)' }}
              >
                <AdminPill variant="gold">
                  Managed by {agencyForCreator.name}
                </AdminPill>
                <p className="text-sm text-muted-foreground">
                  Your agency takes{' '}
                  <span className="font-semibold text-foreground">{Number(effectiveAgencySplit).toFixed(2)}%</span>{' '}
                  of your creator share. Your take-home below already reflects this.
                </p>
              </div>
            ) : null}
            <Tabs defaultValue="analytics" className="space-y-6">
              <TabsList className={cn(adminTabListClass, 'md:grid-cols-6')}>
                <TabsTrigger value="analytics" className={adminTabTriggerClass} data-creator-tour="analytics-tab">
                  <BarChart3 className="h-4 w-4" />
                  Analytics
                </TabsTrigger>
                <TabsTrigger value="marketing" className={adminTabTriggerClass}>
                  <Share2 className="h-4 w-4" />
                  Marketing
                </TabsTrigger>
                <TabsTrigger value="payouts" className={adminTabTriggerClass}>
                  <DollarSign className="h-4 w-4" />
                  Payouts
                </TabsTrigger>
                <TabsTrigger value="subscribers" className={adminTabTriggerClass}>
                  <UserCheck className="h-4 w-4" />
                  Subscribers
                </TabsTrigger>
                <TabsTrigger value="orders" className={adminTabTriggerClass}>
                  <Package className="h-4 w-4" />
                  Orders
                </TabsTrigger>
                <TabsTrigger value="settings" className={adminTabTriggerClass}>
                  <Settings className="h-4 w-4" />
                  Settings
                </TabsTrigger>
              </TabsList>

              <TabsContent value="analytics" className="space-y-6 mt-0">
                <div className="flex flex-wrap items-center gap-3">
                  <Label htmlFor="timeframe" className="text-sm font-semibold shrink-0">Time period</Label>
                  <Select value={timeframe} onValueChange={setTimeframe}>
                    <SelectTrigger id="timeframe" className={`${adminSelectTriggerClass} w-[140px]`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All time</SelectItem>
                      <SelectItem value="7d">Last 7 days</SelectItem>
                      <SelectItem value="30d">Last 30 days</SelectItem>
                      <SelectItem value="90d">Last 90 days</SelectItem>
                      <SelectItem value="1y">Last year</SelectItem>
                    </SelectContent>
                  </Select>
                  <AdminGhostButton onClick={loadAnalyticsData} disabled={isLoadingData} size="sm" className="h-9">
                    <Activity className="h-4 w-4" />
                    Refresh
                  </AdminGhostButton>
                </div>

                <AdminCard className="[background:var(--brand-grad-soft)]">
                  <AdminSectionTitle
                    title="At your current pace"
                    description="Projected from what you've earned this month + your daily rate (last 30 days) × days left"
                  />
                  <p className="font-display text-[clamp(24px,3.5vw,32px)] tabular-nums tracking-tight">
                    {analyticsData ? formatCurrency(analyticsData.projectedMonthlyEarnings) : '$0.00'}
                    <span className="text-sm font-normal text-muted-foreground ml-2">projected this month</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">Predictable view of earnings reduces anxiety and keeps you engaged.</p>
                </AdminCard>

                <AdminCard>
                  <AdminSectionTitle
                    title="Time saved by AI"
                    description="~2 min per AI DM + call time. Your AI handled these for you."
                  />
                  <div className="flex flex-wrap gap-6">
                    <div>
                      <p className="text-xl font-bold tabular-nums">{analyticsData?.timeSaved.aiDmCount ?? 0}</p>
                      <p className="text-xs text-muted-foreground">AI DMs sent</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold tabular-nums">{analyticsData?.timeSaved ? `${Math.round(analyticsData.timeSaved.aiCallMinutes)}m` : '0m'}</p>
                      <p className="text-xs text-muted-foreground">AI call minutes</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold tabular-nums">
                        {analyticsData?.timeSaved
                          ? `~${Math.round(analyticsData.timeSaved.aiDmCount * 2 + analyticsData.timeSaved.aiCallMinutes)}m`
                          : '0m'}
                      </p>
                      <p className="text-xs text-muted-foreground">Est. time saved</p>
                    </div>
                  </div>
                </AdminCard>

                <AdminCard>
                  <AdminSectionTitle
                    title="Growth & benchmarks"
                    description="Your trajectory and how you compare"
                  />
                  <div className="flex flex-wrap gap-6 mb-3">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Fan acquisition (this period)</p>
                      <p className={cn('text-lg font-bold tabular-nums', analyticsData?.netSubscriberChange != null && analyticsData.netSubscriberChange >= 0 ? 'text-green-600' : 'text-red-600')}>
                        {analyticsData != null ? (analyticsData.netSubscriberChange >= 0 ? '+' : '') + analyticsData.netSubscriberChange : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Revenue growth (30d vs prior 30d)</p>
                      <p className={cn('text-lg font-bold tabular-nums', analyticsData?.growth.revenueGrowthRatePercent != null ? (analyticsData.growth.revenueGrowthRatePercent >= 0 ? 'text-green-600' : 'text-red-600') : '')}>
                        {analyticsData?.growth.revenueGrowthRatePercent != null
                          ? `${analyticsData.growth.revenueGrowthRatePercent >= 0 ? '+' : ''}${analyticsData.growth.revenueGrowthRatePercent.toFixed(1)}%`
                          : '—'}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground border-t border-border pt-3">{analyticsData?.growth.benchmarkText ?? 'Load analytics to see your benchmark.'}</p>
                </AdminCard>

                <div className="grid gap-3.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 items-stretch" data-creator-tour="analytics-overview">
                  <AdminStatTile
                    label="Gross revenue"
                    value={analyticsData ? formatCurrency(analyticsData.grossRevenue) : '$0.00'}
                    icon={DollarSign}
                    accent="var(--brand-grad-soft)"
                    detail="Before platform splits"
                  />
                  <AdminStatTile
                    label="Net revenue"
                    value={analyticsData ? formatCurrency(analyticsData.netRevenue) : '$0.00'}
                    icon={TrendingUp}
                    accent="var(--brand-grad)"
                    detail={
                      effectiveAgencySplit != null
                        ? 'Your take-home (creator share – agency cut)'
                        : 'Your creator share'
                    }
                  />
                  <AdminStatTile
                    label="Subscriber LTV"
                    value={analyticsData ? formatCurrency(analyticsData.subscriberLifetimeValue) : '$0.00'}
                    icon={Users}
                    detail="Average LTV per subscriber"
                  />
                  <AdminStatTile
                    label="Total subscribers"
                    value={analyticsData?.totalSubscribers.toLocaleString() || '0'}
                    icon={Users}
                    detail="Active subscribers"
                  />
                  <AdminStatTile
                    label="Net subscribers"
                    value={
                      analyticsData
                        ? (analyticsData.netSubscriberChange >= 0 ? '+' : '') + analyticsData.netSubscriberChange.toLocaleString()
                        : '0'
                    }
                    icon={TrendingUp}
                    delta={analyticsData?.netSubscriberChange != null ? (analyticsData.netSubscriberChange >= 0 ? '↑' : '↓') : undefined}
                    deltaUp={analyticsData?.netSubscriberChange != null ? analyticsData.netSubscriberChange >= 0 : undefined}
                    detail="New subscribers in period"
                  />
                  <AdminStatTile
                    label="Total transactions"
                    value={analyticsData?.totalTransactions.toLocaleString() || '0'}
                    icon={CreditCard}
                    detail="All transaction types"
                  />
                </div>

                {analyticsData && (
                  <div className="grid gap-6 md:grid-cols-2">
                    <AdminCard>
                      <AdminSectionTitle
                        title="Revenue breakdown"
                        description="Revenue by transaction type"
                      />
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Heart className="h-4 w-4 text-[var(--brand-pink)]" />
                            <span className="text-sm">Tips</span>
                          </div>
                          <span className="font-semibold tabular-nums">{formatCurrency(analyticsData.revenueByType.tips)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Eye className="h-4 w-4 text-blue-500" />
                            <span className="text-sm">PPV</span>
                          </div>
                          <span className="font-semibold tabular-nums">{formatCurrency(analyticsData.revenueByType.ppv)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Crown className="h-4 w-4 text-[var(--brand-violet)]" />
                            <span className="text-sm">Subscriptions</span>
                          </div>
                          <span className="font-semibold tabular-nums">{formatCurrency(analyticsData.revenueByType.subscriptions)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ShoppingCart className="h-4 w-4 text-green-600" />
                            <span className="text-sm">Products</span>
                          </div>
                          <span className="font-semibold tabular-nums">{formatCurrency(analyticsData.revenueByType.products)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-orange-500" />
                            <span className="text-sm">Calls</span>
                          </div>
                          <span className="font-semibold tabular-nums">{formatCurrency(analyticsData.revenueByType.calls)}</span>
                        </div>
                      </div>
                    </AdminCard>

                    <AdminCard>
                      <AdminSectionTitle
                        title="Revenue distribution"
                        description="Visual breakdown of revenue sources"
                      />
                        <div className="relative flex items-center justify-center h-40">
                          <ChartContainer
                            config={{
                              tips: {
                                label: "Tips",
                                color: "#ec4899",
                              },
                              ppv: {
                                label: "PPV",
                                color: "#3b82f6",
                              },
                              subscriptions: {
                                label: "Subscriptions",
                                color: "#8b5cf6",
                              },
                              products: {
                                label: "Products",
                                color: "#10b981",
                              },
                              calls: {
                                label: "Calls",
                                color: "#f97316",
                              },
                            }}
                            className="w-48 h-48"
                          >
                            <RechartsPieChart>
                              <Pie
                                data={[
                                  { name: 'tips', value: analyticsData.revenueByType.tips },
                                  { name: 'ppv', value: analyticsData.revenueByType.ppv },
                                  { name: 'subscriptions', value: analyticsData.revenueByType.subscriptions },
                                  { name: 'products', value: analyticsData.revenueByType.products },
                                  { name: 'calls', value: analyticsData.revenueByType.calls }
                                ].filter(item => item.value > 0)}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                              >
                                {[
                                  { name: 'tips', value: analyticsData.revenueByType.tips },
                                  { name: 'ppv', value: analyticsData.revenueByType.ppv },
                                  { name: 'subscriptions', value: analyticsData.revenueByType.subscriptions },
                                  { name: 'products', value: analyticsData.revenueByType.products },
                                  { name: 'calls', value: analyticsData.revenueByType.calls }
                                ].filter(item => item.value > 0).map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={`var(--color-${entry.name})`} />
                                ))}
                              </Pie>
                              <ChartTooltip content={
                                <ChartTooltipContent 
                                  formatter={(value: any, name: any) => [formatCurrency(value), name]}
                                />
                              } />
                            </RechartsPieChart>
                          </ChartContainer>
                        </div>
                    </AdminCard>
                  </div>
                )}
                
                <div className="mt-6">
                  <MonthlyStatements creatorId={profile?.id} isCreatorView={true} />
                </div>
              </TabsContent>

              <TabsContent value="marketing" className="space-y-6 mt-0">
                <AdminCard>
                  <AdminSectionTitle
                    title="Share templates"
                    description="Copy and paste these into your social posts. Replace the link with your Blabber profile when needed."
                  />
                  {(() => {
                    const baseUrl = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_SITE_URL || 'https://blabber.ai');
                    const shareLink = profile?.username ? `${baseUrl}/u/${profile.username}` : `${baseUrl}/u/your-username`;
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {marketingTemplates.map((t, i) => {
                          const fullText = [t.hook, shareLink, t.cta].filter(Boolean).join('\n');
                          const handleCopy = () => {
                            navigator.clipboard.writeText(fullText).then(() => toast.success('Copied to clipboard'));
                          };
                          const handleShare = () => {
                            if (typeof navigator !== 'undefined' && navigator.share) {
                              navigator.share({ title: t.platform, text: fullText, url: shareLink }).then(() => toast.success('Shared')).catch(() => {});
                            } else {
                              handleCopy();
                            }
                          };
                          return (
                            <div key={i} className="space-y-3 rounded-2xl border border-border p-4" style={{ background: 'var(--brand-grad-soft)' }}>
                              <h3 className="text-sm font-semibold">{t.platform}</h3>
                              <div className="rounded-xl border border-border bg-background/60 p-3">
                                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{fullText}</p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <AdminGhostButton size="sm" className="h-9" onClick={handleCopy}>
                                  <Copy className="h-4 w-4" />
                                  Copy
                                </AdminGhostButton>
                                {typeof navigator !== 'undefined' && 'share' in navigator && typeof navigator.share === 'function' && (
                                  <AdminGradButton size="sm" className="h-9" onClick={handleShare}>
                                    <Share2 className="h-4 w-4" />
                                    Share
                                  </AdminGradButton>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </AdminCard>
              </TabsContent>

              <TabsContent value="subscribers" className="space-y-6 mt-0">
                <AdminCard>
                  <AdminSectionTitle
                    title="Your subscribers"
                    description="Fans subscribed to your content"
                    action={
                      <AdminGhostButton onClick={loadSubscribersData} disabled={isLoadingData} size="sm" className="h-9">
                        <RefreshCw className="h-4 w-4" />
                        Refresh
                      </AdminGhostButton>
                    }
                  />
                  <AdminTableShell>
                  <Table>
                    <TableHeader>
                      <AdminTableHeaderRow>
                        <AdminTh>Subscriber</AdminTh>
                        <AdminTh>
                          <AdminSortBtn onClick={() => handleSubscriberSort('subscribed_at')}>
                            Subscribed
                            {subscriberSortField === 'subscribed_at' && (
                              <span>{subscriberSortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </AdminSortBtn>
                        </AdminTh>
                        <AdminTh>
                          <AdminSortBtn onClick={() => handleSubscriberSort('total_spent')}>
                            Total spent
                            {subscriberSortField === 'total_spent' && (
                              <span>{subscriberSortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </AdminSortBtn>
                        </AdminTh>
                        <AdminTh>
                          <AdminSortBtn onClick={() => handleSubscriberSort('last_payment')}>
                            Last payment
                            {subscriberSortField === 'last_payment' && (
                              <span>{subscriberSortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </AdminSortBtn>
                        </AdminTh>
                        <AdminTh>Status</AdminTh>
                      </AdminTableHeaderRow>
                    </TableHeader>
                    <TableBody>
                      {subscribers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-10">
                            <UserCheck className="h-10 w-10 mx-auto text-[var(--brand-pink)] mb-3 opacity-70" />
                            <h3 className="text-sm font-semibold mb-1">No subscribers yet</h3>
                            <p className="text-sm text-muted-foreground">
                              Start creating content to attract subscribers!
                            </p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        sortSubscribers(subscribers).map((subscriber) => (
                          <TableRow key={subscriber.id} className="admin-row border-b border-border">
                            <TableCell className={adminTdClass}>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-8 w-8 ring-2 ring-border">
                                  <AvatarImage src={subscriber.avatar_url || ''} />
                                  <AvatarFallback>
                                    {subscriber.full_name?.charAt(0) || subscriber.username?.charAt(0) || 'S'}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-medium text-sm">{subscriber.full_name}</div>
                                  <div className="text-[12px] text-muted-foreground">@{subscriber.username}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className={adminTdClass}>
                              {new Date(subscriber.subscribed_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell className={cn(adminTdClass, 'tabular-nums font-semibold')}>
                              {formatCurrency(subscriber.total_spent)}
                            </TableCell>
                            <TableCell className={adminTdClass}>
                              {subscriber.last_payment ? new Date(subscriber.last_payment).toLocaleDateString() : 'Never'}
                            </TableCell>
                            <TableCell className={adminTdClass}>
                              <AdminStatusPill variant={subscriber.subscription_status === 'active' ? 'gold' : 'soft'}>
                                {subscriber.subscription_status}
                              </AdminStatusPill>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  </AdminTableShell>
                </AdminCard>
              </TabsContent>

              <TabsContent value="orders" className="space-y-6 mt-0">
                <AdminCard>
                  <AdminSectionTitle
                    title="Recent orders"
                    description="Product purchases from your store"
                    action={
                      <div className="flex flex-wrap items-center gap-2">
                        <AdminGradButton size="sm" className="h-9" onClick={() => router.push('/creator-orders')}>
                          <Package className="h-4 w-4" />
                          Order management
                        </AdminGradButton>
                        <AdminGhostButton onClick={loadOrdersData} disabled={isLoadingData} size="sm" className="h-9">
                          <RefreshCw className="h-4 w-4" />
                          Refresh
                        </AdminGhostButton>
                      </div>
                    }
                  />
                  <AdminTableShell>
                  <Table className="min-w-full table-auto">
                    <TableHeader>
                      <AdminTableHeaderRow>
                        <AdminTh>Order</AdminTh>
                        <AdminTh className="min-w-[120px]">Product</AdminTh>
                        <AdminTh className="min-w-[120px]">Buyer</AdminTh>
                        <AdminTh>Amount</AdminTh>
                        <AdminTh>Status</AdminTh>
                        <AdminTh>Date</AdminTh>
                      </AdminTableHeaderRow>
                    </TableHeader>
                    <TableBody>
                      {orders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-10">
                            <Package className="h-10 w-10 mx-auto text-[var(--brand-pink)] mb-3 opacity-70" />
                            <h3 className="text-sm font-semibold mb-1">No orders yet</h3>
                            <p className="text-sm text-muted-foreground">
                              Create products to start receiving orders!
                            </p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        orders.map((order) => (
                          <TableRow key={order.id} className="admin-row border-b border-border">
                            <TableCell className={cn(adminTdClass, 'font-medium')}>#{order.id.slice(0, 8)}</TableCell>
                            <TableCell className={adminTdClass}>
                              <div className="flex items-center gap-2">
                                {order.product?.main_photo && (
                                  <img 
                                    src={order.product.main_photo} 
                                    alt={order.product.product_name}
                                    className="w-8 h-8 rounded-lg object-cover ring-1 ring-border"
                                  />
                                )}
                                <span className="font-medium text-sm">{order.product?.product_name || 'Unknown Product'}</span>
                              </div>
                            </TableCell>
                            <TableCell className={adminTdClass}>
                              <div>
                                <div className="font-medium text-sm">{order.buyer?.full_name || 'Unknown'}</div>
                                <div className="text-[12px] text-muted-foreground">@{order.buyer?.username}</div>
                              </div>
                            </TableCell>
                            <TableCell className={cn(adminTdClass, 'tabular-nums font-semibold')}>
                              {order.transaction ? formatCurrency(order.transaction.amount_cents) : 'N/A'}
                            </TableCell>
                            <TableCell className={adminTdClass}>
                              <AdminStatusPill
                                variant={
                                  displayOrderStatus(order) === 'delivered'
                                    ? 'gold'
                                    : displayOrderStatus(order) === 'shipped'
                                      ? 'soft'
                                      : 'soft'
                                }
                              >
                                {displayOrderStatus(order)}
                              </AdminStatusPill>
                            </TableCell>
                            <TableCell className={adminTdClass}>
                              {new Date(order.created_at).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  </AdminTableShell>
                </AdminCard>
              </TabsContent>

              <TabsContent value="payouts" className="space-y-6 mt-0">
                <PayoutsComponent creatorProfileId={profile?.id || ''} />
              </TabsContent>

              <TabsContent value="settings" className="space-y-6 mt-0">
                {editedSettings && (
                  <Tabs defaultValue="general" className="space-y-6">
                    <TabsList className={adminTabListClass}>
                      <TabsTrigger value="general" className={adminTabTriggerClass}>
                        <Settings className="h-4 w-4" />
                        General
                      </TabsTrigger>
                      <TabsTrigger value="ai" className={adminTabTriggerClass} data-creator-tour="ai-tab-trigger">
                        <Sparkles className="h-4 w-4" />
                        AI
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="general" className="space-y-6 mt-0">
                      <AdminCard data-creator-tour="subscription-card">
                        <AdminSectionTitle
                          title="Subscription settings"
                          description="Configure your subscription tier"
                        />
                        <div className="space-y-6">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <Label htmlFor="subscription-enabled" className="text-sm font-semibold">Enable Subscription Tier</Label>
                              <p className="text-sm text-muted-foreground">Allow users to subscribe to your content</p>
                            </div>
                            <Switch
                              id="subscription-enabled"
                              checked={editedSettings.subscription_tier_enabled}
                              onCheckedChange={(checked) => handleSettingsChange('subscription_tier_enabled', checked)}
                            />
                          </div>
                          {editedSettings.subscription_tier_enabled && (
                            <>
                              <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                  <Label htmlFor="subscription-price" className="text-sm font-semibold">Price</Label>
                                  <Input
                                    id="subscription-price"
                                    type="number"
                                    min={5}
                                    step={0.01}
                                    value={
                                      editedSettings.subscription_price_cents != null
                                        ? (editedSettings.subscription_price_cents / 100).toFixed(2)
                                        : ''
                                    }
                                    onChange={e => {
                                      const numericValue = e.target.value.replace(/[^\d.]/g, '');
                                      const floatVal = parseFloat(numericValue);
                                      if (!isNaN(floatVal)) {
                                        handleSettingsChange('subscription_price_cents', Math.round(floatVal * 100));
                                      } else {
                                        handleSettingsChange('subscription_price_cents', null);
                                      }
                                    }}
                                    placeholder="$5.00 minimum"
                                    className={adminInputClass}
                                    inputMode="decimal"
                                  />
                                  <p className="text-xs text-muted-foreground">Minimum $5.00</p>
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="subscription-interval" className="text-sm font-semibold">Interval</Label>
                                  <Select
                                    value={editedSettings.subscription_interval || ''}
                                    onValueChange={(value: 'week' | 'month' | 'year') => handleSettingsChange('subscription_interval', value)}
                                  >
                                    <SelectTrigger className={adminSelectTriggerClass}>
                                      <SelectValue placeholder="Select interval" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="week">Weekly</SelectItem>
                                      <SelectItem value="month">Monthly</SelectItem>
                                      <SelectItem value="year">Yearly</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </AdminCard>

                      <AdminCard>
                        <AdminSectionTitle
                          title="Payment addresses"
                          description="Configure wallet addresses for receiving crypto payouts (all fields optional)"
                        />
                        <div className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <Label htmlFor="ethereum-address" className="text-sm font-semibold">Ethereum Address</Label>
                              <Input
                                id="ethereum-address"
                                type="text"
                                value={editedSettings.ethereum_address || ''}
                                onChange={(e) => handleSettingsChange('ethereum_address', e.target.value || null)}
                                placeholder="0x..."
                                className={cn(adminInputClass, 'font-mono text-sm')}
                              />
                              <p className="text-xs text-muted-foreground">USDC on Ethereum network</p>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="polygon-address" className="text-sm font-semibold">Polygon Address</Label>
                              <Input
                                id="polygon-address"
                                type="text"
                                value={editedSettings.polygon_address || ''}
                                onChange={(e) => handleSettingsChange('polygon_address', e.target.value || null)}
                                placeholder="0x..."
                                className={cn(adminInputClass, 'font-mono text-sm')}
                              />
                              <p className="text-xs text-muted-foreground">USDC on Polygon network</p>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="solana-address" className="text-sm font-semibold">Solana Address</Label>
                              <Input
                                id="solana-address"
                                type="text"
                                value={editedSettings.solana_address || ''}
                                onChange={(e) => handleSettingsChange('solana_address', e.target.value || null)}
                                placeholder="Base58 address..."
                                className={cn(adminInputClass, 'font-mono text-sm')}
                              />
                              <p className="text-xs text-muted-foreground">USDC on Solana network</p>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="bitcoin-address" className="text-sm font-semibold">Bitcoin Address</Label>
                              <Input
                                id="bitcoin-address"
                                type="text"
                                value={editedSettings.bitcoin_address || ''}
                                onChange={(e) => handleSettingsChange('bitcoin_address', e.target.value || null)}
                                placeholder="bc1... or 1... or 3..."
                                className={cn(adminInputClass, 'font-mono text-sm')}
                              />
                              <p className="text-xs text-muted-foreground">BTC on Bitcoin network</p>
                            </div>
                          </div>
                          <div className="pt-4 border-t border-border space-y-4">
                            <h4 className="text-sm font-semibold">Bank account (for USD payouts)</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-2">
                                <Label htmlFor="bank-account-number" className="text-sm font-semibold">Account Number</Label>
                                <Input
                                  id="bank-account-number"
                                  type="text"
                                  value={editedSettings.bank_account_number || ''}
                                  onChange={(e) => handleSettingsChange('bank_account_number', e.target.value || null)}
                                  placeholder="Enter account number"
                                  className={adminInputClass}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="bank-routing-number" className="text-sm font-semibold">Routing Number</Label>
                                <Input
                                  id="bank-routing-number"
                                  type="text"
                                  value={editedSettings.bank_routing_number || ''}
                                  onChange={(e) => handleSettingsChange('bank_routing_number', e.target.value || null)}
                                  placeholder="Enter routing number"
                                  className={adminInputClass}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </AdminCard>

                      <AdminGradButton className="w-full" onClick={handleSaveSettings} disabled={!isDirty}>
                        <Download className="h-4 w-4" />
                        Save changes
                      </AdminGradButton>
                    </TabsContent>

                    <TabsContent value="ai" className="space-y-6 mt-0">
                      <AdminCard>
                        <AdminSectionTitle
                          title="AI features"
                          description="Configure AI-powered features"
                        />
                        <div className="space-y-6">
                          {editedSettings.ai_call_enabled && editedSettings.eleven_voice_id && (
                            <div className="flex items-center justify-between">
                              <div className="space-y-1">
                                <Label className="text-sm font-semibold">Test your AI call</Label>
                                <p className="text-sm text-muted-foreground">Try a call with no credits used</p>
                              </div>
                              <AdminGhostButton type="button" onClick={() => setShowTestCallModal(true)} className="h-9">
                                <Phone className="h-4 w-4" />
                                Test call
                              </AdminGhostButton>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <Label htmlFor="ai-calls">Enable AI Calls</Label>
                              <p className="text-sm text-muted-foreground">Allow AI-powered voice calls with your personality</p>
                            </div>
                            <Switch
                              id="ai-calls"
                              checked={editedSettings.ai_call_enabled}
                              onCheckedChange={(checked) => handleSettingsChange('ai_call_enabled', checked)}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <Label htmlFor="ai-call-multi">AI Call Credit Cost</Label>
                              <p className="text-sm text-muted-foreground">
                                Credits charged per billing interval during a call (minimum 1).
                                <AiCallHourlyEarningsHint
                                  aiCallMulti={editedSettings.ai_call_multi}
                                  agencySplitPct={effectiveAgencySplit}
                                />
                              </p>
                            </div>
                            <Input
                              id="ai-call-multi"
                              type="number"
                              min={1}
                              step={1}
                              value={editedSettings.ai_call_multi ?? 1}
                              onChange={e => {
                                let val = parseInt(e.target.value, 10);
                                if (isNaN(val) || val < 1) val = 1;
                                handleSettingsChange('ai_call_multi', val);
                              }}
                              disabled={!editedSettings.ai_call_enabled}
                              className={cn(adminInputClass, 'w-24')}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <Label htmlFor="ai-dms">Enable AI DMs</Label>
                              <p className="text-sm text-muted-foreground">Allow AI-powered direct messages with your personality</p>
                            </div>
                            <Switch
                              id="ai-dms"
                              checked={editedSettings.ai_dms_enabled}
                              onCheckedChange={(checked) => handleSettingsChange('ai_dms_enabled', checked)}
                            />
                          </div>
                          {(editedSettings.ai_call_enabled || editedSettings.ai_dms_enabled) && (
                            <div className="space-y-4">
                              <div>
                                <Label className="text-base font-semibold">Personality & boundaries</Label>
                                <p className="text-sm text-muted-foreground mt-1">The options below build your personality prompt. Save at the bottom to apply.</p>
                              </div>
                              <PersonalityCalibrationUI
                                value={editedSettings.personality_prompt || ''}
                                onChange={(prompt) => handleSettingsChange('personality_prompt', prompt)}
                                disabled={false}
                              />
                            </div>
                          )}
                        </div>
                      </AdminCard>

                      <AdminCard>
                        <AdminSectionTitle
                          title="Voice sample"
                          description="Upload a voice sample for AI voice cloning"
                        />
                        <div className="space-y-6">
                          {editedSettings.voice_sample_path ? (
                            <div className="space-y-4">
                              <div className="flex items-center gap-2">
                                <audio
                                  controls
                                  src={audioUrl || undefined}
                                  className="w-full max-w-md"
                                  preload="metadata"
                                  crossOrigin="anonymous"
                                >
                                  Your browser does not support the audio element.
                                </audio>
                                <Button type="button" variant="destructive" onClick={handleDeleteVoiceSample} className="flex items-center gap-2 shrink-0">
                                  Delete Sample
                                </Button>
                              </div>
                              <p className="text-sm text-muted-foreground">Voice sample uploaded successfully. This will be used for AI voice cloning.</p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div className="flex flex-wrap items-center gap-2">
                                <AdminGhostButton
                                  type="button"
                                  onClick={isRecording ? stopRecording : startRecording}
                                  disabled={isUploading}
                                  className="h-9"
                                >
                                  {isRecording ? (
                                    <>
                                      <StopCircle className="h-4 w-4" />
                                      Stop Recording ({20 - recordingTime}s)
                                    </>
                                  ) : (
                                    <>
                                      <Mic className="h-4 w-4" />
                                      Record
                                    </>
                                  )}
                                </AdminGhostButton>
                                <div className="relative">
                                  <input
                                    type="file"
                                    accept="audio/mpeg,audio/mp3,audio/mp4,audio/wav,audio/x-m4a,audio/*"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                    id="audio-upload-dashboard"
                                    disabled={isUploading}
                                  />
                                  <AdminGhostButton
                                    type="button"
                                    onClick={() => document.getElementById('audio-upload-dashboard')?.click()}
                                    disabled={isUploading}
                                    className="h-9"
                                  >
                                    <Upload className="h-4 w-4" />
                                    Upload
                                  </AdminGhostButton>
                                </div>
                                {audioBlob && (
                                  <AdminGradButton type="button" onClick={uploadAudio} disabled={isUploading} className="h-9">
                                    {isUploading ? 'Uploading...' : 'Submit Voice Sample'}
                                  </AdminGradButton>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">Record or upload a voice sample (max 20 seconds) to enable AI voice cloning for calls and messages.</p>
                            </div>
                          )}
                        </div>
                      </AdminCard>

                      <AdminCard>
                        <AdminSectionTitle
                          title="Image generation"
                          description="Add a clear photo of yourself. It is used as the source for AI image generation when you create posts (ComfyUI workflow on your GPU server)."
                        />
                        <div className="space-y-6">
                          {editedSettings.image_gen_source_path ? (
                            <div className="space-y-4">
                              <div className="relative w-full max-w-xs aspect-square rounded-lg overflow-hidden border bg-muted">
                                {imageGenPublicUrl ? (
                                  <NextImage
                                    src={imageGenPublicUrl}
                                    alt="Reference for image generation"
                                    fill
                                    className="object-cover"
                                    sizes="256px"
                                  />
                                ) : null}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  variant="destructive"
                                  onClick={handleDeleteImageGenReference}
                                  disabled={isUploadingImageGen}
                                >
                                  Remove photo
                                </Button>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                This image is stored like your voice sample and sent securely to your configured Comfy endpoint when you generate post images.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div className="flex flex-wrap items-center gap-2">
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp,image/gif"
                                  capture="user"
                                  className="hidden"
                                  id="image-gen-camera-dashboard"
                                  disabled={isUploadingImageGen}
                                  onChange={handleImageGenReferenceFile}
                                />
                                <AdminGhostButton
                                  type="button"
                                  disabled={isUploadingImageGen}
                                  className="h-9"
                                  onClick={() => document.getElementById('image-gen-camera-dashboard')?.click()}
                                >
                                  <Camera className="h-4 w-4" />
                                  Take or choose photo
                                </AdminGhostButton>
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp,image/gif"
                                  className="hidden"
                                  id="image-gen-upload-dashboard"
                                  disabled={isUploadingImageGen}
                                  onChange={handleImageGenReferenceFile}
                                />
                                <AdminGhostButton
                                  type="button"
                                  disabled={isUploadingImageGen}
                                  className="h-9"
                                  onClick={() => document.getElementById('image-gen-upload-dashboard')?.click()}
                                >
                                  <Upload className="h-4 w-4" />
                                  Upload from files
                                </AdminGhostButton>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                JPG, PNG, WEBP, or GIF, up to 15MB. Use a well-lit face or upper-body shot for best results.
                              </p>
                              {isUploadingImageGen && (
                                <p className="text-sm text-muted-foreground">Uploading…</p>
                              )}
                            </div>
                          )}
                        </div>
                      </AdminCard>

                      <AdminGradButton className="w-full" onClick={handleSaveSettings} disabled={!isDirty}>
                        <Download className="h-4 w-4" />
                        Save changes
                      </AdminGradButton>
                    </TabsContent>
                  </Tabs>
                )}
              </TabsContent>
            </Tabs>
          </div>
      </PageShell>
      {editedSettings && profile && (
        <CallModal
          isOpen={showTestCallModal}
          onClose={() => setShowTestCallModal(false)}
          personalityPrompt={editedSettings.personality_prompt}
          elevenVoiceId={editedSettings.eleven_voice_id}
          creatorId={profile.id}
          testMode
        />
      )}
    </RequireAuth>
  );
} 