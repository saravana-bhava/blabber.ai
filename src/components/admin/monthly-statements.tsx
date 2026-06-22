import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Download, FileText } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AdminCard,
  AdminSectionTitle,
  AdminGhostButton,
  AdminTableHeaderRow,
  AdminTh,
  AdminTableShell,
  adminTdClass,
  adminSelectTriggerClass,
} from '@/components/admin/admin-ui';
import { cn } from '@/lib/utils';

interface MonthlyStatement {
    gross_revenue: number;
    net_revenue: number;
    creator_payouts: number;
    platform_fees: number;
    total_transactions: number;
}

interface MonthlyStatementsProps {
    creatorId?: string;
    isCreatorView?: boolean;
}

const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
};

export function MonthlyStatements({ creatorId, isCreatorView = false }: MonthlyStatementsProps) {
    const supabase = createClient();
    const [selectedDate, setSelectedDate] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });
    const [statement, setStatement] = useState<MonthlyStatement | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const statementRef = useRef(null);

    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
    const months = [
        { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
        { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
        { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
        { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' },
    ];

    const fetchStatement = async () => {
        setIsLoading(true);
        const { year, month } = selectedDate;
        const startDate = new Date(year, month - 1, 1).toISOString();
        const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

        if (isCreatorView && creatorId) {
            // Creator-specific financial data
            try {
                // Get all transaction types for the creator (include IDs for CSV export)
                // First get tip transactions with creator_id - exclude pending
                const { data: tipTransactionsWithCreatorId } = await supabase
                    .from('tip_transactions')
                    .select('id, amount_cents, creator_share_cents, created_at')
                    .eq('creator_id', creatorId)
                    .neq('status', 'pending')
                    .gte('created_at', startDate)
                    .lte('created_at', endDate);

                // Get creator's posts for fallback tip transactions
                const { data: creatorPosts } = await supabase
                    .from('posts')
                    .select('id')
                    .eq('user_id', creatorId);

                const postIds = creatorPosts?.map(p => p.id) || [];

                // Then get tip transactions without creator_id but where the post belongs to this creator - exclude pending
                const { data: tipTransactionsFromPosts } = await supabase
                    .from('tip_transactions')
                    .select('id, amount_cents, creator_share_cents, created_at')
                    .is('creator_id', null)
                    .in('post_id', postIds)
                    .neq('status', 'pending')
                    .gte('created_at', startDate)
                    .lte('created_at', endDate);

                // Combine both tip transaction sources
                const tipTransactions = [...(tipTransactionsWithCreatorId || []), ...(tipTransactionsFromPosts || [])];

                let ppvTransactions: any[] = [];
                if (postIds.length > 0) {
                    const { data: ppvData } = await supabase
                        .from('ppv_transactions')
                        .select('id, amount_cents, creator_share_cents, created_at')
                        .in('post_id', postIds)
                        .neq('status', 'pending')
                        .gte('created_at', startDate)
                        .lte('created_at', endDate);
                    ppvTransactions = ppvData || [];
                }

                // Get subscription payments - exclude pending
                const { data: subData } = await supabase
                    .from('subscription_payments')
                    .select('amount_cents, creator_share_cents')
                    .eq('creator_profile_id', creatorId)
                    .neq('status', 'pending')
                    .gte('created_at', startDate)
                    .lte('created_at', endDate);

                // Get product transactions
                const { data: creatorProducts } = await supabase
                    .from('creator_products')
                    .select('id')
                    .eq('creator_profile_id', creatorId);

                const productIds = creatorProducts?.map(p => p.id) || [];
                let productData: any[] = [];
                if (productIds.length > 0) {
                    const { data: productTransactions } = await supabase
                        .from('creator_product_transactions')
                        .select('amount_cents, creator_share_cents')
                        .in('creator_product_id', productIds)
                        .neq('status', 'pending')
                        .gte('created_at', startDate)
                        .lte('created_at', endDate);
                    productData = productTransactions || [];
                }

                // Get call transactions - exclude pending
                const { data: callData } = await supabase
                    .from('call_transactions')
                    .select('credits_cents, creator_share_cents')
                    .eq('creator_profile_id', creatorId)
                    .gt('credits_cents', 0)
                    .gte('created_at', startDate)
                    .lte('created_at', endDate);

                // Calculate totals
                const grossRevenue = (tipTransactions?.reduce((sum, t) => sum + (t.amount_cents || 0), 0) || 0) +
                                   (ppvTransactions?.reduce((sum, p) => sum + (p.amount_cents || 0), 0) || 0) +
                                   (subData?.reduce((sum, s) => sum + (s.amount_cents || 0), 0) || 0) +
                                   (productData?.reduce((sum, p) => sum + (p.amount_cents || 0), 0) || 0) +
                                   (callData?.reduce((sum, c) => sum + (c.credits_cents || 0), 0) || 0);

                const netRevenue = (tipTransactions?.reduce((sum, t) => sum + (t.creator_share_cents || 0), 0) || 0) +
                                 (ppvTransactions?.reduce((sum, p) => sum + (p.creator_share_cents || 0), 0) || 0) +
                                 (subData?.reduce((sum, s) => sum + (s.creator_share_cents || 0), 0) || 0) +
                                 (productData?.reduce((sum, p) => sum + (p.creator_share_cents || 0), 0) || 0) +
                                 (callData?.reduce((sum, c) => sum + (c.creator_share_cents || 0), 0) || 0);

                const platformFees = grossRevenue - netRevenue;
                const totalTransactions = (tipTransactions?.length || 0) + (ppvTransactions?.length || 0) + (subData?.length || 0) + (productData?.length || 0) + (callData?.length || 0);

                setStatement({
                    gross_revenue: grossRevenue,
                    net_revenue: netRevenue,
                    creator_payouts: netRevenue, // For creator view, net revenue is their payout
                    platform_fees: platformFees,
                    total_transactions: totalTransactions
                });
            } catch (error) {
                console.error('Error fetching creator statement:', error);
                setStatement(null);
            }
        } else {
            // Platform-wide financial data (admin view)
            const { data, error } = await supabase.rpc('get_monthly_financials', {
                p_month: month,
                p_year: year,
            });

            if (error) {
                console.error('Error fetching monthly statement:', error);
                setStatement(null);
            } else {
                setStatement(data[0]);
            }
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchStatement();
    }, [selectedDate, creatorId, isCreatorView]);

    const handleGenerate = () => {
        fetchStatement();
    };
    
    const handleExportPdf = async () => {
        if (!statement) {
            toast.error("No statement data to export.");
            return;
        }

        toast.info("Generating PDF... this may take a moment.");
        setIsLoading(true);

        const { year, month } = selectedDate;
        let transactions: any[] = [];

        if (isCreatorView && creatorId) {
            // Get creator-specific transactions (same logic as PDF export) - exclude pending
            const startDate = new Date(year, month - 1, 1).toISOString();
            const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

            // Get all transaction types for the creator (include IDs for CSV export)
            // First get tip transactions with creator_id - exclude pending
            const { data: tipTransactionsWithCreatorId } = await supabase
                .from('tip_transactions')
                .select('id, amount_cents, creator_share_cents, created_at')
                .eq('creator_id', creatorId)
                .neq('status', 'pending')
                .gte('created_at', startDate)
                .lte('created_at', endDate);

            // Get creator's posts for fallback tip transactions
            const { data: creatorPosts } = await supabase
                .from('posts')
                .select('id')
                .eq('user_id', creatorId);

            const postIds = creatorPosts?.map(p => p.id) || [];

            // Then get tip transactions without creator_id but where the post belongs to this creator - exclude pending
            const { data: tipTransactionsFromPosts } = await supabase
                .from('tip_transactions')
                .select('id, amount_cents, creator_share_cents, created_at')
                .is('creator_id', null)
                .in('post_id', postIds)
                .neq('status', 'pending')
                .gte('created_at', startDate)
                .lte('created_at', endDate);

            // Combine both tip transaction sources
            const tipTransactions = [...(tipTransactionsWithCreatorId || []), ...(tipTransactionsFromPosts || [])];

            let ppvTransactions: any[] = [];
            if (postIds.length > 0) {
                const { data: ppvData } = await supabase
                    .from('ppv_transactions')
                    .select('id, amount_cents, creator_share_cents, created_at')
                    .in('post_id', postIds)
                    .neq('status', 'pending')
                    .gte('created_at', startDate)
                    .lte('created_at', endDate);
                ppvTransactions = ppvData || [];
            }

            const { data: subTransactions } = await supabase
                .from('subscription_payments')
                .select('id, amount_cents, creator_share_cents, created_at')
                .eq('creator_profile_id', creatorId)
                .neq('status', 'pending')
                .gte('created_at', startDate)
                .lte('created_at', endDate);

            const { data: creatorProducts } = await supabase
                .from('creator_products')
                .select('id')
                .eq('creator_profile_id', creatorId);

            const productIds = creatorProducts?.map(p => p.id) || [];
            let productTransactions: any[] = [];
            if (productIds.length > 0) {
                const { data: productData } = await supabase
                    .from('creator_product_transactions')
                    .select('id, amount_cents, creator_share_cents, created_at')
                    .in('creator_product_id', productIds)
                    .neq('status', 'pending')
                    .gte('created_at', startDate)
                    .lte('created_at', endDate);
                productTransactions = productData || [];
            }

            const { data: callTransactions } = await supabase
                .from('call_transactions')
                .select('id, credits_cents, created_at')
                .eq('creator_profile_id', creatorId)
                .gt('credits_cents', 0)
                .gte('created_at', startDate)
                .lte('created_at', endDate);

            // Combine all transactions
            transactions = [
                ...(tipTransactions || []).map(t => ({
                    transaction_id: t.id,
                    transaction_type: 'Tip',
                    amount_cents: t.amount_cents,
                    creator_share_cents: t.creator_share_cents,
                    platform_share_cents: t.amount_cents - t.creator_share_cents,
                    created_at: t.created_at
                })),
                ...(ppvTransactions || []).map(p => ({
                    transaction_id: p.id,
                    transaction_type: 'PPV',
                    amount_cents: p.amount_cents,
                    creator_share_cents: p.creator_share_cents,
                    platform_share_cents: p.amount_cents - p.creator_share_cents,
                    created_at: p.created_at
                })),
                ...(subTransactions || []).map(s => ({
                    transaction_id: s.id,
                    transaction_type: 'Subscription',
                    amount_cents: s.amount_cents,
                    creator_share_cents: s.creator_share_cents,
                    platform_share_cents: s.amount_cents - s.creator_share_cents,
                    created_at: s.created_at
                })),
                ...(productTransactions || []).map(p => ({
                    transaction_id: p.id,
                    transaction_type: 'Product',
                    amount_cents: p.amount_cents,
                    creator_share_cents: p.creator_share_cents,
                    platform_share_cents: p.amount_cents - p.creator_share_cents,
                    created_at: p.created_at
                })),
                ...(callTransactions || []).map(c => ({
                    transaction_id: c.id,
                    transaction_type: 'Call',
                    amount_cents: c.credits_cents,
                    creator_share_cents: c.credits_cents,
                    platform_share_cents: 0,
                    created_at: c.created_at
                })),
            ];
        } else {
            // Platform-wide transactions - custom implementation with proper fallback logic
            const startDate = new Date(year, month - 1, 1).toISOString();
            const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

            // Get all tip transactions with creator_id
            const { data: tipTransactionsWithCreatorId } = await supabase
                .from('tip_transactions')
                .select(`
                    id, amount_cents, creator_share_cents, platform_share_cents, created_at,
                    creator_id, user_id,
                    creator:profiles!creator_id(username, full_name),
                    user:profiles!user_id(username, full_name)
                `)
                .gte('created_at', startDate)
                .lte('created_at', endDate)
                .not('creator_id', 'is', null);

            // Get all posts to match with post tips
            const { data: allPosts } = await supabase
                .from('posts')
                .select('id, user_id, user:profiles!user_id(username, full_name)')
                .gte('created_at', startDate)
                .lte('created_at', endDate);

            // Get tip transactions without creator_id but linked to posts
            const { data: tipTransactionsFromPosts } = await supabase
                .from('tip_transactions')
                .select(`
                    id, amount_cents, creator_share_cents, platform_share_cents, created_at,
                    post_id, user_id,
                    user:profiles!user_id(username, full_name)
                `)
                .is('creator_id', null)
                .gte('created_at', startDate)
                .lte('created_at', endDate);

            // Create a map of post_id to creator info
            const postCreatorMap = new Map();
            allPosts?.forEach(post => {
                const user = post.user as any;
                postCreatorMap.set(post.id, {
                    id: post.user_id,
                    username: user?.username || 'Unknown',
                    full_name: user?.full_name || 'Unknown Creator'
                });
            });

            // Process post tips to add creator info
            const processedPostTips = tipTransactionsFromPosts?.map(tip => {
                const user = tip.user as any;
                return {
                    ...tip,
                    creator_id: postCreatorMap.get(tip.post_id)?.id,
                    creator: postCreatorMap.get(tip.post_id)
                };
            }) || [];

            // Get other transaction types
            const { data: ppvTransactions } = await supabase
                .from('ppv_transactions')
                .select(`
                    id, amount_cents, creator_share_cents, platform_share_cents, created_at,
                    post_id, user_id,
                    user:profiles!user_id(username, full_name)
                `)
                .gte('created_at', startDate)
                .lte('created_at', endDate);

            // Process PPV transactions to add creator info
            const processedPpvTransactions = ppvTransactions?.map(ppv => {
                const user = ppv.user as any;
                return {
                    ...ppv,
                    creator_id: postCreatorMap.get(ppv.post_id)?.id,
                    creator: postCreatorMap.get(ppv.post_id)
                };
            }) || [];

            const { data: subTransactions } = await supabase
                .from('subscription_payments')
                .select(`
                    id, amount_cents, creator_share_cents, platform_share_cents, created_at,
                    creator_profile_id, user_id,
                    creator:creators!creator_profile_id(profile_id, profile:profiles!profile_id(username, full_name)),
                    user:profiles!user_id(username, full_name)
                `)
                .gte('created_at', startDate)
                .lte('created_at', endDate);

            const { data: productTransactions } = await supabase
                .from('creator_product_transactions')
                .select(`
                    id, amount_cents, creator_share_cents, platform_share_cents, created_at,
                    creator_product_id, user_id,
                    user:profiles!user_id(username, full_name)
                `)
                .gte('created_at', startDate)
                .lte('created_at', endDate);

            // Get credit transactions
            const { data: creditTransactions } = await supabase
                .from('credit_transactions')
                .select(`
                    id, amount_cents, created_at,
                    user_id,
                    user:profiles!user_id(username, full_name)
                `)
                .gte('created_at', startDate)
                .lte('created_at', endDate);

            // Get creator info for product transactions
            const { data: creatorProducts } = await supabase
                .from('creator_products')
                .select('id, creator_profile_id, creator:profiles!creator_profile_id(username, full_name)');

            const productCreatorMap = new Map();
            creatorProducts?.forEach(product => {
                const creator = product.creator as any;
                productCreatorMap.set(product.id, {
                    id: product.creator_profile_id,
                    username: creator?.username || 'Unknown',
                    full_name: creator?.full_name || 'Unknown Creator'
                });
            });

            // Process product transactions to add creator info
            const processedProductTransactions = productTransactions?.map(product => {
                const user = product.user as any;
                return {
                    ...product,
                    creator_id: productCreatorMap.get(product.creator_product_id)?.id,
                    creator: productCreatorMap.get(product.creator_product_id)
                };
            }) || [];

            // Combine all transactions
            transactions = [
                ...(tipTransactionsWithCreatorId || []).map(t => {
                    const user = t.user as any;
                    const creator = t.creator as any;
                    return {
                        transaction_id: t.id,
                        transaction_type: 'Tip',
                        amount_cents: t.amount_cents,
                        creator_share_cents: t.creator_share_cents,
                        platform_share_cents: t.platform_share_cents,
                        created_at: t.created_at,
                        user_name: user?.username || 'Unknown',
                        creator_name: creator?.username || 'Unknown'
                    };
                }),
                ...processedPostTips.map(t => {
                    const user = t.user as any;
                    return {
                        transaction_id: t.id,
                        transaction_type: 'Tip (Post)',
                        amount_cents: t.amount_cents,
                        creator_share_cents: t.creator_share_cents,
                        platform_share_cents: t.platform_share_cents,
                        created_at: t.created_at,
                        user_name: user?.username || 'Unknown',
                        creator_name: t.creator?.username || 'Unknown'
                    };
                }),
                ...processedPpvTransactions.map(p => {
                    const user = p.user as any;
                    return {
                        transaction_id: p.id,
                        transaction_type: 'PPV',
                        amount_cents: p.amount_cents,
                        creator_share_cents: p.creator_share_cents,
                        platform_share_cents: p.platform_share_cents,
                        created_at: p.created_at,
                        user_name: user?.username || 'Unknown',
                        creator_name: p.creator?.username || 'Unknown'
                    };
                }),
                ...(subTransactions || []).map(s => {
                    const user = s.user as any;
                    const creator = s.creator as any;
                    const creatorProfile = creator?.profile as any;
                    return {
                        transaction_id: s.id,
                        transaction_type: 'Subscription',
                        amount_cents: s.amount_cents,
                        creator_share_cents: s.creator_share_cents,
                        platform_share_cents: s.platform_share_cents,
                        created_at: s.created_at,
                        user_name: user?.username || 'Unknown',
                        creator_name: creatorProfile?.username || 'Unknown'
                    };
                }),
                ...processedProductTransactions.map(p => {
                    const user = p.user as any;
                    return {
                        transaction_id: p.id,
                        transaction_type: 'Product',
                        amount_cents: p.amount_cents,
                        creator_share_cents: p.creator_share_cents,
                        platform_share_cents: p.platform_share_cents,
                        created_at: p.created_at,
                        user_name: user?.username || 'Unknown',
                        creator_name: p.creator?.username || 'Unknown'
                    };
                }),
                ...(creditTransactions || []).map(c => {
                    const user = c.user as any;
                    return {
                        transaction_id: c.id,
                        transaction_type: 'Credit Purchase',
                        amount_cents: c.amount_cents,
                        creator_share_cents: 0, // Credits are 100% platform revenue
                        platform_share_cents: c.amount_cents,
                        created_at: c.created_at,
                        user_name: user?.username || 'Unknown',
                        creator_name: 'N/A' // Credits don't have a creator
                    };
                }),
            ];
        }
        
        // Debug: Log the transactions array to see what's included
        
        const doc = new jsPDF();
        const monthName = months.find(m => m.value === month)?.label;

        // Document Header
        doc.setFontSize(20);
        doc.text(isCreatorView ? `Creator Financial Statement` : `Financial Statement`, 14, 22);
        doc.setFontSize(12);
        doc.text(`For ${monthName} ${year}`, 14, 30);

        // Summary Table
        autoTable(doc, {
            startY: 40,
            head: [['Metric', 'Amount']],
            body: isCreatorView ? [
                ['Gross Revenue', formatCurrency(statement.gross_revenue)],
                ['Net Revenue (Your Earnings)', formatCurrency(statement.net_revenue)],
                ['Platform Fees', formatCurrency(statement.platform_fees)],
                ['Total Transactions', statement.total_transactions.toLocaleString()],
            ] : [
                ['Gross Revenue', formatCurrency(statement.gross_revenue)],
                ['Net Revenue (Platform Earnings)', formatCurrency(statement.net_revenue)],
                ['Total Creator Payouts', formatCurrency(statement.creator_payouts)],
                ['Total Transactions', statement.total_transactions.toLocaleString()],
            ],
            theme: 'striped'
        });

        // Itemized Transactions Table
        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 10,
            head: [['Date', 'Type', 'Transaction ID', 'Amount', 'Platform', isCreatorView ? 'Your Share' : 'Creator Share']],
            body: transactions.map((t: any) => [
                new Date(t.created_at).toLocaleDateString(),
                t.transaction_type,
                t.transaction_id || 'N/A',
                formatCurrency(t.amount_cents),
                formatCurrency(t.platform_share_cents),
                formatCurrency(t.creator_share_cents),
            ]),
            theme: 'grid'
        });
        
        doc.save(`${isCreatorView ? 'creator-' : ''}statement-${year}-${month}.pdf`);
        setIsLoading(false);
        toast.success("PDF exported successfully!");
    };

    const handleExport = async () => {
        if (!statement) return;

        toast.info('Exporting statement... this may take a moment.');
        setIsLoading(true);

        const { year, month } = selectedDate;
        let transactions: any[] = [];

        if (isCreatorView && creatorId) {
            // Get creator-specific transactions (same logic as PDF export)
            const startDate = new Date(year, month - 1, 1).toISOString();
            const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

            // Get all transaction types for the creator (include IDs for CSV export)
            // First get tip transactions with creator_id
            const { data: tipTransactionsWithCreatorId } = await supabase
                .from('tip_transactions')
                .select('id, amount_cents, creator_share_cents, created_at')
                .eq('creator_id', creatorId)
                .gte('created_at', startDate)
                .lte('created_at', endDate);

            // Get creator's posts for fallback tip transactions
            const { data: creatorPosts } = await supabase
                .from('posts')
                .select('id')
                .eq('user_id', creatorId);

            const postIds = creatorPosts?.map(p => p.id) || [];

            // Then get tip transactions without creator_id but where the post belongs to this creator
            const { data: tipTransactionsFromPosts } = await supabase
                .from('tip_transactions')
                .select('id, amount_cents, creator_share_cents, created_at')
                .is('creator_id', null)
                .in('post_id', postIds)
                .gte('created_at', startDate)
                .lte('created_at', endDate);

            // Combine both tip transaction sources
            const tipTransactions = [...(tipTransactionsWithCreatorId || []), ...(tipTransactionsFromPosts || [])];

            let ppvTransactions: any[] = [];
            if (postIds.length > 0) {
                const { data: ppvData } = await supabase
                    .from('ppv_transactions')
                    .select('id, amount_cents, creator_share_cents, created_at')
                    .in('post_id', postIds)
                    .gte('created_at', startDate)
                    .lte('created_at', endDate);
                ppvTransactions = ppvData || [];
            }

            const { data: subTransactions } = await supabase
                .from('subscription_payments')
                .select('id, amount_cents, creator_share_cents, created_at')
                .eq('creator_profile_id', creatorId)
                .gte('created_at', startDate)
                .lte('created_at', endDate);

            const { data: creatorProducts } = await supabase
                .from('creator_products')
                .select('id')
                .eq('creator_profile_id', creatorId);

            const productIds = creatorProducts?.map(p => p.id) || [];
            let productTransactions: any[] = [];
            if (productIds.length > 0) {
                const { data: productData } = await supabase
                    .from('creator_product_transactions')
                    .select('id, amount_cents, creator_share_cents, created_at')
                    .in('creator_product_id', productIds)
                    .gte('created_at', startDate)
                    .lte('created_at', endDate);
                productTransactions = productData || [];
            }

            const { data: callTransactions } = await supabase
                .from('call_transactions')
                .select('id, credits_cents, created_at')
                .eq('creator_profile_id', creatorId)
                .gte('created_at', startDate)
                .lte('created_at', endDate);

            // Combine all transactions
            transactions = [
                ...(tipTransactions || []).map(t => ({
                    transaction_id: t.id,
                    transaction_type: 'Tip',
                    amount_cents: t.amount_cents,
                    creator_share_cents: t.creator_share_cents,
                    platform_share_cents: t.amount_cents - t.creator_share_cents,
                    created_at: t.created_at
                })),
                ...(ppvTransactions || []).map(p => ({
                    transaction_id: p.id,
                    transaction_type: 'PPV',
                    amount_cents: p.amount_cents,
                    creator_share_cents: p.creator_share_cents,
                    platform_share_cents: p.amount_cents - p.creator_share_cents,
                    created_at: p.created_at
                })),
                ...(subTransactions || []).map(s => ({
                    transaction_id: s.id,
                    transaction_type: 'Subscription',
                    amount_cents: s.amount_cents,
                    creator_share_cents: s.creator_share_cents,
                    platform_share_cents: s.amount_cents - s.creator_share_cents,
                    created_at: s.created_at
                })),
                ...(productTransactions || []).map(p => ({
                    transaction_id: p.id,
                    transaction_type: 'Product',
                    amount_cents: p.amount_cents,
                    creator_share_cents: p.creator_share_cents,
                    platform_share_cents: p.amount_cents - p.creator_share_cents,
                    created_at: p.created_at
                })),
                ...(callTransactions || []).map(c => ({
                    transaction_id: c.id,
                    transaction_type: 'Call',
                    amount_cents: c.credits_cents,
                    creator_share_cents: c.credits_cents,
                    platform_share_cents: 0,
                    created_at: c.created_at
                })),
            ];
        } else {
            // Platform-wide transactions - custom implementation with proper fallback logic
            const startDate = new Date(year, month - 1, 1).toISOString();
            const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

            // Get all tip transactions with creator_id
            const { data: tipTransactionsWithCreatorId } = await supabase
                .from('tip_transactions')
                .select(`
                    id, amount_cents, creator_share_cents, platform_share_cents, created_at,
                    creator_id, user_id,
                    creator:profiles!creator_id(username, full_name),
                    user:profiles!user_id(username, full_name)
                `)
                .gte('created_at', startDate)
                .lte('created_at', endDate)
                .not('creator_id', 'is', null);

            // Get all posts to match with post tips
            const { data: allPosts } = await supabase
                .from('posts')
                .select('id, user_id, user:profiles!user_id(username, full_name)')
                .gte('created_at', startDate)
                .lte('created_at', endDate);

            // Get tip transactions without creator_id but linked to posts
            const { data: tipTransactionsFromPosts } = await supabase
                .from('tip_transactions')
                .select(`
                    id, amount_cents, creator_share_cents, platform_share_cents, created_at,
                    post_id, user_id,
                    user:profiles!user_id(username, full_name)
                `)
                .is('creator_id', null)
                .gte('created_at', startDate)
                .lte('created_at', endDate);

            // Create a map of post_id to creator info
            const postCreatorMap = new Map();
            allPosts?.forEach(post => {
                const user = post.user as any;
                postCreatorMap.set(post.id, {
                    id: post.user_id,
                    username: user?.username || 'Unknown',
                    full_name: user?.full_name || 'Unknown Creator'
                });
            });

            // Process post tips to add creator info
            const processedPostTips = tipTransactionsFromPosts?.map(tip => {
                const user = tip.user as any;
                return {
                    ...tip,
                    creator_id: postCreatorMap.get(tip.post_id)?.id,
                    creator: postCreatorMap.get(tip.post_id)
                };
            }) || [];

            // Get other transaction types
            const { data: ppvTransactions } = await supabase
                .from('ppv_transactions')
                .select(`
                    id, amount_cents, creator_share_cents, platform_share_cents, created_at,
                    post_id, user_id,
                    user:profiles!user_id(username, full_name)
                `)
                .gte('created_at', startDate)
                .lte('created_at', endDate);

            // Process PPV transactions to add creator info
            const processedPpvTransactions = ppvTransactions?.map(ppv => {
                const user = ppv.user as any;
                return {
                    ...ppv,
                    creator_id: postCreatorMap.get(ppv.post_id)?.id,
                    creator: postCreatorMap.get(ppv.post_id)
                };
            }) || [];

            const { data: subTransactions } = await supabase
                .from('subscription_payments')
                .select(`
                    id, amount_cents, creator_share_cents, platform_share_cents, created_at,
                    creator_profile_id, user_id,
                    creator:creators!creator_profile_id(profile_id, profile:profiles!profile_id(username, full_name)),
                    user:profiles!user_id(username, full_name)
                `)
                .gte('created_at', startDate)
                .lte('created_at', endDate);

            const { data: productTransactions } = await supabase
                .from('creator_product_transactions')
                .select(`
                    id, amount_cents, creator_share_cents, platform_share_cents, created_at,
                    creator_product_id, user_id,
                    user:profiles!user_id(username, full_name)
                `)
                .gte('created_at', startDate)
                .lte('created_at', endDate);

            // Get credit transactions
            const { data: creditTransactions } = await supabase
                .from('credit_transactions')
                .select(`
                    id, amount_cents, created_at,
                    user_id,
                    user:profiles!user_id(username, full_name)
                `)
                .gte('created_at', startDate)
                .lte('created_at', endDate);

            // Get creator info for product transactions
            const { data: creatorProducts } = await supabase
                .from('creator_products')
                .select('id, creator_profile_id, creator:profiles!creator_profile_id(username, full_name)');

            const productCreatorMap = new Map();
            creatorProducts?.forEach(product => {
                const creator = product.creator as any;
                productCreatorMap.set(product.id, {
                    id: product.creator_profile_id,
                    username: creator?.username || 'Unknown',
                    full_name: creator?.full_name || 'Unknown Creator'
                });
            });

            // Process product transactions to add creator info
            const processedProductTransactions = productTransactions?.map(product => {
                const user = product.user as any;
                return {
                    ...product,
                    creator_id: productCreatorMap.get(product.creator_product_id)?.id,
                    creator: productCreatorMap.get(product.creator_product_id)
                };
            }) || [];

            // Combine all transactions
            transactions = [
                ...(tipTransactionsWithCreatorId || []).map(t => {
                    const user = t.user as any;
                    const creator = t.creator as any;
                    return {
                        transaction_id: t.id,
                        transaction_type: 'Tip',
                        amount_cents: t.amount_cents,
                        creator_share_cents: t.creator_share_cents,
                        platform_share_cents: t.platform_share_cents,
                        created_at: t.created_at,
                        user_name: user?.username || 'Unknown',
                        creator_name: creator?.username || 'Unknown'
                    };
                }),
                ...processedPostTips.map(t => {
                    const user = t.user as any;
                    return {
                        transaction_id: t.id,
                        transaction_type: 'Tip (Post)',
                        amount_cents: t.amount_cents,
                        creator_share_cents: t.creator_share_cents,
                        platform_share_cents: t.platform_share_cents,
                        created_at: t.created_at,
                        user_name: user?.username || 'Unknown',
                        creator_name: t.creator?.username || 'Unknown'
                    };
                }),
                ...processedPpvTransactions.map(p => {
                    const user = p.user as any;
                    return {
                        transaction_id: p.id,
                        transaction_type: 'PPV',
                        amount_cents: p.amount_cents,
                        creator_share_cents: p.creator_share_cents,
                        platform_share_cents: p.platform_share_cents,
                        created_at: p.created_at,
                        user_name: user?.username || 'Unknown',
                        creator_name: p.creator?.username || 'Unknown'
                    };
                }),
                ...(subTransactions || []).map(s => {
                    const user = s.user as any;
                    const creator = s.creator as any;
                    const creatorProfile = creator?.profile as any;
                    return {
                        transaction_id: s.id,
                        transaction_type: 'Subscription',
                        amount_cents: s.amount_cents,
                        creator_share_cents: s.creator_share_cents,
                        platform_share_cents: s.platform_share_cents,
                        created_at: s.created_at,
                        user_name: user?.username || 'Unknown',
                        creator_name: creatorProfile?.username || 'Unknown'
                    };
                }),
                ...processedProductTransactions.map(p => {
                    const user = p.user as any;
                    return {
                        transaction_id: p.id,
                        transaction_type: 'Product',
                        amount_cents: p.amount_cents,
                        creator_share_cents: p.creator_share_cents,
                        platform_share_cents: p.platform_share_cents,
                        created_at: p.created_at,
                        user_name: user?.username || 'Unknown',
                        creator_name: p.creator?.username || 'Unknown'
                    };
                }),
                ...(creditTransactions || []).map(c => {
                    const user = c.user as any;
                    return {
                        transaction_id: c.id,
                        transaction_type: 'Credit Purchase',
                        amount_cents: c.amount_cents,
                        creator_share_cents: 0, // Credits are 100% platform revenue
                        platform_share_cents: c.amount_cents,
                        created_at: c.created_at,
                        user_name: user?.username || 'Unknown',
                        creator_name: 'N/A' // Credits don't have a creator
                    };
                })
            ];
        }

        // Debug: Log the transactions array to see what's included

        const summaryContent = [
            ['Metric', 'Value'],
            ...(isCreatorView ? [
                ['Gross Revenue', (statement.gross_revenue / 100).toFixed(2)],
                ['Net Revenue (Your Earnings)', (statement.net_revenue / 100).toFixed(2)],
                ['Platform Fees', (statement.platform_fees / 100).toFixed(2)],
                ['Total Transactions', statement.total_transactions],
            ] : [
                ['Gross Revenue', (statement.gross_revenue / 100).toFixed(2)],
                ['Net Revenue (Platform Earnings)', (statement.net_revenue / 100).toFixed(2)],
                ['Total Creator Payouts', (statement.creator_payouts / 100).toFixed(2)],
                ['Total Transactions', statement.total_transactions],
            ]),
            [''], // Spacer
            ['Itemized Transactions'],
            isCreatorView ? 
                ['Transaction ID', 'Type', 'Amount', 'Platform Share', 'Your Share', 'Date'] :
                ['Transaction ID', 'Type', 'User', 'Creator', 'Amount', 'Platform Share', 'Creator Share', 'Date']
        ].map(e => e.join(',')).join('\n');

        const itemizedContent = transactions.map((t: any, index: number) => [
            t.transaction_id || (index + 1),
            t.transaction_type,
            ...(isCreatorView ? [
                (t.amount_cents / 100).toFixed(2),
                (t.platform_share_cents / 100).toFixed(2),
                (t.creator_share_cents / 100).toFixed(2),
            ] : [
                t.user_name || 'Unknown',
                t.creator_name || 'Unknown',
                (t.amount_cents / 100).toFixed(2),
                (t.platform_share_cents / 100).toFixed(2),
                (t.creator_share_cents / 100).toFixed(2),
            ]),
            new Date(t.created_at).toISOString()
        ].join(',')).join('\n');
        
        const csvContent = `${summaryContent}\n${itemizedContent}`;

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.href) {
            URL.revokeObjectURL(link.href);
        }
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.setAttribute('download', `${isCreatorView ? 'creator-' : ''}statement-${selectedDate.year}-${selectedDate.month}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setIsLoading(false);
        toast.success('Statement exported successfully!');
    };

    return (
        <AdminCard padding="lg">
            <AdminSectionTitle
                title={isCreatorView ? 'Your monthly statement' : 'Monthly statements'}
                description={isCreatorView ? 'View your earnings and transaction history for the selected month.' : 'Select a month and year to view the financial summary.'}
            />
                <div className="flex flex-wrap items-center gap-3 mb-6">
                    <Select
                        value={String(selectedDate.month)}
                        onValueChange={(value) => setSelectedDate(prev => ({ ...prev, month: Number(value) }))}
                    >
                        <SelectTrigger className={cn('w-40', adminSelectTriggerClass)}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {months.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select
                        value={String(selectedDate.year)}
                        onValueChange={(value) => setSelectedDate(prev => ({ ...prev, year: Number(value) }))}
                    >
                        <SelectTrigger className={cn('w-32', adminSelectTriggerClass)}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <AdminGhostButton onClick={handleExportPdf} disabled={!statement || isLoading}>
                        <FileText className="h-4 w-4" />
                        Download PDF
                    </AdminGhostButton>
                    <AdminGhostButton onClick={handleExport} disabled={!statement || isLoading}>
                        <Download className="h-4 w-4" />
                        {isLoading ? 'Exporting…' : 'Export CSV'}
                    </AdminGhostButton>
                </div>

                {statement ? (
                    <div ref={statementRef}>
                        <h2 className="font-display text-lg mb-4">
                            {isCreatorView ? 'Your financial summary' : 'Financial summary'} — {months.find(m => m.value === selectedDate.month)?.label} {selectedDate.year}
                        </h2>
                        <AdminTableShell>
                        <Table>
                            <TableHeader>
                                <AdminTableHeaderRow>
                                    <AdminTh>Metric</AdminTh>
                                    <AdminTh className="text-right">Amount</AdminTh>
                                </AdminTableHeaderRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow className="admin-row border-b border-border">
                                    <TableCell className={adminTdClass}>Gross revenue</TableCell>
                                    <TableCell className={cn(adminTdClass, 'text-right font-semibold tabular-nums text-[var(--brand-gold)]')}>{formatCurrency(statement.gross_revenue)}</TableCell>
                                </TableRow>
                                <TableRow className="admin-row border-b border-border">
                                    <TableCell className={adminTdClass}>{isCreatorView ? 'Net revenue (your earnings)' : 'Net revenue (platform earnings)'}</TableCell>
                                    <TableCell className={cn(adminTdClass, 'text-right font-semibold tabular-nums text-[var(--brand-gold)]')}>{formatCurrency(statement.net_revenue)}</TableCell>
                                </TableRow>
                                {!isCreatorView && (
                                    <TableRow className="admin-row border-b border-border">
                                        <TableCell className={adminTdClass}>Total creator payouts</TableCell>
                                        <TableCell className={cn(adminTdClass, 'text-right font-semibold tabular-nums')}>{formatCurrency(statement.creator_payouts)}</TableCell>
                                    </TableRow>
                                )}
                                <TableRow className="admin-row border-b border-border">
                                    <TableCell className={adminTdClass}>Total transactions</TableCell>
                                    <TableCell className={cn(adminTdClass, 'text-right font-semibold tabular-nums')}>{statement.total_transactions.toLocaleString()}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                        </AdminTableShell>
                    </div>
                ) : (
                    <div className="text-center py-10 text-muted-foreground text-sm">
                        {isLoading ? 'Loading statement…' : 'No data available for the selected period.'}
                    </div>
                )}
        </AdminCard>
    );
} 