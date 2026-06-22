import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

type ActionConfig = {
  maxRequests: number;
  windowSeconds: number;
};

// Per-action limits. Adjust as needed.
const ACTION_LIMITS: Record<string, ActionConfig> = {
  clone_voice:       { maxRequests: 5,   windowSeconds: 86400 }, // 5 per day
  ai_call_session:   { maxRequests: 20,  windowSeconds: 3600  }, // 20 per hour
  image_gen:         { maxRequests: 30,  windowSeconds: 3600  }, // 30 per hour
  get_response:      { maxRequests: 100, windowSeconds: 3600  }, // 100 per hour
  image_description: { maxRequests: 60,  windowSeconds: 3600  }, // 60 per hour
  veriff_session:    { maxRequests: 5,   windowSeconds: 86400 }, // 5 per day
};

/**
 * Checks the rate limit for a given user + action using the
 * check_rate_limit() Postgres RPC.
 *
 * Returns a 429 NextResponse if the limit is exceeded,
 * or null if the request is allowed.
 */
export async function checkRateLimit(
  userId: string,
  action: string,
): Promise<NextResponse | null> {
  const config = ACTION_LIMITS[action];
  if (!config) return null;

  const admin = createServiceRoleClient();
  const { data, error } = await admin.rpc('check_rate_limit', {
    p_user_id:        userId,
    p_action:         action,
    p_max_requests:   config.maxRequests,
    p_window_seconds: config.windowSeconds,
  });

  if (error) {
    // Fail open — a broken rate limiter should not block users
    console.error(`rate-limit: RPC error for action "${action}":`, error);
    return null;
  }

  if (data === false) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 },
    );
  }

  return null; // allowed
}
