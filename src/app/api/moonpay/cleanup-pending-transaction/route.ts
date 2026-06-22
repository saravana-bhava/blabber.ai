import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase admin client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
    },
  }
);

export async function POST(request: Request) {
  try {
    const { transactionId, paymentId, transactionType } = await request.json();

    // For subscriptions, use paymentId; for others, use transactionId
    const idToUse = transactionType === 'subscription' ? paymentId : transactionId;

    if (!idToUse || !transactionType) {
      return NextResponse.json(
        { error: `${transactionType === 'subscription' ? 'paymentId' : 'transactionId'} and transactionType are required` },
        { status: 400 }
      );
    }

    // Validate transaction type
    const validTypes = ['tip', 'ppv', 'subscription', 'product', 'credit'];
    if (!validTypes.includes(transactionType)) {
      return NextResponse.json(
        { error: 'Invalid transaction type' },
        { status: 400 }
      );
    }

    // Map transaction types to table names
    const tableMap: Record<string, string> = {
      tip: 'tip_transactions',
      ppv: 'ppv_transactions',
      subscription: 'subscription_payments',
      product: 'creator_product_transactions',
      credit: 'credit_transactions',
    };

    const tableName = tableMap[transactionType];

    // Only delete if status is still pending
    const { error: deleteError } = await supabase
      .from(tableName)
      .delete()
      .eq('id', idToUse)
      .eq('status', 'pending');

    if (deleteError) {
      console.error('Error deleting pending transaction:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete pending transaction' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error cleaning up pending transaction:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

