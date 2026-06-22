import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    // 1. Auth check
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const voiceId = typeof body.voiceId === 'string' ? body.voiceId.trim() : '';
    if (!voiceId) {
      return NextResponse.json({ error: 'voiceId is required' }, { status: 400 });
    }

    // 2. Verify the voice belongs to this creator before deleting it
    const admin = createServiceRoleClient();
    const { data: creatorRow, error: creatorErr } = await admin
      .from('creators')
      .select('eleven_voice_id')
      .eq('profile_id', user.id)
      .single();

    if (creatorErr || !creatorRow) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
    }
    if (creatorRow.eleven_voice_id !== voiceId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 3. Delete from ElevenLabs using server-side key only
    const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ error: 'ElevenLabs API key not configured' }, { status: 500 });
    }

    const elevenRes = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
      method: 'DELETE',
      headers: { 'xi-api-key': apiKey },
    });

    if (!elevenRes.ok) {
      const errText = await elevenRes.text();
      console.error('delete-voice: ElevenLabs error', elevenRes.status, errText);
      return NextResponse.json({ error: 'Failed to delete voice from ElevenLabs' }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('delete-voice: unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
