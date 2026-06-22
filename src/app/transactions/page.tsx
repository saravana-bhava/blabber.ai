'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

import { PageShell } from '@/components/layout/page-header';
import { useUser } from '@/lib/contexts/user-context';
import { RequireAuth } from '@/components/auth/require-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface ProductTransaction {
  id: string;
  user_id: string;
  creator_product_id?: string;
  amount_cents: number;
  currency: string;
  payment_provider: string;
  payment_intent_id: string;
  status: string;
  created_at: string;
  provider_transaction_reference: string;
  creator_share_cents: number | null;
  platform_share_cents: number | null;
  shipping_address: any;
  payout_id?: string | null;
  product?: {
    product_name: string;
    main_photo: string | null;
    creator: {
      username: string;
      full_name: string | null;
    } | null;
  } | null;
  order?: {
    id: string;
    order_status: string;
    tracking_number?: string | null;
    estimated_delivery_date?: string | null;
  }[] | null;
}

interface OtherTransaction {
  id: string;
  user_id: string;
  amount_cents: number;
  currency: string;
  payment_provider: string;
  payment_intent_id: string;
  status: string;
  created_at: string;
  provider_transaction_reference: string;
  creator_share_cents: number | null;
  platform_share_cents: number | null;
  transaction_type: 'ppv' | 'tip' | 'subscription' | 'call' | 'credit';
  payout_id?: string | null;
  // PPV and Tip specific - both use post field but with different structures
  post_id?: string;
  post?: {
    text_content?: string;
    user_id?: string;
    creator?: {
      username: string;
      full_name: string | null;
    } | null;
    post_creator?: {
      username: string;
      full_name: string | null;
    } | null;
  } | null;
  // Tip specific
  creator_id?: string;
  creator?: {
    username: string;
    full_name: string | null;
  } | null;
  // Subscription specific
  subscription_id?: string;
  creator_profile_id?: string;
  creator_profile?: {
    profile?: {
      username: string;
      full_name: string | null;
    } | null;
  } | null;
  period_starts_at?: string;
  period_ends_at?: string;
  // Call specific
  creator_profile_id_call?: string;
  creator_call?: {
    username: string;
    full_name: string | null;
  } | null;
  call_length_seconds?: number;
  credits_used?: number;
  credits_cents?: number;
  // Credit specific
  credits_purchased?: number;
}

export default function TransactionsPage() {
  const supabase = createClient();
  const router = useRouter();
  const { session, profile, isLoading } = useUser();
  const [productTransactions, setProductTransactions] = useState<ProductTransaction[]>([]);
  const [otherTransactions, setOtherTransactions] = useState<OtherTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!session?.user) return;

      try {
        // Fetch product transactions
        const { data: productData, error: productError } = await supabase
          .from('creator_product_transactions')
          .select(`
            *,
            product:creator_products(
              product_name,
              main_photo,
              creator:profiles(username, full_name)
            ),
            order:creator_product_orders(
              id,
              order_status,
              tracking_number,
              estimated_delivery_date
            )
          `)
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });

        if (productError) {
          console.error('Error fetching product transactions:', productError);
        } else {
          setProductTransactions(productData || []);
        }

        // Fetch PPV transactions
        const { data: ppvData, error: ppvError } = await supabase
          .from('ppv_transactions')
          .select(`
            *,
            post:posts(
              text_content,
              creator:profiles(username, full_name)
            )
          `)
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });

        // Fetch tip transactions
        const { data: tipData, error: tipError } = await supabase
          .from('tip_transactions')
          .select(`
            *,
            creator:profiles!creator_id(username, full_name),
            post:posts!post_id(
              user_id,
              post_creator:profiles!user_id(username, full_name)
            )
          `)
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });

        if (tipError) {
          console.error('Error fetching tip transactions:', tipError);
        }

        // if (tipData?.[0]) {
        // }

        // Fetch subscription payments
        const { data: subscriptionData, error: subscriptionError } = await supabase
          .from('subscription_payments')
          .select(`
            *,
            creator_profile:creators!creator_profile_id(
              profile:profiles(username, full_name)
            )
          `)
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });

        if (subscriptionError) {
          console.error('Error fetching subscription payments:', subscriptionError);
        }

        // Fetch call transactions
        const { data: callData, error: callError } = await supabase
          .from('call_transactions')
          .select(`
            *,
            creator_call:profiles!creator_profile_id(username, full_name)
          `)
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });

        if (callError) {
          console.error('Error fetching call transactions:', callError);
        }

        // Fetch credit transactions
        const { data: creditData, error: creditError } = await supabase
          .from('credit_transactions')
          .select('*')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });

        // Combine all other transactions
        const allOtherTransactions: OtherTransaction[] = [
          ...(ppvData || []).map(t => ({ ...t, transaction_type: 'ppv' as const })),
          ...(tipData || []).map(t => ({ ...t, transaction_type: 'tip' as const })),
          ...(subscriptionData || []).map(t => ({ ...t, transaction_type: 'subscription' as const })),
          ...(callData || []).map(t => ({ ...t, transaction_type: 'call' as const })),
          ...(creditData || []).map(t => ({ ...t, transaction_type: 'credit' as const }))
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        setOtherTransactions(allOtherTransactions);

      } catch (error) {
        console.error('Error fetching transactions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [session?.user, supabase]);

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    if (!status) {
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300 px-2 py-1 rounded-full text-xs font-medium';
    }
    
    switch (status.toLowerCase()) {
      case 'succeeded':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 px-2 py-1 rounded-full text-xs font-medium';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 px-2 py-1 rounded-full text-xs font-medium';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 px-2 py-1 rounded-full text-xs font-medium';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300 px-2 py-1 rounded-full text-xs font-medium';
    }
  };

  const getOrderStatusColor = (status: string) => {
    if (!status) {
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300 px-2 py-1 rounded-full text-xs font-medium';
    }
    
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 px-2 py-1 rounded-full text-xs font-medium';
      case 'processing':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 px-2 py-1 rounded-full text-xs font-medium';
      case 'shipped':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300 px-2 py-1 rounded-full text-xs font-medium';
      case 'delivered':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 px-2 py-1 rounded-full text-xs font-medium';
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 px-2 py-1 rounded-full text-xs font-medium';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300 px-2 py-1 rounded-full text-xs font-medium';
    }
  };

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case 'ppv':
        return 'Pay-Per-View';
      case 'tip':
        return 'Tip';
      case 'subscription':
        return 'Subscription';
      case 'call':
        return 'AI Call';
      case 'credit':
        return 'Credit Purchase';
      default:
        return type;
    }
  };

  const getTransactionTitle = (transaction: OtherTransaction) => {
    switch (transaction.transaction_type) {
      case 'ppv':
        const ppvCreator = transaction.post?.creator?.full_name || transaction.post?.creator?.username;
        return ppvCreator ? `Pay-Per-View from ${ppvCreator}` : 'Pay-Per-View';
      case 'tip':
        // Check for direct tip first (creator_id is set)
        if (transaction.creator_id && transaction.creator) {
          const tipCreator = transaction.creator.full_name || transaction.creator.username;
          return tipCreator ? `Tip to ${tipCreator}` : 'Tip to Creator';
        }
        // Fall back to post tip (get creator from post)
        const postCreator = transaction.post?.post_creator?.full_name || transaction.post?.post_creator?.username;
        return postCreator ? `Tip to ${postCreator}` : 'Tip to Creator';
      case 'subscription':
        const subCreator = transaction.creator_profile?.profile?.full_name || transaction.creator_profile?.profile?.username;
        return subCreator ? `Subscription to ${subCreator}` : 'Subscription to Creator';
      case 'call':
        const callCreator = transaction.creator_call?.full_name || transaction.creator_call?.username;
        return callCreator ? `AI Call with ${callCreator}` : 'AI Call with Creator';
      case 'credit':
        return `${transaction.credits_purchased} Credits`;
      default:
        return 'Transaction';
    }
  };

  const getTransactionAmount = (transaction: OtherTransaction) => {
    if (transaction.transaction_type === 'call') {
      return `${transaction.credits_used} credits`;
    }
    return formatPrice(transaction.amount_cents);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <RequireAuth>
      <PageShell title="Transaction History">
          <div className="p-4 pb-16 space-y-8">
            {/* Product Transactions Section */}
            <div>
              <h2 className="text-md font-semibold mb-4">ORDERS</h2>
              {loading ? (
                // Loading skeletons
                Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="mb-4">
                    <CardContent className="p-6">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-48" />
                            <Skeleton className="h-3 w-32" />
                          </div>
                          <Skeleton className="h-6 w-20" />
                        </div>
                        <div className="flex justify-between items-center">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : productTransactions.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground">No product purchases found.</p>
                  </CardContent>
                </Card>
              ) : (
                productTransactions.map((transaction) => {
                  return (
                    <Card key={transaction.id} className="mb-4 p-0 gap-0 shadow-none">
                      <CardContent className="p-6">
                        <div className="space-y-3">
                          <div className="flex items-start gap-4">
                            {/* Product Image */}
                            <div className="flex-shrink-0">
                              {transaction.product?.main_photo ? (
                                <img
                                  src={transaction.product.main_photo}
                                  alt={transaction.product.product_name}
                                  className="w-16 h-16 object-cover rounded-lg"
                                />
                              ) : (
                                <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                                  <span className="text-gray-500 text-xs">No Image</span>
                                </div>
                              )}
                            </div>
                            
                            {/* Product Details */}
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start">
                                <div className="space-y-1 min-w-0">
                                  <h3 className="font-semibold truncate text-md leading-none">
                                    {transaction.product?.product_name || 'Product Purchase'}
                                  </h3>
                                  {transaction.product?.creator && (
                                    <p className="text-sm text-muted-foreground">
                                      by {transaction.product.creator.full_name || `@${transaction.product.creator.username}`}
                                    </p>
                                  )}
                                </div>
                                <span className={getOrderStatusColor(transaction.order?.[0]?.order_status || '')}>
                                  {transaction.order?.[0]?.order_status || 'Unknown'}
                                </span>
                              </div>
                              
                              <div className="flex justify-between items-center mt-0">
                                <div className="text-sm text-muted-foreground">
                                  {formatDate(transaction.created_at)}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Amount Display */}
                          <div className="bg-muted rounded-lg p-4">
                            <p className="text-sm text-muted-foreground mb-1">Amount</p>
                            <p className="text-2xl font-bold">{formatPrice(transaction.amount_cents)}</p>
                          </div>

                          {transaction.shipping_address && (
                            <div className="text-sm text-muted-foreground pt-2 border-t">
                              <p className="font-medium">Shipping Address:</p>
                              <p>{transaction.shipping_address.name}</p>
                              <p>{transaction.shipping_address.address_line1}</p>
                              {transaction.shipping_address.address_line2 && (
                                <p>{transaction.shipping_address.address_line2}</p>
                              )}
                              <p>
                                {transaction.shipping_address.city}, {transaction.shipping_address.state} {transaction.shipping_address.postal_code}
                              </p>
                              {transaction.shipping_address.country && (
                                <p>{transaction.shipping_address.country}</p>
                              )}
                            </div>
                          )}

                          {/* Tracking Information for Shipped Orders */}
                          {transaction.order?.[0]?.order_status === 'shipped' && transaction.order[0].tracking_number && (
                            <div className="text-sm text-muted-foreground pt-2 border-t">
                              <p className="font-medium">Tracking Information:</p>
                              <p>Tracking Number: {transaction.order[0].tracking_number}</p>
                              {transaction.order[0].estimated_delivery_date && (
                                <p>Estimated Delivery: {formatDate(transaction.order[0].estimated_delivery_date)}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>

            {/* Other Transactions Section */}
            <div>
              <h2 className="text-md font-semibold mb-4">TRANSACTIONS</h2>
              {loading ? (
                // Loading skeletons
                Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="mb-4">
                    <CardContent className="p-6">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-48" />
                            <Skeleton className="h-3 w-32" />
                          </div>
                          <Skeleton className="h-6 w-20" />
                        </div>
                        <div className="flex justify-between items-center">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : otherTransactions.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground">No other transactions found.</p>
                  </CardContent>
                </Card>
              ) : (
                otherTransactions.map((transaction) => {
                  // Check if PPV transaction is clickable (succeeded status)
                  const isPPVClickable = transaction.transaction_type === 'ppv' && 
                                         transaction.status === 'succeeded' && 
                                         transaction.post_id;
                  
                  const handlePPVClick = () => {
                    if (isPPVClickable && transaction.post_id) {
                      router.push(`/p/${transaction.post_id}`);
                    }
                  };

                  return (
                  <Card 
                    key={transaction.id} 
                    className={`mb-4 p-0 gap-0 shadow-none ${isPPVClickable ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}`}
                    onClick={isPPVClickable ? handlePPVClick : undefined}
                  >
                    <CardContent className="p-6">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <h3 className="font-semibold text-md">
                              {getTransactionTitle(transaction)}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {getTransactionTypeLabel(transaction.transaction_type)}
                            </p>
                          </div>
                          <span className={getStatusColor(transaction.status)}>
                            {transaction.status}
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center mt-1.5">
                          <div className="text-sm text-muted-foreground">
                            {formatDate(transaction.created_at)}
                          </div>
                          <div className="text-lg font-semibold">
                            {getTransactionAmount(transaction)}
                          </div>
                        </div>

                        {transaction.transaction_type === 'call' && transaction.call_length_seconds && (
                          <div className="text-sm text-muted-foreground pt-2 border-t">
                            <p>Call Duration: {Math.floor(transaction.call_length_seconds / 60)}m {transaction.call_length_seconds % 60}s</p>
                          </div>
                        )}

                        {transaction.transaction_type === 'subscription' && transaction.period_starts_at && transaction.period_ends_at && (
                          <div className="text-sm text-muted-foreground pt-2 border-t">
                            <p>Period: {formatDate(transaction.period_starts_at)} - {formatDate(transaction.period_ends_at)}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  );
                })
              )}
            </div>
          </div>
      </PageShell>
    </RequireAuth>
  );
} 