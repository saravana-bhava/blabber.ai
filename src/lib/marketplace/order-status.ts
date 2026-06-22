/** Shared marketplace order status helpers for creator fulfillment flows. */

export type OrderWithTransaction = {
  id: string;
  order_status: string;
  transaction?: { status: string } | null;
};

/** Payment completed — creator can add tracking / mark shipped. */
export function isOrderFulfillable(order: OrderWithTransaction): boolean {
  if (order.order_status === 'paid') return true;
  return order.order_status === 'pending' && order.transaction?.status === 'succeeded';
}

/** Paid transaction recorded but order_status was left as pending (legacy Stripe bug). */
export function shouldRepairOrderToPaid(order: OrderWithTransaction): boolean {
  return order.order_status === 'pending' && order.transaction?.status === 'succeeded';
}

export function displayOrderStatus(order: OrderWithTransaction): string {
  if (shouldRepairOrderToPaid(order)) return 'paid';
  return order.order_status;
}
