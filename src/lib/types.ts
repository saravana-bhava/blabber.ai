// src/lib/types.ts

export type CreatorOnboardingStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'rejected';

export interface CreatorRow {
  profile_id: string;
  agency_profile_id?: string | null;
  agency_split_pct_override?: number | null;
  is_agency_operated?: boolean;
  veriff_verification_status?: CreatorOnboardingStatus | string;
  can_monetize?: boolean | null;
  can_img_gen?: boolean | null;
  ai_call_enabled?: boolean | null;
  ai_dms_enabled?: boolean | null;
  subscription_price_cents?: number | null;
  subscription_interval?: 'month' | 'year' | null;
  subscription_tier_enabled?: boolean | null;
}

export interface AgencyRow {
  profile_id: string;
  name: string;
  default_split_pct: number;
  veriff_verification_status?: CreatorOnboardingStatus | string;
  payment_provider?: string | null;
  solana_address?: string | null;
  ethereum_address?: string | null;
  polygon_address?: string | null;
  bitcoin_address?: string | null;
  bank_account_number?: string | null;
  bank_routing_number?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AffiliateProfileRow {
  profile_id: string;
  name: string;
  veriff_session_id?: string | null;
  veriff_status?: CreatorOnboardingStatus | string;
  veriff_estimated_age?: number | null;
  commission_pct_1: number;
  commission_pct_2: number;
  payment_provider?: string | null;
  solana_address?: string | null;
  ethereum_address?: string | null;
  polygon_address?: string | null;
  bitcoin_address?: string | null;
  bank_account_number?: string | null;
  bank_routing_number?: string | null;
  created_at?: string;
  updated_at?: string;
}

// Re-using and extending existing Profile type if available from previous work
// For example, from src/app/u/[username]/page.tsx
export interface Profile {
  id: string;
  updated_at?: string;
  full_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  banner_url?: string | null;
  bio?: string | null;
  website?: string | null;
  location?: string | null;
  credits?: number | null;
  hasUnreadMsg?: boolean;
  isAdmin?: boolean;
  isBanned?: boolean;
  isAllAccess?: boolean;
  /** False until the multi-step intro modal is finished or skipped (server flag, once per account). */
  has_completed_intro_onboarding?: boolean;
  referral_code?: string | null;
  referred_by_profile_id?: string | null;
}

export type PostContentType = 'text_only' | 'image' | 'video' | 'carousel' | 'poll' | 'quiz' | 'live_stream';
export type PostAccessLevel = 'public' | 'subscribers_only' | 'ppv';
export type MediaItemType = 'image' | 'video' | 'live_stream' | 'short';

export interface MediaMetadata {
  width?: number;
  height?: number;
  duration?: number;
  status?: 'live' | 'ended';
  connected_at?: string;
  disconnected_at?: string;
  rtmp_url?: string;
  active_asset_id?: string;
  asset_playback_id?: string;
  aspect_ratio?: number; // Height/width ratio as a percentage (e.g., 56.25 for 16:9)
}

export interface PostMedia {
  id: string;
  media_type: MediaItemType;
  storage_path?: string | null; // For Supabase stored images
  mux_asset_id?: string | null; // For Mux asset ID
  mux_playback_id?: string | null; // For Mux videos
  mux_upload_id?: string | null; // For Mux direct upload ID
  mux_stream_id?: string | null; // For Mux live streams
  mux_stream_key?: string | null; // For Mux live streams
  alt_text?: string | null;
  order_index: number;
  metadata?: MediaMetadata | null;
  blurred_storage_path?: string | null; // For blurred version of non-public media
  width?: number; // Added: direct width from post_media table
  height?: number; // Added: direct height from post_media table
  // other fields from your post_media table if needed for display
}

// New type for individual poll option results
export interface PollOptionResult {
  option_id: string;
  vote_count: number;
}

// New type for user's quiz attempt details
export interface UserQuizAttempt {
  selectedOptionId: string;
  isCorrect: boolean;
}

export interface Post {
  id: string;
  user_id: string;
  created_at: string; // ISO date string
  updated_at: string;
  content_type: PostContentType;
  text_content?: string | null;
  tags?: string[] | null;
  category?: string | null;
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
  access_level: PostAccessLevel;
  ppv_price_cents?: number | null;
  metadata?: any | null; // For polls, quizzes etc. (contains question and options definitions)
  bookmark_count: number;

  // Joined data for interactions & results
  poll_results?: PollOptionResult[];    // For polls: all vote counts for each option
  user_poll_vote?: string | null;      // For polls: the option_id the current user voted for
  user_quiz_attempt?: UserQuizAttempt | null; // For quizzes: the current user's previous attempt
  user_has_liked: boolean;
  user_has_bookmarked: boolean;

  // Joined data
  profiles: Profile; // Creator's profile, non-nullable as we'll inner join
  post_media: PostMedia[]; // Array of media items, could be empty
  creator?: {
    profile_id: string;
    subscription_tier_enabled: boolean;
    subscription_price_cents: number | null;
    subscription_interval: 'month' | 'year' | null;
  } | null;
}

export interface CommentType {
  id: string;
  post_id: string;
  user_id: string;
  text_content: string;
  created_at: string;
  parent_comment_id?: string | null;
  profiles: Profile; // Commenter's profile
  like_count: number;
  user_has_liked_comment?: boolean;
  reply_count: number;
  parent_username?: string | null;
  replies?: CommentType[];
}

export interface Payout {
  id: string;
  creator_profile_id: string;
  amount_cents: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  payout_method?: 'solana' | 'ethereum' | 'polygon' | 'bitcoin' | 'bank' | null;
  solana_address?: string | null;
  ethereum_address?: string | null;
  polygon_address?: string | null;
  bitcoin_address?: string | null;
  bank_account_number?: string | null;
  bank_routing_number?: string | null;
  provider_transaction_reference?: string | null;
  blockchain_tx_hash?: string | null;
  provider_specific_details?: any | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
} 