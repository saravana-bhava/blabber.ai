import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { getAIResponseWithClient } from '@/lib/ai-dm-response';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { conversationId, creatorId, message, userName } = body as {
      conversationId?: string;
      creatorId?: string;
      message?: string;
      userName?: string;
    };

    if (!conversationId || !creatorId || !message?.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: myParticipant, error: participantError } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (participantError || !myParticipant) {
      return NextResponse.json({ error: 'Not a participant in this conversation' }, { status: 403 });
    }

    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('profile_id, ai_dms_enabled, personality_prompt')
      .eq('profile_id', creatorId)
      .maybeSingle();

    if (creatorError || !creator?.ai_dms_enabled) {
      return NextResponse.json({ error: 'AI DMs not enabled for this creator' }, { status: 400 });
    }

    const admin = createServiceRoleClient();
    const result = await getAIResponseWithClient(
      admin,
      {
        message: message.trim(),
        creatorId,
        personalityPrompt: creator.personality_prompt ?? '',
        conversationId,
        userId: user.id,
        userName: userName ?? '',
      },
      {
        appBaseUrl:
          process.env.NEXT_PUBLIC_SITE_URL ||
          (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'),
      }
    );

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error('/api/messages/ai-dm-response', e);
    return NextResponse.json({ error: 'Failed to generate AI response' }, { status: 500 });
  }
}
