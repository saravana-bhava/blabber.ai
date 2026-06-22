import type { SupabaseClient } from '@supabase/supabase-js';
import { getCommunicationHistoryWithClient } from '@/lib/utils/communication-history';
import { fetchVoiceAiGetResponse } from '@/lib/voice-ai/fetch-get-response';

export interface GetAIResponseParams {
  /** The user's message (or special payload e.g. ###TIP 5.00) */
  message: string;
  /** Creator profile id (sender_id of the AI reply) */
  creatorId: string;
  /** Creator's personality prompt for the AI */
  personalityPrompt: string;
  /** Conversation to reply in and update typing state */
  conversationId: string;
  /** User (fan) profile id — used for conversation history and history scope */
  userId: string;
  /** Display name for the user in the AI context (e.g. profile.full_name or username) */
  userName?: string;
}

/**
 * Triggers an AI DM reply via the server (service role).
 * Client cannot insert creator messages or set creator typing state under RLS.
 */
export type AiDmResponseResult = {
  response: string;
  message: { id: string; sender_id: string; content: string | null; created_at: string } | null;
};

export async function getAIResponse(params: GetAIResponseParams): Promise<AiDmResponseResult> {
  const { message, creatorId, conversationId, userName } = params;

  const res = await fetch('/api/messages/ai-dm-response', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversationId,
      creatorId,
      message,
      userName: userName ?? '',
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Failed to get AI response');
  }

  const data = (await res.json()) as AiDmResponseResult;
  return { response: data.response ?? '', message: data.message ?? null };
}

/**
 * Server-side / cron version: same as getAIResponse but uses the provided Supabase client
 * and optional appBaseUrl for calling the voice-ai API (e.g. process.env.NEXT_PUBLIC_SITE_URL).
 */
const DEFAULT_AI_DM_PROMPT =
  'You are a friendly, engaging creator replying to a fan in direct messages. Keep responses concise, warm, and on-brand.';

export async function getAIResponseWithClient(
  supabase: SupabaseClient,
  params: GetAIResponseParams,
  _options?: { appBaseUrl?: string }
): Promise<AiDmResponseResult> {
  const { message, creatorId, personalityPrompt, conversationId, userId, userName } = params;
  const effectivePrompt = personalityPrompt?.trim() || DEFAULT_AI_DM_PROMPT;

  try {
    await supabase
      .from('conversation_participants')
      .update({ is_typing: true })
      .eq('conversation_id', conversationId)
      .eq('user_id', creatorId);

    const { data: promptPrefixData, error: promptPrefixError } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'prompt_prefix')
      .single();

    if (promptPrefixError) console.error('Error fetching prompt prefix:', promptPrefixError);
    const promptPrefix = promptPrefixData?.value || '';
    const conversationHistory = await getCommunicationHistoryWithClient(supabase, userId, creatorId, 200);

    const aiResponseText = await fetchVoiceAiGetResponse({
      creator_prompt: effectivePrompt,
      prompt_prefix: promptPrefix,
      user_name: userName ?? '',
      conversation_history: conversationHistory,
      message,
    });
    let aiResponse = aiResponseText;

    if (typeof aiResponse === 'string' && aiResponse.startsWith('"') && aiResponse.endsWith('"')) {
      try {
        aiResponse = JSON.parse(aiResponse) as string;
      } catch {
        aiResponse = aiResponse.slice(1, -1);
      }
    }
    if (typeof aiResponse === 'string') {
      aiResponse = aiResponse.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
    }

    const { data: newMessage, error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: creatorId,
        content: aiResponse,
      })
      .select()
      .single();

    if (messageError) {
      console.error('Error storing AI response:', messageError);
      throw messageError;
    }

    if (newMessage) {
      await supabase
        .from('conversations')
        .update({
          last_message_id: newMessage.id,
          last_message_at: newMessage.created_at,
        })
        .eq('id', conversationId);
    }

    await supabase
      .from('conversation_participants')
      .update({ is_typing: false })
      .eq('conversation_id', conversationId)
      .eq('user_id', creatorId);

    return {
      response: aiResponse,
      message: newMessage
        ? {
            id: newMessage.id,
            sender_id: newMessage.sender_id,
            content: newMessage.content,
            created_at: newMessage.created_at,
          }
        : null,
    };
  } catch (error) {
    await supabase
      .from('conversation_participants')
      .update({ is_typing: false })
      .eq('conversation_id', conversationId)
      .eq('user_id', creatorId);
    console.error('Error getting AI response:', error);
    throw error;
  }
}
