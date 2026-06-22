import { bootstrapAuthUserResources, safeNextPath } from '@/lib/auth/post-auth-bootstrap';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/home';

  if (code) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('auth/callback: exchangeCodeForSession failed', error.message);
      return NextResponse.redirect(`${origin}/auth/auth-code-error`);
    }

    const user = data.user ?? (await supabase.auth.getUser()).data.user;
    if (user) {
      const serviceRoleClient = createServiceRoleClient();
      const refCode = cookieStore.get('blabber_ref')?.value ?? null;
      const { referralClaimed } = await bootstrapAuthUserResources(supabase, serviceRoleClient, user, refCode);

      const safeNext = safeNextPath(next);
      const response = NextResponse.redirect(`${origin}${safeNext}`);
      if (referralClaimed) {
        response.cookies.delete('blabber_ref');
      }
      return response;
    }
  }

  const err = searchParams.get('error');
  const errDesc = searchParams.get('error_description');
  if (err) {
    console.error('auth/callback: OAuth/email redirect error', err, errDesc ?? '');
  } else {
    console.error('auth/callback: missing ?code=');
  }
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
