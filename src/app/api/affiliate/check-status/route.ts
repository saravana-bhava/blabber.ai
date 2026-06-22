import { NextResponse } from 'next/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { getVeriffDecision, processVeriffDecision, getVeriffConfig } from '@/lib/veriff-api';

export async function POST(request: Request) {
  const supabaseAdmin = createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { persistSession: false } }
  );

  try {
    const { userId, sessionId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const { data: affiliate, error: affiliateError } = await supabaseAdmin
      .from('affiliate_profiles')
      .select('*')
      .eq('profile_id', userId)
      .maybeSingle();

    if (affiliateError) {
      return NextResponse.json({ error: 'Failed to fetch affiliate data' }, { status: 500 });
    }

    if (!affiliate) {
      return NextResponse.json({ error: 'Affiliate not found' }, { status: 404 });
    }

    if (sessionId && affiliate.veriff_session_id !== sessionId) {
      return NextResponse.json({ error: 'Session ID mismatch' }, { status: 403 });
    }

    if (affiliate.veriff_session_id) {
      try {
        const veriffConfig = getVeriffConfig();
        const decision = await getVeriffDecision(veriffConfig, affiliate.veriff_session_id);

        if (decision.status !== 'pending') {
          const results = processVeriffDecision({
            status: decision.status,
            code: decision.code,
            estimatedAge: decision.estimatedAge,
            dateOfBirth: decision.dateOfBirth,
          });

          await supabaseAdmin
            .from('affiliate_profiles')
            .update({
              veriff_status: results.verificationStatus,
              veriff_estimated_age: results.resolvedAge ?? decision.estimatedAge,
              veriff_results: decision.rawVerification,
              updated_at: new Date().toISOString(),
            })
            .eq('profile_id', affiliate.profile_id);

          return NextResponse.json({
            verification_status: results.verificationStatus,
            estimated_age: decision.estimatedAge,
            is_over_18: results.isOver18,
            decision_code: decision.code,
            session_id: affiliate.veriff_session_id,
          });
        }
      } catch (error) {
        console.error('Error fetching from Veriff API, falling back to database:', error);
      }
    }

    return NextResponse.json({
      verification_status: affiliate.veriff_status,
      estimated_age: affiliate.veriff_estimated_age,
      session_id: affiliate.veriff_session_id,
    });
  } catch (error: unknown) {
    console.error('Error checking affiliate Veriff status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check verification status' },
      { status: 500 }
    );
  }
}
