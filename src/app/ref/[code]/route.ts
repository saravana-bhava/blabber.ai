import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const response = NextResponse.redirect(new URL('/login?mode=signup', request.url));
  response.cookies.set('blabber_ref', code, {
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
  });
  return response;
}
