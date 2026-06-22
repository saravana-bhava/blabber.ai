import type { SupabaseClient } from '@supabase/supabase-js';

/** Stay under typical Vercel hobby ~4.5MB function payload limits for relayed uploads. */
const MAX_RELAY_BYTES = 4 * 1024 * 1024;

/**
 * MIME types like `audio/webm;codecs=opus` must not become `webm;codecs=opus` in the filename.
 */
export function voiceSampleFileExt(
  blob: Pick<Blob, 'type'>,
  fileNameHint?: string
): string {
  const fromMime = blob.type.split('/')[1]?.split(';')[0]?.trim().toLowerCase() ?? '';
  if (fromMime && /^[a-z0-9]{1,8}$/.test(fromMime)) return fromMime;
  if (fileNameHint) {
    const ext = fileNameHint.split('.').pop()?.toLowerCase() ?? '';
    if (ext && /^[a-z0-9]{1,8}$/.test(ext)) return ext;
  }
  return 'webm';
}

async function uploadVoiceSampleRelayed(audioBlob: Blob): Promise<string> {
  const ext = voiceSampleFileExt(
    audioBlob,
    audioBlob instanceof File ? audioBlob.name : undefined
  );
  const fd = new FormData();
  const uploadName =
    audioBlob instanceof File && audioBlob.name
      ? audioBlob.name
      : `voice-sample.${ext}`;
  fd.append('file', audioBlob, uploadName);

  const res = await fetch('/api/creator/upload-voice-sample', {
    method: 'POST',
    body: fd,
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; filePath?: string };
  if (!res.ok) {
    throw new Error(
      typeof data.error === 'string' ? data.error : 'Relayed storage upload failed'
    );
  }
  if (typeof data.filePath !== 'string' || !data.filePath) {
    throw new Error('Invalid upload response');
  }
  return data.filePath;
}

/**
 * Upload to `creator-content/voice-samples/…` from the browser. On network-style failures,
 * retries via same-origin API relay (server → Supabase) when the blob is small enough.
 */
export async function uploadCreatorVoiceSample(
  supabase: SupabaseClient,
  userId: string,
  audioBlob: Blob
): Promise<string> {
  const fileExt = voiceSampleFileExt(
    audioBlob,
    audioBlob instanceof File ? audioBlob.name : undefined
  );
  const filePath = `voice-samples/${userId}-${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('creator-content')
    .upload(filePath, audioBlob, {
      cacheControl: '3600',
      upsert: true,
    });

  if (!uploadError) return filePath;

  const msg = uploadError.message?.toLowerCase() ?? '';
  const isNetworkish =
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network error') ||
    msg.includes('load failed');

  if (isNetworkish && audioBlob.size <= MAX_RELAY_BYTES) {
    return uploadVoiceSampleRelayed(audioBlob);
  }

  if (isNetworkish && audioBlob.size > MAX_RELAY_BYTES) {
    throw new Error(
      `${uploadError.message} Try a shorter recording (smaller file), another network, or disable VPN/ad blockers.`
    );
  }

  throw new Error(`Storage upload failed: ${uploadError.message}`);
}
