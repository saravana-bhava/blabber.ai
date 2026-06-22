import { z } from 'zod';

export const profileSchema = z.object({
  id: z.string().uuid(),
  updated_at: z.string().optional(),
  full_name: z.string().nullable().optional(),
  username: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
  banner_url: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  credits: z.number().nullable().optional(),
  hasUnreadMsg: z.boolean().optional(),
  isAdmin: z.boolean().optional(),
  isBanned: z.boolean().optional(),
  isAllAccess: z.boolean().optional(),
  has_completed_intro_onboarding: z.boolean().optional(),
});

export type ParsedProfile = z.infer<typeof profileSchema>;

export const creatorRowSchema = z.object({
  profile_id: z.string().uuid(),
  agency_profile_id: z.string().uuid().nullable().optional(),
  agency_split_pct_override: z.number().nullable().optional(),
  is_agency_operated: z.boolean().optional(),
  veriff_verification_status: z.string().optional(),
  can_monetize: z.boolean().nullable().optional(),
  can_img_gen: z.boolean().nullable().optional(),
  ai_call_enabled: z.boolean().nullable().optional(),
  ai_dms_enabled: z.boolean().nullable().optional(),
  subscription_price_cents: z.number().nullable().optional(),
  subscription_interval: z.enum(['month', 'year']).nullable().optional(),
  subscription_tier_enabled: z.boolean().nullable().optional(),
});

export type ParsedCreatorRow = z.infer<typeof creatorRowSchema>;

export const agencyRowSchema = z.object({
  profile_id: z.string().uuid(),
  name: z.string(),
  default_split_pct: z.number(),
  veriff_verification_status: z.string().optional(),
  payment_provider: z.string().nullable().optional(),
  solana_address: z.string().nullable().optional(),
  ethereum_address: z.string().nullable().optional(),
  polygon_address: z.string().nullable().optional(),
  bitcoin_address: z.string().nullable().optional(),
  bank_account_number: z.string().nullable().optional(),
  bank_routing_number: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type ParsedAgencyRow = z.infer<typeof agencyRowSchema>;
