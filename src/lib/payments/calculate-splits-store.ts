import { createClient } from '@/lib/supabase/client';
import { fetchAgencyAttributionForCreator } from '@/lib/payments/agency-split';
import type { PaymentSplits } from '@/lib/payments/calculate-splits';

export async function calculatePaymentSplitsStore(
  amountCents: number,
  creatorProfileId?: string | null
): Promise<PaymentSplits> {
  const supabase = createClient();

  const { data: splitData } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'platform_split_store')
    .single();

  const platformSplitPercentage = splitData?.value ? parseInt(splitData.value) : 30;

  const platformShare = Math.floor((amountCents * platformSplitPercentage) / 100);
  const creatorShare = amountCents - platformShare;

  const { agencyShare, agencyProfileId } = await fetchAgencyAttributionForCreator(
    creatorProfileId ?? null,
    creatorShare
  );

  return {
    creatorShare,
    platformShare,
    agencyShare,
    agencyProfileId,
  };
}
