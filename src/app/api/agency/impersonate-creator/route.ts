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

    const body = await request.json();
    const creatorProfileId: string | undefined = body.creator_profile_id;
    if (!creatorProfileId) {
      return NextResponse.json({ error: 'creator_profile_id is required' }, { status: 400 });
    }

    const admin = createServiceRoleClient();

    const { data: creator, error: creatorErr } = await admin
      .from('creators')
      .select('profile_id, agency_profile_id, is_agency_operated')
      .eq('profile_id', creatorProfileId)
      .maybeSingle();

    if (creatorErr) {
      console.error('creator lookup failed', creatorErr);
      return NextResponse.json({ error: 'Failed to look up creator' }, { status: 500 });
    }
    if (!creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
    }
    if (creator.agency_profile_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!creator.is_agency_operated) {
      return NextResponse.json(
        { error: 'Creator is not in operated mode' },
        { status: 403 }
      );
    }

    const { data: targetUser, error: targetErr } = await admin.auth.admin.getUserById(creatorProfileId);
    if (targetErr || !targetUser?.user?.email) {
      return NextResponse.json({ error: 'Could not resolve creator email' }, { status: 500 });
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.NEXT_PUBLIC_VERCEL_URL
        ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
        : 'http://localhost:3000');

    // Email magic links use token_hash + type (verifyOtp), not PKCE ?code=.
    // /auth/confirm handles that; /auth/callback only handles OAuth/code exchange.
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: targetUser.user.email,
      options: {
        redirectTo: `${appUrl}/auth/confirm?next=${encodeURIComponent('/creator-dashboard')}`,
      },
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error('generateLink failed', linkError);
      return NextResponse.json({ error: linkError?.message || 'Failed to generate magic link' }, { status: 500 });
    }

    return NextResponse.json({ action_link: linkData.properties.action_link });
  } catch (error: any) {
    console.error('impersonate-creator error', error);
    return NextResponse.json({ error: error.message || 'Failed to impersonate creator' }, { status: 500 });
  }
}
