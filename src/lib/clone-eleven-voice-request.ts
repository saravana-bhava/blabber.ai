/**
 * Server clones the file at storagePath to ElevenLabs; returns the new voice_id.
 */
export async function cloneElevenVoiceFromStoragePath(storagePath: string): Promise<string> {
  const res = await fetch('/api/voice-ai/clone-eleven-voice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storagePath }),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; voice_id?: string };
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Voice cloning failed');
  }
  if (typeof data.voice_id !== 'string' || !data.voice_id) {
    throw new Error('Voice cloning returned no voice id');
  }
  return data.voice_id;
}
