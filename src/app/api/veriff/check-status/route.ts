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
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const { data: creator, error: creatorError } = await supabaseAdmin
      .from('creators')
      .select('*')
      .eq('profile_id', userId)
      .maybeSingle();

    if (creatorError) {
      console.error('Error fetching creator:', creatorError);
      return NextResponse.json(
        { error: 'Failed to fetch creator data' },
        { status: 500 }
      );
    }

    if (!creator) {
      return NextResponse.json(
        { error: 'Creator not found' },
        { status: 404 }
      );
    }

    if (sessionId && creator.veriff_session_id !== sessionId) {
      return NextResponse.json(
        { error: 'Session ID mismatch' },
        { status: 403 }
      );
    }

    if (creator.veriff_session_id) {
      try {
        const veriffConfig = getVeriffConfig();
        const decision = await getVeriffDecision(veriffConfig, creator.veriff_session_id);

        // Decision API returns verification:null for Full Auto sessions —
        // fall through to DB values which the Full Auto webhook populates.
        if (decision.status !== 'pending') {
          const results = processVeriffDecision({
            status: decision.status,
            code: decision.code,
            estimatedAge: decision.estimatedAge,
            dateOfBirth: decision.dateOfBirth,
          });

          const updateData: any = {
            veriff_verification_status: results.verificationStatus,
            can_monetize: results.canMonetize,
            updated_at: new Date().toISOString(),
            veriff_estimated_age: results.resolvedAge ?? decision.estimatedAge,
            veriff_verification_results: decision.rawVerification,
          };

          await supabaseAdmin
            .from('creators')
            .update(updateData)
            .eq('profile_id', creator.profile_id);

          return NextResponse.json({
            verification_status: results.verificationStatus,
            can_monetize: results.canMonetize,
            estimated_age: decision.estimatedAge,
            is_over_18: results.isOver18,
            decision_code: decision.code,
            session_id: creator.veriff_session_id,
          });
        }

      } catch (error) {
        console.error('Error fetching from Veriff API, falling back to database:', error);
      }
    }

    return NextResponse.json({
      verification_status: creator.veriff_verification_status,
      can_monetize: creator.can_monetize,
      estimated_age: creator.veriff_estimated_age,
      session_id: creator.veriff_session_id,
    });
  } catch (error: any) {
    console.error('Error checking Veriff status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check verification status' },
      { status: 500 }
    );
  }
}
