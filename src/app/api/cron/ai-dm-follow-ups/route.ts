import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAIResponseWithClient } from '@/lib/ai-dm-response';
import { getCommunicationHistoryWithClient } from '@/lib/utils/communication-history';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * Uses existing env: CRON_SECRET (or ONYX_REBILL_CRON_SECRET), NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SITE_URL or VERCEL_URL, and the voice-ai pipeline
 * uses NEXT_PUBLIC_VOICE_AI_BASE_URL via /api/voice-ai/get-response. No new env required.
 *
 * Call from a cron every hour with header Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET || process.env.ONYX_REBILL_CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const appBaseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');

  const { data: creatorRows, error: creatorError } = await supabaseAdmin
    .from('creators')
    .select('profile_id, personality_prompt')
    .eq('ai_dms_enabled', true)
    .not('personality_prompt', 'is', null);

  if (creatorError || !creatorRows?.length) {
    return NextResponse.json({ ok: true, sent: 0, checked: 0, message: 'No creators with AI DMs enabled' });
  }

  const creatorIds = creatorRows.map((r) => r.profile_id);
  const { data: participantRows, error: partError } = await supabaseAdmin
    .from('conversation_participants')
    .select('conversation_id, user_id')
    .in('user_id', creatorIds);

  if (partError || !participantRows?.length) {
    return NextResponse.json({ ok: true, sent: 0, checked: 0 });
  }

  const uniqueConvoIds = [...new Set(participantRows.map((p) => p.conversation_id))];
  let sent = 0;
  const errors: string[] = [];

  for (const conversationId of uniqueConvoIds) {
    const { data: participants, error: partErr } = await supabaseAdmin
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversationId);

    if (partErr || !participants?.length || participants.length !== 2) continue;

    const [idA, idB] = participants.map((p) => p.user_id);
    const creatorRow = creatorRows.find((c) => c.profile_id === idA || c.profile_id === idB);
    if (!creatorRow?.personality_prompt) continue;

    const creatorId = creatorRow.profile_id;
    const userId = idA === creatorId ? idB : idA;

    const history = await getCommunicationHistoryWithClient(supabaseAdmin, userId, creatorId, 1);
    const latestItem = history[0];
    if (!latestItem?.timestamp) continue;

    const latestMs = new Date(latestItem.timestamp).getTime();
    if (Date.now() - latestMs < TWENTY_FOUR_HOURS_MS) continue;

    const { data: fanProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, username')
      .eq('id', userId)
      .single();

    const userName = fanProfile?.full_name?.trim() || fanProfile?.username || 'there';
    const followUpMessage = `### It's been 24 hours since you and ${userName} have spoke. Given your relationship and conversation history, you are sending a follow up DM to ${userName}.`;

    try {
      await getAIResponseWithClient(
        supabaseAdmin,
        {
          message: followUpMessage,
          creatorId,
          personalityPrompt: creatorRow.personality_prompt,
          conversationId,
          userId,
          userName,
        },
        { appBaseUrl }
      );
      sent++;
    } catch (err) {
      errors.push(`${conversationId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({
    ok: true,
    sent,
    checked: uniqueConvoIds.length,
    errors: errors.length ? errors : undefined,
  });
}
