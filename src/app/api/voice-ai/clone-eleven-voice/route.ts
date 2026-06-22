import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';

function elevenApiKey(): string | null {
  return process.env.ELEVENLABS_API_KEY?.trim() || null;
}

type ElevenAddVoiceResponse = {
  voice_id?: string;
  voiceId?: string;
};

type ElevenVoiceDetails = {
  samples?: unknown[];
  preview_url?: string | null;
};

function voiceHasCloneAudio(data: ElevenVoiceDetails): boolean {
  if (Array.isArray(data.samples) && data.samples.length > 0) return true;
  if (typeof data.preview_url === 'string' && data.preview_url.length > 0) return true;
  return false;
}

async function verifyClonedVoice(
  voiceId: string,
  apiKey: string
): Promise<{ ok: boolean; usable: boolean }> {
  const res = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
    headers: { 'xi-api-key': apiKey },
  });
  if (!res.ok) {
    return { ok: false, usable: false };
  }
  const data = (await res.json()) as ElevenVoiceDetails;
  return { ok: true, usable: voiceHasCloneAudio(data) };
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimited = await checkRateLimit(session.user.id, 'clone_voice');
    if (rateLimited) return rateLimited;

    const apiKey = elevenApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured' },
        { status: 500 }
      );
    }

    let body: { storagePath?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const storagePath =
      typeof body.storagePath === 'string' ? body.storagePath.trim() : '';
    const prefix = `voice-samples/${session.user.id}-`;
    if (!storagePath.startsWith(prefix)) {
      return NextResponse.json({ error: 'Invalid voice sample path' }, { status: 403 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
    if (!supabaseUrl) {
      return NextResponse.json({ error: 'Supabase URL not configured' }, { status: 500 });
    }

    const encodedPath = storagePath
      .split('/')
      .map((seg) => encodeURIComponent(seg))
      .join('/');
    const audioUrl = `${supabaseUrl}/storage/v1/object/public/creator-content/${encodedPath}`;

    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) {
      console.error('clone-eleven-voice: storage fetch failed', audioRes.status, audioUrl);
      return NextResponse.json(
        { error: 'Could not read uploaded voice file from storage' },
        { status: 502 }
      );
    }

    const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
    if (audioBuffer.length < 100) {
      return NextResponse.json(
        { error: 'Voice sample file is empty or too small' },
        { status: 400 }
      );
    }

    const contentType =
      audioRes.headers.get('content-type') || 'application/octet-stream';
    const fileLeaf = storagePath.split('/').pop() || 'sample.webm';

    const formData = new FormData();
    formData.append('name', session.user.id);
    formData.append('files', new Blob([audioBuffer], { type: contentType }), fileLeaf);

    const addRes = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: { 'xi-api-key': apiKey },
      body: formData,
    });

    if (!addRes.ok) {
      const errText = await addRes.text();
      console.error('clone-eleven-voice: ElevenLabs add failed', addRes.status, errText);
      return NextResponse.json(
        {
          error: 'ElevenLabs rejected the voice sample',
          details: errText.slice(0, 500),
        },
        { status: 502 }
      );
    }

    const addData = (await addRes.json()) as ElevenAddVoiceResponse;
    const voiceId = addData.voice_id || addData.voiceId;
    if (!voiceId || typeof voiceId !== 'string') {
      console.error('clone-eleven-voice: missing voice_id', addData);
      return NextResponse.json(
        { error: 'ElevenLabs returned an unexpected response' },
        { status: 502 }
      );
    }

    let verified: { ok: boolean; usable: boolean } = { ok: false, usable: false };
    for (let attempt = 0; attempt < 6; attempt++) {
      verified = await verifyClonedVoice(voiceId, apiKey);
      if (verified.ok && verified.usable) break;
      if (!verified.ok) break;
      await new Promise((r) => setTimeout(r, 1200));
    }

    if (!verified.ok) {
      await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
        method: 'DELETE',
        headers: { 'xi-api-key': apiKey },
      }).catch(() => {});
      return NextResponse.json(
        { error: 'Could not verify the cloned voice with ElevenLabs' },
        { status: 502 }
      );
    }

    if (!verified.usable) {
      await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
        method: 'DELETE',
        headers: { 'xi-api-key': apiKey },
      }).catch(() => {});
      return NextResponse.json(
        {
          error:
            'Voice cloning did not attach any audio samples. Try WAV or MP3, or re-record your sample.',
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ voice_id: voiceId });
  } catch (e) {
    console.error('clone-eleven-voice:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
