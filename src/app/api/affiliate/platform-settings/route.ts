import { NextResponse } from 'next/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';

export async function GET() {
  const supabaseAdmin = createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { persistSession: false } }
  );

  const { data, error } = await supabaseAdmin
    .from('platform_settings')
    .select('key, value')
    .in('key', ['affiliate_require_kyc', 'referral_credit_amount', 'referral_credits_enabled']);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const settings: Record<string, unknown> = {
    affiliate_require_kyc: true,
    referral_credit_amount: 1000,
    referral_credits_enabled: true,
  };

  for (const row of data ?? []) {
    settings[row.key] = row.value;
  }

  return NextResponse.json(settings);
}
