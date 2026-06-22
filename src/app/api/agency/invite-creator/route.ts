import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

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
      .select('profile_id, default_split_pct, name, veriff_verification_status')
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
        { error: 'Agency verification must be completed before inviting creators' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const email: string | undefined = body.email?.trim();
    const fullName: string | undefined = body.full_name?.trim();
    const splitOverrideRaw = body.agency_split_pct_override;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    let splitOverride: number | null = null;
    if (splitOverrideRaw !== undefined && splitOverrideRaw !== null && splitOverrideRaw !== '') {
      const n = Number(splitOverrideRaw);
      if (Number.isNaN(n) || n < 0 || n > 100) {
        return NextResponse.json({ error: 'Split override must be between 0 and 100' }, { status: 400 });
      }
      splitOverride = n;
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.NEXT_PUBLIC_VERCEL_URL
        ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
        : 'http://localhost:3000');

    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: {
        agency_profile_id: agency.profile_id,
        agency_split_pct_override: splitOverride,
        full_name: fullName,
        invited_by_agency_name: agency.name,
      },
      redirectTo: `${appUrl}/auth/confirm?next=${encodeURIComponent('/become-a-creator')}`,
    });

    if (inviteError) {
      console.error('invite failed', inviteError);
      return NextResponse.json({ error: inviteError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, user: invited.user });
  } catch (error: any) {
    console.error('invite-creator error', error);
    return NextResponse.json({ error: error.message || 'Failed to invite creator' }, { status: 500 });
  }
}
