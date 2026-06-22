'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { createOrderShippedNotification, createOrderDeliveredNotification } from '@/app/actions/notificationActions';

import { PageShell } from '@/components/layout/page-header';
import { useUser } from '@/lib/contexts/user-context';
import { RequireAuth } from '@/components/auth/require-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  displayOrderStatus,
  isOrderFulfillable,
  shouldRepairOrderToPaid,
} from '@/lib/marketplace/order-status';

interface ProductOrder {
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
    creator: {
      username: string;
      full_name: string | null;
    } | null;
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

export default function CreatorOrdersPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { session, profile, isLoading: authLoading } = useUser();
  const [productOrders, setProductOrders] = useState<ProductOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [notCreator, setNotCreator] = useState(false);
  const [buyerPurchaseCount, setBuyerPurchaseCount] = useState(0);
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);
  const [trackingInputs, setTrackingInputs] = useState<{ [orderId: string]: { tracking: string; deliveryDate: string } }>({});

  const handleTrackingSubmit = async (orderId: string) => {
    const input = trackingInputs[orderId];
    if (!input?.tracking || !input?.deliveryDate) return;

    setUpdatingOrder(orderId);
    try {
      const { error } = await supabase
        .from('creator_product_orders')
        .update({
          tracking_number: input.tracking,
          estimated_delivery_date: input.deliveryDate,
          order_status: 'shipped',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) {
        console.error('Error updating order:', error);
        return;
      }

      // Update local state
      setProductOrders(prev => prev.map(order => 
        order.id === orderId 
          ? { 
              ...order, 
              tracking_number: input.tracking,
              estimated_delivery_date: input.deliveryDate,
              order_status: 'shipped'
            }
          : order
      ));

      // Create notification for the buyer
      const order = productOrders.find(o => o.id === orderId);
      if (order && order.product && order.buyer && session?.user) {
        try {
          await createOrderShippedNotification({
            buyerId: order.user_id,
            creatorId: session.user.id,
            creatorUsername: profile?.username || 'Creator',
            productName: order.product.product_name,
            trackingNumber: input.tracking,
            estimatedDeliveryDate: input.deliveryDate
          });
        } catch (notificationError) {
          console.error('Error creating order shipped notification:', notificationError);
          // Don't fail the order update if notification fails
        }
      }

      // Clear the input
      setTrackingInputs(prev => {
        const newInputs = { ...prev };
        delete newInputs[orderId];
        return newInputs;
      });

    } catch (error) {
      console.error('Error updating order:', error);
    } finally {
      setUpdatingOrder(null);
    }
  };

  const handleMarkDelivered = async (orderId: string) => {
    setUpdatingOrder(orderId);
    try {
      const { error } = await supabase
        .from('creator_product_orders')
        .update({
          order_status: 'delivered',
          actual_delivery_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) {
        console.error('Error updating order:', error);
        return;
      }

      // Update local state
      setProductOrders(prev => prev.map(order => 
        order.id === orderId 
          ? { 
              ...order, 
              order_status: 'delivered'
            }
          : order
      ));

      // Create notification for the buyer
      const order = productOrders.find(o => o.id === orderId);
      if (order && order.product && order.buyer && session?.user) {
        try {
          await createOrderDeliveredNotification({
            buyerId: order.user_id,
            creatorId: session.user.id,
            creatorUsername: profile?.username || 'Creator',
            productName: order.product.product_name
          });
        } catch (notificationError) {
          console.error('Error creating order delivered notification:', notificationError);
          // Don't fail the order update if notification fails
        }
      }

    } catch (error) {
      console.error('Error updating order:', error);
    } finally {
      setUpdatingOrder(null);
    }
  };

  useEffect(() => {
    if (authLoading || !session?.user?.id || !profile?.id) return;

    const fetchOrders = async () => {
      setLoading(true);
      setFetchError(null);
      setNotCreator(false);
      setBuyerPurchaseCount(0);

      try {
        const [{ data: creatorRow }, { data: creatorProducts, error: productsError }, { count: purchasesCount }] =
          await Promise.all([
            supabase.from('creators').select('profile_id').eq('profile_id', session.user.id).maybeSingle(),
            supabase.from('creator_products').select('id').eq('creator_profile_id', session.user.id),
            supabase
              .from('creator_product_transactions')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', session.user.id)
              .eq('status', 'succeeded'),
          ]);

        setBuyerPurchaseCount(purchasesCount ?? 0);

        if (productsError) {
          console.error('Error fetching creator products:', productsError);
          setFetchError('Could not load your products.');
          setProductOrders([]);
          return;
        }

        if (!creatorRow && !(creatorProducts?.length ?? 0)) {
          setNotCreator(true);
          setProductOrders([]);
          return;
        }

        const productIds = creatorProducts?.map((p) => p.id) ?? [];
        if (productIds.length === 0) {
          setProductOrders([]);
          return;
        }

        const { data: ordersData, error: ordersError } = await supabase
          .from('creator_product_orders')
          .select(`
            *,
            product:creator_products!creator_product_id(
              product_name,
              main_photo,
              price_cents,
              creator_profile_id
            ),
            buyer:profiles!user_id(username, full_name)
          `)
          .in('creator_product_id', productIds)
          .order('created_at', { ascending: false });

        if (ordersError) {
          console.error('Error fetching orders:', ordersError);
          setFetchError(ordersError.message || 'Could not load orders.');
          setProductOrders([]);
          return;
        }

        const ordersWithTransactions: ProductOrder[] = await Promise.all(
          (ordersData ?? []).map(async (order) => {
            const { data: transaction } = await supabase
              .from('creator_product_transactions')
              .select('amount_cents, currency, status')
              .eq('id', order.creator_product_transaction_id)
              .maybeSingle();

            return {
              ...order,
              transaction: transaction ?? null,
            } as ProductOrder;
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
        setProductOrders(orders);
      } catch (error) {
        console.error('Error fetching orders:', error);
        setFetchError('Could not load orders.');
        setProductOrders([]);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [authLoading, session?.user?.id, profile?.id, supabase]);

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

  const getOrderStatusColor = (status: string) => {
    if (!status) {
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300 px-2 py-1 rounded-full text-xs font-medium';
    }
    
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 px-2 py-1 rounded-full text-xs font-medium';
      case 'paid':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 px-2 py-1 rounded-full text-xs font-medium';
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

  if (authLoading || !profile) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <RequireAuth>
      <PageShell title="Creator Orders">
          <div className="p-4 pb-16 space-y-8">
            {/* Product Orders Section */}
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
              ) : fetchError ? (
                <Card>
                  <CardContent className="p-8 text-center space-y-2">
                    <p className="text-destructive">{fetchError}</p>
                    <p className="text-sm text-muted-foreground">Check the browser console for details, then refresh the page.</p>
                  </CardContent>
                </Card>
              ) : notCreator ? (
                <Card>
                  <CardContent className="p-8 text-center space-y-2">
                    <p className="text-muted-foreground">Creator Orders only applies to seller accounts.</p>
                    <p className="text-sm text-muted-foreground">
                      Become a creator first, or open{' '}
                      <a href="/transactions" className="text-pink-500 underline">Transactions</a>{' '}
                      to see purchases you made as a buyer.
                    </p>
                  </CardContent>
                </Card>
              ) : productOrders.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center space-y-3">
                    <p className="text-muted-foreground">No sales on your products yet.</p>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">Creator Orders</span> lists buyers who purchased{' '}
                      <span className="font-medium">your</span> marketplace listings — not items you bought
                      from other creators.
                    </p>
                    {buyerPurchaseCount > 0 && (
                      <p className="text-sm">
                        You have {buyerPurchaseCount} marketplace purchase
                        {buyerPurchaseCount === 1 ? '' : 's'} as a buyer.{' '}
                        <Link href="/transactions" className="text-pink-500 underline font-medium">
                          View them on Transactions
                        </Link>
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      To test fulfillment: use a second account (or incognito) to buy one of your products,
                      then return here logged in as the seller.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                productOrders.map((order) => (
                  <Card key={order.id} className="mb-4 p-0 gap-0 shadow-none">
                    <CardContent className="p-6">
                      <div className="space-y-3">
                        <div className="flex items-start gap-4">
                          {/* Product Image */}
                          <div className="flex-shrink-0">
                            {order.product?.main_photo ? (
                              <img
                                src={order.product.main_photo}
                                alt={order.product.product_name}
                                className="w-16 h-16 object-cover rounded-lg"
                              />
                            ) : (
                              <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                                <span className="text-gray-500 text-xs">No Image</span>
                              </div>
                            )}
                          </div>
                          
                          {/* Order Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                              <div className="space-y-1 min-w-0">
                                <h3 className="font-semibold truncate text-md leading-none">
                                  {order.product?.product_name || 'Product Order'}
                                </h3>
                                {order.buyer && (
                                  <p className="text-sm text-muted-foreground">
                                    Ordered by {order.buyer.full_name || `@${order.buyer.username}`}
                                  </p>
                                )}
                              </div>
                              <span className={getOrderStatusColor(displayOrderStatus(order))}>
                                {displayOrderStatus(order) || 'Unknown'}
                              </span>
                            </div>
                            
                            <div className="flex justify-between items-center mt-0">
                              <div className="text-sm text-muted-foreground">
                                {formatDate(order.created_at)}
                              </div>
                              <div className="text-lg font-semibold">
                                {order.transaction ? formatPrice(order.transaction.amount_cents) : formatPrice(order.product?.price_cents || 0)}
                              </div>
                            </div>
                          </div>
                        </div>

                        {order.shipping_address && (
                          <div className="text-sm text-muted-foreground pt-2 border-t">
                            <p className="font-medium">Shipping Address:</p>
                            <p>{order.shipping_address.name}</p>
                            <p>{order.shipping_address.address_line1}</p>
                            {order.shipping_address.address_line2 && (
                              <p>{order.shipping_address.address_line2}</p>
                            )}
                            <p>
                              {order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.postal_code}
                            </p>
                          </div>
                        )}

                        {/* Tracking Information */}
                        {order.tracking_number && (
                          <div className="text-sm text-muted-foreground pt-2 border-t">
                            <p className="font-medium">Tracking Number: {order.tracking_number}</p>
                            {order.estimated_delivery_date && (
                              <p>Estimated Delivery: {formatDate(order.estimated_delivery_date)}</p>
                            )}
                          </div>
                        )}

                        {/* Action Buttons */}
                        {isOrderFulfillable(order) && (
                          <div className="pt-4 border-t space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <Label htmlFor={`tracking-${order.id}`} className="block mb-2">Tracking Number</Label>
                                <Input
                                  id={`tracking-${order.id}`}
                                  placeholder="Enter tracking number"
                                  value={trackingInputs[order.id]?.tracking || ''}
                                  onChange={(e) => setTrackingInputs(prev => ({
                                    ...prev,
                                    [order.id]: { ...prev[order.id], tracking: e.target.value }
                                  }))}
                                />
                              </div>
                              <div>
                                <Label htmlFor={`delivery-${order.id}`} className="block mb-2">Estimated Delivery Date</Label>
                                <Input
                                  id={`delivery-${order.id}`}
                                  type="date"
                                  value={trackingInputs[order.id]?.deliveryDate || ''}
                                  onChange={(e) => setTrackingInputs(prev => ({
                                    ...prev,
                                    [order.id]: { ...prev[order.id], deliveryDate: e.target.value }
                                  }))}
                                />
                              </div>
                            </div>
                            <Button 
                              onClick={() => handleTrackingSubmit(order.id)}
                              disabled={updatingOrder === order.id || !trackingInputs[order.id]?.tracking || !trackingInputs[order.id]?.deliveryDate}
                              className="w-full md:w-auto"
                            >
                              {updatingOrder === order.id ? 'Updating...' : 'Mark as Shipped'}
                            </Button>
                          </div>
                        )}

                        {order.order_status === 'shipped' && (
                          <div className="pt-4 border-t">
                            <Button 
                              onClick={() => handleMarkDelivered(order.id)}
                              disabled={updatingOrder === order.id}
                              className="w-full md:w-auto"
                            >
                              {updatingOrder === order.id ? 'Updating...' : 'Mark as Delivered'}
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
      </PageShell>
    </RequireAuth>
  );
} 