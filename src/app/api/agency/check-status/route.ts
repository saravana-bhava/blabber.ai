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

    const { data: agency, error: agencyError } = await supabaseAdmin
      .from('agencies')
      .select('*')
      .eq('profile_id', userId)
      .maybeSingle();

    if (agencyError) {
      console.error('Error fetching agency:', agencyError);
      return NextResponse.json({ error: 'Failed to fetch agency data' }, { status: 500 });
    }

    if (!agency) {
      return NextResponse.json({ error: 'Agency not found' }, { status: 404 });
    }

    if (sessionId && agency.veriff_session_id !== sessionId) {
      return NextResponse.json({ error: 'Session ID mismatch' }, { status: 403 });
    }

    if (agency.veriff_session_id) {
      try {
        const veriffConfig = getVeriffConfig();
        const decision = await getVeriffDecision(veriffConfig, agency.veriff_session_id);

        if (decision.status !== 'pending') {
          const results = processVeriffDecision({
            status: decision.status,
            code: decision.code,
            estimatedAge: decision.estimatedAge,
            dateOfBirth: decision.dateOfBirth,
          });

          const updateData: Record<string, any> = {
            veriff_verification_status: results.verificationStatus,
            updated_at: new Date().toISOString(),
            veriff_estimated_age: results.resolvedAge ?? decision.estimatedAge,
            veriff_verification_results: decision.rawVerification,
          };

          await supabaseAdmin
            .from('agencies')
            .update(updateData)
            .eq('profile_id', agency.profile_id);

          return NextResponse.json({
            verification_status: results.verificationStatus,
            estimated_age: decision.estimatedAge,
            is_over_18: results.isOver18,
            decision_code: decision.code,
            session_id: agency.veriff_session_id,
          });
        }
      } catch (error) {
        console.error('Error fetching from Veriff API, falling back to database:', error);
      }
    }

    return NextResponse.json({
      verification_status: agency.veriff_verification_status,
      estimated_age: agency.veriff_estimated_age,
      session_id: agency.veriff_session_id,
    });
  } catch (error: any) {
    console.error('Error checking agency Veriff status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check verification status' },
      { status: 500 }
    );
  }
}
