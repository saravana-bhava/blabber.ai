import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';
import { createVeriffSession, getVeriffConfig } from '@/lib/veriff-api';

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

    const { data: existingAgency, error: fetchError } = await supabaseAdmin
      .from('agencies')
      .select('*')
      .eq('profile_id', userId)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching agency:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch agency data' }, { status: 500 });
    }

    if (existingAgency?.veriff_verification_status === 'completed') {
      return NextResponse.json({ error: 'Verification already completed' }, { status: 400 });
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
          existingAgency?.veriff_session_id || `admin_kyc_bypass_${userId}`;

        const bypassData: Record<string, any> = {
          profile_id: userId,
          veriff_session_id: adminSessionId,
          veriff_verification_status: 'completed',
          updated_at: new Date().toISOString(),
        };

        if (!existingAgency) {
          bypassData.created_at = new Date().toISOString();
          bypassData.name = name || 'My Agency';
        } else if (name && existingAgency.name !== name) {
          bypassData.name = name;
        }

        const { data: bypassedAgency, error: bypassError } = await supabaseAdmin
          .from('agencies')
          .upsert(bypassData, {
            onConflict: 'profile_id',
            ignoreDuplicates: false,
          })
          .select('*')
          .single();

        if (bypassError) {
          console.error('Error applying admin KYC bypass for agency:', bypassError);
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
          agency: bypassedAgency,
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

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.NEXT_PUBLIC_VERCEL_URL
        ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
        : 'http://localhost:3000');

    const callbackUrl = `${appUrl}/agency-veriff-callback`;

    const veriffSession = await createVeriffSession(veriffConfig, {
      userId,
      callbackUrl,
    });

    const agencyData: Record<string, any> = {
      profile_id: userId,
      veriff_session_id: veriffSession.sessionId,
      veriff_verification_status: 'in_progress',
      updated_at: new Date().toISOString(),
    };

    if (!existingAgency) {
      agencyData.created_at = new Date().toISOString();
      agencyData.name = name || 'My Agency';
    } else if (name && existingAgency.name !== name) {
      agencyData.name = name;
    }

    const { data: upsertedAgency, error: upsertError } = await supabaseAdmin
      .from('agencies')
      .upsert(agencyData, {
        onConflict: 'profile_id',
        ignoreDuplicates: false,
      })
      .select('*')
      .single();

    if (upsertError) {
      console.error('Error upserting agency record:', upsertError);
      return NextResponse.json(
        { error: 'Failed to save agency details', details: upsertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      sessionId: veriffSession.sessionId,
      sessionUrl: veriffSession.sessionUrl,
      sessionToken: veriffSession.sessionToken,
      agency: upsertedAgency,
    });
  } catch (error: any) {
    console.error('Error creating agency Veriff session:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create Veriff session' },
      { status: 500 }
    );
  }
}
