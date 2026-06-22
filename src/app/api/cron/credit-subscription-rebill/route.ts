import { NextResponse } from 'next/server';
import { runCreditSubscriptionRebillJob } from '@/lib/payments/credit-subscription-rebill';

/**
 * Renews credit-funded subscriptions when credit_only_ecosystem is enabled:
 * debits credits for the next period or cancels if insufficient.
 *
 * Call from cron with header Authorization: Bearer <CRON_SECRET>
 * (or ONYX_REBILL_CRON_SECRET), same as other cron routes.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET || process.env.ONYX_REBILL_CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await runCreditSubscriptionRebillJob();
  return NextResponse.json(result);
}
