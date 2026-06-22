import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabaseAdmin = createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { persistSession: false } }
  );

  try {
    const cookieStore = await cookies();
    const supabase = createServerSupabaseClient(cookieStore);
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { referral_code } = await request.json();
    if (!referral_code || typeof referral_code !== 'string') {
      return NextResponse.json({ error: 'referral_code is required' }, { status: 400 });
    }

    // Look up the referrer by their referral code
    const { data: referrer, error: referrerError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('referral_code', referral_code.toLowerCase())
      .maybeSingle();

    if (referrerError || !referrer) {
      return NextResponse.json({ error: 'Invalid referral code' }, { status: 404 });
    }

    // Prevent self-referral
    if (referrer.id === session.user.id) {
      return NextResponse.json({ error: 'Cannot refer yourself' }, { status: 400 });
    }

    // Check if the current user is already attributed (idempotent)
    const { data: currentProfile } = await supabaseAdmin
      .from('profiles')
      .select('referred_by_profile_id, credits')
      .eq('id', session.user.id)
      .maybeSingle();

    if (currentProfile?.referred_by_profile_id) {
      // Already attributed — no-op but return success so the cookie gets cleared
      return NextResponse.json({ ok: true, already_attributed: true });
    }

    // Set referred_by_profile_id on the signing-up user
    const { error: updateError, count } = await supabaseAdmin
      .from('profiles')
      .update({ referred_by_profile_id: referrer.id }, { count: 'exact' })
      .eq('id', session.user.id);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to attribute referral', details: updateError.message }, { status: 500 });
    }

    // Profile row doesn't exist yet (bootstrap hasn't run) — tell client to retry
    if (count === 0) {
      return NextResponse.json({ error: 'Profile not ready' }, { status: 503 });
    }

    // Award credits to the referrer if enabled
    const { data: creditsEnabledSetting } = await supabaseAdmin
      .from('platform_settings')
      .select('value')
      .eq('key', 'referral_credits_enabled')
      .maybeSingle();

    const creditsEnabled = creditsEnabledSetting ? (creditsEnabledSetting.value as boolean) : true;

    if (creditsEnabled) {
      const { data: creditAmountSetting } = await supabaseAdmin
        .from('platform_settings')
        .select('value')
        .eq('key', 'referral_credit_amount')
        .maybeSingle();

      const creditAmount = creditAmountSetting ? (creditAmountSetting.value as number) : 1000;

      const { data: referrerProfile } = await supabaseAdmin
        .from('profiles')
        .select('credits')
        .eq('id', referrer.id)
        .maybeSingle();

      await supabaseAdmin
        .from('profiles')
        .update({ credits: (referrerProfile?.credits ?? 0) + creditAmount })
        .eq('id', referrer.id);
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error('Error claiming referral:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to claim referral' },
      { status: 500 }
    );
  }
}
