import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Returns a 403 NextResponse if `adminTestBypass` is requested but the user is not an admin. */
export async function assertAdminTestBypassAllowed(
  supabase: SupabaseClient,
  userId: string,
  adminTestBypass: unknown
): Promise<NextResponse | null> {
  if (!adminTestBypass) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('isAdmin')
    .eq('id', userId)
    .maybeSingle();
  if (!profile?.isAdmin) {
    return NextResponse.json(
      { error: 'Admin test bypass is not allowed for this account' },
      { status: 403 }
    );
  }
  return null;
}
