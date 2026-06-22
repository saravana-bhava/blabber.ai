'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  DollarSign, 
  Users, 
  TrendingUp, 
  Settings, 
  Shield, 
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
  Bug,
  Bell,
  Building2
} from 'lucide-react';
import { toast } from 'sonner';
import { PieChart as RechartsPieChart, Pie, Cell } from 'recharts';

import { PageShell } from '@/components/layout/page-header';
import { useUser } from '@/lib/contexts/user-context';
import { RequireAuth } from '@/components/auth/require-auth';
import { CreatorsTable } from '@/components/admin/creators-table';
import { AgenciesTable, type AgencyData } from '@/components/admin/agencies-table';
import { UsersTable } from '@/components/admin/users-table';
import { BugReportsTable } from '@/components/admin/bug-reports-table';
import { PushNotificationModal } from '@/components/admin/push-notification-modal';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import SettingControl from "@/components/admin/setting-control";
import { MonthlyStatements } from "@/components/admin/monthly-statements";
import { AdminPayouts } from "@/components/admin/admin-payouts";
import { MakePayoutsModal } from "@/components/admin/make-payouts-modal";
import {
  AdminStatTile,
  AdminCard,
  AdminSectionTitle,
  AdminPill,
  AdminGradButton,
  AdminGhostButton,
  AdminHealthRow,
  AdminToolbar,
  adminTabTriggerClass,
  adminTabListClass,
} from '@/components/admin/admin-ui';

/** Legacy key; fiat rail is configured by `fiat_payment_processor`. Row stays synced on save. */
const HIDDEN_PLATFORM_SETTING_KEYS = new Set(["active_payment_provider"]);

interface AnalyticsData {
  grossRevenue: number;
  netRevenue: number;
  totalUsers: number;
  totalCreators: number;
  totalTransactions: number;
  userLifetimeValue: number;
  netUserChange: number;
  revenueByType: {
    tips: number;
    ppv: number;
    subscriptions: number;
    products: number;
    credits: number;
    calls: number;
  };
}

interface CreatorData {
  id: string;
  profile_id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  can_monetize: boolean;
  can_img_gen: boolean;
  subscription_tier_enabled: boolean;
  subscription_price_cents: number;
  subscription_interval: string;
  created_at: string;
  is_demo: boolean;
  totalEarnings: number;
  totalTransactions: number;
  subscriptionCount: number;
  isActive: boolean;
  grossRevenue: number;
  creatorEarnings: number;
  platformEarnings: number;
}

interface UserData {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  email: string;
  isAdmin: boolean;
  isBanned: boolean;
  created_at: string;
  lastSeen: string;
  credits: number;
}

interface PlatformSetting {
  key: string;
  value: string;
  description: string;
}

interface BugReportData {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  steps_to_reproduce: string | null;
  expected_behavior: string | null;
  actual_behavior: string | null;
  browser: string | null;
  device: string | null;
  additional_info: string | null;
  status: string;
  admin_notes: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  user?: {
    username: string;
    full_name: string;
    avatar_url: string;
  };
  assigned_user?: {
    username: string;
    full_name: string;
    avatar_url: string;
  };
}

export default function AdminDashboardPage() {
  const supabase = createClient();
  const router = useRouter();
  const { session, profile, isLoading } = useUser();
  
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [creators, setCreators] = useState<CreatorData[]>([]);
  const [agencies, setAgencies] = useState<AgencyData[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [bugReports, setBugReports] = useState<BugReportData[]>([]);
  const [platformSettings, setPlatformSettings] = useState<PlatformSetting[]>([]);
  const [editedSettings, setEditedSettings] = useState<PlatformSetting[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [timeframe, setTimeframe] = useState('all');
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isMakePayoutsModalOpen, setIsMakePayoutsModalOpen] = useState(false);

  // Check admin access
  useEffect(() => {
    if (!isLoading && profile && !profile.isAdmin) {
      router.push('/home');
    }
  }, [profile, isLoading, router]);

  // Load analytics data
  const loadAnalyticsData = async () => {
    setIsLoadingData(true);
    try {
      let startDate: Date | null = null;
      if (timeframe !== 'all') {
        const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : timeframe === '90d' ? 90 : timeframe === '1y' ? 365 : 365;
        startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
      }

      // Get gross revenue (before splits) - exclude pending
      let tipQuery = supabase
        .from('tip_transactions')
        .select('amount_cents')
        .neq('status', 'pending');
      if (startDate) {
        tipQuery = tipQuery.gte('created_at', startDate.toISOString());
      }
      const { data: tipData } = await tipQuery;

      // Use only tipData since it already includes all tip transactions
      const allTipData = tipData || [];

      let ppvQuery = supabase
        .from('ppv_transactions')
        .select('amount_cents')
        .neq('status', 'pending');
      if (startDate) {
        ppvQuery = ppvQuery.gte('created_at', startDate.toISOString());
      }
      const { data: ppvData } = await ppvQuery;

      let subQuery = supabase
        .from('subscription_payments')
        .select('amount_cents')
        .neq('status', 'pending');
      if (startDate) {
        subQuery = subQuery.gte('created_at', startDate.toISOString());
      }
      const { data: subData } = await subQuery;

      let productQuery = supabase
        .from('creator_product_transactions')
        .select('amount_cents')
        .neq('status', 'pending');
      if (startDate) {
        productQuery = productQuery.gte('created_at', startDate.toISOString());
      }
      const { data: productData } = await productQuery;

      let creditQuery = supabase
        .from('credit_transactions')
        .select('amount_cents')
        .neq('status', 'pending');
      if (startDate) {
        creditQuery = creditQuery.gte('created_at', startDate.toISOString());
      }
      const { data: creditData } = await creditQuery;

      // Get call transactions for gross revenue (total credits_cents) - exclude pending
      let callQuery = supabase
        .from('call_transactions')
        .select('credits_cents')
        .gt('credits_cents', 0);
      if (startDate) {
        callQuery = callQuery.gte('created_at', startDate.toISOString());
      }
      const { data: callData } = await callQuery;

      // Get net revenue (after splits) - platform share - exclude pending
      let tipNetQuery = supabase
        .from('tip_transactions')
        .select('platform_share_cents')
        .neq('status', 'pending');
      if (startDate) {
        tipNetQuery = tipNetQuery.gte('created_at', startDate.toISOString());
      }
      const { data: tipNetData } = await tipNetQuery;

      // Use only tipNetData since it already includes all tip transactions' platform shares
      const allTipNetData = tipNetData || [];

      let ppvNetQuery = supabase
        .from('ppv_transactions')
        .select('platform_share_cents')
        .neq('status', 'pending');
      if (startDate) {
        ppvNetQuery = ppvNetQuery.gte('created_at', startDate.toISOString());
      }
      const { data: ppvNetData } = await ppvNetQuery;

      let subNetQuery = supabase
        .from('subscription_payments')
        .select('platform_share_cents')
        .neq('status', 'pending');
      if (startDate) {
        subNetQuery = subNetQuery.gte('created_at', startDate.toISOString());
      }
      const { data: subNetData } = await subNetQuery;

      let productNetQuery = supabase
        .from('creator_product_transactions')
        .select('platform_share_cents')
        .neq('status', 'pending');
      if (startDate) {
        productNetQuery = productNetQuery.gte('created_at', startDate.toISOString());
      }
      const { data: productNetData } = await productNetQuery;

      // Get call transactions for net revenue (platform_share_cents) - exclude pending
      let callNetQuery = supabase
        .from('call_transactions')
        .select('platform_share_cents')
        .gt('credits_cents', 0);
      if (startDate) {
        callNetQuery = callNetQuery.gte('created_at', startDate.toISOString());
      }
      const { data: callNetData } = await callNetQuery;

      // Calculate totals
      const grossRevenue = (allTipData?.reduce((sum, t) => sum + (t.amount_cents || 0), 0) || 0) +
                          (ppvData?.reduce((sum, p) => sum + (p.amount_cents || 0), 0) || 0) +
                          (subData?.reduce((sum, s) => sum + (s.amount_cents || 0), 0) || 0) +
                          (productData?.reduce((sum, p) => sum + (p.amount_cents || 0), 0) || 0) +
                          (creditData?.reduce((sum, c) => sum + (c.amount_cents || 0), 0) || 0) +
                          (callData?.reduce((sum, c) => sum + (c.credits_cents || 0), 0) || 0);

      const netRevenue = (allTipNetData?.reduce((sum, t) => sum + (t.platform_share_cents || 0), 0) || 0) +
                        (ppvNetData?.reduce((sum, p) => sum + (p.platform_share_cents || 0), 0) || 0) +
                        (subNetData?.reduce((sum, s) => sum + (s.platform_share_cents || 0), 0) || 0) +
                        (productNetData?.reduce((sum, p) => sum + (p.platform_share_cents || 0), 0) || 0) +
                        (creditData?.reduce((sum, c) => sum + (c.amount_cents || 0), 0) || 0) + // Credits are 100% platform revenue
                        (callNetData?.reduce((sum, c) => sum + (c.platform_share_cents || 0), 0) || 0);

      // Get user counts
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      const { count: totalCreators } = await supabase
        .from('creators')
        .select('*', { count: 'exact', head: true });

      // Calculate net user change in the time period
      let netUserChange = 0;
      if (startDate) {
        const { count: usersBeforePeriod } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .lt('updated_at', startDate.toISOString());
        netUserChange = (totalUsers || 0) - (usersBeforePeriod || 0);
      }

      // Calculate user lifetime value (average revenue per user)
      const userLifetimeValue = totalUsers && totalUsers > 0 ? netRevenue / totalUsers : 0;

      setAnalyticsData({
        grossRevenue,
        netRevenue,
        totalUsers: totalUsers || 0,
        totalCreators: totalCreators || 0,
        totalTransactions: (allTipData?.length || 0) + (ppvData?.length || 0) + (subData?.length || 0) + (productData?.length || 0) + (creditData?.length || 0) + (callData?.length || 0),
        userLifetimeValue,
        netUserChange,
        revenueByType: {
          tips: allTipData?.reduce((sum, t) => sum + (t.amount_cents || 0), 0) || 0,
          ppv: ppvData?.reduce((sum, p) => sum + (p.amount_cents || 0), 0) || 0,
          subscriptions: subData?.reduce((sum, s) => sum + (s.amount_cents || 0), 0) || 0,
          products: productData?.reduce((sum, p) => sum + (p.amount_cents || 0), 0) || 0,
          credits: creditData?.reduce((sum, c) => sum + (c.amount_cents || 0), 0) || 0,
          calls: callData?.reduce((sum, c) => sum + (c.credits_cents || 0), 0) || 0,
        }
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setIsLoadingData(false);
    }
  };

  // Load creators data
  const loadCreatorsData = async () => {
    try {
      
      // First, let's check if there are any creators at all
      const { data: allCreators, error: countError } = await supabase
        .from('creators')
        .select('profile_id');

      if (countError) {
        console.error('Error checking creators count:', countError);
        throw countError;
      }

      
      // Get all creators with their basic info
      const { data: creatorsData, error } = await supabase
        .from('creators')
        .select(`
          profile_id,
          can_monetize,
          can_img_gen,
          subscription_tier_enabled,
          subscription_price_cents,
          subscription_interval,
          created_at,
          is_demo
        `);

      if (error) {
        console.error('Error fetching creators:', error);
        throw error;
      }

      if (!creatorsData || creatorsData.length === 0) {
        setCreators([]);
        return;
      }

      // Get earnings for each creator
      const creatorsWithEarnings = await Promise.all(
        creatorsData.map(async (creator, index) => {
          
          // Get profile information for this creator
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('username, full_name, avatar_url')
            .eq('id', creator.profile_id)
            .single();

          if (profileError) {
            console.error(`Error fetching profile for creator ${creator.profile_id}:`, profileError);
          }

          
          // Get tip earnings - include both direct tips and post tips - exclude pending
          const { data: tipEarnings } = await supabase
            .from('tip_transactions')
            .select('creator_share_cents, platform_share_cents')
            .eq('creator_id', creator.profile_id)
            .neq('status', 'pending');

          // Also get tips without creator_id but linked to creator's posts - exclude pending
          const { data: postTips } = await supabase
            .from('tip_transactions')
            .select('creator_share_cents, platform_share_cents, post_id')
            .is('creator_id', null)
            .neq('status', 'pending');

          // Get creator's posts to match with post tips
          const { data: creatorPosts } = await supabase
            .from('posts')
            .select('id')
            .eq('user_id', creator.profile_id);

          const creatorPostIds = creatorPosts?.map(p => p.id) || [];
          
          // Filter post tips to only include those linked to creator's posts
          const creatorPostTips = postTips?.filter(tip => 
            creatorPostIds.includes(tip.post_id)
          ) || [];

          // Combine both types of tips
          const allTipEarnings = [...(tipEarnings || []), ...creatorPostTips];

          // Get subscription earnings - exclude pending
          const { data: subEarnings } = await supabase
            .from('subscription_payments')
            .select('creator_share_cents, platform_share_cents')
            .eq('creator_profile_id', creator.profile_id)
            .neq('status', 'pending');

          // Get PPV earnings - exclude pending
          let ppvEarnings: any[] = [];
          if (creatorPostIds.length > 0) {
            const { data: ppvEarningsData } = await supabase
              .from('ppv_transactions')
              .select('creator_share_cents, platform_share_cents')
              .in('post_id', creatorPostIds)
              .neq('status', 'pending');
            ppvEarnings = ppvEarningsData || [];
          }

          // Get product earnings
          const { data: creatorProducts } = await supabase
            .from('creator_products')
            .select('id')
            .eq('creator_profile_id', creator.profile_id);

          const productIds = creatorProducts?.map(p => p.id) || [];
          let productEarnings: any[] = [];
          if (productIds.length > 0) {
            const { data: productEarningsData } = await supabase
              .from('creator_product_transactions')
              .select('creator_share_cents, platform_share_cents')
              .in('creator_product_id', productIds)
              .neq('status', 'pending');
            productEarnings = productEarningsData || [];
          }

          // Get call earnings - exclude pending
          const { data: callEarnings } = await supabase
            .from('call_transactions')
            .select('creator_share_cents, platform_share_cents, credits_cents')
            .eq('creator_profile_id', creator.profile_id)
            .gt('credits_cents', 0);

          // Calculate total earnings (creator share)
          const totalEarnings = (allTipEarnings?.reduce((sum, t) => sum + (t.creator_share_cents || 0), 0) || 0) +
                               (ppvEarnings?.reduce((sum, p) => sum + (p.creator_share_cents || 0), 0) || 0) +
                               (subEarnings?.reduce((sum, s) => sum + (s.creator_share_cents || 0), 0) || 0) +
                               (productEarnings?.reduce((sum, p) => sum + (p.creator_share_cents || 0), 0) || 0) +
                               (callEarnings?.reduce((sum, c) => sum + (c.creator_share_cents || 0), 0) || 0);

          // Calculate gross revenue (total amount before splits)
          const tipGrossRevenue = allTipEarnings?.reduce((sum, t) => sum + (t.creator_share_cents || 0) + (t.platform_share_cents || 0), 0) || 0;
          const ppvGrossRevenue = ppvEarnings?.reduce((sum, p) => sum + (p.creator_share_cents || 0) + (p.platform_share_cents || 0), 0) || 0;
          const subGrossRevenue = subEarnings?.reduce((sum, s) => sum + (s.creator_share_cents || 0) + (s.platform_share_cents || 0), 0) || 0;
          const productGrossRevenue = productEarnings?.reduce((sum, p) => sum + (p.creator_share_cents || 0) + (p.platform_share_cents || 0), 0) || 0;
          const callGrossRevenue = callEarnings?.reduce((sum, c) => sum + (c.credits_cents || 0), 0) || 0;
          const grossRevenue = tipGrossRevenue + ppvGrossRevenue + subGrossRevenue + productGrossRevenue + callGrossRevenue;

          // Calculate creator earnings (their split)
          const creatorEarnings = totalEarnings;

          // Calculate platform earnings (platform share)
          const tipPlatformEarnings = allTipEarnings?.reduce((sum, t) => sum + (t.platform_share_cents || 0), 0) || 0;
          const ppvPlatformEarnings = ppvEarnings?.reduce((sum, p) => sum + (p.platform_share_cents || 0), 0) || 0;
          const subPlatformEarnings = subEarnings?.reduce((sum, s) => sum + (s.platform_share_cents || 0), 0) || 0;
          const productPlatformEarnings = productEarnings?.reduce((sum, p) => sum + (p.platform_share_cents || 0), 0) || 0;
          const callPlatformEarnings = callEarnings?.reduce((sum, c) => sum + (c.platform_share_cents || 0), 0) || 0;
          const platformEarnings = tipPlatformEarnings + ppvPlatformEarnings + subPlatformEarnings + productPlatformEarnings + callPlatformEarnings;

          const creatorData = {
            id: creator.profile_id,
            profile_id: creator.profile_id,
            username: profileData?.username || 'Unknown',
            full_name: profileData?.full_name || 'Unknown Creator',
            avatar_url: profileData?.avatar_url || '',
            can_monetize: creator.can_monetize,
            can_img_gen: creator.can_img_gen ?? false,
            subscription_tier_enabled: creator.subscription_tier_enabled,
            subscription_price_cents: creator.subscription_price_cents,
            subscription_interval: creator.subscription_interval,
            created_at: creator.created_at,
            is_demo: creator.is_demo || false,
            totalEarnings,
            totalTransactions: (allTipEarnings?.length || 0) + (ppvEarnings?.length || 0) + (subEarnings?.length || 0) + (productEarnings?.length || 0) + (callEarnings?.length || 0),
            subscriptionCount: subEarnings?.length || 0, // Use subscription payments count instead
            isActive: creator.can_monetize,
            grossRevenue,
            creatorEarnings,
            platformEarnings,
          };

          return creatorData;
        })
      );

      // Sort by earnings descending
      creatorsWithEarnings.sort((a, b) => b.totalEarnings - a.totalEarnings);
      setCreators(creatorsWithEarnings);
      
    } catch (error) {
      console.error('Error loading creators:', error);
      toast.error('Failed to load creators data');
    }
  };

  // Load agencies data
  const loadAgenciesData = async () => {
    try {
      const { data: agenciesData, error } = await supabase
        .from('agencies')
        .select('*');

      if (error) {
        console.error('Error fetching agencies:', error);
        throw error;
      }

      if (!agenciesData || agenciesData.length === 0) {
        setAgencies([]);
        return;
      }

      const ownerIds = agenciesData.map((a: any) => a.profile_id);

      const { data: ownerProfiles, error: ownerProfilesError } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', ownerIds);

      if (ownerProfilesError) {
        console.error('Error fetching agency owner profiles:', ownerProfilesError);
      }

      const profilesById = new Map((ownerProfiles ?? []).map((p: any) => [p.id, p]));

      const { data: managedCreators } = await supabase
        .from('creators')
        .select('profile_id, agency_profile_id')
        .in('agency_profile_id', ownerIds);

      const creatorCountByAgency = new Map<string, number>();
      for (const row of managedCreators ?? []) {
        const aid = (row as any).agency_profile_id as string | null;
        if (!aid) continue;
        creatorCountByAgency.set(aid, (creatorCountByAgency.get(aid) ?? 0) + 1);
      }

      const TX_TABLES = [
        'call_transactions',
        'subscription_payments',
        'tip_transactions',
        'ppv_transactions',
        'creator_product_transactions',
      ] as const;

      const totalsByAgency = new Map<string, { total: number; unpaid: number }>();
      for (const id of ownerIds) totalsByAgency.set(id, { total: 0, unpaid: 0 });

      for (const tableName of TX_TABLES) {
        const { data: txs } = await supabase
          .from(tableName)
          .select('agency_profile_id, agency_share_cents, agency_payout_id')
          .in('agency_profile_id', ownerIds)
          .eq('status', 'succeeded');
        if (!txs) continue;
        for (const tx of txs as any[]) {
          const aid = tx.agency_profile_id as string | null;
          if (!aid) continue;
          const cur = totalsByAgency.get(aid) ?? { total: 0, unpaid: 0 };
          const share = Number(tx.agency_share_cents) || 0;
          cur.total += share;
          if (!tx.agency_payout_id) cur.unpaid += share;
          totalsByAgency.set(aid, cur);
        }
      }

      const merged: AgencyData[] = agenciesData.map((a: any) => {
        const owner: any = profilesById.get(a.profile_id);
        const totals = totalsByAgency.get(a.profile_id) ?? { total: 0, unpaid: 0 };
        return {
          profile_id: a.profile_id,
          username: owner?.username ?? 'unknown',
          full_name: owner?.full_name ?? 'Unknown',
          avatar_url: owner?.avatar_url ?? '',
          email: '',
          name: a.name,
          default_split_pct: Number(a.default_split_pct) || 0,
          veriff_verification_status: a.veriff_verification_status || 'not_started',
          payment_provider: a.payment_provider ?? null,
          solana_address: a.solana_address ?? null,
          ethereum_address: a.ethereum_address ?? null,
          polygon_address: a.polygon_address ?? null,
          bitcoin_address: a.bitcoin_address ?? null,
          bank_account_number: a.bank_account_number ?? null,
          bank_routing_number: a.bank_routing_number ?? null,
          created_at: a.created_at,
          managedCreatorCount: creatorCountByAgency.get(a.profile_id) ?? 0,
          totalAgencyEarnings: totals.total,
          unpaidAgencyEarnings: totals.unpaid,
        };
      });

      merged.sort((a, b) => b.totalAgencyEarnings - a.totalAgencyEarnings);
      setAgencies(merged);
    } catch (error) {
      console.error('Error loading agencies:', error);
      toast.error('Failed to load agencies data');
    }
  };

  // Load users data
  const loadUsersData = async () => {
    try {
      const { data: usersData, error } = await supabase
        .from('profiles')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      setUsers(usersData.map(user => ({
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
        email: user.email || '',
        isAdmin: user.isAdmin || false,
        isBanned: user.isBanned || false,
        created_at: user.updated_at || new Date().toISOString(), // profiles table doesn't have created_at
        lastSeen: user.updated_at || new Date().toISOString(),
        credits: user.credits || 0,
      })));
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Failed to load users data');
    }
  };

  // Load platform settings
  const loadPlatformSettings = async () => {
    try {
      const { data: settingsData, error } = await supabase
        .from('platform_settings')
        .select('*');

      if (error) throw error;
      setPlatformSettings(settingsData);
      setEditedSettings(JSON.parse(JSON.stringify(settingsData))); // Deep copy
      setIsDirty(false);
    } catch (error) {
      console.error('Error loading platform settings:', error);
      toast.error('Failed to load platform settings');
    }
  };

  // Load bug reports data
  const loadBugReportsData = async () => {
    try {
      const { data: bugReportsData, error } = await supabase
        .from('bug_reports')
        .select(`
          *,
          user:profiles!bug_reports_user_id_fkey(username, full_name, avatar_url),
          assigned_user:profiles!bug_reports_assigned_to_fkey(username, full_name, avatar_url)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setBugReports(bugReportsData || []);
    } catch (error) {
      console.error('Error loading bug reports:', error);
      toast.error('Failed to load bug reports data');
    }
  };

  // Update bug report status
  const handleUpdateBugStatus = async (id: string, status: string, adminNotes?: string) => {
    try {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      };

      if (adminNotes !== undefined) {
        updateData.admin_notes = adminNotes;
      }

      if (status === 'resolved') {
        updateData.resolved_at = new Date().toISOString();
      } else if (status !== 'resolved' && status !== 'closed') {
        updateData.resolved_at = null;
      }

      const { error } = await supabase
        .from('bug_reports')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
      
      // Reload bug reports to get updated data
      await loadBugReportsData();
    } catch (error) {
      console.error('Error updating bug report:', error);
      throw error;
    }
  };

  // Assign bug report to admin
  const handleAssignBugReport = async (id: string, assignedTo: string | null) => {
    try {
      const { error } = await supabase
        .from('bug_reports')
        .update({ 
          assigned_to: assignedTo,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      
      await loadBugReportsData();
    } catch (error) {
      console.error('Error assigning bug report:', error);
      throw error;
    }
  };

  // Load all data on mount
  useEffect(() => {
    if (profile?.isAdmin) {
      loadAnalyticsData();
      loadCreatorsData();
      loadAgenciesData();
      loadUsersData();
      loadBugReportsData();
      loadPlatformSettings();
    }
  }, [profile?.isAdmin, timeframe]);

  // User management functions
  const toggleUserBan = async (userId: string, isBanned: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ isBanned: !isBanned })
        .eq('id', userId);

      if (error) throw error;
      
      toast.success(`User ${isBanned ? 'unbanned' : 'banned'} successfully`);
      loadUsersData();
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Failed to update user');
    }
  };

  const toggleUserAdmin = async (userId: string, isAdmin: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ isAdmin: !isAdmin })
        .eq('id', userId);

      if (error) throw error;
      
      toast.success(`User ${isAdmin ? 'demoted' : 'promoted to admin'} successfully`);
      loadUsersData();
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Failed to update user');
    }
  };

  // Credit management function
  const updateUserCredits = async (userId: string, credits: number) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ credits })
        .eq('id', userId);

      if (error) throw error;
      
      toast.success(`User credits updated to ${credits}`);
      loadUsersData();
    } catch (error) {
      console.error('Error updating user credits:', error);
      toast.error('Failed to update user credits');
    }
  };

  // Password reset function
  const resetUserPassword = async (userId: string, newPassword: string) => {
    try {
      const response = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          newPassword,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update password');
      }
      
      toast.success('User password updated successfully');
      loadUsersData();
    } catch (error) {
      console.error('Error updating user password:', error);
      toast.error(`Failed to update user password: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  /** Full creator with monetization and completed verification, without demo limitations (admin KYC bypass). */
  const grantFullVerifiedCreator = async (userId: string) => {
    const adminSessionId = `admin_kyc_bypass_${userId}`;
    try {
      const { data: existingCreator } = await supabase
        .from('creators')
        .select('profile_id, is_demo, veriff_session_id')
        .eq('profile_id', userId)
        .maybeSingle();

      if (existingCreator) {
        const { error } = await supabase
          .from('creators')
          .update({
            is_demo: false,
            can_monetize: true,
            veriff_verification_status: 'completed',
            veriff_session_id: existingCreator.veriff_session_id || adminSessionId,
            updated_at: new Date().toISOString(),
          })
          .eq('profile_id', userId);

        if (error) throw error;
        toast.success('User is now a verified creator (admin bypass). Demo mode off if it was on.');
      } else {
        const { error } = await supabase.from('creators').insert({
          profile_id: userId,
          is_demo: false,
          subscription_tier_enabled: true,
          subscription_price_cents: 500,
          subscription_interval: 'month',
          ai_dms_enabled: false,
          ai_call_enabled: false,
          personality_prompt: null,
          eleven_voice_id: null,
          cartesia_voice_id: null,
          payment_provider: 'veriff',
          can_monetize: true,
          veriff_verification_status: 'completed',
          veriff_session_id: adminSessionId,
        });

        if (error) {
          console.error('Database error granting full creator:', error);
          throw error;
        }
        toast.success('Full creator created (admin KYC bypass).');
      }

      loadUsersData();
      loadCreatorsData();
    } catch (error) {
      console.error('Error granting full creator:', error);
      const msg =
        error instanceof Error
          ? error.message
          : (error as any)?.message || (error as any)?.details || 'Unknown error';
      toast.error(`Failed to grant full creator: ${msg}`);
    }
  };

  const setAgencyVerificationStatus = async (
    profileId: string,
    status: 'not_started' | 'in_progress' | 'completed' | 'rejected'
  ) => {
    try {
      const updates: Record<string, any> = {
        veriff_verification_status: status,
        updated_at: new Date().toISOString(),
      };

      if (status === 'completed') {
        const { data: existing } = await supabase
          .from('agencies')
          .select('veriff_session_id')
          .eq('profile_id', profileId)
          .maybeSingle();
        if (!existing?.veriff_session_id) {
          updates.veriff_session_id = `admin_kyc_bypass_${profileId}`;
        }
      }

      const { error } = await supabase
        .from('agencies')
        .update(updates)
        .eq('profile_id', profileId);

      if (error) throw error;

      const label =
        status === 'completed'
          ? 'force approved'
          : status === 'rejected'
          ? 'suspended'
          : status === 'in_progress'
          ? 'set to in progress'
          : 'reset to not started';
      toast.success(`Agency ${label}.`);
      loadAgenciesData();
    } catch (error) {
      console.error('Error updating agency verification status:', error);
      const msg =
        error instanceof Error
          ? error.message
          : (error as any)?.message || (error as any)?.details || 'Unknown error';
      toast.error(`Failed to update agency: ${msg}`);
    }
  };

  const deleteAgency = async (profileId: string) => {
    try {
      const { error } = await supabase
        .from('agencies')
        .delete()
        .eq('profile_id', profileId);

      if (error) throw error;
      toast.success('Agency deleted.');
      loadAgenciesData();
      loadCreatorsData();
    } catch (error) {
      console.error('Error deleting agency:', error);
      const msg =
        error instanceof Error
          ? error.message
          : (error as any)?.message || (error as any)?.details || 'Unknown error';
      toast.error(`Failed to delete agency: ${msg}`);
    }
  };

  /** Full agency with completed verification, without KYC (admin bypass). */
  const grantFullVerifiedAgency = async (userId: string, agencyName: string) => {
    const trimmedName = agencyName?.trim();
    if (!trimmedName) {
      toast.error('Agency name is required');
      return;
    }
    const adminSessionId = `admin_kyc_bypass_${userId}`;
    try {
      const { data: existingAgency } = await supabase
        .from('agencies')
        .select('profile_id, veriff_session_id')
        .eq('profile_id', userId)
        .maybeSingle();

      if (existingAgency) {
        const { error } = await supabase
          .from('agencies')
          .update({
            name: trimmedName,
            veriff_verification_status: 'completed',
            veriff_session_id: existingAgency.veriff_session_id || adminSessionId,
            updated_at: new Date().toISOString(),
          })
          .eq('profile_id', userId);

        if (error) throw error;
        toast.success('User is now a verified agency (admin bypass).');
      } else {
        const { error } = await supabase.from('agencies').insert({
          profile_id: userId,
          name: trimmedName,
          veriff_verification_status: 'completed',
          veriff_session_id: adminSessionId,
        });

        if (error) {
          console.error('Database error granting full agency:', error);
          throw error;
        }
        toast.success('Full agency created (admin KYC bypass).');
      }

      loadUsersData();
      loadAgenciesData();
    } catch (error) {
      console.error('Error granting full agency:', error);
      const msg =
        error instanceof Error
          ? error.message
          : (error as any)?.message || (error as any)?.details || 'Unknown error';
      toast.error(`Failed to grant full agency: ${msg}`);
    }
  };

  // Create demo creator function
  const createDemoCreator = async (userId: string) => {
    try {
      // Check if user already has a creator record
      const { data: existingCreator } = await supabase
        .from('creators')
        .select('id, is_demo')
        .eq('profile_id', userId)
        .maybeSingle();

      if (existingCreator) {
        if (existingCreator.is_demo) {
          toast.info('User is already a demo creator');
          return;
        } else {
          // Update existing creator to be demo
          const { error } = await supabase
            .from('creators')
            .update({ is_demo: true })
            .eq('profile_id', userId);
            
          if (error) throw error;
          toast.success('User updated to demo creator');
        }
      } else {
        // Create new demo creator record
        const { error } = await supabase
          .from('creators')
          .insert({
            profile_id: userId,
            is_demo: true,
            subscription_tier_enabled: true,
            subscription_price_cents: 500,
            subscription_interval: 'month',
            ai_dms_enabled: false,
            ai_call_enabled: false,
            personality_prompt: null,
            eleven_voice_id: null,
            cartesia_voice_id: null,
            payment_provider: 'veriff',
            can_monetize: true,
            veriff_verification_status: 'completed',
            veriff_session_id: `demo_session_${userId}`
          });
          
        if (error) {
          console.error('Database error creating demo creator:', error);
          throw error;
        }
        toast.success('Demo creator created successfully!');
      }
      
      loadUsersData();
      loadCreatorsData();
    } catch (error) {
      console.error('Error creating demo creator:', error);
      
      // Better error message handling for database errors
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === 'object') {
        // Handle Supabase error objects
        errorMessage = (error as any).message || (error as any).details || JSON.stringify(error);
      }
      
      toast.error(`Failed to create demo creator: ${errorMessage}`);
    }
  };

  const toggleCreatorImageGen = async (creatorId: string, canImgGen: boolean) => {
    try {
      const { error } = await supabase
        .from('creators')
        .update({ can_img_gen: canImgGen })
        .eq('profile_id', creatorId);

      if (error) throw error;

      toast.success(canImgGen ? 'Image generation enabled for creator' : 'Image generation disabled for creator');
      loadCreatorsData();
    } catch (error) {
      console.error('Error updating creator image gen access:', error);
      toast.error('Failed to update image generation access');
    }
  };

  // Demo toggle function
  const toggleCreatorDemo = async (creatorId: string, isDemo: boolean) => {
    try {
      if (isDemo) {
        // Disabling demo mode: delete the creator record entirely
        const { error } = await supabase
          .from('creators')
          .delete()
          .eq('profile_id', creatorId);

        if (error) throw error;
        
        toast.success('Demo creator record removed successfully');
      } else {
        // Enabling demo mode: update is_demo to true
        const { error } = await supabase
          .from('creators')
          .update({ is_demo: true })
          .eq('profile_id', creatorId);

        if (error) throw error;
        
        toast.success('Creator enabled demo mode');
      }
      
      loadCreatorsData();
    } catch (error) {
      console.error('Error updating creator demo status:', error);
      toast.error(`Failed to ${isDemo ? 'remove creator record' : 'enable demo mode'}`);
    }
  };

  // Platform settings functions
  const handleSettingsChange = (key: string, value: string) => {
    setEditedSettings((prev) => {
      let next = prev.map((setting) =>
        setting.key === key ? { ...setting, value } : setting
      );
      if (key === 'fiat_payment_processor') {
        next = next.map((setting) =>
          setting.key === 'active_payment_provider'
            ? { ...setting, value }
            : setting
        );
      }
      return next;
    });
    setIsDirty(true);
  };

  const handleSaveChanges = async () => {
    const changedSettings = editedSettings.filter(
      (edited, index) => edited.value !== platformSettings[index].value
    );

    if (changedSettings.length === 0) {
      toast.info("No changes to save.");
      return;
    }

    const savePromises = changedSettings.map(setting =>
      supabase
        .from('platform_settings')
        .update({ value: setting.value, updated_at: new Date().toISOString() })
        .eq('key', setting.key)
    );

    try {
      await Promise.all(savePromises);
      toast.success('Settings saved successfully!');
      loadPlatformSettings(); // Reload to sync state
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  // Show loading or redirect if not admin
  if (!profile?.isAdmin) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>Access denied. Redirecting...</p>
      </div>
    );
  }

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  return (
    <RequireAuth>
      <PageShell
        title="Admin console"
        subtitle="Platform operations & trust"
        rightActions={
          <>
            <AdminPill variant="staff" className="hidden sm:inline-flex">
              <Shield className="h-3.5 w-3.5" />
              Staff
            </AdminPill>
            <PushNotificationModal
              trigger={
                <AdminGradButton size="sm" className="h-[38px] px-4 text-[13px]">
                  <Bell className="h-4 w-4" />
                  <span className="hidden sm:inline">Notify</span>
                </AdminGradButton>
              }
            />
          </>
        }
      >
          <div className="max-w-[980px] mx-auto px-5 md:px-6 py-5 pb-16 space-y-6">
            <Tabs defaultValue="analytics" className="space-y-6">
              <TabsList className={adminTabListClass}>
                <TabsTrigger value="analytics" className={adminTabTriggerClass}>
                  <BarChart3 className="h-4 w-4" />
                  Analytics
                </TabsTrigger>
                <TabsTrigger value="payouts" className={adminTabTriggerClass}>
                  <DollarSign className="h-4 w-4" />
                  Payouts
                </TabsTrigger>
                <TabsTrigger value="creators" className={adminTabTriggerClass}>
                  <Crown className="h-4 w-4" />
                  Creators
                </TabsTrigger>
                <TabsTrigger value="users" className={adminTabTriggerClass}>
                  <Users className="h-4 w-4" />
                  Users
                </TabsTrigger>
                <TabsTrigger value="bugs" className={adminTabTriggerClass}>
                  <Bug className="h-4 w-4" />
                  Bugs
                </TabsTrigger>
                <TabsTrigger value="settings" className={adminTabTriggerClass}>
                  <Settings className="h-4 w-4" />
                  Settings
                </TabsTrigger>
              </TabsList>

              <TabsContent value="analytics" className="space-y-6 mt-0">
                {/* Timeframe + refresh */}
                <AdminCard className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  <Label htmlFor="timeframe" className="text-sm font-semibold shrink-0">Time period</Label>
                  <Select value={timeframe} onValueChange={setTimeframe}>
                    <SelectTrigger id="timeframe" className="w-full sm:w-36 rounded-full h-10 bg-secondary border-border">
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
                  <div className="flex-1" />
                  <AdminGhostButton onClick={loadAnalyticsData} disabled={isLoadingData}>
                    <Activity className={`h-4 w-4 ${isLoadingData ? 'animate-pulse' : ''}`} />
                    Refresh
                  </AdminGhostButton>
                </AdminCard>

                {/* Stat tiles */}
                <div className="grid gap-3.5 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  <AdminStatTile
                    label="Gross revenue"
                    value={analyticsData ? formatCurrency(analyticsData.grossRevenue) : '$0.00'}
                    icon={DollarSign}
                    accent="var(--brand-grad)"
                  />
                  <AdminStatTile
                    label="Net revenue"
                    value={analyticsData ? formatCurrency(analyticsData.netRevenue) : '$0.00'}
                    icon={TrendingUp}
                    accent="linear-gradient(135deg, oklch(0.8 0.13 86 / 0.25), oklch(0.72 0.15 60 / 0.25))"
                  />
                  <AdminStatTile
                    label="User LTV"
                    value={analyticsData ? formatCurrency(analyticsData.userLifetimeValue) : '$0.00'}
                    icon={CreditCard}
                  />
                  <AdminStatTile
                    label="Total users"
                    value={analyticsData?.totalUsers.toLocaleString() || '0'}
                    icon={Users}
                  />
                  <AdminStatTile
                    label="Net user change"
                    value={analyticsData ? `${analyticsData.netUserChange >= 0 ? '+' : ''}${analyticsData.netUserChange.toLocaleString()}` : '0'}
                    icon={Activity}
                  />
                  <AdminStatTile
                    label="Total creators"
                    value={analyticsData?.totalCreators.toLocaleString() || '0'}
                    icon={Crown}
                    accent="var(--brand-grad-ai)"
                  />
                  <AdminStatTile
                    label="Total transactions"
                    value={analyticsData?.totalTransactions.toLocaleString() || '0'}
                    icon={ShoppingCart}
                  />
                  <AdminStatTile
                    label="Open bug reports"
                    value={bugReports.filter(b => b.status === 'open' || b.status === 'in_progress').length.toString()}
                    icon={Bug}
                    accent="var(--brand-grad-soft)"
                  />
                </div>

                {/* Platform health — manually maintained indicators. Update during incidents. */}
                <AdminCard>
                  <AdminSectionTitle
                    title="Platform health"
                    description="Manually maintained. Set to Degraded during incidents."
                  />
                  <AdminHealthRow label="Payments" status="Operational" ok />
                  <AdminHealthRow label="AI calls" status="Operational" ok />
                  <AdminHealthRow label="Media CDN" status="Operational" ok />
                  <AdminHealthRow label="Payouts" status="Operational" ok />
                </AdminCard>

                {/* Revenue Breakdown */}
                {analyticsData && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <AdminCard>
                      <AdminSectionTitle
                        title="Revenue breakdown"
                        description="Revenue by transaction type"
                      />
                      <div className="space-y-3">
                        {[
                          { icon: Heart, label: 'Tips', value: analyticsData.revenueByType.tips, color: 'text-[var(--brand-pink)]' },
                          { icon: Eye, label: 'PPV', value: analyticsData.revenueByType.ppv, color: 'text-[var(--brand-violet)]' },
                          { icon: Crown, label: 'Subscriptions', value: analyticsData.revenueByType.subscriptions, color: 'text-[var(--brand-pink)]' },
                          { icon: ShoppingCart, label: 'Products', value: analyticsData.revenueByType.products, color: 'text-[var(--brand-gold)]' },
                          { icon: CreditCard, label: 'Credits', value: analyticsData.revenueByType.credits, color: 'text-muted-foreground' },
                          { icon: MessageSquare, label: 'Calls', value: analyticsData.revenueByType.calls, color: 'text-[var(--brand-violet)]' },
                        ].map(({ icon: Icon, label, value, color }) => (
                          <div key={label} className="flex items-center justify-between py-1 border-t border-border first:border-t-0 first:pt-0">
                            <div className="flex items-center gap-2.5">
                              <Icon className={`h-4 w-4 ${color}`} />
                              <span className="text-sm font-medium">{label}</span>
                            </div>
                            <span className="font-bold text-sm tabular-nums">{formatCurrency(value)}</span>
                          </div>
                        ))}
                      </div>
                    </AdminCard>

                    <AdminCard>
                      <AdminSectionTitle
                        title="Revenue distribution"
                        description="Visual breakdown of revenue sources"
                      />
                      <div className="relative flex items-center justify-center h-48">
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
                              credits: {
                                label: "Credits",
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
                                  { name: 'credits', value: analyticsData.revenueByType.credits }
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
                                  { name: 'credits', value: analyticsData.revenueByType.credits }
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
                  <MonthlyStatements />
                </div>
              </TabsContent>

              <TabsContent value="payouts" className="space-y-6 mt-0">
                <AdminPayouts onMakePayouts={() => setIsMakePayoutsModalOpen(true)} />
              </TabsContent>

              <TabsContent value="creators" className="space-y-6 mt-0">
                <CreatorsTable 
                  creators={creators} 
                  onRefresh={loadCreatorsData}
                  onToggleDemo={toggleCreatorDemo}
                  onToggleImageGen={toggleCreatorImageGen}
                  isLoading={isLoadingData}
                />
              </TabsContent>

              <TabsContent value="users" className="space-y-6 mt-0">
                <UsersTable 
                  users={users}
                  onRefresh={loadUsersData}
                  onToggleBan={toggleUserBan}
                  onToggleAdmin={toggleUserAdmin}
                  onUpdateCredits={updateUserCredits}
                  onResetPassword={resetUserPassword}
                  onCreateDemoCreator={createDemoCreator}
                  onGrantFullVerifiedCreator={grantFullVerifiedCreator}
                  onGrantFullVerifiedAgency={grantFullVerifiedAgency}
                  isLoading={isLoadingData}
                />
              </TabsContent>

              <TabsContent value="bugs" className="space-y-6 mt-0">
                <BugReportsTable 
                  bugReports={bugReports}
                  onRefresh={loadBugReportsData}
                  onUpdateStatus={handleUpdateBugStatus}
                  onAssignTo={handleAssignBugReport}
                  isLoading={isLoadingData}
                />
              </TabsContent>

              <TabsContent value="settings" className="space-y-6 mt-0">
                <AdminToolbar>
                  <AdminSectionTitle
                    title="Platform settings"
                    description="Configure splits, payments, and platform behavior"
                  />
                  <div className="flex items-center gap-2">
                    <AdminGhostButton onClick={loadPlatformSettings}>
                      <RefreshCw className="h-4 w-4" />
                      Refresh
                    </AdminGhostButton>
                    <AdminGradButton onClick={handleSaveChanges} disabled={!isDirty}>
                      <Download className="h-4 w-4" />
                      Save changes
                    </AdminGradButton>
                  </div>
                </AdminToolbar>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {editedSettings
                      .filter(s => [
                        "price_per_credit",
                        "credit_only_ecosystem",
                        "fiat_payment_processor",
                        "platform_split",
                        "platform_split_content",
                        "platform_split_ai",
                        "platform_split_store",
                        "call_credit_interval",
                        "suggestion_timeframe"
                      ].includes(s.key) && !HIDDEN_PLATFORM_SETTING_KEYS.has(s.key))
                      .map((setting) => (
                        <AdminCard key={setting.key}>
                          <h4 className="font-bold text-sm capitalize mb-1">{setting.key.replace(/_/g, ' ')}</h4>
                          <p className="text-muted-foreground text-[12.5px] mb-4">{setting.description}</p>
                          <SettingControl setting={setting} onChange={handleSettingsChange} />
                        </AdminCard>
                      ))}
                  </div>

                  {editedSettings
                    .filter(s => ![
                      "price_per_credit",
                      "credit_only_ecosystem",
                      "fiat_payment_processor",
                      "platform_split",
                      "platform_split_content",
                      "platform_split_ai",
                      "platform_split_store",
                      "call_credit_interval",
                      "suggestion_timeframe"
                    ].includes(s.key) && !HIDDEN_PLATFORM_SETTING_KEYS.has(s.key))
                    .map((setting) => (
                      <AdminCard key={setting.key}>
                        <h4 className="font-bold text-sm capitalize mb-1">{setting.key.replace(/_/g, ' ')}</h4>
                        <p className="text-muted-foreground text-[12.5px] mb-4">{setting.description}</p>
                        <SettingControl setting={setting} onChange={handleSettingsChange} />
                      </AdminCard>
                    ))}
                  <AdminGradButton className="w-full h-12" onClick={handleSaveChanges} disabled={!isDirty}>
                    <Download className="h-4 w-4" />
                    Save changes
                  </AdminGradButton>
                </div>
              </TabsContent>
            </Tabs>
          </div>
      </PageShell>

      <MakePayoutsModal
        isOpen={isMakePayoutsModalOpen}
        onClose={() => setIsMakePayoutsModalOpen(false)}
        onSubmit={async (payoutRequests) => {
          try {
            const response = await fetch('/api/admin/create-payouts', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ payouts: payoutRequests }),
            });

            const data = await response.json();

            if (!response.ok) {
              throw new Error(data.error || 'Failed to create payouts');
            }

            setIsMakePayoutsModalOpen(false);
            const uniqueCreators = new Set(payoutRequests.map(r => r.creator_profile_id)).size;
            toast.success(`Successfully created ${payoutRequests.length} payout${payoutRequests.length !== 1 ? 's' : ''} for ${uniqueCreators} creator${uniqueCreators !== 1 ? 's' : ''}`);
            // Refresh payouts data if needed
            window.location.reload(); // Or trigger a refresh of the payouts table
          } catch (error: any) {
            console.error('Error creating payouts:', error);
            toast.error(error.message || 'Failed to create payouts');
          }
        }}
      />
    </RequireAuth>
  );
} 