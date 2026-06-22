import { createServiceRoleClient } from '@/lib/supabase/server';

export type AgencyAttribution = {
  agencyShare: number;
  agencyProfileId: string | null;
};

const ZERO: AgencyAttribution = { agencyShare: 0, agencyProfileId: null };

/**
 * Compute the agency cut (in cents) of a creator's share given an effective
 * agency split percentage. Floored to avoid over-attributing to the agency.
 */
export function computeAgencyAttribution(
  creatorShareCents: number,
  agencyProfileId: string | null,
  effectiveSplitPct: number | null
): AgencyAttribution {
  if (
    !agencyProfileId ||
    effectiveSplitPct === null ||
    effectiveSplitPct === undefined ||
    effectiveSplitPct <= 0 ||
    creatorShareCents <= 0
  ) {
    return ZERO;
  }
  const agencyShare = Math.floor((creatorShareCents * effectiveSplitPct) / 100);
  return {
    agencyShare: Math.max(0, Math.min(agencyShare, creatorShareCents)),
    agencyProfileId,
  };
}

/**
 * Look up the creator's agency (if any) and compute the agency's share of the
 * given creator share. Uses the service-role client so it works with the
 * RLS-protected `agencies` table from server routes.
 */
export async function fetchAgencyAttributionForCreator(
  creatorProfileId: string | null | undefined,
  creatorShareCents: number
): Promise<AgencyAttribution> {
  if (!creatorProfileId || creatorShareCents <= 0) return ZERO;

  try {
    const admin = createServiceRoleClient();
    const { data: creator } = await admin
      .from('creators')
      .select('agency_profile_id, agency_split_pct_override')
      .eq('profile_id', creatorProfileId)
      .maybeSingle();

    if (!creator?.agency_profile_id) return ZERO;

    let effectivePct: number | null =
      creator.agency_split_pct_override !== null &&
      creator.agency_split_pct_override !== undefined
        ? Number(creator.agency_split_pct_override)
        : null;

    if (effectivePct === null) {
      const { data: agency } = await admin
        .from('agencies')
        .select('default_split_pct')
        .eq('profile_id', creator.agency_profile_id)
        .maybeSingle();
      effectivePct = agency?.default_split_pct != null
        ? Number(agency.default_split_pct)
        : 0;
    }

    return computeAgencyAttribution(
      creatorShareCents,
      creator.agency_profile_id,
      effectivePct
    );
  } catch (err) {
    console.error('fetchAgencyAttributionForCreator failed:', err);
    return ZERO;
  }
}
