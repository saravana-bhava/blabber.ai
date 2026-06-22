import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isEmailConfirmed } from '@/lib/auth/email-confirmed';
import { isPublicPath } from '@/lib/auth/public-routes';

/**
 * Keeps Supabase auth cookies in sync between browser and server on every navigation.
 * Redirects unauthenticated users away from protected app routes before the page renders.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/')) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  const isAuthenticated = !error && !!user && isEmailConfirmed(user);

  if (!isAuthenticated && !isPublicPath(pathname)) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = '/login';
    signInUrl.search = '';
    return NextResponse.redirect(signInUrl);
  }

  if (isAuthenticated && user) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('"isBanned"')
      .eq('id', user.id)
      .single();
    if (profileData?.isBanned) {
      await supabase.auth.signOut();
      const signInUrl = request.nextUrl.clone();
      signInUrl.pathname = '/login';
      signInUrl.search = '';
      return NextResponse.redirect(signInUrl);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
