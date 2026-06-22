import type { SupabaseClient, User } from '@supabase/supabase-js';

function generateRandomString(length: number) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

/** Open redirect guard for `next` after auth. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) {
    return '/home';
  }
  return next;
}

/**
 * Server-side referral attribution.
 * Returns true when the cookie should be cleared (claimed or already attributed).
 * Returns false when something went wrong and the cookie should be kept for retry.
 */
async function claimReferralServerSide(
  serviceRole: SupabaseClient,
  userId: string,
  referralCode: string
): Promise<boolean> {
  const code = referralCode.trim().toLowerCase();
  if (!code) return false;

  // 1. Look up the referrer by code
  const { data: referrer, error: referrerErr } = await serviceRole
    .from('profiles')
    .select('id, credits')
    .eq('referral_code', code)
    .maybeSingle();

  if (referrerErr) {
    console.error('[referral] referrer lookup error', referrerErr);
    return false;
  }
  if (!referrer) {
    console.warn('[referral] code not found:', code);
    return false; // invalid code — keep cookie in case it's a timing issue
  }
  if (referrer.id === userId) {
    console.warn('[referral] self-referral attempt by', userId);
    return true; // clear the cookie
  }

  // 2. Check if user already has attribution
  const { data: userProfile, error: profileErr } = await serviceRole
    .from('profiles')
    .select('referred_by_profile_id')
    .eq('id', userId)
    .maybeSingle();

  if (profileErr) {
    console.error('[referral] user profile lookup error', profileErr);
    return false;
  }
  if (!userProfile) {
    // Profile doesn't exist yet — bootstrap insert may not have committed
    console.warn('[referral] profile row not found for user', userId);
    return false; // keep cookie
  }
  if (userProfile.referred_by_profile_id) {
    // Already attributed — idempotent clear
    return true;
  }

  // 3. Write attribution
  const { error: updateErr } = await serviceRole
    .from('profiles')
    .update({ referred_by_profile_id: referrer.id })
    .eq('id', userId);

  if (updateErr) {
    console.error('[referral] attribution write failed', updateErr);
    return false;
  }

  console.log('[referral] attributed user', userId, 'to referrer', referrer.id);

  // 4. Award credits to the referrer
  try {
    const { data: settings } = await serviceRole
      .from('platform_settings')
      .select('key, value')
      .in('key', ['referral_credits_enabled', 'referral_credit_amount']);

    const map = Object.fromEntries((settings ?? []).map((s) => [s.key, s.value]));
    if (map.referral_credits_enabled === false) return true;

    const creditAmount = typeof map.referral_credit_amount === 'number' ? map.referral_credit_amount : 1000;

    const { error: creditErr } = await serviceRole
      .from('profiles')
      .update({ credits: (referrer.credits ?? 0) + creditAmount })
      .eq('id', referrer.id);

    if (creditErr) {
      console.error('[referral] credit award failed', creditErr);
    } else {
      console.log('[referral] awarded', creditAmount, 'credits to referrer', referrer.id);
    }
  } catch (e) {
    console.error('[referral] credit award exception', e);
  }

  return true;
}

/**
 * After a successful session exchange, ensure profiles + agency-invited creators rows exist.
 * Optionally claims a referral code passed by the caller (read from blabber_ref cookie).
 * Returns referralClaimed=true when the caller should delete the blabber_ref cookie.
 */
export async function bootstrapAuthUserResources(
  supabase: SupabaseClient,
  serviceRole: SupabaseClient,
  user: User,
  referralCode?: string | null
): Promise<{ referralClaimed: boolean }> {
  const { data: existingProfile, error: profileError } = await supabase
    .from('profiles')
    .select('id, referral_code, referred_by_profile_id')
    .eq('id', user.id)
    .single();

  // Backfill referral_code for existing users who pre-date the migration
  if (existingProfile && !existingProfile.referral_code) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * 36)]).join('');
    for (let i = 0; i < 5; i++) {
      const { data: clash } = await serviceRole
        .from('profiles')
        .select('id')
        .eq('referral_code', code)
        .maybeSingle();
      if (!clash) break;
      code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * 36)]).join('');
    }
    await serviceRole.from('profiles').update({ referral_code: code }).eq('id', user.id);
  }

  if (profileError?.code === 'PGRST116') {
    const username = generateRandomString(16);
    const fullName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.user_metadata?.display_name ||
      'User';

    const { error: insertError } = await serviceRole.from('profiles').insert({
      id: user.id,
      username,
      full_name: fullName,
      avatar_url: user.user_metadata?.avatar_url ?? null,
      credits: 100,
      has_completed_intro_onboarding: false,
    });

    if (insertError) {
      console.error('bootstrapAuthUserResources: profile insert failed', insertError);
    }
  }

  // Server-side referral claim — runs after profile is guaranteed to exist
  let referralClaimed = false;
  if (referralCode && !existingProfile?.referred_by_profile_id) {
    referralClaimed = await claimReferralServerSide(serviceRole, user.id, referralCode);
  }

  const invitedAgencyId: string | undefined = user.user_metadata?.agency_profile_id;
  if (!invitedAgencyId) {
    return { referralClaimed };
  }

  try {
    const splitOverride = user.user_metadata?.agency_split_pct_override;
    const { data: existingCreator } = await serviceRole
      .from('creators')
      .select('profile_id, agency_profile_id')
      .eq('profile_id', user.id)
      .maybeSingle();

    if (!existingCreator) {
      const { error: creatorInsertError } = await serviceRole.from('creators').insert({
        profile_id: user.id,
        agency_profile_id: invitedAgencyId,
        agency_split_pct_override:
          splitOverride !== undefined && splitOverride !== null ? Number(splitOverride) : null,
        is_agency_operated: false,
        veriff_verification_status: 'not_started',
        can_monetize: false,
        payment_provider: 'veriff',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (creatorInsertError) {
        console.error('bootstrapAuthUserResources: creators insert failed', creatorInsertError);
      }
    } else if (!existingCreator.agency_profile_id) {
      const { error: linkError } = await serviceRole
        .from('creators')
        .update({
          agency_profile_id: invitedAgencyId,
          agency_split_pct_override:
            splitOverride !== undefined && splitOverride !== null ? Number(splitOverride) : null,
          updated_at: new Date().toISOString(),
        })
        .eq('profile_id', user.id);
      if (linkError) {
        console.error('bootstrapAuthUserResources: agency link failed', linkError);
      }
    }
  } catch (e) {
    console.error('bootstrapAuthUserResources: agency metadata error', e);
  }

  return { referralClaimed };
}
