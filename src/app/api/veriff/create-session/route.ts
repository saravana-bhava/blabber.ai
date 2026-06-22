import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';
import { createVeriffSession, getVeriffConfig } from '@/lib/veriff-api';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const supabaseAdmin = createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { persistSession: false } }
  );

  try {
    const { userId, username } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const rateLimitResponse = await checkRateLimit(userId, 'veriff_session');
    if (rateLimitResponse) return rateLimitResponse;

    const { data: existingCreator, error: fetchError } = await supabaseAdmin
      .from('creators')
      .select('*')
      .eq('profile_id', userId)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching creator:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch creator data' },
        { status: 500 }
      );
    }

    if (existingCreator?.veriff_verification_status === 'completed') {
      return NextResponse.json(
        { error: 'Verification already completed' },
        { status: 400 }
      );
    }

    // Admin KYC bypass: if the authenticated session belongs to the same user
    // and that user is an admin, mark verification as completed without Veriff.
    const cookieStore = await cookies();
    const supabaseSession = createServerSupabaseClient(cookieStore);
    const {
      data: { session },
    } = await supabaseSession.auth.getSession();

    if (session?.user?.id === userId) {
      const { data: callerProfile } = await supabaseAdmin
        .from('profiles')
        .select('isAdmin')
        .eq('id', userId)
        .maybeSingle();

      if (callerProfile?.isAdmin) {
        const adminSessionId =
          existingCreator?.veriff_session_id || `admin_kyc_bypass_${userId}`;

        const bypassData: any = {
          profile_id: userId,
          veriff_session_id: adminSessionId,
          veriff_verification_status: 'completed',
          can_monetize: true,
          updated_at: new Date().toISOString(),
        };

        if (!existingCreator) {
          bypassData.created_at = new Date().toISOString();
          bypassData.payment_provider = 'veriff';
          bypassData.subscription_tier_enabled = true;
          bypassData.subscription_price_cents = 500;
          bypassData.subscription_interval = 'month';
        }

        const { data: bypassedCreator, error: bypassError } = await supabaseAdmin
          .from('creators')
          .upsert(bypassData, {
            onConflict: 'profile_id',
            ignoreDuplicates: false,
          })
          .select('*')
          .single();

        if (bypassError) {
          console.error('Error applying admin KYC bypass for creator:', bypassError);
          return NextResponse.json(
            {
              error: 'Failed to apply admin KYC bypass',
              details: bypassError.message,
            },
            { status: 500 }
          );
        }

        return NextResponse.json({
          bypassed: true,
          creator: bypassedCreator,
        });
      }
    }

    let veriffConfig;
    try {
      veriffConfig = getVeriffConfig();
    } catch (error: any) {
      return NextResponse.json(
        { error: `Veriff credentials not configured: ${error.message}` },
        { status: 500 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : 'http://localhost:3000');

    const callbackUrl = `${appUrl}/veriff-callback`;

    const veriffSession = await createVeriffSession(veriffConfig, {
      userId,
      callbackUrl,
    });

    const creatorData: any = {
      profile_id: userId,
      veriff_session_id: veriffSession.sessionId,
      veriff_verification_status: 'in_progress',
      can_monetize: false,
      updated_at: new Date().toISOString(),
    };

    if (!existingCreator) {
      creatorData.created_at = new Date().toISOString();
      creatorData.payment_provider = 'veriff';
    }

    const { data: upsertedCreator, error: upsertError } = await supabaseAdmin
      .from('creators')
      .upsert(creatorData, {
        onConflict: 'profile_id',
        ignoreDuplicates: false,
      })
      .select('*')
      .single();

    if (upsertError) {
      console.error('Error upserting creator record:', upsertError);
      return NextResponse.json(
        { error: 'Failed to save creator details', details: upsertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      sessionId: veriffSession.sessionId,
      sessionUrl: veriffSession.sessionUrl,
      sessionToken: veriffSession.sessionToken,
      creator: upsertedCreator,
    });
  } catch (error: any) {
    console.error('Error creating Veriff session:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create Veriff session' },
      { status: 500 }
    );
  }
}
