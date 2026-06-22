import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

function generateOperatedEmail(agencyId: string, username: string) {
  const domain = process.env.AGENCY_OPERATED_EMAIL_DOMAIN || 'agency-operated.blabber.local';
  const safeUser = username.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'creator';
  const suffix = crypto.randomBytes(4).toString('hex');
  return `${safeUser}.${agencyId.slice(0, 8)}.${suffix}@${domain}`;
}

function generatePassword() {
  return crypto.randomBytes(32).toString('base64url');
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createServiceRoleClient();

    const { data: agency, error: agencyError } = await admin
      .from('agencies')
      .select('profile_id, default_split_pct, veriff_verification_status')
      .eq('profile_id', user.id)
      .maybeSingle();

    if (agencyError) {
      console.error('agency lookup failed', agencyError);
      return NextResponse.json({ error: 'Failed to verify agency' }, { status: 500 });
    }
    if (!agency) {
      return NextResponse.json({ error: 'You must be a verified agency' }, { status: 403 });
    }
    if (agency.veriff_verification_status !== 'completed') {
      return NextResponse.json(
        { error: 'Agency verification must be completed before creating operated creators' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const fullName: string = body.full_name?.trim();
    const username: string = body.username?.trim();
    const splitOverrideRaw = body.agency_split_pct_override;

    if (!fullName || !username) {
      return NextResponse.json({ error: 'full_name and username are required' }, { status: 400 });
    }

    let splitOverride: number | null = null;
    if (splitOverrideRaw !== undefined && splitOverrideRaw !== null && splitOverrideRaw !== '') {
      const n = Number(splitOverrideRaw);
      if (Number.isNaN(n) || n < 0 || n > 100) {
        return NextResponse.json({ error: 'Split override must be between 0 and 100' }, { status: 400 });
      }
      splitOverride = n;
    }

    // Make sure username is free
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle();
    if (existingProfile) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
    }

    const email = generateOperatedEmail(agency.profile_id, username);
    const password = generatePassword();

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        username,
        agency_profile_id: agency.profile_id,
        is_agency_operated: true,
      },
    });

    if (createError || !created.user) {
      console.error('createUser failed', createError);
      return NextResponse.json(
        { error: createError?.message || 'Failed to create operated user' },
        { status: 500 }
      );
    }

    const newUserId = created.user.id;

    // Supabase commonly has a DB trigger (handle_new_user) that INSERTs into profiles
    // when auth.users gets a row. Use upsert so we don't hit duplicate profiles_pkey (23505).
    const { error: profileUpsertError } = await admin
      .from('profiles')
      .upsert(
        {
          id: newUserId,
          username,
          full_name: fullName,
          credits: 0,
          has_completed_intro_onboarding: true,
        },
        { onConflict: 'id' }
      );

    if (profileUpsertError) {
      console.error('profile upsert failed', profileUpsertError);
      await admin.auth.admin.deleteUser(newUserId);
      return NextResponse.json({ error: 'Failed to create operated profile' }, { status: 500 });
    }

    const { error: creatorInsertError } = await admin.from('creators').insert({
      profile_id: newUserId,
      agency_profile_id: agency.profile_id,
      agency_split_pct_override: splitOverride,
      is_agency_operated: true,
      veriff_verification_status: 'completed',
      veriff_session_id: `agency_operated_${newUserId}`,
      can_monetize: true,
      payment_provider: 'veriff',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (creatorInsertError) {
      console.error('creator insert failed', creatorInsertError);
      return NextResponse.json({ error: 'Failed to create operated creator row' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      creator_profile_id: newUserId,
      email,
    });
  } catch (error: any) {
    console.error('create-operated-creator error', error);
    return NextResponse.json({ error: error.message || 'Failed to create operated creator' }, { status: 500 });
  }
}
