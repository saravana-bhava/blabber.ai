import { createClient } from '@/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface CommunicationItem {
  timestamp: string;
  content: string;
  is_user: boolean;
  is_call_transcript: boolean;
}

async function getCommunicationHistoryWithClient(
  supabase: SupabaseClient,
  userId: string,
  targetProfileId: string,
  limit: number
): Promise<CommunicationItem[]> {
  const { data: combinedData, error: combinedError } = await supabase
    .rpc('get_combined_communication_history', {
      p_user_id: userId,
      p_target_profile_id: targetProfileId,
      p_limit: limit,
    });

  if (combinedError) {
    console.error('Error fetching communication history:', combinedError);
    return [];
  }

  const formattedHistory: CommunicationItem[] = (combinedData || []).map((item: any) => ({
    timestamp: item.created_at,
    content: item.media_description ? `USER SENT PHOTO: ${item.media_description}` : (item.content || ''),
    is_user: item.type === 'message' ? item.sender_id === userId : item.is_user,
    is_call_transcript: item.type === 'transcript',
  }));

  return formattedHistory.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export { getCommunicationHistoryWithClient };

export async function getCommunicationHistory(
  userId: string,
  targetProfileId: string,
  limit: number = 50
): Promise<CommunicationItem[]> {
  const supabase = createClient();
  return getCommunicationHistoryWithClient(supabase, userId, targetProfileId, limit);
} 