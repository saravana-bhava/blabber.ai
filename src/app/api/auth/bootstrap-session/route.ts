import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { bootstrapAuthUserResources } from '@/lib/auth/post-auth-bootstrap';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Read referral code: body takes priority (bypasses localhost/127.0.0.1 cookie domain split),
    // fall back to cookie for server-side callers.
    let refCode: string | null = null;
    try {
      const body = await request.json();
      refCode = (typeof body?.referral_code === 'string' && body.referral_code) ? body.referral_code : null;
    } catch {
      // no body or invalid JSON
    }
    if (!refCode) {
      refCode = cookieStore.get('blabber_ref')?.value ?? null;
    }

    console.log('[bootstrap-session] refCode from body:', refCode, '| cookie:', cookieStore.get('blabber_ref')?.value ?? null);
    const admin = createServiceRoleClient();
    const { referralClaimed } = await bootstrapAuthUserResources(supabase, admin, user, refCode);

    const response = NextResponse.json({ ok: true });
    if (referralClaimed) {
      response.cookies.delete('blabber_ref');
    }
    return response;
  } catch (e: unknown) {
    console.error('bootstrap-session error', e);
    return NextResponse.json({ error: 'Bootstrap failed' }, { status: 500 });
  }
}
