import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createUsPaymateCheckoutSession,
  generateUsPaymateOrderKey,
  type UsPaymateCustomer,
  type UsPaymateLineItem,
  type UsPaymatePaymentMetadata,
} from '@/lib/payments/uspaymate';

export async function startUsPaymateCheckout(
  supabaseAdmin: SupabaseClient,
  params: {
    userId: string;
    userEmail: string;
    userName: string;
    callbackType: string;
    returnUrl?: string;
    amountCents: number;
    lineItems: UsPaymateLineItem[];
    shippingTotalMinor?: number;
    metadata: UsPaymatePaymentMetadata;
    orderKey?: string;
  }
): Promise<{ paymentUrl: string; orderKey: string; alreadyPaid?: boolean }> {
  const orderKey = params.orderKey || generateUsPaymateOrderKey();

  const customer: UsPaymateCustomer = {
    email: params.userEmail,
    name: params.userName || 'Customer',
  };

  const session = await createUsPaymateCheckoutSession({
    orderKey,
    amountMinor: params.amountCents,
    lineItems: params.lineItems,
    shippingTotalMinor: params.shippingTotalMinor ?? 0,
    couponLines: [],
    customer,
    callbackType: params.callbackType,
    returnUrl: params.returnUrl,
  });

  if (!session.alreadyPaid) {
    await supabaseAdmin.from('pending_uspaymate_payments').upsert(
      {
        order_key: orderKey,
        user_id: params.userId,
        transaction_type: params.metadata.transactionType,
        metadata_json: params.metadata,
      },
      { onConflict: 'order_key' }
    );
  }

  return {
    paymentUrl: session.paylink,
    orderKey: session.orderKey,
    alreadyPaid: session.alreadyPaid,
  };
}

export async function getUsPaymateCustomerFromSession(
  supabase: SupabaseClient,
  userId: string,
  email: string | undefined
): Promise<{ email: string; name: string }> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .single();
  const name = (profile?.full_name || '').trim() || 'Customer';
  return { email: email || '', name };
}
