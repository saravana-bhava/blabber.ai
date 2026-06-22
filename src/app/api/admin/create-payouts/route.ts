import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { processCryptoPayout, type CryptoPayoutRequest } from '@/lib/payments/process-crypto-payout';

interface TransactionReference {
  table: 'call_transactions' | 'creator_product_transactions' | 'ppv_transactions' | 'tip_transactions' | 'subscription_payments';
  id: string;
}

interface PayoutRequest {
  creator_profile_id: string;
  payee_kind?: 'creator' | 'agency';
  amount_cents: number;
  currency: 'crypto' | 'usd';
  payout_method: 'solana' | 'ethereum' | 'polygon' | 'bitcoin' | 'bank' | null;
  blockchain?: string | null;
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

async function processUSDPayout(
  supabase: ReturnType<typeof createClient>,
  payoutId: string,
  payoutRequest: PayoutRequest
): Promise<{ success: boolean; error?: string }> {
  // TODO: Implement USD payout processing logic
  return { success: true };
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);

    // Check if user is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('isAdmin')
      .eq('id', user.id)
      .single();

    if (!profile?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { payouts }: { payouts: PayoutRequest[] } = await request.json();

    if (!payouts || !Array.isArray(payouts) || payouts.length === 0) {
      return NextResponse.json({ error: 'Invalid payouts data' }, { status: 400 });
    }

    const results = [];

    // Process each payout
    for (const payoutRequest of payouts) {
      try {
        // Validate payout request
        if (!payoutRequest.creator_profile_id || !payoutRequest.amount_cents || payoutRequest.amount_cents <= 0) {
          results.push({
            payout: payoutRequest,
            success: false,
            error: 'Invalid payout data',
          });
          continue;
        }

        // Validate transactions
        if (!payoutRequest.transactions || payoutRequest.transactions.length === 0) {
          results.push({
            payout: payoutRequest,
            success: false,
            error: 'No transactions included',
          });
          continue;
        }

        const payeeKind = payoutRequest.payee_kind || 'creator';

        // Create payout record
        const { data: payoutRecord, error: payoutError } = await supabase
          .from('payouts')
          .insert({
            creator_profile_id: payoutRequest.creator_profile_id,
            payee_kind: payeeKind,
            amount_cents: payoutRequest.amount_cents,
            currency: 'usd', // All amounts are in USD cents, regardless of payout method
            status: payoutRequest.status,
            payout_method: payoutRequest.payout_method,
            solana_address: payoutRequest.solana_address,
            ethereum_address: payoutRequest.ethereum_address,
            polygon_address: payoutRequest.polygon_address,
            bitcoin_address: payoutRequest.bitcoin_address,
            bank_account_number: payoutRequest.bank_account_number,
            bank_routing_number: payoutRequest.bank_routing_number,
            provider_specific_details: payoutRequest.blockchain 
              ? { blockchain: payoutRequest.blockchain, currency: 'USDC' }
              : null,
            created_at: payoutRequest.created_at,
          })
          .select()
          .single();

        if (payoutError || !payoutRecord) {
          results.push({
            payout: payoutRequest,
            success: false,
            error: payoutError?.message || 'Failed to create payout record',
          });
          continue;
        }

        const payoutId = payoutRecord.id;

        // Process the payout based on currency
        let processResult;
        if (payoutRequest.currency === 'crypto') {
          // Convert to CryptoPayoutRequest format
          const cryptoRequest: CryptoPayoutRequest = {
            creator_profile_id: payoutRequest.creator_profile_id,
            payee_kind: payeeKind,
            amount_cents: payoutRequest.amount_cents,
            currency: 'crypto',
            payout_method: payoutRequest.payout_method as 'solana' | 'ethereum' | 'polygon' | 'bitcoin',
            blockchain: payoutRequest.blockchain,
            solana_address: payoutRequest.solana_address,
            ethereum_address: payoutRequest.ethereum_address,
            polygon_address: payoutRequest.polygon_address,
            bitcoin_address: payoutRequest.bitcoin_address,
            transactions: payoutRequest.transactions,
            status: payoutRequest.status,
            created_at: payoutRequest.created_at,
          };
          processResult = await processCryptoPayout(supabase, payoutId, cryptoRequest);
        } else {
          processResult = await processUSDPayout(supabase, payoutId, payoutRequest);
        }

        if (!processResult.success) {
          // Update payout status to failed if processing fails
          await supabase
            .from('payouts')
            .update({ status: 'failed' })
            .eq('id', payoutId);

          results.push({
            payout: payoutRequest,
            payoutId,
            success: false,
            error: processResult.error || 'Payout processing failed',
          });
          continue;
        }

        // Update payout status - crypto payout is already set to 'processing' in processCryptoPayout
        // Only update USD payouts to processing here
        if (payoutRequest.currency === 'usd') {
        await supabase
          .from('payouts')
          .update({ status: 'processing' })
          .eq('id', payoutId);
        }

        // Link transactions to the payout. Agency payouts settle agency_payout_id;
        // creator payouts settle the existing payout_id column.
        const updateColumn = payeeKind === 'agency' ? 'agency_payout_id' : 'payout_id';
        for (const transaction of payoutRequest.transactions) {
          const updateData: Record<string, string> = { [updateColumn]: payoutId };

          const { error: updateError } = await supabase
            .from(transaction.table)
            .update(updateData)
            .eq('id', transaction.id);

          if (updateError) {
            console.error(`Error updating ${transaction.table} ${transaction.id}:`, updateError);
            // Continue with other transactions even if one fails
          }
        }

        results.push({
          payout: payoutRequest,
          payoutId,
          success: true,
        });
      } catch (error: any) {
        console.error('Error processing payout:', error);
        results.push({
          payout: payoutRequest,
          success: false,
          error: error.message || 'Unknown error',
        });
      }
    }

    // Count successes and failures
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: payouts.length,
        successful: successCount,
        failed: failureCount,
      },
    });
  } catch (error: any) {
    console.error('Error in create-payouts route:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
