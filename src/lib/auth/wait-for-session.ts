import type { SupabaseClient } from '@supabase/supabase-js';

/** Wait until the browser client sees a session after setSession / verifyOtp. */
export async function waitForClientSession(
  supabase: SupabaseClient,
  maxAttempts = 15,
  delayMs = 100
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) return true;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}
