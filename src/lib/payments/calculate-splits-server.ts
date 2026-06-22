import { createServiceRoleClient } from '@/lib/supabase/server';
import { fetchAgencyAttributionForCreator } from '@/lib/payments/agency-split';
import type { PaymentSplits } from '@/lib/payments/calculate-splits';

async function platformSplitValue(
  admin: ReturnType<typeof createServiceRoleClient>,
  key: string,
  defaultPct: number
): Promise<number> {
  const { data } = await admin.from('platform_settings').select('value').eq('key', key).maybeSingle();
  return data?.value ? parseInt(String(data.value), 10) : defaultPct;
}

export async function calculatePaymentSplitsContentServer(
  amountCents: number,
  creatorProfileId?: string | null
): Promise<PaymentSplits> {
  const admin = createServiceRoleClient();
  const platformSplitPercentage = await platformSplitValue(admin, 'platform_split_content', 30);
  const platformShare = Math.floor((amountCents * platformSplitPercentage) / 100);
  const creatorShare = amountCents - platformShare;
  const { agencyShare, agencyProfileId } = await fetchAgencyAttributionForCreator(
    creatorProfileId ?? null,
    creatorShare
  );
  return { creatorShare, platformShare, agencyShare, agencyProfileId };
}

export async function calculatePaymentSplitsStoreServer(
  amountCents: number,
  creatorProfileId?: string | null
): Promise<PaymentSplits> {
  const admin = createServiceRoleClient();
  const platformSplitPercentage = await platformSplitValue(admin, 'platform_split_store', 30);
  const platformShare = Math.floor((amountCents * platformSplitPercentage) / 100);
  const creatorShare = amountCents - platformShare;
  const { agencyShare, agencyProfileId } = await fetchAgencyAttributionForCreator(
    creatorProfileId ?? null,
    creatorShare
  );
  return { creatorShare, platformShare, agencyShare, agencyProfileId };
}
