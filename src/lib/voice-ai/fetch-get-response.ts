export interface VoiceAiGetResponsePayload {
  creator_prompt: string;
  prompt_prefix: string;
  user_name: string;
  conversation_history: unknown[];
  message: string;
}

/**
 * Calls the external Voice AI /getResponse endpoint.
 * Used by API routes and server-side DM/cron flows (no session cookie required).
 */
export async function fetchVoiceAiGetResponse(
  payload: VoiceAiGetResponsePayload
): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_VOICE_AI_BASE_URL?.trim();
  if (!baseUrl) {
    throw new Error('Voice AI base URL not configured');
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/getResponse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Voice AI API error:', response.status, errorText);
    throw new Error('Failed to get response from AI');
  }

  return response.text();
}
