import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';
import { createVeriffSession, getVeriffConfig } from '@/lib/veriff-api';

function generateReferralCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => chars[b % 36]).join('');
}

export async function POST(request: Request) {
  const supabaseAdmin = createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { persistSession: false } }
  );

  try {
    const { userId, name } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('affiliate_profiles')
      .select('*')
      .eq('profile_id', userId)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      return NextResponse.json({ error: 'Failed to fetch affiliate data' }, { status: 500 });
    }

    if (existing?.veriff_status === 'completed') {
      return NextResponse.json({ error: 'Verification already completed' }, { status: 400 });
    }

    // Admin or KYC-disabled bypass
    const cookieStore = await cookies();
    const supabaseSession = createServerSupabaseClient(cookieStore);
    const { data: { session } } = await supabaseSession.auth.getSession();

    let kycRequired = true;
    const { data: settingRow } = await supabaseAdmin
      .from('platform_settings')
      .select('value')
      .eq('key', 'affiliate_require_kyc')
      .maybeSingle();
    if (settingRow) kycRequired = settingRow.value as boolean;

    const isAdmin = session?.user?.id === userId && (() => {
      // checked below via profile query
      return false;
    })();

    let callerIsAdmin = false;
    if (session?.user?.id === userId) {
      const { data: callerProfile } = await supabaseAdmin
        .from('profiles')
        .select('isAdmin')
        .eq('id', userId)
        .maybeSingle();
      callerIsAdmin = !!callerProfile?.isAdmin;
    }

    const shouldBypass = callerIsAdmin || !kycRequired;

    if (shouldBypass) {
      const bypassData: Record<string, unknown> = {
        profile_id: userId,
        veriff_session_id: existing?.veriff_session_id || `bypass_${userId}`,
        veriff_status: 'completed',
        updated_at: new Date().toISOString(),
      };
      if (!existing) {
        bypassData.created_at = new Date().toISOString();
        bypassData.name = name || 'My Affiliate';
      } else if (name && existing.name !== name) {
        bypassData.name = name;
      }

      const { data: bypassed, error: bypassError } = await supabaseAdmin
        .from('affiliate_profiles')
        .upsert(bypassData, { onConflict: 'profile_id', ignoreDuplicates: false })
        .select('*')
        .single();

      if (bypassError) {
        return NextResponse.json({ error: 'Failed to apply bypass', details: bypassError.message }, { status: 500 });
      }

      return NextResponse.json({ bypassed: true, affiliate: bypassed });
    }

    // Ensure the user's profile has a referral_code (backfill if missing)
    const { data: profileRow } = await supabaseAdmin
      .from('profiles')
      .select('referral_code')
      .eq('id', userId)
      .maybeSingle();

    if (!profileRow?.referral_code) {
      let code = generateReferralCode();
      let attempts = 0;
      while (attempts < 10) {
        const { data: clash } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('referral_code', code)
          .maybeSingle();
        if (!clash) break;
        code = generateReferralCode();
        attempts++;
      }
      await supabaseAdmin.from('profiles').update({ referral_code: code }).eq('id', userId);
    }

    let veriffConfig;
    try {
      veriffConfig = getVeriffConfig();
    } catch (error: unknown) {
      return NextResponse.json(
        { error: `Veriff credentials not configured: ${error instanceof Error ? error.message : 'unknown'}` },
        { status: 500 }
      );
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.NEXT_PUBLIC_VERCEL_URL
        ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
        : 'http://localhost:3000');

    const veriffSession = await createVeriffSession(veriffConfig, {
      userId,
      callbackUrl: `${appUrl}/affiliate-veriff-callback`,
    });

    const affiliateData: Record<string, unknown> = {
      profile_id: userId,
      veriff_session_id: veriffSession.sessionId,
      veriff_status: 'in_progress',
      updated_at: new Date().toISOString(),
    };

    if (!existing) {
      affiliateData.created_at = new Date().toISOString();
      affiliateData.name = name || 'My Affiliate';
    } else if (name && existing.name !== name) {
      affiliateData.name = name;
    }

    const { data: upserted, error: upsertError } = await supabaseAdmin
      .from('affiliate_profiles')
      .upsert(affiliateData, { onConflict: 'profile_id', ignoreDuplicates: false })
      .select('*')
      .single();

    if (upsertError) {
      return NextResponse.json({ error: 'Failed to save affiliate details', details: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({
      sessionId: veriffSession.sessionId,
      sessionUrl: veriffSession.sessionUrl,
      sessionToken: veriffSession.sessionToken,
      affiliate: upserted,
    });
  } catch (error: unknown) {
    console.error('Error creating affiliate Veriff session:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create Veriff session' },
      { status: 500 }
    );
  }
}
