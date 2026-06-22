/** Build a ws/wss URL for the voice AI WebSocket from the configured HTTP(S) base URL. */
export function toVoiceAiWebSocketUrl(baseUrl: string, sessionId: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  const wsBase = trimmed.replace(/^https:/i, 'wss:').replace(/^http:/i, 'ws:');
  return `${wsBase}/${sessionId}`;
}
